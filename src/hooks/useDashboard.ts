import { usePermissions } from "@/hooks/usePermissions";
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
  const { can } = usePermissions();
  const enabled = scope.enabled && can("reports.view");
  const summary = useQuery(api.dashboard.getActivitySummary, enabled ? { projectId: scope.projectId } : "skip");
  return { summary, loading: scope.loading || (enabled && summary === undefined) };
}
export function useDashboardTimeline() {
  const scope = useDashboardScope();
  const { can } = usePermissions();
  const enabled = scope.enabled && (can("reports.view") || can("devices.manage"));
  const timeline = useQuery(api.dashboard.getTodayTimeline, enabled ? { projectId: scope.projectId } : "skip");
  return { timeline, loading: scope.loading || (enabled && timeline === undefined) };
}
export function useDashboardReadings(limit = 10) {
  const scope = useDashboardScope();
  const { can } = usePermissions();
  const enabled = scope.enabled && (can("reports.view") || can("devices.manage"));
  const readings = useQuery(api.dashboard.getRecentReadings, enabled ? { projectId: scope.projectId, limit } : "skip");
  return { readings: readings ?? [], loading: scope.loading || (enabled && readings === undefined) };
}
