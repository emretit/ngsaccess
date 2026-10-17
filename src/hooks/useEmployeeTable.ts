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
  const [selectedEmployees, setSelectedEmployees] = useState<Id<"employees">[]>(
    [],
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  useEffect(() => {
    setSelectedEmployees([]);
    setSelectedDepartment("");
    setShowDeleteDialog(false);
  }, [projectId]);

  const bulkDelete = useMutation(api.employees.bulkDelete);
  const updateDepartment = useMutation(api.employees.bulkUpdateDepartment);
  const visibleIds = employees.map((emp) => emp._id).join(",");
  useEffect(() => {
    setSelectedEmployees([]);
    setSelectedDepartment("");
  }, [visibleIds]);
  const departmentAction = useAsyncAction(async () => {
    if (!selectedDepartment || selectedEmployees.length === 0) return;
    const result = await updateDepartment({
      employeeIds: selectedEmployees,
      departmentId: selectedDepartment as Id<"departments">,
    });
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

  const handleSelectEmployee = (
    checked: boolean,
    employeeId: Id<"employees">,
  ) => {
    if (checked) {
      setSelectedEmployees((current) =>
        current.includes(employeeId) ? current : [...current, employeeId],
      );
    } else {
      setSelectedEmployees((current) =>
        current.filter((id) => id !== employeeId),
      );
    }
  };

  const handleBulkDelete = async () => {
    await bulkDelete({ employeeIds: selectedEmployees });
    notify.success(
      "Personel kayıtları silindi",
      "Cihaz temizliği kuyruğa alındı; cihaz teslimi henüz doğrulanmadı.",
    );
    setSelectedEmployees([]);
    setShowDeleteDialog(false);
  };

  const handleBulkDepartmentUpdate = departmentAction.run;

  return {
    sortedEmployees: employees,
    selectedEmployees,
    selectedDepartment,
    showDeleteDialog,
    setShowDeleteDialog,
    setSelectedDepartment,
    handleSelectAll,
    handleSelectEmployee,
    handleBulkDelete,
    handleBulkDepartmentUpdate,
    clearSelection: () => setSelectedEmployees([]),
    departmentPending: departmentAction.pending,
  };
}
