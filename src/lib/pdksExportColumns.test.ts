import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { availablePDKSColumns, defaultPDKSPreferences, movePDKSColumn, PDKS_EXPORT_COLUMNS, readPDKSPreferences, savePDKSPreferences, selectedPDKSColumns, togglePDKSColumn } from './pdksExportColumns';
import { columnStorageKey } from './reports/columns';
import { buildPDKSCsv, buildPDKSExportTable, exportToCsv, exportToExcel, exportToPdf, type PDKSExportRecord } from '@/utils/pdksExport';
const mocks = vi.hoisted(() => ({ excelRows: [] as unknown[][], pdfText: [] as string[], blob: null as Blob | null }));
vi.mock('exceljs', () => ({ default: { Workbook: class {
  addWorksheet() { return { addRow: (row: unknown[]) => mocks.excelRows.push(row), columns: [] }; }
  xlsx = { writeBuffer: async () => new ArrayBuffer(0) };
} } }));
vi.mock('jspdf', () => ({ jsPDF: class {
  internal = { pageSize: { getHeight: () => 210, getWidth: () => 297 } };
  text(value: string | string[]) { mocks.pdfText.push(Array.isArray(value) ? value.join(' ') : value); }
  splitTextToSize(value: string) { return [value]; }
  setFontSize() {} setTextColor() {} setFont() {} rect() {} addPage() {} save() {}
} }));
export const record: PDKSExportRecord = { id: 'row', employeeId: 'employee', name: 'Ayşe', cardNumber: '123', payrollEmployeeCode: 'P01', department: 'Üretim', payrollCode: 'N', firstEntry: '08:00', lastExit: '17:00', totalMinutes: 480, totalHours: 'legacy', overtimeMinutes: 60, overtime: 'legacy', leaveType: '—', status: 'present' };
const headers = ['Çalışan', 'Kart no', 'Bordro Kodu', 'Departman', 'Gün Kodu', 'İlk Giriş', 'Son Çıkış', 'Toplam Saat', 'Mesai', 'İzin', 'Durum'];
const scope = { projectId: 'project-a', userId: 'user-a' };
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map(); mocks.excelRows = []; mocks.pdfText = []; mocks.blob = null;
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }) });
  vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => { mocks.blob = blob; return 'blob:test'; }, revokeObjectURL: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
describe('PDKS serializers', () => {
  it('golden: no selection preserves legacy Excel, CSV and PDF headers and cell content', async () => {
    const cells = ['Ayşe', '123', 'P01', 'Üretim', 'N', '08:00', '17:00', '08 sa 00 dk', '01 sa 00 dk', '—', 'Mevcut'];
    expect(buildPDKSExportTable([record]).headers).toEqual(headers);
    expect(buildPDKSExportTable([record]).rows).toEqual([cells]);
    await exportToExcel([record]);
    expect(mocks.excelRows).toEqual([headers, cells]);
    exportToCsv([record]);
    expect(await mocks.blob?.text()).toBe(headers.join(',') + '\n' + cells.join(','));
    const csvBytes = new Uint8Array(await mocks.blob?.arrayBuffer() ?? new ArrayBuffer(0));
    expect([...csvBytes.slice(0, 3)]).toEqual([239, 187, 191]);
    await exportToPdf([record]);
    expect(mocks.pdfText).toEqual(['PDKS Raporu', 'Çalışan', 'Kart no', 'Bordro', 'Departman', 'Gün', 'İlk Giriş', 'Son Çıkış', 'Toplam', 'Mesai', 'İzin', 'Durum', ...cells]);
  });
  it('keeps legacy PDF labels when explicit selection equals the default', async () => {
    await exportToPdf([record], defaultPDKSPreferences());
    expect(mocks.pdfText.slice(1, 12)).toEqual(['Çalışan', 'Kart no', 'Bordro', 'Departman', 'Gün', 'İlk Giriş', 'Son Çıkış', 'Toplam', 'Mesai', 'İzin', 'Durum']);
  });
  it('uses the same removed and reordered columns in Excel, CSV and PDF without extra minute columns', async () => {
    const options = { orderedColumnKeys: ['overtime', 'name', 'department'] };
    await exportToExcel([record], options);
    expect(mocks.excelRows).toEqual([['Mesai', 'Çalışan', 'Departman'], ['01 sa 00 dk', 'Ayşe', 'Üretim']]);
    expect(buildPDKSCsv([record], options)).toBe('\uFEFFMesai,Çalışan,Departman\n01 sa 00 dk,Ayşe,Üretim');
    await exportToPdf([record], options);
    expect(mocks.pdfText).toEqual(['PDKS Raporu', 'Mesai', 'Çalışan', 'Departman', '01 sa 00 dk', 'Ayşe', 'Üretim']);
  });
  it.each([',', ';', '\t'] as const)('escapes delimiter %j, quotes and newlines and neutralizes formulas', delimiter => {
    const value = `=SUM(1${delimiter}2)"\nnext`;
    expect(buildPDKSCsv([{ ...record, name: value }], { orderedColumnKeys: ['name'], delimiter })).toBe(`\uFEFFÇalışan\n"'=SUM(1${delimiter}2)""\nnext"`);
  });
  it.each(['=SUM(1)', '+1', '-1', '@test'])('neutralizes %s in spreadsheet formats, PDF keeps raw text', async name => {
    const options = { orderedColumnKeys: ['name'] };
    await exportToExcel([{ ...record, name }], options);
    await exportToPdf([{ ...record, name }], options);
    expect(mocks.excelRows[1]).toEqual([`'${name}`]);
    expect(mocks.pdfText[mocks.pdfText.length - 1]).toBe(name);
    expect(buildPDKSCsv([{ ...record, name }], options)).toContain(`'${name}`);
  });
  it('keeps the bare "-" placeholder unchanged in every format', async () => {
    const options = { orderedColumnKeys: ['name'] };
    await exportToExcel([{ ...record, name: '-' }], options);
    expect(mocks.excelRows[1]).toEqual(['-']);
    expect(buildPDKSCsv([{ ...record, name: '-' }], options)).toBe('\uFEFFÇalışan\n-');
  });
  it('retains legacy duration fallbacks and card fallback', () => {
    const row = { ...record, cardNumber: undefined, totalMinutes: undefined, overtimeMinutes: undefined };
    expect(buildPDKSExportTable([row]).rows[0]).toEqual(['Ayşe', 'employee', 'P01', 'Üretim', 'N', '08:00', '17:00', 'legacy', 'legacy', '—', 'Mevcut']);
  });
});
describe('PDKS preferences and catalog', () => {
  it('round trips normal selection, order, format and delimiter without storing sensitive choices or row values', () => {
    savePDKSPreferences({ version: 1, orderedColumnKeys: ['department', 'name', 'cardNumber'], format: 'CSV', delimiter: ';' }, scope);
    const saved = storage.get(columnStorageKey('pdks-export-v1', scope));
    expect(saved).not.toContain('cardNumber'); expect(saved).not.toContain('Ayşe');
    expect(readPDKSPreferences(scope)).toEqual({ version: 1, orderedColumnKeys: ['department', 'cardNumber', 'payrollEmployeeCode', 'name'], format: 'CSV', delimiter: ';' });
    expect(readPDKSPreferences({ ...scope, projectId: 'b' })).toEqual(defaultPDKSPreferences());
    expect(readPDKSPreferences({ ...scope, userId: 'b' })).toEqual(defaultPDKSPreferences());
  });
  it.each(['broken', '{"version":2,"orderedColumnKeys":[]}', 'null', '{}'])('falls back on malformed or incompatible preference %s', raw => {
    storage.set(columnStorageKey('pdks-export-v1', scope), raw);
    expect(readPDKSPreferences(scope)).toEqual(defaultPDKSPreferences());
  });
  it('removes unknown keys, duplicates and restored sensitive ordering while preserving sensitive defaults', () => {
    storage.set(columnStorageKey('pdks-export-v1', scope), JSON.stringify({ version: 1, orderedColumnKeys: ['cardNumber', 'gone', 'name', 'name'], delimiter: 'bad', format: 'bad' }));
    expect(readPDKSPreferences(scope)).toEqual({ ...defaultPDKSPreferences(), orderedColumnKeys: ['name', 'cardNumber', 'payrollEmployeeCode'] });
  });
  it('enforces a nonempty selection, moves columns and resets to legacy defaults', () => {
    expect(togglePDKSColumn(['name'], 'name')).toEqual(['name']);
    expect(togglePDKSColumn(['name'], 'department')).toEqual(['name', 'department']);
    expect(togglePDKSColumn(['name', 'department'], 'name')).toEqual(['department']);
    expect(movePDKSColumn(['name', 'department'], 'department', -1)).toEqual(['department', 'name']);
    expect(movePDKSColumn(['name'], 'name', -1)).toEqual(['name']);
    expect(selectedPDKSColumns([]).map(c => c.label)).toEqual(headers);
    expect(selectedPDKSColumns(['unknown']).map(c => c.label)).toEqual(headers);
  });
  it('lists only existing row fields, and filters pay columns for non-admin users', () => {
    expect(PDKS_EXPORT_COLUMNS.every(c => c.key in record)).toBe(true);
    const pay = { ...PDKS_EXPORT_COLUMNS[0], key: 'pay', requiresPay: true };
    expect(availablePDKSColumns(false, [pay])).toEqual([]);
    expect(availablePDKSColumns(true, [pay])).toEqual([pay]);
  });
  it('keeps preferences usable if browser storage fails or scope is absent', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    expect(readPDKSPreferences(scope)).toEqual(defaultPDKSPreferences());
    expect(() => savePDKSPreferences(defaultPDKSPreferences(), scope)).not.toThrow();
    expect(readPDKSPreferences()).toEqual(defaultPDKSPreferences());
  });
});
