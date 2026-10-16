import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Id } from "../../convex/_generated/dataModel";

import type { Employee } from "@/types/employee";

export function useEmployeeTable(employees: Employee[]) {
  const { projectId } = useActiveProjectScope();
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Employee;
    direction: "asc" | "desc";
  } | null>(null);

  const [selectedEmployees, setSelectedEmployees] = useState<Id<"employees">[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  useEffect(() => { setSelectedEmployees([]); setSelectedDepartment(""); setShowDeleteDialog(false); }, [projectId]);


  const bulkDelete = useMutation(api.employees.bulkDelete);
  const updateDepartment = useMutation(api.employees.bulkUpdateDepartment);
  const visibleIds = employees.map(emp => emp._id).join(",");
  useEffect(() => { setSelectedEmployees([]); setSelectedDepartment(""); }, [visibleIds]);
  const departmentAction = useAsyncAction(async () => {
    if (!selectedDepartment || selectedEmployees.length === 0) return;
    const result = await updateDepartment({ employeeIds: selectedEmployees, departmentId: selectedDepartment as Id<"departments"> });
    notify.success(`${result.updatedCount} personelin departmanı güncellendi`);
    setSelectedEmployees([]);
    setSelectedDepartment("");
  });

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
    await bulkDelete({ employeeIds: selectedEmployees });
    notify.success("Personel kayıtları silindi", "Cihaz temizliği kuyruğa alındı; cihaz teslimi henüz doğrulanmadı.");
    setSelectedEmployees([]);
    setShowDeleteDialog(false);
  };

  const handleBulkDepartmentUpdate = departmentAction.run;

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
    departmentPending: departmentAction.pending,
  };
}
