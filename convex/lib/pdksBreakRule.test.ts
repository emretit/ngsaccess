import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { legalBreakMinutes } from "./breakDeduction";
import { computePdksDay } from "./pdksDay";
import { DEFAULT_FLEXIBLE } from "./pdksFlexible";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { computePdksPlannedDay } from "./pdksMultiShift";
import { LEGACY_PDKS_POLICY } from "./pdksRules";

// Historical days intentionally use the same rule as current days.
const date = "2024-01-15";
const shift: Doc<"shifts"> = {
  _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Gündüz",
  startTime: "09:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00",
  createdAt: "", updatedAt: "",
};
function reading(time: string, direction: "entry" | "exit", day = date): Doc<"cardReadings"> {
  return { _id: `${day}-${time}-${direction}` as Id<"cardReadings">, _creationTime: 0,
    cardNo: "1", accessStatus: "izin_verildi", direction,
    accessTime: new Date(`${day}T${time}:00+03:00`).toISOString() };
}
function visits(gap?: readonly [string, string]) {
  return [reading("09:00", "entry"), ...(gap ? [reading(gap[0], "exit"), reading(gap[1], "entry")] : []), reading("17:00", "exit")];
}
function run(mode: "firstLast" | "eachPunch", readings = visits(), extra: Partial<Doc<"shifts">> = {}) {
  return computePdksDay({ date, readings, shift: { ...shift, ...extra },
    workSettings: DEFAULT_WORK_SETTINGS, policy: { ...LEGACY_PDKS_POLICY, calculationMode: mode } });
}
function conserved(day: Pick<ReturnType<typeof computePdksDay>, "overtimeSegments" | "totalMinutes" | "rawTotalMinutes" | "breakMinutes">) {
  expect(day.overtimeSegments.reduce((sum, part) => sum + part.netMinutes, 0)).toBe(day.totalMinutes);
  expect(day.rawTotalMinutes - day.breakMinutes).toBe(day.totalMinutes);
}
const noBreak = { breakStart: undefined, breakEnd: undefined };

describe.each(["firstLast", "eachPunch"] as const)("mola kuralı %s", mode => {
  it("deducts the planned hour despite an unrelated one-minute exit", () => {
    const day = run(mode, visits(["11:00", "11:01"]));
    expect(day).toMatchObject({ breakMinutes: 60, totalMinutes: mode === "eachPunch" ? 419 : 420 });
    conserved(day);
  });
  it("counts the lunch gap only once", () => {
    const day = run(mode, visits(["12:10", "12:40"]));
    expect(day).toMatchObject({ rawTotalMinutes: mode === "eachPunch" ? 450 : 480,
      breakMinutes: mode === "eachPunch" ? 30 : 60, totalMinutes: 420 });
    conserved(day);
  });
  it("deducts a legal hour for an undefined break and an eight-hour visit", () => {
    expect(run(mode, visits(), noBreak)).toMatchObject({ rawTotalMinutes: 480, breakMinutes: 60, totalMinutes: 420 });
  });
  it("credits a twenty-minute exit against an undefined legal break", () => {
    const day = run(mode, visits(["11:00", "11:20"]), noBreak);
    expect(day).toMatchObject({ rawTotalMinutes: mode === "eachPunch" ? 460 : 480,
      breakMinutes: mode === "eachPunch" ? 40 : 60, totalMinutes: 420 });
    conserved(day);
  });
  it.each([noBreak, {}, { scheduleType: "flexible" as const, flexible: DEFAULT_FLEXIBLE }])("does not assume a break for missing endpoints (%j)", extra => {
    for (const punches of [[reading("09:00", "entry")], [reading("17:00", "exit")]]) {
      expect(run(mode, punches, extra).breakMinutes).toBe(0);
    }
  });
  it("deducts only the still-unrecorded part of a flexible duration break", () => {
    const day = run(mode, visits(["12:10", "12:40"]), { scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE });
    expect(day).toMatchObject({ breakMinutes: mode === "eachPunch" ? 30 : 60, totalMinutes: 420 });
    conserved(day);
  });
});

it("preserves the legal helper's exact thresholds", () => {
  expect([0, 1, 240, 241, 450, 451, 480].map(legalBreakMinutes)).toEqual([0, 15, 15, 30, 30, 60, 60]);
});
it.each([{}, noBreak, { scheduleType: "flexible" as const, flexible: DEFAULT_FLEXIBLE }])("adds no break when a day includes a closed visit and an unmatched side (%j)", extra => {
  expect(run("eachPunch", [reading("09:00", "entry"), reading("14:00", "exit"), reading("15:00", "entry")], extra))
    .toMatchObject({ rawTotalMinutes: 300, breakMinutes: 0, totalMinutes: 300, punchQuality: "missingExit" });
  // Flexible schedules discard exits before the accepted entry window.
  if (!("scheduleType" in extra)) expect(run("eachPunch", [reading("08:00", "exit"), reading("09:00", "entry"), reading("17:00", "exit")], extra))
    .toMatchObject({ rawTotalMinutes: 480, breakMinutes: 0, totalMinutes: 480, punchQuality: "missingEntry" });
});
it("never deducts a negative remainder when outside time exceeds the legal break", () => {
  expect(run("eachPunch", visits(["11:00", "13:00"]), noBreak))
    .toMatchObject({ rawTotalMinutes: 360, breakMinutes: 0, totalMinutes: 360 });
});
it("deducts no scheduled break when the entire window was spent outside", () => {
  expect(run("eachPunch", visits(["11:30", "13:30"])))
    .toMatchObject({ rawTotalMinutes: 360, breakMinutes: 0, totalMinutes: 360 });
});
it("credits recorded exits in flexible mode", () => {
  const day = run("eachPunch", visits(["11:00", "11:20"]), { scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE });
  expect(day).toMatchObject({ rawTotalMinutes: 460, breakMinutes: 40, totalMinutes: 420 });
  conserved(day);
});
it("locates night break deductions inside the actual worked portions", () => {
  const day = computePdksDay({ date, shift: { ...shift, startTime: "22:00", endTime: "06:00", breakStart: "23:30", breakEnd: "00:30" },
    readings: [reading("22:00", "entry"), reading("23:45", "exit"), reading("00:15", "entry", "2024-01-16"), reading("06:00", "exit", "2024-01-16")],
    policy: { ...LEGACY_PDKS_POLICY, calculationMode: "eachPunch" }, workSettings: DEFAULT_WORK_SETTINGS,
    overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftDayMode: "splitAtMidnight", nightShiftStart: "22:00", nightShiftEnd: "06:00" } });
  expect(day).toMatchObject({ rawTotalMinutes: 450, breakMinutes: 30, totalMinutes: 420, nightMinutes: 420 });
  expect(day.overtimeSegments.filter(part => part.calendarDate === date).reduce((sum, part) => sum + part.netMinutes, 0)).toBe(90);
  conserved(day);
});
it.each(["firstLast", "eachPunch"] as const)("applies the rule per piece of a multiple-shift day (%s)", calculationMode => {
  const second: Doc<"shifts"> = { ...shift, _id: "night" as Id<"shifts">, startTime: "18:00", endTime: "02:00", breakStart: "23:00", breakEnd: "00:00" };
  const day = computePdksPlannedDay({ date, shift, workSettings: DEFAULT_WORK_SETTINGS,
    policy: { ...LEGACY_PDKS_POLICY, calculationMode },
    dayPlan: { kind: "shifts", source: "employee", origin: "cycle", calendar: "plan", shifts: [shift, second] },
    readings: [...visits(["12:10", "12:40"]), reading("18:00", "entry"), reading("23:10", "exit"), reading("23:40", "entry"), reading("02:00", "exit", "2024-01-16")] });
  expect(day).toMatchObject({ totalMinutes: 840, breakMinutes: calculationMode === "eachPunch" ? 60 : 120 });
  expect(day.segments?.map(part => part.totalMinutes)).toEqual([420, 420]);
  conserved(day);
});
it("conserves whole minutes for second-precision visits and a partial scheduled break", () => {
  const punches = visits(["12:10", "12:40"]);
  punches[0] = { ...punches[0], accessTime: new Date(`${date}T09:00:20+03:00`).toISOString() };
  const day = run("eachPunch", punches);
  expect(day).toMatchObject({ rawTotalMinutes: 449, breakMinutes: 30, totalMinutes: 419 });
  conserved(day);
});

it.each([
  ["08:00:30", "11:00:10", 179, 0, 179],
  ["08:00:30", "12:30:10", 269, 30, 239],
  ["12:30:30", "17:00:15", 269, 29, 240],
] as const)("uses timestamp precision for legacy scheduled breaks %s–%s", (start, end, raw, pause, net) => {
  const punches = [reading("08:00", "entry"), reading("17:00", "exit")].map((punch, index) => ({
    ...punch, accessTime: new Date(`${date}T${index === 0 ? start : end}+03:00`).toISOString(),
  }));
  const day = run("firstLast", punches);
  expect(day).toMatchObject({ rawTotalMinutes: raw, breakMinutes: pause, totalMinutes: net });
  expect(day.breakMinutes).toBeGreaterThanOrEqual(0);
  expect(day.totalMinutes).toBeLessThanOrEqual(day.rawTotalMinutes);
  conserved(day);
});
