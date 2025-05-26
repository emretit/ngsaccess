
import { UserPlus, Search } from "lucide-react";
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
    <div className="glass-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Personel Listesi</h2>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Personel ara..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64 pl-10"
            />
          </div>

          <Select 
            value={String(itemsPerPage)} 
            onValueChange={(value) => onItemsPerPageChange(Number(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Sayfa Boyutu" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} Kayıt
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onNewEmployee}>
            <UserPlus className="mr-2 h-4 w-4" />
            Yeni Personel
          </Button>
        </div>
      </div>
    </div>
  );
}
