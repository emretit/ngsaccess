// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import { computePdksCoreInMemory, dashboardWorkDateResolver } from "./dashboard";
import { buildShiftResolver, type DayPlan, type ShiftResolver } from "./lib/shiftResolver";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { computePdksTableRow } from "./lib/pdksTable";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./lib/pdksHelpers";
import { trDayRangeISO } from "./lib/trDate";
import { classifyDay, dailyOvertimeForShift, isoTimeToTRMinutes } from "./lib/pdksHelpers";

const monday = "2026-06-22";
const employee: Doc<"employees"> = { _id: "employee" as Id<"employees">, _creationTime: 0, firstName: "Ada", lastName: "Test", email: "ada@test", cardNumber: "1", isActive: true };
const shift = (name: string, startTime: string, endTime: string): Doc<"shifts"> => ({ _id: name as Id<"shifts">, _creationTime: 0, name, startTime, endTime, createdAt: "", updatedAt: "", overtimeStartToleranceMinutes: 0 });
const morning = shift("Sabah", "08:00", "12:00"), afternoon = shift("Akşam", "14:00", "18:00");
function resolver(planFor: (id: Id<"employees">, date: string) => DayPlan): ShiftResolver {
  return { resolvePlan: planFor, shifts: new Map([[morning._id, morning], [afternoon._id, afternoon]]),
    resolve: (id, date) => { const plan = planFor(id, date); return plan.kind === "shifts" ? plan.shifts[0] ?? null : null; },
    resolveLast: (id, date) => { const plan = planFor(id, date); return plan.kind === "shifts" ? plan.shifts[plan.shifts.length - 1] ?? null : null; },
  };
}
function readings(date: string): Doc<"cardReadings">[] {
  return ["08:00", "12:00", "14:00", "18:00"].map((time, index) => ({ _id: String(index) as Id<"cardReadings">, _creationTime: 0, employeeId: employee._id, cardNo: "1", accessStatus: "izin_verildi", accessTime: new Date(`${date}T${time}:00+03:00`).toISOString(), direction: index % 2 ? "exit" : "entry" }));
}
const rangeFor = (date: string) => { const { startISO, endISO } = trDayRangeISO(date, date); return { start: startISO, end: endISO }; };

it.each([monday, "2026-06-27"])("dashboard uses merged piece overtime without gaps or cycle weekend premium on %s", date => {
  const shifts = resolver(() => ({ kind: "shifts", source: "employee", calendar: "plan", shifts: [morning, afternoon] }));
  const raw = readings(date);
  const row = computePdksTableRow({ employee, empKey: employee._id, empReadings: raw, availableDateKeys: new Set([date]), departmentName: "", periodDateKeys: [date], startDate: date, isSingleDay: true, viewMode: "matrix", manualPdksByEmpDate: new Map(), allLeaves: [], holidayMap: new Map(), workingDays: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"], workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: { ...DEFAULT_OVERTIME_RATES, overtimeBasis: "dailyShift" }, resolveShift: shifts.resolve, resolvePlan: shifts.resolvePlan, manualEditedBy: null });
  expect(row.days[0]).toMatchObject({ totalMinutes: 450, overtimeMinutes: 0, detail: { dayType: "workday" } });
  const legacy = computePdksCoreInMemory([employee], raw, [], rangeFor(date), new Map(), shifts, DEFAULT_WORK_SETTINGS);
  expect(legacy.core.overtimeHours).toBeGreaterThan(0);
  const result = computePdksCoreInMemory([employee], raw, [], rangeFor(date), new Map(), shifts, DEFAULT_WORK_SETTINGS, new Map([[employee._id, row]]));
  expect(result.core.overtimeHours).toBe(0);
});

it("rest is excluded from the attendance-rate population; ordinary and leave behavior stays intact", () => {
  const other = { ...employee, _id: "rest" as Id<"employees">, cardNumber: "2" };
  const working: DayPlan = { kind: "shifts", source: "employee", calendar: "project", shifts: [morning] };
  const run = (shifts: ShiftResolver) => computePdksCoreInMemory([employee, other], readings(monday).slice(0, 1), [], rangeFor(monday), new Map(), shifts, DEFAULT_WORK_SETTINGS).core;
  const ordinary = run(resolver(() => working));
  expect(ordinary).toMatchObject({ totalEmployees: 2, presentToday: 1, devamOrani: 50 });
  expect(run(resolver(id => id === other._id ? { kind: "rest", source: "department", calendar: "plan" } : working))).toMatchObject({ totalEmployees: 2, presentToday: 1, devamOrani: 100 });
  const explicitEmptyRows = computePdksCoreInMemory([employee, other], readings(monday).slice(0, 1), [], rangeFor(monday), new Map(), resolver(() => working), DEFAULT_WORK_SETTINGS, new Map()).core;
  expect(explicitEmptyRows).toStrictEqual(ordinary);
});

it("ordinary versioned night policy preserves the legacy previous-day attribution despite populated rule rows", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Gece" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gece", startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", email: "night@test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-01-01", punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId });
    for (const [accessTime, direction] of [["2026-06-22T19:00:00Z", "entry"], ["2026-06-23T03:00:00Z", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", accessTime, direction });
    const emp = await ctx.db.get(employeeId);
    if (!emp) throw new Error("Fixture employee missing");
    const report = await loadRuleReportDays(ctx, [projectId], monday, "2026-06-23");
    expect(report.ruleRows.size).toBeGreaterThan(0);
    const shifts = await buildShiftResolver(ctx, [emp]);
    const reportDate = vi.fn(report.workDate);
    const workDate = dashboardWorkDateResolver([emp], shifts, reportDate);
    const exit = report.readings.find(reading => reading.direction === "exit");
    if (!exit) throw new Error("Fixture exit missing");
    expect(workDate(exit)).toBe(monday);
    expect(reportDate).not.toHaveBeenCalled();
  });
});

it("one employee's plan does not switch an ordinary employee to report attribution", () => {
  const plannedEmployee = { ...employee, _id: "planned" as Id<"employees">, cardNumber: "2" };
  const shifts = resolver(id => id === plannedEmployee._id ? { kind: "rest", source: "employee", calendar: "plan" } : { kind: "none", source: "project" });
  const reportDate = vi.fn(() => "report-day");
  const workDate = dashboardWorkDateResolver([employee, plannedEmployee], shifts, reportDate);
  const reading = readings(monday)[0];
  if (!reading) throw new Error("Fixture reading missing");
  expect(workDate(reading)).toBe(monday);
  expect(reportDate).not.toHaveBeenCalled();
  expect(workDate({ ...reading, employeeId: plannedEmployee._id })).toBe("report-day");
});

it("versioned policy with an ordinary dated plan preserves the HEAD dashboard overtime formula", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Plansız" });
    await ctx.db.insert("overtimeRates", { ...DEFAULT_OVERTIME_RATES, projectId, overtimeBasis: "dailyShift", updatedAt: "" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "", overtimeStartToleranceMinutes: 0 });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", email: "ordinary@test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    await ctx.db.insert("pdksRuleVersions", { projectId, effectiveFrom: "2026-01-01", punchMode: "requirements", checkpointMode: "all", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "review", noPunch: "absent", createdAt: "", createdBy: userId });
    for (const [time, direction] of [["08:00", "entry"], ["14:00", "entry"], ["20:00", "exit"]] as const) await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessStatus: "izin_verildi", accessTime: new Date(`${monday}T${time}:00+03:00`).toISOString(), direction });
    const emp = await ctx.db.get(employeeId);
    if (!emp) throw new Error("Fixture employee missing");
    const report = await loadRuleReportDays(ctx, [projectId], monday, monday);
    expect(report.ruleRows.get(employeeId)?.days[0]?.overtimeMinutes).toBeGreaterThan(0);
    const shifts = await buildShiftResolver(ctx, [emp]);
    // getActivitySummary passes only non-exit readings, as in 8f57a2d9.
    const raw = report.readings.filter(reading => reading.direction !== "exit").sort((a, b) => a.accessTime.localeCompare(b.accessTime));
    const first = raw[0], last = raw[raw.length - 1];
    if (!first || !last) throw new Error("Fixture readings missing");
    const headMinutes = dailyOvertimeForShift({ classification: classifyDay(monday, ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]), netMinutes: Math.floor((Date.parse(last.accessTime) - Date.parse(first.accessTime)) / 60000), lastExitMinutes: isoTimeToTRMinutes(last.accessTime), shift: shifts.resolve(employeeId, monday), workSettings: DEFAULT_WORK_SETTINGS });
    const result = computePdksCoreInMemory([emp], raw, [], rangeFor(monday), new Map(), shifts, DEFAULT_WORK_SETTINGS, report.ruleRows);
    expect(result.core.overtimeHours).toBe(Math.round(headMinutes / 60 * 10) / 10);
    expect(result.core.overtimeHours).toBe(0);
  });
});
