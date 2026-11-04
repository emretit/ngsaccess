import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { computePdksDay } from "./pdksDay";
import { calculatePeriodOvertime, type OvertimeDay } from "./overtimeCalc";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { LEGACY_PDKS_POLICY } from "./pdksRules";
import { getTurkishHolidaysForYear } from "./turkishHolidays";
import { DEFAULT_FLEXIBLE } from "./pdksFlexible";

const date = "2026-10-28";
const shift: Doc<"shifts"> = {
  _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Gündüz",
  startTime: "09:00", endTime: "18:00", breakStart: "12:00", breakEnd: "13:00",
  overtimeStartToleranceMinutes: 0, createdAt: "", updatedAt: "",
};
function reading(time: string, direction?: "entry" | "exit", day = date): Doc<"cardReadings"> {
  return {
    _id: `${day}-${time}` as Id<"cardReadings">, _creationTime: 0, cardNo: "1",
    accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), direction, accessStatus: "izin_verildi",
  };
}
function manual(entryTime?: string, exitTime?: string): Doc<"pdksRecords"> {
  return {
    _id: "manual" as Id<"pdksRecords">, _creationTime: 0, date,
    employeeId: "employee" as Id<"employees">, employeeFirstName: "Test", employeeLastName: "Kişi",
    entryTime, exitTime, manualEntry: true, status: "present", createdAt: "", updatedAt: "",
  };
}
function holiday(day = date, isHalfDay = true): Doc<"holidays"> {
  return { _id: day as Id<"holidays">, _creationTime: 0, date: day, name: "Tatil", isHalfDay, createdAt: "" };
}
function run(extra: Partial<Parameters<typeof computePdksDay>[0]> = {}) {
  return computePdksDay({ date, shift, readings: [reading("09:00", "entry"), reading("18:00", "exit")], workSettings: DEFAULT_WORK_SETTINGS, ...extra });
}
function minutesByClass(day: ReturnType<typeof run>) {
  return day.overtimeSegments.reduce<Record<string, number>>((minutes, segment) => {
    minutes[segment.classification] = (minutes[segment.classification] ?? 0) + segment.netMinutes;
    return minutes;
  }, {});
}

describe("PDK-004 legacy manual endpoint evidence", () => {
  it.each([undefined, LEGACY_PDKS_POLICY, { ...LEGACY_PDKS_POLICY, punchMode: "requirements" as const, requireCheckIn: true, requireCheckOut: true }])("combines approved entry with one raw exit (%j)", policy => {
    const day = run({ readings: [reading("18:00", "exit")], manual: manual("09:00"), policy });
    expect(day).toMatchObject({ totalMinutes: 480, breakMinutes: 60, rawTotalMinutes: 540, punchQuality: "ok", durationMeasured: true });
    expect(Date.parse(day.firstISO ?? "")).toBe(Date.parse(`${date}T09:00:00+03:00`));
    expect(day.lastISO).toBe(reading("18:00", "exit").accessTime);
  });

  it("also combines a raw entry with a manual exit", () => {
    expect(run({ readings: [reading("09:00", "entry")], manual: manual(undefined, "18:00") }))
      .toMatchObject({ totalMinutes: 480, punchQuality: "ok", durationMeasured: true });
  });

  it.each(["entry", undefined] as const)("does not invent an exit from a single %s punch", direction => {
    expect(run({ readings: [reading("18:00", direction)], manual: manual("09:00") }))
      .toMatchObject({ totalMinutes: 0, lastISO: null, punchQuality: "missingExit" });
  });

  it.each(["08:00", "09:00"])("rejects a raw exit at or before the corrected entry (%s)", time => {
    expect(run({ readings: [reading(time, "exit")], manual: manual("09:00") }))
      .toMatchObject({ totalMinutes: 0, lastISO: null, punchQuality: "missingExit" });
  });

  it.each(["entry", "exit", undefined] as const)("preserves two-reading legacy first/last behavior (%s)", direction => {
    expect(run({ readings: [reading("09:00", direction), reading("18:00", direction)] }))
      .toMatchObject({ totalMinutes: 480, punchQuality: "ok", attendanceDecision: undefined });
  });
});

describe("PDK-006 half-day holiday time portions", () => {
  it.each(["dailyShift", "weekly45"] as const)("pays only 13–18 as holiday work under %s", overtimeBasis => {
    const day = run({ holiday: holiday(), overtimeRates: { ...DEFAULT_OVERTIME_RATES, overtimeBasis }, hourlyRate: 100 });
    expect(day).toMatchObject({ classification: "halfDayHoliday", totalMinutes: 480, overtimeMinutes: 300, overtimePayTRY: 1000 });
    expect(minutesByClass(day)).toEqual({ workday: 180, halfDayHoliday: 300 });
    expect(calculatePeriodOvertime([day], { startDate: date, endDate: date, overtimeBasis, hourlyRate: 100 }))
      .toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 1000 });
  });

  it("keeps morning excess at the weekday rate and holiday minutes out of the weekly allowance", () => {
    const day = run({ holiday: holiday() });
    const prior: OvertimeDay = {
      date: "2026-10-27", totalMinutes: 2640,
      overtimeSegments: [{ netMinutes: 2640, dailyOvertimeMinutes: 0, classification: "workday", multiplier: 1.5, eligible: true }],
    };
    const next = run({ date: "2026-10-30", readings: [reading("09:00", "entry", "2026-10-30"), reading("18:00", "exit", "2026-10-30")] });
    const settled = calculatePeriodOvertime([prior, day, next], { startDate: date, endDate: "2026-10-30", hourlyRate: 100 });
    expect(settled.overtimeByDate[date]).toMatchObject({ overtimeMinutes: 420, overtimePayTRY: 1300 });
    expect(settled.overtimeByDate[next.date]).toMatchObject({ overtimeMinutes: 480, overtimePayTRY: 1200 });
  });

  it("does not let holiday minutes push a later ordinary day over 45 hours", () => {
    const day = run({ holiday: holiday() });
    const prior: OvertimeDay = {
      date: "2026-10-27", totalMinutes: 2460,
      overtimeSegments: [{ netMinutes: 2460, dailyOvertimeMinutes: 0, classification: "workday", multiplier: 1.5, eligible: true }],
    };
    const next = run({ date: "2026-10-30", readings: [reading("09:00", "entry", "2026-10-30"), reading("10:00", "exit", "2026-10-30")] });
    const result = calculatePeriodOvertime([prior, day, next], { startDate: date, endDate: next.date, hourlyRate: 100 });
    expect(result).toMatchObject({ overtimeMinutes: 300, overtimePayTRY: 1000 });
    expect(result.overtimeByDate[next.date].overtimeMinutes).toBe(0);
  });

  it("starts holiday work exactly at 13:00", () => {
    const policy = { ...LEGACY_PDKS_POLICY, calculationMode: "eachPunch" as const };
    const morning = run({ holiday: holiday(), policy, readings: [reading("09:00", "entry"), reading("13:00", "exit")] });
    const afternoon = run({ holiday: holiday(), policy, readings: [reading("13:00", "entry"), reading("18:00", "exit")] });
    expect(minutesByClass(morning)).toEqual({ workday: 240 });
    expect(morning.overtimeMinutes).toBe(0);
    expect(minutesByClass(afternoon)).toEqual({ halfDayHoliday: 300 });
    expect(afternoon.overtimeMinutes).toBe(300);
  });

  it("conserves integer minutes when an unscheduled flexible break is prorated", () => {
    const day = run({ holiday: holiday(), shift: { ...shift, scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE } });
    expect(minutesByClass(day)).toEqual({ workday: 213, halfDayHoliday: 267 });
    expect(day).toMatchObject({ totalMinutes: 480, requiredNetMinutes: 240, overtimeMinutes: 267, shortfallMinutes: 27, excessMinutes: 0 });
  });

  it("retains the rest-day rate before the half-holiday boundary", () => {
    const day = run({ holiday: holiday(), dayKind: "rest", overtimeRates: { ...DEFAULT_OVERTIME_RATES, weekendMultiplier: 2.5, holidayMultiplier: 3 }, hourlyRate: 100 });
    expect(minutesByClass(day)).toEqual({ weekend: 180, halfDayHoliday: 300 });
    expect(day).toMatchObject({ overtimeMinutes: 480, overtimePayTRY: 2250 });
  });

  it("deducts a break spanning 13:00 from its actual portions", () => {
    const day = run({ holiday: holiday(), shift: { ...shift, breakStart: "12:30", breakEnd: "13:30" } });
    expect(minutesByClass(day)).toEqual({ workday: 210, halfDayHoliday: 270 });
    expect(day).toMatchObject({ totalMinutes: 480, overtimeMinutes: 270 });
  });

  it("uses actual paired attendance on each side of the boundary", () => {
    const day = run({ holiday: holiday(), policy: { ...LEGACY_PDKS_POLICY, calculationMode: "eachPunch" }, readings: [
      reading("09:00", "entry"), reading("12:00", "exit"), reading("13:00", "entry"), reading("18:00", "exit"),
    ] });
    expect(minutesByClass(day)).toEqual({ workday: 180, halfDayHoliday: 300 });
    expect(day).toMatchObject({ totalMinutes: 480, breakMinutes: 0, overtimeMinutes: 300 });
  });

  it("uses the same boundary for seeded national and religious half holidays", () => {
    const halves = getTurkishHolidaysForYear(2026).filter(h => h.isHalfDay);
    expect(halves.length).toBeGreaterThan(1);
    for (const h of halves) {
      const day = run({ date: h.date, holiday: { ...holiday(h.date), ...h }, readings: [reading("09:00", "entry", h.date), reading("18:00", "exit", h.date)] });
      expect(minutesByClass(day)).toEqual({ workday: 180, halfDayHoliday: 300 });
    }
  });

  it.each(["shiftStart", "splitAtMidnight"] as const)("uses the next date's holiday class after half-day midnight (%s)", nightShiftDayMode => {
    const nightShift = { ...shift, startTime: "22:00", endTime: "06:00", breakStart: "00:00", breakEnd: "01:00" };
    const extra = { holiday: holiday(), shift: nightShift, readings: [reading("22:00", "entry"), reading("06:00", "exit", "2026-10-29")], overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftDayMode, nightShiftMultiplier: 1 } };
    const fullNext = run({ ...extra, holidayMap: new Map([["2026-10-29", holiday("2026-10-29", false)]]) });
    expect(minutesByClass(fullNext)).toEqual({ halfDayHoliday: 120, holiday: 300 });
    const normalNext = run(extra);
    expect(minutesByClass(normalNext)).toEqual({ halfDayHoliday: 120, workday: 300 });
    expect(normalNext.overtimeMinutes).toBe(120);
  });

  it.each(["shiftStart", "splitAtMidnight"] as const)("does not mark the next half-day morning as holiday (%s)", nightShiftDayMode => {
    const day = run({ date: "2026-10-27", shift: { ...shift, startTime: "22:00", endTime: "14:00", breakStart: "12:00", breakEnd: "13:00" },
      readings: [reading("22:00", "entry", "2026-10-27"), reading("14:00", "exit")],
      holidayMap: new Map([[date, holiday()]]), overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftDayMode },
    });
    expect(minutesByClass(day)).toEqual({ workday: 840, halfDayHoliday: 60 });
    expect(day.overtimeMinutes).toBe(60);
  });

  it("retains overtime-disabled and holiday-work-required settings", () => {
    expect(run({ holiday: holiday(), shift: { ...shift, overtimeEnabled: false } }).overtimeMinutes).toBe(0);
    const normal = run({ holiday: holiday(), shift: { ...shift, holidayWorkRequired: true } });
    expect(normal).toMatchObject({ classification: "workday", overtimeMinutes: 0 });
    expect(minutesByClass(normal)).toEqual({ workday: 480 });
  });
});

describe("Denetim 2 yarım gün sınırı", () => {
  it.each(["rest", "holiday"] as const)("N-04: shiftStart %s primi ve Pazar haftası arife sabahında korunur", kind => {
    const sunday = "2026-10-25", monday = "2026-10-26";
    const day = run({ date: sunday, dayKind: kind === "rest" ? "rest" : "work", nextDayKind: "work",
      holiday: kind === "holiday" ? holiday(sunday, false) : undefined,
      holidayMap: new Map([[monday, holiday(monday)]]),
      shift: { ...shift, startTime: "22:00", endTime: "06:00", breakStart: undefined, breakEnd: undefined },
      policy: { ...LEGACY_PDKS_POLICY, calculationMode: "eachPunch" },
      readings: [reading("22:00", "entry", sunday), reading("06:00", "exit", monday)],
      overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftDayMode: "shiftStart", nightShiftMultiplier: 1 },
    });
    expect(minutesByClass(day)).toEqual({ [kind === "rest" ? "weekend" : "holiday"]: 480 });
    expect(day.overtimeSegments.every(segment => segment.calendarDate === sunday)).toBe(true);
    expect(calculatePeriodOvertime([day], { startDate: sunday, endDate: monday, hourlyRate: 100 }))
      .toMatchObject({ overtimeMinutes: 480, overtimePayTRY: 1600 });
  });

  it.each([
    ["12:00", "18:00", 60, 300, 180, 0],
    ["13:00", "18:00", 0, 300, 240, 0],
    ["08:00", "18:00", 300, 300, 0, 60],
  ] as const)("N-05: esnek %s–%s hedefini yalnız tatil öncesi dakika doldurur", (entry, exit, normal, premium, shortfall, excess) => {
    const day = run({ holiday: holiday(),
      shift: { ...shift, scheduleType: "flexible", flexible: { ...DEFAULT_FLEXIBLE, breakMinutes: 0 } },
      readings: [reading(entry, "entry"), reading(exit, "exit")],
    });
    expect(day).toMatchObject({ requiredNetMinutes: 240, totalMinutes: normal + premium, shortfallMinutes: shortfall, excessMinutes: excess });
    expect(minutesByClass(day).halfDayHoliday).toBe(premium);
  });
});
