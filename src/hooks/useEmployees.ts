import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProjectScope } from "./useActiveProjectScope";

export const useEmployees = () => {
  const { projectId, loading: projectLoading } = useActiveProjectScope();

  const { can, loading: permissionsLoading } = usePermissions();
  const canView = can("employees.view");
  const employeesRaw = useQuery(
    api.employees.list,
    !projectLoading && canView && projectId ? { projectId } : "skip"
  );

  const employees = employeesRaw ?? [];

  return {
    employees,
    isLoading: projectLoading || permissionsLoading || Boolean(canView && projectId && employeesRaw === undefined),
    error: null,
    refetch: () => {},
    hasProjectAccess: projectLoading || permissionsLoading || canView,
  };
};
