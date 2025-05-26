
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
    <div className="glass-card p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cihazlar</h1>
          <p className="text-sm text-gray-600 mt-1">
            Cihaz listesi ve filtreleme seçenekleri
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="İsim veya seri numarası ile ara..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full sm:w-64 pl-10 bg-white border-gray-200 focus:border-primary focus:ring-primary"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={onStatusFilterChange}
          >
            <SelectTrigger className="w-full sm:w-[160px] bg-white border-gray-200">
              <SelectValue placeholder="Durum" />
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
            <SelectTrigger className="w-full sm:w-[160px] bg-white border-gray-200">
              <SelectValue placeholder="Tip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Tipler</SelectItem>
              {deviceTypes.map((type, index) => (
                <SelectItem key={index} value={type.toLowerCase()}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {onNewDevice && (
            <Button 
              onClick={onNewDevice}
              className="bg-primary hover:bg-primary/90 text-white shadow-sm whitespace-nowrap"
            >
              <Plus className="mr-2 h-4 w-4" />
              Yeni Cihaz Ekle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
