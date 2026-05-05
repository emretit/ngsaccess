import { v } from "convex/values";
import { adminQuery } from "./lib/customFunctions";

export const list = adminQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    targetTable: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;

    let rows;
    if (args.userId) {
      rows = await ctx.db
        .query("auditLog")
        .withIndex("by_user_timestamp", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(limit);
    } else if (args.projectId !== undefined) {
      rows = await ctx.db
        .query("auditLog")
        .withIndex("by_project_timestamp", (q) =>
          q.eq("projectId", args.projectId)
        )
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db.query("auditLog").order("desc").take(limit);
    }

    if (args.targetTable) {
      rows = rows.filter((r) => r.targetTable === args.targetTable);
    }
    if (args.startTimestamp !== undefined) {
      rows = rows.filter((r) => r.timestamp >= args.startTimestamp!);
    }
    if (args.endTimestamp !== undefined) {
      rows = rows.filter((r) => r.timestamp <= args.endTimestamp!);
    }

    return rows;
  },
});

export const distinctTargetTables = adminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("auditLog").take(500);
    return Array.from(new Set(rows.map((r) => r.targetTable))).sort();
  },
});
