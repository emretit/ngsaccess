import ExcelJS from "exceljs";

async function downloadExcel(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
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

export const exportReportsToExcel = {
  overtime: async (data: {
    year: number;
    month?: number;
    totalOvertimeHours: number;
    rows: { name: string; department: string; overtimeHours: number }[];
  }) => {
    const headers = ["Çalışan", "Departman", "Fazla Mesai (Saat)"];
    const rows = data.rows.map((r) => [r.name, r.department, r.overtimeHours]);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Fazla Mesai");
    ws.addRow(["Fazla Mesai Özet Raporu", "", ""]);
    ws.addRow([`Dönem: ${data.year}${data.month ? `-${String(data.month).padStart(2, "0")}` : ""}`, "", ""]);
    ws.addRow(["Toplam Fazla Mesai (saat):", data.totalOvertimeHours, ""]);
    ws.addRow([]);
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
    await downloadExcel(
      workbook,
      `Fazla_Mesai_${data.year}${data.month ? `_${String(data.month).padStart(2, "0")}` : ""}.xlsx`
    );
  },
  attendance: async (data: {
    year: number;
    month: number;
    workDaysInMonth: number;
    rows: { name: string; department: string; presentDays: number; leaveDays: number; absentDays: number; devamOrani: number }[];
  }) => {
    const headers = ["Çalışan", "Departman", "Devam Günü", "İzin Günü", "Devamsızlık", "Devam Oranı (%)"];
    const rows = data.rows.map((r) => [
      r.name,
      r.department,
      r.presentDays,
      r.leaveDays,
      r.absentDays,
      r.devamOrani,
    ]);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Devam");
    ws.addRow(["Devam ve Devamsızlık Özet Raporu", "", "", "", "", ""]);
    ws.addRow([`Dönem: ${data.year}-${String(data.month).padStart(2, "0")}`, "", "", "", "", ""]);
    ws.addRow(["İş günü sayısı:", data.workDaysInMonth, "", "", "", ""]);
    ws.addRow([]);
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
    await downloadExcel(workbook, `Devam_Ozet_${data.year}_${String(data.month).padStart(2, "0")}.xlsx`);
  },
  department: async (data: {
    year: number;
    month: number;
    hourlyRate: number | null;
    overtimeMultiplier: number;
    rows: { department: string; overtimeHours: number; employeeCount: number; cost: number }[];
  }) => {
    const headers = ["Departman", "Fazla Mesai (Saat)", "Çalışan Sayısı", "Tahmini Maliyet (₺)"];
    const rows = data.rows.map((r) => [r.department, r.overtimeHours, r.employeeCount, r.cost]);
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Maliyet");
    ws.addRow(["Departman Maliyet Analizi Raporu", "", "", ""]);
    ws.addRow([`Dönem: ${data.year}-${String(data.month).padStart(2, "0")}`, "", "", ""]);
    const rateLabel = data.hourlyRate !== null ? `${data.hourlyRate}₺` : "çalışan başına";
    ws.addRow([`Saatlik ücret: ${rateLabel}, Mesai çarpanı: ${data.overtimeMultiplier}x`, "", "", ""]);
    ws.addRow([]);
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow(r));
    await downloadExcel(workbook, `Departman_Maliyet_${data.year}_${String(data.month).padStart(2, "0")}.xlsx`);
  },
  shiftAssignments: async (data: {
    rows: {
      employee: string;
      department: string;
      shift: string;
      startDate: string;
      endDate: string;
      durationDays: number;
      weekPattern: string;
      status: string;
    }[];
  }) => {
    const headers = [
      "Çalışan",
      "Departman",
      "Vardiya",
      "Başlangıç",
      "Bitiş",
      "Süre (gün)",
      "Günler",
      "Durum",
    ];
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Vardiya Atamaları");
    ws.addRow(["Vardiya Atamaları", "", "", "", "", "", "", ""]);
    ws.addRow([`Çıkartma tarihi: ${new Date().toLocaleString("tr-TR")}`, "", "", "", "", "", "", ""]);
    ws.addRow([`Toplam kayıt: ${data.rows.length}`, "", "", "", "", "", "", ""]);
    ws.addRow([]);
    ws.addRow(headers);
    data.rows.forEach((r) =>
      ws.addRow([
        r.employee,
        r.department,
        r.shift,
        r.startDate,
        r.endDate,
        r.durationDays,
        r.weekPattern,
        r.status,
      ]),
    );
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadExcel(workbook, `Vardiya_Atamalari_${stamp}.xlsx`);
  },
};
