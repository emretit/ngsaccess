import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/shared/FilterBar";

interface DeviceFiltersProps {
  onClearFilters?: () => void;
  /** Sol panelde bölge/kapı seçili mi (temizle düğmesi için). */
  locationActive?: boolean;
  statusCounts: { all: number; online: number; offline: number; never: number };
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  deviceTypes: string[];
  /** Sıfırdan yeni cihaz oluşturma akışı. */
  onAddNew: () => void;
  /** Buluttan (havuzdan) cihaz ekleme akışı. */
  onAddFromCloud: () => void;
  /** "Cihaz Ekle" menüsünü gösterir (admin değilse gizlenir). Vars: true. */
  showNewDevice?: boolean;
  deviceCount: number;
  filteredCount: number;
}

export function DeviceFilters({ onClearFilters, locationActive, statusCounts,
  search, onSearchChange, statusFilter, onStatusFilterChange, typeFilter, onTypeFilterChange, deviceTypes }: DeviceFiltersProps) {
  return <FilterBar search={search} onSearchChange={onSearchChange}
    searchLabel="Cihaz adı, seri numarası veya UUID ile ara" placeholder="Ad, seri no veya UUID ara…"
    hasFilters={statusFilter !== "all" || typeFilter !== "all" || !!locationActive} onClear={() => onClearFilters?.()}>
    <Select value={statusFilter} onValueChange={onStatusFilterChange}>
      <SelectTrigger aria-label="Bağlantı filtresi" className="w-auto max-w-full min-w-36"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Bağlantı: Tümü ({statusCounts.all})</SelectItem>
        <SelectItem value="online">Bağlantı: Çevrimiçi ({statusCounts.online})</SelectItem>
        <SelectItem value="offline">Bağlantı: Çevrimdışı ({statusCounts.offline})</SelectItem>
        <SelectItem value="never">Bağlantı: Henüz bağlanmadı ({statusCounts.never})</SelectItem>
      </SelectContent>
    </Select>
    <Select value={typeFilter} onValueChange={onTypeFilterChange}>
      <SelectTrigger aria-label="Cihaz tipi filtresi" className="w-auto max-w-full min-w-28"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">Tip: Tümü</SelectItem>
        {deviceTypes.map(type => <SelectItem key={type} value={type}>Tip: {type}</SelectItem>)}
      </SelectContent>
    </Select>
  </FilterBar>;
}
