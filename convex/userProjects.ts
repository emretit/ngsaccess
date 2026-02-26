import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getByCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows;
  },
});

export const getProjectIdsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.map((r) => r.projectId);
  },
});

export const assign = mutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("userProjects", {
      userId: args.userId,
      projectId: args.projectId,
      createdAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("userProjects").collect();
  },
});

export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProjects")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
