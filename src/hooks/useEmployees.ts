import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { Id } from "../../convex/_generated/dataModel";

export interface Employee {
  _id: Id<"employees">;
  firstName: string;
  lastName: string;
  email: string;
  tcNo: string;
  cardNumber: string;
  photoUrl?: string;
  shift?: string | null;
  companyId?: Id<"companies"> | null;
  departmentId?: Id<"departments"> | null;
  positionId?: Id<"positions"> | null;
  shiftId?: Id<"shifts"> | null;
  accessRuleId?: Id<"accessRules"> | null;
  isActive?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  projectId?: Id<"projects">;
  departments?: { name: string } | null;
  positions?: { name: string } | null;
}

export const useEmployees = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const employeesRaw = useQuery(
    api.employees.list,
    !projectLoading ? { projectIds, isSuperAdmin } : "skip"
  );

  const employees: Employee[] = (employeesRaw ?? []) as Employee[];

  return {
    employees,
    isLoading: projectLoading || employeesRaw === undefined,
    error: null,
    refetch: () => {},
    hasProjectAccess: projectLoading || isSuperAdmin || projectIds.length > 0,
  };
};
