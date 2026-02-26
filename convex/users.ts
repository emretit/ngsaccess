import { v } from "convex/values";
import { optionalAuthQuery, authedMutation, adminQuery, adminMutation, superAdminMutation } from "./lib/customFunctions";

export const currentUser = optionalAuthQuery({
  args: {},
  handler: async (ctx) => {
    if (!ctx.user) return null;
    return ctx.user;
  },
});

export const getProfile = adminQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const isSuperAdmin = optionalAuthQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    if (!ctx.user) return false;
    return ctx.user.role === "super_admin";
  },
});

export const updateRole = superAdminMutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const updatePhoto = authedMutation({
  args: {
    photoUrl: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      photoUrl: args.photoUrl,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const updateProfile = authedMutation({
  args: {
    fullName: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.fullName !== undefined) updates.fullName = args.fullName;
    if (args.photoUrl !== undefined) updates.photoUrl = args.photoUrl;
    await ctx.db.patch(ctx.user._id, updates);
    return null;
  },
});

export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const setupUser = superAdminMutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("project_admin"),
      v.literal("project_user")
    ),
    fullName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      role: args.role,
      fullName: args.fullName,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

/**
 * İlk super_admin kurulumu.
 * Hiç super_admin yokken ve doğru gizli kod girildiğinde çalışır.
 * Sadece bir kez kullanılabilir.
 */
export const initializeAdmin = authedMutation({
  args: { secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new Error("Geçersiz gizli kod");
    }
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "super_admin"))
      .first();
    if (existingAdmin) {
      throw new Error("Süper admin zaten mevcut");
    }
    await ctx.db.patch(ctx.user._id, {
      role: "super_admin",
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});
