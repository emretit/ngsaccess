import type ExcelJS from 'exceljs';
import { countedMonthDay, hasFlexibleDays, type PersonMonthReportRow, type PersonMonthTotals } from '../personMonth';
import type { DailyCell } from '../rows';
import { addLegendSheet, addReportHeadings, dayFill, dayHeading, fillCell, formatShortMinutes, HEADER_FILL, leaveTypeLabel, reportDays, setCell, setupPrint, statusLabel, THIN_BORDER, type ExcelLayoutInput } from './common';

type TotalColumn = { label: string; value: (totals: PersonMonthTotals) => string | number };
export function personTotalColumns(rows: readonly PersonMonthReportRow[]): TotalColumn[] {
  const number = (label: string, key: Exclude<keyof PersonMonthTotals, 'leaveByType'>): TotalColumn => ({ label, value: totals => totals[key] });
  const minutes = (label: string, key: 'totalMinutes' | 'overtimeMinutes' | 'lateMinutes' | 'earlyExitMinutes' | 'breakMinutes' | 'shortfallMinutes' | 'excessMinutes'): TotalColumn => ({ label, value: totals => formatShortMinutes(totals[key]) });
  const leaveTypes = [...new Set(rows.flatMap(row => Object.keys(row.totals.leaveByType)))].sort((a, b) => a.localeCompare(b, 'tr'));
  return [number('Çalışılan gün', 'workedDays'), minutes('Çalışma', 'totalMinutes'), minutes('Fazla mesai', 'overtimeMinutes'),
    number('Geç (gün)', 'lateDays'), minutes('Geç', 'lateMinutes'), number('Erken çıkış (gün)', 'earlyExitDays'), minutes('Erken çıkış', 'earlyExitMinutes'),
    ...(hasFlexibleDays(rows) ? [number('Eksik (gün, esnek)', 'shortfallDays'), minutes('Eksik (esnek)', 'shortfallMinutes'), minutes('Fazla süre (esnek)', 'excessMinutes')] : []),
    number('Devamsız', 'absentDays'), number('İzinli', 'leaveDays'),
    ...leaveTypes.map(type => ({ label: leaveTypeLabel(type), value: (totals: PersonMonthTotals) => Object.prototype.hasOwnProperty.call(totals.leaveByType, type) ? totals.leaveByType[type] : 0 })),
    number('Hafta içi', 'workdays'), number('Hafta sonu', 'weekendDays'), number('Resmî tatil', 'holidayDays'),
    number('Hafta sonu/tatil çalışma', 'holidayWorkedDays'), minutes('Mola', 'breakMinutes'), number('İnceleme (gün)', 'incompleteDays')];
}
type BlockLine = { label: string; value: (cell: DailyCell | undefined) => string | number | null | undefined };
function blockLines(pairCount: number): BlockLine[] {
  const metric = (label: string, value: (cell: DailyCell) => number | undefined): BlockLine => ({ label, value: cell => {
    if (!cell || !countedMonthDay(cell)) return null;
    const minutes = value(cell);
    return minutes === undefined ? null : formatShortMinutes(minutes);
  } });
  return [
    { label: 'Vardiya', value: cell => cell?.detail?.shiftName },
    { label: 'Durum', value: cell => cell ? statusLabel(cell) : null },
    ...Array.from({ length: pairCount }, (_, index): BlockLine[] => [
      { label: `Giriş ${index + 1}`, value: cell => cell && countedMonthDay(cell) ? cell.detail?.pairs?.[index]?.in : null },
      { label: `Çıkış ${index + 1}`, value: cell => {
        if (!cell || !countedMonthDay(cell)) return null;
        const pairs = cell.detail?.pairs ?? [];
        const out = pairs[index]?.out;
        return index === 5 && pairs.length > 6 ? `${out ?? '—'} · +${pairs.length - 6} çift` : out;
      } },
    ]).flat(),
    metric('Çalışma', cell => cell.totalMinutes), metric('Fazla mesai', cell => cell.overtimeMinutes),
    metric('Geç', cell => cell.lateMinutes), metric('Erken çıkış', cell => cell.detail?.earlyExitMinutes), metric('Mola', cell => cell.detail?.breakMinutes),
  ];
}
export function buildPersonBlocks(workbook: ExcelJS.Workbook, input: ExcelLayoutInput): void {
  const people = input.rows.filter((row): row is PersonMonthReportRow => row.kind === 'personMonth')
    .slice().sort((a, b) => a.department.localeCompare(b.department, 'tr') || a.name.localeCompare(b.name, 'tr'));
  const days = reportDays(input);
  const totals = personTotalColumns(people);
  const width = 4 + days.length + totals.length;
  const sheet = workbook.addWorksheet('Aylık Özet', { views: [{ state: 'frozen', xSplit: 4, ySplit: 4, showGridLines: false }] });
  addReportHeadings(sheet, input, width);
  setupPrint(sheet);
  ['Ad Soyad', 'Departman', 'Bordro kodu', 'Satır'].forEach((label, index) => {
    sheet.mergeCells(3, index + 1, 4, index + 1);
    setCell(sheet, 3, index + 1, label);
  });
  days.forEach((day, index) => {
    const heading = dayHeading(day);
    setCell(sheet, 3, index + 5, heading.date);
    setCell(sheet, 4, index + 5, heading.weekday);
  });
  const totalStart = 5 + days.length;
  sheet.mergeCells(3, totalStart, 3, width);
  setCell(sheet, 3, totalStart, 'Toplam');
  totals.forEach((total, index) => setCell(sheet, 4, totalStart + index, total.label));
  for (const rowIndex of [3, 4]) {
    const row = sheet.getRow(rowIndex);
    row.height = rowIndex === 4 ? 42 : 24;
    for (let column = 1; column <= width; column++) {
      const cell = row.getCell(column);
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      fillCell(cell, HEADER_FILL); cell.border = THIN_BORDER;
    }
  }
  for (let column = 1; column <= width; column++) sheet.getColumn(column).width = column === 1 || column === 2 ? 24 : column === 4 ? 19 : column === 3 ? 16 : column < totalStart ? 15 : 17;
  let department: string | undefined;
  let nextRow = 5;
  for (const person of people) {
    if (person.department !== department) {
      department = person.department;
      sheet.mergeCells(nextRow, 1, nextRow, width);
      const cell = setCell(sheet, nextRow, 1, department);
      cell.font = { bold: true }; fillCell(cell, 'FFDCE4ED');
      sheet.getRow(nextRow).height = 26; nextRow += 1;
    }
    const byDate = new Map(person.days.map(cell => [cell.date, cell]));
    const pairCount = Math.min(6, Math.max(1, ...person.days.filter(countedMonthDay).map(cell => cell.detail?.pairs?.length ?? 0)));
    const lines = blockLines(pairCount);
    const firstRow = nextRow, lastRow = firstRow + lines.length - 1;
    lines.forEach((line, index) => {
      const rowIndex = firstRow + index;
      sheet.getRow(rowIndex).height = 25;
      setCell(sheet, rowIndex, 4, line.label).font = { bold: index < 2, size: 10 };
      days.forEach((day, dayIndex) => {
        const source = byDate.get(day);
        const cell = setCell(sheet, rowIndex, dayIndex + 5, line.value(source));
        const color = dayFill(source);
        if (color) fillCell(cell, color);
      });
      for (let column = 1; column <= width; column++) {
        const cell = sheet.getCell(rowIndex, column);
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'middle', horizontal: column <= 4 ? 'left' : 'center', wrapText: true };
      }
    });
    [person.name, person.department, person.payrollCode].forEach((value, index) => {
      sheet.mergeCells(firstRow, index + 1, lastRow, index + 1);
      setCell(sheet, firstRow, index + 1, value || '—');
    });
    totals.forEach((column, index) => {
      sheet.mergeCells(firstRow, totalStart + index, lastRow, totalStart + index);
      setCell(sheet, firstRow, totalStart + index, column.value(person.totals));
    });
    nextRow = lastRow + 1;
  }
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(width).letter}${Math.max(4, nextRow - 1)}`;
  addLegendSheet(workbook);
}
