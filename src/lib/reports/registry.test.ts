import { describe, expect, it } from 'vitest';
import { REPORTS, getReport, reportColumns, reportsInGroup } from './registry';
import { isReportGroupKey } from './groups';
import { monthlySheet } from './testFixtures';
import { buildMonthlyStatusRows } from './rows';
describe('report registry', () => {
  it('contains six unique reports in valid groups with labelled unique columns', () => {
    expect(REPORTS).toHaveLength(6);
    expect(new Set(REPORTS.map(report => report.slug)).size).toBe(6);
    for (const report of REPORTS) {
      expect(isReportGroupKey(report.group)).toBe(true);
      expect(report.columns.every(column => column.label.trim())).toBe(true);
      expect(new Set(report.columns.map(column => column.key)).size).toBe(report.columns.length);
      expect(getReport(report.group, report.slug)).toBe(report);
      expect(report.formats).toEqual(['excel', 'csv', 'pdf']);
    }
    expect(reportsInGroup('gunluk')).toHaveLength(4);
    expect(reportsInGroup('resmi')).toEqual([]);
    expect(getReport('aylik', 'ham-okutmalar')).toBeUndefined();
  });
  it('puts the monthly day matrix between identities and totals', () => {
    const def = getReport('aylik', 'aylik-durum');
    if (!def) throw new Error('Missing monthly definition');
    const sheet = monthlySheet(); const columns = reportColumns(def, sheet.days);
    expect(columns.map(column => column.key).slice(0, 5)).toEqual(['name', 'department', 'payrollCode', 'day:19', 'duration']);
    expect(columns.find(column => column.key === 'day:19')?.value(buildMonthlyStatusRows(sheet)[0])).toBe('N');
  });
});
