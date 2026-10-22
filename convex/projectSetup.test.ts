// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { getHikModelSpec, resolveHikModelSpec } from "./lib/hikModels";

const modules = import.meta.glob("./**/*.ts");
async function fixture(role: "super_admin" | "project_admin" | "project_user" = "super_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Kurulum" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    return { projectId, otherProjectId, userId, sessionId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

describe("proje kurulumu", () => {
  it("starts at 0/5; each requirement independently advances until the first successful passage", async () => {
    const f = await fixture();
    const status = () => f.caller.query(api.projects.getSetupStatus, { projectId: f.projectId });
    const check = async (count: number) => {
      const result = await status();
      expect(result.steps.filter(step => step.done)).toHaveLength(count);
      expect(result.complete).toBe(count === 5);
    };
    await check(0); // super_admin membership must not complete step 1.
    await f.t.run(async ctx => {
      const adminId = await ctx.db.insert("users", { role: "project_admin" });
      await ctx.db.insert("userProjects", { projectId: f.otherProjectId, userId: adminId });
      await ctx.db.insert("devices", { projectId: f.otherProjectId, name: "Diğer", lastSeen: "2026-10-22", createdAt: "", updatedAt: "" });
      await ctx.db.insert("employees", { projectId: f.otherProjectId, firstName: "Test", lastName: "Test", email: "", cardNumber: "1", isActive: true });
      await ctx.db.insert("accessRules", { projectId: f.otherProjectId, name: "Diğer", isActive: true });
      await ctx.db.insert("cardReadings", { projectId: f.otherProjectId, cardNo: "1", accessTime: "2026-10-22", accessStatus: "izin_verildi" });
    });
    await check(0);
    await f.t.run(async ctx => {
      const userId = await ctx.db.insert("users", { role: "project_admin" });
      await ctx.db.insert("userProjects", { projectId: f.projectId, userId });
    });
    await check(1);
    const deviceId = await f.t.run(ctx => ctx.db.insert("devices", { projectId: f.projectId, name: "Terminal", createdAt: "", updatedAt: "" }));
    await check(1);
    await f.t.run(ctx => ctx.db.patch(deviceId, { lastSeen: "2026-10-22" }));
    await check(2);
    const employeeId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "Test", lastName: "Test", email: "", cardNumber: "", isActive: true }));
    await check(2);
    await f.t.run(ctx => ctx.db.patch(employeeId, { cardNumber: "1", isActive: false }));
    await check(2);
    await f.t.run(ctx => ctx.db.patch(employeeId, { isActive: true, isVisitor: true }));
    await check(2);
    await f.t.run(ctx => ctx.db.patch(employeeId, { isVisitor: false }));
    await check(3);
    const ruleId = await f.t.run(ctx => ctx.db.insert("accessRules", { projectId: f.projectId, name: "Yetki", isActive: false }));
    await check(3);
    await f.t.run(ctx => ctx.db.patch(ruleId, { isActive: true }));
    await check(4);
    const readingId = await f.t.run(ctx => ctx.db.insert("cardReadings", { projectId: f.projectId, cardNo: "1", accessTime: "2026-10-22", accessStatus: "reddedildi" }));
    await check(4);
    await f.t.run(ctx => ctx.db.patch(readingId, { accessStatus: "izin_verildi" }));
    await check(5);
  });
  it("allows the project administrator but rejects another project's administrator", async () => {
    const f = await fixture("project_admin");
    expect((await f.caller.query(api.projects.getSetupStatus, { projectId: f.projectId })).steps[0].done).toBe(true);
    await expect(f.caller.query(api.projects.getSetupStatus, { projectId: f.otherProjectId })).rejects.toThrow("erişim");
  });
  it("rejects project_user", async () => {
    const f = await fixture("project_user");
    await expect(f.caller.query(api.projects.getSetupStatus, { projectId: f.projectId })).rejects.toThrow("yetkiniz yok");
  });
  it("catalogues DS-K1T804 as a gateway terminal with one door and reader", () => {
    expect(getHikModelSpec("DS-K1T804")).toMatchObject({ family: "terminal", transportHint: "gateway" });
    expect(resolveHikModelSpec("DS-K1T804")).toEqual(resolveHikModelSpec("DS-K1T807"));
  });
});
