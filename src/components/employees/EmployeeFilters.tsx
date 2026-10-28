import { FilterBar, FilterField } from "@/components/shared/FilterBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  status: string;
  statusCounts: { all: number; active: number; inactive: number; terminated?: number };
  onStatusChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  onClear: () => void;
  hasFilters: boolean;
}
export function EmployeeFilters(p: Props) {
  return <FilterBar search={p.searchQuery} onSearchChange={p.onSearchChange} searchLabel="Personel ara" placeholder="Ad, e-posta, kart veya bordro…" onClear={p.onClear} hasFilters={p.hasFilters}>
    <FilterField label="Personel durumu" htmlFor="employee-status"><Select value={p.status} onValueChange={p.onStatusChange}>
      <SelectTrigger id="employee-status" className="w-full min-w-0"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tüm durumlar ({p.statusCounts.all})</SelectItem>
        <SelectItem value="active">Aktif ({p.statusCounts.active})</SelectItem>
        <SelectItem value="inactive">Pasif ({p.statusCounts.inactive})</SelectItem>
        <SelectItem value="terminated">Ayrılanlar ({p.statusCounts.terminated ?? 0})</SelectItem>
      </SelectContent>
    </Select></FilterField>
    <div className="min-[760px]:hidden w-full min-w-0">
      <FilterField label="Personel sıralaması" htmlFor="employee-sort">
      <Select value={p.sort} onValueChange={p.onSortChange}>
        <SelectTrigger id="employee-sort" className="w-full min-w-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[["name", "Ad"], ["department", "Departman"], ["email", "E-posta"], ["position", "Pozisyon"], ["card", "Kart no"], ["status", "Durum"]].flatMap(([key, label]) => ["asc", "desc"].map(direction => <SelectItem key={`${key}:${direction}`} value={`${key}:${direction}`}>{label} ({["card", "status"].includes(key) ? direction === "asc" ? "artan" : "azalan" : direction === "asc" ? "A–Z" : "Z–A"})</SelectItem>))}
        </SelectContent>
      </Select></FilterField>
    </div>
  </FilterBar>;
}
