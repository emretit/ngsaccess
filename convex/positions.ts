import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (ctx.user.role === "super_admin") return await ctx.db.query("positions").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("positions")
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
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("positions", { ...args, createdAt: now, updatedAt: now });
  },
});

export const remove = authedMutation({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const pos = await ctx.db.get(args.positionId);
    if (!pos) throw new Error("Pozisyon bulunamadı");
    if (pos.projectId && !allowedProjectIds.some((id) => id === pos.projectId)) {
      throw new Error("Bu pozisyona erişim yetkiniz yok");
    }
    await ctx.db.delete(args.positionId);
  },
});
