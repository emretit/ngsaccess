// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { ROLE_DEFAULTS, type Permission, type ProjectRole } from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");
async function setup(role: ProjectRole) {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { name: "Worker", role: "project_user", verified: true });
    const adminId = await ctx.db.insert("users", { name: "Admin", role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    await ctx.db.insert("userProjects", { userId: adminId, projectId, role: "admin" });
    await ctx.db.insert("userProjects", { userId, projectId: otherProjectId, role: "viewer" });
    const userSession = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const adminSession = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: Date.now() + 86400000 });
    const fields = { firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "123", isActive: true, hourlyRate: 100, monthlySalary: 20000, terminationReason: "Private", sgkExitCode: "03" };
    const employeeId = await ctx.db.insert("employees", { ...fields, projectId });
    const otherEmployeeId = await ctx.db.insert("employees", { ...fields, projectId: otherProjectId, cardNumber: "456" });
    const visitorId = await ctx.db.insert("employees", { ...fields, projectId, isVisitor: true, isActive: false, cardNumber: "789" });
    return { projectId, otherProjectId, userId, adminId, userSession, adminSession, employeeId, otherEmployeeId, visitorId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.userSession}` }), admin: t.withIdentity({ subject: `${ids.adminId}|${ids.adminSession}` }) };
}
type Fixture = Awaited<ReturnType<typeof setup>>;
const cases = [
  { permission: "employees.view", role: "technician" },
  { permission: "employees.manage", role: "hr" },
  { permission: "biometrics.manage", role: "hr" },
  { permission: "pay.view", role: "hr" },
  { permission: "schedule.manage", role: "hr" },
  { permission: "attendance.approve", role: "hr" },
  { permission: "reports.view", role: "viewer" },
  { permission: "visitors.manage", role: "security" },
] as const satisfies ReadonlyArray<{ permission: Permission; role: ProjectRole }>;
async function invoke(f: Fixture, permission: Permission) {
  switch (permission) {
    case "employees.view": return f.caller.query(api.employees.getById, { employeeId: f.employeeId });
    case "employees.manage": return f.caller.mutation(api.departments.create, { projectId: f.projectId, name: "HR" });
    case "biometrics.manage": return f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "biometric_fingerprint" });
    case "pay.view": return f.caller.query(api.employees.getById, { employeeId: f.employeeId });
    case "schedule.manage": return f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: "Day", startTime: "08:00", endTime: "17:00" });
    case "attendance.approve": return f.caller.mutation(api.leaves.create, { employeeId: f.employeeId, leaveType: "annual", startDate: "2026-11-02", endDate: "2026-11-03" });
    case "reports.view": return f.caller.mutation(api.reports.saveReportSchedule, { projectId: f.projectId, email: "worker@test.com", enabled: false, reportType: "attendance" });
    case "visitors.manage": return f.caller.mutation(api.visitors.releaseCard, { visitorId: f.visitorId });
    default: throw new Error("Unsupported test permission");
  }
}
async function snapshot(f: Fixture) {
  return f.t.run(async ctx => Promise.all([
    ctx.db.query("employees").collect(), ctx.db.query("departments").collect(),
    ctx.db.query("employeeConsents").collect(), ctx.db.query("shifts").collect(),
    ctx.db.query("leaves").collect(), ctx.db.query("reportScheduleSettings").collect(), ctx.db.query("auditLog").collect(),
  ]));
}
async function expectDenied(f: Fixture, permission: Permission) {
  const before = await snapshot(f);
  if (permission === "pay.view") {
    const row = await f.caller.query(api.employees.getById, { employeeId: f.employeeId });
    expect(row?.hourlyRate).toBeNull();
    expect(row?.monthlySalary).toBeNull();
  } else await expect(invoke(f, permission)).rejects.toThrow("Bu işlem için yetkiniz yok");
  expect(await snapshot(f)).toEqual(before);
}
describe.each(cases)("people permission $permission", ({ permission, role }) => {
  it("default role passes, explicit denial cannot mutate, and current overrides revoke access", async () => {
    const allowed = await setup(role);
    await invoke(allowed, permission);
    const denied = await setup("technician");
    // employees.view is granted to every default role; an empty override removes it.
    if (permission === "employees.view") await denied.admin.mutation(api.roles.setRolePermissions, { projectId: denied.projectId, role: "technician", permissions: [] });
    await expectDenied(denied, permission);
    const revoked = await setup(role);
    await revoked.admin.mutation(api.roles.setRolePermissions, { projectId: revoked.projectId, role, permissions: ROLE_DEFAULTS[role].filter(p => p !== permission) });
    await expectDenied(revoked, permission);
  });
});
it("pay and termination fields follow the row project and independently revocable keys", async () => {
  const f = await setup("hr");
  const own = await f.caller.query(api.employees.getById, { employeeId: f.employeeId });
  const other = await f.caller.query(api.employees.getById, { employeeId: f.otherEmployeeId });
  expect(own).toMatchObject({ hourlyRate: 100, terminationReason: "Private", sgkExitCode: "03" });
  expect(other).toMatchObject({ hourlyRate: null, monthlySalary: null });
  expect(other?.terminationReason).toBeUndefined();
  expect(other?.sgkExitCode).toBeUndefined();
  await f.admin.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: "hr", permissions: ROLE_DEFAULTS.hr.filter(p => p !== "employees.manage") });
  const revoked = await f.caller.query(api.employees.getById, { employeeId: f.employeeId });
  expect(revoked?.hourlyRate).toBe(100);
  expect(revoked?.terminationReason).toBeUndefined();
  expect(revoked?.sgkExitCode).toBeUndefined();
});
it("scheduled reports recheck the recipient's current reports.view permission", async () => {
  const f = await setup("viewer");
  await f.caller.mutation(api.reports.saveReportSchedule, { projectId: f.projectId, email: "worker@test.com", enabled: true, reportType: "attendance" });
  const scheduleId = await f.t.run(async ctx => (await ctx.db.query("reportScheduleSettings").first())?._id);
  if (!scheduleId) throw new Error("Missing schedule");
  const { internal } = await import("./_generated/api");
  expect(await f.t.query(internal.reports.getReportSummaryForEmail, { scheduleId, year: 2026, month: 10 })).not.toBeNull();
  await f.admin.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: "viewer", permissions: ROLE_DEFAULTS.viewer.filter(p => p !== "reports.view") });
  expect(await f.t.query(internal.reports.getReportSummaryForEmail, { scheduleId, year: 2026, month: 10 })).toBeNull();
});
it("photo consent uses employees.manage while biometric consent and privacy settings have separate gates", async () => {
  const f = await setup("hr");
  await f.admin.mutation(api.roles.setRolePermissions, { projectId: f.projectId, role: "hr", permissions: ROLE_DEFAULTS.hr.filter(p => p !== "biometrics.manage") });
  await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo" })).resolves.toBeDefined();
  const before = await snapshot(f);
  await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "biometric_face" })).rejects.toThrow("Bu işlem için yetkiniz yok");
  await expect(f.caller.mutation(api.privacyBiometric.setBiometricModule, { projectId: f.projectId, enabled: false })).rejects.toThrow("Bu işlem için yetkiniz yok");
  expect(await snapshot(f)).toEqual(before);
  await f.admin.mutation(api.privacyBiometric.setBiometricModule, { projectId: f.projectId, enabled: false });
});
