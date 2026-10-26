import { describe, expect, it } from "vitest";
import { pairPdksPunches, pdksPairReadings, pdksPunchSegments } from "./pdksPunchPairs";
import { computePdksDay } from "./pdksDay";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { LEGACY_PDKS_POLICY, type PdksDayPolicy } from "./pdksRules";
import { DEFAULT_FLEXIBLE } from "./pdksFlexible";
import type { Doc, Id } from "../_generated/dataModel";
const date = "2026-10-23";
const iso = (time: string) => `${date}T${time.length === 5 ? `${time}:00` : time}+03:00`;
const punch = (time: string, direction?: string) => ({ accessTime: iso(time), direction });
const readings = (...punches: ReturnType<typeof punch>[]): Doc<"cardReadings">[] => punches.map((p, i) => ({ ...p, direction: p.direction === "entry" || p.direction === "exit" ? p.direction : undefined, _id: String(i) as Id<"cardReadings">, _creationTime: 0, cardNo: "TEST", accessStatus: "izin_verildi" }));
const policy: PdksDayPolicy = { ...LEGACY_PDKS_POLICY, calculationMode: "eachPunch" };
function run(items: Doc<"cardReadings">[], extra: Partial<Parameters<typeof computePdksDay>[0]> = {}) {
  return computePdksDay({ date, policy, readings: items, shift: null, workingDays: ["Cuma"], workSettings: DEFAULT_WORK_SETTINGS, ...extra });
}
describe("effective punch pairing", () => {
  it("sums visits, ignores same-direction repeats and leaves input intact", () => {
    const items = [punch("08:00", "entry"), punch("08:00:30", "entry"), punch("12:00", "exit"), punch("13:00", "entry"), punch("17:00", "exit")];
    const before = structuredClone(items);
    expect(pairPdksPunches(items)).toMatchObject({ totalMinutes: 480, pairs: [{ entryISO: iso("08:00"), exitISO: iso("12:00") }, { entryISO: iso("13:00"), exitISO: iso("17:00") }], missingEntry: false, missingExit: false });
    expect(items).toEqual(before);
  });
  it("flags orphan exits and unclosed entries without inventing duration", () => {
    expect(pairPdksPunches([punch("07:00", "exit"), punch("08:00", "entry")])).toMatchObject({ pairs: [], totalMinutes: 0, missingEntry: true, missingExit: true });
    expect(pairPdksPunches([punch("08:00", "entry"), punch("09:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry")])).toMatchObject({ totalMinutes: 240, missingExit: true });
  });
  it("alternates undirected punches, debounce uses consecutive repeats, boundary is inclusive", () => {
    const items = [punch("08:00"), punch("08:00:30"), punch("12:00"), punch("13:00"), punch("17:00")];
    expect(pairPdksPunches(items).totalMinutes).toBe(480);
    expect(pairPdksPunches([punch("08:00"), punch("08:01")], 1).totalMinutes).toBe(1);
    expect(pairPdksPunches([punch("08:00"), punch("08:01")], 2)).toMatchObject({ totalMinutes: 0, missingExit: true });
    expect(pairPdksPunches([punch("08:00"), punch("08:00:30")], 0).missingExit).toBe(false);
    expect(pairPdksPunches([punch("08:00", "entry"), punch("08:00:30", "exit")], 60)).toMatchObject({ pairs: [{ entryISO: iso("08:00"), exitISO: iso("08:00:30") }], missingExit: false });
  });
  it("manual endpoints preserve interior visits and can complete a single directed side", () => {
    expect(pairPdksPunches(pdksPairReadings([punch("12:00", "exit")], { entryISO: iso("08:00") })).totalMinutes).toBe(240);
    expect(pairPdksPunches(pdksPairReadings([], { entryISO: iso("08:00"), exitISO: iso("17:00") })).totalMinutes).toBe(540);
    expect(pairPdksPunches(pdksPairReadings([punch("08:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry"), punch("17:00", "exit")], { entryISO: iso("09:00"), exitISO: iso("18:00") })).totalMinutes).toBe(480);
  });
  it("manual endpoints resolve undirected punches before replacing a side", () => {
    const pair = (raw: ReturnType<typeof punch>[], manual: { entryISO?: string; exitISO?: string }) => pairPdksPunches(pdksPairReadings(raw, manual));
    expect(pair([punch("08:00")], { exitISO: iso("18:00") })).toMatchObject({ totalMinutes: 600, missingEntry: false, missingExit: false });
    expect(pair([punch("08:00"), punch("12:00"), punch("13:00")], { exitISO: iso("18:00") })).toMatchObject({ totalMinutes: 540, missingEntry: false, missingExit: false });
    expect(pair([punch("08:00"), punch("12:00"), punch("13:00"), punch("17:05")], { exitISO: iso("17:00") })).toMatchObject({ totalMinutes: 480, missingExit: false });
    expect(pair([punch("17:00")], { entryISO: iso("08:00") })).toMatchObject({ totalMinutes: 540, missingEntry: false, missingExit: false });
    // Forgotten entry: every raw punch is kept and alternates after the manual entry.
    expect(pair([punch("12:00"), punch("13:00"), punch("17:00")], { entryISO: iso("08:00") })).toMatchObject({ totalMinutes: 480, missingExit: false });
    // Corrected entry: the first raw punch is replaced.
    expect(pair([punch("08:10"), punch("12:00"), punch("13:00"), punch("17:00")], { entryISO: iso("08:00") })).toMatchObject({ totalMinutes: 480, missingExit: false });
    expect(pair([punch("07:58"), punch("12:00"), punch("13:00"), punch("17:00")], { entryISO: iso("08:00"), exitISO: iso("17:30") })).toMatchObject({ totalMinutes: 510, missingEntry: false, missingExit: false });
    // Known limit of undirected data: both readings are complete, so the tie keeps the replacement (12:00 → 08:00).
    expect(pair([punch("12:00"), punch("13:00"), punch("17:00")], { entryISO: iso("08:00"), exitISO: iso("18:00") })).toMatchObject({ totalMinutes: 360, missingEntry: false, missingExit: false });
    expect(pair([punch("08:10"), punch("12:00"), punch("13:00"), punch("17:00")], { entryISO: iso("08:00"), exitISO: iso("17:30") })).toMatchObject({ totalMinutes: 510, missingExit: false });
  });
  it("debounces against the last accepted punch, not a chain of skipped repeats", () => {
    expect(pairPdksPunches([punch("08:00"), punch("08:00:40"), punch("08:01:20"), punch("08:02")], 1)).toMatchObject({ pairs: [{ entryISO: iso("08:00"), exitISO: iso("08:01:20") }], missingExit: false });
  });
});
it("day retains display endpoints, skips double breaks and excludes gaps from overtime/night", () => {
  const day = run(readings(punch("08:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry"), punch("17:00", "exit")));
  expect(day).toMatchObject({ firstISO: iso("08:00"), lastISO: iso("17:00"), totalMinutes: 480, rawTotalMinutes: 480, breakMinutes: 0, punchQuality: "ok", hasAttendance: true });
  const late = run(readings(punch("17:00", "entry"), punch("18:00", "exit"), punch("22:00", "entry"), punch("23:00", "exit")), { overtimeRates: { ...DEFAULT_OVERTIME_RATES, nightShiftStart: "20:00", nightShiftEnd: "06:00" } });
  expect(late).toMatchObject({ totalMinutes: 120, nightMinutes: 60, rawNightMinutes: 60 });
  expect(late.overtimeSegments.reduce((sum, s) => sum + s.netMinutes, 0)).toBe(120);
  expect(late.overtimeMinutes).toBeLessThanOrEqual(120);
});
it("missing required exit affects decision even after a completed pair; absent/review remain configurable", () => {
  const items = readings(punch("08:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry"));
  expect(run(items)).toMatchObject({ totalMinutes: 240, punchQuality: "missingExit", attendanceDecision: "incomplete", hasAttendance: false });
  expect(run(items, { policy: { ...policy, missingRequiredPunch: "absent" } })).toMatchObject({ attendanceDecision: "absent" });
  expect(run(items, { policy: { ...policy, requireCheckOut: false } })).toMatchObject({ attendanceDecision: "present" });
  expect(run([])).toMatchObject({ attendanceDecision: "absent", totalMinutes: 0 });
});
it("flexible target and overtime use pair totals without deducting a second break", () => {
  const shift: Doc<"shifts"> = { _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Esnek", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", flexible: { ...DEFAULT_FLEXIBLE }, createdAt: "", updatedAt: "", overtimeStartToleranceMinutes: 0 };
  expect(run(readings(punch("08:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry"), punch("18:00", "exit")), { shift })).toMatchObject({ totalMinutes: 540, shortfallMinutes: 0, excessMinutes: 60, overtimeMinutes: 60, breakMinutes: 0 });
});
it("explicit firstLast and missing mode produce identical day objects", () => {
  const items = readings(punch("08:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry"), punch("17:00", "exit"));
  expect(run(items, { policy: LEGACY_PDKS_POLICY })).toEqual(run(items, { policy: { ...LEGACY_PDKS_POLICY, calculationMode: "firstLast", minPunchIntervalMinutes: 60 } }));
});
it("eachPunch requirements accepts undirected flexible pairs", () => {
  const shift: Doc<"shifts"> = { _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Esnek", startTime: "05:00", endTime: "22:00", scheduleType: "flexible", flexible: { ...DEFAULT_FLEXIBLE }, createdAt: "", updatedAt: "" };
  const items = readings(punch("08:00"), punch("12:00"), punch("13:00"), punch("17:00"));
  expect(run(items, { shift, policy: { ...policy, punchMode: "requirements", requireCheckIn: true, requireCheckOut: true } })).toMatchObject({ totalMinutes: 480, attendanceDecision: "present", durationMeasured: true, punchQuality: "ok" });
});
it("fractional punches conserve whole minutes in overtime segments", () => {
  const day = run(readings(punch("08:00:45", "entry"), punch("08:01:30", "exit"), punch("09:00:30", "entry"), punch("09:01:15", "exit")));
  expect(day.totalMinutes).toBe(1);
  expect(day.overtimeSegments.reduce((sum, part) => sum + part.netMinutes, 0)).toBe(1);
});

it("optional missing side preserves attendance credit without inventing a measured duration", () => {
  expect(run(readings(punch("08:00", "entry")), { policy: { ...policy, requireCheckOut: false } })).toMatchObject({ attendanceDecision: "present", durationMeasured: false, totalMinutes: 0, punchQuality: "missingExit" });
  expect(run(readings(punch("17:00", "exit")), { policy: { ...policy, requireCheckIn: false } })).toMatchObject({ attendanceDecision: "present", durationMeasured: false, totalMinutes: 0, punchQuality: "missingEntry" });
});

describe("display punch segments", () => {
  it("shows zero, one and two breaks, resolving undirected and debounced readings", () => {
    const items = [punch("08:00"), punch("08:00:30"), punch("12:02"), punch("12:48"), punch("15:10"), punch("15:25"), punch("17:00")];
    expect(pdksPunchSegments(pdksPairReadings(items.slice(0, 3))).breakMinutes).toBe(0);
    expect(pdksPunchSegments(pdksPairReadings(items.slice(0, 5)))).toMatchObject({ breakMinutes: 46, breaks: [{ startISO: iso("12:02"), endISO: iso("12:48"), minutes: 46 }] });
    expect(pdksPunchSegments(pdksPairReadings(items))).toMatchObject({ breakMinutes: 61, breaks: [{ minutes: 46 }, { minutes: 15 }] });
  });
  it("keeps orphan sides without producing breaks and omits subminute gaps", () => {
    expect(pdksPunchSegments([punch("07:00", "exit"), punch("08:00", "entry")])).toEqual({ pairs: [{ entryISO: null, exitISO: iso("07:00") }, { entryISO: iso("08:00"), exitISO: null }], breaks: [], breakMinutes: 0 });
    const items = [punch("08:00", "entry"), punch("12:00", "exit"), punch("12:00:30", "entry"), punch("17:00", "exit")];
    expect(pdksPunchSegments(items).breaks).toEqual([]);
    expect(pdksPunchSegments(items.slice(0, 3)).breaks).toEqual([]);
  });
  it("measures the break across a stray one-sided punch between two visits", () => {
    const items = [punch("09:00", "entry"), punch("12:00", "exit"), punch("12:30", "exit"), punch("13:00", "entry"), punch("17:00", "exit")];
    expect(pdksPunchSegments(items)).toMatchObject({
      pairs: [{ entryISO: iso("09:00"), exitISO: iso("12:00") }, { entryISO: null, exitISO: iso("12:30") }, { entryISO: iso("13:00"), exitISO: iso("17:00") }],
      breaks: [{ startISO: iso("12:00"), endISO: iso("13:00"), minutes: 60 }], breakMinutes: 60,
    });
  });
  it("uses the replaced manual endpoints and preserves interior gaps", () => {
    const items = [punch("08:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry"), punch("17:00", "exit")];
    expect(pdksPunchSegments(pdksPairReadings(items, { entryISO: iso("09:00"), exitISO: iso("18:00") }))).toMatchObject({ pairs: [{ entryISO: iso("09:00"), exitISO: iso("12:00") }, { entryISO: iso("13:00"), exitISO: iso("18:00") }], breakMinutes: 60 });
  });
  it("retains the real dates across midnight", () => {
    const next = (time: string) => `2026-10-24T${time}:00+03:00`;
    const items = [punch("22:00", "entry"), { accessTime: next("02:00"), direction: "exit" }, { accessTime: next("02:30"), direction: "entry" }, { accessTime: next("06:00"), direction: "exit" }];
    expect(pdksPunchSegments(items)).toMatchObject({ breakMinutes: 30, breaks: [{ startISO: next("02:00"), endISO: next("02:30"), minutes: 30 }] });
  });
  it("adds display evidence in both modes without changing the original calculation", () => {
    const items = readings(punch("08:00", "entry"), punch("12:00", "exit"), punch("13:00", "entry"), punch("17:00", "exit"));
    for (const calculationMode of ["firstLast", "eachPunch"] as const) {
      const options = { policy: { ...policy, calculationMode } };
      const { punchSegments, ...withDisplay } = run(items, { ...options, includePunchSegments: true });
      expect(withDisplay).toEqual(run(items, options));
      expect(punchSegments?.breakMinutes).toBe(60);
    }
  });
});
