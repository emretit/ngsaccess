import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { computePdksTableRow } from "../../../../convex/lib/pdksTable";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "../../../../convex/lib/pdksHelpers";
import { summarizePdksRecords } from "../../../lib/pdksSummary";
import { analyzePdksRows } from "./analysis";
import { filterPdksRows, periodTotals, type PdksRow } from "./presentation";

describe("settled overtime in PDKS views", () => {
  it.each(["weekly45", "dailyShift"] as const)("%s cells, heatmap, chart, KPI and filter share the row's settlement", (overtimeBasis) => {
    const id = "employee" as Id<"employees">;
    const dates = [22, 23, 24, 25, 26].map((d) => `2026-06-${d}`);
    const employee = { _id: id, firstName: "Test", lastName: "Worker", hourlyRate: 100 } as Doc<"employees">;
    const shift = { startTime: "09:00", endTime: "18:00", overtimeStartToleranceMinutes: 0 } as Doc<"shifts">;
    const params = {
      employee, empKey: id, empReadings: [], departmentName: "",
      availableDateKeys: new Set(dates), periodDateKeys: dates, startDate: dates[0],
      isSingleDay: false, viewMode: "matrix" as const, today: "2026-07-01",
      manualPdksByEmpDate: new Map(dates.map((date) => [
        `${id}__${date}`, { manualEntry: true, entryTime: "09:00", exitTime: "20:00" } as Doc<"pdksRecords">,
      ])),
      allLeaves: [], holidayMap: new Map(), manualEditedBy: null,
      workingDays: ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"],
      workSettings: DEFAULT_WORK_SETTINGS,
      overtimeRates: { ...DEFAULT_OVERTIME_RATES, overtimeBasis },
      resolveShift: () => shift,
    };
    const row: PdksRow = { ...computePdksTableRow(params), excludedUnknownReadings: 0 };
    const expected = overtimeBasis === "weekly45" ? 300 : 600;
    expect(row.overtimeMinutes).toBe(expected);
    expect(row.days.map((d) => d.overtimeMinutes)).toEqual(
      overtimeBasis === "weekly45" ? [0, 0, 0, 0, 300] : [120, 120, 120, 120, 120],
    );
    expect(periodTotals(row.days).overtimeMinutes).toBe(expected);
    expect(analyzePdksRows([row]).reduce((sum, d) => sum + d.overtimeMinutes, 0)).toBe(expected);
    expect(summarizePdksRecords([row]).overtimeHours).toBe(expected / 60);
    expect(filterPdksRows([row], "overtime")).toEqual([row]);
    for (const date of [dates[0], dates[4]]) {
      const single: PdksRow = {
        ...computePdksTableRow({ ...params, startDate: date, periodDateKeys: [date], isSingleDay: true }),
        excludedUnknownReadings: 0,
      };
      expect(single.overtimeMinutes).toBe(row.days.find((d) => d.date === date)?.overtimeMinutes);
      expect(filterPdksRows([single], "overtime")).toHaveLength(single.overtimeMinutes > 0 ? 1 : 0);
    }
  });
});
