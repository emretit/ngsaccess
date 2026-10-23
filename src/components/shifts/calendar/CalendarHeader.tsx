import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuLabel,
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
      {canManage && activeCount > 0 && <Button disabled={loading} onClick={onAssign}>Vardiya ata</Button>}
      {(canManage || canExport) && <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline">İşlemler</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canExport && <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={loading || exporting}>Dışa aktar</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Görünen sayfa ve dönem</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>}
          {canManage && <DropdownMenuItem onClick={onClear}>Toplu temizle</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>}
    </div>
  );
}
