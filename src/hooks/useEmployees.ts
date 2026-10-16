import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProjectScope } from "./useActiveProjectScope";

export const useEmployees = () => {
  const { projectId, projectIds, isSuperAdmin, loading: projectLoading } = useActiveProjectScope();

  const employeesRaw = useQuery(
    api.employees.list,
    !projectLoading && projectId ? { projectId } : "skip"
  );

  const employees = employeesRaw ?? [];

  return {
    employees,
    isLoading: projectLoading || Boolean(projectId && employeesRaw === undefined),
    error: null,
    refetch: () => {},
    hasProjectAccess: projectLoading || isSuperAdmin || projectIds.length > 0,
  };
};
