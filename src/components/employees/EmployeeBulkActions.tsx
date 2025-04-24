
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Employee } from "@/types/employee";

interface EmployeeBulkActionsProps {
  selectedCount: number;
  departments: Employee['departments'][];
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  onUpdateDepartment: () => void;
  onDelete: () => void;
}

export function EmployeeBulkActions({
  selectedCount,
  departments,
  selectedDepartment,
  onDepartmentChange,
  onUpdateDepartment,
  onDelete
}: EmployeeBulkActionsProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
      <span className="text-sm font-medium">{selectedCount} personel seçildi</span>
      <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Departman seç" />
        </SelectTrigger>
        <SelectContent>
          {departments.map(dept => (
            dept && <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="secondary"
        onClick={onUpdateDepartment}
        disabled={!selectedDepartment}
      >
        Departmanı Güncelle
      </Button>
      <Button
        variant="destructive"
        onClick={onDelete}
      >
        Seçilenleri Sil
      </Button>
    </div>
  );
}
