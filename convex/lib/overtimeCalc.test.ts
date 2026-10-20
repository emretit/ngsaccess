import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  bucketWeeklyOvertime,
  calculatePeriodOvertime,
  overtimePeriodRange,
  totalOvertimeMinutes,
  type OvertimeDay,
  type OvertimeSegment,
} from "./overtimeCalc";
import { computePdksDay } from "./pdksDay";
import { computePdksTableRow } from "./pdksTable";
import { computePayrollCell } from "./pdksPayroll";
import { computeAttendanceDetailDay, summarizeAttendanceDays } from "./pdksDetail";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { addWorkDate } from "./pdksWorkDay";

const workingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const period = { startDate: "2026-06-22", endDate: "2026-06-28", hourlyRate: 100 };
const segment = (netMinutes: number, overrides: Partial<OvertimeSegment> = {}): OvertimeSegment => ({
  netMinutes, dailyOvertimeMinutes: 0, classification: "workday",
  multiplier: 1.5, eligible: true, ...overrides,
});
const entry = (date: string, netMinutes: number, overrides: Partial<OvertimeSegment> = {}): OvertimeDay => ({
  date, totalMinutes: netMinutes, overtimeSegments: [segment(netMinutes, overrides)],
});
const week = (hours: number[]) => hours.map((h, i) => entry(addWorkDate(period.startDate, i), h * 60));
const manual = (entryTime: string, exitTime: string) =>
  ({ entryTime, exitTime, manualEntry: true }) as Doc<"pdksRecords">;
const shift = (startTime: string, endTime: string, extra: Partial<Doc<"shifts">> = {}) =>
  ({ startTime, endTime, overtimeStartToleranceMinutes: 0, ...extra }) as Doc<"shifts">;

describe("project overtime settlement", () => {
  it.each([
    [[9, 9, 9, 9, 8], 0, 0],
    [[10, 10, 10, 10, 10], 300, 750],
  ] as const)("weekly %j hours produces matching minutes and pay", (hours, minutes, pay) => {
    const days = week([...hours]);
    expect(calculatePeriodOvertime(days, period)).toMatchObject({
      overtimeMinutes: minutes, overtimePayTRY: pay,
    });
    // Missing settings retain the existing bucket rule for complete weeks.
    expect(totalOvertimeMinutes(bucketWeeklyOvertime(days.map((d) => ({
      date: d.date, netMinutes: d.totalMinutes, classification: "workday",
    }))))).toBe(minutes);
  });

  it("allocates excess to the latest work minutes, including the night multiplier", () => {
    const days = week([10, 10, 10, 10, 10]);
    days[4].overtimeSegments = [
      segment(480), segment(120, { multiplier: 3 }),
    ];
    expect(calculatePeriodOvertime([...days].reverse(), period)).toMatchObject({
      overtimeMinutes: 300,
      // Friday's last 120 min at 3x, preceding 180 min at 1.5x.
      overtimePayTRY: 1050, overtimeMultiplier: 2.1,
    });
  });

  it("dailyShift: four 11-hour net days on nine-hour net shifts yield eight hours", () => {
    const days = [0, 1, 2, 3].map((i) => computePdksDay({
      date: addWorkDate(period.startDate, i), readings: [], manual: manual("08:00", "20:00"),
      // Ten hours on site minus the scheduled one-hour break = nine hours.
      shift: shift("08:00", "18:00", { breakStart: "12:00", breakEnd: "13:00" }),
      workSettings: DEFAULT_WORK_SETTINGS, workingDays,
    }));
    expect(days.map((d) => d.totalMinutes)).toEqual([660, 660, 660, 660]);
    expect(calculatePeriodOvertime(days, { ...period, overtimeBasis: "dailyShift" }))
      .toMatchObject({ overtimeMinutes: 480, overtimePayTRY: 1200 });
    expect(calculatePeriodOvertime(days, period))
      .toMatchObject({ overtimeMinutes: 0, overtimePayTRY: 0 });
  });

  it("preserves the legacy daily night-break cap and conserves integer net minutes", () => {
    const day = computePdksDay({
      date: period.startDate, readings: [], manual: manual("19:00", "23:00"),
      shift: null, workSettings: DEFAULT_WORK_SETTINGS, workingDays,
      overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftMultiplier: 3 },
    });
    expect(day).toMatchObject({ totalMinutes: 225, overtimeMinutes: 225, nightMinutes: 56, nightOvertimeMinutes: 56 });
    expect(calculatePeriodOvertime([day], { ...period, overtimeBasis: "dailyShift" }))
      .toMatchObject({ overtimeMinutes: 225, overtimePayTRY: 702.5 });
    const odd = computePdksDay({
      date: "2026-06-26", readings: [], manual: manual("21:07", "06:03"),
      shift: shift("22:00", "06:00"), workSettings: DEFAULT_WORK_SETTINGS, workingDays,
      overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftDayMode: "splitAtMidnight" },
    });
    expect(odd.overtimeSegments.reduce((sum, s) => sum + s.netMinutes, 0)).toBe(odd.totalMinutes);
    expect(odd.overtimeSegments.every((s) => Number.isInteger(s.netMinutes))).toBe(true);
  });

  it.each([
    ["max", 1050, 1312.5],
    ["multiply", 1575, 1968.75],
    ["additive", 1400, 1662.5],
  ] as const)("Friday 22–Saturday 06 splits the rate without moving the work date (%s)", (mode, startPay, splitPay) => {
    const base = {
      date: "2026-06-26", readings: [], manual: manual("22:00", "06:00"),
      shift: shift("22:00", "06:00"), workSettings: DEFAULT_WORK_SETTINGS, workingDays,
    };
    const rates = { ...DEFAULT_OVERTIME_RATES, nightCombineMode: mode };
    const start = computePdksDay({ ...base, overtimeRates: rates });
    const split = computePdksDay({ ...base, overtimeRates: { ...rates, nightShiftDayMode: "splitAtMidnight" } });
    expect(split).toMatchObject({ date: start.date, totalMinutes: 420, classification: "workday", exitNextDay: true });
    expect(split.overtimeSegments.map((s) => [s.classification, s.netMinutes]))
      .toEqual([["workday", 105], ["weekend", 315]]);
    const prior = week([12, 12, 12, 9]);
    expect(calculatePeriodOvertime([...prior, start], period))
      .toMatchObject({ overtimeMinutes: 420, overtimePayTRY: startPay });
    expect(calculatePeriodOvertime([...prior, split], period))
      .toMatchObject({ overtimeMinutes: 420, overtimePayTRY: splitPay });
  });

  it("splits at actual holiday midnight and deducts the break from its own segment", () => {
    const holiday = { date: "2026-06-24", isHalfDay: false } as Doc<"holidays">;
    const day = computePdksDay({
      date: "2026-06-23", readings: [], manual: manual("22:00", "06:00"),
      shift: shift("22:00", "06:00", { breakStart: "00:00", breakEnd: "01:00" }),
      workSettings: DEFAULT_WORK_SETTINGS, workingDays,
      holidayMap: new Map([[holiday.date, holiday]]),
      overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftDayMode: "splitAtMidnight" },
    });
    expect(calculatePeriodOvertime([day], period))
      .toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 1000 });
    expect(calculatePeriodOvertime([day], { ...period, overtimeBasis: "dailyShift" }))
      .toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 1000 });
  });

  it("books June/July overtime on the date it occurs without duplication", () => {
    const days = [0, 1, 2, 3, 4].map((i) => entry(addWorkDate("2026-06-29", i), 600));
    const june = calculatePeriodOvertime(days, { ...period, startDate: "2026-06-01", endDate: "2026-06-30" });
    const july = calculatePeriodOvertime(days, { ...period, startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(june).toMatchObject({ overtimeMinutes: 0, overtimePayTRY: 0 });
    expect(july).toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 750 });
    expect(overtimePeriodRange("2026-07-01", "2026-07-31"))
      .toEqual({ startDate: "2026-06-29", endDate: "2026-07-31" });
    expect(calculatePeriodOvertime(days, { ...period, startDate: "2026-07-03", endDate: "2026-07-03" }))
      .toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 750 });
  });

  it("books six nine-hour workdays on Saturday and Sunday premium on Sunday", () => {
    const days = [...week([9, 9, 9, 9, 9, 9]), entry("2026-06-28", 240, { classification: "weekend", multiplier: 2 })];
    const result = calculatePeriodOvertime(days, period);
    expect(result.overtimeByDate["2026-06-27"]).toMatchObject({ overtimeMinutes: 540, overtimePayTRY: 1350 });
    expect(result.overtimeByDate["2026-06-28"]).toMatchObject({ overtimeMinutes: 240, overtimePayTRY: 800 });
    expect(result.overtimeMinutes).toBe(780);
  });

  it("disabled Saturday consumes excess without paying or moving it to Friday", () => {
    const days = [...week([9, 9, 9, 9, 9]), entry("2026-06-27", 540, { eligible: false })];
    expect(calculatePeriodOvertime(days, period)).toMatchObject({ overtimeMinutes: 0, overtimePayTRY: 0 });
    // Disabled minutes before crossing still count, and later eligible excess is paid once.
    const earlyDisabled = week([10, 10, 10, 10, 10]);
    earlyDisabled[0].overtimeSegments = [segment(600, { eligible: false })];
    expect(calculatePeriodOvertime(earlyDisabled, period).overtimeByDate["2026-06-26"].overtimeMinutes).toBe(300);
  });

  it("splitAtMidnight counts a Sunday shift's Monday minutes toward the new week", () => {
    const sunday = (date: string): OvertimeDay => ({
      date, totalMinutes: 420, overtimeSegments: [
        segment(105, { classification: "weekend", multiplier: 2, calendarDate: date }),
        segment(315, { calendarDate: addWorkDate(date, 1) }),
      ],
    });
    // 50h week: only Sunday 22-24 is premium; Monday 00-06 is not excess of the old week.
    const result = calculatePeriodOvertime([...week([10, 10, 10, 10, 10]), sunday("2026-06-28")], period);
    expect(result.overtimeByDate["2026-06-28"]).toMatchObject({ overtimeMinutes: 105, overtimePayTRY: 350 });
    expect(result.overtimeMinutes).toBe(405);
    // Next week: the previous Sunday is read only to seed Monday's 315 min.
    const next = { startDate: "2026-06-29", endDate: "2026-07-05", hourlyRate: 100 };
    const nextWeek = [9, 9, 9, 9, 9].map((h, i) => entry(addWorkDate(next.startDate, i), h * 60));
    const settled = calculatePeriodOvertime([sunday("2026-06-28"), ...nextWeek], next);
    expect(settled.overtimeByDate["2026-06-28"]).toBeUndefined();
    expect(settled.overtimeByDate["2026-07-03"]).toMatchObject({ overtimeMinutes: 315 });
    expect(settled.overtimeMinutes).toBe(315);
  });

  it("reads the previous Sunday only for weekly split-at-midnight settlement", () => {
    expect(overtimePeriodRange("2026-07-01", "2026-07-05", "weekly45", "splitAtMidnight").startDate).toBe("2026-06-28");
    expect(overtimePeriodRange("2026-07-01", "2026-07-05", "weekly45", "shiftStart").startDate).toBe("2026-06-29");
    expect(overtimePeriodRange("2026-07-01", "2026-07-05", "dailyShift", "splitAtMidnight").startDate).toBe("2026-07-01");
  });

  it("dailyShift does not expand the requested work dates", () => {
    expect(overtimePeriodRange("2026-07-01", "2026-07-03", "dailyShift"))
      .toEqual({ startDate: "2026-07-01", endDate: "2026-07-03" });
  });

  it("daily mode books the work date and keeps the 11-hour warning independent of settlement", () => {
    const days = [entry("2026-06-30", 661, { dailyOvertimeMinutes: 121 })];
    expect(calculatePeriodOvertime(days, { ...period, startDate: "2026-06-01", endDate: "2026-06-30", overtimeBasis: "dailyShift" }))
      .toMatchObject({ overtimeMinutes: 121, exceedsDaily11h: ["2026-06-30"] });
    expect(calculatePeriodOvertime(days, { ...period, startDate: "2026-06-01", endDate: "2026-06-30" }))
      .toMatchObject({ overtimeMinutes: 0, exceedsDaily11h: ["2026-06-30"] });
  });

  it("premium days are separate from 45h; unknown pay remains null and disabled overtime is not paid", () => {
    const days = [...week([9, 9, 9, 9, 8]), entry("2026-06-27", 420, { classification: "weekend", multiplier: 2 })];
    expect(calculatePeriodOvertime(days, period))
      .toMatchObject({ overtimeMinutes: 420, overtimePayTRY: 1400 });
    expect(calculatePeriodOvertime(days, { ...period, hourlyRate: null }).overtimePayTRY).toBeNull();
    expect(calculatePeriodOvertime([entry("2026-06-27", 420, { classification: "weekend", eligible: false })], period).overtimeMinutes).toBe(0);
  });

  it.each(["weekly45", "dailyShift"] as const)("table, detail and payroll use the same %s minutes and money", (basis) => {
    const id = "employee_test" as Id<"employees">;
    const employee = { _id: id, firstName: "Test", lastName: "Person", cardNumber: "1", hourlyRate: 100 } as Doc<"employees">;
    const dates = [0, 1, 2, 3, 4].map((i) => addWorkDate(period.startDate, i));
    const overtimeRates = { ...DEFAULT_OVERTIME_RATES, overtimeBasis: basis };
    const dayShift = shift("09:00", "18:00");
    const availableDateKeys = new Set(dates);
    const cells = dates.map((date) => computePayrollCell({
      date, availableDateKeys, manual: manual("09:00", "20:00"), dayReadings: [],
      hasLeave: false, holiday: null, workingDays, dayShift,
      workSettings: DEFAULT_WORK_SETTINGS, overtimeRates, empHourlyRate: 100,
    }));
    const detail = dates.map((date) => computeAttendanceDetailDay({
      date, availableDateKeys, manualDay: manual("09:00", "20:00"), dayReadings: [],
      leaves: [], holiday: null, workingDays, dayShift,
      workSettings: DEFAULT_WORK_SETTINGS, overtimeRates,
    }));
    const row = computePdksTableRow({
      availableDateKeys, empKey: id, empReadings: [], employee, departmentName: "",
      periodDateKeys: [...dates, "2026-06-27", period.endDate],
      startDate: period.startDate, isSingleDay: false, viewMode: "matrix",
      manualPdksByEmpDate: new Map(dates.map((d) => [`${id}__${d}`, manual("09:00", "20:00")])),
      allLeaves: [], holidayMap: new Map(), workingDays,
      workSettings: DEFAULT_WORK_SETTINGS, overtimeRates,
      resolveShift: () => dayShift, manualEditedBy: null,
    });
    const options = { ...period, overtimeBasis: basis };
    const payroll = calculatePeriodOvertime(cells, options);
    const summary = summarizeAttendanceDays(detail, options);
    for (const result of [payroll, summary, row]) {
      expect(result).toMatchObject(basis === "weekly45"
        ? { overtimeMinutes: 300, overtimePayTRY: 750 }
        : { overtimeMinutes: 600, overtimePayTRY: 1500 });
    }
    // Cells and summaries expose the same settled amounts.
    expect(row.days.slice(0, 5).map((d) => d.overtimeMinutes)).toEqual(basis === "weekly45" ? [0, 0, 0, 0, 300] : [120, 120, 120, 120, 120]);
  });
});
