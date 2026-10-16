import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Id } from "../../../convex/_generated/dataModel";

export const useAccessRulesQuery = (projectId?: Id<"projects">) => {
  const { projectId: activeProjectId, loading } = useActiveProjectScope();
  const effectiveProjectId = projectId ?? activeProjectId;

  const data = useQuery(
    api.accessRules.list,
    !loading && effectiveProjectId ? { projectId: effectiveProjectId } : "skip"
  );

  return {
    data,
    isLoading: loading || (!!effectiveProjectId && data === undefined),
    error: null,
    refetch: () => {},
  };
};
