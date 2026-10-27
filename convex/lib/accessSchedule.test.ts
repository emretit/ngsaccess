import { describe, expect, it, vi } from "vitest";
import { emptyWeek, normalizeWeek, splitOvernight, effectiveSchedule, isAllowedAt, toHikWeekSchedule, toIdePermissionSegments, WEEKDAYS } from "./accessSchedule";
import { defaultRuleSchedule } from "./hikSync";
import { isRuleOpenAt } from "./ruleSchedule";
const wire = vi.hoisted(() => ({ send: vi.fn(async (..._args: unknown[]) => ({ ok: true })) }));
vi.mock("./gateway/core", () => ({ gatewayApiCallChecked: wire.send }));
import { setWeekPlanOnDevice } from "./gateway/scheduling";

describe("shared weekly access schedule", () => {
  it("sorts and merges overlapping and adjacent intervals without mutating input", () => {
    const week = emptyWeek();
    week.Monday = [{ start: "13:00", end: "17:00" }, { start: "08:00", end: "12:00" }, { start: "11:00", end: "13:00" }];
    expect(normalizeWeek(week).Monday).toEqual([{ start: "08:00", end: "17:00" }]);
    expect(week.Monday).toHaveLength(3);
  });
  it("rejects ninth disjoint interval, invalid format, reversed and equal endpoints", () => {
    const week = emptyWeek();
    week.Monday = Array.from({ length: 9 }, (_, i) => ({ start: `${String(i * 2).padStart(2, "0")}:00`, end: `${String(i * 2 + 1).padStart(2, "0")}:00` }));
    expect(() => normalizeWeek(week)).toThrow("8");
    expect(() => toHikWeekSchedule(week)).toThrow("8");
    for (const interval of [{ start: "8:00", end: "12:00" }, { start: "24:00", end: "24:00" }, { start: "12:00", end: "11:00" }, { start: "12:00", end: "12:00" }]) expect(() => normalizeWeek({ ...emptyWeek(), Monday: [interval] })).toThrow();
  });
  it("splits overnight across Sunday to Monday, preserves 24:00 and skips empty next day", () => {
    expect(splitOvernight("Sunday", "22:00", "06:00")).toMatchObject({ Sunday: [{ start: "22:00", end: "24:00" }], Monday: [{ start: "00:00", end: "06:00" }] });
    expect(splitOvernight("Monday", "22:00", "00:00").Tuesday).toEqual([]);
    expect(toHikWeekSchedule(splitOvernight("Monday", "22:00", "24:00"))[0].endTime).toBe("24:00:00");
  });
  it("closes an invalid-day rule including all 56 Hik segments", async () => {
    const week = effectiveSchedule({ days: ["invalid"] });
    expect(isAllowedAt(week, Date.parse("2026-10-19T09:00:00Z"))).toBe(false);
    await setWeekPlanOnDevice("index", 3, toHikWeekSchedule(week));
    expect(wire.send.mock.calls[0]?.[2]).toMatchObject({ UserRightWeekPlanCfg: { WeekPlanCfg: expect.arrayContaining([expect.objectContaining({ enable: false })]) } });
    const payload: unknown = wire.send.mock.calls[0]?.[2];
    expect(JSON.stringify(payload).match(/"enable":false/g)).toHaveLength(56);
  });
  it("matches legacy adapter output and W4.0 cloud minute decisions", () => {
    for (const rule of [{}, { days: [] }, { days: ["Monday"], startTime: "08:00", endTime: "17:00" }, { days: ["bad"] }]) {
      const week = effectiveSchedule(rule);
      expect(toHikWeekSchedule(week)).toEqual(defaultRuleSchedule(rule));
      for (const time of ["04:59", "05:00", "14:00", "14:01", "20:59"]) {
        const now = Date.parse(`2026-10-19T${time}:59Z`);
        expect(isAllowedAt(week, now)).toBe(isRuleOpenAt(rule, now));
      }
    }
    expect(defaultRuleSchedule({})).toHaveLength(7);
    expect(defaultRuleSchedule({ days: ["Monday"] })).toEqual([{ week: "Monday", beginTime: "00:00:00", endTime: "23:59:59" }]);
  });
  it("uses Istanbul and inclusive final minute; midnight belongs to next day", () => {
    const week = { ...emptyWeek(), Monday: [{ start: "08:00", end: "17:00" }] };
    expect(isAllowedAt(week, Date.parse("2026-10-19T04:59:59Z"))).toBe(false);
    expect(isAllowedAt(week, Date.parse("2026-10-19T05:00:00Z"))).toBe(true);
    expect(isAllowedAt(week, Date.parse("2026-10-19T14:00:59Z"))).toBe(true);
    expect(isAllowedAt(week, Date.parse("2026-10-19T14:01:00Z"))).toBe(false);
    const midnight = splitOvernight("Monday", "22:00", "24:00");
    expect(isAllowedAt(midnight, Date.parse("2026-10-19T20:59:59Z"))).toBe(true);
    expect(isAllowedAt(midnight, Date.parse("2026-10-19T21:00:00Z"))).toBe(false);
    expect(isAllowedAt(week, NaN)).toBe(false);
  });
  it("groups identical pairs using Sunday=0; maps 24:00 to 1439; rejects K>8", () => {
    const week = emptyWeek();
    week.Monday = week.Sunday = [{ start: "08:00", end: "24:00" }];
    expect(toIdePermissionSegments(week)).toEqual([{ start: 480, end: 1439, week_days: [0, 1] }]);
    for (const [i, day] of WEEKDAYS.entries()) week[day] = [{ start: `0${i}:00`, end: `0${i}:30` }, { start: `${i + 10}:00`, end: `${i + 10}:30` }];
    expect(() => toIdePermissionSegments(week)).toThrow("8");
  });
  it("never silently truncates a gateway day", async () => {
    const entries = Array.from({ length: 9 }, () => ({ week: "Monday" as const, beginTime: "08:00:00", endTime: "09:00:59" }));
    await expect(setWeekPlanOnDevice("index", 2, entries)).rejects.toThrow("8");
  });
});
