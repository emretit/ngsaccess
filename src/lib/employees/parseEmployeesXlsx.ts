import type { EmployeeImportIssue, EmployeeImportRow, ParsedEmployeeFile } from "./employeeExcelTypes";
import type { Cell, Row } from "exceljs";

export const EMPLOYEE_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const EMPLOYEE_IMPORT_MAX_ROWS = 1000;

const HEADER_FIELDS: Record<string, keyof Omit<EmployeeImportRow, "rowNumber">> = {
  ad: "firstName", soyad: "lastName", email: "email", eposta: "email",
  tc: "tcNo", tckimlikno: "tcNo", sicilbordrokodu: "payrollCode", bordrokodu: "payrollCode", sicilkodu: "payrollCode",
  kartno: "cardNumber", departman: "department", pozisyon: "position", firma: "company", aktif: "isActive",
};

export function normalizeEmployeeHeader(value: string) {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]/g, "");
}

function cellText(cell: Cell) {
  if (cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "number") {
    const zeroMask = cell.numFmt?.split(";")[0]?.trim();
    if (zeroMask && /^0+$/.test(zeroMask)) return String(cell.value).padStart(zeroMask.length, "0");
  }
  return String(cell.text ?? cell.value).trim();
}

function isBlankRow(row: Row) {
  let hasValue = false;
  row.eachCell({ includeEmpty: true }, (cell) => { if (cellText(cell)) hasValue = true; });
  return !hasValue;
}

function parseActive(value: string): boolean | undefined {
  const normalized = value.toLocaleLowerCase("tr-TR").trim();
  if (["evet", "e", "yes", "true", "1", "aktif"].includes(normalized)) return true;
  if (["hayır", "hayir", "h", "no", "false", "0", "pasif"].includes(normalized)) return false;
  return undefined;
}

export async function parseEmployeesXlsx(file: File): Promise<ParsedEmployeeFile> {
  if (file.size > EMPLOYEE_IMPORT_MAX_FILE_BYTES) throw new Error("Dosya boyutu 5 MB sınırını aşamaz.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");

  let headerRowNumber: number | undefined;
  let columns: Array<{ index: number; field: keyof Omit<EmployeeImportRow, "rowNumber"> }> = [];
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 5); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const detected: Array<{ index: number; field: keyof Omit<EmployeeImportRow, "rowNumber"> }> = [];
    for (let index = 1; index <= sheet.columnCount; index += 1) {
      const value = cellText(row.getCell(index));
      const field = HEADER_FIELDS[normalizeEmployeeHeader(value)];
      if (field) detected.push({ index, field });
    }
    if (detected.some((item) => item.field === "firstName") && detected.some((item) => item.field === "lastName")) {
      headerRowNumber = rowNumber;
      columns = detected;
      break;
    }
  }
  if (!headerRowNumber) throw new Error("Ad* ve Soyad* başlıkları bulunamadı.");

  const rows: EmployeeImportRow[] = [];
  const issues: EmployeeImportIssue[] = [];
  let dataRowCount = 0;
  const seen = { tcNo: new Set<string>(), email: new Set<string>(), cardNumber: new Set<string>() };
  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (isBlankRow(row)) continue;
    dataRowCount += 1;
    if (dataRowCount > EMPLOYEE_IMPORT_MAX_ROWS) throw new Error("Dosyada en fazla 1000 kişi satırı bulunabilir.");
    const values: Partial<Record<keyof Omit<EmployeeImportRow, "rowNumber">, string>> = {};
    for (const column of columns) values[column.field] = cellText(row.getCell(column.index));
    const result: EmployeeImportRow = {
      rowNumber,
      firstName: values.firstName ?? "",
      lastName: values.lastName ?? "",
      email: values.email ?? "",
      cardNumber: values.cardNumber ?? "",
    };
    if (values.tcNo) result.tcNo = values.tcNo;
    if (values.payrollCode) result.payrollCode = values.payrollCode;
    if (values.department) result.department = values.department;
    if (values.position) result.position = values.position;
    if (values.company) result.company = values.company;
    if (values.isActive) {
      const isActive = parseActive(values.isActive);
      if (isActive === undefined) issues.push({ rowNumber, message: "Aktif alanı Evet veya Hayır olmalıdır." });
      else result.isActive = isActive;
    }
    const duplicateFields: string[] = [];
    for (const key of ["tcNo", "email", "cardNumber"] as const) {
      const raw = key === "email" ? result.email : key === "cardNumber" ? result.cardNumber : result.tcNo ?? "";
      const value = raw.trim().toLowerCase();
      if (!value) continue;
      if (seen[key].has(value)) duplicateFields.push(key === "tcNo" ? "T.C. Kimlik No" : key === "email" ? "E-posta" : "Kart No");
      seen[key].add(value);
    }
    if (duplicateFields.length) issues.push({ rowNumber, message: `Dosya içinde yinelenen değer: ${duplicateFields.join(", ")}.` });
    rows.push(result);
  }
  if (rows.length > EMPLOYEE_IMPORT_MAX_ROWS) throw new Error("Dosyada en fazla 1000 kişi satırı bulunabilir.");
  return { rows, issues };
}
