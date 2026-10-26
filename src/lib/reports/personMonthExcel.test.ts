import { expect, it } from 'vitest';
import { buildPersonMonthRows } from './personMonth';
import { dailyCell, dailySource } from './testFixtures';
import { getReport } from './registry';
import { buildPersonBlocks } from './excel/personBlocks';
import { DAY_FILLS, dayHeading } from './excel/common';

async function fixture() {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const def = getReport('aylik', 'aylik-ozet');
  const detail = dailyCell().detail;
  if (!def || !detail) throw new Error('Missing fixture');
  const source = dailySource([
    dailyCell({ date: '2026-10-03', status: 'weekend', payrollCode: 'HT', totalMinutes: 120, detail: { ...detail, shiftName: 'Sabah', dayType: 'weekend', pairs: [{ in: '08:00', out: '09:00' }, { in: '10:00', out: '11:00' }], breakMinutes: 60 } }),
    dailyCell({ date: '2026-10-04', totalMinutes: 0, status: 'leave', payrollCode: 'İZN', leaveType: 'annual', detail }),
  ]);
  source.name = '=FORMULA'; source.department = 'Ar-Ge';
  return { ExcelJS, workbook, input: { def, rows: buildPersonMonthRows([source]), meta: { from: '2026-10-03', to: '2026-10-04', projectName: 'Proje', columns: def.columns, days: ['2026-10-03', '2026-10-04'] } } };
}
it('creates real person blocks, vertical totals, two-level dates, fills and neutralized text', async () => {
  const { workbook, input, ExcelJS } = await fixture();
  buildPersonBlocks(workbook, input);
  const bytes = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  expect(reopened.worksheets.map(sheet => sheet.name)).toEqual(['Aylık Özet', 'Lejant']);
  const sheet = reopened.getWorksheet('Aylık Özet');
  if (!sheet) throw new Error('Missing sheet');
  expect(sheet.getCell('A1').value).toBe('Aylık Özet');
  expect(sheet.getCell('A2').value).toContain('İstanbul saati (UTC+3)');
  expect([sheet.getCell('E3').value, sheet.getCell('E4').value]).toEqual(['03.10', 'Cmt']);
  expect(sheet.getCell('A5').value).toBe('Ar-Ge');
  expect(sheet.getCell('A6').value).toBe("'=FORMULA");
  expect(sheet.getCell('A16').master.address).toBe('A6');
  const labels = Array.from({ length: 11 }, (_, index) => sheet.getCell(index + 6, 4).value);
  expect(labels).toEqual(['Vardiya', 'Durum', 'Giriş 1', 'Çıkış 1', 'Giriş 2', 'Çıkış 2', 'Çalışma', 'Fazla mesai', 'Geç', 'Erken çıkış', 'Mola']);
  expect(sheet.getCell('E8').value).toBe('08:00');
  expect(sheet.getCell('E10').value).toBe('10:00');
  expect(sheet.getCell('E12').value).toBe('2:00');
  expect(sheet.getCell('F7').value).toBe('Yıllık izin');
  expect(sheet.getCell('G3').value).toBe('Toplam');
  expect(sheet.getCell('H6').value).toBe('2:00');
  expect(sheet.getCell('H16').master.address).toBe('H6');
  const totalHeaders = sheet.getRow(4).values;
  expect(totalHeaders).toContain('Yıllık izin');
  const headerValues = Array.isArray(totalHeaders) ? totalHeaders : [];
  const leaveColumn = headerValues.indexOf('Yıllık izin');
  expect(sheet.getCell(6, leaveColumn).value).toBe(1);
  expect(sheet.getCell('E8').fill).toMatchObject({ fgColor: { argb: DAY_FILLS.weekend } });
  expect(sheet.getCell('E8').border.bottom?.style).toBe('thin');
  expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 4, ySplit: 4 });
  expect(sheet.pageSetup).toMatchObject({ orientation: 'landscape', fitToWidth: 1, printTitlesRow: '1:4' });
});
it('caps blocks at six pairs, retains null sides, and reports excess pairs', async () => {
  const { workbook, input } = await fixture();
  const row = input.rows[0];
  const cell = row?.days[0];
  if (!cell?.detail) throw new Error('Missing detail');
  cell.detail.pairs = Array.from({ length: 8 }, (_, index) => ({ in: index === 0 ? null : '10:00', out: index === 5 ? null : '11:00' }));
  buildPersonBlocks(workbook, input);
  const sheet = workbook.getWorksheet('Aylık Özet');
  if (!sheet) throw new Error('Missing sheet');
  expect(sheet.getCell('E8').value).toBe('—');
  expect(sheet.getCell('D19').value).toBe('Çıkış 6');
  expect(sheet.getCell('E19').value).toBe('— · +2 çift');
  expect(sheet.getColumn(4).values).not.toContain('Giriş 7');
});
it('formats day headings with Turkish short weekday names', () => {
  expect(dayHeading('2026-10-05')).toEqual({ date: '05.10', weekday: 'Pzt' });
});
