import { expect, it } from "vitest";
import { analyzePdksRows } from "./analysis";
import type { PdksRow } from "./presentation";
// Only the consumed properties are supplied by this typed fixture helper.
const make = (days: PdksRow["days"]): PdksRow => ({
  excludedUnknownReadings: 0,
  id: "a",
  name: "A",
  cardNumber: "",
  employeeId: "",
  payrollCode: "",
  payrollEmployeeCode: "",
  department: "",
  firstEntry: "—",
  lastExit: "—",
  totalHours: "",
  totalMinutes: 0,
  overtime: "",
  overtimeHours: 0,
  overtimeMinutes: 0,
  overtimeMultiplier: 1,
  overtimePayTRY: null,
  hourlyRate: null,
  yearlyOvertimeLimit: 270,
  leaveType: "",
  status: "present",
  isLate: false,
  isEarlyExit: false,
  isManual: false,
  manualNote: null,
  manualEditedBy: null,
  detailedLogs: [],
  days,
});
const cell = (date: string, status: PdksRow["status"], minutes = 480) => ({
  date,
  status,
  totalMinutes: minutes,
  lateMinutes: 15,
  overtimeMinutes: 0,
  firstEntry: "08:45",
  lastExit: "17:00",
  leaveType: null,
  isLate: status === "late",
  payrollCode: "N",
});
it("keeps daily analysis at the exact query date", () => {
  const result = analyzePdksRows([
    make([cell("2026-10-16", "late")]),
    make([cell("2026-10-16", "present")]),
  ]);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    date: "2026-10-16",
    totalMinutes: 960,
    lateMinutes: 30,
    counts: { late: 1, present: 1 },
  });
});
it("groups sorted person-days and preserves future/missing labels without inventing absence", () => {
  const result = analyzePdksRows([
    make([
      cell("2026-10-17", "future", 999),
      cell("2026-10-16", "noData", 999),
    ]),
  ]);
  expect(result.map((d) => d.date)).toEqual(["2026-10-16", "2026-10-17"]);
  expect(result[0].counts.absent).toBe(0);
  expect(result[1].totalMinutes).toBe(0);
  expect(result[1].lateMinutes).toBe(0);
});
it("does not add employees excluded by the page filter", () => {
  const rows = [make([cell("2026-10-16", "late")])];
  const before = structuredClone(rows);
  expect(analyzePdksRows(rows)[0].counts.present).toBe(0);
  expect(rows).toEqual(before);
});
