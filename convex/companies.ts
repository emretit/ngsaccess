import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.isSuperAdmin) return await ctx.db.query("companies").collect();
    if (!args.projectIds || args.projectIds.length === 0) return [];
    const results = await Promise.all(
      args.projectIds.map((pid) =>
        ctx.db
          .query("companies")
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
    address: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    currency: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("companies", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    currency: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { companyId, ...updates } = args;
    await ctx.db.patch(companyId, { ...updates, updatedAt: new Date().toISOString() });
  },
});

export const remove = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.companyId);
  },
});
