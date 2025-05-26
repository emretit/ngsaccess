
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DeviceFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  deviceTypes: string[];
  onNewDevice?: () => void;
}

export function DeviceFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  deviceTypes,
  onNewDevice
}: DeviceFiltersProps) {
  return (
    <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border-0">
      <div>
        <h1 className="text-2xl font-semibold">Cihazlar</h1>
        <p className="text-sm text-muted-foreground">
          Cihaz listesi ve filtreleme seçenekleri
        </p>
      </div>
      
      <div className="flex gap-4 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="İsim veya seri numarası ile ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-64 pl-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={onStatusFilterChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Durum Filtresi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="online">Aktif</SelectItem>
            <SelectItem value="offline">Pasif</SelectItem>
            <SelectItem value="expired">Süresi Dolmuş</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={onTypeFilterChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tip Filtresi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Tipler</SelectItem>
            {deviceTypes.map((type, index) => (
              <SelectItem key={index} value={type.toLowerCase()}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onNewDevice && (
          <Button onClick={onNewDevice}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni Cihaz Ekle
          </Button>
        )}
      </div>
    </div>
  );
}
