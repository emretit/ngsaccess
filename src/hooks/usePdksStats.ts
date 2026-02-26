import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";

export const usePdksStats = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const stats = useQuery(
    api.dashboard.getStats,
    !projectLoading ? { projectIds, isSuperAdmin } : "skip"
  );

  return {
    stats: stats ?? { employees: 0, devices: 0, cardReadings: 0, pendingRequests: 0 },
    isLoading: projectLoading || stats === undefined,
    error: null,
  };
};
