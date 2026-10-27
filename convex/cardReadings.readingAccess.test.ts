// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { PERMISSION_DENIED } from "./lib/permissions";
import type { Permission, ProjectRole } from "./lib/roleCatalog";
const modules = import.meta.glob("./**/*.ts");
const date = "2026-10-20";
const page = { numItems: 10, cursor: null };
async function fixture(role: ProjectRole, permissions?: Permission[], superAdmin = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Reading access" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Foreign" });
    const userId = await ctx.db.insert("users", { role: superAdmin ? "super_admin" : "project_user", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    if (permissions) await ctx.db.insert("projectRolePermissions", { projectId, role, permissions, updatedAt: 0, updatedBy: userId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test.invalid", cardNumber: "1", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Reader", createdAt: "", updatedAt: "" });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId, name: "Door", ioId: 0, createdAt: "", updatedAt: "" });
    await ctx.db.insert("readers", { projectId, deviceId, doorId, name: "Reader", direction: "entry", createdAt: "", updatedAt: "" });
    const readingId = await ctx.db.insert("cardReadings", { projectId, employeeId, deviceId, cardNo: "1", ideIoId: 0, employeeName: "Ada Test", accessTime: `${date}T06:00:00Z`, accessStatus: "izin_verildi", direction: "entry" });
    await ctx.db.insert("cardReadings", { projectId, deviceId, cardNo: "unknown", accessTime: `${date}T07:00:00Z` });
    return { projectId, otherProjectId, employeeId, deviceId, readingId, doorId };
  });
  // Get auth identifiers without exposing them as endpoint arguments.
  const auth = await t.run(async ctx => {
    const session = await ctx.db.query("authSessions").first();
    if (!session) throw new Error("Missing test session");
    return session;
  });
  return { ...ids, t, caller: t.withIdentity({ subject: `${auth.userId}|${auth._id}` }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const reports = [
  { name: "annual balance", run: (f: Fixture) => f.caller.query(api.dashboard.getAnnualOvertimeBalance, { projectId: f.projectId, year: 2026 }) },
  { name: "repeat late", run: (f: Fixture) => f.caller.query(api.dashboard.getRepeatLateOffenders, { projectId: f.projectId }) },
  { name: "break violations", run: (f: Fixture) => f.caller.query(api.dashboard.getBreakViolations, { projectId: f.projectId, date }) },
  { name: "activity", run: (f: Fixture) => f.caller.query(api.dashboard.getActivitySummary, { projectId: f.projectId }) },
  { name: "table", run: (f: Fixture) => f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, date }) },
  { name: "payroll", run: (f: Fixture) => f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 }) },
  { name: "transactions", run: (f: Fixture) => f.caller.query(api.cardReadings.listReportTransactions, { projectId: f.projectId, paginationOpts: page }) },
  { name: "attendance detail", run: (f: Fixture) => f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { employeeId: f.employeeId, startDate: date, endDate: date }) },
];
const monitoring = [
  { name: "list", run: (f: Fixture) => f.caller.query(api.cardReadings.list, { projectId: f.projectId, paginationOpts: page }) },
  { name: "filtered", run: (f: Fixture) => f.caller.query(api.cardReadings.listFiltered, { projectId: f.projectId, paginationOpts: page }) },
  { name: "live", run: (f: Fixture) => f.caller.query(api.cardReadings.listLiveSince, { projectId: f.projectId, limit: 10 }) },
  { name: "people", run: (f: Fixture) => f.caller.query(api.cardReadings.searchMonitoringPeople, { projectId: f.projectId, search: "" }) },
  { name: "last", run: (f: Fixture) => f.caller.query(api.cardReadings.lastMonitoringReading, { projectId: f.projectId }) },
  { name: "timeline", run: (f: Fixture) => f.caller.query(api.dashboard.getTodayTimeline, { projectId: f.projectId }) },
  { name: "recent", run: (f: Fixture) => f.caller.query(api.dashboard.getRecentReadings, { projectId: f.projectId }) },
  { name: "employee recent", run: (f: Fixture) => f.caller.query(api.peopleActivity.employeeRecentReadings, { employeeId: f.employeeId }) },
];
describe.each(["viewer", "security"] as const)("%s report access", role => {
  it.each([...reports, ...monitoring])("allows $name", async ({ run }) => { await expect(run(await fixture(role))).resolves.toBeDefined(); });
});
describe("technician reading classes", () => {
  it.each(reports)("denies $name", async ({ run }) => { await expect(run(await fixture("technician"))).rejects.toThrow(PERMISSION_DENIED); });
  it.each(monitoring)("allows $name", async ({ run }) => { await expect(run(await fixture("technician"))).resolves.toBeDefined(); });
});
describe("custom role and capture access", () => {
  it.each([...reports, ...monitoring])("denies $name with removed permissions", async ({ run }) => { await expect(run(await fixture("viewer", ["employees.view"]))).rejects.toThrow(PERMISSION_DENIED); });
  it("excludes unauthorized projects from unselected lists", async () => {
    const f = await fixture("viewer", ["employees.view"]);
    expect(await f.caller.query(api.dashboard.getRecentReadings, {})).toEqual([]);
    expect((await f.caller.query(api.dashboard.getTodayTimeline, {})).total).toBe(0);
    expect(await f.caller.query(api.cardReadings.getLastUnknownByDevice, { deviceId: f.deviceId })).toBeNull();
  });
  it("unselected lists retain authorized memberships only", async () => {
    const f = await fixture("viewer", []);
    await f.t.run(async ctx => {
      const auth = await ctx.db.query("authSessions").first();
      if (!auth) throw new Error("Missing session");
      await ctx.db.insert("userProjects", { userId: auth.userId, projectId: f.otherProjectId, role: "technician" });
      await ctx.db.insert("cardReadings", { projectId: f.otherProjectId, cardNo: "other", accessTime: `${date}T08:00:00Z` });
    });
    const rows = await f.caller.query(api.dashboard.getRecentReadings, {});
    expect(rows.map(row => row.cardNo)).toEqual(["other"]);
  });
  it.each(["employees.manage", "visitors.manage", "devices.manage", "reports.view"] as const)("allows capture with %s alone", async permission => {
    const f = await fixture("security", [permission]);
    expect((await f.caller.query(api.cardReadings.getLastUnknownByDevice, { projectId: f.projectId, deviceId: f.deviceId }))?.cardNo).toBe("unknown");
  });
  it("denies explicit capture without a class permission", async () => {
    const f = await fixture("security", []);
    await expect(f.caller.query(api.cardReadings.getLastUnknownByDevice, { projectId: f.projectId, deviceId: f.deviceId })).rejects.toThrow(PERMISSION_DENIED);
  });
  it("checks membership before permission", async () => {
    const f = await fixture("viewer");
    await expect(f.caller.query(api.cardReadings.list, { projectId: f.otherProjectId, paginationOpts: page })).rejects.toThrow("Bu projeye erişim yetkiniz yok");
  });
  it.each(reports)("super admin allows $name despite role customization", async ({ run }) => { await expect(run(await fixture("viewer", [], true))).resolves.toBeDefined(); });
  it("requires projectId in validators and public argument types", async () => {
    const f = await fixture("viewer");
    // @ts-expect-error projectId is mandatory, and runtime validation must agree.
    await expect(f.caller.query(api.cardReadings.getPdksTableData, { date })).rejects.toThrow();
    // @ts-expect-error projectId is mandatory for payroll too.
    await expect(f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { year: 2026, month: 10 })).rejects.toThrow();
  });
});


describe("reading detail direct link", () => {
  // Inaccessible direct links resolve to null (EmptyState), never an error that reveals existence.
  it.each(["viewer", "security", "technician"] as const)("returns the reading for %s", async role => {
    const f = await fixture(role);
    expect(await f.caller.query(api.cardReadings.getReading, { readingId: f.readingId })).not.toBeNull();
  });
  it("returns null without a monitoring permission", async () => {
    const f = await fixture("viewer", ["employees.view"]);
    expect(await f.caller.query(api.cardReadings.getReading, { readingId: f.readingId })).toBeNull();
  });
  it("returns null for a reading in a project the caller is not a member of", async () => {
    const f = await fixture("viewer");
    const foreign = await f.t.run(async ctx => await ctx.db.insert("cardReadings", { projectId: f.otherProjectId, cardNo: "foreign", accessTime: `${date}T08:00:00Z` }));
    expect(await f.caller.query(api.cardReadings.getReading, { readingId: foreign })).toBeNull();
  });
});

describe("embedded reading redaction", () => {
  it.each([
    { permissions: [], visible: false },
    { permissions: ["reports.view"], visible: true },
    { permissions: ["devices.manage"], visible: true },
  ] satisfies { permissions: Permission[]; visible: boolean }[])("door status remains available: $permissions", async ({ permissions, visible }) => {
    const f = await fixture("viewer", permissions);
    const rows = await f.caller.query(api.doors.readerStatus, { projectId: f.projectId });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastCardNo).toBe(visible ? "1" : null);
    expect(rows[0]?.lastEmployeeName).toBe(visible ? "Ada Test" : null);
    expect(rows[0]?.lastReadAt).toBe(visible ? `${date}T06:00:00Z` : null);
    expect(rows[0]?.online).toBeTypeOf("boolean");
  });
  it.each([
    { permissions: [], visible: false },
    { permissions: ["visitors.manage"], visible: true },
    { permissions: ["reports.view"], visible: true },
    { permissions: ["devices.manage"], visible: false },
  ] satisfies { permissions: Permission[]; visible: boolean }[])("visitor data keeps its shape: $permissions", async ({ permissions, visible }) => {
    const f = await fixture("security", permissions);
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { isVisitor: true }));
    if (!visible) {
      await expect(f.caller.query(api.visitors.getDetail, { visitorId: f.employeeId })).rejects.toThrow("Ziyaretçileri görüntüleme yetkiniz yok");
      await expect(f.caller.query(api.visitors.listPage, { projectId: f.projectId, paginationOpts: page })).rejects.toThrow("Ziyaretçileri görüntüleme yetkiniz yok");
      await expect(f.caller.query(api.visitors.summary, { projectId: f.projectId })).rejects.toThrow("Ziyaretçileri görüntüleme yetkiniz yok");
      return;
    }
    const detail = await f.caller.query(api.visitors.getDetail, { visitorId: f.employeeId });
    expect(detail?.recentReadings).toHaveLength(visible ? 1 : 0);
    expect(detail?.presence).toBe(visible ? "inside" : null);
    expect(detail?.lastSeenAt).toBe(visible ? `${date}T06:00:00Z` : null);
    const list = await f.caller.query(api.visitors.listPage, { projectId: f.projectId, paginationOpts: page });
    expect(list.page).toHaveLength(1);
    expect(list.page[0]?.presence).toBe(visible ? "inside" : null);
    expect(list.page[0]?.lastDirection).toBe(visible ? "entry" : null);
    const summary = await f.caller.query(api.visitors.summary, { projectId: f.projectId });
    expect(summary.total).toBe(1);
  });
});

describe("report company filter", () => {
  it("keeps only readings and payroll rows of the selected company's people", async () => {
    const f = await fixture("admin");
    const { companyId, otherCompanyId } = await f.t.run(async ctx => {
      const companyId = await ctx.db.insert("companies", { projectId: f.projectId, name: "NGS" });
      const otherCompanyId = await ctx.db.insert("companies", { projectId: f.projectId, name: "Fabrika" });
      await ctx.db.patch(f.employeeId, { companyId });
      // Vardiyasız kişi aylık tabloda satır almaz.
      const shiftId = await ctx.db.insert("shifts", { projectId: f.projectId, name: "Gündüz", startTime: "09:00", endTime: "18:00", createdAt: "", updatedAt: "" });
      await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
      return { companyId, otherCompanyId };
    });
    const transactions = (id: typeof companyId) => f.caller.query(api.cardReadings.listReportTransactions, { projectId: f.projectId, companyId: id, paginationOpts: page });
    expect((await transactions(companyId)).page.map(row => row._id)).toEqual([f.readingId]);
    expect((await transactions(otherCompanyId)).page).toHaveLength(0);
    const payroll = (id: typeof companyId) => f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10, companyId: id });
    expect((await payroll(companyId)).rows.map(row => row.employeeId)).toEqual([f.employeeId]);
    expect((await payroll(otherCompanyId)).rows).toHaveLength(0);
    const foreign = await f.t.run(ctx => ctx.db.insert("companies", { projectId: f.otherProjectId, name: "Yabancı" }));
    await expect(transactions(foreign)).rejects.toThrow("Şirket seçili projede bulunamadı");
  });
});
