import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Id } from "../../../convex/_generated/dataModel";

export const useAccessRulesQuery = (projectId?: Id<"projects">) => {
  const { projectId: activeProjectId } = useActiveProject();
  const effectiveProjectId = projectId ?? activeProjectId;

  const data = useQuery(
    api.accessRules.list,
    effectiveProjectId !== undefined ? { projectId: effectiveProjectId } : {}
  );

  return {
    data,
    isLoading: data === undefined,
    error: null,
    refetch: () => {},
  };
};
