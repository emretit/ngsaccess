import { FilterBar } from "@/components/shared/FilterBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface Props {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  status: string;
  statusCounts: { all: number; active: number; inactive: number };
  onStatusChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  onClear: () => void;
  hasFilters: boolean;
  hideClear?: boolean;
}
export function EmployeeFilters(p: Props) {
  return <div className={p.hideClear ? "[&>[role=search]>button:last-of-type]:hidden" : undefined}><FilterBar search={p.searchQuery} onSearchChange={p.onSearchChange} searchLabel="Personel ara" placeholder="Ad, e-posta, kart veya bordro…" onClear={p.onClear} hasFilters={p.hasFilters}>
    <Select value={p.status} onValueChange={p.onStatusChange}>
      <SelectTrigger aria-label="Personel durumu" className="h-9 w-auto min-w-40"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tüm durumlar ({p.statusCounts.all})</SelectItem>
        <SelectItem value="active">Aktif ({p.statusCounts.active})</SelectItem>
        <SelectItem value="inactive">Pasif ({p.statusCounts.inactive})</SelectItem>
      </SelectContent>
    </Select>
    <div className="min-[760px]:hidden">
      <Select value={p.sort} onValueChange={p.onSortChange}>
        <SelectTrigger aria-label="Personel sıralaması" className="h-9 w-auto min-w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[["name", "Ad"], ["department", "Departman"], ["email", "E-posta"], ["position", "Pozisyon"], ["card", "Kart no"], ["status", "Durum"]].flatMap(([key, label]) => ["asc", "desc"].map(direction => <SelectItem key={`${key}:${direction}`} value={`${key}:${direction}`}>{label} ({["card", "status"].includes(key) ? direction === "asc" ? "artan" : "azalan" : direction === "asc" ? "A–Z" : "Z–A"})</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  </FilterBar></div>;
}
