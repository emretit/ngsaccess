import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { approvedLeaveFields, canManageLeaves, leaveDecisionPatch } from "./leaveRules";

const adminId = "admin" as Id<"users">;
const now = "2026-10-16T10:00:00.000Z";

describe("izin yetkisi ve durum geçişleri", () => {
  it.each(["super_admin", "project_admin"] as const)("%s doğrudan onaylı izin oluşturur", (role) => {
    expect(canManageLeaves(role)).toBe(true);
    expect(approvedLeaveFields({ _id: adminId, role })).toEqual({ status: "approved", approvedBy: adminId });
  });

  it.each(["project_user", undefined] satisfies Doc<"users">["role"][])("%s izin oluşturamaz veya sonuçlandıramaz", (role) => {
    expect(canManageLeaves(role)).toBe(false);
    expect(() => approvedLeaveFields({ _id: adminId, role })).toThrow("Bu işlem için yetkiniz yok");
    for (const decision of ["approved", "rejected"] as const) {
      expect(() => leaveDecisionPatch(role, "pending", decision, adminId, now)).toThrow("Bu işlem için yetkiniz yok");
    }
  });

  it.each(["approved", "rejected"] as const)("bekleyen kayıt %s olur, eski not korunur", (decision) => {
    const patch = leaveDecisionPatch("project_admin", "pending", decision, adminId, now);
    expect(patch).toEqual({ status: decision, approvedBy: adminId, updatedAt: now });
    expect({ notes: "Mevcut izin notu", ...patch }.notes).toBe("Mevcut izin notu");
    expect(patch).not.toHaveProperty("notes");
  });

  it.each(["approved", "rejected"] as const)("%s kayıt tekrar sonuçlandırılamaz", (status) => {
    for (const decision of ["approved", "rejected"] as const) {
      expect(() => leaveDecisionPatch("super_admin", status, decision, adminId, now)).toThrow("Bu izin zaten sonuçlandırılmış");
    }
  });

  it.each(["Yeni not", ""])("açıkça verilen not uygulanır: %s", (notes) => {
    expect(leaveDecisionPatch("super_admin", "pending", "rejected", adminId, now, notes)).toHaveProperty("notes", notes);
  });
});
