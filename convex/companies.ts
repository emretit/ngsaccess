import { resolveProjectScope } from "./lib/projectScope";
import { requirePermission } from "./lib/permissions";
import { assertUniqueOrgName, orgName } from "./lib/orgNames";

import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/customFunctions";

export const list = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const projectIds = await resolveProjectScope(ctx, args.projectId);
    const results = await Promise.all(projectIds.map(projectId =>
      ctx.db.query("companies").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ));
    return results.flat();
  },
});

const detailArgs = {
  address: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  taxNumber: v.optional(v.string()),
};

const DETAIL_KEYS = ["address", "phone", "email", "taxNumber"] as const;
type Details = Partial<Record<(typeof DETAIL_KEYS)[number], string>>;

/** Boş bırakılan ayrıntı alanı kayıttan silinir. */
function details(args: Details): Details {
  const out: Details = {};
  for (const key of DETAIL_KEYS) {
    if (args[key] !== undefined) out[key] = args[key].trim() || undefined;
  }
  return out;
}

export const create = authedMutation({
  args: { projectId: v.id("projects"), name: v.string(), ...detailArgs },
  returns: v.id("companies"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "employees.manage");
    const name = orgName(args.name, "Şirket");
    const existing = await ctx.db.query("companies").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(500);
    assertUniqueOrgName(existing, name, "Şirket");
    const now = new Date().toISOString();
    return await ctx.db.insert("companies", { projectId: args.projectId, name, ...details(args), createdAt: now, updatedAt: now });
  },
});

export const update = authedMutation({
  args: { companyId: v.id("companies"), name: v.optional(v.string()), ...detailArgs },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    if (!company?.projectId) throw new ConvexError("Şirket bulunamadı");
    const projectId = company.projectId;
    await requirePermission(ctx, ctx.user, projectId, "employees.manage");
    const patch: Partial<Doc<"companies">> = { ...details(args), updatedAt: new Date().toISOString() };
    if (args.name !== undefined) {
      const name = orgName(args.name, "Şirket");
      const existing = await ctx.db.query("companies").withIndex("by_project", q => q.eq("projectId", projectId)).take(500);
      assertUniqueOrgName(existing, name, "Şirket", company._id);
      patch.name = name;
    }
    await ctx.db.patch(args.companyId, patch);
    return null;
  },
});

export const remove = authedMutation({
  args: { companyId: v.id("companies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const company = await ctx.db.get(args.companyId);
    if (!company?.projectId) throw new ConvexError("Şirket bulunamadı");
    await requirePermission(ctx, ctx.user, company.projectId, "employees.manage");
    const [employee, department] = await Promise.all([
      ctx.db.query("employees").withIndex("by_company", q => q.eq("companyId", args.companyId)).first(),
      ctx.db.query("departments").withIndex("by_company", q => q.eq("companyId", args.companyId)).first(),
    ]);
    if (employee || department) {
      throw new ConvexError("Şirket silinemez: bağlı kişi veya departman var. Önce bağlı kayıtları taşıyın.");
    }
    await ctx.db.delete(args.companyId);
    return null;
  },
});
