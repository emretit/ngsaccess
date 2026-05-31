import { UserPlus, Search, DoorOpen, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type VisitorStatusFilter = "all" | "active" | "inside" | "ended";

interface VisitorFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: VisitorStatusFilter;
  onStatusFilterChange: (value: VisitorStatusFilter) => void;
  onNewVisitor: () => void;
  onNewZone: () => void;
}

const STATUS_OPTIONS: { value: VisitorStatusFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "inside", label: "Şu an binada" },
  { value: "ended", label: "Pasif / Süresi doldu" },
];

export function VisitorFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onNewVisitor,
  onNewZone,
}: VisitorFiltersProps) {
  return (
    <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <DoorOpen className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Ziyaretçiler</h2>
            <p className="text-xs text-muted-foreground">Geçici erişim ve ziyaretçi yönetimi</p>
          </div>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Ad, şirket veya kart no..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusFilterChange(value as VisitorStatusFilter)}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={onNewZone}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
          >
            <MapPin className="h-3.5 w-3.5" />
            Bölge Ekle
          </Button>

          <Button onClick={onNewVisitor} size="sm" className="h-8 gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            Yeni Ziyaretçi
          </Button>
        </div>
      </div>
    </div>
  );
}
