import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { ReportTransactionRow } from '../../../convex/lib/reportAttendance';

export type DailySourceRow = FunctionReturnType<typeof api.cardReadings.getPdksTableData>[number];
export type DailyCell = DailySourceRow['days'][number];
export type MonthlySheet = FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>;
export type DailyReportRow = { kind: 'daily'; id: string; name: string; department: string; payrollCode: string; cell: DailyCell };
export type MonthlyReportRow = MonthlySheet['rows'][number] & { kind: 'monthly'; id: string };
export type TransactionReportRow = { kind: 'transaction'; id: string; transaction: ReportTransactionRow };
export type ReportRow = DailyReportRow | MonthlyReportRow | TransactionReportRow;
export type DailyPredicate = (cell: DailyCell) => boolean;
export const DAILY_PREDICATES: Record<string, DailyPredicate> = {
  'gunluk-puantaj': () => true,
  'gec-kalanlar': cell => cell.isLate,
  devamsizlar: cell => cell.status === 'absent',
  'fazla-mesai': cell => cell.overtimeMinutes > 0,
};
export function flattenDailyRows(rows: readonly DailySourceRow[], predicate: DailyPredicate = () => true): DailyReportRow[] {
  return rows.flatMap(row => row.days.filter(cell => cell.status !== 'future' && cell.status !== 'noData' && predicate(cell)).map(cell => ({
    kind: 'daily' as const, id: `${row.id}:${cell.date}`, name: row.name, department: row.department, payrollCode: row.payrollEmployeeCode, cell,
  })));
}
export function buildMonthlyStatusRows(sheet: MonthlySheet): MonthlyReportRow[] {
  return sheet.rows.map(row => ({ ...row, kind: 'monthly', id: String(row.employeeId) }));
}
export function buildTransactionRows(rows: readonly ReportTransactionRow[], person: string, departmentName?: string): TransactionReportRow[] {
  return rows.filter(row => (!departmentName || row.department === departmentName) && (row.employeeName ?? '').toLocaleLowerCase('tr-TR').includes(person.toLocaleLowerCase('tr-TR')))
    .map(transaction => ({ kind: 'transaction', id: transaction._id, transaction }));
}
export function dailyRowsForReport(rows: readonly DailySourceRow[], slug: string): DailyReportRow[] {
  const result = flattenDailyRows(rows, DAILY_PREDICATES[slug]);
  return slug === 'gec-kalanlar' ? result.sort((a, b) => b.cell.lateMinutes - a.cell.lateMinutes) : result;
}
export function formatMinutes(value: number): string {
  return `${Math.floor(value / 60)} sa ${String(value % 60).padStart(2, '0')} dk`;
}
export function formatReportDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}
export function formatTransactionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
