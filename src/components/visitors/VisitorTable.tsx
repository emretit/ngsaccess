import type { Visitor } from "@/types/visitor";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { visitorPresenceLabels, visitorStatusInfo } from "./lib/status";
import { formatVisitorTime } from "./visitorTime";

export default function VisitorTable({ visitors, onOpen }: { visitors: Visitor[]; onOpen: (visitor: Visitor) => void }) {
  const name = (visitor: Visitor) => <button type="button" className="max-w-full break-words text-left font-medium underline-offset-4 hover:underline focus-visible:outline-primary" onClick={() => onOpen(visitor)}>{visitor.firstName} {visitor.lastName}</button>;
  const badge = (visitor: Visitor) => <StatusBadge tone={visitorStatusInfo[visitor.status].tone}>{visitorStatusInfo[visitor.status].label}</StatusBadge>;
  const menu = (visitor: Visitor) => <RowActions label={`${visitor.firstName} ${visitor.lastName} işlemleri`}><DropdownMenuItem onSelect={() => onOpen(visitor)}>Ziyaret ayrıntısını aç</DropdownMenuItem></RowActions>;
  return <>
    <div className="min-w-0 rounded-md border min-[761px]:hidden"><ul className="divide-y">
      {visitors.map(visitor => <li key={visitor._id} className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_36px] items-center gap-2 px-3 py-3">
        <div className="min-w-0">{name(visitor)}<p className="mt-1 break-words text-xs tabular-nums text-muted-foreground">{formatVisitorTime(visitor.visitEnd)}</p></div>
        <div className="min-w-0 [&_span]:whitespace-normal">{badge(visitor)}<p className="mt-1 text-xs text-muted-foreground">{visitorPresenceLabels[visitor.presence]}</p></div>
        {menu(visitor)}
      </li>)}
    </ul></div>
    <div className="hidden min-w-0 max-w-full overflow-x-auto rounded-md border min-[761px]:block">
      <Table density="compact" className="w-full table-fixed"><TableHeader><TableRow>
        <TableHead className="w-[20%]">Ziyaretçi</TableHead><TableHead className="w-[15%]">Ziyaret edilen</TableHead><TableHead className="w-[16%]">Erişim bölgesi</TableHead><TableHead className="w-[16%]">Geçerlilik bitişi</TableHead><TableHead className="w-[17%]">Erişim</TableHead><TableHead>Son konum</TableHead><TableHead className="w-12"><span className="sr-only">İşlemler</span></TableHead>
      </TableRow></TableHeader><TableBody>{visitors.map(visitor => <TableRow key={visitor._id}>
        <TableCell className="break-words">{name(visitor)}</TableCell><TableCell className="truncate" title={visitor.hostName ?? undefined}>{visitor.hostName ?? "Seçilmedi"}</TableCell>
        <TableCell className="truncate" title={visitor.presetRuleName ?? undefined}>{visitor.presetRuleName ?? "—"}</TableCell><TableCell className="tabular-nums whitespace-normal">{formatVisitorTime(visitor.visitEnd)}</TableCell>
        <TableCell className="[&_span]:whitespace-normal">{badge(visitor)}</TableCell><TableCell>{visitorPresenceLabels[visitor.presence]}</TableCell><TableCell>{menu(visitor)}</TableCell>
      </TableRow>)}</TableBody></Table>
    </div>
  </>;
}
