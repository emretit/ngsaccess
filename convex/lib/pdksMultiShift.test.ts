import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { computePdksDay } from "./pdksDay";
import { computePdksPlannedDay, manualForSegment, splitReadingsByShift, shiftForInstant } from "./pdksMultiShift";
import { computePdksTableRow } from "./pdksTable";
import { computePayrollCell } from "./pdksPayroll";
import { computeAttendanceDetailDay } from "./pdksDetail";
import { calculatePeriodOvertime } from "./overtimeCalc";
import { addWorkDate, buildPdksWorkDateResolver, groupPdksWorkDays, pdksWorkDay } from "./pdksWorkDay";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import type { DayPlan } from "./shiftResolver";
import { validateDayShifts } from "./shiftPlan";
import { DEFAULT_FLEXIBLE } from "./pdksFlexible";

const date = "2026-06-22";
const employee: Doc<"employees"> = { _id: "employee" as Id<"employees">, _creationTime: 0, firstName: "Ada", lastName: "Test", cardNumber: "1", email: "ada@test", isActive: true };
const workingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const shift = (name: string, startTime: string, endTime: string, extra: Partial<Doc<"shifts">> = {}): Doc<"shifts"> => ({ _id: name as Id<"shifts">, _creationTime: 0, name, startTime, endTime, createdAt: "", updatedAt: "", overtimeStartToleranceMinutes: 0, ...extra });
const morning = shift("Sabah", "08:00", "12:00"), evening = shift("Akşam", "14:00", "18:00");
const plan = (shifts = [morning, evening], calendar: "project" | "plan" = "project"): DayPlan => ({ kind: "shifts", source: "employee", calendar, shifts });
const reading = (time: string, direction?: "entry" | "exit", day = date): Doc<"cardReadings"> => ({ _id: `${day}-${time}-${direction}` as Id<"cardReadings">, _creationTime: 0, employeeId: employee._id, cardNo: "1", accessStatus: "izin_verildi", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), ...(direction ? { direction } : {}) });
const full = [reading("08:00", "entry"), reading("12:00", "exit"), reading("14:00", "entry"), reading("18:00", "exit")];
const params = (readings: Doc<"cardReadings">[] = full) => ({ date, readings, shift: morning, workSettings: DEFAULT_WORK_SETTINGS, workingDays, overtimeRates: { ...DEFAULT_OVERTIME_RATES, overtimeBasis: "dailyShift" as const }, hourlyRate: 100 });
const rowParams = () => ({ empKey: employee._id, employee, empReadings: full, availableDateKeys: new Set([date]), firstRecordDate: date, departmentName: "", periodDateKeys: [date], startDate: date, isSingleDay: true, viewMode: "matrix" as const, manualPdksByEmpDate: new Map<string, Doc<"pdksRecords">>(), allLeaves: [], holidayMap: new Map<string, Doc<"holidays">>(), workingDays, workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: params().overtimeRates, resolveShift: () => morning, manualEditedBy: null });

describe("planned PDKS day", () => {
  it.each(["weekend", "holiday"] as const)("weekly multi-shift %s retains the single-shift calendar status", classification => {
    const day = "2026-06-27";
    const holiday: Doc<"holidays"> | undefined = classification === "holiday" ? { _id: "holiday" as Id<"holidays">, _creationTime: 0, date: day, name: "Tatil", createdAt: "", isHalfDay: false } : undefined;
    const holidayMap = new Map(holiday ? [[day, holiday]] : []);
    const punches = [reading("08:00", "entry", day), reading("12:00", "exit", day), reading("14:00", "entry", day), reading("18:00", "exit", day)];
    for (const count of [4, 2, 0]) {
      const empReadings = punches.slice(0, count);
      const input = { ...rowParams(), empReadings, availableDateKeys: new Set([day]), firstRecordDate: day, periodDateKeys: [day], startDate: day, holidayMap };
      const single = computePdksTableRow(input).days[0];
      const multiple = computePdksTableRow({ ...input, resolvePlan: () => plan(), resolveLast: () => evening }).days[0];
      expect(multiple?.status).toBe(single?.status);
      expect(multiple?.status).toBe(count ? "present" : classification);
      expect(multiple?.totalMinutes).toBe(count * 112.5);
      const merged = computePdksPlannedDay({ ...params(empReadings), date: day, holiday, holidayMap, dayPlan: plan() });
      expect(merged).not.toHaveProperty("attendanceDecision");
    }
  });
  it.each([[], [reading("08:00")], full.slice(0, 2), [reading("08:17"), reading("19:30")]].map(readings => ({ readings })))("ordinary zero/one shift is structurally identical to the old engine: $readings", ({ readings }) => {
    for (const item of [null, morning]) {
      const input = { ...params(readings), shift: item };
      const dayPlan: DayPlan = item ? plan([item]) : { kind: "none", source: "project" };
      if (item) expect(computePdksPlannedDay({ ...input, dayPlan })).toStrictEqual(computePdksDay(input));
      else expect(computePdksPlannedDay({ ...input, dayPlan })).toMatchObject({ noShift: true, totalMinutes: 0, hasAttendance: false, overtimeSegments: [] });
      expect(computePdksPlannedDay(input)).toStrictEqual(computePdksDay(input));
    }
  });
  it("the table's optional resolvePlan preserves the entire ordinary DTO", () => {
    const input = { ...rowParams(), empReadings: full.slice(0, 2) };
    expect(computePdksTableRow({ ...input, resolvePlan: () => plan([morning]), resolveLast: () => morning })).toStrictEqual(computePdksTableRow(input));
    const none = { ...input, resolveShift: () => null };
    expect(computePdksTableRow({ ...none, resolvePlan: () => ({ kind: "none", source: "project" }) })).toMatchObject({ noShift: true, totalMinutes: 0, status: "noData" });
  });
  it("08–12 plus 14–18 totals pieces, preserving both breaks and excluding the gap", () => {
    const result = computePdksPlannedDay({ ...params(), dayPlan: plan() });
    expect(result).toMatchObject({ attendanceDecision: "present", durationMeasured: true, rawTotalMinutes: 480, totalMinutes: 450, breakMinutes: 30, isLate: false });
    expect(result.segments?.map(s => [s.shiftId, s.decision, s.totalMinutes])).toEqual([[morning._id, "present", 225], [evening._id, "present", 225]]);
    expect(computePdksTableRow({ ...rowParams(), resolvePlan: () => plan(), resolveLast: () => evening }).days[0]).toMatchObject({ status: "present", totalMinutes: 450, detail: { shiftName: "Sabah + Akşam", plannedStart: "08:00", plannedEnd: "18:00", segments: result.segments } });
  });
  it("one missed piece is incomplete and keeps the worked minutes; both missed is absent", () => {
    const result = computePdksPlannedDay({ ...params(full.slice(0, 2)), dayPlan: plan() });
    expect(result).toMatchObject({ attendanceDecision: "incomplete", durationMeasured: false, totalMinutes: 225, hasAttendance: true });
    expect(result.segments?.map(s => s.decision)).toEqual(["present", "absent"]);
    expect(computePdksTableRow({ ...rowParams(), empReadings: full.slice(0, 2), resolvePlan: () => plan() }).days[0]?.status).toBe("incomplete");
    expect(computePdksPlannedDay({ ...params([]), dayPlan: plan() }).attendanceDecision).toBe("absent");
  });
  it("gap exit goes backward, entry forward, undirected uses the midpoint including ties", () => {
    for (const [time, direction, index] of [["13:00", undefined, 0], ["13:01", undefined, 1], ["13:40", "exit", 0], ["12:20", "entry", 1]] as const) {
      const r = reading(time, direction);
      const split = splitReadingsByShift(date, [r], [morning, evening]);
      expect(split[index]).toEqual([r]);
      expect(split.flat()).toEqual([r]);
      expect(shiftForInstant(date, r.accessTime, plan(), direction)?._id).toBe(index === 0 ? morning._id : evening._id);
    }
  });
  it("valid windows win over gap direction and out-of-window events are retained for review", () => {
    const fixed = { ...morning, validWindow: { checkInStart: "07:00", checkInEnd: "08:30", checkOutStart: "11:30", checkOutEnd: "13:30", checkOutEndDayOffset: 0 as const } };
    const r = reading("13:20");
    expect(splitReadingsByShift(date, [r], [fixed, evening])[0]).toEqual([r]);
    const result = computePdksPlannedDay({ ...params([reading("06:00", "entry"), ...full.slice(1)]), dayPlan: plan([fixed, evening]) });
    expect(result.attendanceDecision).toBe("incomplete");
    expect(result.segments?.[0]?.decision).toBe("incomplete");
  });
  it("only the last overnight piece claims the next-day tail in all work-day helpers", () => {
    const night = shift("Gece", "22:00", "06:00");
    const last = () => night, first = () => morning;
    const exit = reading("06:00", "exit", addWorkDate(date, 1));
    expect(pdksWorkDay(exit.accessTime, employee._id, first, "exit", last)).toBe(date);
    const raw = [...full.slice(0, 2), reading("22:00", "entry"), exit];
    expect(groupPdksWorkDays(raw, employee._id, first, undefined, undefined, last).get(date)).toHaveLength(4);
    expect(buildPdksWorkDateResolver([employee], first, undefined, undefined, last)(exit)).toBe(date);
    expect(computePdksPlannedDay({ ...params(raw), dayPlan: plan([morning, night]) })).toMatchObject({ isOvernightShift: true, exitNextDay: true, attendanceDecision: "present" });
  });
  it("manual entry only applies to first piece and exit only to last piece", () => {
    const manual: Doc<"pdksRecords"> = { _id: "manual" as Id<"pdksRecords">, _creationTime: 0, employeeId: employee._id, date, status: "present", employeeFirstName: "Ada", employeeLastName: "Test", entryTime: "08:00", exitTime: "18:00", manualEntry: true, createdAt: "", updatedAt: "" };
    expect(manualForSegment(manual, 0, 3)).toMatchObject({ entryTime: "08:00", exitTime: undefined });
    expect(manualForSegment(manual, 1, 3)).toBeUndefined();
    expect(manualForSegment(manual, 2, 3)).toMatchObject({ entryTime: undefined, exitTime: "18:00" });
    const result = computePdksPlannedDay({ ...params([reading("07:55"), reading("12:00"), reading("14:00"), reading("18:05")]), manual, dayPlan: plan() });
    expect(result.segments?.map(s => [s.firstISO, s.lastISO])).toEqual([[`${date}T08:00:00.000+03:00`, reading("12:00").accessTime], [reading("14:00").accessTime, `${date}T18:00:00.000+03:00`]]);
  });
  it("piece overtime is concatenated and weighted; weekly overtime is settled once", () => {
    const result = computePdksPlannedDay({ ...params([reading("08:00"), reading("13:00"), reading("14:00"), reading("19:00")]), dayPlan: plan() });
    expect(result.overtimeMinutes).toBe(120);
    expect(result.overtimePayTRY).toBe(300);
    expect(result.overtimeSegments.reduce((total, part) => total + part.netMinutes, 0)).toBe(result.totalMinutes);
    const end = shift("Uzun", "14:00", "20:00");
    const days = Array.from({ length: 5 }, (_, i) => {
      const date = addWorkDate("2026-06-22", i);
      return computePdksPlannedDay({ ...params([reading("08:00", undefined, date), reading("12:00", undefined, date), reading("14:00", undefined, date), reading("20:00", undefined, date)]), date, dayPlan: plan([morning, end]) });
    });
    const totals = calculatePeriodOvertime(days, { startDate: date, endDate: addWorkDate(date, 4), overtimeBasis: "weekly45", hourlyRate: 100 });
    expect(totals.overtimeMinutes).toBe(days.reduce((sum, day) => sum + day.totalMinutes, 0) - 2700);
  });
  it("cycle rest is weekend, Saturday filled slot is workday, holidays retain priority", () => {
    const rest: DayPlan = { kind: "rest", source: "department", calendar: "plan" };
    expect(computePdksPlannedDay({ ...params([]), dayPlan: rest })).toMatchObject({ classification: "weekend", planKind: "rest" });
    expect(computePdksPlannedDay({ ...params([]), date: "2026-06-27", dayPlan: plan([morning], "plan") }).classification).toBe("workday");
    const holiday: Doc<"holidays"> = { _id: "holiday" as Id<"holidays">, _creationTime: 0, date, name: "Tatil", createdAt: "", isHalfDay: false };
    expect(computePdksPlannedDay({ ...params([]), holiday, dayPlan: rest }).classification).toBe("holiday");
    expect(computePdksPlannedDay({ ...params([]), holiday, dayPlan: plan([{ ...morning, holidayWorkRequired: true }], "plan") }).classification).toBe("workday");
  });
  it("payroll and detail expose pieces while preserving mixed decisions", () => {
    const input = { date, availableDateKeys: new Set([date]), firstRecordDate: date, dayReadings: full.slice(0, 2), dayShift: morning, dayPlan: plan(), manual: undefined, manualDay: undefined, leaves: [], hasLeave: false, holiday: undefined, workingDays, workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: params().overtimeRates, empHourlyRate: 100 };
    expect(computePayrollCell(input)).toMatchObject({ status: "incomplete", totalMinutes: 225, payrollCode: "—", segments: [{ decision: "present" }, { decision: "absent" }] });
    expect(computeAttendanceDetailDay(input)).toMatchObject({ status: "incomplete", totalMinutes: 225, segments: [{ decision: "present" }, { decision: "absent" }] });
  });
  it("rejects flexible and fixed shifts in the same plan", () => {
    expect(() => validateDayShifts([morning, { ...evening, scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE }])).toThrow("Esnek vardiya başka vardiyayla aynı güne konamaz");
  });
});

it("cycle Friday night keeps its start-day work classification across Saturday midnight", () => {
  const friday = "2026-06-26", saturday = "2026-06-27";
  const night = shift("Gece", "22:00", "06:00");
  const input = { ...params([reading("22:00", "entry", friday), reading("06:00", "exit", saturday)]), date: friday, shift: night,
    overtimeRates: { ...params().overtimeRates, nightShiftDayMode: "splitAtMidnight" as const } };
  const cycle = computePdksPlannedDay({ ...input, dayPlan: plan([night], "plan") });
  expect(cycle.overtimeSegments.some(segment => segment.calendarDate === saturday)).toBe(true);
  expect(cycle.overtimeSegments.every(segment => segment.classification === "workday")).toBe(true);
  expect(cycle.overtimeMinutes).toBe(0);
  const ordinary = computePdksPlannedDay({ ...input, dayPlan: plan([night]) });
  expect(ordinary.overtimeSegments.some(segment => segment.calendarDate === saturday && segment.classification === "weekend")).toBe(true);
  expect(ordinary.overtimeMinutes).toBeGreaterThan(0);
});
