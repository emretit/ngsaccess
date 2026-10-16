import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAuth } from "@/components/auth/AuthProvider";

export const useDashboard = () => {
  const { isAuthenticated } = useConvexAuth();
  const { profile } = useAuth();
  const { projectId, activeProject, loading: projectLoading } = useActiveProject();
  const enabled = !projectLoading && isAuthenticated && !!projectId;
  const stats = useQuery(api.dashboard.getStats, enabled ? { projectId } : "skip");
  const recentReadings = useQuery(api.dashboard.getRecentReadings, enabled ? { projectId, limit: 10 } : "skip");
  const activitySummary = useQuery(api.dashboard.getActivitySummary, enabled ? { projectId } : "skip");

  const userName = profile?.fullName ?? profile?.email ?? "Kullanıcı";

  return {
    stats,
    recentReadings: recentReadings ?? [],
    activitySummary,
    statsLoading: projectLoading || (enabled && stats === undefined),
    readingsLoading: projectLoading || (enabled && recentReadings === undefined),
    activityLoading: projectLoading || (enabled && activitySummary === undefined),
    noProject: !projectLoading && !projectId,
    projectName: activeProject?.name,
    userName,
  };
};
