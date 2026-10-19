import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";

/** Each query is consumed below its own QuerySectionBoundary. */
function useDashboardScope() {
  const { isAuthenticated } = useConvexAuth();
  const { projectId, loading } = useActiveProjectScope();
  return { projectId, enabled: !loading && isAuthenticated && !!projectId, loading };
}
export function useDashboardStats() {
  const scope = useDashboardScope();
  const stats = useQuery(api.dashboard.getStats, scope.enabled ? { projectId: scope.projectId, includeTodayReadings: false } : "skip");
  return { stats, loading: scope.loading || (scope.enabled && stats === undefined) };
}
export function useDashboardActivity() {
  const scope = useDashboardScope();
  const summary = useQuery(api.dashboard.getActivitySummary, scope.enabled ? { projectId: scope.projectId } : "skip");
  return { summary, loading: scope.loading || (scope.enabled && summary === undefined) };
}
export function useDashboardTimeline() {
  const scope = useDashboardScope();
  const timeline = useQuery(api.dashboard.getTodayTimeline, scope.enabled ? { projectId: scope.projectId } : "skip");
  return { timeline, loading: scope.loading || (scope.enabled && timeline === undefined) };
}
export function useDashboardReadings(limit = 10) {
  const scope = useDashboardScope();
  const readings = useQuery(api.dashboard.getRecentReadings, scope.enabled ? { projectId: scope.projectId, limit } : "skip");
  return { readings: readings ?? [], loading: scope.loading || (scope.enabled && readings === undefined) };
}
