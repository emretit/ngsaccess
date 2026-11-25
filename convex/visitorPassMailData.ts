import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/auth";
import { requirePermission } from "./lib/permissions";
import { resolveProjectScope } from "./lib/projectScope";
import { writeAudit } from "./lib/audit";

async function authorizedVisitor(ctx: QueryCtx | MutationCtx, visitorId: Id<"employees">) {
  const user = await getCurrentUser(ctx);
  const visitor = await ctx.db.get(visitorId);
  if (!visitor?.isVisitor || !visitor.projectId) throw new Error("Ziyaretçi bulunamadı");
  await resolveProjectScope(ctx, visitor.projectId);
  await requirePermission(ctx, user, visitor.projectId, "visitors.manage");
  return { visitor, user, projectId: visitor.projectId };
}

/** Only hashes cross the runtime boundary; the recipient/content come from authorized DB rows. */
export const prepare = internalQuery({
  args: { visitorId: v.id("employees"), tokenHash: v.string(), pinHash: v.string() },
  handler: async (ctx, args) => {
    const { visitor, projectId } = await authorizedVisitor(ctx, args.visitorId);
    const pass = await ctx.db.query("visitorPasses").withIndex("by_visitorId", q => q.eq("visitorId", visitor._id)).unique();
    if (visitor.visitorCredential !== "pass" || !visitor.isActive || !pass || pass.projectId !== projectId || pass.status !== "active" ||
        pass.tokenHash !== args.tokenHash || pass.pinHash !== args.pinHash) return { ok: false as const, reason: "PASS_MISMATCH" as const };
    const email = visitor.email?.trim();
    if (!email || email.toLowerCase().endsWith("@ngsaccess.local")) return { ok: false as const, reason: "NO_EMAIL" as const };
    const ruleId = visitor.accessRuleId;
    const links = ruleId ? await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", ruleId)).take(201) : [];
    if (links.length > 200) throw new Error("Kapı sınırı aşıldı");
    const doors = await Promise.all(links.map(link => ctx.db.get(link.doorId)));
    return { ok: true as const, projectId, passId: pass._id, email,
      name: `${visitor.firstName} ${visitor.lastName}`, startsAt: visitor.accessStartsAt ?? "", expiresAt: visitor.accessExpiresAt ?? "",
      doors: doors.filter((door): door is NonNullable<typeof door> => door !== null).filter(door => door.projectId === projectId).map(door => door.name) };
  },
});

export const recordSent = internalMutation({
  args: { visitorId: v.id("employees"), passId: v.id("visitorPasses") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { user, projectId } = await authorizedVisitor(ctx, args.visitorId);
    const pass = await ctx.db.get(args.passId);
    if (!pass || pass.visitorId !== args.visitorId || pass.projectId !== projectId) throw new Error("Geçiş kodu bulunamadı");
    await writeAudit(ctx, { user, projectId, action: "update", targetTable: "visitorPasses", targetId: pass._id, note: "pass e-postası gönderildi" });
    return null;
  },
});

/** Resolve the PIN salt without exposing visitor data before project authorization. */
export const projectForVisitor = internalQuery({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => (await authorizedVisitor(ctx, args.visitorId)).projectId,
});
