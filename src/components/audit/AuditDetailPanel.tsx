import type { RefObject } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AUDIT_TARGET_LABELS } from '../../../convex/lib/auditLogQuery';
import { AuditChangeDetail } from './AuditChangeDetail';
import { actionLabels, timestampFormat, type AuditRow } from './auditState';

export function AuditDetailPanel({ row, onClose, returnFocus }: { returnFocus: RefObject<HTMLButtonElement | null>; row: AuditRow | null; onClose: () => void }) {
  return <Sheet open={Boolean(row)} onOpenChange={open => { if (!open) onClose(); }}><SheetContent size="full" onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }} className="w-full overflow-y-auto sm:max-w-[720px]">
    <SheetHeader><SheetTitle>Olay ayrıntısı</SheetTitle><SheetDescription>Kayıtlı olay ve değişen alanlar · İstanbul saati</SheetDescription></SheetHeader>
    {row && <div className="mt-6 min-w-0 space-y-5">
      <div className="space-y-2"><StatusBadge tone={row.action === 'delete' ? 'danger' : row.action === 'create' ? 'success' : 'info'}>{actionLabels[row.action]}</StatusBadge><h2 className="text-base font-semibold">{AUDIT_TARGET_LABELS[row.targetTable] ?? row.targetTable}</h2><p className="text-sm tabular-nums text-muted-foreground">{timestampFormat.format(row.timestamp)}</p></div>
      <dl className="grid min-w-0 gap-3 border-y py-4 sm:grid-cols-2"><div className="min-w-0"><dt className="text-xs text-muted-foreground">Kullanıcı</dt><dd className="break-words text-sm">{row.userName ?? (row.userId ? 'Silinmiş kullanıcı' : 'Sistem')}</dd></div><div className="min-w-0"><dt className="text-xs text-muted-foreground">Proje</dt><dd className="break-words text-sm">{row.projectName}</dd></div></dl>
      <AuditChangeDetail targetTable={row.targetTable} targetId={row.targetId} oldValue={row.oldValue} newValue={row.newValue} action={row.action} note={row.note} />
    </div>}
  </SheetContent></Sheet>;
}
