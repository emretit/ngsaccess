import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.isSuperAdmin) {
      return await ctx.db.query("departments").collect();
    }
    if (!args.projectIds || args.projectIds.length === 0) return [];
    const results = await Promise.all(
      args.projectIds.map((pid) =>
        ctx.db
          .query("departments")
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
    parentId: v.optional(v.id("departments")),
    level: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("departments", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    departmentId: v.id("departments"),
    name: v.optional(v.string()),
    parentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const { departmentId, ...updates } = args;
    await ctx.db.patch(departmentId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.departmentId);
  },
});
