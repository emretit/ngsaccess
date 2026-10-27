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
import { exitMayCrossMidnight, groupPdksWorkDays, isOvernightShift, manualPdksTimes, pdksWorkDay } from "./pdksWorkDay";
import { validateManualPdksInput } from "./pdksManual";
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
  it("rejects clock-bound fixed rules on flexible schedules, including zero, but allows day rules", () => {
    for (const patch of [{ validWindow: window }, { absentAfterLateMinutes: 0 }, { missingCheckInLateMinutes: 0 }]) {
      expect(() => validateShift({ ...shift, scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, ...patch })).toThrow(ConvexError);
    }
    for (const patch of [{ minWorkMinutes: 0 }, { minWorkMinutes: 1440 }, { holidayWorkRequired: true }]) {
      expect(() => validateShift({ ...shift, scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, ...patch })).not.toThrow();
    }
    expect(() => validateShift({ ...shift, scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE, minWorkMinutes: 1441 })).toThrow("0–1440");
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
    await ctx.db.insert("shiftAssignments", { projectId: projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
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

describe("daytime fixed shifts with a next-day exit window", () => {
  const next = "2026-06-23";
  const employeeId = "employee" as Id<"employees">;
  const extended = { ...shift, endTime: "18:00", validWindow: { ...window, checkOutStart: "17:00", checkOutEnd: "02:00", checkOutEndDayOffset: 1 as const } };

  it.each(["exit", undefined] as const)("attributes a 01:00 %s punch to the preceding work day", direction => {
    validateShift(extended);
    const readings = [reading("09:00", "entry"), reading("01:00", direction, next)];
    const grouped = groupPdksWorkDays(readings, employeeId, () => extended);
    expect([...grouped.keys()]).toEqual([date]);
    expect(day(extended, { readings: grouped.get(date) ?? [] })).toMatchObject({
      rawTotalMinutes: 960, durationMeasured: true, attendanceDecision: "present", exitNextDay: true, isOvernightShift: true,
    });
    const detail = computeAttendanceDetailDay({ date, dayShift: extended, dayReadings: grouped.get(date) ?? [],
      availableDateKeys: new Set([date]), firstRecordDate: date, manualDay: undefined, leaves: [], holiday: null, workingDays, workSettings: DEFAULT_WORK_SETTINGS });
    expect(detail).toMatchObject({ firstEntry: "09:00", lastExit: "01:00", rawTotalMinutes: 960, exitNextDay: true });
  });

  it.each([["02:00", date], ["02:01", next], ["03:00", next]] as const)("checks the inclusive exit window at %s", (time, expected) => {
    expect(pdksWorkDay(reading(time, "exit", next).accessTime, employeeId, () => extended, "exit")).toBe(expected);
  });

  it("keeps explicit entries on their calendar day even inside the previous exit window", () => {
    expect(pdksWorkDay(reading("01:00", "entry", next).accessTime, employeeId, () => extended, "entry")).toBe(next);
  });

  it("preserves consecutive undirected morning entries and the previous directed exit", () => {
    const readings = [reading("09:00", "entry"), reading("01:00", "exit", next), reading("09:00", undefined, next)];
    const grouped = groupPdksWorkDays(readings, employeeId, () => extended);
    expect(grouped.get(date)).toEqual(readings.slice(0, 2));
    expect(grouped.get(next)).toEqual(readings.slice(2));
  });

  it.each([undefined, "unknown"])("prioritizes an overlapping current entry window for direction %s", direction => {
    const overlapping = { ...extended, validWindow: { ...extended.validWindow, checkOutEnd: "10:00" } };
    const resolve = (_id: Id<"employees">, workDate: string) => workDate === date ? overlapping : extended;
    const accessTime = reading("09:00", undefined, next).accessTime;
    expect(pdksWorkDay(accessTime, employeeId, resolve, direction)).toBe(next);
    expect(pdksWorkDay(accessTime, employeeId, resolve, "exit")).toBe(date);
  });

  it("uses the current scheduled start when no entry window exists", () => {
    const current = { ...shift, startTime: "01:00", validWindow: undefined };
    const resolve = (_id: Id<"employees">, workDate: string) => workDate === date ? extended : current;
    expect(pdksWorkDay(reading("00:59", undefined, next).accessTime, employeeId, resolve)).toBe(date);
    expect(pdksWorkDay(reading("01:00", undefined, next).accessTime, employeeId, resolve)).toBe(next);
  });

  it("retains an undirected exit when there is no current shift", () => {
    expect(pdksWorkDay(reading("01:00", undefined, next).accessTime, employeeId, (_id, workDate) => workDate === date ? extended : null)).toBe(date);
  });

  it("leaves daytime offset-zero exits on their own calendar day", () => {
    const sameDay = { ...extended, validWindow: { ...extended.validWindow, checkOutEnd: "19:00", checkOutEndDayOffset: 0 as const } };
    expect(pdksWorkDay(reading("01:00", "exit", next).accessTime, employeeId, () => sameDay, "exit")).toBe(next);
    expect(exitMayCrossMidnight(sameDay)).toBe(false);
  });

  it("allows manual next-day exits while keeping the planned end on the same day", () => {
    const manual = { date, entryTime: "09:00", exitTime: "01:00", note: "Kart unutuldu" };
    expect(validateManualPdksInput(manual, extended)).toMatchObject({ entryTime: "09:00", exitTime: "01:00" });
    expect(manualPdksTimes(date, manual, extended)).toMatchObject({ exitNextDay: true, exitISO: `${next}T01:00:00.000+03:00` });
    const record: Doc<"pdksRecords"> = { ...manual, _id: "manual" as Id<"pdksRecords">, _creationTime: 0, employeeId,
      employeeFirstName: "Ada", employeeLastName: "Test", status: "present", manualEntry: true, createdAt: "", updatedAt: "" };
    expect(day(extended, { readings: [], manual: record })).toMatchObject({ rawTotalMinutes: 960, exitNextDay: true });
    expect(day(extended, { readings: [reading("09:00", "entry"), reading("19:00", "exit")] }).overtimeMinutes).toBeGreaterThan(0);
    expect(isOvernightShift(extended)).toBe(false);
    expect(exitMayCrossMidnight(extended)).toBe(true);
    expect(() => validateManualPdksInput(manual, { ...extended, validWindow: window })).toThrow("Çıkış saati giriş saatinden sonra olmalı");
  });

  it("does not turn equal daytime manual hours into a full-day shift", () => {
    const manual = { date, entryTime: "09:00", exitTime: "09:00", note: "Kart unutuldu" };
    expect(() => validateManualPdksInput(manual, extended)).toThrow("Çıkış saati giriş saatinden sonra olmalı");
    expect(manualPdksTimes(date, manual, extended).exitNextDay).toBe(false);
  });

  it.each([0, 1] as const)("discovers a preceding daytime assignment only with next-day offset %s", async checkOutEndDayOffset => {
    const t = convexTest(schema, import.meta.glob("../**/*.ts"));
    const projectId = await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Gündüz çıkışı" });
      const { _id: _shiftId, _creationTime: _created, ...fields } = extended;
      const shiftId = await ctx.db.insert("shifts", { ...fields, projectId, validWindow: { ...extended.validWindow,
        checkOutEnd: checkOutEndDayOffset === 1 ? "02:00" : "19:00", checkOutEndDayOffset } });
      const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "day@example.test", cardNumber: "1" });
      await ctx.db.insert("shiftAssignments", { projectId, shiftId, employeeId, startDate: date, endDate: date, createdAt: "", updatedAt: "" });
      return projectId;
    });
    expect(await t.run(async ctx => [...await flexibleReportProjects(ctx, [projectId], next, next, undefined, hasFixedShiftRules)]))
      .toEqual(checkOutEndDayOffset === 1 ? [projectId] : []);
  });
});
