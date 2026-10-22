import { describe, expect, it, vi } from 'vitest';
import { collectAuditExport, auditExportRows } from './auditExport';
import { csvExport, safeRows, xlsxExport } from './spreadsheetExport';
import type { AuditRow } from '@/components/audit/auditState';
import type { Id } from '../../convex/_generated/dataModel';
const row: AuditRow = { _id: 'audit' as Id<'auditLog'>, _creationTime: 0, timestamp: Date.parse('2025-01-01T22:01:02Z'), userName: '=Test', projectName: 'Test', targetTable: 'employees', action: 'update', targetId: '@id', note: 'Not\nmetni', oldValue: { firstName: 'Ali' }, newValue: { firstName: 'Veli' } };
const page = (rows: AuditRow[], isDone: boolean, continueCursor: string) => ({ page: rows, isDone, continueCursor });
describe('audit export', () => {
  it('joins pages including empty filtered pages with cursors and progress', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(page([row], false, 'a')).mockResolvedValueOnce(page([], false, 'b')).mockResolvedValueOnce(page([row], true, 'c'));
    const progress = vi.fn();
    expect(await collectAuditExport(fetch, new AbortController().signal, progress)).toEqual({ rows: [row, row], truncated: false });
    expect(fetch.mock.calls).toEqual([[null], ['a'], ['b']]);
    expect(progress.mock.calls).toEqual([[1], [1], [2]]);
  });
  it('caps at 10000 and flags the confirmation only when extra matching rows exist', async () => {
    const rows = Array.from({ length: 10000 }, () => row);
    const fetch = vi.fn().mockResolvedValueOnce(page(rows, false, 'a')).mockResolvedValueOnce(page([], false, 'b')).mockResolvedValueOnce(page([row], true, 'c'));
    const result = await collectAuditExport(fetch, new AbortController().signal, () => {});
    expect(result.rows).toHaveLength(10000); expect(result.truncated).toBe(true);
    expect((await collectAuditExport(async () => page(rows, true, 'a'), new AbortController().signal, () => {})).truncated).toBe(false);
  });
  it('cancels before requests and after an in-flight page', async () => {
    const controller = new AbortController(); controller.abort();
    const fetch = vi.fn();
    await expect(collectAuditExport(fetch, controller.signal, () => {})).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
    const active = new AbortController();
    await expect(collectAuditExport(async () => { active.abort(); return page([row], true, 'a'); }, active.signal, () => {})).rejects.toThrow();
  });
  it('formats Turkish labels, İstanbul seconds, masked detail and neutralizes formula cells', () => {
    const rows = auditExportRows([row]);
    expect(rows[0]).toEqual(['Zaman','Kullanıcı','Proje','Tablo','İşlem','Kayıt','Özet/Değişiklik']);
    expect(rows[1]).toEqual(['02.01.2025 01:01:02','=Test','Test','Çalışan','Güncelleme','@id','Not metni; Ad: Ali → Veli']);
    expect(safeRows(rows)[1]?.[1]).toBe("'=Test");
    expect(csvExport([['=x','a;b','a"b','\tfoo']])).toBe('\uFEFF"\'=x";"a;b";"a""b";"\'\tfoo"');
  });
});

it('writes actual XLSX cells as neutralized text', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const blob = await xlsxExport([['Başlık'], ['=SUM(A1)'], ['@id']], 'Test');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  expect(workbook.worksheets[0]?.getCell('A2').value).toBe("'=SUM(A1)");
  expect(workbook.worksheets[0]?.getCell('A3').value).toBe("'@id");
});
