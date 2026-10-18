import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import type { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { auditDateRange } from '../../../convex/lib/auditLogQuery';

export type AuditArgs = Omit<FunctionArgs<typeof api.auditLog.list>, 'paginationOpts'>;
export type AuditRow = FunctionReturnType<typeof api.auditLog.list>['page'][number];
export const actionLabels = { create: 'Oluşturuldu', update: 'Güncellendi', delete: 'Silindi' };
export const timestampFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'medium' });
export const filterKeys = ['q', 'user', 'action', 'target', 'start', 'end'] as const;
export function clearAuditFilters(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  filterKeys.forEach(key => next.delete(key));
  return next;
}
export function auditArgs(params: URLSearchParams, projectId: Id<'projects'> | undefined, allProjects: boolean): AuditArgs {
  const action = params.get('action');
  const user = params.get('user');
  return {
    projectId: allProjects ? undefined : projectId, allProjects,
    ...(user === 'system' ? { actor: 'system' as const } : { userId: (user || undefined) as Id<'users'> | undefined }),
    action: action === 'create' || action === 'update' || action === 'delete' ? action : undefined,
    targetTable: params.get('target') || undefined, search: params.get('q') || undefined,
    startDate: params.get('start') || undefined, endDate: params.get('end') || undefined,
  };
}
export function auditRangeError(start?: string, end?: string) {
  try { auditDateRange(start, end); return undefined; }
  catch (error: unknown) { return `${error instanceof Error ? error.message : 'Tarih aralığı geçersiz'}.`; }
}

/** A fresh page has no previous scope; deep links retain their actor filter. */
let handoffScope: string | undefined;
let handoffRelease: ReturnType<typeof setTimeout> | undefined;
/**
 * Layout remounts the page when the project changes, so the scope whose filters are in the URL is handed to the
 * next mount. It is dropped one tick after the page unmounts, so a later deep link keeps its user filter.
 */
export const auditScopeHandoff = {
  read: () => handoffScope,
  hold(scope: string | undefined) {
    clearTimeout(handoffRelease);
    handoffScope = scope;
    return () => { handoffRelease = setTimeout(() => { handoffScope = undefined; }, 0); };
  },
};

export function auditScopeParams(params: URLSearchParams, previousScope: string | undefined, scope: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (previousScope !== undefined && previousScope !== scope) next.delete('user');
  return next;
}
