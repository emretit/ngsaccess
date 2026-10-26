import type ExcelJS from 'exceljs';
import type { MonthlyReportRow } from '../rows';
import { addLegendSheet, addReportHeadings, DAY_FILLS, dayHeading, fillCell, formatShortMinutes, HEADER_FILL, reportDays, setCell, setupPrint, THIN_BORDER, type ExcelLayoutInput, type LegendEntry } from './common';

const STATUS_FILLS: Readonly<Record<string, string>> = {
  DV: 'FFFCE4E4', İZN: 'FFE2EFFB', HT: DAY_FILLS.weekend, RT: DAY_FILLS.holiday, '?': 'FFFFF5CC',
};
const EXCEPTION_COLOR = 'FFB45309';
const TOTALS: readonly { label: string; value: (row: MonthlyReportRow) => string | number }[] = [
  { label: 'Çalışılan (N)', value: row => row.attendance.workedDays },
  { label: 'Geç (gün)', value: row => row.attendance.lateDays },
  { label: 'Erken çıkış (gün)', value: row => row.attendance.earlyExitDays },
  { label: 'Devamsız (DV)', value: row => row.attendance.absentDays },
  { label: 'İzinli (İZN)', value: row => row.attendance.leaveDays },
  { label: 'Hafta tatili (HT)', value: row => row.attendance.weekendDays },
  { label: 'Resmî tatil (RT)', value: row => row.attendance.holidayDays },
  { label: 'İnceleme', value: row => row.totals.incompleteDays ?? row.attendance.incompleteDays ?? 0 },
  { label: 'Toplam süre', value: row => formatShortMinutes(row.totals.totalMinutes) },
  { label: 'Fazla mesai', value: row => formatShortMinutes(row.totals.overtimeMinutes) },
];
const LEGEND: readonly LegendEntry[] = [
  { label: 'N', description: 'Normal çalışma; dolgusuz hücre.' },
  { label: 'DV', description: 'Devamsız; açık kırmızı.', color: STATUS_FILLS.DV },
  { label: 'İZN', description: 'İzinli; açık mavi.', color: STATUS_FILLS.İZN },
  { label: 'HT', description: 'Hafta tatili; açık gri.', color: STATUS_FILLS.HT },
  { label: 'RT', description: 'Resmî tatil; açık amber.', color: STATUS_FILLS.RT },
  { label: '?', description: 'İnceleme gerekiyor; açık sarı.', color: STATUS_FILLS['?'] },
  { label: '—', description: 'Veri yok/gelecek.' },
  { label: 'Turuncu kalın', description: 'Geç/erken çıkış; N kodu korunur. Hücre notu Geç, Erken çıkış veya Geç + erken çıkış bilgisini verir.' },
  { label: 'Manuel', description: 'Manuel düzeltilmiş günün hücre notunda Manuel yazar.' },
  { label: 'Gün başlıkları', description: 'Gri: hafta tatili; amber: resmî tatil; soluk amber: yarım gün tatil.' },
  { label: 'Süreler', description: 'S:DD biçimi: saat ve iki haneli dakika (ör. 8:05). Toplamlar mevcut rapor değerleridir.' },
];

// Monthly cells expose classification, whereas the shared dayFill helper takes DailyCell.detail.
function headerFill(day: string, people: readonly MonthlyReportRow[]): string | undefined {
  const types = people.flatMap(person => person.cells.filter(cell => cell.date === day).map(cell => cell.classification));
  if (types.includes('holiday')) return DAY_FILLS.holiday;
  if (types.includes('halfDayHoliday')) return DAY_FILLS.halfDayHoliday;
  if (types.includes('weekend')) return DAY_FILLS.weekend;
  return ['Cmt', 'Paz'].includes(dayHeading(day).weekday) ? DAY_FILLS.weekend : undefined;
}

export function buildStatusMatrix(workbook: ExcelJS.Workbook, input: ExcelLayoutInput): void {
  const people = input.rows.filter((row): row is MonthlyReportRow => row.kind === 'monthly')
    .slice().sort((a, b) => a.department.localeCompare(b.department, 'tr') || a.name.localeCompare(b.name, 'tr'));
  const days = reportDays(input);
  const totalStart = 4 + days.length;
  const width = 3 + days.length + TOTALS.length;
  const sheet = workbook.addWorksheet('Aylık Durum', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4, showGridLines: false }] });
  addReportHeadings(sheet, input, width);
  setupPrint(sheet);
  ['Ad Soyad', 'Departman', 'Bordro kodu'].forEach((label, index) => {
    sheet.mergeCells(3, index + 1, 4, index + 1);
    setCell(sheet, 3, index + 1, label);
  });
  days.forEach((day, index) => {
    const heading = dayHeading(day);
    setCell(sheet, 3, index + 4, heading.date);
    setCell(sheet, 4, index + 4, heading.weekday);
  });
  sheet.mergeCells(3, totalStart, 3, width);
  setCell(sheet, 3, totalStart, 'Toplam');
  TOTALS.forEach((total, index) => setCell(sheet, 4, totalStart + index, total.label));
  for (const rowIndex of [3, 4]) {
    sheet.getRow(rowIndex).height = rowIndex === 4 ? 48 : 24;
    for (let column = 1; column <= width; column++) {
      const cell = sheet.getCell(rowIndex, column);
      cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = THIN_BORDER;
      fillCell(cell, column >= 4 && column < totalStart ? headerFill(days[column - 4] ?? '', people) ?? HEADER_FILL : HEADER_FILL);
    }
  }
  for (let column = 1; column <= width; column++) sheet.getColumn(column).width = column <= 2 ? 24 : column === 3 ? 16 : column < totalStart ? 7 : 15;
  let department: string | undefined;
  let nextRow = 5;
  for (const person of people) {
    if (person.department !== department) {
      department = person.department;
      sheet.mergeCells(nextRow, 1, nextRow, width);
      const cell = setCell(sheet, nextRow, 1, department);
      cell.font = { bold: true, color: { argb: 'FF000000' } };
      fillCell(cell, 'FFDCE4ED'); cell.border = THIN_BORDER;
      sheet.getRow(nextRow).height = 26;
      nextRow += 1;
    }
    [person.name, person.department, person.payrollCode].forEach((value, index) => setCell(sheet, nextRow, index + 1, value || '—'));
    const byDate = new Map(person.cells.map(cell => [cell.date, cell]));
    days.forEach((day, index) => {
      const source = byDate.get(day);
      const code = !source || source.status === 'future' || source.status === 'noData' ? '—' : source.status === 'incomplete' ? '?' : source.payrollCode;
      const cell = setCell(sheet, nextRow, index + 4, code);
      const color = STATUS_FILLS[code];
      if (color) fillCell(cell, color);
      const notes: string[] = [];
      if (code === 'N' && (source?.isLate || source?.isEarlyExit)) {
        cell.font = { bold: true, color: { argb: EXCEPTION_COLOR } };
        notes.push(source.isLate && source.isEarlyExit ? 'Geç + erken çıkış' : source.isLate ? 'Geç' : 'Erken çıkış');
      }
      if (source?.isManual) notes.push('Manuel');
      if (notes.length) cell.note = notes.join('\n');
    });
    TOTALS.forEach((total, index) => setCell(sheet, nextRow, totalStart + index, total.value(person)));
    for (let column = 1; column <= width; column++) {
      const cell = sheet.getCell(nextRow, column);
      if (!cell.font?.color) cell.font = { ...cell.font, color: { argb: 'FF000000' } };
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: column <= 3 ? 'left' : 'center', wrapText: true };
    }
    sheet.getRow(nextRow).height = 25;
    nextRow += 1;
  }
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(width).letter}${Math.max(4, nextRow - 1)}`;
  const legend = addLegendSheet(workbook, LEGEND);
  legend.getCell('A9').font = { bold: true, color: { argb: EXCEPTION_COLOR } };
}
