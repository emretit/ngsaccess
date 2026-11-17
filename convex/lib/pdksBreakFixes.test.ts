import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { computePdksDay } from "./pdksDay";
import { DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { LEGACY_PDKS_POLICY } from "./pdksRules";
const date = "2026-12-31";
const shift: Doc<"shifts"> = { _id: "s" as Id<"shifts">, _creationTime: 0, name: "Gece", startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "" };
function reading(day: string, time: string, direction: "entry" | "exit"): Doc<"cardReadings"> {
  return { _id: `${day}${time}` as Id<"cardReadings">, _creationTime: 0, cardNo: "e", accessStatus: "izin_verildi", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), direction };
}
function run(start: string, pause: { breakStart: string; breakEnd: string } | undefined, calculationMode: "firstLast" | "eachPunch", readings = [reading(date, start, "entry"), reading("2027-01-01", "06:00", "exit")]) {
  return computePdksDay({ date, shift: { ...shift, ...pause }, readings, policy: { ...LEGACY_PDKS_POLICY, calculationMode }, workSettings: DEFAULT_WORK_SETTINGS });
}
describe.each(["firstLast", "eachPunch"] as const)("B1 scheduled breaks %s", mode => {
  it("a planned break that ended before entry deducts zero", () => {
    expect(run("23:45", { breakStart: "22:30", breakEnd: "23:30" }, mode)).toMatchObject({ rawTotalMinutes: 375, breakMinutes: 0, totalMinutes: 375 });
  });
  it.each([["23:00", "23:30", 30], ["23:30", "00:30", 60], ["02:00", "03:00", 60]] as const)("overlap %s–%s deducts %s", (breakStart, breakEnd, minutes) => {
    expect(run("22:00", { breakStart, breakEnd }, mode)).toMatchObject({ rawTotalMinutes: 480, breakMinutes: minutes, totalMinutes: 480 - minutes });
  });
  it("a midnight break partially overlaps attendance", () => {
    expect(run("23:45", { breakStart: "23:30", breakEnd: "00:30" }, mode)).toMatchObject({ breakMinutes: 45, totalMinutes: 330 });
  });
});
it("B2 deliberately preserves automatic-break semantics of both calculation modes", () => {
  expect(run("22:00", undefined, "firstLast")).toMatchObject({ breakMinutes: 60, totalMinutes: 420 });
  expect(run("22:00", undefined, "eachPunch")).toMatchObject({ breakMinutes: 0, totalMinutes: 480 });
});
it("a recorded hour between night visits is never deducted again", () => {
  expect(run("22:00", { breakStart: "02:00", breakEnd: "03:00" }, "eachPunch", [reading(date, "22:00", "entry"), reading("2027-01-01", "02:00", "exit"), reading("2027-01-01", "03:00", "entry"), reading("2027-01-01", "06:00", "exit")])).toMatchObject({ rawTotalMinutes: 420, breakMinutes: 0, totalMinutes: 420 });
});
