
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { Employee } from "@/types/employee";

interface EmployeeBulkActionsProps {
  selectedCount: number;
  departments: Employee['departments'][];
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  onUpdateDepartment: () => void;
  onDelete: () => void;
  onSyncToDevices?: () => void;
  isSyncing?: boolean;
}

export function EmployeeBulkActions({
  selectedCount,
  departments,
  selectedDepartment,
  onDepartmentChange,
  onUpdateDepartment,
  onDelete,
  onSyncToDevices,
  isSyncing,
}: EmployeeBulkActionsProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg flex-wrap">
      <span className="text-sm font-medium">{selectedCount} personel seçildi</span>
      <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Departman seç" />
        </SelectTrigger>
        <SelectContent>
          {departments.map(dept => (
            dept && <SelectItem key={dept._id} value={String(dept._id)}>{dept.name}</SelectItem>
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
      {onSyncToDevices && (
        <Button
          variant="outline"
          onClick={onSyncToDevices}
          disabled={isSyncing}
        >
          {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Cihazlara Gönder
        </Button>
      )}
      <Button
        variant="destructive"
        onClick={onDelete}
      >
        Seçilenleri Sil
      </Button>
    </div>
  );
}
