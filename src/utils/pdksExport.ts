import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";

export interface PDKSExportRecord {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  overtime: string;
  leaveType: string;
  status: string;
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
  const { title = "PDKS Raporu", dateRange = "" } = options;

  const headers = [
    "Çalışan",
    "ID",
    "Departman",
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
    r.department,
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
    { width: 18 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
  ];

  const fileName = `PDKS_Raporu_${dateRange || new Date().toISOString().split("T")[0]}.xlsx`;
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
    "Departman",
    "İlk Giriş",
    "Son Çıkış",
    "Toplam Saat",
    "Mesai",
    "İzin",
    "Durum",
  ];

  const rows = records.map((r) =>
    [
      r.name,
      r.employeeId,
      r.department,
      r.firstEntry,
      r.lastExit,
      r.totalHours,
      r.overtime,
      r.leaveType,
      STATUS_LABELS[r.status] ?? r.status,
    ].join(",")
  );

  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PDKS_Raporu_${dateRange || new Date().toISOString().split("T")[0]}.csv`;
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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const colWidths = [40, 25, 35, 22, 22, 25, 18, 22, 22];
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
  const headers = ["Çalışan", "ID", "Departman", "İlk Giriş", "Son Çıkış", "Toplam", "Mesai", "İzin", "Durum"];
  let x = margin;

  headers.forEach((h, i) => {
    doc.setFont("helvetica", "bold");
    doc.rect(x, y, colWidths[i], headerHeight);
    doc.text(h, x + 2, y + 6);
    x += colWidths[i];
  });
  y += headerHeight;

  doc.setFont("helvetica", "normal");
  records.forEach((r, idx) => {
    if (y > pageHeight - 25) {
      doc.addPage("a4", "landscape");
      y = margin;
    }

    x = margin;
    const rowData = [
      r.name.substring(0, 25),
      r.employeeId,
      r.department.substring(0, 18),
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

  const fileName = `PDKS_Raporu_${dateRange || new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
