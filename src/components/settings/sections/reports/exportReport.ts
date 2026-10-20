import type { FunctionReturnType } from "convex/server";
import { api } from "@/lib/convexApi";

type Report =
  | { type: "sgk"; data: FunctionReturnType<typeof api.reports.getSgkMonthlyReport> }
  | { type: "overtime"; data: FunctionReturnType<typeof api.reports.getOvertimeSummaryReport> }
  | { type: "attendance"; data: FunctionReturnType<typeof api.reports.getAttendanceSummaryReport> }
  | { type: "department"; data: FunctionReturnType<typeof api.reports.getDepartmentCostReport> };

export function reportExportTable(report: Report, canSeePay = true) {
  const titles = { sgk: "SGK Aylık Döküm", overtime: "Fazla Mesai Özet", attendance: "Devam Özeti", department: "Departman Maliyet" };
  const { data } = report;
  const period = `${data.year}${data.month ? `-${String(data.month).padStart(2, "0")}` : ""}`;
  const title = `${titles[report.type]} — ${data.scopeLabel}`;
  const metadata = [title, `Dönem: ${period} (TR saati)`, data.reliabilityNote];
  let headers: string[];
  let rows: (string | number | null)[][];
  switch (report.type) {
    case "sgk":
      headers = ["TC Kimlik No", "Ad Soyad", "Sicil No", "Departman", "Çalışma Günü", "Toplam Saat", "Fazla Mesai (Saat)", "İzin Günü"];
      rows = report.data.rows.map((r) => [r.tcNo, r.adSoyad, r.sicilNo, r.departman, r.calismaGunu, r.toplamSaat, r.fazlaMesaiSaat, r.izinGunu]);
      break;
    case "overtime":
      headers = ["Çalışan", "Departman", "Fazla Mesai (Saat)", "Mesai Ücreti (₺)"];
      rows = report.data.rows.map((r) => [r.name, r.department, r.overtimeHours, r.overtimePayTRY ?? "—"]);
      metadata.push(`Toplam fazla mesai: ${report.data.totalOvertimeHours} saat`);
      break;
    case "attendance":
      headers = ["Çalışan", "Departman", "Devam Günü", "İzin Günü", "Beklenen Gün (izin hariç)", "Devamsızlık", "Devam Oranı (%)", "Güvenilirlik Sınırı"];
      rows = report.data.rows.map((r) => [r.name, r.department, r.presentDays, r.leaveDays, r.expectedDays ?? "Doğrulanamadı", r.absentDays ?? "Doğrulanamadı", r.devamOrani ?? "Hesaplanamadı", r.reliabilityNote]);
      metadata.push(`Son tamamlanmış gün: ${report.data.completedThrough ?? "Bu dönemde tamamlanmış gün yok"}`);
      break;
    case "department":
      headers = ["Departman", "Fazla Mesai (Saat)", "Çalışan Sayısı", "Tahmini Maliyet (₺)"];
      rows = report.data.rows.map((r) => [r.department, r.overtimeHours, r.employeeCount, r.cost ?? "—"]);
      break;
  }
  if (!canSeePay && (report.type === "overtime" || report.type === "department")) {
    headers = headers.slice(0, -1);
    rows = rows.map(row => row.slice(0, -1));
  }
  const fileName = `${titles[report.type]}_${period}_${data.scopeLabel}`.replace(/[<>:"/\\|?*]/g, "_").split("").map((char) => char.charCodeAt(0) < 32 ? "_" : char).join("").slice(0, 180);
  return { title, metadata, headers, rows, fileName };
}

export async function exportScopedExcel(report: Report, canSeePay = true) {
  const table = reportExportTable(report, canSeePay);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rapor");
  for (const value of table.metadata) {
    const row = sheet.addRow([value]);
    sheet.mergeCells(row.number, 1, row.number, table.headers.length);
    row.alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(30, Math.ceil(value.length / 110) * 18);
  }
  sheet.addRow([]);
  sheet.addRow(table.headers).font = { bold: true };
  table.rows.forEach((row) => sheet.addRow(row));
  sheet.columns.forEach((column) => { column.width = 24; });
  sheet.eachRow((row) => { row.alignment = { wrapText: true, vertical: "top" }; });
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${table.fileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Tarayıcı fontu Türkçe proje/personel adlarını PDF'de de korur. */
export async function exportScopedSgkPdf(data: FunctionReturnType<typeof api.reports.getSgkMonthlyReport>) {
  const table = reportExportTable({ type: "sgk", data });
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const canvas = document.createElement("canvas");
  canvas.width = 2000;
  canvas.height = 1414;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF oluşturulamadı");
  const wrap = (value: string, width: number) => {
    const lines: string[] = [];
    let line = "";
    for (const word of value.split(/\s+/)) {
      if (line && context.measureText(`${line} ${word}`).width > width) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  };
  let y = 0;
  let page = 0;
  const savePage = () => {
    if (page++) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 297, 210);
  };
  const startPage = () => {
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black"; context.font = "24px sans-serif"; y = 50;
    for (const metadata of table.metadata) {
      for (const line of wrap(metadata, 1900)) { context.fillText(line, 50, y); y += 30; }
      y += 10;
    }
    context.font = "bold 20px sans-serif";
    table.headers.forEach((header, index) => context.fillText(header, 50 + index * 238, y, 228));
    y += 40; context.font = "20px sans-serif";
  };
  startPage();
  for (const row of table.rows) {
    const lines = row.map((cell) => wrap(String(cell ?? ""), 224));
    const height = Math.max(...lines.map((cell) => cell.length), 1) * 26 + 12;
    if (y + height > 1350) { savePage(); startPage(); }
    lines.forEach((cell, index) => cell.forEach((line, lineIndex) => context.fillText(line, 50 + index * 238, y + lineIndex * 26, 224)));
    y += height;
  }
  savePage();
  pdf.setProperties({ title: table.title });
  pdf.save(`${table.fileName}.pdf`);
}
