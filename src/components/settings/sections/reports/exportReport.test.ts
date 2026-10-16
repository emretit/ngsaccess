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
