import { describe, expect, it } from 'vitest';
import { buildMonthlyStatusRows, DAILY_PREDICATES, dailyRowsForReport, flattenDailyRows, formatTransactionTime } from './rows';
import { DAILY_COLUMNS } from './registry';
import { dailyCell, dailySource, monthlySheet } from './testFixtures';
describe('daily report rows', () => {
  const source = [dailySource([
    dailyCell(), dailyCell({ date: '2026-10-18', status: 'late', isLate: true, lateMinutes: 8 }), dailyCell({ date: '2026-10-17', status: 'absent' }),
    dailyCell({ date: '2026-10-16', overtimeMinutes: 60 }), dailyCell({ date: '2026-10-15', isLate: true, lateMinutes: 30 }), dailyCell({ date: '2026-10-20', status: 'future', isLate: true }), dailyCell({ date: '2026-10-14', status: 'noData' }),
  ])];
  it('flattens person × day and always excludes future or unavailable data', () => {
    const rows = flattenDailyRows(source);
    expect(rows).toHaveLength(5); expect(new Set(rows.map(row => row.id)).size).toBe(5);
    expect(rows[0].name).toBe('Ayşe Yılmaz'); expect(rows[0].payrollCode).toBe('P01');
  });
  it('applies all four report predicates and sorts late minutes descending', () => {
    expect(flattenDailyRows(source, DAILY_PREDICATES['gunluk-puantaj'])).toHaveLength(5);
    expect(dailyRowsForReport(source, 'gec-kalanlar').map(row => row.cell.lateMinutes)).toEqual([30, 8]);
    expect(flattenDailyRows(source, DAILY_PREDICATES.devamsizlar).map(row => row.cell.status)).toEqual(['absent']);
    expect(flattenDailyRows(source, DAILY_PREDICATES['fazla-mesai']).map(row => row.cell.overtimeMinutes)).toEqual([60]);
  });
  it('handles legacy cells without detail without inventing zero values', () => {
    const row = flattenDailyRows(source)[0];
    expect(() => DAILY_COLUMNS.map(column => column.value(row))).not.toThrow();
    expect(DAILY_COLUMNS.find(column => column.key === 'earlyExitMinutes')?.value(row)).toBeNull();
    expect(DAILY_COLUMNS.find(column => column.key === 'manual')?.value(row)).toBeNull();
  });
  it('retains monthly cells and authoritative totals', () => {
    const sheet = monthlySheet(); const rows = buildMonthlyStatusRows(sheet);
    expect(rows[0].id).toBe('employee-a'); expect(rows[0].cells[0].payrollCode).toBe('N'); expect(rows[0].totals.totalMinutes).toBe(535);
    expect(sheet.rows[0]).not.toHaveProperty('kind');
  });
  it('formats a UTC reading on its Turkish calendar day', () => {
    const value = formatTransactionTime('2026-10-18T22:10:00Z');
    expect(value).toContain('19.10.2026'); expect(value).toContain('01:10:00');
  });
});
