
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface DeviceFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  deviceTypes: string[];
}

export function DeviceFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  deviceTypes
}: DeviceFiltersProps) {
  return (
    <Card className="mb-4 border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="İsim veya seri numarası ile ara..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-background border-muted"
            />
          </div>

          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={onStatusFilterChange}
            >
              <SelectTrigger className="w-[180px] bg-background border-muted">
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
              <SelectTrigger className="w-[180px] bg-background border-muted">
                <SelectValue placeholder="Tip Filtresi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Tipler</SelectItem>
                {deviceTypes.map((type, index) => (
                  <SelectItem key={index} value={type.toLowerCase()}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
