import type { ReactNode } from "react";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ResponsiveResults } from "@/components/shared/ResponsiveResults";
import type { Visitor } from "@/types/visitor";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { visitorPresenceLabels, visitorStatusInfo } from "./lib/status";
import { formatVisitorTime } from "./visitorTime";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";

export default function VisitorTable({ visitors, onOpen, loading = false, emptyState }: { loading?: boolean; emptyState?: ReactNode; visitors: Visitor[]; onOpen: (visitor: Visitor) => void }) {
  const name = (visitor: Visitor) => <button type="button" className="max-w-full break-words text-left font-medium focus-visible:outline-primary" onClick={() => onOpen(visitor)}>{visitor.firstName} {visitor.lastName}</button>;
  const badge = (visitor: Visitor) => <StatusBadge tone={visitorStatusInfo[visitor.status].tone}>{visitorStatusInfo[visitor.status].label}</StatusBadge>;
  const menu = (visitor: Visitor) => <RowActions label={`${visitor.firstName} ${visitor.lastName} işlemleri`}><DropdownMenuItem onSelect={() => onOpen(visitor)}>Ziyaret ayrıntısını aç</DropdownMenuItem></RowActions>;
  return <ResponsiveResults label="Ziyaretçiler" mobile={loading ? <SectionSkeleton rows={6} label="Ziyaretçiler yükleniyor" /> : !visitors.length ? emptyState : <ul className="divide-y">
      {visitors.map(visitor => <li key={visitor._id} onClick={onRowActivate(() => onOpen(visitor))} className={`${ROW_CLICK_CLASS} grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_36px] items-center gap-2 px-3 py-3`}>
        <div className="min-w-0">{name(visitor)}<p className="mt-1 break-words text-xs tabular-nums text-muted-foreground">{formatVisitorTime(visitor.visitEnd)}</p></div>
        <div className="min-w-0 [&_span]:whitespace-normal">{badge(visitor)}<p className="mt-1 text-xs text-muted-foreground">{visitor.presence ? visitorPresenceLabels[visitor.presence] : "—"}</p></div>
        {menu(visitor)}
      </li>)}
    </ul>} desktop={

      <Table resizeKey="visitors" density="compact" className="w-full table-fixed"><TableHeader><TableRow>
        <TableHead columnId="name" className="w-[20%]">Ziyaretçi</TableHead><TableHead columnId="host" className="w-[15%]">Ziyaret edilen</TableHead><TableHead columnId="access-region" className="w-[16%]">Erişim bölgesi</TableHead><TableHead columnId="valid-until" className="w-[16%]">Geçerlilik bitişi</TableHead><TableHead columnId="access" className="w-[17%]">Erişim</TableHead><TableHead columnId="presence">Son konum</TableHead><TableHead columnId="actions" resizable={false} resizeLabel="İşlemler" className="w-14"><span className="sr-only">İşlemler</span></TableHead>
      </TableRow></TableHeader><TableBody>{loading ? <TableStateRow colSpan={7} state="loading" label="Ziyaretçiler yükleniyor" /> : !visitors.length ? <TableStateRow colSpan={7} state="custom">{emptyState}</TableStateRow> : visitors.map(visitor => <TableRow key={visitor._id} className={ROW_CLICK_CLASS} onClick={onRowActivate(() => onOpen(visitor))}>
        <TableCell className="truncate"><button type="button" className="max-w-full truncate text-left font-medium focus-visible:outline-primary" title={`${visitor.firstName} ${visitor.lastName}`} onClick={() => onOpen(visitor)}>{visitor.firstName} {visitor.lastName}</button></TableCell><TableCell className="truncate" title={visitor.hostName ?? undefined}>{visitor.hostName ?? "—"}</TableCell>
        <TableCell className="truncate" title={visitor.presetRuleName ?? undefined}>{visitor.presetRuleName ?? "—"}</TableCell><TableCell className="truncate tabular-nums" title={formatVisitorTime(visitor.visitEnd)}>{formatVisitorTime(visitor.visitEnd)}</TableCell>
        <TableCell className="[&_span]:whitespace-normal">{badge(visitor)}</TableCell><TableCell className="truncate" title={visitor.presence ? visitorPresenceLabels[visitor.presence] : "—"}>{visitor.presence ? visitorPresenceLabels[visitor.presence] : "—"}</TableCell><TableCell>{menu(visitor)}</TableCell>
      </TableRow>)}</TableBody></Table>
    } />;
}
