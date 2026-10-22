// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { ROLE_DEFAULTS, type ProjectRole } from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const projectId = await t.run(ctx => ctx.db.insert("projects", { name: "A" }));
  const otherProjectId = await t.run(ctx => ctx.db.insert("projects", { name: "B" }));
  async function member(role: ProjectRole, project = projectId) {
    const userId = await t.run(async ctx => {
      const userId = await ctx.db.insert("users", { role: "project_user", verified: true, name: role });
      await ctx.db.insert("userProjects", { userId, projectId: project, role });
      return userId;
    });
    const sessionId = await t.run(ctx => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 }));
    return { userId, as: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
  }
  return { t, projectId, otherProjectId, member };
}
const overtime = {
  annualOvertimeLimitHours: 270, overtimeStartToleranceMinutes: 0, monthlyHoursBase: 225,
  weekdayMultiplier: 1.5, weekendMultiplier: 2, holidayMultiplier: 2, nightShiftMultiplier: 1.5,
  nightShiftStart: "22:00", nightShiftEnd: "06:00",
};

describe("administration permissions", () => {
  it.each(["admin", "hr", "security", "technician", "viewer"] as const)("admin.manage: %s follows project membership, not global role", async role => {
    const { t, projectId, member } = await setup();
    const caller = await member(role);
    const write = () => caller.as.mutation(api.privacyRetention.setAssistantMasking, { projectId, enabled: true });
    if (role === "admin") {
      await write();
      expect(await caller.as.query(api.privacyRetention.getRetentionAndAssistant, { projectId })).toMatchObject({ aiMaskNames: true });
    } else {
      await expect(write()).rejects.toThrow("Bu işlem için yetkiniz yok");
      expect(await t.run(ctx => ctx.db.query("projectPrivacySettings").collect())).toEqual([]);
      await expect(caller.as.query(api.auditLog.list, { projectId, paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow("Bu işlem için yetkiniz yok");
      expect(await caller.as.query(api.settings.getGeneral, { projectId })).toBeNull();
    }
  });

  it.each(["admin", "hr", "security", "technician", "viewer"] as const)("schedule.manage: %s and live overrides", async role => {
    const { t, projectId, member } = await setup();
    const caller = await member(role);
    const admin = await member("admin");
    const write = () => caller.as.mutation(api.settings.saveOvertime, { projectId, ...overtime });
    if (role === "admin" || role === "hr") {
      await write();
      expect(await caller.as.query(api.settings.getWork, { projectId })).toMatchObject({ monthlyHoursBase: 225 });
      if (role === "hr") {
        await admin.as.mutation(api.roles.setRolePermissions, { projectId, role, permissions: ROLE_DEFAULTS.hr.filter(key => key !== "schedule.manage") });
        const before = await t.run(ctx => ctx.db.query("workSettings").collect());
        await expect(write()).rejects.toThrow("Bu işlem için yetkiniz yok");
        expect(await t.run(ctx => ctx.db.query("workSettings").collect())).toEqual(before);
        expect(await caller.as.query(api.settings.getWork, { projectId })).toBeNull();
      }
    } else {
      await expect(write()).rejects.toThrow("Bu işlem için yetkiniz yok");
      expect(await t.run(ctx => ctx.db.query("workSettings").collect())).toEqual([]);
    }
  });

  it("admin.manage cannot be removed from admin or granted to another role", async () => {
    const { projectId, member } = await setup();
    const admin = await member("admin");
    const hr = await member("hr");
    await expect(admin.as.mutation(api.roles.setRolePermissions, { projectId, role: "admin", permissions: [] })).rejects.toThrow("Yönetici rolünün yetkileri değiştirilemez");
    await admin.as.mutation(api.roles.setRolePermissions, { projectId, role: "hr", permissions: [...ROLE_DEFAULTS.hr, "admin.manage"] });
    await expect(hr.as.mutation(api.settings.upsertGeneral, { projectId, companyName: "X" })).rejects.toThrow("Bu işlem için yetkiniz yok");
    await admin.as.mutation(api.settings.upsertGeneral, { projectId, companyName: "Allowed" });
  });

  it("account freeze requires admin.manage in every target project and excludes any project admin", async () => {
    const { t, otherProjectId, member } = await setup();
    const caller = await member("admin");
    const target = await member("hr");
    const targetMembership = await t.run(ctx => ctx.db.insert("userProjects", { userId: target.userId, projectId: otherProjectId, role: "viewer" }));
    await expect(caller.as.mutation(api.accountAccess.freezeUser, { userId: target.userId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect((await t.run(ctx => ctx.db.get(target.userId)))?.disabledAt).toBeUndefined();
    await t.run(ctx => ctx.db.insert("userProjects", { userId: caller.userId, projectId: otherProjectId, role: "admin" }));
    await t.run(ctx => ctx.db.patch(targetMembership, { role: "admin" }));
    await expect(caller.as.mutation(api.accountAccess.freezeUser, { userId: target.userId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    await t.run(ctx => ctx.db.patch(targetMembership, { role: "security" }));
    await caller.as.mutation(api.accountAccess.freezeUser, { userId: target.userId });
    expect((await t.run(ctx => ctx.db.get(target.userId)))?.disabledAt).toBeTypeOf("number");
  });

  it("project deletion requires permission rather than ownership", async () => {
    const { t, projectId, member } = await setup();
    const owner = await member("viewer");
    const admin = await member("admin");
    await t.run(ctx => ctx.db.patch(projectId, { ownerId: owner.userId }));
    await expect(owner.as.query(api.projects.getDeletionImpact, { projectId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(owner.as.mutation(api.projects.remove, { id: projectId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(await t.run(ctx => ctx.db.get(projectId))).not.toBeNull();
    expect(await admin.as.query(api.projects.getDeletionImpact, { projectId })).toMatchObject({ canDelete: true });
    await admin.as.mutation(api.roles.setRolePermissions, { projectId, role: "hr", permissions: [] });
    await admin.as.mutation(api.projects.remove, { id: projectId });
    expect(await t.run(ctx => ctx.db.query("projectRolePermissions").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get(projectId))).toBeNull();
  });

  it("directories expose roles only in managed projects", async () => {
    const { t, projectId, otherProjectId, member } = await setup();
    const admin = await member("admin");
    const target = await member("hr");
    await t.run(ctx => ctx.db.insert("userProjects", { userId: target.userId, projectId: otherProjectId, role: "admin" }));
    await t.run(ctx => ctx.db.insert("userProjects", { userId: admin.userId, projectId: otherProjectId, role: "viewer" }));
    const listed = await admin.as.query(api.users.list, { projectId });
    expect(listed.find(user => user._id === target.userId)).toMatchObject({ role: "hr", projectId });
    const directory = await admin.as.query(api.users.adminList, { role: "hr", paginationOpts: { cursor: null, numItems: 10 } });
    expect(directory.page).toHaveLength(1);
    expect(directory.page[0]).toMatchObject({ role: "hr", projects: [{ _id: projectId, role: "hr" }] });
    await expect(admin.as.query(api.users.adminList, { project: otherProjectId, paginationOpts: { cursor: null, numItems: 10 } })).rejects.toThrow();
  });

  it("bootstrap creates an explicit admin membership without changing users.role", async () => {
    const { t, member } = await setup();
    const caller = await member("viewer");
    await t.run(async ctx => { for (const row of await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", caller.userId)).collect()) await ctx.db.delete(row._id); });
    const projectId = await caller.as.mutation(api.onboarding.ensureProjectForNewUser, {});
    expect(projectId).not.toBeNull();
    const memberships = await t.run(ctx => ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", caller.userId)).collect());
    expect(memberships).toMatchObject([{ projectId, role: "admin" }]);
    expect((await t.run(ctx => ctx.db.get(caller.userId)))?.role).toBe("project_user");
  });

  it("platform promotion and demotion preserve existing project roles", async () => {
    const { t, projectId, member } = await setup();
    const caller = await member("viewer");
    const rootId = await t.run(ctx => ctx.db.insert("users", { role: "super_admin", verified: true }));
    const sessionId = await t.run(ctx => ctx.db.insert("authSessions", { userId: rootId, expirationTime: Date.now() + 86400000 }));
    const root = t.withIdentity({ subject: `${rootId}|${sessionId}` });
    await t.run(async ctx => {
      const row = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", caller.userId)).first();
      if (row) await ctx.db.patch(row._id, { role: undefined });
    });
    await root.mutation(api.users.updateRole, { userId: caller.userId, role: "project_admin" });
    expect((await t.run(ctx => ctx.db.get(caller.userId)))?.role).toBe("project_user");
    await root.mutation(api.users.updateRole, { userId: caller.userId, role: "super_admin" });
    expect(await root.query(api.roles.listProjectMembers, { projectId })).toEqual(expect.arrayContaining([expect.objectContaining({ userId: caller.userId, role: "viewer" })]));
    await root.mutation(api.users.updateRole, { userId: caller.userId, role: "project_user" });
    expect((await caller.as.query(api.roles.myPermissions, { projectId })).role).toBe("viewer");
    const created = await root.mutation(api.projects.create, { name: "Platform creation" });
    expect(await t.run(ctx => ctx.db.query("userProjects").withIndex("by_project", q => q.eq("projectId", created)).collect())).toMatchObject([{ userId: rootId, role: "admin" }]);
  });

  it("last project admin cannot be removed via platform user deletion", async () => {
    const { t, projectId, member } = await setup();
    const admin = await member("admin");
    const rootId = await t.run(ctx => ctx.db.insert("users", { role: "super_admin", verified: true }));
    const sessionId = await t.run(ctx => ctx.db.insert("authSessions", { userId: rootId, expirationTime: Date.now() + 86400000 }));
    const root = t.withIdentity({ subject: `${rootId}|${sessionId}` });
    await expect(root.mutation(api.users.deleteUser, { userId: admin.userId })).rejects.toThrow("Projenin son yöneticisi");
    await expect(root.mutation(api.users.updateRole, { userId: admin.userId, role: "project_user", projectIds: [] })).rejects.toThrow("Projenin son yöneticisi");
    expect((await root.query(api.roles.listProjectMembers, { projectId })).map(row => row.userId)).toContain(admin.userId);
  });
});
