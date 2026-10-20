import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { EmployeeImportRow, ParsedEmployeeFile } from "./employeeExcelTypes";

export type ImportResult = FunctionReturnType<typeof api.employeeImport.importChunk>[number];
/** `employeeImport.importChunk` sarmalayıcısı; dryRun=true yazmadan doğrular. */
export type ImportChunkFn = (rows: EmployeeImportRow[], dryRun: boolean) => Promise<ImportResult[]>;

/** Sunucu sınırı: employeeImport.importChunk çağrı başına en fazla 100 satır kabul eder. */
export const IMPORT_CHUNK_SIZE = 100;
const byRow = (a: ImportResult, b: ImportResult) => a.rowNumber - b.rowNumber;

/** Yerel hatalı satırları ayırır, kalanını sunucuda dry-run eder; yalnız "created" dönenler aktarılabilir. */
export async function previewEmployeeImport(parsed: ParsedEmployeeFile, importChunk: ImportChunkFn) {
  const localErrors = new Map<number, string[]>();
  for (const issue of parsed.issues) localErrors.set(issue.rowNumber, [...(localErrors.get(issue.rowNumber) ?? []), issue.message]);
  const validRows = parsed.rows.filter((row) => !localErrors.has(row.rowNumber));
  const serverResults: ImportResult[] = [];
  for (let index = 0; index < validRows.length; index += IMPORT_CHUNK_SIZE) {
    serverResults.push(...await importChunk(validRows.slice(index, index + IMPORT_CHUNK_SIZE), true));
  }
  const creatable = new Set(serverResults.filter((result) => result.status === "created").map((result) => result.rowNumber));
  const localResults: ImportResult[] = [...localErrors].map(([rowNumber, messages]) => ({ rowNumber, status: "error", message: messages.join(" ") }));
  return {
    eligibleRows: validRows.filter((row) => creatable.has(row.rowNumber)),
    results: [...localResults, ...serverResults].sort(byRow),
  };
}

/**
 * Aktarılabilir satırları parça parça yazar. İptal bir sonraki parçadan önce durur; hata olursa o ana
 * kadarki sonuçlar korunur. Önizlemedeki created olmayan sonuçlar (hata/yinelenen) rapora taşınır.
 */
export async function runEmployeeImport(
  eligibleRows: EmployeeImportRow[],
  previewResults: ImportResult[],
  importChunk: ImportChunkFn,
  { isCancelled, onProgress }: { isCancelled: () => boolean; onProgress: (percent: number, results: ImportResult[]) => void },
): Promise<{ results: ImportResult[]; cancelled: boolean; error?: unknown }> {
  const completed = previewResults.filter((result) => result.status !== "created");
  // Yalnız gerçekten bir parça atlandıysa iptal sayılır; son parça sürerken basılan iptal "tamamlandı" kalır.
  let cancelled = false;
  try {
    for (let index = 0; index < eligibleRows.length; index += IMPORT_CHUNK_SIZE) {
      if (isCancelled()) { cancelled = true; break; }
      completed.push(...await importChunk(eligibleRows.slice(index, index + IMPORT_CHUNK_SIZE), false));
      onProgress(Math.round(Math.min(index + IMPORT_CHUNK_SIZE, eligibleRows.length) / eligibleRows.length * 100), [...completed].sort(byRow));
    }
    return { results: completed.sort(byRow), cancelled };
  } catch (error) {
    return { results: completed.sort(byRow), cancelled: false, error };
  }
}

/** "Hatalı satırları indir" sayfasının veri satırları (başlık hariç). */
export function importErrorReportRows(results: ImportResult[]): [number, string, string][] {
  return results.filter((result) => result.status === "error").map((result) => [result.rowNumber, "Hata", result.message]);
}
