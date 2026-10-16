import { describe, expect, it } from "vitest";
import { averageTRTime, summarizeDailyReadings } from "./dashboardActivity";

describe("averageTRTime", () => {
  it("returns null for an empty list", () => {
    expect(averageTRTime([])).toBeNull();
  });
  it("converts a single UTC timestamp to Istanbul time across midnight", () => {
    expect(averageTRTime(["2026-10-14T22:12:00.000Z"])).toBe("01:12");
  });
  it("averages local clock minutes rather than calendar dates", () => {
    expect(averageTRTime(["2026-10-15T05:00:00Z", "2026-10-15T06:00:00Z"])).toBe("08:30");
  });
});

describe("summarizeDailyReadings", () => {
  it("does not fabricate an exit for a single entry", () => {
    expect(summarizeDailyReadings([{ employeeId: "a", accessTime: "2026-10-15T06:00:00Z", direction: "entry" }]))
      .toEqual({ averageFirstEntry: "09:00", averageLastExit: null, insideBuilding: 1 });
  });
  it("uses each employee's first entry and last explicit exit even when unsorted", () => {
    expect(summarizeDailyReadings([
      { employeeId: "a", accessTime: "2026-10-15T15:00:00Z", direction: "exit" },
      { employeeId: "a", accessTime: "2026-10-15T10:00:00Z", direction: "entry" },
      { employeeId: "a", accessTime: "2026-10-15T05:00:00Z", direction: "entry" },
      { employeeId: "b", accessTime: "2026-10-15T06:00:00Z", direction: "entry" },
      { employeeId: "a", accessTime: "2026-10-15T09:00:00Z", direction: "exit" },
    ])).toEqual({ averageFirstEntry: "08:30", averageLastExit: "18:00", insideBuilding: 1 });
  });
  it("keeps legacy readings in arrival averages without inventing an exit or inside status", () => {
    expect(summarizeDailyReadings([{ employeeId: "a", accessTime: "2026-10-15T06:00:00Z" }]))
      .toEqual({ averageFirstEntry: "09:00", averageLastExit: null, insideBuilding: 0 });
  });
});
