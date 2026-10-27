import type { FunctionArgs } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { ReportDefinition } from './registry';

export interface ReportQueryFilters {
  projectId: Id<'projects'>; from: string; to: string; person: string;
  employeeId?: Id<'employees'>; companyId?: Id<'companies'>; departmentId?: Id<'departments'>; result?: 'granted' | 'denied' | 'unknown';
  year: number; month: number;
}
export function dailyReportArgs(filters: ReportQueryFilters, definition?: ReportDefinition): FunctionArgs<typeof api.cardReadings.getPdksTableData> {
  return { projectId: filters.projectId, startDate: filters.from, endDate: filters.to, viewMode: 'matrix' as const, companyId: filters.companyId, departmentId: filters.departmentId, person: filters.person || undefined,
    ...(definition?.includePunches ? { includePunches: true } : {}) };
}
export function monthlyReportArgs(filters: ReportQueryFilters): FunctionArgs<typeof api.cardReadings.getMonthlyPayrollSheet> {
  return { projectId: filters.projectId, year: filters.year, month: filters.month, companyId: filters.companyId };
}
export function transactionReportArgs(filters: ReportQueryFilters, definition?: ReportDefinition) {
  return { projectId: filters.projectId, startDate: filters.from, endDate: filters.to, result: filters.result, employeeId: filters.employeeId, companyId: filters.companyId, departmentId: filters.departmentId,
    ...(definition?.transactionSources ? { sources: [...definition.transactionSources] } : {}) };
}
/** Only server filters and explicit refreshes may discard accumulated pages. */
export function reportQueryKey(definition: ReportDefinition, filters: ReportQueryFilters, revision: number): string {
  const args = definition.dataSource === 'pdksMatrix' ? dailyReportArgs(filters, definition)
    : definition.dataSource === 'monthlyPayroll' ? monthlyReportArgs(filters) : transactionReportArgs(filters, definition);
  return JSON.stringify([definition.slug, args, revision]);
}
