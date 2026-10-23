// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { DEFAULT_OVERTIME_RATES } from "./lib/pdksHelpers";
import { loadRuleReportDays, hasUnsupportedShiftCalendar } from "./lib/reportAttendance";
import type { ShiftPlan } from "./lib/shiftPlan";
import type { Id } from "./_generated/dataModel";

const date = "2026-06-22", next = "2026-06-23";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${date}T20:00:00Z`)); });
afterEach(() => vi.useRealTimers());
async function fixture(department = true, night = false) {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Plan" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 * 10 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("overtimeRates", { ...DEFAULT_OVERTIME_RATES, projectId, overtimeBasis: "dailyShift", updatedAt: "" });
    const departmentId = await ctx.db.insert("departments", { projectId, name: "Üretim" });
    const morning = await ctx.db.insert("shifts", { projectId, name: "Sabah", startTime: "08:00", endTime: "12:00", overtimeStartToleranceMinutes: 0, createdAt: "", updatedAt: "" });
    const evening = await ctx.db.insert("shifts", { projectId, name: "Akşam", startTime: night ? "22:00" : "14:00", endTime: night ? "06:00" : "18:00", overtimeStartToleranceMinutes: 0, createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, departmentId, firstName: "Ada", lastName: "Test", email: "plan@example.test", cardNumber: "1", isActive: true });
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "fixture", passwordVersion: 1, createdAt: "", updatedAt: "" });
    await ctx.db.insert("employeeSessions", { employeeId, token: "plan-session", passwordVersion: 1, expiresAt: "2099-01-01T00:00:00Z", createdAt: "" });
    const plan: ShiftPlan = { kind: "dayCycle", anchorDate: date, slots: [[morning, evening], []] };
    const values = { projectId, shiftId: morning, startDate: date, endDate: "2026-06-30", plan, createdAt: "", updatedAt: "" };
    const owner: { departmentAssignmentId: Id<"departmentShiftAssignments"> } | { assignmentId: Id<"shiftAssignments"> } = department
      ? { departmentAssignmentId: await ctx.db.insert("departmentShiftAssignments", { ...values, departmentId }) }
      : { assignmentId: await ctx.db.insert("shiftAssignments", { ...values, employeeId }) };
    for (const shiftId of [morning, evening]) await ctx.db.insert("shiftPlanRefs", { ...owner, projectId, shiftId });
    return { projectId, departmentId, morning, evening, employeeId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const add = (time: string, direction: "entry" | "exit", day = date) => t.run(ctx => ctx.db.insert("cardReadings", { projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "1", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", direction }));
  const table = (startDate = date, endDate = date) => caller.query(api.cardReadings.getPdksTableData, { projectId: ids.projectId, startDate, endDate, viewMode: "matrix" });
  const detail = (startDate = date, endDate = date) => caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: ids.projectId, employeeId: ids.employeeId, startDate, endDate });
  const summary = (startDate = date, endDate = date) => t.query(api.mobileAttendance.summary, { sessionToken: "plan-session", startDate, endDate });
  const dashboard = () => caller.query(api.dashboard.getActivitySummary, { projectId: ids.projectId });
  const report = (startDate = date, endDate = date) => t.run(async ctx => {
    const report = await loadRuleReportDays(ctx, [ids.projectId], startDate, endDate);
    return report.ruleRows.get(ids.employeeId)?.days ?? [];
  });
  return { t, caller, add, table, detail, summary, dashboard, report, ...ids };
}

it.each([true, false])("department=%s: table, detail, payroll, reports and mobile consume the complete plan", async department => {
  const f = await fixture(department);
  for (const [time, direction] of [["08:00", "entry"], ["12:00", "exit"], ["14:00", "entry"], ["18:00", "exit"]] as const) await f.add(time, direction);
  const expected = { status: "present", totalMinutes: 450, segments: [{ decision: "present" }, { decision: "present" }] };
  expect((await f.table())[0]?.days[0]).toMatchObject(expected);
  expect((await f.detail())?.days[0]).toMatchObject(expected);
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 6 });
  expect(payroll.rows[0]?.cells.find(day => day.date === date)).toMatchObject(expected);
  expect((await f.report())[0]).toMatchObject(expected);
  const mobile = await f.summary();
  expect(mobile.totals.presentDays).toBe(1);
  expect(mobile.days[0]?.date).toBe(date);
  expect(await f.dashboard()).toMatchObject({ presentToday: 1, incompleteDays: 0, lateArrivals: 0 });
  expect(await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: date, endDate: date, viewMode: "matrix", shiftId: f.evening })).toHaveLength(1);
});

it("missing afternoon is incomplete everywhere, while the worked morning is retained", async () => {
  const f = await fixture();
  await f.add("08:00", "entry"); await f.add("12:00", "exit");
  expect((await f.table())[0]?.days[0]).toMatchObject({ status: "incomplete", totalMinutes: 225, segments: [{ decision: "present" }, { decision: "absent" }] });
  expect((await f.summary()).totals.presentDays).toBe(0);
  expect(await f.dashboard()).toMatchObject({ presentToday: 0, incompleteDays: 1 });
});

it("cycle rest produces weekend and never absence in the report/dashboard path", async () => {
  const f = await fixture();
  vi.setSystemTime(new Date(`${next}T20:00:00Z`));
  expect((await f.table(next, next))[0]?.days[0]).toMatchObject({ status: "weekend", planKind: "rest" });
  expect((await f.report(next, next))[0]).toMatchObject({ status: "weekend", planKind: "rest" });
  expect(await f.dashboard()).toMatchObject({ presentToday: 0, incompleteDays: 0 });
  expect((await f.summary(next, next)).totals.presentDays).toBe(0);
});

it("late afternoon uses its own threshold and retains the first morning entry", async () => {
  const f = await fixture();
  await f.add("08:00", "entry"); await f.add("12:00", "exit"); await f.add("14:30", "entry"); await f.add("18:00", "exit");
  expect((await f.table())[0]?.days[0]).toMatchObject({ status: "late", firstEntry: "08:00", isLate: true });
  expect(await f.dashboard()).toMatchObject({ lateArrivals: 1, presentToday: 1 });
});

it("last night piece consumes D+1 exit in table/detail/mobile and manual validation", async () => {
  const f = await fixture(true, true);
  vi.setSystemTime(new Date(`${next}T20:00:00Z`));
  await f.add("08:00", "entry"); await f.add("12:00", "exit"); await f.add("22:00", "entry"); await f.add("06:00", "exit", next);
  expect((await f.table(date, next))[0]?.days[0]).toMatchObject({ status: "present", lastExit: "06:00", segments: [{ decision: "present" }, { decision: "present" }] });
  expect((await f.detail(date, next))?.days[0]).toMatchObject({ isOvernightShift: true, exitNextDay: true });
  expect((await f.summary(date, next)).totals.presentDays).toBe(1);
  await expect(f.caller.mutation(api.pdksRecords.upsertManual, { employeeId: f.employeeId, date, entryTime: "08:00", exitTime: "06:00", note: "Çoklu gece düzeltmesi" })).resolves.toBeTruthy();
});

it("cycle calendars do not emit the unsupported weekly calendar warning", async () => {
  const f = await fixture(false);
  const unsupported = await f.t.run(async ctx => hasUnsupportedShiftCalendar(await ctx.db.query("shiftAssignments").collect(), [date, next], ["Salı"], new Map()));
  expect(unsupported).toBe(false);
});

it("shift filters use the personal override throughout the period instead of the employee default", async () => {
  const f = await fixture(false);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.employeeId, { shiftId: f.morning });
    const assignments = await ctx.db.query("shiftAssignments").withIndex("by_employee", q => q.eq("employeeId", f.employeeId)).collect();
    for (const assignment of assignments) await ctx.db.patch(assignment._id, { shiftId: f.evening, plan: undefined });
    for (const ref of await ctx.db.query("shiftPlanRefs").collect()) await ctx.db.delete(ref._id);
  });
  await f.add("14:00", "entry"); await f.add("18:00", "exit");
  const args = { projectId: f.projectId, startDate: date, endDate: next, viewMode: "matrix" as const };
  expect(await f.caller.query(api.cardReadings.getPdksTableData, { ...args, shiftId: f.evening })).toHaveLength(1);
  expect(await f.caller.query(api.cardReadings.getPdksTableData, { ...args, shiftId: f.morning })).toEqual([]);
});
