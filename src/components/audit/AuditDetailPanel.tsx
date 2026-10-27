import { DetailFieldList } from "@/components/shared/DetailFieldList";
import type { RefObject } from 'react';
import { DetailSheet } from "@/components/shared/DetailSheet";
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AUDIT_TARGET_LABELS } from '../../../convex/lib/auditLogQuery';
import { AuditChangeDetail } from './AuditChangeDetail';
import { actionLabels, timestampFormat, type AuditRow } from './auditState';

export function AuditDetailPanel({ row, onClose, returnFocus }: { returnFocus: RefObject<HTMLButtonElement | null>; row: AuditRow | null; onClose: () => void }) {
  return <DetailSheet open={Boolean(row)} onRequestClose={onClose} size="wide" scroll="all" returnFocus={returnFocus}
    title="Olay ayrıntısı" description="Kayıtlı olay ve değişen alanlar · İstanbul saati">
    {row && <div className="mt-6 min-w-0 space-y-5">
      <div className="space-y-2"><StatusBadge tone={row.action === 'delete' ? 'danger' : row.action === 'create' ? 'success' : 'info'}>{actionLabels[row.action]}</StatusBadge><h2 className="text-base font-semibold">{AUDIT_TARGET_LABELS[row.targetTable] ?? row.targetTable}</h2><p className="text-sm tabular-nums text-muted-foreground">{timestampFormat.format(row.timestamp)}</p></div>
      <DetailFieldList columns={2} className="border-y py-4" fields={[
        { key: "user", label: "Kullanıcı", value: row.userName ?? (row.userId ? 'Silinmiş kullanıcı' : 'Sistem') },
        { key: "project", label: "Proje", value: row.projectName },
      ]} />
      <AuditChangeDetail targetTable={row.targetTable} targetId={row.targetId} oldValue={row.oldValue} newValue={row.newValue} action={row.action} note={row.note} />
    </div>}
  </DetailSheet>;
}
