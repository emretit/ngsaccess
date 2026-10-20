import { describe, expect, it } from "vitest";
import {
  filterPdksRows,
  cellLabel,
  compareRows,
  displayTime,
  formatDuration,
  displayDuration,
  periodTotals,
  validateManual,
  type PdksRow,
  type PdksCell,
} from "./presentation";
import {
  clearPdksFilters,
  type FilterValues,
} from "../dashboard/PDKSFilterBar";
const day = (
  status: PdksCell["status"],
  totalMinutes = 0,
  overtimeMinutes = 0,
): PdksCell => ({
  date: "2026-10-16",
  firstEntry: null,
  lastExit: null,
  totalMinutes,
  overtimeMinutes,
  status,
  leaveType: null,
  isLate: false,
  lateMinutes: 0,
  payrollCode: "",
});
const row = (
  name: string,
  totalMinutes: number,
  firstEntry = "08:30",
): PdksRow => ({
  excludedUnknownReadings: 0,
  id: name,
  name,
  totalMinutes,
  overtimeMinutes: 0,
  firstEntry,
  lastExit: "17:00",
  department: "Üretim",
  employeeId: "",
  cardNumber: "",
  payrollCode: "",
  payrollEmployeeCode: "",
  totalHours: "",
  overtime: "",
  overtimeHours: 0,
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
  days: [],
});
describe("PDKS presentation", () => {
  it("formats hours without wrapping at 24 and distinguishes unknown times", () => {
    expect(formatDuration(510)).toBe("08 sa 30 dk");
    expect(formatDuration(1510, true)).toBe("25:10");
    expect(displayTime("08:30")).toBe("08:30");
    expect(displayTime("25:30")).toBe("—");
  });
  it("shows unavailable durations as a dash while keeping actual zero durations", () => {
    for (const status of ["future", "noData"] as const) {
      expect(displayDuration(0, status)).toBe("—");
      expect(displayDuration(500, status)).toBe("—");
    }
    expect(displayDuration(0, "absent")).toBe("—");
    expect(displayDuration(510, "present")).toBe("08 sa 30 dk");
  });
  it("sorts Turkish names and numeric duration rather than legacy strings", () => {
    expect(
      [row("Şule", 60), row("Selin", 510), row("İpek", 125)]
        .sort((a, b) => compareRows(a, b, "name", "asc"))
        .map((r) => r.name),
    ).toEqual(["İpek", "Selin", "Şule"]);
    expect(
      [row("A", 510), row("B", 125)].sort((a, b) =>
        compareRows(a, b, "totalMinutes", "asc"),
      )[0].name,
    ).toBe("B");
  });
  it("keeps missing clocks last in either direction and compares clocks in minutes", () => {
    const a = row("A", 0, "—"),
      b = row("B", 0, "08:30");
    expect(compareRows(a, b, "firstEntry", "asc")).toBeGreaterThan(0);
    expect(compareRows(a, b, "firstEntry", "desc")).toBeGreaterThan(0);
    expect(compareRows(row("C", 0, "09:00"), b, "firstEntry", "asc")).toBe(30);
  });
  it("labels missing and future cells explicitly and includes person/date/duration", () => {
    expect(cellLabel("Ayşe Demir", "2026-10-16")).toContain("Veri yok");
    expect(cellLabel("Ayşe Demir", "2026-10-16", day("future"))).toContain(
      "Henüz gelmedi",
    );
    expect(cellLabel("Ayşe Demir", "2026-10-16", day("late", 495))).toContain(
      "Ayşe Demir, 16 Ekim 2026 Cuma, Geç, 8 saat 15 dakika",
    );
  });
  it("sums day minutes and excludes unavailable days", () => {
    expect(
      periodTotals([
        day("present", 510, 30),
        day("holiday", 120, 120),
        day("noData", 999),
        day("future", 999),
      ]),
    ).toEqual({ totalMinutes: 630, overtimeMinutes: 150 });
  });
  it("requires one clock and a trimmed 3–500 character reason, rejects overnight", () => {
    expect(validateManual("", "", "abc").entry).toBe("En az bir saat girin.");
    expect(validateManual("24:00", "", "abc").entry).toContain(
      "Geçerli bir saat",
    );
    expect(validateManual("08:30", "08:30", "abc").exit).toContain(
      "sonra olmalı",
    );
    expect(validateManual("22:00", "06:00", "abc").exit).toBeDefined();
    expect(validateManual("", "17:00", " ab ").note).toBeDefined();
    expect(validateManual("", "17:00", "abc")).toEqual({});
    expect(validateManual("08:30", "17:00", "a".repeat(500))).toEqual({});
    expect(
      validateManual("08:30", "17:00", "a".repeat(501)).note,
    ).toBeDefined();
  });
  it("clears only people and organization filters, preserving the period", () => {
    const filters: FilterValues = {
      anchorDate: new Date("2026-10-16T12:00:00"),
      dateRange: { from: undefined, to: undefined },
      reportType: "monthly",
      person: "Ayşe",
      statusFilter: "late",
    };
    expect(clearPdksFilters(filters)).toMatchObject({
      anchorDate: filters.anchorDate,
      reportType: "monthly",
      person: "",
      statusFilter: "all",
    });
  });
});

it("filters period rows by a matching day while preserving the full period", () => {
  const employee = {
    ...row("Ayşe", 480),
    days: [day("present", 480), day("absent")],
  };
  expect(filterPdksRows([employee], "absent")).toEqual([employee]);
  expect(filterPdksRows([employee], "leave")).toEqual([]);
  expect(filterPdksRows([row("İpek", 480)], "absent")).toEqual([]);
});

it("08-H2 accepts next-day manual exit only for an assigned overnight shift", () => {
  expect(validateManual("22:00", "06:00", "Kart unutuldu", true)).toEqual({});
  expect(validateManual("22:00", "06:00", "Kart unutuldu").exit).toBeDefined();
  expect(validateManual("22:00", "22:00", "Kart unutuldu", true)).toEqual({});
});
