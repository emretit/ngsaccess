import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import { requirePermission } from "./lib/permissions";
import { generateVisitorPin, generateVisitorToken, hashVisitorSecret } from "./lib/visitorPass";
import { writeAudit } from "./lib/audit";

async function requireVisitor(ctx: (QueryCtx | MutationCtx) & { user: Doc<"users"> }, visitorId: Id<"employees">) {
  const visitor = await ctx.db.get(visitorId);
  if (!visitor?.isVisitor || !visitor.projectId || visitor.visitorCredential !== "pass") throw new Error("Geçiş kodlu ziyaretçi bulunamadı");
  await resolveProjectScope(ctx, visitor.projectId);
  await requirePermission(ctx, ctx.user, visitor.projectId, "visitors.manage");
  return { visitor, projectId: visitor.projectId };
}

function metadata(pass: Doc<"visitorPasses">) {
  return { passId: pass._id, visitorId: pass.visitorId, projectId: pass.projectId, maxUses: pass.maxUses ?? null,
    usedCount: pass.usedCount, status: pass.status, lastUsedAt: pass.lastUsedAt ?? null, createdAt: pass.createdAt, updatedAt: pass.updatedAt };
}

const issueArgs = { visitorId: v.id("employees"), maxUses: v.optional(v.number()) };
const secretResult = v.object({ passId: v.id("visitorPasses"), token: v.string(), pin: v.string() });

async function issueCore(ctx: MutationCtx & { user: Doc<"users"> }, args: { visitorId: Id<"employees">; maxUses?: number }, regenerate: boolean) {
  const { projectId } = await requireVisitor(ctx, args.visitorId);
  const existing = await ctx.db.query("visitorPasses").withIndex("by_visitorId", q => q.eq("visitorId", args.visitorId)).unique();
  if (existing && !regenerate) throw new Error("Kod zaten var; yeniden üretin");
  if (!existing && regenerate) throw new Error("Önce geçiş kodu oluşturun");
  const maxUses = args.maxUses ?? (regenerate ? existing?.maxUses : undefined);
  if (maxUses !== undefined && (!Number.isSafeInteger(maxUses) || maxUses < 1)) throw new Error("Giriş limiti pozitif tam sayı olmalıdır");
  const token = generateVisitorToken();
  const tokenHash = await hashVisitorSecret(token);
  let pin = "";
  let pinHash = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateVisitorPin();
    const hash = await hashVisitorSecret(`${projectId}:${candidate}`);
    // Exhausted passes still authorize exits, so their PIN remains reserved.
    const collision = await ctx.db.query("visitorPasses").withIndex("by_projectId_and_pinHash_and_status", q => q.eq("projectId", projectId).eq("pinHash", hash).eq("status", "active")).first()
      ?? await ctx.db.query("visitorPasses").withIndex("by_projectId_and_pinHash_and_status", q => q.eq("projectId", projectId).eq("pinHash", hash).eq("status", "exhausted")).first();
    // Also rotate away from this visitor's old PIN even if it was revoked.
    if (!collision && hash !== existing?.pinHash) { pin = candidate; pinHash = hash; break; }
  }
  if (!pinHash) throw new Error("PIN üretilemedi; yeniden deneyin");
  const now = new Date().toISOString();
  const values = { tokenHash, pinHash, maxUses, usedCount: 0, status: "active" as const, lastUsedAt: undefined, updatedAt: now };
  const passId = existing?._id ?? await ctx.db.insert("visitorPasses", {
    projectId, visitorId: args.visitorId, createdBy: ctx.user._id, createdAt: now, ...values,
  });
  if (existing) await ctx.db.patch(existing._id, values);
  await writeAudit(ctx, { user: ctx.user, projectId, action: existing ? "update" : "create", targetTable: "visitorPasses", targetId: passId,
    newValue: { status: "active", maxUses: maxUses ?? null, usedCount: 0 }, note: regenerate ? "Ziyaretçi geçiş kodu yeniden üretildi" : "Ziyaretçi geçiş kodu oluşturuldu" });
  return { passId, token, pin };
}

export const issue = authedMutation({ args: issueArgs, returns: secretResult, handler: (ctx, args) => issueCore(ctx, args, false) });
export const regenerate = authedMutation({ args: issueArgs, returns: secretResult, handler: (ctx, args) => issueCore(ctx, args, true) });
export const getForVisitor = authedQuery({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    await requireVisitor(ctx, args.visitorId);
    const pass = await ctx.db.query("visitorPasses").withIndex("by_visitorId", q => q.eq("visitorId", args.visitorId)).unique();
    return pass ? metadata(pass) : null;
  },
});
export const revoke = authedMutation({
  args: { visitorId: v.id("employees") }, returns: v.null(),
  handler: async (ctx, args) => {
    const { projectId } = await requireVisitor(ctx, args.visitorId);
    const pass = await ctx.db.query("visitorPasses").withIndex("by_visitorId", q => q.eq("visitorId", args.visitorId)).unique();
    if (pass && pass.status !== "revoked") {
      await ctx.db.patch(pass._id, { status: "revoked", updatedAt: new Date().toISOString() });
      await writeAudit(ctx, { user: ctx.user, projectId, action: "update", targetTable: "visitorPasses", targetId: pass._id, newValue: { status: "revoked" }, note: "Ziyaretçi geçiş kodu iptal edildi" });
    }
    return null;
  },
});
