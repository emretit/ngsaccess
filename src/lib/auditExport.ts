import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../convex/_generated/api';
import type { AuditRow } from '@/components/audit/auditState';
import { timestampFormat } from '@/components/audit/auditState';
import { AUDIT_TARGET_LABELS } from '../../convex/lib/auditLogQuery';
import { auditChanges, auditFieldLabel, auditFieldDisplayValue, maskAuditValue } from '@/components/audit/auditLabels';

type AuditPage = FunctionReturnType<typeof api.auditLog.list>;
export async function collectAuditExport(fetchPage: (cursor: string | null) => Promise<AuditPage>, signal: AbortSignal, progress: (count: number) => void) {
  const rows: AuditRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    signal.throwIfAborted();
    const page = await fetchPage(cursor);
    signal.throwIfAborted();
    const remaining = 10000 - rows.length;
    rows.push(...page.page.slice(0, remaining));
    progress(rows.length);
    if (page.page.length > remaining) return { rows, truncated: true };
    if (page.isDone) return { rows, truncated: false };
    // Continue past empty filtered pages and probe beyond exactly 10,000 matches.
    if (page.continueCursor === cursor) throw new Error('Denetim sayfalaması ilerleyemedi');
    cursor = page.continueCursor;
  }
}
export function auditExportRows(rows: AuditRow[]) {
  const labels = { create: 'Oluşturma', update: 'Güncelleme', delete: 'Silme' };
  return [['Zaman', 'Kullanıcı', 'Proje', 'Tablo', 'İşlem', 'Kayıt', 'Özet/Değişiklik'], ...rows.map(row => [
    timestampFormat.format(row.timestamp), row.userName ?? 'Sistem', row.projectName,
    AUDIT_TARGET_LABELS[row.targetTable] ?? row.targetTable, labels[row.action], row.targetId,
    [row.note, ...auditChanges(row.oldValue, row.newValue).map(change => `${auditFieldLabel(row.targetTable, change.field)}: ${auditFieldDisplayValue(change.field, maskAuditValue(change.field, change.before))} → ${auditFieldDisplayValue(change.field, maskAuditValue(change.field, change.after))}`)].filter(value => value !== undefined && value !== '').join('; ').replace(/\s+/g, ' ').slice(0, 1000),
  ])];
}
