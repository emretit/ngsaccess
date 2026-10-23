import { describe, expect, it } from "vitest";
import { pairPdksPunches, pdksPairReadings } from "./pdksPunchPairs";
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
