import { describe, expect, it } from "vitest";
import { summarizePdksRecords } from "./pdksSummary";

type Row = Parameters<typeof summarizePdksRecords>[0][number];
type Day = Row["days"][number];
const row = (status: Row["status"], overtimeHours = 0, days: Day[] = []): Row => ({ status, overtimeHours, days });
const day = (status: Day["status"], overtimeMinutes = 0, date = "2026-10-16"): Day => ({
  date, firstEntry: null, lastExit: null, totalMinutes: 0,
  status, isLate: status === "late", lateMinutes: 0, payrollCode: "", overtimeMinutes,
});

describe("summarizePdksRecords", () => {
  it("returns zeroes for an empty selection", () => {
    expect(summarizePdksRecords([])).toEqual({ totalEmployees: 0, present: 0, late: 0, absent: 0, leave: 0, overtimeHours: 0, attendanceRate: 0 });
  });
  it("counts daily statuses independently and includes late attendance in the rate", () => {
    expect(summarizePdksRecords([row("present", 1.5), row("late", 0.5), row("absent"), row("leave")])).toEqual({
      totalEmployees: 4, present: 1, late: 1, absent: 1, leave: 1, overtimeHours: 2, attendanceRate: 50,
    });
  });
  it("uses person-days instead of the aggregate row status for a period", () => {
    expect(summarizePdksRecords([
      row("absent", 99, [day("present", 60), day("late", 30), day("leave")]),
      row("present", 99, [day("absent"), day("absent"), day("present")]),
    ])).toEqual({ totalEmployees: 2, present: 2, late: 1, absent: 2, leave: 1, overtimeHours: 1.5, attendanceRate: 50 });
  });
  it("skips future days of the period when todayKey is given", () => {
    const records = [row("absent", 0, [day("present", 0, "2026-10-15"), day("absent", 0, "2026-10-16"), day("absent", 0, "2026-10-17")])];
    expect(summarizePdksRecords(records, "2026-10-16")).toMatchObject({ present: 1, absent: 1, attendanceRate: 50 });
    expect(summarizePdksRecords(records)).toMatchObject({ present: 1, absent: 2 });
  });
  it("excludes weekends and holidays from attendance but retains their overtime", () => {
    expect(summarizePdksRecords([row("absent", 99, [day("weekend", 60), day("holiday", 120), day("late")])])).toEqual({
      totalEmployees: 1, present: 0, late: 1, absent: 0, leave: 0, overtimeHours: 3, attendanceRate: 100,
    });
  });
  it("handles a period consisting only of nonworking days", () => {
    expect(summarizePdksRecords([row("absent", 0, [day("holiday"), day("weekend")])]).attendanceRate).toBe(0);
  });
  it("rounds fractional overtime only after summing all days", () => {
    expect(summarizePdksRecords([row("present", 0, [day("present", 1), day("present", 1), day("present", 1)])]).overtimeHours).toBe(0.05);
  });
  it("does not mutate query rows", () => {
    const records = [row("late", 2, [day("present", 60)])];
    const original = structuredClone(records);
    summarizePdksRecords(records);
    expect(records).toEqual(original);
  });
});
