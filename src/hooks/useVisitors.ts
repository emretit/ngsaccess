import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProjectScope } from "./useActiveProjectScope";

export const useVisitors = () => {
  const { projectId, loading: projectLoading } = useActiveProjectScope();

  const visitorsRaw = useQuery(
    api.visitors.list,
    !projectLoading && projectId ? { projectId } : "skip",
  );

  return {
    visitors: visitorsRaw ?? [],
    isLoading: projectLoading || (!!projectId && visitorsRaw === undefined),
    hasProjectAccess: projectLoading || !!projectId,
  };
};
