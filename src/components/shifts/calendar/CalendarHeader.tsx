import { CalendarMinus, CalendarPlus, ChevronDown, Download } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function CalendarHeader({ activeCount, loading, exporting, onAssign, onExport, onClear }: {
  activeCount: number; loading: boolean; exporting: boolean;
  onAssign: () => void;
  onExport: (format: "xlsx" | "csv") => void; onClear: () => void;
}) {
  const { can } = usePermissions();
  const canManage = can("schedule.manage");
  const canExport = can("reports.view");
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canManage && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-9 px-3 text-sm" disabled={loading}>
            Vardiya ata
            <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="w-64">
          <DropdownMenuItem onSelect={onAssign} disabled={activeCount === 0} className="gap-2 py-2">
            <CalendarPlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Yeni atama</span>
              <span className="text-xs text-muted-foreground">{activeCount > 0 ? "Çalışan, vardiya ve tarih seçin" : "Önce bir vardiya ekleyin"}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onClear} className="gap-2 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
            <CalendarMinus className="size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Vardiya atamalarını kaldır</span>
              <span className="text-xs text-muted-foreground">Projedeki tüm atamaları temizle</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}
      {canExport && <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" className="h-9 px-3 text-sm">İşlemler</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={loading || exporting}><Download className="mr-2 size-4" aria-hidden="true" />Dışa aktar</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Görünen sayfa ve dönem</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>}
    </div>
  );
}
