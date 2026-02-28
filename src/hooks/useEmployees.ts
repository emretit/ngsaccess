import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { Employee } from "@/types/employee";

export const useEmployees = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const employeesRaw = useQuery(
    api.employees.list,
    !projectLoading ? { projectIds, isSuperAdmin } : "skip"
  );

  // Convex camelCase → frontend snake_case mapping
  const employees: Employee[] = (employeesRaw ?? []).map((emp) => ({
    id: emp._id,
    first_name: emp.firstName,
    last_name: emp.lastName,
    email: emp.email,
    tc_no: emp.tcNo,
    card_number: emp.cardNumber,
    photo_url: emp.photoUrl ?? null,
    shift: emp.shift ?? null,
    company_id: emp.companyId ?? null,
    department_id: emp.departmentId ?? null,
    position_id: emp.positionId ?? null,
    shift_id: emp.shiftId ?? null,
    access_rule_id: emp.accessRuleId ?? null,
    is_active: emp.isActive ?? true,
    notes: emp.notes,
    created_at: emp.createdAt ?? "",
    updated_at: emp.updatedAt ?? "",
    projectId: emp.projectId,
    departments: emp.departments
      ? { id: String(emp.departments.id), name: emp.departments.name }
      : null,
    positions: emp.positions
      ? { id: String(emp.positions.id), name: emp.positions.name }
      : null,
  }));

  return {
    employees,
    isLoading: projectLoading || employeesRaw === undefined,
    error: null,
    refetch: () => {},
    hasProjectAccess: projectLoading || isSuperAdmin || projectIds.length > 0,
  };
};
