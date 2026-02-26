import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.isSuperAdmin) return await ctx.db.query("shifts").collect();
    if (!args.projectIds || args.projectIds.length === 0) return [];
    const results = await Promise.all(
      args.projectIds.map((pid) =>
        ctx.db
          .query("shifts")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    startTime: v.string(),
    endTime: v.string(),
    breakStart: v.optional(v.string()),
    breakEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("shifts", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    shiftId: v.id("shifts"),
    name: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    breakStart: v.optional(v.string()),
    breakEnd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { shiftId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(shiftId, clean);
  },
});

export const remove = mutation({
  args: { shiftId: v.id("shifts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.shiftId);
  },
});
