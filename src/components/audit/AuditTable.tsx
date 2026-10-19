import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AUDIT_TARGET_LABELS } from '../../../convex/lib/auditLogQuery';
import { actionLabels, timestampFormat, type AuditRow } from './auditState';

export function AuditTable({ rows, allProjects, onSelect }: { rows: AuditRow[]; allProjects?: boolean; onSelect: (row: AuditRow, trigger: HTMLButtonElement) => void }) {
  return <div className="min-w-0 overflow-x-auto rounded-md border"><table className="w-full table-fixed text-left text-xs" aria-label="Denetim kayıtları">
    <thead className="h-9 border-b bg-muted/40 text-muted-foreground"><tr>
      <th scope="col" className="hidden w-[172px] px-3 font-medium lg:table-cell">Zaman (TR)</th><th scope="col" className="hidden w-[140px] px-3 font-medium lg:table-cell">Kullanıcı</th><th scope="col" className="w-[104px] px-3 font-medium">Eylem</th><th scope="col" className="px-3 font-medium md:w-[150px]">Varlık</th>
      {allProjects && <th scope="col" className="hidden w-[140px] px-3 font-medium xl:table-cell">Proje</th>}<th scope="col" className="hidden px-3 font-medium md:table-cell">Not</th><th scope="col" className="w-[76px] px-2 font-medium"><span className="sr-only">Ayrıntı</span></th>
    </tr></thead>
    <tbody>{rows.map(row => { const actor = row.userName ?? (row.userId ? 'Silinmiş kullanıcı' : 'Sistem'); return <tr key={row._id} className="h-[42px] border-b last:border-0 hover:bg-muted/30">
      <td className="hidden px-3 tabular-nums lg:table-cell"><time dateTime={new Date(row.timestamp).toISOString()}>{timestampFormat.format(row.timestamp)}</time></td><td className="hidden [overflow-wrap:anywhere] px-3 lg:table-cell">{actor}</td>
      <td className="px-3 py-2"><StatusBadge tone={row.action === 'delete' ? 'danger' : row.action === 'create' ? 'success' : 'info'}>{actionLabels[row.action]}</StatusBadge></td>
      <td className="min-w-0 break-words px-3 py-2"><span>{AUDIT_TARGET_LABELS[row.targetTable] ?? row.targetTable}</span><div className="mt-1 break-words text-muted-foreground lg:hidden">{actor}<br /><time className="tabular-nums">{timestampFormat.format(row.timestamp)}</time></div>{allProjects && <div className="mt-1 break-words text-muted-foreground xl:hidden">{row.projectName}</div>}</td>
      {allProjects && <td className="hidden truncate px-3 xl:table-cell">{row.projectName}</td>}<td className="hidden truncate px-3 text-muted-foreground md:table-cell">{row.note || '—'}</td>
      <td className="px-1"><Button variant="ghost" size="sm" className="min-h-10 px-2 text-xs" aria-haspopup="dialog" aria-label={`${timestampFormat.format(row.timestamp)} · ${actor} · Olay ayrıntısı`} onClick={event => onSelect(row, event.currentTarget)}>Ayrıntı</Button></td>
    </tr>; })}</tbody>
  </table></div>;
}
