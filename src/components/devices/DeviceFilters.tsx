import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/shared/FilterBar";

interface DeviceFiltersProps {
  onClearFilters?: () => void;
  /** Sol panelde bölge/kapı seçili mi (temizle düğmesi için). */
  locationActive?: boolean;
  statusCounts: { all: number; online: number; offline: number; never: number };
  typeCounts: Record<string, number>;
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

export function DeviceFilters({ onClearFilters, locationActive, statusCounts, typeCounts,
  filteredCount, search, onSearchChange, statusFilter, onStatusFilterChange, typeFilter, onTypeFilterChange, deviceTypes }: DeviceFiltersProps) {
  return <div className={filteredCount === 0 ? "[&_[role=search]>button:last-child]:hidden" : undefined}><FilterBar search={search} onSearchChange={onSearchChange}
    searchLabel="Cihaz adı, seri numarası veya UUID ile ara" placeholder="Ad, seri no veya UUID ara…"
    hasFilters={statusFilter !== "all" || typeFilter !== "all" || !!locationActive} onClear={() => onClearFilters?.()}>
    <Select value={statusFilter} onValueChange={onStatusFilterChange}>
      <SelectTrigger aria-label="Bağlantı filtresi" className="w-auto max-w-full min-w-36"><span className="mr-1">Bağlantı:</span><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tümü ({statusCounts.all})</SelectItem>
        <SelectItem value="online">Çevrimiçi ({statusCounts.online})</SelectItem>
        <SelectItem value="offline">Çevrimdışı ({statusCounts.offline})</SelectItem>
        <SelectItem value="never">Henüz bağlanmadı ({statusCounts.never})</SelectItem>
      </SelectContent>
    </Select>
    <Select value={typeFilter} onValueChange={onTypeFilterChange}>
      <SelectTrigger aria-label="Cihaz tipi filtresi" className="w-auto max-w-full min-w-28"><span className="mr-1">Tip:</span><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">Tümü ({statusCounts.all})</SelectItem>
        {deviceTypes.map(type => <SelectItem key={type} value={type}>{type} ({typeCounts[type] ?? 0})</SelectItem>)}
      </SelectContent>
    </Select>
  </FilterBar></div>;
}
