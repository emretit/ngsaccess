import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useProjectAccess } from "../useProjectAccess";
import { Id } from "../../../convex/_generated/dataModel";

export const useAccessRulesQuery = (projectId?: Id<"projects">) => {
  const { projectIds, isSuperAdmin } = useProjectAccess();
  const effectiveProjectId = projectId ?? projectIds[0];

  const data = useQuery(
    api.accessRules.list,
    effectiveProjectId !== undefined ? { projectId: effectiveProjectId } : {}
  );

  return {
    data: data ?? [],
    isLoading: data === undefined,
    error: null,
    refetch: () => {},
  };
};
