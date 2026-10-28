import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar, FilterField } from "@/components/shared/FilterBar";

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
}

export function DeviceFilters({ onClearFilters, locationActive, statusCounts, typeCounts,
  search, onSearchChange, statusFilter, onStatusFilterChange, typeFilter, onTypeFilterChange, deviceTypes }: DeviceFiltersProps) {
  return <FilterBar search={search} onSearchChange={onSearchChange}
    searchLabel="Cihaz adı, seri numarası veya UUID ile ara" placeholder="Ad, seri no veya UUID ara…"
    hasFilters={statusFilter !== "all" || typeFilter !== "all" || !!locationActive} onClear={() => onClearFilters?.()}>
    <FilterField label="Bağlantı" htmlFor="device-status"><Select value={statusFilter} onValueChange={onStatusFilterChange}>
      <SelectTrigger id="device-status" className="w-full min-w-0"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tüm bağlantılar ({statusCounts.all})</SelectItem>
        <SelectItem value="online">Çevrimiçi ({statusCounts.online})</SelectItem>
        <SelectItem value="offline">Çevrimdışı ({statusCounts.offline})</SelectItem>
        <SelectItem value="never">Henüz bağlanmadı ({statusCounts.never})</SelectItem>
      </SelectContent>
    </Select></FilterField>
    <FilterField label="Tip" htmlFor="device-type"><Select value={typeFilter} onValueChange={onTypeFilterChange}>
      <SelectTrigger id="device-type" className="w-full min-w-0"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">Tüm tipler ({statusCounts.all})</SelectItem>
        {deviceTypes.map(type => <SelectItem key={type} value={type}>{type} ({typeCounts[type] ?? 0})</SelectItem>)}
      </SelectContent>
    </Select></FilterField>
  </FilterBar>;
}
