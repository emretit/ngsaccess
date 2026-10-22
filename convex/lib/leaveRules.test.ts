// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { approvedLeaveFields, canManageLeaves, leaveDecisionPatch } from "./leaveRules";
import type { ProjectRole } from "./roleCatalog";
const modules = import.meta.glob("../**/*.ts");
const now = "2026-10-16T10:00:00.000Z";
async function fixture(role: ProjectRole) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const userId = await ctx.db.insert("users", { role: "project_user" });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    return { projectId, userId };
  });
  return { t, ...ids };
}
describe("izin yetkisi ve durum geçişleri", () => {
  it.each(["admin", "hr"] as const)("%s doğrudan onaylı izin oluşturur", async role => {
    const f = await fixture(role);
    await f.t.run(async ctx => {
      const user = await ctx.db.get(f.userId);
      if (!user) throw new Error("Missing user");
      expect(await canManageLeaves(ctx, user, f.projectId)).toBe(true);
      expect(await approvedLeaveFields(ctx, user, f.projectId)).toEqual({ status: "approved", approvedBy: user._id });
      for (const decision of ["approved", "rejected"] as const) {
        const patch = await leaveDecisionPatch(ctx, user, f.projectId, "pending", decision, user._id, now);
        expect(patch).toEqual({ status: decision, approvedBy: user._id, updatedAt: now });
        expect({ notes: "Mevcut izin notu", ...patch }.notes).toBe("Mevcut izin notu");
        for (const status of ["approved", "rejected"] as const) await expect(leaveDecisionPatch(ctx, user, f.projectId, status, decision, user._id, now)).rejects.toThrow("Bu izin zaten sonuçlandırılmış");
      }
      for (const notes of ["Yeni not", ""]) expect(await leaveDecisionPatch(ctx, user, f.projectId, "pending", "rejected", user._id, now, notes)).toHaveProperty("notes", notes);
    });
  });
  it.each(["viewer", "security", "technician"] as const)("%s izin oluşturamaz veya sonuçlandıramaz", async role => {
    const f = await fixture(role);
    await f.t.run(async ctx => {
      const user = await ctx.db.get(f.userId);
      if (!user) throw new Error("Missing user");
      expect(await canManageLeaves(ctx, user, f.projectId)).toBe(false);
      await expect(approvedLeaveFields(ctx, user, f.projectId)).rejects.toThrow("Bu işlem için yetkiniz yok");
      for (const decision of ["approved", "rejected"] as const) await expect(leaveDecisionPatch(ctx, user, f.projectId, "pending", decision, user._id, now)).rejects.toThrow("Bu işlem için yetkiniz yok");
    });
  });
});
