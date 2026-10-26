import { departmentLabel, type DailyCell, type DailySourceRow } from './rows';

export interface PersonMonthTotals {
  workedDays: number; totalMinutes: number; overtimeMinutes: number;
  lateDays: number; lateMinutes: number; earlyExitDays: number; earlyExitMinutes: number;
  absentDays: number; leaveDays: number; leaveByType: Record<string, number>;
  workdays: number; weekendDays: number; holidayDays: number; holidayWorkedDays: number;
  breakMinutes: number; incompleteDays: number;
}
export interface PersonMonthReportRow {
  kind: 'personMonth'; id: string; name: string; department: string; payrollCode: string;
  days: DailyCell[]; totals: PersonMonthTotals;
}
export function countedMonthDay(cell: DailyCell): boolean {
  return !cell.noShift && !['future', 'noData', 'notEmployed'].includes(cell.status);
}
export function personMonthTotals(days: readonly DailyCell[]): PersonMonthTotals {
  const totals: PersonMonthTotals = { workedDays: 0, totalMinutes: 0, overtimeMinutes: 0, lateDays: 0, lateMinutes: 0,
    earlyExitDays: 0, earlyExitMinutes: 0, absentDays: 0, leaveDays: 0, leaveByType: {},
    workdays: 0, weekendDays: 0, holidayDays: 0, holidayWorkedDays: 0, breakMinutes: 0, incompleteDays: 0 };
  for (const cell of days) {
    if (!countedMonthDay(cell)) continue;
    totals.totalMinutes += cell.totalMinutes;
    totals.overtimeMinutes += cell.overtimeMinutes;
    totals.breakMinutes += cell.detail?.breakMinutes ?? 0;
    const dayType = cell.detail?.dayType;
    if (dayType === 'workday') totals.workdays += 1;
    else if (dayType === 'weekend') totals.weekendDays += 1;
    else if (dayType === 'holiday' || dayType === 'halfDayHoliday') totals.holidayDays += 1;
    // Like countAttendance, an incomplete day contributes only to review, never attendance counts.
    if (cell.status === 'incomplete') { totals.incompleteDays += 1; continue; }
    if (cell.payrollCode === 'N') totals.workedDays += 1;
    if ((dayType === 'weekend' || dayType === 'holiday') && cell.totalMinutes > 0) totals.holidayWorkedDays += 1;
    if (dayType === 'workday' && cell.isLate) { totals.lateDays += 1; totals.lateMinutes += cell.lateMinutes; }
    if (dayType === 'workday' && cell.detail?.isEarlyExit) { totals.earlyExitDays += 1; totals.earlyExitMinutes += cell.detail.earlyExitMinutes; }
    if (cell.payrollCode === 'DV') totals.absentDays += 1;
    if (cell.payrollCode === 'İZN') {
      totals.leaveDays += 1;
      const type = cell.leaveType ?? 'unspecified';
      Object.defineProperty(totals.leaveByType, type, { value: (Object.prototype.hasOwnProperty.call(totals.leaveByType, type) ? totals.leaveByType[type] : 0) + 1, writable: true, enumerable: true, configurable: true });
    }
  }
  return totals;
}
export function buildPersonMonthRows(rows: readonly DailySourceRow[]): PersonMonthReportRow[] {
  return rows.map(row => ({ kind: 'personMonth', id: row.id, name: row.name, department: departmentLabel(row.department),
    payrollCode: row.payrollEmployeeCode, days: row.days, totals: personMonthTotals(row.days) }));
}
