import type { Employee } from "@/types/employee";

export const EMPLOYEE_EXPORT_MAX_ROWS = 5000;

export async function createEmployeesExportWorkbook(employees: readonly Employee[], includeTcNo = false) {
  if (employees.length > EMPLOYEE_EXPORT_MAX_ROWS) throw new Error("Dışa aktarma en fazla 5000 kişi içerebilir.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kişiler", { views: [{ state: "frozen", ySplit: 1 }] });
  // Ücret alanları bilinçli olarak dışa aktarılmaz; API maskesinden bağımsız olarak yetkisiz veri dosyaya girmez.
  sheet.addRow(includeTcNo
    ? ["Ad", "Soyad", "E-posta", "T.C. Kimlik No", "Sicil/Bordro Kodu", "Kart No", "Firma", "Departman", "Pozisyon", "Aktif"]
    : ["Ad", "Soyad", "E-posta", "Sicil/Bordro Kodu", "Kart No", "Firma", "Departman", "Pozisyon", "Aktif"]);
  for (const employee of employees) {
    const values = [employee.firstName, employee.lastName, employee.email];
    if (includeTcNo) values.push(employee.tcNo ?? "");
    values.push(employee.payrollCode ?? "", employee.cardNumber, employee.companies?.name ?? "", employee.departments?.name ?? "", employee.positions?.name ?? "", employee.isActive === false ? "Hayır" : "Evet");
    sheet.addRow(values);
  }
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 22; });
  return workbook;
}

export function getEmployeeExportFilename(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return `kisiler-${date}.xlsx`;
}

export async function downloadEmployeesXlsx(employees: readonly Employee[], includeTcNo = false) {
  const workbook = await createEmployeesExportWorkbook(employees, includeTcNo);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = getEmployeeExportFilename();
  link.click();
  URL.revokeObjectURL(url);
}
