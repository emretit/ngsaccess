// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "../schema";
import { flexibleReportProjects } from "./reportScope";
import { loadRuleReportDays } from "./reportAttendance";
import { hasFixedShiftRules } from "./pdksFixedRules";
import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { classifyPdksDay } from "./pdksTable";
import { computePdksDay } from "./pdksDay";
import { computeAttendanceDetailDay } from "./pdksDetail";
import { computePayrollCell } from "./pdksPayroll";
import { DEFAULT_WORK_SETTINGS, DEFAULT_OVERTIME_RATES } from "./pdksHelpers";
import { DEFAULT_FLEXIBLE } from "./pdksFlexible";
import { LEGACY_PDKS_POLICY, type PdksDayPolicy } from "./pdksRules";
import { groupPdksWorkDays, manualPdksTimes } from "./pdksWorkDay";
import { validateShift } from "./shiftUx";

const date = "2026-06-22";
const workingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const shift: Doc<"shifts"> = { _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Sabit", startTime: "09:00", endTime: "17:00", lateToleranceMinutes: 0, createdAt: "", updatedAt: "" };
const window = { checkInStart: "08:00", checkInEnd: "10:00", checkOutStart: "16:00", checkOutEnd: "18:00", checkOutEndDayOffset: 0 as const };
const requirements: PdksDayPolicy = { ...LEGACY_PDKS_POLICY, punchMode: "requirements", requireCheckIn: true, requireCheckOut: true, missingRequiredPunch: "absent" };
const reading = (time: string, direction?: "entry" | "exit", day = date): Doc<"cardReadings"> => ({
  _id: `${day}-${time}` as Id<"cardReadings">, _creationTime: 0,
  accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", cardNo: "1", direction,
});
const params = { date, shift, readings: [reading("09:00", "entry"), reading("17:00", "exit")], workSettings: DEFAULT_WORK_SETTINGS, workingDays };
function day(patch: Partial<Doc<"shifts">> = {}, extra: Partial<Parameters<typeof computePdksDay>[0]> = {}) {
  return computePdksDay({ ...params, ...extra, shift: { ...shift, ...patch } });
}
function payroll(patch: Partial<Doc<"shifts">>, readings: Doc<"cardReadings">[] = params.readings, extra: Partial<Parameters<typeof computePayrollCell>[0]> = {}) {
  return computePayrollCell({ date, dayShift: { ...shift, ...patch }, dayReadings: readings, manual: undefined,
    availableDateKeys: new Set([date]), firstRecordDate: date, hasLeave: false, holiday: null,
    workingDays, workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: DEFAULT_OVERTIME_RATES, empHourlyRate: null, ...extra });
}

describe("fixed shift optional rules", () => {
  it("keeps the complete old result when every rule is absent", () => {
    for (const policy of [undefined, requirements, { ...requirements, calculationMode: "eachPunch" as const }]) {
      expect(day({ validWindow: undefined, absentAfterLateMinutes: undefined, minWorkMinutes: undefined, missingCheckInLateMinutes: undefined, holidayWorkRequired: undefined }, { policy }))
        .toEqual(computePdksDay({ ...params, policy }));
    }
  });
  it("excludes an outside entry and retains the raw reading in review details", () => {
    const readings = [reading("07:59", "entry"), reading("17:00", "exit")];
    expect(day({ validWindow: window }, { readings })).toMatchObject({ firstISO: null, lastISO: readings[1]?.accessTime, attendanceDecision: "incomplete", hasAttendance: false, totalMinutes: 0 });
    const detail = computeAttendanceDetailDay({ date, dayShift: { ...shift, validWindow: window }, dayReadings: readings,
      availableDateKeys: new Set([date]), firstRecordDate: date, manualDay: undefined, leaves: [], holiday: null, workingDays, workSettings: DEFAULT_WORK_SETTINGS });
    expect(detail).toMatchObject({ status: "incomplete", firstEntry: null, payrollCode: "—" });
    expect(detail.rawReadings).toHaveLength(2);
  });
  it.each(["08:00", "10:00"])("includes the entry boundary %s", time => {
    expect(day({ validWindow: window }, { readings: [reading(time, "entry"), reading("18:00", "exit")] })).toMatchObject({ attendanceDecision: "present", durationMeasured: true });
  });
  it("rejects an exit one minute past the window, including manual endpoints", () => {
    const readings = [reading("09:00", "entry"), reading("18:01", "exit")];
    expect(day({ validWindow: window }, { readings })).toMatchObject({ lastISO: null, attendanceDecision: "incomplete" });
    const manual = { entryTime: "07:59", exitTime: "17:00", manualEntry: true } as Doc<"pdksRecords">;
    expect(day({ validWindow: window }, { readings: [], manual })).toMatchObject({ firstISO: null, attendanceDecision: "incomplete" });
  });
  it("supports legacy undirected readers and never promotes a lone exit to entry", () => {
    expect(day({ validWindow: window }, { readings: [reading("09:00"), reading("09:30"), reading("17:00")] })).toMatchObject({ durationMeasured: true, attendanceDecision: "present" });
    expect(day({ validWindow: window }, { readings: [reading("17:00")] })).toMatchObject({ firstISO: null, lastISO: reading("17:00").accessTime });
  });
  it("filters eachPunch durations using the same window", () => {
    const result = day({ validWindow: window }, { policy: { ...requirements, calculationMode: "eachPunch" }, readings: [reading("07:00", "entry"), reading("09:00", "entry"), reading("17:00", "exit"), reading("18:01", "exit")] });
    expect(result).toMatchObject({ rawTotalMinutes: 480, attendanceDecision: "incomplete" });
  });
  it("uses next-day windows on overnight shifts and preserves the inclusive exit boundary", () => {
    const night = { ...shift, startTime: "22:00", endTime: "06:00", validWindow: { checkInStart: "21:00", checkInEnd: "23:00", checkOutStart: "05:00", checkOutEnd: "07:00", checkOutEndDayOffset: 1 as const } };
    validateShift(night);
    expect(day(night, { readings: [reading("22:00", "entry"), reading("07:00", "exit", "2026-06-23")] })).toMatchObject({ durationMeasured: true, exitNextDay: true, attendanceDecision: "present" });
    expect(day(night, { readings: [reading("22:00", "entry"), reading("07:01", "exit", "2026-06-23")] })).toMatchObject({ lastISO: null, attendanceDecision: "incomplete" });
    const extended = { ...night, validWindow: { ...night.validWindow, checkOutEnd: "15:00" } };
    const readings = [reading("22:00", "entry"), reading("15:00", "exit", "2026-06-23")];
    const grouped = groupPdksWorkDays(readings, "employee" as Id<"employees">, () => extended);
    expect(grouped.get(date)).toHaveLength(2);
  });
  it.each([["09:31", "absent", "DV"], ["09:30", "late", "N"]])("late threshold at %s produces %s", (entry, status, payrollCode) => {
    expect(payroll({ absentAfterLateMinutes: 30 }, [reading(entry, "entry"), reading("17:00", "exit")])).toMatchObject({ status, payrollCode });
  });
  it("uses net work after break deduction and includes the minimum boundary", () => {
    const totalMinutes = day().totalMinutes;
    expect(totalMinutes).toBeLessThan(480);
    expect(payroll({ minWorkMinutes: totalMinutes + 1 })).toMatchObject({ status: "absent", payrollCode: "DV" });
    expect(payroll({ minWorkMinutes: totalMinutes })).toMatchObject({ status: "present", payrollCode: "N" });
    expect(day({ minWorkMinutes: 0 })).toEqual(day());
  });
  it.each([undefined, requirements, { ...requirements, calculationMode: "eachPunch" as const }])("missing-entry lateness precedes policy absence: %j", policy => {
    expect(day({ missingCheckInLateMinutes: 25 }, { readings: [reading("17:00", "exit")], policy })).toMatchObject({ firstISO: null, lateMinutes: 25, isLate: true, attendanceDecision: "present", hasAttendance: true, totalMinutes: 0 });
  });
  it("supports zero missing-entry lateness and does not override a completely missing day", () => {
    expect(day({ missingCheckInLateMinutes: 0 }, { readings: [reading("17:00", "exit")], policy: requirements })).toMatchObject({ lateMinutes: 0, isLate: false, attendanceDecision: "present" });
    expect(day({ missingCheckInLateMinutes: 25 }, { readings: [], policy: requirements })).toMatchObject({ attendanceDecision: "absent", lateMinutes: 0 });
    expect(day({ missingCheckInLateMinutes: 25 })).toEqual(day());
    expect(day({ missingCheckInLateMinutes: 25 }, { readings: [reading("09:00"), reading("17:00")] })).toEqual(day({}, { readings: [reading("09:00"), reading("17:00")] }));
  });
  it("handles a manual overnight exit without manufacturing a check-in", () => {
    const night = { ...shift, startTime: "22:00", endTime: "06:00", missingCheckInLateMinutes: 15 };
    expect(manualPdksTimes(date, { exitTime: "06:00" }, night).exitNextDay).toBe(true);
    expect(day(night, { readings: [], manual: { exitTime: "06:00", manualEntry: true } as Doc<"pdksRecords">, policy: requirements }))
      .toMatchObject({ firstISO: null, lateMinutes: 15, exitNextDay: true, attendanceDecision: "present" });
  });
  it("required holiday work becomes an ordinary workday, including absences and lateness", () => {
    const holiday = { date, isHalfDay: false } as Doc<"holidays">;
    expect(payroll({ holidayWorkRequired: true }, [], { holiday })).toMatchObject({ status: "absent", payrollCode: "DV", classification: "workday" });
    expect(payroll({ holidayWorkRequired: true }, [reading("09:30", "entry"), reading("17:00", "exit")], { holiday })).toMatchObject({ status: "late", overtimeMinutes: 0 });
    expect(day({ holidayWorkRequired: false }, { holiday })).toEqual(day({}, { holiday }));
    expect(day({ holidayWorkRequired: true }, { holiday: { ...holiday, isHalfDay: true } })).toMatchObject({ classification: "workday", overtimeMinutes: 0 });
    expect(day({ holidayWorkRequired: true }, { date: "2026-06-27", readings: [], holiday })).toMatchObject({ classification: "weekend" });
  });
  it("removes next-day holiday premium when night overtime is split at midnight", () => {
    const next = "2026-06-23";
    const extra = { readings: [reading("22:00", "entry"), reading("07:00", "exit", next)], holidayMap: new Map([[next, { date: next } as Doc<"holidays">]]), overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftDayMode: "splitAtMidnight" as const } };
    const result = day({ startTime: "22:00", endTime: "06:00", holidayWorkRequired: true }, extra);
    expect(result.overtimeSegments.every(segment => segment.classification === "workday")).toBe(true);
    expect(result.overtimeMinutes).toBeLessThan(day({ startTime: "22:00", endTime: "06:00" }, extra).overtimeMinutes);
  });
  it("rejects fixed rules on flexible schedules, including false and zero", () => {
    for (const patch of [{ validWindow: window }, { absentAfterLateMinutes: 0 }, { minWorkMinutes: 0 }, { missingCheckInLateMinutes: 0 }, { holidayWorkRequired: false }]) {
      expect(() => validateShift({ ...shift, scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, ...patch })).toThrow(ConvexError);
    }
  });
  it("validates number boundaries and window containment", () => {
    for (const key of ["absentAfterLateMinutes", "minWorkMinutes", "missingCheckInLateMinutes"] as const) {
      for (const value of [0, 1440]) expect(() => validateShift({ ...shift, [key]: value })).not.toThrow();
      for (const value of [-1, 1441, 0.5, NaN, Infinity]) expect(() => validateShift({ ...shift, [key]: value })).toThrow(ConvexError);
    }
    for (const patch of [{ checkInEnd: "24:00" }, { checkInStart: "09:01" }, { checkOutStart: "17:01" }, { checkOutEnd: "16:59" }]) {
      expect(() => validateShift({ ...shift, validWindow: { ...window, ...patch } })).toThrow(ConvexError);
    }
    expect(() => validateShift({ ...shift, startTime: "22:00", endTime: "06:00", validWindow: { ...window, checkInStart: "21:00", checkInEnd: "23:00", checkOutEnd: "07:00" } })).toThrow(ConvexError);
  });
});


it("discovers fixed rules only when requested and routes legacy-policy reports through the shared day result", async () => {
  const t = convexTest(schema, import.meta.glob("../**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Kurallı proje" });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Kurallı", startTime: "09:00", endTime: "17:00", minWorkMinutes: 500, createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, shiftId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "1", isActive: true });
    const readingIds = [];
    for (const [time, direction] of [["09:00", "entry"], ["17:00", "exit"]] as const) {
      readingIds.push(await ctx.db.insert("cardReadings", { projectId, employeeId, cardNo: "1", accessTime: reading(time).accessTime, accessStatus: "izin_verildi", direction }));
    }
    return { projectId, employeeId, shiftId, readingIds };
  });
  expect(await t.run(async ctx => [...await flexibleReportProjects(ctx, [ids.projectId], date, date)])).toEqual([]);
  expect(await t.run(async ctx => [...await flexibleReportProjects(ctx, [ids.projectId], date, date, undefined, hasFixedShiftRules)])).toEqual([ids.projectId]);
  await t.run(async ctx => {
    const report = await loadRuleReportDays(ctx, [ids.projectId], date, date);
    expect(report.ruleRows.get(ids.employeeId)?.days[0]).toMatchObject({ status: "absent", payrollCode: "DV" });
    expect(report.managesReading(report.readings[0])).toBe(true);
  });
  await t.run(ctx => ctx.db.patch(ids.shiftId, { minWorkMinutes: undefined }));
  await t.run(async ctx => {
    const legacy = await loadRuleReportDays(ctx, [ids.projectId], date, date);
    expect(legacy.ruleRows.size).toBe(0);
  });
});

it("discovers an assigned fixed night tail without changing default flexible discovery", async () => {
  const t = convexTest(schema, import.meta.glob("../**/*.ts"));
  const projectId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Gece" });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gece", startTime: "22:00", endTime: "06:00", minWorkMinutes: 300, createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "1" });
    await ctx.db.insert("shiftAssignments", { projectId, shiftId, employeeId, startDate: date, endDate: date, createdAt: "", updatedAt: "" });
    return projectId;
  });
  const next = "2026-06-23";
  expect(await t.run(async ctx => [...await flexibleReportProjects(ctx, [projectId], next, next)])).toEqual([]);
  expect(await t.run(async ctx => [...await flexibleReportProjects(ctx, [projectId], next, next, undefined, hasFixedShiftRules)])).toEqual([projectId]);
});


it("minimum work preserves review on an unmeasured day and legacy decisions stay undefined", () => {
  const readings = [reading("09:00", "entry")];
  const policy = { ...requirements, missingRequiredPunch: "review" as const };
  expect(day({ minWorkMinutes: 400 }, { readings, policy })).toMatchObject({ attendanceDecision: "incomplete", durationMeasured: false });
  expect(day({ minWorkMinutes: 400 }, { readings })).toMatchObject({ attendanceDecision: undefined, hasAttendance: true, durationMeasured: false });
  const baseline = day();
  const limited = day({ minWorkMinutes: 1000 });
  expect(limited).toMatchObject({ attendanceDecision: undefined, hasAttendance: false });
  const status = { date, today: date, dataAvailable: true, firstRecordDate: date, shiftStart: "09:00", shiftEnd: "17:00", hasAssignedShift: true, classification: "workday" as const, hasLeave: false, isLate: false };
  for (const time of ["08:00", "12:00", "18:00"]) {
    const now = Date.parse(`${date}T${time}:00+03:00`);
    expect(classifyPdksDay({ ...status, now, ...limited })).toBe(classifyPdksDay({ ...status, now, ...baseline, hasAttendance: false }));
  }
});

it("half-day holidays retain holiday treatment without scaling fixed absence thresholds", () => {
  const holiday = { date, isHalfDay: true } as Doc<"holidays">;
  expect(day({ minWorkMinutes: 1000, absentAfterLateMinutes: 0 }, { holiday, readings: [reading("09:30", "entry"), reading("17:00", "exit")] }))
    .toMatchObject({ classification: "halfDayHoliday", hasAttendance: true, attendanceDecision: undefined });
});
