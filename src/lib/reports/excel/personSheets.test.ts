import { afterEach, expect, it, vi } from 'vitest';
import type ExcelJS from 'exceljs';
import { buildPersonSheets, PERSON_SHEETS_LIMIT_MESSAGE, PersonSheetsLimitError } from './personSheets';
import { buildPersonMonthRows } from '../personMonth';
import { dailyCell, dailySource } from '../testFixtures';
import { getReport } from '../registry';
import { DAY_FILLS, type ExcelLayoutInput } from './common';
import { notify } from '@/lib/notify';
import { exportReport } from '../export';

vi.mock('@/lib/notify', () => ({ notify: { info: vi.fn() }, errorMessage: (error: unknown) => String(error) }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function fixture(names = ['Ada', 'Grace']) {
  const { default: Excel } = await import('exceljs');
  const workbook = new Excel.Workbook();
  const def = getReport('aylik', 'kisi-devam-dokumu');
  const detail = dailyCell().detail;
  if (!def || !detail) throw new Error('Missing fixture');
  const rows = buildPersonMonthRows(names.map((name, index) => {
    const source = dailySource([
      dailyCell({ date: '2026-10-01', totalMinutes: 450, overtimeMinutes: 30, isLate: true, lateMinutes: 15,
        detail: { ...detail, shiftName: 'Gündüz', plannedStart: '08:00', plannedEnd: '17:00', isEarlyExit: true, earlyExitMinutes: 10, breakMinutes: 60,
          pairs: [{ in: null, out: '10:00' }, { in: '11:00', out: '12:00' }, { in: '13:00', out: null }, { in: '15:00', out: '16:00' }] } }),
      dailyCell({ date: '2026-10-02', status: 'leave', payrollCode: 'İZN', leaveType: 'annual', totalMinutes: 0 }),
      dailyCell({ date: '2026-10-03', status: 'weekend', payrollCode: 'HT', totalMinutes: 120, detail: { ...detail, dayType: 'weekend', pairs: [{ in: '22:00', out: '06:00' }], shiftName: 'Gece', plannedStart: '22:00', plannedEnd: '06:00' } }),
      dailyCell({ date: '2026-10-04', status: 'future', totalMinutes: 999 }),
      dailyCell({ date: '2026-10-05', status: 'noData', totalMinutes: 999 }),
    ]);
    return { ...source, name, id: `person-${index}`, department: 'Ar-Ge', payrollEmployeeCode: `B-${index}` };
  }));
  const input: ExcelLayoutInput = { def, rows, meta: { from: '2026-10-01', to: '2026-10-05', projectName: 'Proje', columns: def.columns } };
  return { Excel, workbook, input, rows };
}
function findRow(sheet: ExcelJS.Worksheet, label: string): number {
  for (let index = 1; index <= sheet.rowCount; index++) if (sheet.getCell(index, 1).value === label) return index;
  throw new Error(`Missing row ${label}`);
}
it('writes a real sheet per person plus the final legend, with summary and detailed evidence', async () => {
  const { Excel, workbook, input, rows } = await fixture();
  buildPersonSheets(workbook, input);
  const reopened = new Excel.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  expect(reopened.worksheets.map(sheet => sheet.name)).toEqual(['Ada', 'Grace', 'Lejant']);
  const sheet = reopened.getWorksheet('Ada');
  const totals = rows[0]?.totals;
  if (!sheet || !totals) throw new Error('Missing sheet');
  expect(sheet.getCell('A1').value).toContain('Ad Soyad: Ada · Departman: Ar-Ge · Bordro kodu: B-0 · Dönem: 01.10.2026 – 05.10.2026');
  expect(sheet.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFFFEB83' } });
  expect(sheet.getCell('Q1').master.address).toBe('A1');
  expect(sheet.getCell('A3').value).toBe('Hafta içi');
  expect(sheet.getCell('B3').value).toBe(totals.workdays);
  expect(sheet.getCell('B4').value).toBe(totals.weekendDays);
  expect(sheet.getCell('B5').value).toBe(totals.holidayDays);
  expect(sheet.getCell('C6').value).toBe(totals.workedDays + totals.holidayWorkedDays);
  expect(sheet.getCell('D6').value).toBe('9:30');
  expect(sheet.getCell('E6').value).toBe('0:30');
  expect(sheet.getCell('M3').value).toBe('1 gün / 15 dk');
  expect(sheet.getCell('M4').value).toBe('1 gün / 10 dk');
  expect(sheet.getCell('M6').value).toBe('1:00');
  expect(sheet.getCell('A10').value).toBe('Yıllık izin'); expect(sheet.getCell('E10').value).toBe(1);
  const title = findRow(sheet, 'Günlük döküm');
  const header = title + 1, first = title + 2;
  expect(sheet.getCell(first, 5).value).toBe('—');
  expect(sheet.getCell(first, 10).value).toBe('— · +1 çift');
  expect(sheet.getCell(first, 11).value).toBe('7:30');
  expect(sheet.getCell(first, 13).value).toBe('0:15');
  expect(sheet.getCell(first + 1, 17).value).toBe('Yıllık izin');
  expect(sheet.getCell(first + 2, 4).value).toBe('22:00–06:00');
  expect(sheet.getCell(first + 2, 5).value).toBe('22:00');
  expect(sheet.getCell(first + 2, 6).value).toBe('06:00');
  expect(sheet.getCell(first + 2, 5).fill).toMatchObject({ fgColor: { argb: DAY_FILLS.weekend } });
  for (const offset of [3, 4]) {
    expect(sheet.getCell(first + offset, 11).value).toBe('—');
    expect(sheet.getCell(first + offset, 16).value).toBe('—');
    expect(sheet.getCell(first + offset, 11).font.color?.argb).toBe('FF858B94');
  }
  // The overnight exit stays on the shift's work-date row; no next-day duplicate is generated.
  expect(sheet.rowCount).toBe(first + 5);
  expect(sheet.getCell(first + 5, 11).value).toBe('9:30');
  expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: header });
  expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: 'portrait', fitToWidth: 1, printTitlesRow: `${header}:${header}` });
  const legend = reopened.getWorksheet('Lejant');
  expect(legend?.getColumn(2).values).toContain('Mola = okutma çiftleri arasındaki boşluk; vardiya parçaları arası boşluk sayılmaz.');
});
it('cleans, truncates and disambiguates sheet names including reserved legend and empty names', async () => {
  const { workbook, input } = await fixture(['A/B:*?[]\\', 'AB', 'ab', '', 'Lejant', 'x'.repeat(40), 'x'.repeat(40), 'ISIM', 'isim']);
  buildPersonSheets(workbook, input);
  expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['AB', 'AB (2)', 'ab (3)', 'Kişi 4', 'Lejant (2)', 'x'.repeat(31), `${'x'.repeat(27)} (2)`, 'ISIM', 'isim (2)', 'Lejant']);
});
it('never leaves an apostrophe at the end of a truncated sheet name', async () => {
  const { workbook, input } = await fixture([`${'a'.repeat(30)}'Connor`]);
  buildPersonSheets(workbook, input);
  expect(workbook.worksheets[0]?.name).toBe('a'.repeat(30));
});
it('keeps formula-like names as safe text and renders the flexible plan and no-leave state', async () => {
  const { workbook, input, rows } = await fixture(['=FORMULA']);
  const row = rows[0]; const cell = row?.days[0];
  if (!row || !cell?.detail) throw new Error('Missing fixture');
  row.days = [{ ...cell, scheduleType: 'flexible', detail: { ...cell.detail, plannedStart: 'Esnek', plannedEnd: 'Esnek', pairs: [] } }];
  row.totals.leaveByType = {}; row.totals.leaveDays = 0;
  buildPersonSheets(workbook, input);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Missing sheet');
  expect(typeof sheet.getCell('A1').value).toBe('string');
  expect(sheet.getCell('A1').value).toContain('Ad Soyad: =FORMULA');
  expect(sheet.getCell('A10').value).toBe('İzin yok');
  const first = findRow(sheet, 'Günlük döküm') + 2;
  expect(sheet.getCell(first, 4).value).toBe('Esnek');
  expect(sheet.getCell(first, 5).value).toBe('—');
  sheet.eachRow(excelRow => excelRow.eachCell(cell => expect(cell.formula).toBeUndefined()));
});
it('warns and aborts a 301-person export before any sheet, buffer or download is produced', async () => {
  const { workbook, input, rows } = await fixture(['Ada']);
  const person = rows[0];
  if (!person) throw new Error('Missing person');
  const input301 = { ...input, rows: Array.from({ length: 301 }, (_, index) => ({ ...person, id: String(index) })) };
  expect(() => buildPersonSheets(workbook, input301)).toThrow(PersonSheetsLimitError);
  expect(workbook.worksheets).toHaveLength(0);
  expect(notify.info).toHaveBeenCalledWith(PERSON_SHEETS_LIMIT_MESSAGE);
  const createObjectURL = vi.fn(); vi.stubGlobal('URL', { createObjectURL });
  await expect(exportReport('excel', input.def, input301.rows, input.meta)).rejects.toThrow(PERSON_SHEETS_LIMIT_MESSAGE);
  expect(createObjectURL).not.toHaveBeenCalled();
});
