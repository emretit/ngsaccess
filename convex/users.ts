import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const isSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    return user?.role === "super_admin";
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updatePhoto = mutation({
  args: {
    photoUrl: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekiyor");
    await ctx.db.patch(userId, {
      photoUrl: args.photoUrl,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekiyor");
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.fullName !== undefined) updates.fullName = args.fullName;
    if (args.photoUrl !== undefined) updates.photoUrl = args.photoUrl;
    await ctx.db.patch(userId, updates);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const requesterId = await getAuthUserId(ctx);
    if (!requesterId) return [];
    const requester = await ctx.db.get(requesterId);
    if (requester?.role !== "super_admin") return [];
    return await ctx.db.query("users").collect();
  },
});

export const setupUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user")
    ),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      role: args.role,
      fullName: args.fullName,
      updatedAt: new Date().toISOString(),
    });
  },
});
