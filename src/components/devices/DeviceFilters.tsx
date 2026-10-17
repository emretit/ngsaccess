import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/shared/FilterBar";

interface DeviceFiltersProps {
  onClearFilters?: () => void;
  locationLabel?: string;
  onOpenLocation?: () => void;
  onClearLocation?: () => void;
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

export function DeviceFilters({ onClearFilters, locationLabel, onOpenLocation, onClearLocation,
  search, onSearchChange, statusFilter, onStatusFilterChange, typeFilter, onTypeFilterChange, deviceTypes }: DeviceFiltersProps) {
  return <FilterBar search={search} onSearchChange={onSearchChange}
    searchLabel="Cihaz adı, seri numarası veya UUID ile ara" placeholder="Ad, seri no veya UUID ara…"
    hasFilters={statusFilter !== "all" || typeFilter !== "all" || !!locationLabel} onClear={() => onClearFilters?.()}>
    <Select value={statusFilter} onValueChange={onStatusFilterChange}>
      <SelectTrigger aria-label="Bağlantı filtresi" className="w-auto max-w-full min-w-36"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Bağlantı: Tümü</SelectItem>
        <SelectItem value="online">Bağlantı: Çevrimiçi</SelectItem>
        <SelectItem value="offline">Bağlantı: Çevrimdışı</SelectItem>
        <SelectItem value="never">Bağlantı: Henüz bağlanmadı</SelectItem>
      </SelectContent>
    </Select>
    <Select value={typeFilter} onValueChange={onTypeFilterChange}>
      <SelectTrigger aria-label="Cihaz tipi filtresi" className="w-auto max-w-full min-w-28"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">Tip: Tümü</SelectItem>
        {deviceTypes.map(type => <SelectItem key={type} value={type}>Tip: {type}</SelectItem>)}
      </SelectContent>
    </Select>
    {onOpenLocation && <Button variant="outline" onClick={onOpenLocation}><MapPin className="mr-2 h-4 w-4" />Bölge ve kapı</Button>}
    {locationLabel && <Button variant="secondary" className="h-auto min-h-9 max-w-full whitespace-normal text-left" onClick={onClearLocation} aria-label={`${locationLabel} konum filtresini temizle`}>{locationLabel}<X className="ml-2 h-3.5 w-3.5 shrink-0" /></Button>}
  </FilterBar>;
}
