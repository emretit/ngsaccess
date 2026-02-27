import * as XLSX from "xlsx";

export const exportReportsToExcel = {
  overtime: (data: {
    year: number;
    month?: number;
    totalOvertimeHours: number;
    rows: { name: string; department: string; overtimeHours: number }[];
  }) => {
    const headers = ["Çalışan", "Departman", "Fazla Mesai (Saat)"];
    const rows = data.rows.map((r) => [r.name, r.department, r.overtimeHours]);
    const ws = XLSX.utils.aoa_to_sheet([
      ["Fazla Mesai Özet Raporu", "", ""],
      [`Dönem: ${data.year}${data.month ? `-${String(data.month).padStart(2, "0")}` : ""}`, "", ""],
      ["Toplam Fazla Mesai (saat):", data.totalOvertimeHours, ""],
      [],
      headers,
      ...rows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fazla Mesai");
    XLSX.writeFile(
      wb,
      `Fazla_Mesai_${data.year}${data.month ? `_${String(data.month).padStart(2, "0")}` : ""}.xlsx`
    );
  },
  attendance: (data: {
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
    const ws = XLSX.utils.aoa_to_sheet([
      ["Devam ve Devamsızlık Özet Raporu", "", "", "", "", ""],
      [`Dönem: ${data.year}-${String(data.month).padStart(2, "0")}`, "", "", "", "", ""],
      ["İş günü sayısı:", data.workDaysInMonth, "", "", "", ""],
      [],
      headers,
      ...rows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Devam");
    XLSX.writeFile(wb, `Devam_Ozet_${data.year}_${String(data.month).padStart(2, "0")}.xlsx`);
  },
  department: (data: {
    year: number;
    month: number;
    hourlyRate: number;
    overtimeMultiplier: number;
    rows: { department: string; overtimeHours: number; employeeCount: number; cost: number }[];
  }) => {
    const headers = ["Departman", "Fazla Mesai (Saat)", "Çalışan Sayısı", "Tahmini Maliyet (₺)"];
    const rows = data.rows.map((r) => [r.department, r.overtimeHours, r.employeeCount, r.cost]);
    const ws = XLSX.utils.aoa_to_sheet([
      ["Departman Maliyet Analizi Raporu", "", "", ""],
      [`Dönem: ${data.year}-${String(data.month).padStart(2, "0")}`, "", "", ""],
      [`Saatlik ücret: ${data.hourlyRate}₺, Mesai çarpanı: ${data.overtimeMultiplier}x`, "", "", ""],
      [],
      headers,
      ...rows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Maliyet");
    XLSX.writeFile(wb, `Departman_Maliyet_${data.year}_${String(data.month).padStart(2, "0")}.xlsx`);
  },
};
