import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const clearDeviceSyncQueue = internalMutation({
  args: {},
  returns: v.object({
    hikDeleted: v.number(),
    ideDeleted: v.number(),
    totalDeleted: v.number(),
  }),
  handler: async (ctx) => {
    let hikDeleted = 0;
    let ideDeleted = 0;

    for (const status of ["pending", "processing", "failed"] as const) {
      const rows = await ctx.db
        .query("hikPendingOperations")
        .withIndex("by_status_created", (q) => q.eq("status", status))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        hikDeleted++;
      }
    }

    for (const status of ["pending", "sent", "failed"] as const) {
      const rows = await ctx.db
        .query("idePendingOperations")
        .withIndex("by_status_nextRetry", (q) => q.eq("status", status))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        ideDeleted++;
      }
    }

    return {
      hikDeleted,
      ideDeleted,
      totalDeleted: hikDeleted + ideDeleted,
    };
  },
});
