import { describe, expect, it } from 'vitest';
import { buildMonthlyStatusRows, buildDepartmentRows, countAttendance, monthlyRowsForReport, DAILY_PREDICATES, dailyRowsForReport, flattenDailyRows, formatDailyExceptions, formatPunches, formatTransactionTime, formatShortMinutes } from './rows';
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
    const row = flattenDailyRows([dailySource([dailyCell({ detail: undefined })])])[0];
    expect(() => DAILY_COLUMNS.map(column => column.value(row))).not.toThrow();
    expect(DAILY_COLUMNS.find(column => column.key === 'earlyExitMinutes')?.value(row)).toBeNull();
    expect(DAILY_COLUMNS.find(column => column.key === 'manual')?.value(row)).toBeNull();
  });
  it('selects the five new daily reports and the time card, with descending early exits', () => {
    const detail = dailyCell().detail;
    if (!detail) throw new Error('Missing day detail fixture');
    const rows = [dailySource([
      dailyCell({ date: '2026-10-01', totalMinutes: 0, firstEntry: null }),
      dailyCell({ date: '2026-10-02', isLate: true, lateMinutes: 12, detail: { ...detail, isEarlyExit: true, earlyExitMinutes: 8, punches: [{ time: '08:58', direction: 'entry' }, { time: '12:01', direction: 'exit' }, { time: '13:02', direction: 'unknown' }] } }),
      dailyCell({ date: '2026-10-03', detail: { ...detail, isEarlyExit: true, earlyExitMinutes: 30, breakViolation: true } }),
      dailyCell({ date: '2026-10-04', status: 'absent', totalMinutes: 0, firstEntry: null, detail: undefined }),
    ])];
    const dates = (slug: string) => dailyRowsForReport(rows, slug).map(row => row.cell.date.slice(-2));
    expect(dates('calisma-suresi')).toEqual(['02', '03']);
    expect(dates('ilk-giris-son-cikis')).toEqual(['02', '03']);
    expect(dates('istisnalar')).toEqual(['02', '03', '04']);
    expect(dates('erken-cikanlar')).toEqual(['03', '02']);
    expect(dates('mola-ihlalleri')).toEqual(['03']);
    expect(dates('okutma-karti')).toEqual(['02']);
    expect(formatDailyExceptions(rows[0].days[1])).toBe('Geç 12 dk · Erken çıkış 8 dk');
    expect(formatDailyExceptions(rows[0].days[3])).toBe('Devamsız');
    expect(formatPunches(rows[0].days[1])).toBe('08:58 Giriş · 12:01 Çıkış · 13:02 —');
    expect(formatPunches(rows[0].days[3])).toBe('');
    for (const predicate of Object.values(DAILY_PREDICATES)) expect(() => predicate(dailyCell({ detail: undefined }))).not.toThrow();
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
describe('monthly attendance reports', () => {
  function fixture() {
    const sheet = monthlySheet();
    const cell = sheet.rows[0].cells[0];
    sheet.rows[0].cells = [
      { ...cell, totalMinutes: 515, isLate: true, isEarlyExit: true, overtimeMinutes: 35 },
      { ...cell, date: '2026-10-18', payrollCode: 'DV', status: 'absent', totalMinutes: 0 },
      { ...cell, date: '2026-10-17', payrollCode: 'İZN', status: 'leave', totalMinutes: 0 },
      { ...cell, date: '2026-10-16', payrollCode: 'HT', classification: 'weekend', status: 'weekend', totalMinutes: 0 },
      { ...cell, date: '2026-10-15', payrollCode: 'RT', classification: 'halfDayHoliday', status: 'holiday', totalMinutes: 0 },
      { ...cell, date: '2026-10-20', payrollCode: '—', status: 'future', totalMinutes: 500, isLate: true, isEarlyExit: true },
      { ...cell, date: '2026-10-14', payrollCode: '—', status: 'noData', totalMinutes: 0 },
    ];
    sheet.rows[0].totals = { ...sheet.rows[0].totals, totalMinutes: 515, overtimeMinutes: 35 };
    return sheet;
  }
  it('counts actual payroll codes and flags, excluding future and unavailable cells', () => {
    expect(countAttendance(fixture().rows[0].cells)).toEqual({ workedDays: 1, holidayWorkedDays: 0, lateDays: 1, earlyExitDays: 1, absentDays: 1, leaveDays: 1, weekendDays: 1, holidayDays: 1 });
    expect(formatShortMinutes(515)).toBe('8:35'); expect(formatShortMinutes(0)).toBe('');
  });
  it('aggregates people, days and authoritative duration totals by department', () => {
    const sheet = fixture(); const base = sheet.rows[0];
    sheet.rows.push({ ...base, employeeId: monthlySheet('employee-b').rows[0].employeeId, name: 'Mehmet', cells: [base.cells[0]], totals: { ...base.totals, totalMinutes: 100, overtimeMinutes: 5 } });
    sheet.rows.push({ ...base, employeeId: monthlySheet('employee-c').rows[0].employeeId, name: 'Zeynep', department: 'İdari', cells: [base.cells[2]], totals: { ...base.totals, totalMinutes: 0, overtimeMinutes: 0 } });
    const departments = buildDepartmentRows(buildMonthlyStatusRows(sheet));
    const production = departments.find(row => row.department === 'Üretim');
    expect(production).toMatchObject({ personCount: 2, totalMinutes: 615, overtimeMinutes: 40, attendance: { workedDays: 2, absentDays: 1, lateDays: 2, earlyExitDays: 2, leaveDays: 1 } });
    expect(production?.attendanceRate).toBeCloseTo(200 / 3);
    expect(departments.find(row => row.department === 'İdari')?.attendanceRate).toBeNull();
    expect(monthlyRowsForReport(sheet, 'departments', 'nonmatching person', 'Üretim')).toHaveLength(1);
    expect(monthlyRowsForReport(sheet, 'people', 'ayşe', 'Üretim')).toHaveLength(1);
    expect(monthlyRowsForReport(sheet, 'people', 'ayşe', 'İdari')).toEqual([]);
  });
});

describe('attendance correction regressions', () => {
  it('ignores non-workday and missing-detail late/early flags, retaining absences', () => {
    const detail = dailyCell().detail;
    if (!detail) throw new Error('Missing detail');
    const workday = dailyCell({ isLate: true, lateMinutes: 12, detail: { ...detail, isEarlyExit: true, earlyExitMinutes: 8 } });
    const otherDays = (['weekend', 'holiday', 'halfDayHoliday'] as const).map(dayType => ({ ...workday, detail: { ...workday.detail, ...detail, dayType, isEarlyExit: true, earlyExitMinutes: 8 } }));
    const missing = { ...workday, detail: undefined };
    for (const cell of [...otherDays, missing]) {
      for (const slug of ['gec-kalanlar', 'erken-cikanlar', 'istisnalar']) expect(DAILY_PREDICATES[slug](cell)).toBe(false);
      expect(formatDailyExceptions(cell)).toBe('');
      expect(DAILY_PREDICATES.istisnalar({ ...cell, status: 'absent' })).toBe(true);
    }
    expect(DAILY_PREDICATES['gec-kalanlar'](workday)).toBe(true);
    expect(DAILY_PREDICATES['erken-cikanlar'](workday)).toBe(true);
    expect(formatDailyExceptions(workday)).toBe('Geç 12 dk · Erken çıkış 8 dk');
  });
  it('separates holiday work and uses N plus DV as the attendance denominator', () => {
    const sheet = monthlySheet();
    const cell = sheet.rows[0].cells[0];
    const worked = Array.from({ length: 20 }, (_, index) => ({ ...cell, date: `2026-10-${index + 1}`, totalMinutes: index === 0 ? 0 : 480 }));
    const absences = Array.from({ length: 2 }, () => ({ ...cell, payrollCode: 'DV', status: 'absent' as const, totalMinutes: 0 }));
    const weekends = Array.from({ length: 4 }, () => ({ ...cell, payrollCode: 'HT', classification: 'weekend' as const, totalMinutes: 240, isLate: true, isEarlyExit: true }));
    sheet.rows[0].cells = [...worked, ...absences, ...weekends];
    const department = buildDepartmentRows(buildMonthlyStatusRows(sheet))[0];
    expect(department.attendance).toMatchObject({ workedDays: 20, absentDays: 2, holidayWorkedDays: 4, lateDays: 0, earlyExitDays: 0 });
    expect(department.attendanceRate).toBeCloseTo(20 / 22 * 100);
    expect(department.attendanceRate?.toLocaleString('tr-TR', { maximumFractionDigits: 1 })).toBe('90,9');
    const leave = { ...cell, payrollCode: 'İZN', status: 'leave' as const, totalMinutes: 240 };
    const holiday = { ...cell, payrollCode: 'RT', classification: 'holiday' as const, isLate: true, isEarlyExit: true };
    const halfDay = { ...holiday, classification: 'halfDayHoliday' as const };
    expect(countAttendance([leave, holiday, halfDay])).toMatchObject({ workedDays: 0, leaveDays: 1, holidayWorkedDays: 1, lateDays: 0, earlyExitDays: 0 });
    expect(countAttendance([{ ...cell, status: 'late', isLate: true }])).toMatchObject({ workedDays: 1, lateDays: 1 });
  });
  it('discloses the number of omitted punches without inventing counts', () => {
    const cell = dailyCell();
    if (!cell.detail) throw new Error('Missing detail');
    cell.detail.punches = Array.from({ length: 24 }, () => ({ time: '09:00', direction: 'entry' }));
    cell.detail.readingCount = 30;
    expect(formatPunches(cell)).toMatch(/ · \+6 okutma daha$/);
    cell.detail.readingCount = 24;
    expect(formatPunches(cell)).not.toContain('okutma daha');
  });
});
