import { expect, it } from 'vitest';
import type ExcelJS from 'exceljs';
import { buildStatusMatrix } from './statusMatrix';
import { DAY_FILLS } from './common';
import { addTableSheet } from '../export';
import { getReport, reportColumns } from '../registry';
import { buildMonthlyStatusRows, countAttendance, flattenDailyRows } from '../rows';
import { dailyCell, dailySource, monthlySheet } from '../testFixtures';

async function fixture() {
  const { default: Excel } = await import('exceljs');
  const workbook = new Excel.Workbook();
  const def = getReport('aylik', 'aylik-durum');
  if (!def) throw new Error('Missing report');
  const source = monthlySheet();
  const person = source.rows[0];
  const base = person?.cells[0];
  if (!person || !base) throw new Error('Missing person');
  source.days = Array.from({ length: 31 }, (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`);
  person.name = '=FORMULA'; person.department = 'Ar-Ge';
  person.cells = [
    { ...base, date: '2026-10-01', payrollCode: 'DV', status: 'absent', totalMinutes: 0 },
    { ...base, date: '2026-10-02', payrollCode: 'İZN', status: 'leave', totalMinutes: 0 },
    { ...base, date: '2026-10-03', payrollCode: 'HT', status: 'weekend', classification: 'weekend', totalMinutes: 0 },
    { ...base, date: '2026-10-04', payrollCode: 'RT', status: 'holiday', classification: 'holiday', totalMinutes: 0 },
    { ...base, date: '2026-10-05', payrollCode: 'N', status: 'incomplete', durationMeasured: false },
    { ...base, date: '2026-10-06', isLate: true, isEarlyExit: true, isManual: true },
    { ...base, date: '2026-10-07', isLate: true },
    { ...base, date: '2026-10-08', isEarlyExit: true },
    { ...base, date: '2026-10-09', isManual: true },
    { ...base, date: '2026-10-10', status: 'future' },
    { ...base, date: '2026-10-11', status: 'noData' },
    { ...base, date: '2026-10-12', classification: 'halfDayHoliday' },
  ];
  person.totals.totalMinutes = 2999; person.totals.overtimeMinutes = 125;
  // Reversed source order proves grouping/sorting without changing source data.
  source.rows = [{ ...person, name: 'İkinci kişi', department: 'Üretim' }, person];
  const rows = buildMonthlyStatusRows(source);
  const input = { def, rows, meta: { from: '2026-10-01', to: '2026-10-31', projectName: '=Proje', columns: def.columns, days: source.days } };
  buildStatusMatrix(workbook, input);
  const reopened = new Excel.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = reopened.getWorksheet('Aylık Durum');
  if (!sheet) throw new Error('Missing sheet');
  return { workbook: reopened, sheet, source, input };
}
function noteText(cell: ExcelJS.Cell): string {
  return typeof cell.note === 'string' ? cell.note : cell.note?.texts?.map(part => part.text ?? '').join('') ?? '';
}
it('round-trips a 31-day status matrix with grouped rows, totals, safe text and print settings', async () => {
  const { workbook, sheet, source } = await fixture();
  expect(workbook.worksheets.map(item => item.name)).toEqual(['Aylık Durum', 'Lejant']);
  expect(sheet.getCell('A1').value).toBe('Aylık Durum');
  expect(sheet.getCell('A2').value).toBe("'=Proje · 01.10.2026 – 31.10.2026 · İstanbul saati (UTC+3)");
  expect(Array.from({ length: 31 }, (_, index) => sheet.getCell(3, index + 4).value)).toEqual(source.days.map(day => `${day.slice(8)}.10`));
  expect(['D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4'].map(address => sheet.getCell(address).value)).toEqual(['Per', 'Cum', 'Cmt', 'Paz', 'Pzt', 'Sal', 'Çar']);
  expect(sheet.getCell('A5').value).toBe('Ar-Ge');
  expect(sheet.getCell('AR5').master.address).toBe('A5');
  expect(sheet.getCell('A6').value).toBe("'=FORMULA");
  expect(sheet.getCell('A7').value).toBe('Üretim');
  expect(sheet.getCell('C6').value).toBe('P01');
  const person = source.rows[1];
  if (!person) throw new Error('Missing person');
  const counts = countAttendance(person.cells);
  expect(sheet.getCell('AI3').value).toBe('Toplam');
  expect(Array.from({ length: 10 }, (_, index) => sheet.getCell(6, index + 35).value)).toEqual([
    counts.workedDays, counts.lateDays, counts.earlyExitDays, counts.absentDays, counts.leaveDays,
    counts.weekendDays, counts.holidayDays, counts.incompleteDays, '49:59', '2:05',
  ]);
  expect(sheet.views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 4 });
  expect(sheet.pageSetup).toMatchObject({ paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4', printArea: 'A1:AR8' });
  expect(sheet.getCell('D6').border.bottom?.style).toBe('thin');
  expect(sheet.getCell('F3').fill).toMatchObject({ fgColor: { argb: DAY_FILLS.weekend } });
  expect(sheet.getCell('G4').fill).toMatchObject({ fgColor: { argb: DAY_FILLS.holiday } });
  expect(sheet.getCell('O3').fill).toMatchObject({ fgColor: { argb: DAY_FILLS.halfDayHoliday } });
});
it('retains codes, applies pale status fills and annotates exceptions and manual corrections', async () => {
  const { workbook, sheet } = await fixture();
  for (const [address, code, color] of [
    ['D6', 'DV', 'FFFCE4E4'], ['E6', 'İZN', 'FFE2EFFB'], ['F6', 'HT', DAY_FILLS.weekend],
    ['G6', 'RT', DAY_FILLS.holiday], ['H6', '?', 'FFFFF5CC'],
  ]) {
    const cell = sheet.getCell(address);
    expect(cell.value).toBe(code);
    expect(cell.fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });
    expect(cell.font.color).toEqual({ argb: 'FF000000' });
  }
  for (const [address, note] of [['I6', 'Geç + erken çıkış\nManuel'], ['J6', 'Geç'], ['K6', 'Erken çıkış']]) {
    const cell = sheet.getCell(address);
    expect(cell.value).toBe('N');
    expect(cell.font).toMatchObject({ bold: true, color: { argb: 'FFB45309' } });
    expect(noteText(cell)).toBe(note);
  }
  expect(sheet.getCell('L6').fill).toMatchObject({ type: 'pattern', pattern: 'none' });
  expect(noteText(sheet.getCell('L6'))).toBe('Manuel');
  expect(['M6', 'N6', 'P6'].map(address => sheet.getCell(address).value)).toEqual(['—', '—', '—']);
  const legend = workbook.getWorksheet('Lejant');
  expect(legend?.getColumn(1).values.slice(2, 9)).toEqual(['N', 'DV', 'İZN', 'HT', 'RT', '?', '—']);
  expect(legend?.getCell('A9').font).toMatchObject({ bold: true, color: { argb: 'FFB45309' } });
});
it('uses supplied attendance totals without recalculating and handles an empty monthly export', async () => {
  const { input } = await fixture();
  const { default: Excel } = await import('exceljs');
  const person = input.rows[1];
  if (!person) throw new Error('Missing person');
  person.attendance.earlyExitDays = 17;
  const workbook = new Excel.Workbook();
  buildStatusMatrix(workbook, { ...input, rows: [person] });
  expect(workbook.getWorksheet('Aylık Durum')?.getCell('AK6').value).toBe(17);
  const empty = new Excel.Workbook();
  buildStatusMatrix(empty, { ...input, rows: [], meta: { ...input.meta, days: undefined } });
  expect(empty.getWorksheet('Aylık Durum')?.getCell('AH3').value).toBe('31.10');
  expect(empty.getWorksheet('Aylık Durum')?.rowCount).toBe(4);
});
it('keeps the shared flat table export unchanged for other reports', async () => {
  const { default: Excel } = await import('exceljs');
  const workbook = new Excel.Workbook();
  const def = getReport('gunluk', 'calisma-suresi');
  if (!def) throw new Error('Missing report');
  const rows = flattenDailyRows([dailySource([dailyCell()])]);
  addTableSheet(workbook, def, rows, { from: '2026-10-01', to: '2026-10-31', columns: reportColumns(def).filter(column => column.defaultVisible) });
  expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Rapor']);
  const sheet = workbook.getWorksheet('Rapor');
  expect(sheet?.getRow(4).values).toContain('Toplam süre (dk)');
  expect(sheet?.getRow(5).values).toContain(535);
  expect(sheet?.getCell('A5').value).toBe('19.10.2026');
});
