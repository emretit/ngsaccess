import type { PDKSExportRecord } from '@/utils/pdksExport';
import { STATUS_FILTER_LABELS } from '@/components/pdks/statusMeta';
import { formatDuration } from '@/components/pdks/lib/presentation';
import { columnStorageKey, type ColumnScope } from '@/lib/reports/columns';

export interface PDKSExportColumn {
  key: string;
  label: string;
  value: (row: PDKSExportRecord) => string | number;
  dataType: 'text' | 'number' | 'duration' | 'date';
  sensitivity: 'normal' | 'sensitive';
  requiresPay: boolean;
  defaultExportVisible: boolean;
  excelWidth: number;
  pdfWidth: number;
  pdfLabel?: string;
}
const column = (key: string, label: string, value: PDKSExportColumn['value'], excelWidth: number, pdfWidth: number, extra: Partial<PDKSExportColumn> = {}): PDKSExportColumn => ({
  key, label, value, excelWidth, pdfWidth, dataType: 'text', sensitivity: 'normal', requiresPay: false, defaultExportVisible: true, ...extra,
});
export const PDKS_EXPORT_COLUMNS: readonly PDKSExportColumn[] = [
  column('name', 'Çalışan', r => r.name, 25, 38),
  column('cardNumber', 'Kart no', r => r.cardNumber ?? r.employeeId, 15, 22, { sensitivity: 'sensitive' }),
  column('payrollEmployeeCode', 'Bordro Kodu', r => r.payrollEmployeeCode ?? '', 14, 22, { sensitivity: 'sensitive', pdfLabel: 'Bordro' }),
  column('department', 'Departman', r => r.department, 18, 28),
  column('payrollCode', 'Gün Kodu', r => r.payrollCode ?? '', 10, 16, { pdfLabel: 'Gün' }),
  column('firstEntry', 'İlk Giriş', r => r.firstEntry, 10, 18),
  column('lastExit', 'Son Çıkış', r => r.lastExit, 10, 18),
  column('totalHours', 'Toplam Saat', r => r.totalMinutes === undefined ? r.totalHours : formatDuration(r.totalMinutes), 12, 22, { dataType: 'duration', pdfLabel: 'Toplam' }),
  column('overtime', 'Mesai', r => r.overtimeMinutes === undefined ? r.overtime : formatDuration(r.overtimeMinutes), 10, 16, { dataType: 'duration' }),
  column('leaveType', 'İzin', r => r.leaveType, 12, 18),
  column('status', 'Durum', r => STATUS_FILTER_LABELS[r.status as keyof typeof STATUS_FILTER_LABELS] ?? r.status, 10, 18),
];
export type PDKSExportFormat = 'Excel' | 'CSV' | 'PDF';
export type CsvDelimiter = ',' | ';' | '\t';
export interface PDKSExportPreferences {
  version: 1;
  orderedColumnKeys: string[];
  format: PDKSExportFormat;
  delimiter: CsvDelimiter;
}
export function availablePDKSColumns(canSeePay: boolean, catalog = PDKS_EXPORT_COLUMNS): readonly PDKSExportColumn[] {
  return catalog.filter(c => canSeePay || !c.requiresPay);
}
export function defaultPDKSPreferences(canSeePay = false): PDKSExportPreferences {
  return { version: 1, orderedColumnKeys: availablePDKSColumns(canSeePay).filter(c => c.defaultExportVisible).map(c => c.key), format: 'Excel', delimiter: ',' };
}
export function selectedPDKSColumns(keys?: readonly string[], canSeePay = false): PDKSExportColumn[] {
  const available = availablePDKSColumns(canSeePay);
  const selected = keys?.map(key => available.find(c => c.key === key)).filter((c): c is PDKSExportColumn => c !== undefined);
  return selected?.length ? [...new Set(selected)] : available.filter(c => c.defaultExportVisible);
}
export function togglePDKSColumn(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? keys.length === 1 ? [...keys] : keys.filter(k => k !== key) : [...keys, key];
}
export function movePDKSColumn(keys: readonly string[], key: string, direction: -1 | 1): string[] {
  const next = [...keys], index = next.indexOf(key), target = index + direction;
  if (index >= 0 && target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function readPDKSPreferences(scope?: ColumnScope, canSeePay = false): PDKSExportPreferences {
  const defaults = defaultPDKSPreferences(canSeePay);
  try {
    if (!scope || typeof localStorage === 'undefined') return defaults;
    const saved: unknown = JSON.parse(localStorage.getItem(columnStorageKey('pdks-export-v1', scope)) ?? 'null');
    if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 1 || !('orderedColumnKeys' in saved) || !Array.isArray(saved.orderedColumnKeys)) return defaults;
    const available = availablePDKSColumns(canSeePay);
    const keys = [...new Set(saved.orderedColumnKeys.filter((key): key is string => typeof key === 'string' && available.some(c => c.key === key && c.sensitivity !== 'sensitive')))];
    // Sensitive choices are never restored; legacy defaults are reinserted at their default positions.
    available.forEach((c, index) => { if (c.sensitivity === 'sensitive' && c.defaultExportVisible) keys.splice(Math.min(index, keys.length), 0, c.key); });
    return { version: 1, orderedColumnKeys: keys.length ? keys : defaults.orderedColumnKeys,
      format: 'format' in saved && (saved.format === 'Excel' || saved.format === 'CSV' || saved.format === 'PDF') ? saved.format : defaults.format,
      delimiter: 'delimiter' in saved && (saved.delimiter === ',' || saved.delimiter === ';' || saved.delimiter === '\t') ? saved.delimiter : defaults.delimiter };
  } catch { return defaults; }
}
export function savePDKSPreferences(preferences: PDKSExportPreferences, scope?: ColumnScope, canSeePay = false): void {
  if (!scope) return;
  const orderedColumnKeys = selectedPDKSColumns(preferences.orderedColumnKeys, canSeePay).filter(c => c.sensitivity !== 'sensitive').map(c => c.key);
  try { localStorage.setItem(columnStorageKey('pdks-export-v1', scope), JSON.stringify({ ...preferences, orderedColumnKeys })); } catch { /* Selection remains usable when browser storage is unavailable. */ }
}
