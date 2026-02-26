import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { authedQuery, superAdminMutation } from "./lib/customFunctions";

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

/**
 * Mevcut kullanıcının erişebildiği proje ID'lerini döndürür.
 * super_admin tüm projelere erişir.
 */
export const getProjectIdsForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user) return [];
    if (user.role === "super_admin") {
      const projects = await ctx.db.query("projects").collect();
      return projects.map((p) => p._id);
    }
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => r.projectId);
  },
});

export const getProjectIdsByUser = authedQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Sadece super_admin başka kullanıcıların projelerini görebilir
    if (ctx.user.role !== "super_admin" && ctx.user._id !== args.userId) {
      throw new Error("Yetki yok");
    }
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.map((r) => r.projectId);
  },
});

export const assign = superAdminMutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  returns: v.id("userProjects"),
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

export const remove = superAdminMutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

export const getAll = authedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role !== "super_admin") throw new Error("Yetki yok");
    return await ctx.db.query("userProjects").collect();
  },
});

export const getByProject = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "super_admin") throw new Error("Yetki yok");
    return await ctx.db
      .query("userProjects")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
