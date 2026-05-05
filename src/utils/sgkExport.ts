import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";

export interface SgkReportRow {
  tcNo: string;
  adSoyad: string;
  sicilNo: string;
  departman: string;
  calismaGunu: number;
  toplamSaat: number;
  fazlaMesaiSaat: number;
  izinGunu: number;
}

export interface SgkReportData {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  rows: SgkReportRow[];
}

/**
 * SGK aylık döküm raporunu Excel formatında dışa aktarır
 */
export async function exportSgkToExcel(data: SgkReportData): Promise<void> {
  const headers = [
    "TC Kimlik No",
    "Ad Soyad",
    "Sicil No",
    "Departman",
    "Çalışma Günü",
    "Toplam Saat",
    "Fazla Mesai (Saat)",
    "İzin Günü",
  ];

  const rows = data.rows.map((r) => [
    r.tcNo,
    r.adSoyad,
    r.sicilNo,
    r.departman,
    r.calismaGunu,
    r.toplamSaat,
    r.fazlaMesaiSaat,
    r.izinGunu,
  ]);

  const workbook = new ExcelJS.Workbook();
  const sheetName = `SGK_${data.year}_${String(data.month).padStart(2, "0")}`;
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.addRow(headers);
  rows.forEach((r) => worksheet.addRow(r));

  worksheet.columns = [
    { width: 12 },
    { width: 25 },
    { width: 12 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 10 },
  ];

  const fileName = `SGK_Aylik_Dokum_${data.year}_${String(data.month).padStart(2, "0")}.xlsx`;
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
 * SGK aylık döküm raporunu PDF formatında dışa aktarır (SGK standartlarına uygun)
 */
export function exportSgkToPdf(data: SgkReportData): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const colWidths = [28, 45, 22, 35, 22, 22, 28, 18];
  const rowHeight = 8;
  const headerHeight = 10;

  let y = margin;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SGK Aylık Döküm Raporu", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Dönem: ${data.startDate} - ${data.endDate}`,
    margin,
    y
  );
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setFontSize(9);
  const headers = [
    "TC Kimlik No",
    "Ad Soyad",
    "Sicil No",
    "Departman",
    "Çalışma Günü",
    "Toplam Saat",
    "Fazla Mesai",
    "İzin Günü",
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
  data.rows.forEach((r) => {
    if (y > pageHeight - 25) {
      doc.addPage("a4", "landscape");
      y = margin;
    }

    x = margin;
    const rowData = [
      r.tcNo,
      r.adSoyad.substring(0, 28),
      r.sicilNo,
      r.departman.substring(0, 20),
      String(r.calismaGunu),
      String(r.toplamSaat),
      String(r.fazlaMesaiSaat),
      String(r.izinGunu),
    ];

    rowData.forEach((cell, i) => {
      doc.rect(x, y, colWidths[i], rowHeight);
      doc.text(String(cell), x + 2, y + 5);
      x += colWidths[i];
    });
    y += rowHeight;
  });

  const fileName = `SGK_Aylik_Dokum_${data.year}_${String(data.month).padStart(2, "0")}.pdf`;
  doc.save(fileName);
}
