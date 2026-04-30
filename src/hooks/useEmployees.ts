import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import type { Employee } from "@/types/employee";

export const useEmployees = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const employeesRaw = useQuery(
    api.employees.list,
    !projectLoading ? { projectIds, isSuperAdmin } : "skip"
  );

  const employees = (employeesRaw ?? []) as Employee[];

  return {
    employees,
    isLoading: projectLoading || employeesRaw === undefined,
    error: null,
    refetch: () => {},
    hasProjectAccess: projectLoading || isSuperAdmin || projectIds.length > 0,
  };
};
