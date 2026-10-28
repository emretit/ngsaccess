// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
it("creates projects with biometrics enabled and audit while preserving existing disabled projects", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100000 });
    const projectId = await ctx.db.insert("projects", { name: "Existing" });
    const privacyId = await ctx.db.insert("projectPrivacySettings", { projectId, biometricEnabled: false, updatedAt: "before" });
    return { userId, sessionId, privacyId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const projectId = await caller.mutation(api.projects.create, { name: "New project" });
  expect(await t.run(ctx => ctx.db.query("projectPrivacySettings").withIndex("by_project", q => q.eq("projectId", projectId)).unique())).toMatchObject({ biometricEnabled: true });
  expect(await t.run(ctx => ctx.db.query("auditLog").first())).toMatchObject({ projectId, targetTable: "projectPrivacySettings", newValue: { biometricEnabled: true } });
  expect(await t.run(ctx => ctx.db.get(ids.privacyId))).toMatchObject({ biometricEnabled: false, updatedAt: "before" });
});
