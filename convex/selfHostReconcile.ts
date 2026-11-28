import { v } from "convex/values";
import { internalMutation } from "./lib/dashboardMutations";
import { internal } from "./_generated/api";
import { cancelImportedJob } from "./lib/cancelImportedJob";
import { destructionStateSchema } from "./lib/biometricDestruction";
import { internalQuery } from "./_generated/server";
import { requireSelfHostTarget } from "./lib/selfHostTarget";

export const forwardingDevices = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("devices").paginate({ cursor: args.cursor ?? null, numItems: 10 });
    return { ...page, page: page.page.map(device => ({ _id: device._id, name: device.name, hikDevIndex: device.hikDevIndex })) };
  },
});

/** Run only on an isolated imported target, before workers/crons/traffic resume.
 * Invoke each table until isDone, passing continueCursor; dryRun never writes or schedules.
 * Interrupted sends are marked unknown/failed, never automatically replayed.
 */
export const reconcile = internalMutation({
  args: {
    dryRun: v.boolean(),
    confirmHost: v.optional(v.string()),
    table: v.union(v.literal("users"), v.literal("deviceSyncRunTargets"), v.literal("deviceSyncRuns"), v.literal("auditLog"), v.literal("reportDeliveries"), v.literal("deviceEvents")),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.dryRun) requireSelfHostTarget(args.confirmHost);
    const page = await ctx.db.query(args.table).paginate({ cursor: args.cursor ?? null, numItems: 50 });
    let affected = 0;
    const now = Date.now();
    for (const row of page.page) {
      if (args.table === "users" && "accessExpiresAt" in row && row.accessExpiresAt !== undefined && row.accessExpiresAt > now) {
        affected++;
        if (!args.dryRun) {
          const userId = ctx.db.normalizeId("users", row._id);
          const user = userId ? await ctx.db.get(userId) : null;
          if (!user) continue;
          if (user.accessExpiryJobId) await cancelImportedJob(ctx, user.accessExpiryJobId);
          const accessExpiryJobId = await ctx.scheduler.runAt(row.accessExpiresAt, internal.accountAccess.expireAccess, { userId: user._id, expectedExpiresAt: row.accessExpiresAt });
          await ctx.db.patch(user._id, { accessExpiryJobId });
        }
      } else if (args.table === "deviceSyncRunTargets" && "status" in row && row.status === "queued") {
        affected++;
        if (!args.dryRun) await ctx.db.patch(row._id, { status: "unknown", dispatchFinished: true, reason: "self_host_import_outcome_unknown", updatedAt: now });
      } else if (args.table === "deviceSyncRuns" && "status" in row && row.status === "running" && "counts" in row) {
        affected++;
        if (!args.dryRun) await ctx.db.patch(row._id, { status: "failed", dispatchFinished: true, finishedAt: now, counts: { ...row.counts, unknown: row.counts.unknown + row.counts.queued, queued: 0 } });
      } else if (args.table === "auditLog" && "targetTable" in row && row.targetTable === "biometricDestructionRun") {
        const parsed = destructionStateSchema.safeParse(row.newValue);
        if (parsed.success && ["running", "waitingDevices"].includes(parsed.data.status)) {
          affected++;
          if (!args.dryRun) await ctx.db.patch(row._id, { newValue: { ...parsed.data, status: "failed", finishedAt: now, error: "self_host_import_outcome_unknown; cihaz imhasını elle doğrulayın", deviceUnconfirmed: parsed.data.deviceUnconfirmed + parsed.data.pendingOpIds.length, pendingOpIds: [], pendingDeviceChecks: 0 } });
        }
      } else if (args.table === "reportDeliveries" && "status" in row && ["sending", "retryScheduled"].includes(row.status)) {
        affected++;
        if (!args.dryRun) await ctx.db.patch(row._id, { status: "failed", error: "self_host_import_outcome_unknown", nextRetryAt: undefined });
      } else if (args.table === "deviceEvents" && "alarmEmailStatus" in row && row.alarmEmailStatus && ["queued", "sending", "retryScheduled"].includes(row.alarmEmailStatus)) {
        affected++;
        if (!args.dryRun) await ctx.db.patch(row._id, { alarmEmailStatus: "failed", alarmEmailError: "self_host_import_outcome_unknown", alarmEmailRetryAt: undefined });
      }
    }
    return { dryRun: args.dryRun, table: args.table, scanned: page.page.length, affected, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
