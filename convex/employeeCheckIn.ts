import { checkInTokenState, CHECK_IN_TOKEN_TTL_MS } from "./lib/checkInUx";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { employeeAuthedQuery } from "./lib/customFunctions";
import { getCurrentEmployee } from "./lib/employeeAuth";
import { accessError, employeeWithinAccessEpoch } from "./lib/mobileAccess";

/** A short-lived credential for an authenticated physical generic reader. */
export const createMyCheckInToken = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const employee = await getCurrentEmployee(ctx, sessionToken);
    const session = await ctx.db.query("employeeSessions").withIndex("by_token", q => q.eq("token", sessionToken)).first();
    if (!session) throw accessError("SESSION_INVALID");
    const projectId = employee.projectId;
    if (!projectId || !employeeWithinAccessEpoch(employee, Date.now())) throw accessError("TARGET_NOT_ALLOWED");
    const project = await ctx.db.get(projectId);
    if (!project || project.isActive === false) throw accessError("TARGET_NOT_ALLOWED");
    const auth = await ctx.db.query("employeeAuth")
      .withIndex("by_employee", q => q.eq("employeeId", employee._id)).first();
    if (!auth?.passwordHash) throw accessError("SESSION_REVOKED");
    const token = crypto.randomUUID();
    const now = Date.now();
    const serverTime = new Date(now).toISOString();
    const expiresAt = new Date(now + CHECK_IN_TOKEN_TTL_MS).toISOString();
    await ctx.db.insert("checkInTokens", {
      employeeId: employee._id, projectId, sessionId: session._id, authVersion: auth.passwordVersion ?? 0,
      purpose: "reader", token, expiresAt, createdAt: serverTime,
    });
    return { token, expiresAt, serverTime, purpose: "reader" as const };
  },
});

export const getMyCheckInTokenStatus = employeeAuthedQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const record = await ctx.db.query("checkInTokens").withIndex("by_token", q => q.eq("token", token)).first();
    if (!record || record.employeeId !== ctx.employee._id || !ctx.employee.projectId || record.projectId !== ctx.employee.projectId) {
      throw accessError("TOKEN_NOT_FOUND");
    }
    const now = Date.now();
    const auth = await ctx.db.query("employeeAuth").withIndex("by_employee", q => q.eq("employeeId", ctx.employee._id)).first();
    const session = record.sessionId ? await ctx.db.get(record.sessionId) : null;
    const issuingSessionValid = session && session.employeeId === ctx.employee._id &&
      Number.isFinite(Date.parse(session.expiresAt)) && Date.parse(session.expiresAt) > now &&
      (session.passwordVersion ?? 0) === record.authVersion;
    const status = record.usedAt ? "consumed" as const
      : !issuingSessionValid || record.purpose !== "reader" || record.authVersion !== (auth?.passwordVersion ?? 0) ||
        !employeeWithinAccessEpoch(ctx.employee, now) || checkInTokenState(record, now) === "expired" ? "expired" as const : "active" as const;
    return { status, expiresAt: record.expiresAt, serverTime: new Date(now).toISOString() };
  },
});

/** Compatibility endpoint: never creates attendance from an unauthenticated phone/browser. */
export const checkInWithToken = mutation({
  args: { token: v.string(), latitude: v.optional(v.number()), longitude: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const record = await ctx.db.query("checkInTokens").withIndex("by_token", q => q.eq("token", args.token)).first();
    const state = checkInTokenState(record, Date.now());
    if (!record || state === "invalid") return { success: false as const, code: "invalid_token", error: "Geçersiz veya süresi dolmuş kod" };
    if (state === "completed") return {
      success: true as const, employeeName: record.employeeName, accessTime: record.usedAt, locationRecorded: record.locationRecorded,
    };
    if (state === "expired") return { success: false as const, code: "expired_token", error: "Kodun süresi doldu" };
    return { success: false as const, code: "READER_REQUIRED", error: "Bu kod yalnız fiziksel okuyucu tarafından kullanılabilir" };
  },
});
