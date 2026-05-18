
import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (ctx.user.role === "super_admin") return await ctx.db.query("companies").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("companies")
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
    address: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    currency: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.projectId && !allowedProjectIds.some((id) => id === args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("companies", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = authedMutation({
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
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const company = await ctx.db.get(args.companyId);
    if (!company) throw new Error("Şirket bulunamadı");
    if (company.projectId && !allowedProjectIds.some((id) => id === company.projectId)) {
      throw new Error("Bu şirkete erişim yetkiniz yok");
    }
    const { companyId, ...updates } = args;
    await ctx.db.patch(companyId, { ...updates, updatedAt: new Date().toISOString() });
  },
});

export const remove = authedMutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const company = await ctx.db.get(args.companyId);
    if (!company) throw new Error("Şirket bulunamadı");
    if (company.projectId && !allowedProjectIds.some((id) => id === company.projectId)) {
      throw new Error("Bu şirkete erişim yetkiniz yok");
    }
    await ctx.db.delete(args.companyId);
  },
});
