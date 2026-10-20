import { describe, expect, it, vi } from "vitest";
import type { EmployeeImportRow } from "./employeeExcelTypes";
import { importErrorReportRows, previewEmployeeImport, runEmployeeImport, type ImportChunkFn, type ImportResult } from "./employeeImportFlow";

const row = (rowNumber: number): EmployeeImportRow => ({ rowNumber, firstName: "Ada", lastName: `K${rowNumber}`, email: `k${rowNumber}@example.com`, cardNumber: String(1000 + rowNumber) });
const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(from + i));
const created = (r: EmployeeImportRow): ImportResult => ({ rowNumber: r.rowNumber, status: "created", message: "Kişi oluşturuldu" });

describe("employeeImportFlow", () => {
  it("dry-run önizlemesi: yerel hatalar sunucuya gitmez, yinelenen ve hatalılar aktarılabilir listeden düşer", async () => {
    const importChunk = vi.fn<ImportChunkFn>(async (chunk) => chunk.map((r) =>
      r.rowNumber === 3 ? { rowNumber: 3, status: "skippedDuplicate", message: "Kart zaten kayıtlı" }
        : r.rowNumber === 4 ? { rowNumber: 4, status: "error", message: "Departman bulunamadı" }
          : created(r)));
    const preview = await previewEmployeeImport({
      rows: rows(2, 4),
      issues: [{ rowNumber: 5, message: "E-posta geçersiz." }, { rowNumber: 5, message: "Kart no boş." }],
    }, importChunk);

    expect(importChunk).toHaveBeenCalledTimes(1);
    expect(importChunk.mock.calls[0][0].map((r) => r.rowNumber)).toEqual([2, 3, 4]);
    expect(importChunk.mock.calls[0][1]).toBe(true);
    expect(preview.eligibleRows.map((r) => r.rowNumber)).toEqual([2]);
    expect(preview.results.map((r) => [r.rowNumber, r.status])).toEqual([[2, "created"], [3, "skippedDuplicate"], [4, "error"], [5, "error"]]);
    expect(preview.results[3].message).toBe("E-posta geçersiz. Kart no boş.");
  });

  it("önizleme 100'lük parçalarla doğrular", async () => {
    const importChunk = vi.fn<ImportChunkFn>(async (chunk) => chunk.map(created));
    const preview = await previewEmployeeImport({ rows: rows(2, 250), issues: [] }, importChunk);
    expect(importChunk.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 50]);
    expect(preview.eligibleRows).toHaveLength(250);
  });

  it("içe aktarma: yazar, ilerleme bildirir ve önizlemedeki hata/yinelenenleri rapora taşır", async () => {
    const eligible = rows(2, 150);
    const preview: ImportResult[] = [...eligible.map(created), { rowNumber: 200, status: "error", message: "Ad boş." }];
    const importChunk = vi.fn<ImportChunkFn>(async (chunk) => chunk.map(created));
    const onProgress = vi.fn();
    const outcome = await runEmployeeImport(eligible, preview, importChunk, { isCancelled: () => false, onProgress });

    expect(importChunk.mock.calls.map(([chunk, dryRun]) => [chunk.length, dryRun])).toEqual([[100, false], [50, false]]);
    expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([67, 100]);
    expect(outcome.cancelled).toBe(false);
    expect(outcome.error).toBeUndefined();
    expect(outcome.results).toHaveLength(151);
    expect(outcome.results[outcome.results.length - 1]).toMatchObject({ rowNumber: 200, status: "error" });
  });

  it("iptal bir sonraki parçadan önce durur ve yazılanları korur", async () => {
    let cancel = false;
    const importChunk = vi.fn<ImportChunkFn>(async (chunk) => { cancel = true; return chunk.map(created); });
    const outcome = await runEmployeeImport(rows(2, 250), [], importChunk, { isCancelled: () => cancel, onProgress: () => {} });
    expect(importChunk).toHaveBeenCalledTimes(1);
    expect(outcome.cancelled).toBe(true);
    expect(outcome.results).toHaveLength(100);
  });

  it("son parça sürerken basılan iptal tamamlanmış aktarımı iptal saymaz", async () => {
    let cancel = false;
    const importChunk = vi.fn<ImportChunkFn>(async (chunk) => { cancel = true; return chunk.map(created); });
    const outcome = await runEmployeeImport(rows(2, 50), [], importChunk, { isCancelled: () => cancel, onProgress: () => {} });
    expect(outcome.cancelled).toBe(false);
    expect(outcome.results).toHaveLength(50);
  });

  it("sunucu hatasında o ana kadarki sonuçları ve hatayı döner; hata raporu yalnız hatalı satırları içerir", async () => {
    const importChunk = vi.fn<ImportChunkFn>()
      .mockImplementationOnce(async (chunk) => chunk.map((r) => r.rowNumber === 3 ? { rowNumber: 3, status: "error", message: "Kart başka kişide" } : created(r)))
      .mockRejectedValueOnce(new Error("Bağlantı koptu"));
    const outcome = await runEmployeeImport(rows(2, 150), [], importChunk, { isCancelled: () => false, onProgress: () => {} });

    expect(outcome.error).toBeInstanceOf(Error);
    expect(outcome.cancelled).toBe(false);
    expect(outcome.results).toHaveLength(100);
    expect(importErrorReportRows(outcome.results)).toEqual([[3, "Hata", "Kart başka kişide"]]);
  });
});
