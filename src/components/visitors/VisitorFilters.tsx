import { FilterBar } from "@/components/shared/FilterBar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isVisitorStatus, visitorStatusInfo, type VisitorStatus } from "./lib/status";

export type VisitorStatusFilter = "all" | VisitorStatus;
export function VisitorFilters({ searchQuery, onSearchChange, statusFilter, onStatusFilterChange, onClear }: {
  searchQuery: string; onSearchChange: (value: string) => void;
  statusFilter: VisitorStatusFilter; onStatusFilterChange: (value: VisitorStatusFilter) => void;
  onClear: () => void;
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
    </FilterBar>

  </div>;
}
