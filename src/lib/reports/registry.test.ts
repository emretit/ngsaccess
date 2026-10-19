import { describe, expect, it } from 'vitest';
import { REPORTS, getReport, reportColumns, reportsInGroup } from './registry';
import { isReportGroupKey } from './groups';
import { monthlySheet } from './testFixtures';
import { buildMonthlyStatusRows } from './rows';
describe('report registry', () => {
  it('contains sixteen unique reports in valid groups with labelled unique columns', () => {
    expect(REPORTS).toHaveLength(16);
    expect(new Set(REPORTS.map(report => report.slug)).size).toBe(16);
    for (const report of REPORTS) {
      expect(isReportGroupKey(report.group)).toBe(true);
      expect(report.columns.every(column => column.label.trim())).toBe(true);
      expect(new Set(report.columns.map(column => column.key)).size).toBe(report.columns.length);
      expect(getReport(report.group, report.slug)).toBe(report);
      expect(report.formats).toEqual(['excel', 'csv', 'pdf']);
    }
    expect(reportsInGroup('gunluk')).toHaveLength(9);
    expect(reportsInGroup('kayitlar').map(report => report.slug)).toEqual(['ham-okutmalar', 'okutma-karti', 'mobil-okutmalar']);
    expect(reportsInGroup('aylik')).toHaveLength(4);
    expect(reportsInGroup('resmi')).toEqual([]);
    expect(getReport('aylik', 'ham-okutmalar')).toBeUndefined();
  });
  it('uses minute cells only for the monthly duration matrix and no days for summaries', () => {
    const sheet = monthlySheet();
    sheet.days.push('2026-10-20');
    for (const report of reportsInGroup('aylik')) {
      const columns = reportColumns(report, sheet.days);
      const day = columns.find(column => column.key === 'day:19');
      if (report.slug === 'aylik-calisma-suresi') {
        const row = buildMonthlyStatusRows(sheet)[0];
        expect(day?.value(row)).toBe('8:55');
        expect(columns.find(column => column.key === 'day:20')?.value(row)).toBe('');
      }
      if (!report.monthlyDays) expect(columns.some(column => column.key.startsWith('day:'))).toBe(false);
    }
    const department = getReport('aylik', 'departman-bazli-devam');
    expect(department?.filters).not.toContain('person');
    expect(department?.pinnedColumns).toEqual(['department']);
    expect(getReport('kayitlar', 'okutma-karti')?.pinnedColumns).toEqual(['date', 'name']);
  });
  it('puts the monthly day matrix between identities and totals', () => {
    const def = getReport('aylik', 'aylik-durum');
    if (!def) throw new Error('Missing monthly definition');
    const sheet = monthlySheet(); const columns = reportColumns(def, sheet.days);
    expect(columns.map(column => column.key).slice(0, 5)).toEqual(['name', 'department', 'payrollCode', 'day:19', 'duration']);
    expect(columns.find(column => column.key === 'day:19')?.value(buildMonthlyStatusRows(sheet)[0])).toBe('N');
  });
});
