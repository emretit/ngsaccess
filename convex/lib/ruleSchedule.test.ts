import { describe, expect, it } from "vitest";
import { isRuleOpenAt } from "./ruleSchedule";
import { defaultRuleSchedule } from "./hikSync";

const rule = { days: ["Monday"], startTime: "09:00", endTime: "17:00" };
const at = (time: string) => Date.parse(`2026-06-22T${time}+03:00`);
describe("isRuleOpenAt mirrors Hik local schedule", () => {
  it.each([
    ["08:59:59.999", false], ["09:00:00", true], ["12:00:00", true],
    ["17:00:00", true], ["17:00:59.999", true], ["17:01:00", false],
  ])("boundary %s -> %s", (time, expected) => {
    expect(isRuleOpenAt(rule, at(time))).toBe(expected);
  });
  it("matches the device's final-second encoding", () => {
    expect(defaultRuleSchedule(rule)).toEqual([{ week: "Monday", beginTime: "09:00:00", endTime: "17:00:59" }]);
  });
  it("rejects another weekday", () => {
    expect(isRuleOpenAt(rule, Date.parse("2026-06-23T12:00:00+03:00"))).toBe(false);
  });
  it("defaults missing and empty days/times to 24/7", () => {
    for (const empty of [{}, { days: [] }, { days: [""], startTime: " ", endTime: "" }]) {
      expect(isRuleOpenAt(empty, at("00:00:00"))).toBe(true);
      expect(isRuleOpenAt(empty, at("23:59:59.999"))).toBe(true);
    }
  });
  it("defaults each missing time independently", () => {
    expect(isRuleOpenAt({ startTime: "09:00" }, at("23:59:00"))).toBe(true);
    expect(isRuleOpenAt({ endTime: "17:00" }, at("00:00:00"))).toBe(true);
  });
  it("uses Istanbul weekday across UTC midnight", () => {
    expect(isRuleOpenAt({ days: ["Monday"] }, Date.parse("2026-06-21T20:59:59Z"))).toBe(false);
    expect(isRuleOpenAt({ days: ["Monday"] }, Date.parse("2026-06-21T21:00:00Z"))).toBe(true);
    expect(isRuleOpenAt({ days: ["Monday"] }, Date.parse("2026-06-22T21:00:00Z"))).toBe(false);
  });
  it("fails closed for malformed/overnight schedules", () => {
    for (const invalid of [{ days: ["monday"] }, { startTime: "bad" }, { endTime: "25:00" }, { startTime: "22:00", endTime: "06:00" }]) {
      expect(isRuleOpenAt(invalid, at("12:00:00"))).toBe(false);
    }
    expect(isRuleOpenAt({}, NaN)).toBe(false);
  });
});
