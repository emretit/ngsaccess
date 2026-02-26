import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Projeler için Convex query ve mutation örnekleri
 * Supabase'deki projects tablosunun Convex karşılığı
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("projects", {
      name: args.name,
      description: args.description ?? undefined,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id: projectId, ...updates } = args;
    const existing = await ctx.db.get(projectId);
    if (!existing) throw new Error("Proje bulunamadı");

    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    // undefined değerleri kaldır
    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === undefined) delete updateData[k];
    });

    await ctx.db.patch(projectId, updateData);
    return projectId;
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});
