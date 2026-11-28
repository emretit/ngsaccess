import { useVisibleRefresh, useTabVisible } from "./useVisibleRefresh";
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
  const { data: stats, ...status } = useVisibleRefresh(api.dashboard.getStats, scope.enabled ? { projectId: scope.projectId, includeTodayReadings: false } : "skip");
  return { stats, ...status, loading: scope.loading || status.loading };
}
export function useDashboardActivity() {
  const scope = useDashboardScope();
  const { can } = usePermissions();
  const enabled = scope.enabled && can("reports.view");
  const { data: summary, ...status } = useVisibleRefresh(api.dashboard.getActivitySummary, enabled ? { projectId: scope.projectId } : "skip");
  return { summary, ...status, loading: scope.loading || status.loading };
}
export function useDashboardTimeline() {
  const scope = useDashboardScope();
  const { can } = usePermissions();
  const enabled = scope.enabled && (can("reports.view") || can("devices.manage"));
  const { data: timeline, ...status } = useVisibleRefresh(api.dashboard.getTodayTimeline, enabled ? { projectId: scope.projectId } : "skip");
  return { timeline, ...status, loading: scope.loading || status.loading };
}
export function useDashboardReadings(limit = 10) {
  const visible = useTabVisible();
  const scope = useDashboardScope();
  const { can } = usePermissions();
  const enabled = visible && scope.enabled && (can("reports.view") || can("devices.manage"));
  const readings = useQuery(api.dashboard.getRecentReadings, enabled ? { projectId: scope.projectId, limit, includeDevices: false } : "skip");
  const deviceIds = [...new Set((readings ?? []).flatMap(row => row.deviceId ? [row.deviceId] : []))].sort();
  const devices = useQuery(api.dashboard.getReadingDevices, enabled && scope.projectId ? { projectId: scope.projectId, deviceIds } : "skip");
  const byId = new Map((devices ?? []).filter((device): device is NonNullable<typeof device> => device !== null).map(device => [device._id, device]));
  return { readings: (readings ?? []).map(row => ({ ...row, devices: row.deviceId ? byId.get(row.deviceId) ?? null : null })), loading: scope.loading || (enabled && (readings === undefined || (deviceIds.length > 0 && devices === undefined))) };
}
