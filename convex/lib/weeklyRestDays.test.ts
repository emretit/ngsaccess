import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { computePdksPlannedDay } from "./pdksMultiShift";
import { computePayrollCell } from "./pdksPayroll";
import { computeAttendanceDetailDay } from "./pdksDetail";
import { computePdksTableRow } from "./pdksTable";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { createShiftResolver, type DayPlan } from "./shiftResolver";
import { evaluateShiftAssignment } from "./shiftAssign";
import { slotForDate, validateShiftPlan } from "./shiftPlan";
import { addWorkDate } from "./pdksWorkDay";

const friday = "2026-06-26", saturday = "2026-06-27";
const weekPattern = ["MON", "TUE", "WED", "THU", "FRI"];
const projectId = "project" as Id<"projects">;
const employee: Doc<"employees"> = { _id: "employee" as Id<"employees">, _creationTime: 0, projectId, departmentId: "department" as Id<"departments">, firstName: "Ada", lastName: "Test", email: "a@test", cardNumber: "1" };
const shift: Doc<"shifts"> = { _id: "shift" as Id<"shifts">, _creationTime: 0, projectId, name: "Day", startTime: "09:00", endTime: "17:00", breakStart: "12:00", breakEnd: "12:30", overtimeStartToleranceMinutes: 0, createdAt: "", updatedAt: "" };
const assignment: Doc<"shiftAssignments"> = { _id: "assignment" as Id<"shiftAssignments">, _creationTime: 0, employeeId: employee._id, projectId, shiftId: shift._id, startDate: "2026-06-01", endDate: "2026-06-30", weekPattern, createdAt: "", updatedAt: "" };
const reading = (day: string, time: string, direction: "entry" | "exit"): Doc<"cardReadings"> => ({ _id: `${day}-${time}` as Id<"cardReadings">, _creationTime: 0, employeeId: employee._id, cardNo: "1", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", direction });
const resolverFor = (context = shift) => createShiftResolver([employee], [context], [[assignment]]);
const nextKind = (plan: DayPlan) => plan.kind === "rest" ? "rest" as const : "work" as const;
const rates = { ...DEFAULT_OVERTIME_RATES, overtimeBasis: "dailyShift" as const };
function input(context = shift, date = saturday, readings: Doc<"cardReadings">[] = []) {
  const resolver = resolverFor(context);
  return { date, readings, shift: resolver.resolve(employee._id, date), dayPlan: resolver.resolvePlan(employee._id, date), nextDayKind: nextKind(resolver.resolvePlan(employee._id, addWorkDate(date, 1))), workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: rates };
}
function cell(context = shift, date = saturday, readings: Doc<"cardReadings">[] = []) {
  const base = input(context, date, readings);
  return { ...base, dayReadings: readings, dayShift: base.shift, availableDateKeys: new Set([date]), firstRecordDate: "2026-06-01", manual: undefined, manualDay: undefined, hasLeave: false, leaves: [], holiday: undefined, empHourlyRate: 100 };
}

describe("weekly rest acceptance 1–5", () => {
  it("1: unselected Saturday is HT without punches and preserves a 30-minute break / 450 premium minutes", () => {
    expect(computePayrollCell(cell())).toMatchObject({ status: "weekend", payrollCode: "HT", totalMinutes: 0, planKind: "rest" });
    expect(computeAttendanceDetailDay(cell())).toMatchObject({ status: "weekend", payrollCode: "HT" });
    const result = computePdksPlannedDay(input(shift, saturday, [reading(saturday, "09:00", "entry"), reading(saturday, "17:00", "exit")]));
    expect(result).toMatchObject({ classification: "weekend", breakMinutes: 30, totalMinutes: 450, overtimeMinutes: 450, planKind: "rest" });
    expect(result.attendanceDecision).toBeUndefined();
  });
  it("2: rest attendance retains disabled overtime", () => {
    expect(computePdksPlannedDay(input({ ...shift, overtimeEnabled: false }, saturday, [reading(saturday, "09:00", "entry"), reading(saturday, "17:00", "exit")]))).toMatchObject({ overtimeMinutes: 0, totalMinutes: 450 });
  });
  it("3: Friday night uses its start date or Saturday rest after midnight in all consumers", () => {
    const night = { ...shift, startTime: "22:00", endTime: "06:00", breakStart: "23:00", breakEnd: "23:30" };
    const readings = [reading(friday, "22:00", "entry"), reading(saturday, "06:00", "exit")];
    const base = input(night, friday, readings);
    const anchored = computePdksPlannedDay({ ...base, overtimeRates: { ...rates, nightShiftDayMode: "shiftStart" } });
    expect(anchored.overtimeMinutes).toBe(0);
    expect(anchored.overtimeSegments.every(segment => segment.classification === "workday" && segment.calendarDate === friday)).toBe(true);
    const splitRates = { ...rates, nightShiftDayMode: "splitAtMidnight" as const };
    const split = computePdksPlannedDay({ ...base, overtimeRates: splitRates });
    expect(split.overtimeMinutes).toBe(360);
    expect(split.overtimeSegments.filter(segment => segment.calendarDate === saturday).every(segment => segment.classification === "weekend")).toBe(true);
    expect(computePayrollCell({ ...cell(night, friday, readings), overtimeRates: splitRates }).overtimeMinutes).toBe(360);
    expect(computeAttendanceDetailDay({ ...cell(night, friday, readings), overtimeRates: splitRates }).overtimeMinutes).toBe(360);
    const resolver = resolverFor(night);
    const table = computePdksTableRow({ empKey: employee._id, employee, empReadings: readings, availableDateKeys: new Set([friday, saturday]), firstRecordDate: "2026-06-01", departmentName: "", periodDateKeys: [friday], startDate: friday, isSingleDay: true, viewMode: "matrix", manualPdksByEmpDate: new Map(), allLeaves: [], holidayMap: new Map(), workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: splitRates, resolveShift: resolver.resolve, resolveLast: resolver.resolveLast, resolvePlan: resolver.resolvePlan, manualEditedBy: null });
    expect(table.days[0]?.overtimeMinutes).toBe(360);
  });
  it("4: Saturday holiday wins (RT), unless context requires holiday work", () => {
    const holiday: Doc<"holidays"> = { _id: "holiday" as Id<"holidays">, _creationTime: 0, date: saturday, name: "Tatil", isHalfDay: false, createdAt: "" };
    expect(computePayrollCell({ ...cell(), holiday })).toMatchObject({ payrollCode: "RT", classification: "holiday" });
    expect(computePayrollCell({ ...cell({ ...shift, holidayWorkRequired: true }), holiday })).toMatchObject({ payrollCode: "HT", classification: "weekend" });
    expect(computePdksPlannedDay({ ...input(), holiday: { ...holiday, isHalfDay: true } }).classification).toBe("halfDayHoliday");
  });
  it("5: personal rest masks departments and newer personal plans mask older patterns", () => {
    const department: Doc<"departments"> = { _id: employee.departmentId as Id<"departments">, _creationTime: 0, projectId, name: "Dept", createdAt: "", updatedAt: "" };
    const deptAssignment: Doc<"departmentShiftAssignments"> = { _id: "deptAssignment" as Id<"departmentShiftAssignments">, _creationTime: 0, projectId, departmentId: department._id, shiftId: shift._id, startDate: assignment.startDate, endDate: assignment.endDate, createdAt: "", updatedAt: "" };
    const older = { ...assignment, _id: "older" as Id<"shiftAssignments">, weekPattern: ["SAT"], updatedAt: "2026-01-01" };
    const resolver = createShiftResolver([employee], [shift], [[older, { ...assignment, updatedAt: "2026-02-01" }]], [department], [deptAssignment]);
    expect(resolver.resolvePlan(employee._id, saturday)).toMatchObject({ kind: "rest", source: "employee", assignmentId: assignment._id, shifts: [shift] });
    const request = { range: assignment, shift, leaves: [], holidays: [], existing: [{ ...older, assignmentId: older._id, shiftName: "Other", shift: { startTime: "18:00", endTime: "20:00" } }] };
    expect(evaluateShiftAssignment(request)).toMatchObject({ status: "conflict" });
    expect(evaluateShiftAssignment(request).reason).toContain("üstünü örter");
    expect(evaluateShiftAssignment({ ...request, forceConfirm: true }).status).toBe("will_assign");
  });
});

it("legacy empty patterns read as seven days; all weekly writes need at least one day", () => {
  for (const weekPattern of [undefined, []]) {
    const row = { ...assignment, weekPattern };
    expect(slotForDate(row, saturday)).toEqual([shift._id]);
    expect(() => validateShiftPlan(row, new Map([[shift._id, shift]]))).toThrow("En az bir çalışma günü seçin");
    expect(() => validateShiftPlan({ ...row, plan: { kind: "weekly", shiftIds: [shift._id] } }, new Map([[shift._id, shift]]))).toThrow("En az bir çalışma günü seçin");
  }
});

it("rest context resolves historical rules; mixed cycles keep no context", () => {
  const current = { ...shift, versionedUntil: "2026-06-30", breakEnd: "13:00" };
  const resolver = createShiftResolver([employee], [current], [[assignment]], [], [], [{ shiftId: shift._id, validUntil: "2026-06-30", rules: { startTime: "09:00", endTime: "17:00", breakStart: "12:00", breakEnd: "12:30" } }]);
  expect(resolver.resolve(employee._id, saturday)?.breakEnd).toBe("12:30");
  const other = { ...shift, _id: "other" as Id<"shifts"> };
  for (const same of [true, false]) {
    const plan = { kind: "dayCycle" as const, anchorDate: saturday, slots: [[], [shift._id], [same ? shift._id : other._id]] };
    expect(createShiftResolver([employee], [shift, other], [[{ ...assignment, plan, weekPattern: [] }]]).resolvePlan(employee._id, saturday)).toMatchObject({ kind: "rest", shifts: same ? [shift] : [] });
  }
});

it("multi-shift rest preserves segment rules and manual overnight exit without an attendance decision", () => {
  const morning = { ...shift, endTime: "12:00", breakStart: "10:00", breakEnd: "10:30" };
  const night = { ...shift, _id: "night" as Id<"shifts">, startTime: "22:00", endTime: "06:00", breakStart: "23:00", breakEnd: "23:30", overtimeEnabled: false };
  const resolver = createShiftResolver([employee], [morning, night], [[{ ...assignment, plan: { kind: "weekly", shiftIds: [morning._id, night._id] } }]]);
  const manual: Doc<"pdksRecords"> = { _id: "manual" as Id<"pdksRecords">, _creationTime: 0, employeeId: employee._id, date: saturday, status: "present", employeeFirstName: "Ada", employeeLastName: "Test", manualEntry: true, entryTime: "09:00", exitTime: "06:00", createdAt: "", updatedAt: "" };
  const day = computePdksPlannedDay({ ...input(), dayPlan: resolver.resolvePlan(employee._id, saturday), manual, readings: [reading(saturday, "09:00", "entry"), reading(saturday, "12:00", "exit"), reading(saturday, "22:00", "entry")] });
  expect(day).toMatchObject({ planKind: "rest", classification: "weekend", totalMinutes: 600, overtimeMinutes: 150, exitNextDay: true });
  expect(day.segments?.map(segment => segment.totalMinutes)).toEqual([150, 450]);
  expect(day).not.toHaveProperty("attendanceDecision");
  expect(resolver.resolveLast(employee._id, saturday)).toBe(night);
});
