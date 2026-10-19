import type { Id } from '../../../convex/_generated/dataModel';
import type { ReportDefinition } from './registry';

export interface ReportQueryFilters {
  projectId: Id<'projects'>; from: string; to: string; person: string;
  departmentId?: Id<'departments'>; result?: 'granted' | 'denied' | 'unknown';
  year: number; month: number;
}
export function dailyReportArgs(filters: ReportQueryFilters) {
  return { projectId: filters.projectId, startDate: filters.from, endDate: filters.to, viewMode: 'matrix' as const, departmentId: filters.departmentId, person: filters.person || undefined };
}
export function monthlyReportArgs(filters: ReportQueryFilters) {
  return { projectId: filters.projectId, year: filters.year, month: filters.month };
}
export function transactionReportArgs(filters: ReportQueryFilters) {
  return { projectId: filters.projectId, startDate: filters.from, endDate: filters.to, result: filters.result };
}
/** Only server filters and explicit refreshes may discard accumulated pages. */
export function reportQueryKey(definition: ReportDefinition, filters: ReportQueryFilters, revision: number): string {
  const args = definition.dataSource === 'pdksMatrix' ? dailyReportArgs(filters)
    : definition.dataSource === 'monthlyPayroll' ? monthlyReportArgs(filters) : transactionReportArgs(filters);
  return JSON.stringify([definition.slug, args, revision]);
}
