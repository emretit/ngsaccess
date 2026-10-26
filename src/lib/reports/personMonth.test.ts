import { expect, it } from 'vitest';
import { buildPersonMonthRows, personMonthTotals } from './personMonth';
import { dailyCell, dailySource } from './testFixtures';

it('aggregates daily evidence without counting future, unavailable or review days as attendance', () => {
  const detail = dailyCell().detail;
  if (!detail) throw new Error('Missing detail');
  const days = [
    dailyCell({ totalMinutes: 450, overtimeMinutes: 30, isLate: true, lateMinutes: 15, detail: { ...detail, isEarlyExit: true, earlyExitMinutes: 10, breakMinutes: 45 } }),
    dailyCell({ payrollCode: 'HT', status: 'weekend', totalMinutes: 120, isLate: true, lateMinutes: 40, detail: { ...detail, dayType: 'weekend' } }),
    dailyCell({ payrollCode: 'RT', status: 'holiday', totalMinutes: 60, overtimeMinutes: 60, detail: { ...detail, dayType: 'holiday' } }),
    dailyCell({ payrollCode: 'DV', status: 'absent', totalMinutes: 0 }),
    dailyCell({ payrollCode: 'İZN', status: 'leave', totalMinutes: 0, leaveType: 'annual' }),
    dailyCell({ payrollCode: 'İZN', status: 'leave', totalMinutes: 0, leaveType: 'sick' }),
    dailyCell({ payrollCode: '—', status: 'incomplete', totalMinutes: 30, isLate: true, lateMinutes: 999, detail: { ...detail, isEarlyExit: true, earlyExitMinutes: 999, breakMinutes: 5 } }),
    dailyCell({ status: 'future', totalMinutes: 999, overtimeMinutes: 999, isLate: true }),
    dailyCell({ status: 'noData', totalMinutes: 999, overtimeMinutes: 999 }),
    dailyCell({ status: 'notEmployed', totalMinutes: 999 }),
  ];
  expect(personMonthTotals(days)).toEqual({ workedDays: 1, totalMinutes: 660, overtimeMinutes: 90, lateDays: 1, lateMinutes: 15,
    earlyExitDays: 1, earlyExitMinutes: 10, absentDays: 1, leaveDays: 2, leaveByType: { annual: 1, sick: 1 }, workdays: 5,
    weekendDays: 1, holidayDays: 1, holidayWorkedDays: 2, breakMinutes: 50, incompleteDays: 1 });
  const rows = buildPersonMonthRows([dailySource(days)]);
  expect(rows[0]).toMatchObject({ kind: 'personMonth', id: 'employee-a', payrollCode: 'P01', department: 'Üretim' });
  expect(rows[0].days).toBe(days);
});
it('keeps unknown leave types and treats a half-day holiday as a single calendar day', () => {
  const detail = dailyCell().detail;
  if (!detail) throw new Error('Missing detail');
  expect(personMonthTotals([dailyCell({ status: 'leave', payrollCode: 'İZN', totalMinutes: 0, leaveType: '__proto__', detail: { ...detail, dayType: 'halfDayHoliday' } })])).toMatchObject({ leaveDays: 1, holidayDays: 1, workdays: 0 });
  expect(Object.keys(personMonthTotals([dailyCell({ payrollCode: 'İZN', leaveType: '__proto__' })]).leaveByType)).toEqual(['__proto__']);
});
