import type ExcelJS from 'exceljs';
import type { ReportDefinition } from '../registry';
import type { ReportExportMeta } from '../export';
import { formatReportDate, formatShortMinutes, type DailyCell, type ReportRow } from '../rows';
import { neutralizeSpreadsheetFormula } from '@/lib/spreadsheetSafety';
import { STATUS_META } from '@/components/pdks/statusMeta';
import { leaveTypes } from '@/components/leaves/lib/leaveState';

export interface ExcelLayoutInput { def: ReportDefinition; rows: readonly ReportRow[]; meta: ReportExportMeta }
export const DAY_FILLS = { weekend: 'FFF2F3F5', holiday: 'FFFFE1A6', halfDayHoliday: 'FFFFF1D6' } as const;
export const HEADER_FILL = 'FFE7EBEF';
export const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD8DDE3' } }, bottom: { style: 'thin', color: { argb: 'FFD8DDE3' } },
  left: { style: 'thin', color: { argb: 'FFD8DDE3' } }, right: { style: 'thin', color: { argb: 'FFD8DDE3' } },
};
export function safeCell(value: string | number | null | undefined): string | number {
  return typeof value === 'number' ? value : neutralizeSpreadsheetFormula(value ?? '—');
}
export function setCell(sheet: ExcelJS.Worksheet, row: number, column: number, value: string | number | null | undefined) {
  const cell = sheet.getCell(row, column);
  cell.value = safeCell(value);
  return cell;
}
export function fillCell(cell: ExcelJS.Cell, color: string): void { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }; }
export function dayFill(cell?: DailyCell): string | undefined {
  const type = cell?.detail?.dayType;
  return type && type !== 'workday' ? DAY_FILLS[type] : undefined;
}
export function dayHeading(day: string): { date: string; weekday: string } {
  const date = new Date(`${day}T12:00:00+03:00`);
  return { date: `${day.slice(8, 10)}.${day.slice(5, 7)}`, weekday: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][date.getUTCDay()] ?? '' };
}
export function reportDays(input: ExcelLayoutInput): string[] {
  if (input.meta.days?.length) return [...input.meta.days];
  const days: string[] = [];
  const end = Date.parse(`${input.meta.to}T00:00:00Z`);
  for (let time = Date.parse(`${input.meta.from}T00:00:00Z`); time <= end && days.length < 31; time += 86400000) days.push(new Date(time).toISOString().slice(0, 10));
  return days;
}
export function setupPrint(sheet: ExcelJS.Worksheet, titleRows = '1:4'): void {
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: titleRows, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 } };
}
export function addReportHeadings(sheet: ExcelJS.Worksheet, input: ExcelLayoutInput, columns: number): void {
  sheet.mergeCells(1, 1, 1, columns);
  setCell(sheet, 1, 1, input.def.title).font = { size: 16, bold: true, color: { argb: 'FF243247' } };
  sheet.getRow(1).height = 28;
  sheet.mergeCells(2, 1, 2, columns);
  setCell(sheet, 2, 1, `${input.meta.projectName ?? ''} · ${formatReportDate(input.meta.from)} – ${formatReportDate(input.meta.to)} · İstanbul saati (UTC+3)`);
  sheet.getRow(2).height = 24;
}
export function leaveTypeLabel(type: string): string { return Object.prototype.hasOwnProperty.call(leaveTypes, type) ? leaveTypes[type as keyof typeof leaveTypes] : type === 'unspecified' ? 'Türü belirtilmemiş izin' : type; }
export function statusLabel(cell: DailyCell): string {
  return cell.status === 'leave' && cell.leaveType ? leaveTypeLabel(cell.leaveType) : STATUS_META[cell.status].label;
}
export { formatShortMinutes };
export interface LegendEntry { label: string; description: string; color?: string }
export const DEFAULT_LEGEND: readonly LegendEntry[] = [
  { label: STATUS_META.present.label, description: 'Devam kaydı bulunan gün.' },
  { label: STATUS_META.late.label, description: 'Vardiyanın toleransı aşılarak giriş yapılan gün.' },
  { label: STATUS_META.absent.label, description: 'Devamsız olarak hesaplanan gün.' },
  { label: STATUS_META.leave.label, description: 'İzin kaydı bulunan gün; günlük dökümde izin türü gösterilir.' },
  { label: STATUS_META.incomplete.label, description: 'Eksik veya çelişen okutma nedeniyle inceleme gereken gün.' },
  { label: STATUS_META.weekend.label, description: 'Hafta tatili günü.', color: DAY_FILLS.weekend },
  { label: STATUS_META.holiday.label, description: 'Resmî tatil günü.', color: DAY_FILLS.holiday },
  { label: 'Yarım gün tatil', description: 'Yarım günlük resmî tatil.', color: DAY_FILLS.halfDayHoliday },
  { label: STATUS_META.future.label, description: 'Henüz tamamlanmamış gün; aylık toplamlara katılmaz.' },
  { label: STATUS_META.noData.label, description: 'Veri bulunmayan gün; aylık toplamlara katılmaz.' },
  { label: '—', description: 'Boş değer, eksik okutma ucu veya istihdam dışındaki gün.' },
  { label: 'Süreler', description: 'S:DD biçimi: saat ve iki haneli dakika (ör. 8:05).' },
  { label: 'Mola', description: 'Ardışık tam giriş/çıkış çiftleri arasındaki boşluk; vardiya parçaları arası boşluk sayılmaz.' },
  { label: 'Fazla mesai', description: 'Mevcut dönem kuralıyla hesaplanan fazla mesai; günlük değerler değiştirilmez.' },
  { label: '+k çift', description: 'Altı çifti aşan günlerde son çıkış satırında gösterilmeyen çift sayısı.' },
];
export function addLegendSheet(workbook: ExcelJS.Workbook, entries: readonly LegendEntry[] = DEFAULT_LEGEND): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet('Lejant');
  sheet.columns = [{ width: 28 }, { width: 96 }];
  sheet.addRow(['Etiket', 'Açıklama'].map(safeCell));
  sheet.getRow(1).font = { bold: true };
  for (const entry of entries) {
    const row = sheet.addRow([entry.label, entry.description].map(safeCell));
    row.alignment = { vertical: 'middle', wrapText: true };
    row.height = 30;
    if (entry.color) fillCell(row.getCell(1), entry.color);
  }
  setupPrint(sheet, '1:1');
  return sheet;
}
