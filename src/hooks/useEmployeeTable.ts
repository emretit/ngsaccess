import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "@/hooks/use-toast";
import { Id } from "../../convex/_generated/dataModel";

import type { Employee } from "@/types/employee";

export function useEmployeeTable(employees: Employee[]) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Employee;
    direction: "asc" | "desc";
  } | null>(null);

  const [selectedEmployees, setSelectedEmployees] = useState<Id<"employees">[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const bulkDelete = useMutation(api.employees.bulkDelete);
  const bulkUpdateStatus = useMutation(api.employees.bulkUpdateStatus);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(employees.map((emp) => emp._id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (checked: boolean, employeeId: Id<"employees">) => {
    if (checked) {
      setSelectedEmployees([...selectedEmployees, employeeId]);
    } else {
      setSelectedEmployees(selectedEmployees.filter((id) => id !== employeeId));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDelete({ employeeIds: selectedEmployees });
      toast({ title: "Başarılı", description: "Seçili personeller silindi" });
      setSelectedEmployees([]);
      setShowDeleteDialog(false);
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Personeller silinirken hata oluştu",
        variant: "destructive",
      });
    }
  };

  const handleBulkDepartmentUpdate = async () => {
    if (!selectedDepartment || selectedEmployees.length === 0) return;
    try {
      await Promise.all(
        selectedEmployees.map((id) =>
          fetch(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify({ departmentId: selectedDepartment }) })
        )
      );
      toast({ title: "Başarılı", description: "Departman güncellendi" });
      setSelectedEmployees([]);
      setSelectedDepartment("");
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Departman güncellenirken hata oluştu",
        variant: "destructive",
      });
    }
  };

  const requestSort = (key: keyof Employee) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const aVal = a[key];
    const bVal = b[key];
    if (aVal === null || aVal === undefined || bVal === null || bVal === undefined) return 0;
    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });

  return {
    sortedEmployees,
    selectedEmployees,
    selectedDepartment,
    showDeleteDialog,
    setShowDeleteDialog,
    setSelectedDepartment,
    handleSelectAll,
    handleSelectEmployee,
    handleBulkDelete,
    handleBulkDepartmentUpdate,
    requestSort,
  };
}
