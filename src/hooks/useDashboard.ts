import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { useAuth } from "@/components/auth/AuthProvider";

export const useDashboard = () => {
  const { isAuthenticated } = useConvexAuth();
  const { profile } = useAuth();
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const stats = useQuery(
    api.dashboard.getStats,
    !projectLoading && isAuthenticated ? { projectIds, isSuperAdmin } : "skip"
  );

  const recentReadings = useQuery(
    api.dashboard.getRecentReadings,
    !projectLoading && isAuthenticated ? { projectIds, isSuperAdmin, limit: 10 } : "skip"
  );

  const userName =
    (profile as { fullName?: string; name?: string; email?: string } | null)?.fullName ??
    (profile as { name?: string } | null)?.name ??
    (profile as { email?: string } | null)?.email ??
    "Kullanıcı";

  return {
    stats: stats ?? { employees: 0, devices: 0, cardReadings: 0, pendingRequests: 0 },
    recentReadings: recentReadings ?? [],
    statsLoading: projectLoading || stats === undefined,
    readingsLoading: projectLoading || recentReadings === undefined,
    userName,
    session: isAuthenticated ? { user: profile } : null,
    refetchStats: () => {},
    refetchReadings: () => {},
  };
};
