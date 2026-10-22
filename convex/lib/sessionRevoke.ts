import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/** Delete the session immediately, even if refresh-token cleanup needs more batches. */
export async function revokeSessionTokens(ctx: MutationCtx, sessionId: Id<"authSessions">): Promise<void> {
  const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", q => q.eq("sessionId", sessionId)).take(100);
  for (const token of tokens) await ctx.db.delete(token._id);
  if (tokens.length === 100 && await ctx.db.query("authRefreshTokens").withIndex("sessionId", q => q.eq("sessionId", sessionId)).first()) {
    await ctx.scheduler.runAfter(0, internal.accountAccess.continueTokenRevoke, { sessionId });
  }
}

/** Preserve sessions opened after this revocation (e.g. after an unfreeze). */
export async function revokeUserSessions(ctx: MutationCtx, userId: Id<"users">, before?: number): Promise<void> {
  const cutoff = before ?? (await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", userId)).order("desc").first())?._creationTime;
  if (cutoff === undefined) return;
  const user = await ctx.db.get(userId);
  if (user && (user.sessionsRevokedThrough === undefined || user.sessionsRevokedThrough < cutoff)) {
    await ctx.db.patch(userId, { sessionsRevokedThrough: cutoff });
  }
  const sessions = await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", userId)).take(50);
  for (const session of sessions) {
    if (session._creationTime > cutoff) continue;
    await ctx.db.delete(session._id);
    await revokeSessionTokens(ctx, session._id);
  }
  if (sessions.length === 50) {
    const remaining = await ctx.db.query("authSessions").withIndex("userId", q => q.eq("userId", userId)).first();
    if (remaining && remaining._creationTime <= cutoff) {
      await ctx.scheduler.runAfter(0, internal.accountAccess.continueSessionRevoke, { userId, before: cutoff });
    }
  }
}
