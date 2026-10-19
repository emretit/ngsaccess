import { afterEach, expect, it, vi } from 'vitest';
import { exportReport } from './export';
import { getReport, reportColumns } from './registry';
import { flattenDailyRows } from './rows';
import { dailyCell, dailySource } from './testFixtures';
const excel = vi.hoisted(() => ({ rows: [] as unknown[][], columns: [] as { width?: number }[] }));
vi.mock('exceljs', () => ({ default: { Workbook: class {
  addWorksheet() { return { addRow: (row: unknown[]) => { excel.rows.push(row); excel.columns = Array.from({ length: Math.max(row.length, excel.columns.length) }, () => ({})); }, getRow: () => ({}), get columns() { return excel.columns; } }; }
  xlsx = { writeBuffer: async () => new ArrayBuffer(0) };
} } }));
afterEach(() => { vi.unstubAllGlobals(); excel.rows = []; excel.columns = []; });
it('writes Turkish period headings and numeric duration companion columns to Excel', async () => {
  const definition = getReport('gunluk', 'calisma-suresi'); if (!definition) throw new Error('Missing report');
  const row = flattenDailyRows([dailySource([dailyCell()])])[0];
  vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }) });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:report', revokeObjectURL: vi.fn() });
  await exportReport('excel', definition, [row], { from: '2026-10-01', to: '2026-10-19', columns: reportColumns(definition).filter(column => column.defaultVisible) });
  expect(excel.rows[1]).toContain('01.10.2026 – 19.10.2026');
  const duration = excel.rows[3].indexOf('Toplam süre (dk)'); const overtime = excel.rows[3].indexOf('Fazla mesai (dk)');
  expect(excel.rows[4][duration]).toBe(535); expect(excel.rows[4][overtime]).toBe(0);
  expect(excel.columns[1].width).toBe(28);
});
