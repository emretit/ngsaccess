
import { UserPlus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EmployeeFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  onNewEmployee: () => void;
}

export function EmployeeFilters({
  searchQuery,
  onSearchChange,
  itemsPerPage,
  onItemsPerPageChange,
  onNewEmployee
}: EmployeeFiltersProps) {
  const PAGE_SIZE_OPTIONS = [10, 50, 100];

  return (
    <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Sol: Başlık */}
        <div className="flex items-center gap-2 mr-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-tight">Personel Listesi</h2>
            <p className="text-xs text-muted-foreground">Tüm personelleri yönetin</p>
          </div>
        </div>

        {/* Arama */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Ad, e-posta, TC veya kart no..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Sağ: Kontroller */}
        <div className="flex items-center gap-2 ml-auto">
          <Select
            value={String(itemsPerPage)}
            onValueChange={(value) => onItemsPerPageChange(Number(value))}
          >
            <SelectTrigger className="w-[80px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)} className="text-xs">
                  {size} kayıt
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onNewEmployee} size="sm" className="h-8 gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            Yeni Personel
          </Button>
        </div>
      </div>
    </div>
  );
}
