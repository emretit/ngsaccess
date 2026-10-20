import type { Id } from "../../../../../convex/_generated/dataModel";
import { expect, it } from "vitest";
import { reportExportTable } from "./exportReport";

it("dosyanın başlığı ve adı sunucudan doğrulanan kapsamı taşır; belirsiz devam değerleri sıfır olmaz", () => {
  const table = reportExportTable({ type: "attendance", data: {
    year: 2026, month: 1, startDate: "2026-01-01", endDate: "2026-01-31", completedThrough: "2026-01-14", scopeLabel: "Tüm erişilebilir projeler: Ankara, İzmir", reliabilityNote: "İşe giriş tarihi bilinmiyor",
    rows: [{ employeeId: "e", name: "Ada", department: "Test", presentDays: 0, leaveDays: 0, expectedDays: null, absentDays: null, devamOrani: null, reliabilityNote: "Takvim eksik", projectId: "p" as Id<"projects"> }],
  } });
  expect(table.metadata[0]).toContain("Tüm erişilebilir projeler: Ankara, İzmir");
  expect(table.fileName).toContain("Ankara, İzmir");
  expect(table.metadata).toContain("İşe giriş tarihi bilinmiyor");
  expect(table.rows[0].slice(4)).toEqual(["Doğrulanamadı", "Doğrulanamadı", "Hesaplanamadı", "Takvim eksik"]);
  expect(table.metadata).toContain("Son tamamlanmış gün: 2026-01-14");
});

it("mesai dışa aktarımı yetkili kullanıcıda bilinmeyen ücreti çizgi, gerçek sıfırı sayı olarak gösterir", () => {
  const table = reportExportTable({ type: "overtime", data: {
    year: 2026, month: 6, startDate: "2026-06-01", endDate: "2026-06-30",
    scopeLabel: "Test", reliabilityNote: "Test", totalOvertimeHours: 10,
    totalOvertimePayTRY: null, overtimeMultiplier: null,
    rows: [
      { employeeId: "e", name: "Ada", department: "Arge", overtimeHours: 5, overtimePayTRY: null },
      { employeeId: "f", name: "Ali", department: "Arge", overtimeHours: 5, overtimePayTRY: 0 },
    ],
  } });
  expect(table.rows.map(row => row[3])).toEqual(["—", 0]);
});

it("departman dışa aktarımı yetkili kullanıcıda bilinmeyen maliyeti çizgi, gerçek sıfırı sayı olarak gösterir", () => {
  const table = reportExportTable({ type: "department", data: {
    year: 2026, month: 6, scopeLabel: "Test", reliabilityNote: "Test",
    hourlyRate: null, overtimeMultiplier: null,
    rows: [
      { department: "Arge", overtimeHours: 5, employeeCount: 1, cost: null },
      { department: "Üretim", overtimeHours: 5, employeeCount: 1, cost: 0 },
    ],
  } });
  expect(table.rows.map(row => row[3])).toEqual(["—", 0]);
});


it("ücret göremeyen kullanıcının mesai ve departman dosyalarında ücret sütunu hiç bulunmaz", () => {
  const overtime = reportExportTable({ type: "overtime", data: {
    year: 2026, month: 6, startDate: "2026-06-01", endDate: "2026-06-30",
    scopeLabel: "Test", reliabilityNote: "Test", totalOvertimeHours: 5,
    totalOvertimePayTRY: null, overtimeMultiplier: null,
    rows: [{ employeeId: "e", name: "Ada", department: "Arge", overtimeHours: 5, overtimePayTRY: null }],
  } }, false);
  expect(overtime.headers).toEqual(["Çalışan", "Departman", "Fazla Mesai (Saat)"]);
  expect(overtime.rows).toEqual([["Ada", "Arge", 5]]);
  const department = reportExportTable({ type: "department", data: {
    year: 2026, month: 6, scopeLabel: "Test", reliabilityNote: "Test",
    hourlyRate: null, overtimeMultiplier: null,
    rows: [{ department: "Arge", overtimeHours: 5, employeeCount: 1, cost: null }],
  } }, false);
  expect(department.headers).toEqual(["Departman", "Fazla Mesai (Saat)", "Çalışan Sayısı"]);
  expect(department.rows).toEqual([["Arge", 5, 1]]);
});
