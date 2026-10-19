import type { Id } from '../../../convex/_generated/dataModel';
import type { DailyCell, DailySourceRow, MonthlySheet } from './rows';
import type { TransactionPage } from './transactions';
export function dailyCell(overrides: Partial<DailyCell> = {}): DailyCell {
  return { date: '2026-10-19', firstEntry: '09:05', lastExit: '18:00', totalMinutes: 535, status: 'present', leaveType: null, isLate: false, lateMinutes: 0, payrollCode: 'N', overtimeMinutes: 0, ...overrides };
}
export function dailySource(days: DailyCell[]): DailySourceRow {
  return { id: 'employee-a', name: 'Ayşe Yılmaz', employeeId: '123', cardNumber: '123', payrollCode: 'N', payrollEmployeeCode: 'P01', department: 'Üretim', firstEntry: '09:05', lastExit: '18:00', totalHours: '8 sa 55 dk', totalMinutes: 535, overtimeMinutes: 0, overtime: '0m', overtimeHours: 0, overtimeMultiplier: 1, overtimePayTRY: null, hourlyRate: null, yearlyOvertimeLimit: 270, leaveType: '-', status: 'present', isLate: false, isEarlyExit: false, isManual: false, manualNote: null, manualEditedBy: null, detailedLogs: [], days };
}
export function monthlySheet(): MonthlySheet {
  return { year: 2026, month: 10, days: ['2026-10-19'], rows: [{ employeeId: 'employee-a' as Id<'employees'>, payrollCode: 'P01', name: 'Ayşe Yılmaz', cardNumber: '123', department: 'Üretim', hourlyRate: null,
    cells: [{ date: '2026-10-19', status: 'present', payrollCode: 'N', totalMinutes: 535, overtimeMinutes: 0, multiplier: 0, overtimePayTRY: null, isLate: false, isEarlyExit: false, isManual: false, classification: 'workday' }],
    totals: { totalMinutes: 535, overtimeMinutes: 0, overtimePayTRY: null, leaveDays: 0, absentDays: 0, lateDays: 0, exceedsDaily11h: [] } }] };
}
export function transactionPage(id = 'reading-a', hiddenBiometricCount = 0, isDone = false): TransactionPage {
  return { page: [{ _id: id as Id<'cardReadings'>, accessTime: '2026-10-18T22:10:00Z', employeeId: null, employeeName: 'Ayşe Yılmaz', department: 'Üretim', cardNo: '123', deviceName: 'Turnike', doorName: null, direction: 'entry', result: 'granted', denialReason: null, source: 'card', sourceLabel: 'Kart' }], hiddenBiometricCount, scannedCount: 50, isDone, continueCursor: `${id}-next` };
}
