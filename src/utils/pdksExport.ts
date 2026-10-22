import { toLocalDateString } from "@/lib/date";
import { neutralizeSpreadsheetFormula } from "@/lib/spreadsheetSafety";

import { defaultPDKSPreferences, selectedPDKSColumns, type CsvDelimiter } from '@/lib/pdksExportColumns';
import { escapeCsvCell } from '@/lib/reports/export';

export interface PDKSExportOptions {
  title?: string;
  dateRange?: string;
  orderedColumnKeys?: readonly string[];
  delimiter?: CsvDelimiter;
  canSeePay?: boolean;
}
/** The same ordered cells drive the preview and all three serializers. Formula neutralization
 * applies only to spreadsheet output; PDF and preview show the raw text. */
export function buildPDKSExportTable(records: readonly PDKSExportRecord[], options: PDKSExportOptions = {}, neutralize = false) {
  const columns = selectedPDKSColumns(options.orderedColumnKeys, options.canSeePay);
  return { columns, headers: columns.map(c => c.label), rows: records.map(r => columns.map(c => {
    const value = c.value(r);
    return neutralize && typeof value === 'string' ? neutralizeSpreadsheetFormula(value) : value;
  })) };
}
export function buildPDKSCsv(records: readonly PDKSExportRecord[], options: PDKSExportOptions = {}): string {
  const { columns } = buildPDKSExportTable([], options);
  const delimiter = options.delimiter ?? ',';
  return '\uFEFF' + [columns.map(c => escapeCsvCell(c.label, delimiter)).join(delimiter), ...records.map(r => columns.map(c => escapeCsvCell(c.value(r), delimiter)).join(delimiter))].join('\n');
}

export interface PDKSExportRecord {
  id: string;
  name: string;
  employeeId: string;
  cardNumber?: string;
  totalMinutes?: number;
  overtimeMinutes?: number;
  payrollCode?: string;
  payrollEmployeeCode?: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  overtime: string;
  leaveType: string;
  status: string;
}

export interface MonthlyPayrollSheet {
  year: number;
  month: number;
  days: string[];
  rows: Array<{
    employeeId: string;
    payrollCode: string;
    name: string;
    cardNumber: string;
    department: string;
    cells: Array<{
      date: string;
      payrollCode: string;
      totalMinutes: number;
      overtimeMinutes: number;
      multiplier: number;
      isLate: boolean;
      isEarlyExit: boolean;
      isManual: boolean;
    }>;
    totals: {
      totalMinutes: number;
      overtimeMinutes: number;
      leaveDays: number;
      absentDays: number;
      lateDays: number;
    };
  }>;
}

/**
 * PDKS tablo verisini Excel (.xlsx) formatında dışa aktarır
 */
export async function exportToExcel(
  records: PDKSExportRecord[],
  options: PDKSExportOptions = {},
): Promise<void> {
  const { dateRange = "" } = options;

  const { columns, headers, rows } = buildPDKSExportTable(records, options, true);

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("PDKS Kayıtları", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));

  worksheet.columns = columns.map(c => ({ width: c.excelWidth }));

  const fileName = `PDKS_Raporu_${dateRange || toLocalDateString()}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * PDKS tablo verisini CSV formatında dışa aktarır
 */
export function exportToCsv(
  records: PDKSExportRecord[],
  options: PDKSExportOptions = {},
): void {
  const { dateRange = "" } = options;

  const blob = new Blob([buildPDKSCsv(records, options)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PDKS_Raporu_${dateRange || toLocalDateString()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * PDKS tablo verisini PDF formatında dışa aktarır
 */
export async function exportToPdf(
  records: PDKSExportRecord[],
  options: PDKSExportOptions = {},
): Promise<void> {
  const { title = "PDKS Raporu", dateRange = "" } = options;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const { columns, rows } = buildPDKSExportTable(records, options);
  const availableWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const totalWidth = columns.reduce((sum, c) => sum + c.pdfWidth, 0);
  const colWidths = columns.map(c => c.pdfWidth * Math.min(1, availableWidth / totalWidth));
  const rowHeight = 8;
  let headerHeight = 10;

  let y = margin;

  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 8;

  if (dateRange) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Tarih: ${dateRange}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  doc.setFontSize(9);
  const defaultKeys = defaultPDKSPreferences(options.canSeePay).orderedColumnKeys;
  const customColumns = columns.length !== defaultKeys.length || columns.some((c, i) => c.key !== defaultKeys[i]);
  const headers = columns.map(c => customColumns ? c.label : c.pdfLabel ?? c.label);
  const headerLines = headers.map((h, i) => customColumns ? doc.splitTextToSize(h, colWidths[i] - 4) as string[] : [h]);
  headerHeight = Math.max(10, ...headerLines.map(lines => lines.length * 4 + 4));
  let x = margin;

  headers.forEach((h, i) => {
    doc.setFont("helvetica", "bold");
    doc.rect(x, y, colWidths[i], headerHeight);
    doc.text(customColumns ? headerLines[i] : h, x + 2, y + 6);
    x += colWidths[i];
  });
  y += headerHeight;

  doc.setFont("helvetica", "normal");
  rows.forEach((row) => {
    if (y > pageHeight - 25) {
      doc.addPage("a4", "landscape");
      y = margin;
    }

    x = margin;
    const rowData = row.map((value, i) => {
      const key = columns[i].key;
      const text = String(value);
      return key === 'name' ? text.substring(0, 22) : key === 'department' ? text.substring(0, 16) : text;
    });

    rowData.forEach((cell, i) => {
      doc.rect(x, y, colWidths[i], rowHeight);
      doc.text(String(cell), x + 2, y + 5);
      x += colWidths[i];
    });
    y += rowHeight;
  });

  const fileName = `PDKS_Raporu_${dateRange || toLocalDateString()}.pdf`;
  doc.save(fileName);
}

const MONTH_NAMES_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/**
 * Aylık bordro cetveli (pivot Excel): çalışan satır × gün kolonu.
 * Her gün hücresinde payrollCode (N/RT/HT/İZN/DV) ve geç ise yan üst rozet.
 * Sağ tarafta: toplam saat, FM saat, izin gün, devamsız gün, geç gün.
 */
export async function exportMonthlyPayrollSheet(
  data: MonthlyPayrollSheet,
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(
    `${MONTH_NAMES_TR[data.month - 1]} ${data.year}`,
    { views: [{ state: "frozen", xSplit: 4, ySplit: 2 }] },
  );

  const dayCount = data.days.length;
  const totalCols = 4 + dayCount + 5; // 4 sabit + günler + 5 toplam

  // Başlık satırı 1 (merge): Ay-yıl başlığı
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${MONTH_NAMES_TR[data.month - 1]} ${data.year} - Aylık Bordro Cetveli`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };

  // Başlık satırı 2
  const headerRow = [
    "Çalışan",
    "Kart No",
    "Bordro Kodu",
    "Departman",
    ...data.days.map((d) => d.split("-")[2]), // sadece gün
    "Toplam Saat",
    "FM Saat",
    "İzin Günü",
    "Devamsız Gün",
    "Geç Gün",
  ];
  const r2 = sheet.addRow([]); // satır 2
  void r2;
  headerRow.forEach((h, i) => {
    const c = sheet.getCell(2, i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    c.alignment = { horizontal: "center" };
    c.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Veri satırları
  data.rows.forEach((row, idx) => {
    const r = idx + 3;
    sheet.getCell(r, 1).value = row.name;
    sheet.getCell(r, 2).value = row.cardNumber;
    sheet.getCell(r, 3).value = row.payrollCode;
    sheet.getCell(r, 4).value = row.department;

    row.cells.forEach((cell, ci) => {
      const c = sheet.getCell(r, 5 + ci);
      c.value = cell.payrollCode;
      c.alignment = { horizontal: "center" };
      let bg: string | null = null;
      switch (cell.payrollCode) {
        case "RT":
          bg = "FFFEE2E2"; // kırmızı
          break;
        case "HT":
          bg = "FFFEF3C7"; // sarı
          break;
        case "İZN":
          bg = "FFDBEAFE"; // mavi
          break;
        case "DV":
          bg = "FFFECACA";
          break;
        case "N":
          bg = cell.isLate ? "FFFEF9C3" : "FFDCFCE7";
          break;
      }
      if (bg) {
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bg },
        };
      }
      if (cell.isManual) {
        c.font = { italic: true, color: { argb: "FF7C3AED" } };
      }
    });

    // Toplamlar
    const totalsCol = 5 + dayCount;
    sheet.getCell(r, totalsCol).value = (row.totals.totalMinutes / 60).toFixed(
      2,
    );
    sheet.getCell(r, totalsCol + 1).value = (
      row.totals.overtimeMinutes / 60
    ).toFixed(2);
    sheet.getCell(r, totalsCol + 2).value = row.totals.leaveDays;
    sheet.getCell(r, totalsCol + 3).value = row.totals.absentDays;
    sheet.getCell(r, totalsCol + 4).value = row.totals.lateDays;
  });

  // Kolon genişlikleri
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 18;
  for (let i = 5; i < 5 + dayCount; i++) {
    sheet.getColumn(i).width = 5;
  }
  for (let i = 5 + dayCount; i < 5 + dayCount + 5; i++) {
    sheet.getColumn(i).width = 12;
  }

  // Lejant satırı
  const legendRow = sheet.addRow([]);
  legendRow.getCell(1).value =
    "Kodlar: N=Normal · RT=Resmi Tatil · HT=Hafta Tatili · İZN=İzinli · DV=Devamsız · Mor italik=Manuel düzeltilmiş";
  legendRow.getCell(1).font = { italic: true, size: 9 };
  sheet.mergeCells(legendRow.number, 1, legendRow.number, totalCols);

  // İmza alanı (4857 / SGK denetim için)
  sheet.addRow([]);
  const signatureRow = sheet.addRow([]);
  signatureRow.getCell(1).value = "Hazırlayan (Muhasebe)";
  signatureRow.getCell(1).font = { bold: true, size: 10 };
  signatureRow.getCell(Math.floor(totalCols / 2)).value = "Onaylayan (Müdür)";
  signatureRow.getCell(Math.floor(totalCols / 2)).font = {
    bold: true,
    size: 10,
  };
  signatureRow.getCell(totalCols).value =
    `Tarih: ${new Date().toLocaleDateString("tr-TR")}`;
  signatureRow.getCell(totalCols).font = { size: 10 };

  const linesRow = sheet.addRow([]);
  linesRow.getCell(1).value = "İmza: ____________________";
  linesRow.getCell(Math.floor(totalCols / 2)).value =
    "İmza: ____________________";

  // Print ayarları (landscape A4, fit to page width)
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  };
  sheet.headerFooter.oddHeader = `&L${MONTH_NAMES_TR[data.month - 1]} ${data.year} - Personel Devam Çizelgesi&R&P / &N`;
  sheet.headerFooter.oddFooter = "&CYasal saklama süresi: 10 yıl (4857)";

  const fileName = `Aylik_Bordro_Cetveli_${data.year}_${String(data.month).padStart(2, "0")}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
