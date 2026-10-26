import type { PersonMonthReportRow } from './personMonth';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { ReportTransactionRow } from '../../../convex/lib/reportAttendance';

export type DailySourceRow = FunctionReturnType<typeof api.cardReadings.getPdksTableData>[number];
export type DailyCell = DailySourceRow['days'][number];
export type MonthlySheet = FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>;
export type DailyReportRow = { kind: 'daily'; id: string; name: string; department: string; payrollCode: string; cell: DailyCell };
export interface AttendanceCounts {
  workedDays: number; holidayWorkedDays: number; lateDays: number; earlyExitDays: number; absentDays: number;
  leaveDays: number; weekendDays: number; holidayDays: number; incompleteDays?: number;
}
export type MonthlyReportRow = MonthlySheet['rows'][number] & { kind: 'monthly'; id: string; attendance: AttendanceCounts };
export type DepartmentReportRow = {
  kind: 'department'; id: string; department: string; personCount: number;
  attendance: AttendanceCounts; totalMinutes: number; overtimeMinutes: number; attendanceRate: number | null;
};
export type TransactionReportRow = { kind: 'transaction'; id: string; transaction: ReportTransactionRow };
export type ReportRow = DailyReportRow | MonthlyReportRow | DepartmentReportRow | TransactionReportRow | PersonMonthReportRow;
export type MonthlyRowMode = 'people' | 'departments';
export type DailyPredicate = (cell: DailyCell) => boolean;
export const DAILY_PREDICATES: Record<string, DailyPredicate> = {
  'gunluk-puantaj': () => true,
  'gec-kalanlar': cell => cell.detail?.dayType === 'workday' && cell.isLate,
  devamsizlar: cell => cell.status === 'absent',
  'fazla-mesai': cell => cell.overtimeMinutes > 0,
  'calisma-suresi': cell => cell.totalMinutes > 0,
  'ilk-giris-son-cikis': cell => Boolean(cell.firstEntry),
  istisnalar: cell => (cell.detail?.dayType === 'workday' && (cell.isLate || cell.detail.isEarlyExit)) || cell.status === 'absent',
  'erken-cikanlar': cell => cell.detail?.dayType === 'workday' && cell.detail.isEarlyExit,
  mola: cell => (cell.detail?.breaks?.length ?? 0) > 0 || Boolean(cell.detail?.breakViolation),
  'okutma-karti': cell => (cell.detail?.punches.length ?? 0) > 0,
};
const DAILY_SORTS: Record<string, (a: DailyReportRow, b: DailyReportRow) => number> = {
  'gec-kalanlar': (a, b) => b.cell.lateMinutes - a.cell.lateMinutes,
  'erken-cikanlar': (a, b) => (b.cell.detail?.earlyExitMinutes ?? 0) - (a.cell.detail?.earlyExitMinutes ?? 0),
};
export function flattenDailyRows(rows: readonly DailySourceRow[], predicate: DailyPredicate = () => true): DailyReportRow[] {
  return rows.flatMap(row => row.days.filter(cell => cell.status !== 'future' && cell.status !== 'noData' && predicate(cell)).map(cell => ({
    kind: 'daily' as const, id: `${row.id}:${cell.date}`, name: row.name, department: departmentLabel(row.department), payrollCode: row.payrollEmployeeCode, cell,
  })));
}
export function buildMonthlyStatusRows(sheet: MonthlySheet): MonthlyReportRow[] {
  return sheet.rows.map(row => ({ ...row, department: departmentLabel(row.department), kind: 'monthly', id: String(row.employeeId), attendance: countAttendance(row.cells) }));
}
export function countAttendance(cells: MonthlyReportRow['cells']): AttendanceCounts {
  const counts: AttendanceCounts = { workedDays: 0, holidayWorkedDays: 0, lateDays: 0, earlyExitDays: 0, absentDays: 0, leaveDays: 0, weekendDays: 0, holidayDays: 0 };
  for (const cell of cells) {
    if (cell.status === 'future' || cell.status === 'noData') continue;
    if (cell.durationMeasured !== undefined) counts.incompleteDays ??= 0;
    if (cell.status === 'incomplete') { counts.incompleteDays = (counts.incompleteDays ?? 0) + 1; continue; }
    if (cell.payrollCode === 'N') counts.workedDays += 1;
    if ((cell.classification === 'weekend' || cell.classification === 'holiday') && cell.totalMinutes > 0) counts.holidayWorkedDays += 1;
    if (cell.classification === 'workday' && cell.isLate) counts.lateDays += 1;
    if (cell.classification === 'workday' && cell.isEarlyExit) counts.earlyExitDays += 1;
    if (cell.payrollCode === 'DV') counts.absentDays += 1;
    if (cell.payrollCode === 'İZN') counts.leaveDays += 1;
    if (cell.payrollCode === 'HT') counts.weekendDays += 1;
    if (cell.payrollCode === 'RT') counts.holidayDays += 1;
  }
  return counts;
}
export function buildDepartmentRows(rows: readonly MonthlyReportRow[]): DepartmentReportRow[] {
  const departments = new Map<string, DepartmentReportRow>();
  for (const row of rows) {
    const department = departments.get(row.department) ?? {
      kind: 'department', id: `department:${row.department}`, department: row.department, personCount: 0,
      attendance: { workedDays: 0, holidayWorkedDays: 0, lateDays: 0, earlyExitDays: 0, absentDays: 0, leaveDays: 0, weekendDays: 0, holidayDays: 0 },
      totalMinutes: 0, overtimeMinutes: 0, attendanceRate: null,
    };
    if (row.attendance.incompleteDays !== undefined) department.attendance.incompleteDays = (department.attendance.incompleteDays ?? 0) + row.attendance.incompleteDays;
    department.personCount += 1;
    department.totalMinutes += row.totals.totalMinutes;
    department.overtimeMinutes += row.totals.overtimeMinutes;
    department.attendance.workedDays += row.attendance.workedDays;
    department.attendance.holidayWorkedDays += row.attendance.holidayWorkedDays;
    department.attendance.lateDays += row.attendance.lateDays;
    department.attendance.earlyExitDays += row.attendance.earlyExitDays;
    department.attendance.absentDays += row.attendance.absentDays;
    department.attendance.leaveDays += row.attendance.leaveDays;
    department.attendance.weekendDays += row.attendance.weekendDays;
    department.attendance.holidayDays += row.attendance.holidayDays;
    const denominator = department.attendance.workedDays + department.attendance.absentDays;
    department.attendanceRate = denominator > 0 ? department.attendance.workedDays / denominator * 100 : null;
    departments.set(row.department, department);
  }
  return [...departments.values()].sort((a, b) => a.department.localeCompare(b.department, 'tr'));
}
const MONTHLY_BUILDERS: Record<MonthlyRowMode, (rows: MonthlyReportRow[]) => ReportRow[]> = { people: rows => rows, departments: buildDepartmentRows };
export function monthlyRowsForReport(sheet: MonthlySheet, mode: MonthlyRowMode = 'people', person = '', departmentName?: string): ReportRow[] {
  const rows = buildMonthlyStatusRows(sheet).filter(row => (!departmentName || row.department === departmentName) &&
    (mode === 'departments' || row.name.toLocaleLowerCase('tr-TR').includes(person.toLocaleLowerCase('tr-TR'))));
  return MONTHLY_BUILDERS[mode](rows);
}
export function buildTransactionRows(rows: readonly ReportTransactionRow[]): TransactionReportRow[] {
  return rows.map(transaction => ({ kind: 'transaction', id: transaction._id, transaction }));
}
export function dailyRowsForReport(rows: readonly DailySourceRow[], slug: string, violationsOnly = false): DailyReportRow[] {
  const result = flattenDailyRows(rows, slug === 'mola' && violationsOnly ? cell => Boolean(cell.detail?.breakViolation) : DAILY_PREDICATES[slug]);
  const sort = DAILY_SORTS[slug];
  return sort ? result.sort(sort) : result;
}
export function formatDailyExceptions(cell: DailyCell): string {
  const parts: string[] = [];
  if (cell.status === 'absent') parts.push('Devamsız');
  if (cell.detail?.dayType === 'workday' && cell.isLate) parts.push(`Geç ${cell.lateMinutes} dk`);
  if (cell.detail?.dayType === 'workday' && cell.detail.isEarlyExit) parts.push(`Erken çıkış ${cell.detail.earlyExitMinutes} dk`);
  return parts.join(' · ');
}
export function formatPunches(cell: DailyCell): string {
  if (!cell.detail) return '';
  const parts = cell.detail.punches.map(punch => `${punch.time} ${{ entry: 'Giriş', exit: 'Çıkış', unknown: '—' }[punch.direction]}`);
  const remaining = cell.detail.readingCount - cell.detail.punches.length;
  if (remaining > 0) parts.push(`+${remaining} okutma daha`);
  return parts.join(' · ');
}
export function departmentLabel(value: string | null | undefined): string {
  return !value || ['-', '—', 'Belirtilmemiş'].includes(value.trim()) ? 'Departmansız' : value;
}
export function formatShortMinutes(value: number): string {
  return value > 0 ? `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}` : '0:00';
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
