import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";

export const useVisitors = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const visitorsRaw = useQuery(
    api.visitors.list,
    !projectLoading ? { projectIds, isSuperAdmin } : "skip",
  );

  return {
    visitors: visitorsRaw ?? [],
    isLoading: projectLoading || visitorsRaw === undefined,
    hasProjectAccess: projectLoading || isSuperAdmin || projectIds.length > 0,
  };
};
