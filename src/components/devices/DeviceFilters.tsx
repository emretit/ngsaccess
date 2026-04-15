import { Search, Filter, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeviceFormButton } from "./DeviceFormButton";

interface DeviceFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  deviceTypes: string[];
  onNewDevice: () => void;
  deviceCount: number;
  filteredCount: number;
}

export function DeviceFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  deviceTypes,
  onNewDevice,
  deviceCount,
  filteredCount
}: DeviceFiltersProps) {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Sol: Başlık */}
        <div className="flex items-center gap-2 mr-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Smartphone className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Cihazlar</h2>
            <p className="text-xs text-muted-foreground">
              {deviceCount} cihaz bulundu, {filteredCount} tanesi gösteriliyor
            </p>
          </div>
        </div>

        {/* Arama */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cihaz adı veya seri no ile ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Sağ: Kontroller */}
        <div className="flex items-center gap-2 ml-auto">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tümü</SelectItem>
              <SelectItem value="online" className="text-xs">Aktif</SelectItem>
              <SelectItem value="offline" className="text-xs">Pasif</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue placeholder="Tip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tümü</SelectItem>
              {deviceTypes.map((type) => (
                <SelectItem key={type} value={type} className="text-xs">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DeviceFormButton onOpenDevicePanel={onNewDevice} />
        </div>
      </div>
    </div>
  );
}
