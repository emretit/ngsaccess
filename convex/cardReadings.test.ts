// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { DEFAULT_OVERTIME_RATES } from "./lib/pdksHelpers";

it("night queries use the next rest plan and shift filters retain rest context", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Night" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Night", startTime: "22:00", endTime: "06:00", breakStart: "23:00", breakEnd: "23:30", overtimeStartToleranceMinutes: 0, createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "a@test", cardNumber: "1", isActive: true });
    const assignmentId = await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, weekPattern: ["MON", "TUE", "WED", "THU", "FRI"], startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "" });
    await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-06-01", punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId });
    await ctx.db.insert("shiftPlanRefs", { projectId, shiftId, assignmentId });
    await ctx.db.insert("overtimeRates", { ...DEFAULT_OVERTIME_RATES, projectId, overtimeBasis: "dailyShift", nightShiftDayMode: "splitAtMidnight", updatedAt: "" });
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: "fixture", passwordVersion: 1, createdAt: "", updatedAt: "" });
    await ctx.db.insert("employeeSessions", { employeeId, token: "rest-night", passwordVersion: 1, expiresAt: "2099-01-01T00:00:00Z", createdAt: "" });
    for (const date of ["2026-06-26", "2026-06-27"]) {
      const next = date === "2026-06-26" ? "2026-06-27" : "2026-06-28";
      await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", direction: "entry", accessTime: `${date}T22:00:00+03:00` });
      await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", direction: "exit", accessTime: `${next}T06:00:00+03:00` });
    }
    return { projectId, employeeId, shiftId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const args = { projectId: ids.projectId, startDate: "2026-06-26", endDate: "2026-06-28" };
  const table = await caller.query(api.cardReadings.getPdksTableData, { ...args, viewMode: "matrix" });
  const detail = await caller.query(api.cardReadings.getEmployeeAttendanceDetail, { ...args, employeeId: ids.employeeId });
  const payroll = await caller.query(api.cardReadings.getMonthlyPayrollSheet, { projectId: ids.projectId, year: 2026, month: 6 });
  const managed = await t.run(async ctx => (await loadRuleReportDays(ctx, [ids.projectId], args.startDate, args.endDate)).ruleRows.get(ids.employeeId)?.days);
  for (const days of [table[0]?.days, detail?.days, payroll.rows[0]?.cells, managed]) {
    expect(days?.find(day => day.date === "2026-06-26")).toMatchObject({ totalMinutes: 450, overtimeMinutes: 360 });
    expect(days?.find(day => day.date === "2026-06-27")).toMatchObject({ totalMinutes: 450, overtimeMinutes: 450, planKind: "rest" });
  }
  const filtered = await caller.query(api.cardReadings.getPdksTableData, { projectId: ids.projectId, startDate: "2026-06-27", endDate: "2026-06-27", viewMode: "matrix", shiftId: ids.shiftId });
  expect(filtered[0]?.days[0]).toMatchObject({ planKind: "rest", totalMinutes: 450 });
  const mobile = await t.query(api.mobileAttendance.summary, { sessionToken: "rest-night", startDate: args.startDate, endDate: args.endDate });
  // Requirements keeps the rest day as weekend; both night sessions still retain their movements.
  expect(mobile.totals).toMatchObject({ entryCount: 2, exitCount: 2, pdksPresentDays: 1 });
});
