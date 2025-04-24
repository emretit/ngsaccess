
import { UserPlus } from "lucide-react";
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
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">Personel Listesi</h1>
      <div className="flex gap-4">
        <Input
          type="search"
          placeholder="Personel ara..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-64"
        />

        <Select 
          value={String(itemsPerPage)} 
          onValueChange={(value) => onItemsPerPageChange(Number(value))}
        >
          <SelectTrigger className="w-[100px]">
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
  );
}
