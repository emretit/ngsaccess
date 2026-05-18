
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {
    zoneId: v.optional(v.id("zones")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId);
      if (!zone) return [];
      if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
        return [];
      }
      return await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
        .collect();
    }
    if (ctx.user.role === "super_admin") return await ctx.db.query("doors").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("doors")
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
    zoneId: v.optional(v.id("zones")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("doors", {
      ...args,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedMutation({
  args: {
    doorId: v.id("doors"),
    name: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const door = await ctx.db.get(args.doorId);
    if (!door) throw new Error("Kapı bulunamadı");
    if (door.projectId && !allowedProjectIds.some((id) => id === door.projectId)) {
      throw new Error("Bu kapıya erişim yetkiniz yok");
    }
    const { doorId, ...updates } = args;
    await ctx.db.patch(doorId, { ...updates, updatedAt: new Date().toISOString() });
  },
});

export const remove = authedMutation({
  args: { doorId: v.id("doors") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const door = await ctx.db.get(args.doorId);
    if (!door) throw new Error("Kapı bulunamadı");
    if (door.projectId && !allowedProjectIds.some((id) => id === door.projectId)) {
      throw new Error("Bu kapıya erişim yetkiniz yok");
    }
    await ctx.db.delete(args.doorId);
  },
});
