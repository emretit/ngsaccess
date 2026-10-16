import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { attendanceCalendarIssues, hasUnsupportedShiftCalendar, summarizeAttendance } from "./reportAttendance";
import { buildPeriodDateKeys } from "./pdksCalc";
import { buildPdksEmployeeReadingMap, computePdksTableRow } from "./pdksTable";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./pdksHelpers";
import { trTodayKey } from "./trDate";

const employee = (id: string): Doc<"employees"> => ({
  _id: id as Id<"employees">, _creationTime: 0, firstName: id, lastName: "Test", email: "test@example.com", cardNumber: id, isActive: true,
});
const holiday: Doc<"holidays"> = { _id: "holiday" as Id<"holidays">, _creationTime: 0, date: "2026-01-01", name: "Yılbaşı", createdAt: "2025-12-01" };
const workingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const params = (emp: Doc<"employees">): Parameters<typeof computePdksTableRow>[0] => ({
  empKey: emp._id, employee: emp, empReadings: [], departmentName: "Test", periodDateKeys: buildPeriodDateKeys("2026-01-01", "2026-01-31"), startDate: "2026-01-01", isSingleDay: false, viewMode: "matrix", manualPdksByEmpDate: new Map(), allLeaves: [], holidayMap: new Map([[holiday.date, holiday]]), workingDays, workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: DEFAULT_OVERTIME_RATES, resolveShift: () => null, manualEditedBy: null,
});

describe("rapor devam adaptörü / PDKS tablo tutarlılığı", () => {
  it("ay ortasında sıfır okumalı iki personeli içerir; tatil, hafta sonu ve gelecek günleri dışlar", () => {
    const employees = [employee("zero"), employee("leave")];
    const employeeMap = buildPdksEmployeeReadingMap({ employees, readings: [] });
    expect(employeeMap.size).toBe(2);
    const today = trTodayKey(new Date("2026-01-14T21:30:00Z"));
    expect(today).toBe("2026-01-15");
    const rows = employees.map((emp) => {
      const input = params(emp);
      input.empReadings = employeeMap.get(emp._id) ?? [];
      if (emp._id === "leave") input.allLeaves = [{ _id: "leave1" as Id<"leaves">, _creationTime: 0, employeeId: emp._id, leaveType: "annual", status: "approved", startDate: "2026-01-02", endDate: "2026-01-05", createdAt: "", updatedAt: "" }];
      const report = summarizeAttendance(input, today);
      const table = computePdksTableRow(input).days.filter((day) => day.date < today);
      expect(report.absentDays).toBe(table.filter((day) => day.payrollCode === "DV").length);
      expect(report.leaveDays).toBe(table.filter((day) => day.payrollCode === "İZN").length);
      return report;
    });
    expect(rows[0]).toMatchObject({ presentDays: 0, leaveDays: 0, absentDays: 9, expectedDays: 9, devamOrani: 0 });
    expect(rows[1]).toMatchObject({ presentDays: 0, leaveDays: 2, absentDays: 7, expectedDays: 7, devamOrani: 0 });
  });

  it("manuel giriş ve izinli tek okuma PDKS hücresiyle aynı devam sayılır", () => {
    const emp = employee("manual");
    const input = params(emp);
    input.manualPdksByEmpDate = new Map([[`${emp._id}__2026-01-02`, { _id: "m" as Id<"pdksRecords">, _creationTime: 0, employeeId: emp._id, date: "2026-01-02", entryTime: "09:00", manualEntry: true } as Doc<"pdksRecords">]]);
    input.empReadings = [{ _id: "r" as Id<"cardReadings">, _creationTime: 0, employeeId: emp._id, cardNo: emp.cardNumber, accessStatus: "izin_verildi", accessTime: "2026-01-05T06:00:00Z" } as Doc<"cardReadings">];
    expect(summarizeAttendance(input, "2026-01-06")).toMatchObject({ presentDays: 2, absentDays: 0, expectedDays: 2, devamOrani: 100 });
    expect(summarizeAttendance(input, "2025-12-31")).toMatchObject({ absentDays: 0, expectedDays: 0, devamOrani: null });
  });

  it("eksik resmi tatili yalnız ilgili tamamlanmış dönemde doğrulanamaz sayar", () => {
    expect(attendanceCalendarIssues(2026, ["2026-01-01"], new Map())).toHaveLength(1);
    expect(attendanceCalendarIssues(2026, ["2026-01-02"], new Map())).toEqual([]);
    expect(attendanceCalendarIssues(2026, ["2026-01-01"], new Map([[holiday.date, holiday]]))).toEqual([]);
    expect(summarizeAttendance(params(employee("zero")), "2026-01-15", ["Takvim eksik"])).toMatchObject({ absentDays: null, devamOrani: null, expectedDays: null, reliabilityNote: "Takvim eksik" });
  });

  it("aynı hafta düzeni güvenilir kalır; yalnız farklı vardiya takvimi etkilenen satırı belirsiz yapar", () => {
    const assignment: Doc<"shiftAssignments"> = { _id: "a" as Id<"shiftAssignments">, _creationTime: 0, employeeId: employee("x")._id, shiftId: "s" as Id<"shifts">, startDate: "2026-01-01", endDate: "2026-01-31", weekPattern: ["MON", "TUE", "WED", "THU", "FRI"], createdAt: "", updatedAt: "" };
    const dates = buildPeriodDateKeys("2026-01-01", "2026-01-14");
    expect(hasUnsupportedShiftCalendar([assignment], dates, workingDays, new Map())).toBe(false);
    expect(hasUnsupportedShiftCalendar([{ ...assignment, weekPattern: ["SAT"] }], dates, workingDays, new Map())).toBe(true);
    expect(hasUnsupportedShiftCalendar([{ ...assignment, weekPattern: ["SAT"] }], ["2026-02-02"], workingDays, new Map())).toBe(false);
  });
});
