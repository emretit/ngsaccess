import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (ctx.user.role === "super_admin") return await ctx.db.query("zones").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("zones")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("zones", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = authedMutation({
  args: {
    zoneId: v.id("zones"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Bölge bulunamadı");
    if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
      throw new Error("Bu bölgeye erişim yetkiniz yok");
    }
    const { zoneId, ...updates } = args;
    await ctx.db.patch(zoneId, { ...updates, updatedAt: new Date().toISOString() });
  },
});

export const remove = authedMutation({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Bölge bulunamadı");
    if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
      throw new Error("Bu bölgeye erişim yetkiniz yok");
    }
    await ctx.db.delete(args.zoneId);
  },
});
