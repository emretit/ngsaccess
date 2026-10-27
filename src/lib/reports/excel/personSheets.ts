import type ExcelJS from 'exceljs';
import { notify } from '@/lib/notify';
import { formatReportDate, type DailyCell } from '../rows';
import { countedMonthDay, hasFlexibleDays, personMonthTotals, type PersonMonthReportRow, type PersonMonthTotals } from '../personMonth';
import { addLegendSheet, dayFill, dayHeading, DEFAULT_LEGEND, fillCell, formatShortMinutes, HEADER_FILL, leaveTypeLabel, reportDays, setCell, setupPrint, statusLabel, THIN_BORDER, type ExcelLayoutInput } from './common';

export const PERSON_SHEETS_LIMIT_MESSAGE = 'En fazla 300 kişi; departman ya da kişi filtresi seçin.';
export class PersonSheetsLimitError extends Error {
  constructor() { super(PERSON_SHEETS_LIMIT_MESSAGE); this.name = 'PersonSheetsLimitError'; }
}
const HEADERS = ['Tarih', 'Gün', 'Vardiya', 'Plan', 'Giriş 1', 'Çıkış 1', 'Giriş 2', 'Çıkış 2', 'Giriş 3', 'Çıkış 3', 'Çalışma', 'Fazla mesai', 'Geç', 'Erken çıkış', 'Mola', 'Durum', 'İzin türü'];
const WIDTH = HEADERS.length;

/** Excel names are case-insensitive; reserve the legend before allocating person names. */
function uniqueSheetName(name: string, index: number, used: Set<string>): string {
  const cleaned = Array.from(name).filter(character => character.charCodeAt(0) >= 32 && !'\\/?*[]:'.includes(character)).join('').replace(/^'+|'+$/g, '').trim();
  const base = cleaned && cleaned.toLowerCase() !== 'history' ? cleaned : `Kişi ${index + 1}`;
  // Excel rejects a name ending in an apostrophe, which truncation can expose.
  const shortened = (suffix: string) => base.slice(0, 31 - suffix.length).replace(/[\uD800-\uDBFF]$/, '').replace(/'+$/, '').trimEnd() + suffix;
  let count = 1;
  let candidate = shortened('');
  while (used.has(candidate.toLowerCase())) { count += 1; candidate = shortened(` (${count})`); }
  used.add(candidate.toLowerCase());
  return candidate;
}
function mergedText(sheet: ExcelJS.Worksheet, row: number, from: number, to: number, text: string | number): void {
  sheet.mergeCells(row, from, row, to);
  setCell(sheet, row, from, text);
}
function styleRow(sheet: ExcelJS.Worksheet, rowIndex: number, header = false): void {
  const row = sheet.getRow(rowIndex);
  row.height = header ? 32 : 28;
  for (let column = 1; column <= WIDTH; column++) {
    const cell = row.getCell(column);
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: column === 1 || column === 3 || column === 4 || column >= 16 ? 'left' : 'center', wrapText: true };
    cell.font = { size: 10, ...(header ? { bold: true } : {}) };
    if (header) fillCell(cell, HEADER_FILL);
  }
}
function summaryRow(sheet: ExcelJS.Worksheet, rowIndex: number, label: string, totals: PersonMonthTotals, dayCount: number, total = false): void {
  [label, dayCount, totals.workedDays + totals.holidayWorkedDays, formatShortMinutes(totals.totalMinutes), formatShortMinutes(totals.overtimeMinutes)]
    .forEach((value, index) => setCell(sheet, rowIndex, index + 1, value));
  if (total) sheet.getRow(rowIndex).font = { bold: true };
}
function addSummary(sheet: ExcelJS.Worksheet, person: PersonMonthReportRow): void {
  styleRow(sheet, 2, true);
  ['Gün türü', 'Gün sayısı', 'Çalışılan gün', 'Çalışma süresi', 'Fazla mesai'].forEach((value, index) => setCell(sheet, 2, index + 1, value));
  mergedText(sheet, 2, 7, WIDTH, 'Diğer toplamlar');
  const kinds = [
    { label: 'Hafta içi', key: 'workday', count: person.totals.workdays },
    { label: 'Hafta sonu', key: 'weekend', count: person.totals.weekendDays },
    { label: 'Resmî tatil', key: 'holiday', count: person.totals.holidayDays },
  ];
  kinds.forEach((kind, index) => {
    styleRow(sheet, index + 3);
    const days = person.days.filter(cell => kind.key === 'holiday' ? cell.detail?.dayType === 'holiday' || cell.detail?.dayType === 'halfDayHoliday' : cell.detail?.dayType === kind.key);
    summaryRow(sheet, index + 3, kind.label, personMonthTotals(days), kind.count);
  });
  styleRow(sheet, 6); styleRow(sheet, 7);
  summaryRow(sheet, 6, 'Toplam', person.totals, person.totals.workdays + person.totals.weekendDays + person.totals.holidayDays, true);
  const other = [
    ['Geç (gün / dk)', `${person.totals.lateDays} gün / ${person.totals.lateMinutes} dk`],
    ['Erken çıkış (gün / dk)', `${person.totals.earlyExitDays} gün / ${person.totals.earlyExitMinutes} dk`],
    ['Devamsız (gün)', person.totals.absentDays], ['Mola toplamı', formatShortMinutes(person.totals.breakMinutes)], ['İnceleme (gün)', person.totals.incompleteDays],
    ...(hasFlexibleDays([person]) ? [['Esnek eksik / fazla süre', `Eksik ${person.totals.shortfallDays} gün / ${person.totals.shortfallMinutes} dk · fazla ${person.totals.excessMinutes} dk`] as const] : []),
  ] as const;
  other.forEach(([label, value], index) => {
    mergedText(sheet, index + 3, 7, 12, label);
    mergedText(sheet, index + 3, 13, WIDTH, value);
  });
}
function dailyValues(day: string, cell?: DailyCell): Array<string | number | null | undefined> {
  const identity = [formatReportDate(day), dayHeading(day).weekday];
  if (!cell || !countedMonthDay(cell)) return [...identity, ...Array.from({ length: WIDTH - 2 }, () => '—')];
  const detail = cell.detail;
  const pairs = detail?.pairs ?? [];
  const lastOut = pairs[2]?.out;
  const plan = cell.scheduleType === 'flexible' || detail?.plannedStart === 'Esnek' ? 'Esnek'
    : detail?.plannedStart && detail.plannedEnd ? `${detail.plannedStart}–${detail.plannedEnd}` : null;
  return [...identity, detail?.shiftName, plan,
    pairs[0]?.in, pairs[0]?.out, pairs[1]?.in, pairs[1]?.out, pairs[2]?.in,
    pairs.length > 3 ? `${lastOut ?? '—'} · +${pairs.length - 3} çift` : lastOut,
    formatShortMinutes(cell.totalMinutes), formatShortMinutes(cell.overtimeMinutes), formatShortMinutes(cell.lateMinutes),
    detail ? formatShortMinutes(detail.earlyExitMinutes) : null, detail?.breakMinutes === undefined ? null : formatShortMinutes(detail.breakMinutes),
    statusLabel(cell), cell.leaveType ? leaveTypeLabel(cell.leaveType) : null];
}
function addPersonSheet(workbook: ExcelJS.Workbook, input: ExcelLayoutInput, person: PersonMonthReportRow, name: string): void {
  const sheet = workbook.addWorksheet(name);
  const widths = [17, 9, 25, 21, 12, 12, 12, 12, 12, 24, 14, 14, 12, 14, 12, 23, 24];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.mergeCells(1, 1, 1, WIDTH);
  const band = setCell(sheet, 1, 1, `Ad Soyad: ${person.name} · Departman: ${person.department} · Bordro kodu: ${person.payrollCode || '—'} · Dönem: ${formatReportDate(input.meta.from)} – ${formatReportDate(input.meta.to)} · İstanbul saati (UTC+3)`);
  fillCell(band, 'FFFFEB83'); band.font = { bold: true, size: 12 }; band.alignment = { vertical: 'middle', wrapText: true }; sheet.getRow(1).height = 44;
  addSummary(sheet, person);
  mergedText(sheet, 9, 1, WIDTH, 'İzin özeti'); styleRow(sheet, 9, true);
  const leaves = Object.entries(person.totals.leaveByType).filter(([, count]) => count > 0).sort(([a], [b]) => leaveTypeLabel(a).localeCompare(leaveTypeLabel(b), 'tr'));
  let rowIndex = 10;
  if (leaves.length === 0) { mergedText(sheet, rowIndex, 1, WIDTH, 'İzin yok'); rowIndex += 1; }
  else for (const [type, count] of leaves) {
    mergedText(sheet, rowIndex, 1, 4, leaveTypeLabel(type)); setCell(sheet, rowIndex, 5, count); styleRow(sheet, rowIndex); rowIndex += 1;
  }
  const sectionRow = rowIndex + 1, headerRow = sectionRow + 1;
  mergedText(sheet, sectionRow, 1, WIDTH, 'Günlük döküm'); styleRow(sheet, sectionRow, true);
  HEADERS.forEach((label, index) => setCell(sheet, headerRow, index + 1, label)); styleRow(sheet, headerRow, true);
  const byDate = new Map(person.days.map(cell => [cell.date, cell]));
  const days = reportDays(input);
  days.forEach((day, index) => {
    const row = headerRow + index + 1;
    const source = byDate.get(day);
    dailyValues(day, source).forEach((value, column) => setCell(sheet, row, column + 1, value));
    styleRow(sheet, row);
    const color = dayFill(source);
    for (let column = 1; column <= WIDTH; column++) {
      const cell = sheet.getCell(row, column);
      if (color) fillCell(cell, color);
      if (!source || !countedMonthDay(source)) cell.font = { size: 10, color: { argb: 'FF858B94' } };
    }
  });
  const totalRow = headerRow + days.length + 1;
  styleRow(sheet, totalRow, true); mergedText(sheet, totalRow, 1, 10, 'Toplam');
  [person.totals.totalMinutes, person.totals.overtimeMinutes, person.totals.lateMinutes, person.totals.earlyExitMinutes, person.totals.breakMinutes]
    .forEach((minutes, index) => setCell(sheet, totalRow, index + 11, formatShortMinutes(minutes)));
  sheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
  setupPrint(sheet, `${headerRow}:${headerRow}`);
  sheet.pageSetup.orientation = 'portrait'; sheet.pageSetup.printArea = `A1:Q${totalRow}`;
}
export function buildPersonSheets(workbook: ExcelJS.Workbook, input: ExcelLayoutInput): void {
  const people = input.rows.filter((row): row is PersonMonthReportRow => row.kind === 'personMonth');
  // Throw before adding worksheets so exportReport never reaches writeBuffer/download on this path.
  if (people.length > 300) { notify.info(PERSON_SHEETS_LIMIT_MESSAGE); throw new PersonSheetsLimitError(); }
  const used = new Set(['lejant', ...workbook.worksheets.map(sheet => sheet.name.toLowerCase())]);
  people.forEach((person, index) => addPersonSheet(workbook, input, person, uniqueSheetName(person.name, index, used)));
  const legend = addLegendSheet(workbook, DEFAULT_LEGEND.map(entry => entry.label === '+k çift'
    ? { ...entry, description: 'Üç çifti aşan günlerde üçüncü çıkış hücresinde gösterilmeyen çift sayısı.' }
    : entry.label === 'Mola' ? { ...entry, description: 'Mola = okutma çiftleri arasındaki boşluk; vardiya parçaları arası boşluk sayılmaz.' } : entry));
  legend.pageSetup.orientation = 'portrait';
}
