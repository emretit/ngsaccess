// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { ROLE_DEFAULTS, type ProjectRole } from "./lib/roleCatalog";
const modules = import.meta.glob("./**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const projectId = await t.run(ctx => ctx.db.insert("projects", { name: "A" }));
  async function member(role: ProjectRole, platform: "project_user" | "project_admin" | "super_admin" = "project_user") {
    const userId = await t.run(async ctx => {
      const id = await ctx.db.insert("users", { role: platform, verified: true });
      await ctx.db.insert("userProjects", { userId: id, projectId, role });
      return id;
    });
    const sessionId = await t.run(ctx => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 }));
    return { userId, as: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
  }
  return { t, projectId, member };
}
it("Y-1: old platform admin cannot write rules after project demotion; technician can", async () => {
  const f = await setup();
  const viewer = await f.member("viewer", "project_admin");
  await expect(viewer.as.mutation(api.accessRules.create, { projectId: f.projectId, name: "Denied", days: ["Monday"], startTime: "08:00", endTime: "17:00" })).rejects.toThrow("Bu işlem için yetkiniz yok");
  const technician = await f.member("technician");
  await technician.as.mutation(api.accessRules.create, { projectId: f.projectId, name: "Allowed", days: ["Monday"], startTime: "08:00", endTime: "17:00" });
});
it("Y-1: admin invite keeps a fresh account normal and puts admin only on membership", async () => {
  const f = await setup();
  const userId = await f.t.run(async ctx => {
    const id = await ctx.db.insert("users", { email: "fresh@example.com", verified: false });
    await ctx.db.insert("invites", { token: "token", email: "fresh@example.com", role: "admin", projectId: f.projectId, type: "invite", used: false, createdBy: id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });
    return id;
  });
  const sessionId = await f.t.run(ctx => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 }));
  await f.t.withIdentity({ subject: `${userId}|${sessionId}` }).mutation(api.invites.consume, { token: "token", email: "fresh@example.com" });
  expect(await f.t.run(ctx => ctx.db.get(userId))).toMatchObject({ role: "project_user" });
  expect(await f.t.run(ctx => ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", userId)).first())).toMatchObject({ role: "admin" });
});
it("O-1: platform demotion rewrites explicit and legacy memberships to viewer", async () => {
  const f = await setup();
  const operator = await f.member("admin", "super_admin");
  const target = await f.member("admin", "super_admin");
  await f.member("admin");
  await operator.as.mutation(api.users.updateRole, { userId: target.userId, role: "project_user" });
  expect(await target.as.query(api.roles.myPermissions, { projectId: f.projectId })).toMatchObject({ role: "viewer", permissions: ROLE_DEFAULTS.viewer });
});
// F1-O1: super_admin üyeliği yönetici sayımına girmez; onu çıkarmak müşteri yöneticisi olmayan projeyi kilitlememeli.
it("F1-O1: a super admin can be demoted, unassigned or deleted where no customer admin exists", async () => {
  const f = await setup();
  const operator = await f.member("admin", "super_admin");
  const demoted = await f.member("admin", "super_admin");
  await operator.as.mutation(api.users.updateRole, { userId: demoted.userId, role: "project_user" });
  expect(await demoted.as.query(api.roles.myPermissions, { projectId: f.projectId })).toMatchObject({ role: "viewer" });
  const unassigned = await f.member("admin", "super_admin");
  await operator.as.mutation(api.users.updateRole, { userId: unassigned.userId, role: "super_admin", projectIds: [] });
  expect(await f.t.run(ctx => ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", unassigned.userId)).first())).toBeNull();
  const deleted = await f.member("admin", "super_admin");
  await operator.as.mutation(api.users.deleteUser, { userId: deleted.userId });
  expect(await f.t.run(ctx => ctx.db.get(deleted.userId))).toBeNull();
});
it("O-1: removing the last customer admin membership is still rejected", async () => {
  const f = await setup();
  const operator = await f.member("admin", "super_admin");
  const customerAdmin = await f.member("admin");
  await expect(operator.as.mutation(api.users.updateRole, { userId: customerAdmin.userId, role: "project_user", projectIds: [] })).rejects.toThrow("son yöneticisi");
  await expect(operator.as.mutation(api.users.deleteUser, { userId: customerAdmin.userId })).rejects.toThrow("son yöneticisi");
});
it("F2-O1: the last customer admin cannot be promoted out of the admin count", async () => {
  const f = await setup();
  const operator = await f.member("admin", "super_admin");
  const customerAdmin = await f.member("admin");
  await f.t.run(ctx => ctx.db.patch(customerAdmin.userId, { email: "last@example.com" }));
  await expect(operator.as.mutation(api.users.updateRole, { userId: customerAdmin.userId, role: "super_admin" })).rejects.toThrow("son yöneticisi");
  await expect(f.t.mutation(internal.users.setRoleByEmail, { email: "last@example.com", role: "super_admin" })).rejects.toThrow("son yöneticisi");
  expect(await f.t.run(ctx => ctx.db.get(customerAdmin.userId))).toMatchObject({ role: "project_user" });
  await f.member("admin");
  await operator.as.mutation(api.users.updateRole, { userId: customerAdmin.userId, role: "super_admin" });
  expect(await f.t.run(ctx => ctx.db.get(customerAdmin.userId))).toMatchObject({ role: "super_admin" });
});
it("F1-D2: internal setRoleByEmail demotion rewrites explicit admin memberships", async () => {
  const f = await setup();
  const target = await f.member("admin", "super_admin");
  await f.t.run(ctx => ctx.db.patch(target.userId, { email: "ops@example.com" }));
  await f.t.mutation(internal.users.setRoleByEmail, { email: "ops@example.com", role: "project_user" });
  expect(await target.as.query(api.roles.myPermissions, { projectId: f.projectId })).toMatchObject({ role: "viewer", permissions: ROLE_DEFAULTS.viewer });
});
it("O-2: a super admin membership cannot replace the last customer admin", async () => {
  const f = await setup();
  await f.member("admin", "super_admin");
  const admin = await f.member("admin");
  await expect(admin.as.mutation(api.roles.setMemberRole, { projectId: f.projectId, userId: admin.userId, role: "viewer" })).rejects.toThrow("son yöneticisinin");
});
it("D-1: HR without pay.view cannot create or update salary, but ordinary edits pass", async () => {
  const f = await setup();
  const hr = await f.member("hr");
  await f.t.run(ctx => ctx.db.insert("projectRolePermissions", { projectId: f.projectId, role: "hr", permissions: ROLE_DEFAULTS.hr.filter(p => p !== "pay.view"), updatedBy: hr.userId, updatedAt: Date.now() }));
  await expect(hr.as.mutation(api.employees.create, { projectId: f.projectId, firstName: "A", lastName: "B", email: "", cardNumber: "", hourlyRate: 10 })).rejects.toThrow("Bu işlem için yetkiniz yok");
  const employeeId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "A", lastName: "B", email: "", cardNumber: "", monthlySalary: 50000 }));
  for (const salary of [{ hourlyRate: 1 }, { monthlySalary: null }]) await expect(hr.as.mutation(api.employees.update, { employeeId, ...salary })).rejects.toThrow("Bu işlem için yetkiniz yok");
  await hr.as.mutation(api.employees.update, { employeeId, notes: "safe" });
  expect(await f.t.run(ctx => ctx.db.get(employeeId))).toMatchObject({ notes: "safe", monthlySalary: 50000 });
});
it("F1-D1: moving a paid employee needs pay.view in the source project", async () => {
  const f = await setup();
  const hr = await f.member("hr");
  const otherProjectId = await f.t.run(async ctx => {
    const id = await ctx.db.insert("projects", { name: "B" });
    await ctx.db.insert("userProjects", { userId: hr.userId, projectId: id, role: "hr" });
    await ctx.db.insert("projectRolePermissions", { projectId: f.projectId, role: "hr", permissions: ROLE_DEFAULTS.hr.filter(p => p !== "pay.view"), updatedBy: hr.userId, updatedAt: Date.now() });
    return id;
  });
  const paid = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "A", lastName: "B", email: "", cardNumber: "", monthlySalary: 50000 }));
  await expect(hr.as.mutation(api.employees.update, { employeeId: paid, projectId: otherProjectId })).rejects.toThrow("Bu işlem için yetkiniz yok");
  expect(await f.t.run(ctx => ctx.db.get(paid))).toMatchObject({ projectId: f.projectId });
  const unpaid = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "C", lastName: "D", email: "", cardNumber: "" }));
  await hr.as.mutation(api.employees.update, { employeeId: unpaid, projectId: otherProjectId });
  expect(await f.t.run(ctx => ctx.db.get(unpaid))).toMatchObject({ projectId: otherProjectId });
});
it("F1-D3: attendance detail pay follows pay.view in the employee's project", async () => {
  const f = await setup();
  const hr = await f.member("hr");
  const viewer = await f.member("viewer");
  const employeeId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "A", lastName: "B", email: "", cardNumber: "", hourlyRate: 100 }));
  const args = { projectId: f.projectId, employeeId, startDate: "2026-10-01", endDate: "2026-10-02" };
  expect((await hr.as.query(api.cardReadings.getEmployeeAttendanceDetail, args))?.summary.overtimePayTRY).toBe(0);
  expect((await viewer.as.query(api.cardReadings.getEmployeeAttendanceDetail, args))?.summary.overtimePayTRY).toBeNull();
});
it("D-2: a rules-only role cannot start a full project redistribution", async () => {
  const f = await setup();
  const tech = await f.member("technician");
  await f.t.run(ctx => ctx.db.insert("projectRolePermissions", { projectId: f.projectId, role: "technician", permissions: ["accessRules.manage"], updatedBy: tech.userId, updatedAt: Date.now() }));
  await expect(tech.as.mutation(api.accessGrantStatus.redistribute, { projectId: f.projectId })).rejects.toThrow("Bu işlem için yetkiniz yok");
  await expect(tech.as.mutation(api.accessGrantStatus.redistribute, { projectId: f.projectId, pairs: [] })).rejects.toThrow("1–100 kişi×cihaz seçin");
});
it("backfill advances beyond 2000 already-filled memberships", async () => {
  const f = await setup();
  const user = await f.member("viewer");
  await f.t.run(async ctx => {
    for (let i = 0; i < 2001; i++) await ctx.db.insert("userProjects", { userId: user.userId, projectId: f.projectId, role: "viewer" });
    await ctx.db.insert("userProjects", { userId: user.userId, projectId: f.projectId });
  });
  expect(await f.t.mutation(internal.roles.backfillMemberRoles, {})).toEqual({ updated: 1, remaining: false });
});
it("Y-1: every rule write uses the stored project permission", async () => {
  const f = await setup();
  const caller = await f.member("viewer", "project_admin");
  const ruleId = await f.t.run(ctx => ctx.db.insert("accessRules", { projectId: f.projectId, name: "Existing", days: ["Monday"], isActive: true }));
  const relationDiff = { employees: { added: [], removed: [] }, devices: { added: [], removed: [] }, doors: { added: [], removed: [] } };
  const writes = [
    () => caller.as.mutation(api.accessRules.update, { ruleId, name: "X" }),
    () => caller.as.mutation(api.accessRules.remove, { ruleId }),
    () => caller.as.mutation(api.accessRules.createWithGroups, { projectId: f.projectId, name: "X", days: ["Monday"] }),
    () => caller.as.mutation(api.accessRules.updateWithGroups, { ruleId, relationDiff }),
    () => caller.as.mutation(api.accessRules.updateWithGroupsTracked, { ruleId, relationDiff }),
  ];
  for (const write of writes) await expect(write()).rejects.toThrow("Bu işlem için yetkiniz yok");
  expect(await f.t.run(ctx => ctx.db.get(ruleId))).toMatchObject({ name: "Existing" });
});
// expectedCurrentCard bayat: dış yetki kontrolü olmasa CARD_CHANGED dönerdi; yetki hatası dış kapıyı kanıtlar.
it("Y-1: legacy admin cannot assign cards without employees.manage", async () => {
  const f = await setup();
  const caller = await f.member("viewer", "project_admin");
  const employeeId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "A", lastName: "B", email: "", cardNumber: "old", isActive: true }));
  const readingId = await f.t.run(ctx => ctx.db.insert("cardReadings", { projectId: f.projectId, cardNo: "new", accessTime: "2026-10-22T08:00:00Z" }));
  await expect(caller.as.mutation(api.cardReadings.assignCardFromReading, { employeeId, readingId, expectedCurrentCard: "stale" })).rejects.toThrow("Bu işlem için yetkiniz yok");
  expect(await f.t.run(ctx => ctx.db.get(employeeId))).toMatchObject({ cardNumber: "old" });
});
