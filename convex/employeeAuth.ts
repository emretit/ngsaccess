import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByEmployee = query({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeeAuth")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .first();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("employeeAuth")
      .withIndex("by_token", (q) => q.eq("setupToken", args.token))
      .first();
  },
});

export const create = mutation({
  args: {
    employeeId: v.id("employees"),
    projectId: v.optional(v.id("projects")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    setupToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("employeeAuth", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    authId: v.id("employeeAuth"),
    email: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    setupToken: v.optional(v.union(v.string(), v.null())),
    tokenExpiresAt: v.optional(v.union(v.string(), v.null())),
    lastLogin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { authId, ...updates } = args;
    const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [k, val] of Object.entries(updates)) {
      if (val !== undefined) clean[k] = val === null ? undefined : val;
    }
    await ctx.db.patch(authId, clean);
  },
});
