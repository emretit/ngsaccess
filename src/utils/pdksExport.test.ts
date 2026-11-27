import ExcelJS from "exceljs";
import { afterEach, expect, it, vi } from "vitest";
import { exportMonthlyPayrollSheet, type MonthlyPayrollSheet } from "./pdksExport";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(["starts-on-15", "gap-11-to-19", "sparse-reversed"])("payroll Excel places %s cells by date under the matching day header", async scenario => {
  const days = Array.from({ length: 30 }, (_, i) => `2026-06-${String(i + 1).padStart(2, "0")}`);
  const planned = (day: number) => scenario === "gap-11-to-19" ? day <= 10 || day >= 20 : day >= 15;
  const cells = days.map((date, i) => ({ date, payrollCode: planned(i + 1) ? "N" : "—", totalMinutes: 0, overtimeMinutes: 0, multiplier: 0, isLate: false, isEarlyExit: false, isManual: false }));
  const data: MonthlyPayrollSheet = { year: 2026, month: 6, days, rows: [{ employeeId: "e", name: "Test", cardNumber: "1", payrollCode: "", department: "", cells: scenario === "sparse-reversed" ? [...cells.filter(cell => cell.payrollCode === "N").reverse(), { ...cells[0], date: "2026-07-01", payrollCode: "INVALID" }] : cells, totals: { totalMinutes: 0, overtimeMinutes: 0, leaveDays: 0, absentDays: 0, lateDays: 0 } }] };
  const sheetSpy = vi.spyOn(ExcelJS.Workbook.prototype, "addWorksheet");
  const click = vi.fn();
  vi.stubGlobal("document", { createElement: () => ({ click }) });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  await exportMonthlyPayrollSheet(data);
  const sheet = sheetSpy.mock.results[0]?.value as ExcelJS.Worksheet;
  expect(click).toHaveBeenCalledOnce();
  for (let day = 1; day <= 30; day++) {
    expect(sheet.getCell(2, 4 + day).value).toBe(String(day).padStart(2, "0"));
    expect(sheet.getCell(3, 4 + day).value).toBe(planned(day) ? "N" : scenario === "sparse-reversed" ? null : "—");
  }
  expect(sheet.getCell(3, 4).value).toBe("");
});

it("monthly payroll Excel keeps all 500 employees and all 30 date columns", async () => {
  const days = Array.from({ length: 30 }, (_, index) => `2026-06-${String(index + 1).padStart(2, "0")}`);
  const data: MonthlyPayrollSheet = { year: 2026, month: 6, days, rows: Array.from({ length: 500 }, (_, index) => ({ employeeId: String(index), name: `Person ${index}`, cardNumber: String(index), payrollCode: "", department: "", cells: days.map(date => ({ date, payrollCode: "N", totalMinutes: 480, overtimeMinutes: 0, multiplier: 1, isLate: false, isEarlyExit: false, isManual: false })), totals: { totalMinutes: 22 * 480, overtimeMinutes: 0, leaveDays: 0, absentDays: 0, lateDays: 0 } })) };
  const sheetSpy = vi.spyOn(ExcelJS.Workbook.prototype, "addWorksheet");
  vi.stubGlobal("document", { createElement: () => ({ click: vi.fn() }) });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  await exportMonthlyPayrollSheet(data);
  const sheet = sheetSpy.mock.results[0]?.value as ExcelJS.Worksheet;
  expect(sheet.rowCount).toBeGreaterThanOrEqual(502);
  expect(sheet.getCell(502, 1).value).toBe("Person 499");
  expect(sheet.getCell(502, 34).value).toBe("N");
}, 30_000);
