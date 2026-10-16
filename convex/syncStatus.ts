import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import { scanHikSync, scanIdeSync } from "./lib/syncStatusScope";
import { decideSyncStatus, summarizeSyncRows } from "./lib/syncStatusLogic";

export const deviceSyncStatus = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const [ide, hik, acknowledgements] = await Promise.all([
      scanIdeSync(ctx, projectIds, ["pending", "sent", "failed"]),
      scanHikSync(ctx, projectIds, ["pending", "processing", "failed"]),
      Promise.all(projectIds.map((projectId) => ctx.db.query("idePendingOperations")
        .withIndex("by_project_status_created", (q) => q.eq("projectId", projectId).eq("status", "acked"))
        .order("desc").first())),
    ]);
    // Hik done eski kapatma/cron temizliği anlamına da gelebilir; cihaz onayı kanıtı değildir.
    const verified = acknowledgements.flatMap((op) => op?.ackedAt === undefined ? [] : [op.ackedAt]);
    return decideSyncStatus(summarizeSyncRows(ide.rows), summarizeSyncRows(hik.rows),
      ide.unknown || hik.unknown, verified.length ? Math.max(...verified) : null);
  },
});
