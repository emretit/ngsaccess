import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { toLocalDateString } from "@/lib/date";

export interface PDKSExportRecord {
  id: string;
  name: string;
  employeeId: string;
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

const STATUS_LABELS: Record<string, string> = {
  present: "Mevcut",
  late: "Geç",
  absent: "Yok",
  leave: "İzinli",
};

/**
 * PDKS tablo verisini Excel (.xlsx) formatında dışa aktarır
 */
export async function exportToExcel(
  records: PDKSExportRecord[],
  options: { title?: string; dateRange?: string } = {}
): Promise<void> {
  const { dateRange = "" } = options;

  const headers = [
    "Çalışan",
    "ID",
    "Bordro Kodu",
    "Departman",
    "Gün Kodu",
    "İlk Giriş",
    "Son Çıkış",
    "Toplam Saat",
    "Mesai",
    "İzin",
    "Durum",
  ];

  const rows = records.map((r) => [
    r.name,
    r.employeeId,
    r.payrollEmployeeCode ?? "",
    r.department,
    r.payrollCode ?? "",
    r.firstEntry,
    r.lastExit,
    r.totalHours,
    r.overtime,
    r.leaveType,
    STATUS_LABELS[r.status] ?? r.status,
  ]);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("PDKS Kayıtları", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));

  worksheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 14 },
    { width: 18 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
  ];

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
  options: { dateRange?: string } = {}
): void {
  const { dateRange = "" } = options;

  const headers = [
    "Çalışan",
    "ID",
    "Bordro Kodu",
    "Departman",
    "Gün Kodu",
    "İlk Giriş",
    "Son Çıkış",
    "Toplam Saat",
    "Mesai",
    "İzin",
    "Durum",
  ];

  const escapeCsv = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

  const rows = records.map((r) =>
    [
      r.name,
      r.employeeId,
      r.payrollEmployeeCode ?? "",
      r.department,
      r.payrollCode ?? "",
      r.firstEntry,
      r.lastExit,
      r.totalHours,
      r.overtime,
      r.leaveType,
      STATUS_LABELS[r.status] ?? r.status,
    ]
      .map((c) => escapeCsv(String(c)))
      .join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
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
export function exportToPdf(
  records: PDKSExportRecord[],
  options: { title?: string; dateRange?: string } = {}
): void {
  const { title = "PDKS Raporu", dateRange = "" } = options;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const colWidths = [38, 22, 22, 28, 16, 18, 18, 22, 16, 18, 18];
  const rowHeight = 8;
  const headerHeight = 10;

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
  const headers = [
    "Çalışan",
    "ID",
    "Bordro",
    "Departman",
    "Gün",
    "İlk Giriş",
    "Son Çıkış",
    "Toplam",
    "Mesai",
    "İzin",
    "Durum",
  ];
  let x = margin;

  headers.forEach((h, i) => {
    doc.setFont("helvetica", "bold");
    doc.rect(x, y, colWidths[i], headerHeight);
    doc.text(h, x + 2, y + 6);
    x += colWidths[i];
  });
  y += headerHeight;

  doc.setFont("helvetica", "normal");
  records.forEach((r, _idx) => {
    if (y > pageHeight - 25) {
      doc.addPage("a4", "landscape");
      y = margin;
    }

    x = margin;
    const rowData = [
      r.name.substring(0, 22),
      r.employeeId,
      r.payrollEmployeeCode ?? "",
      r.department.substring(0, 16),
      r.payrollCode ?? "",
      r.firstEntry,
      r.lastExit,
      r.totalHours,
      r.overtime,
      r.leaveType,
      STATUS_LABELS[r.status] ?? r.status,
    ];

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
  data: MonthlyPayrollSheet
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(
    `${MONTH_NAMES_TR[data.month - 1]} ${data.year}`,
    { views: [{ state: "frozen", xSplit: 4, ySplit: 2 }] }
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
    sheet.getCell(r, totalsCol).value = (row.totals.totalMinutes / 60).toFixed(2);
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
  signatureRow.getCell(Math.floor(totalCols / 2)).font = { bold: true, size: 10 };
  signatureRow.getCell(totalCols).value = `Tarih: ${new Date().toLocaleDateString("tr-TR")}`;
  signatureRow.getCell(totalCols).font = { size: 10 };

  const linesRow = sheet.addRow([]);
  linesRow.getCell(1).value = "İmza: ____________________";
  linesRow.getCell(Math.floor(totalCols / 2)).value = "İmza: ____________________";

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
