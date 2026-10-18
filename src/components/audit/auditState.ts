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
