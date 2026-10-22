import { v } from "convex/values";
import { authedQuery, optionalAuthQuery } from "./lib/customFunctions";

export const getByCurrentUser = optionalAuthQuery({
  args: {},
  handler: async (ctx) => {
    // Full access/session checks run in optionalAuthQuery; unverified profiles stay private.
    if (!ctx.user || ctx.user.verified === false) return [];
    const userId = ctx.user._id;
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1000);
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const project = await ctx.db.get(r.projectId);
        return project ? { ...r, projectName: project.name } : null;
      })
    );
    return enriched.filter((p): p is NonNullable<typeof p> => p !== null);
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
      .take(1000);
    return rows.map((r) => r.projectId);
  },
});

import { internalQuery as _internalQuery } from "./_generated/server";

export const adminListByUser = _internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(v.object({
    projectId: v.id("projects"),
    projectName: v.string(),
    ownerId: v.union(v.id("users"), v.null()),
  })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(1000);
    const out = [];
    for (const r of rows) {
      const p = await ctx.db.get(r.projectId);
      if (p) out.push({ projectId: p._id, projectName: p.name, ownerId: p.ownerId ?? null });
    }
    return out;
  },
});
