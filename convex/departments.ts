
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (ctx.user.role === "super_admin") {
      return await ctx.db.query("departments").collect();
    }
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("departments")
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
    parentId: v.optional(v.id("departments")),
    level: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("departments", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authedMutation({
  args: {
    departmentId: v.id("departments"),
    name: v.optional(v.string()),
    parentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) throw new Error("Departman bulunamadı");
    if (dept.projectId && !allowedProjectIds.some((id) => id === dept.projectId)) {
      throw new Error("Bu departmana erişim yetkiniz yok");
    }
    const { departmentId, ...updates } = args;
    await ctx.db.patch(departmentId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const remove = authedMutation({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const dept = await ctx.db.get(args.departmentId);
    if (!dept) throw new Error("Departman bulunamadı");
    if (dept.projectId && !allowedProjectIds.some((id) => id === dept.projectId)) {
      throw new Error("Bu departmana erişim yetkiniz yok");
    }
    await ctx.db.delete(args.departmentId);
  },
});
