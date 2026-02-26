import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    zoneId: v.optional(v.id("zones")),
  },
  handler: async (ctx, args) => {
    if (args.zoneId) {
      return await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
        .collect();
    }
    if (args.isSuperAdmin) {
      return await ctx.db.query("doors").collect();
    }
    if (!args.projectIds || args.projectIds.length === 0) return [];
    const results = await Promise.all(
      args.projectIds.map((pid) =>
        ctx.db
          .query("doors")
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
    zoneId: v.optional(v.id("zones")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("doors", {
      ...args,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    doorId: v.id("doors"),
    name: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { doorId, ...updates } = args;
    await ctx.db.patch(doorId, { ...updates, updatedAt: new Date().toISOString() });
  },
});

export const remove = mutation({
  args: { doorId: v.id("doors") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.doorId);
  },
});
