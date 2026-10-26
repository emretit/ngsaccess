// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { loadPdksRulePolicy } from "./lib/pdksRules";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
async function fixture(night = false, typed = false) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100 * 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Vardiya", startTime: night ? "22:00" : "08:00", endTime: night ? "06:00" : "17:00", createdAt: "", updatedAt: "", overtimeStartToleranceMinutes: 0 });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Test", lastName: "Test", email: "test@example.test", cardNumber: "TEST", isActive: true, shiftId });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "ide_smart", createdAt: "", updatedAt: "" });
    const entryDoor = await ctx.db.insert("doors", { projectId, deviceId, name: "Giriş", ioId: 1 });
    const exitDoor = await ctx.db.insert("doors", { projectId, deviceId, name: "Çıkış", ioId: 2 });
    return { projectId, userId, sessionId, shiftId, employeeId, deviceId, entryDoor, exitDoor };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const args = { projectId: ids.projectId, effectiveFrom: "2026-10-23", punchMode: "legacy" as const, calculationMode: "eachPunch" as const, minPunchIntervalMinutes: 1,
    checkpointMode: typed ? "selected" as const : "all" as const,
    targets: typed ? [{ targetType: "door" as const, deviceId: ids.deviceId, doorId: ids.entryDoor, pointType: "entry" as const }, { targetType: "door" as const, deviceId: ids.deviceId, doorId: ids.exitDoor, pointType: "exit" as const }] : undefined };
  return { t, caller, args, ...ids };
}
it("publish validates intervals and loads optional/default fields without migrating old versions", async () => {
  const f = await fixture();
  for (const minPunchIntervalMinutes of [-1, 61, NaN, Infinity]) await expect(f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, minPunchIntervalMinutes })).rejects.toThrow("0–60");
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom: "2026-10-22", calculationMode: undefined, minPunchIntervalMinutes: undefined });
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  await f.t.run(async ctx => {
    const resolve = await loadPdksRulePolicy(ctx, f.projectId, "2026-10-22", "2026-10-24");
    expect(resolve("2026-10-22").calculationMode).toBeUndefined();
    expect(resolve("2026-10-23")).toMatchObject({ calculationMode: "eachPunch", minPunchIntervalMinutes: 1 });
  });
});
it.each([false, true])("version boundary keeps old day unchanged and pairs new day across table/detail/payroll/report, night=%s", async night => {
  const f = await fixture(night, night);
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom: "2026-10-22", calculationMode: "firstLast" });
  await f.caller.mutation(api.pdksRules.publishRuleVersion, f.args);
  // Tomorrow's direction/mode must not change the previous night's pairs.
  if (night) await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, effectiveFrom: "2026-10-24", calculationMode: "firstLast", targets: [{ targetType: "device", deviceId: f.deviceId, pointType: "entry" }] });
  await f.t.run(async ctx => {
    for (const date of ["2026-10-22", "2026-10-23"]) {
      const next = date === "2026-10-22" ? "2026-10-23" : "2026-10-24";
      const visits = night ? [[date, "22:00", "entry"], [next, "01:00", "exit"], [next, "02:00", "entry"], [next, "06:00", "exit"]] as const : [[date, "08:00", "entry"], [date, "11:00", "exit"], [date, "13:00", "entry"], [date, "17:00", "exit"]] as const;
      for (const [day, time, direction] of visits) await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, deviceId: f.deviceId, cardNo: "TEST", ideIoId: direction === "entry" ? 1 : 2, accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", direction: night ? "exit" : direction });
    }
  });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  const [table, detail, payroll, report, sgk] = await Promise.all([
    f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-10-22", endDate: "2026-10-23", viewMode: "matrix" }),
    f.caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: f.projectId, employeeId: f.employeeId, startDate: "2026-10-22", endDate: "2026-10-23" }),
    f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 }),
    f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 10 }),
    f.caller.query(api.reports.getSgkMonthlyReport, { projectId: f.projectId, year: 2026, month: 10 }),
  ]);
  expect(table[0]?.days.find(d => d.date === "2026-10-23")).toMatchObject({ totalMinutes: 420, durationMeasured: true, punchQuality: "ok", firstEntry: night ? "22:00" : "08:00", lastExit: night ? "06:00" : "17:00" });
  expect(table[0]?.days.find(d => d.date === "2026-10-22")?.totalMinutes).toBe(night ? 420 : 480);
  expect(detail?.days.find(d => d.date === "2026-10-23")).toMatchObject({ totalMinutes: 420, exitNextDay: night });
  expect(payroll.rows[0]?.cells.find(d => d.date === "2026-10-23")).toMatchObject({ totalMinutes: 420, status: "present" });
  expect(report.rows[0]?.incompleteDays).toBe(0);
  expect(sgk.rows[0]?.toplamSaat).toBe(night ? 14 : 16);
});
it("open final pair propagates review to table, payroll and attendance report", async () => {
  const f = await fixture();
  await f.caller.mutation(api.pdksRules.publishRuleVersion, { ...f.args, punchMode: "requirements", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent" });
  await f.t.run(async ctx => {
    for (const [time, direction] of [["08:00", "entry"], ["12:00", "exit"], ["13:00", "entry"]] as const) await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.employeeId, deviceId: f.deviceId, cardNo: "TEST", accessTime: new Date(`2026-10-23T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", direction });
  });
  vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
  const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, startDate: "2026-10-23", endDate: "2026-10-23", viewMode: "matrix" });
  const payroll = await f.caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: f.projectId, year: 2026, month: 10 });
  const report = await f.caller.query(api.reports.getAttendanceSummaryReport, { projectId: f.projectId, year: 2026, month: 10 });
  expect(table[0]?.days[0]).toMatchObject({ totalMinutes: 240, punchQuality: "missingExit", status: "incomplete" });
  expect(payroll.rows[0]?.cells.find(d => d.date === "2026-10-23")).toMatchObject({ totalMinutes: 240, status: "incomplete", payrollCode: "—" });
  expect(report.rows[0]?.incompleteDays).toBe(1);
});
