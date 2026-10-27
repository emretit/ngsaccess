import { resolveProjectScope } from "./lib/projectScope";
import { requirePermission } from "./lib/permissions";
import { assertUniqueOrgName, orgName } from "./lib/orgNames";

import { ConvexError, v } from "convex/values";
import { authedMutation, authedQuery } from "./lib/customFunctions";

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("positions").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    return results.flat();
  },
});

export const create = authedMutation({
  args: { projectId: v.id("projects"), name: v.string() },
  returns: v.id("positions"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "employees.manage");
    const name = orgName(args.name, "Pozisyon");
    const existing = await ctx.db.query("positions").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(500);
    assertUniqueOrgName(existing, name, "Pozisyon");
    const now = new Date().toISOString();
    return await ctx.db.insert("positions", { projectId: args.projectId, name, createdAt: now, updatedAt: now });
  },
});

export const update = authedMutation({
  args: { positionId: v.id("positions"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const position = await ctx.db.get(args.positionId);
    if (!position?.projectId) throw new ConvexError("Pozisyon bulunamadı");
    const projectId = position.projectId;
    await requirePermission(ctx, ctx.user, projectId, "employees.manage");
    const name = orgName(args.name, "Pozisyon");
    const existing = await ctx.db.query("positions").withIndex("by_project", q => q.eq("projectId", projectId)).take(500);
    assertUniqueOrgName(existing, name, "Pozisyon", position._id);
    await ctx.db.patch(args.positionId, { name, updatedAt: new Date().toISOString() });
    return null;
  },
});

export const remove = authedMutation({
  args: { positionId: v.id("positions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const position = await ctx.db.get(args.positionId);
    if (!position?.projectId) throw new ConvexError("Pozisyon bulunamadı");
    await requirePermission(ctx, ctx.user, position.projectId, "employees.manage");
    const employee = await ctx.db.query("employees").withIndex("by_position", q => q.eq("positionId", args.positionId)).first();
    if (employee) throw new ConvexError("Pozisyon silinemez: bağlı kişi var. Önce kişilerin pozisyonunu değiştirin.");
    await ctx.db.delete(args.positionId);
    return null;
  },
});
