import { FilterBar } from "@/components/shared/FilterBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isVisitorStatus, visitorStatusInfo, type VisitorStatus } from "./lib/status";

export type VisitorStatusFilter = "all" | VisitorStatus;
export function VisitorFilters({ searchQuery, onSearchChange, statusFilter, onStatusFilterChange, onClear, onNewZone, pageSize, onPageSizeChange }: {
  searchQuery: string; onSearchChange: (value: string) => void;
  statusFilter: VisitorStatusFilter; onStatusFilterChange: (value: VisitorStatusFilter) => void;
  onClear: () => void; onNewZone?: () => void; pageSize: number; onPageSizeChange: (value: number) => void;
}) {
  return <div className="min-w-0 space-y-2">
    <FilterBar search={searchQuery} onSearchChange={onSearchChange} searchLabel="Ziyaretçi ara" placeholder="Ad, şirket veya kart numarası" onClear={onClear} hasFilters={statusFilter !== "all"}>
      <div className="w-full space-y-1 min-[761px]:w-48"><Label htmlFor="visitor-status">Erişim durumu</Label>
        <Select value={statusFilter} onValueChange={value => onStatusFilterChange(isVisitorStatus(value) ? value : "all")}>
          <SelectTrigger id="visitor-status"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            {Object.entries(visitorStatusInfo).map(([value, info]) => <SelectItem key={value} value={value}>{info.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label htmlFor="visitor-page-size">Sayfa boyutu</Label><Select value={String(pageSize)} onValueChange={value => onPageSizeChange(Number(value))}>
        <SelectTrigger id="visitor-page-size" className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem></SelectContent>
      </Select></div>
      {onNewZone && <Button variant="outline" onClick={onNewZone}>Erişim bölgesi oluştur</Button>}
    </FilterBar>
    <p className="text-xs text-muted-foreground">Arama ve durum filtresi sunucuda yalnız alınan sayfaya uygulanır. Diğer kayıtları taramak için sonraki sayfaya geçin.</p>
  </div>;
}
