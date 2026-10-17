import { EMPLOYEE_BULK_DELETE_LIMIT } from "../../../convex/lib/employeeUx";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import { BulkBar } from "@/components/shared/BulkBar";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Employee } from "@/types/employee";

interface EmployeeBulkActionsProps {
  selectedCount: number;
  onClear?: () => void;
  names?: string;
  departments: Employee["departments"][];
  selectedDepartment: string;
  onDepartmentChange: (value: string) => void;
  onUpdateDepartment: () => void;
  onDelete: () => void;
  onSyncToDevices?: () => void;
  isSyncing?: boolean;
  pending?: boolean;
}

export function EmployeeBulkActions({
  selectedCount,
  onClear,
  names,
  departments,
  selectedDepartment,
  onDepartmentChange,
  onUpdateDepartment,
  onDelete,
  onSyncToDevices,
  isSyncing,
  pending,
}: EmployeeBulkActionsProps) {
  const [confirm, setConfirm] = useState<"department" | "sync" | null>(null);
  return (
    <BulkBar count={selectedCount} onClear={() => onClear?.()}>
      <Select
        disabled={pending || isSyncing}
        value={selectedDepartment}
        onValueChange={onDepartmentChange}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Departman seç" />
        </SelectTrigger>
        <SelectContent>
          {departments.map(
            (dept) =>
              dept && (
                <SelectItem key={dept._id} value={String(dept._id)}>
                  {dept.name}
                </SelectItem>
              ),
          )}
        </SelectContent>
      </Select>
      <Button
        variant="secondary"
        onClick={() => setConfirm("department")}
        disabled={!selectedDepartment || pending}
      >
        Departmanı güncelle
      </Button>
      {onSyncToDevices && (
        <Button
          variant="outline"
          onClick={() => setConfirm("sync")}
          disabled={isSyncing || pending}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Cihazlara gönder
        </Button>
      )}
      <Button
        variant="destructive"
        onClick={onDelete}
        disabled={pending || selectedCount > EMPLOYEE_BULK_DELETE_LIMIT}
        aria-describedby={
          selectedCount > EMPLOYEE_BULK_DELETE_LIMIT
            ? "bulk-delete-limit"
            : undefined
        }
      >
        Seçilenleri sil
      </Button>
      {selectedCount > EMPLOYEE_BULK_DELETE_LIMIT && (
        <span id="bulk-delete-limit" className="text-sm text-muted-foreground">
          Bir seferde en fazla {EMPLOYEE_BULK_DELETE_LIMIT} personel
          silebilirsiniz. Seçimi azaltın.
        </span>
      )}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "department"
                ? "Departman değiştirilsin mi?"
                : "Cihazlara gönderilsin mi?"}
            </DialogTitle>
            <DialogDescription className="break-words">
              {names}
            </DialogDescription>
          </DialogHeader>
          {confirm === "department" && (
            <p className="text-sm">
              Hedef:{" "}
              {departments.find((d) => d?._id === selectedDepartment)?.name}
            </p>
          )}
          <Button
            onClick={() => {
              if (confirm === "department") onUpdateDepartment();
              else onSyncToDevices?.();
              setConfirm(null);
            }}
          >
            Onayla
          </Button>
        </DialogContent>
      </Dialog>
    </BulkBar>
  );
}
