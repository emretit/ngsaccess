import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { scanSyncScope } from "./syncStatusLogic";

export const SYNC_SCAN_CAP = 200;

export async function scanHikSync(
  ctx: Pick<QueryCtx, "db">,
  projectIds: Id<"projects">[],
  statuses: readonly Doc<"hikPendingOperations">["status"][],
  visibleOnly = false,
) {
  return scanSyncScope(projectIds, statuses, (projectId, status, limit) => {
    const query = ctx.db.query("hikPendingOperations");
    return (visibleOnly
      ? query.withIndex("by_project_status_dismissed_created", (q) => q.eq("projectId", projectId).eq("status", status).eq("dismissedAt", undefined))
      : query.withIndex("by_project_status_created", (q) => q.eq("projectId", projectId).eq("status", status)))
      .order("desc").take(limit);
  }, async (row) => (await ctx.db.get(row.deviceId))?.projectId, SYNC_SCAN_CAP);
}

export async function scanIdeSync(
  ctx: Pick<QueryCtx, "db">,
  projectIds: Id<"projects">[],
  statuses: readonly Doc<"idePendingOperations">["status"][],
  visibleOnly = false,
) {
  return scanSyncScope(projectIds, statuses, (projectId, status, limit) => {
    const query = ctx.db.query("idePendingOperations");
    return (visibleOnly
      ? query.withIndex("by_project_status_dismissed_created", (q) => q.eq("projectId", projectId).eq("status", status).eq("dismissedAt", undefined))
      : query.withIndex("by_project_status_created", (q) => q.eq("projectId", projectId).eq("status", status)))
      .order("desc").take(limit);
  }, async (row) => (await ctx.db.get(row.deviceId))?.projectId, SYNC_SCAN_CAP);
}

export async function assertSyncScope(
  ctx: Pick<QueryCtx, "db">,
  projectIds: Id<"projects">[],
  op: { projectId?: Id<"projects">; deviceId: Id<"devices"> },
) {
  const device = await ctx.db.get(op.deviceId);
  const projectId = op.projectId ?? device?.projectId;
  if (!projectId || !projectIds.includes(projectId) ||
    (device?.projectId !== undefined && !projectIds.includes(device.projectId))) {
    throw new Error("Bu kayda erişim yetkiniz yok");
  }
  return device;
}
