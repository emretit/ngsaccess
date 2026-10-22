import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { adminMutation } from "./lib/customFunctions";
import { requireAccountAccessTarget } from "./lib/adminGuards";
import { revokeSessionTokens, revokeUserSessions } from "./lib/sessionRevoke";
import { writeAudit } from "./lib/audit";

export const freezeUser = adminMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const target = await requireAccountAccessTarget(ctx, ctx.user, userId, true);
    if (target.disabledAt !== undefined) return null;
    const now = Date.now();
    await ctx.db.patch(userId, { disabledAt: now, disabledBy: ctx.user._id });
    await revokeUserSessions(ctx, userId);
    await writeAudit(ctx, { user: { _id: ctx.user._id, _creationTime: ctx.user._creationTime }, action: "update", targetTable: "users", targetId: userId, note: "user.frozen" });
    return null;
  },
});

export const unfreezeUser = adminMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const target = await requireAccountAccessTarget(ctx, ctx.user, userId, false);
    if (target.disabledAt === undefined) return null;
    if (await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", userId)).first()) throw new Error("Oturumlar kapatılıyor; lütfen tekrar deneyin");
    await ctx.db.patch(userId, { disabledAt: undefined, disabledBy: undefined });
    await writeAudit(ctx, { user: { _id: ctx.user._id, _creationTime: ctx.user._creationTime }, action: "update", targetTable: "users", targetId: userId, note: "user.unfrozen" });
    return null;
  },
});

export const setAccessExpiry = adminMutation({
  args: { userId: v.id("users"), accessExpiresAt: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { userId, accessExpiresAt }) => {
    const target = await requireAccountAccessTarget(ctx, ctx.user, userId, accessExpiresAt !== null);
    if (accessExpiresAt !== null && (!Number.isFinite(accessExpiresAt) || accessExpiresAt < Date.now() + 60_000)) {
      throw new Error("Erişim bitişi en az bir dakika sonrası olmalıdır");
    }
    if (target.accessExpiresAt !== undefined && target.accessExpiresAt <= Date.now()) {
      await revokeUserSessions(ctx, userId);
    }
    if (target.accessExpiryJobId) await ctx.scheduler.cancel(target.accessExpiryJobId);
    const jobId = accessExpiresAt === null ? undefined : await ctx.scheduler.runAt(accessExpiresAt, internal.accountAccess.expireAccess, { userId, expectedExpiresAt: accessExpiresAt });
    await ctx.db.patch(userId, { accessExpiresAt: accessExpiresAt ?? undefined, accessExpiryJobId: jobId });
    await writeAudit(ctx, { user: { _id: ctx.user._id, _creationTime: ctx.user._creationTime }, action: "update", targetTable: "users", targetId: userId, note: accessExpiresAt === null ? "user.expiry_cleared" : "user.expiry_set" });
    return null;
  },
});

export const expireAccess = internalMutation({
  args: { userId: v.id("users"), expectedExpiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, expectedExpiresAt }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.accessExpiresAt !== expectedExpiresAt || expectedExpiresAt > Date.now()) return null;
    await revokeUserSessions(ctx, userId);
    await ctx.db.patch(userId, { accessExpiryJobId: undefined });
    await writeAudit(ctx, { user: null, action: "update", targetTable: "users", targetId: userId, note: "user.access_expired" });
    return null;
  },
});

export const continueSessionRevoke = internalMutation({
  args: { userId: v.id("users"), before: v.number() },
  returns: v.null(),
  handler: async (ctx, { userId, before }) => { await revokeUserSessions(ctx, userId, before); return null; },
});

export const continueTokenRevoke = internalMutation({
  args: { sessionId: v.id("authSessions") },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => { await revokeSessionTokens(ctx, sessionId); return null; },
});
