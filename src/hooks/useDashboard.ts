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
  const readings = useQuery(api.dashboard.getRecentReadings, enabled ? { projectId: scope.projectId, limit, includeDevices: false } : "skip");
  const deviceIds = [...new Set((readings ?? []).flatMap(row => row.deviceId ? [row.deviceId] : []))].sort();
  const devices = useQuery(api.dashboard.getReadingDevices, enabled && scope.projectId ? { projectId: scope.projectId, deviceIds } : "skip");
  const byId = new Map((devices ?? []).filter((device): device is NonNullable<typeof device> => device !== null).map(device => [device._id, device]));
  return { readings: (readings ?? []).map(row => ({ ...row, devices: row.deviceId ? byId.get(row.deviceId) ?? null : null })), loading: scope.loading || (enabled && (readings === undefined || (deviceIds.length > 0 && devices === undefined))) };
}
