import { describe, expect, it } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import { REPORTS } from './registry';
import { dailyReportArgs, monthlyReportArgs, transactionReportArgs, reportQueryKey, type ReportQueryFilters } from './query';
import { transactionReducer, transactionSnapshot } from './transactions';
import { buildTransactionRows } from './rows';
import { transactionPage } from './testFixtures';

const filters: ReportQueryFilters = { projectId: 'project-a' as Id<'projects'>, from: '2026-10-01', to: '2026-10-31', person: '', year: 2026, month: 10 };
function definition(source: 'transactions' | 'monthlyPayroll' | 'pdksMatrix') {
  const report = REPORTS.find(item => item.dataSource === source);
  if (!report) throw new Error('Missing report fixture');
  return report;
}
describe('server query identity', () => {
  it('requests punches only for the time card and break reports and keys the server argument', () => {
    for (const report of REPORTS.filter(item => item.dataSource === 'pdksMatrix')) {
      const needsPunches = ['okutma-karti', 'mola', 'aylik-ozet', 'kisi-devam-dokumu'].includes(report.slug);
      const args = dailyReportArgs(filters, report);
      if (needsPunches) {
        expect(args).toHaveProperty('includePunches', true);
        expect(reportQueryKey(report, filters, 0)).not.toBe(reportQueryKey({ ...report, includePunches: false }, filters, 0));
      } else expect(args).not.toHaveProperty('includePunches');
    }
    expect(dailyReportArgs(filters)).not.toHaveProperty('includePunches');
  });
  it('passes mobile and QR sources to the server and includes them in query identity', () => {
    const mobile = REPORTS.find(report => report.slug === 'mobil-okutmalar');
    if (!mobile) throw new Error('Missing mobile report');
    expect(transactionReportArgs(filters, mobile).sources).toEqual(['mobile', 'qr']);
    expect(transactionReportArgs(filters, definition('transactions'))).not.toHaveProperty('sources');
    expect(reportQueryKey(mobile, filters, 0)).not.toBe(reportQueryKey({ ...mobile, transactionSources: ['card'] }, filters, 0));
    expect(reportQueryKey(mobile, { ...filters, person: 'Ayşe' }, 0)).toBe(reportQueryKey(mobile, filters, 0));
  });
  it('resets transaction pages for server person and department filters', () => {
    const report = definition('transactions');
    const first = transactionPage('first');
    first.page[0].employeeName = 'Mehmet';
    first.page[0].department = 'İdari';
    const second = transactionPage('second', true);
    const state = transactionReducer({ pages: {} }, { type: 'page', cursor: null, page: first });
    const snapshot = transactionSnapshot(state, first.continueCursor, second);
    const filtered = { ...filters, person: 'ayşe', departmentId: 'department-a' as Id<'departments'> };
    // Changing a server filter remounts ReportResults and resets accumulated pages.
    expect(reportQueryKey(report, filtered, 0)).not.toBe(reportQueryKey(report, filters, 0));
    const employee = { ...filters, employeeId: 'employee-a' as Id<'employees'> };
    expect(transactionReportArgs(employee).employeeId).toBe('employee-a');
    expect(reportQueryKey(report, employee, 0)).not.toBe(reportQueryKey(report, filters, 0));
    expect(buildTransactionRows(snapshot.rows).map(row => row.id)).toEqual(['first', 'second']);
    expect(buildTransactionRows(transactionSnapshot(state, first.continueCursor, second).rows).map(row => row.id)).toEqual(['first', 'second']);
  });
  it('keeps monthly query arguments and remount identity stable under client filters', () => {
    const changed = { ...filters, person: 'Mehmet', departmentId: 'department-a' as Id<'departments'>, from: 'unused', result: 'denied' as const };
    expect(monthlyReportArgs(changed)).toEqual(monthlyReportArgs(filters));
    expect(reportQueryKey(definition('monthlyPayroll'), changed, 0)).toBe(reportQueryKey(definition('monthlyPayroll'), filters, 0));
    expect(reportQueryKey(definition('monthlyPayroll'), { ...filters, month: 11 }, 0)).not.toBe(reportQueryKey(definition('monthlyPayroll'), filters, 0));
  });
  it('resets for server filters, project changes and explicit refreshes', () => {
    const transaction = definition('transactions');
    for (const changed of [{ ...filters, result: 'denied' as const }, { ...filters, to: '2026-10-20' }, { ...filters, projectId: 'project-b' as Id<'projects'> }]) {
      expect(reportQueryKey(transaction, changed, 0)).not.toBe(reportQueryKey(transaction, filters, 0));
    }
    expect(reportQueryKey(transaction, filters, 1)).not.toBe(reportQueryKey(transaction, filters, 0));
    const daily = definition('pdksMatrix');
    expect(reportQueryKey(daily, { ...filters, person: 'Ayşe' }, 0)).not.toBe(reportQueryKey(daily, filters, 0));
    expect(reportQueryKey(daily, { ...filters, departmentId: 'department-a' as Id<'departments'> }, 0)).not.toBe(reportQueryKey(daily, filters, 0));
  });
});
