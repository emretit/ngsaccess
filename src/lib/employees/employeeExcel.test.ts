import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createEmployeesExportWorkbook, getEmployeeExportFilename } from "./exportEmployeesXlsx";
import { createEmployeeImportTemplate } from "./importTemplate";
import { EMPLOYEE_IMPORT_MAX_FILE_BYTES, parseEmployeesXlsx } from "./parseEmployeesXlsx";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";

async function asFile(workbook: ExcelJS.Workbook, name = "kisiler.xlsx") {
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("employee Excel helpers", () => {
  it("parses Turkish headers, retains formatted leading zeroes, and skips blank rows", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Kişiler");
    sheet.addRow(["Örnek dosya"]);
    sheet.addRow(["AD *", "Soyad", "E-POSTA", "T.C. Kimlik No", "Kart No"]);
    const data = sheet.addRow(["İpek", "Işık", "ipek@example.com", 123, 45]);
    data.getCell(4).numFmt = "00000000000";
    data.getCell(5).numFmt = "00000";
    sheet.addRow(["Can", "Aydın", "can@example.com", "", 12345]);
    sheet.addRow(["Ece", "Aydın", "ece@example.com", "", "00123"]);
    sheet.addRow([]);
    const parsed = await parseEmployeesXlsx(await asFile(workbook));
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toEqual([
      { rowNumber: 3, firstName: "İpek", lastName: "Işık", email: "ipek@example.com", cardNumber: "00045", tcNo: "00000000123" },
      { rowNumber: 4, firstName: "Can", lastName: "Aydın", email: "can@example.com", cardNumber: "12345" },
      { rowNumber: 5, firstName: "Ece", lastName: "Aydın", email: "ece@example.com", cardNumber: "00123" },
    ]);
  });

  it("rejects file and row limits", async () => {
    const oversized = new File([new Uint8Array(EMPLOYEE_IMPORT_MAX_FILE_BYTES + 1)], "large.xlsx");
    await expect(parseEmployeesXlsx(oversized)).rejects.toThrow("5 MB");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Kişiler");
    sheet.addRow(["Ad", "Soyad"]);
    for (let index = 0; index < 1001; index += 1) sheet.addRow(["Ad", "Soyad"]);
    await expect(parseEmployeesXlsx(await asFile(workbook))).rejects.toThrow("1000");
  });

  it("creates Turkish template headers without salary fields", async () => {
    const workbook = await createEmployeeImportTemplate();
    const sheet = workbook.worksheets[0];
    expect(sheet?.getRow(1).getCell(1).text).toContain("Açıklama");
    const values = sheet?.getRow(2).values;
    const headers = Array.isArray(values) ? values.map(String).join(" ").toLocaleLowerCase("tr-TR") : "";
    expect(headers).toContain("T.C. Kimlik No".toLocaleLowerCase("tr-TR"));
    expect(headers).toContain("Aktif (Evet/Hayır)".toLocaleLowerCase("tr-TR"));
    expect(headers).toContain("E-posta*".toLocaleLowerCase("tr-TR"));
    expect(headers).toContain("Kart No*".toLocaleLowerCase("tr-TR"));
    expect(sheet?.getRow(3).getCell(6).text).toBe("AYSE-001");
    const parsed = await parseEmployeesXlsx(await asFile(workbook));
    expect(parsed.rows).toMatchObject([{ firstName: "Ayşe", email: "ayse@example.com", cardNumber: "AYSE-001" }]);
    expect(headers).not.toContain("maaş");
  });

  it("exports no salary columns and uses Istanbul calendar date", async () => {
    const employee: Employee = { _id: "employees:1" as Employee["_id"], firstName: "Ada", lastName: "Yılmaz", email: "ada@example.com", cardNumber: "0001", hourlyRate: 250, monthlySalary: 50000 };
    const workbook = await createEmployeesExportWorkbook([employee]);
    const values = workbook.worksheets[0]?.getRow(1).values;
    const headers = Array.isArray(values) ? values.map(String).join(" ").toLocaleLowerCase("tr-TR") : "";
    expect(headers).not.toContain("saatlik ücret");
    expect(headers).not.toContain("maaş");
    expect(headers).not.toContain("t.c. kimlik no");
    expect(headers).toContain("firma");
    const withCompany = await createEmployeesExportWorkbook([{ ...employee, companies: { _id: "companies:1" as Id<"companies">, name: "NGS" }, departments: { _id: "departments:1" as Id<"departments">, name: "Yönetim" } }]);
    const row = withCompany.worksheets[0]?.getRow(2);
    expect([row?.getCell(6).text, row?.getCell(7).text]).toEqual(["NGS", "Yönetim"]);
    expect(getEmployeeExportFilename(new Date("2026-10-18T22:30:00.000Z"))).toBe("kisiler-2026-10-19.xlsx");
  });
});
