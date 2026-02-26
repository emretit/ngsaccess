import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekiyor");
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const saveEmployeePhoto = mutation({
  args: {
    employeeId: v.id("employees"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Dosya URL'si alınamadı");
    await ctx.db.patch(args.employeeId, {
      photoUrl: url,
      photoStorageId: args.storageId,
      updatedAt: new Date().toISOString(),
    });
    return url;
  },
});

export const saveUserPhoto = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Giriş yapmanız gerekiyor");
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Dosya URL'si alınamadı");
    await ctx.db.patch(userId, {
      photoUrl: url,
      updatedAt: new Date().toISOString(),
    });
    return url;
  },
});

export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});
