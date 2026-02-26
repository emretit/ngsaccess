import { query } from "./_generated/server";
import { v } from "convex/values";
import { authedQuery, superAdminMutation } from "./lib/customFunctions";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role === "super_admin") {
      return await ctx.db.query("projects").collect();
    }
    // project_admin / project_user sadece kendi projelerini görür
    const rows = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    const projects = await Promise.all(rows.map((r) => ctx.db.get(r.projectId)));
    return projects.filter(Boolean);
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

export const create = superAdminMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = superAdminMutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const { id: projectId, ...updates } = args;
    const existing = await ctx.db.get(projectId);
    if (!existing) throw new Error("Proje bulunamadı");
    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === undefined) delete updateData[k];
    });
    await ctx.db.patch(projectId, updateData);
    return projectId;
  },
});

export const remove = superAdminMutation({
  args: { id: v.id("projects") },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});
