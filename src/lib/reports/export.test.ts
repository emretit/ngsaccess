import { describe, expect, it, vi } from 'vitest';
import { PDF_MAX_ROWS, PDF_ROW_LIMIT_MESSAGE, buildCsv, exportReport, pdfColumnChunks } from './export';
import { DAILY_COLUMNS, REPORTS, reportColumns, visibleReportColumns, type ReportColumn } from './registry';
import { flattenDailyRows } from './rows';
import { dailyCell, dailySource } from './testFixtures';
const pdfMocks = vi.hoisted(() => ({ imported: vi.fn(), notify: vi.fn(), create: vi.fn(function () { throw new Error('PDF import reached'); }) }));
vi.mock('jspdf', () => { pdfMocks.imported(); return { jsPDF: pdfMocks.create }; });
vi.mock('@/lib/notify', () => ({ notify: { info: pdfMocks.notify } }));
describe('report CSV', () => {
  const row = flattenDailyRows([dailySource([dailyCell()])])[0];
  it('includes BOM, semicolon separators and only selected visible columns', () => {
    const columns = visibleReportColumns(DAILY_COLUMNS, ['name', 'department']);
    expect(buildCsv(columns, [row])).toBe('\uFEFFAd Soyad;Departman\r\nAyşe Yılmaz;Üretim');
  });
  it('escapes delimiters, quotes, line breaks, null and formula prefixes', () => {
    const column: ReportColumn = { key: 'test', label: 'Başlık', defaultVisible: true, value: () => 'a;"b"\nc' };
    expect(buildCsv([column], [row])).toBe('\uFEFFBaşlık\r\n"a;""b""\nc"');
    expect(buildCsv([{ ...column, value: () => null }], [row])).toBe('\uFEFFBaşlık\r\n');
    expect(buildCsv([{ ...column, value: () => '=SUM(A1)' }], [row])).toContain("'=SUM(A1)");
    expect(buildCsv([{ ...column, value: () => 0 }], [row])).toContain('\r\n0');
  });
});

describe('report PDF safeguards', () => {
  it('repeats every visible identifier in all horizontal parts for each report', () => {
    for (const definition of REPORTS) {
      const columns = reportColumns(definition, Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`));
      const chunks = pdfColumnChunks(columns, definition.pinnedColumns);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(7);
        for (const key of definition.pinnedColumns ?? []) expect(chunk.map(column => column.key)).toContain(key);
      }
      expect(new Set(chunks.flat().map(column => column.key))).toEqual(new Set(columns.map(column => column.key)));
    }
  });
  it('skips hidden identifiers, handles empty columns and pinned-only tables', () => {
    const columns = DAILY_COLUMNS.filter(column => column.key !== 'name');
    const chunks = pdfColumnChunks(columns, ['date', 'name']);
    for (const chunk of chunks) {
      expect(chunk.map(column => column.key)).toContain('date');
      expect(chunk.map(column => column.key)).not.toContain('name');
    }
    expect(pdfColumnChunks([], ['name'])).toEqual([]);
    expect(pdfColumnChunks(DAILY_COLUMNS.slice(0, 2), ['date', 'name'])).toEqual([DAILY_COLUMNS.slice(0, 2)]);
  });
  it('refuses oversized PDF before the dynamic jsPDF import', async () => {
    const definition = REPORTS[0];
    const row = flattenDailyRows([dailySource([dailyCell()])])[0];
    await exportReport('pdf', definition, Array.from({ length: PDF_MAX_ROWS + 1 }, () => row), { from: '2026-10-01', to: '2026-10-31', columns: definition.columns });
    expect(pdfMocks.imported).not.toHaveBeenCalled();
    expect(pdfMocks.notify).toHaveBeenCalledWith(PDF_ROW_LIMIT_MESSAGE);
    await expect(exportReport('pdf', definition, Array.from({ length: PDF_MAX_ROWS }, () => row), { from: '2026-10-01', to: '2026-10-31', columns: definition.columns })).rejects.toThrow('PDF import reached');
    expect(pdfMocks.imported).toHaveBeenCalledTimes(1);
    expect(pdfMocks.create).toHaveBeenCalledTimes(1);
  });
});
