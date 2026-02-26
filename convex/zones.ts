import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.isSuperAdmin) {
      return await ctx.db.query("zones").collect();
    }
    if (!args.projectIds || args.projectIds.length === 0) return [];
    const results = await Promise.all(
      args.projectIds.map((pid) =>
        ctx.db
          .query("zones")
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
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("zones", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    zoneId: v.id("zones"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { zoneId, ...updates } = args;
    await ctx.db.patch(zoneId, { ...updates, updatedAt: new Date().toISOString() });
  },
});

export const remove = mutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.zoneId);
  },
});
