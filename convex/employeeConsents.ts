import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";
import { requireEmployeeAccess } from "./lib/auth";

const CONSENT_TYPES = [
  "biometric_face",
  "biometric_fingerprint",
  "card",
  "photo",
] as const;
type ConsentType = (typeof CONSENT_TYPES)[number];

export const listForEmployee = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    await requireEmployeeAccess(ctx, args.employeeId);
    return await ctx.db
      .query("employeeConsents")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
      .collect();
  },
});

export const hasActiveConsent = authedQuery({
  args: {
    employeeId: v.id("employees"),
    consentType: v.union(
      v.literal("biometric_face"),
      v.literal("biometric_fingerprint"),
      v.literal("card"),
      v.literal("photo"),
    ),
  },
  handler: async (ctx, args) => {
    await requireEmployeeAccess(ctx, args.employeeId);
    const rows = await ctx.db
      .query("employeeConsents")
      .withIndex("by_employee_type", (q) =>
        q.eq("employeeId", args.employeeId).eq("consentType", args.consentType),
      )
      .collect();
    return rows.some((r) => !r.revokedAt);
  },
});

export const grant = authedMutation({
  args: {
    employeeId: v.id("employees"),
    consentType: v.union(
      v.literal("biometric_face"),
      v.literal("biometric_fingerprint"),
      v.literal("card"),
      v.literal("photo"),
    ),
    documentUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = await requireEmployeeAccess(ctx, args.employeeId);

    const existing = await ctx.db
      .query("employeeConsents")
      .withIndex("by_employee_type", (q) =>
        q.eq("employeeId", args.employeeId).eq("consentType", args.consentType),
      )
      .filter((q) => q.eq(q.field("revokedAt"), undefined))
      .first();
    if (existing) return existing._id;

    const now = new Date().toISOString();
    const id = await ctx.db.insert("employeeConsents", {
      employeeId: args.employeeId,
      consentType: args.consentType,
      grantedAt: now,
      documentUrl: args.documentUrl,
      grantedBy: ctx.user._id,
      notes: args.notes,
    });

    await writeAudit(ctx, {
      user: ctx.user,
      projectId: employee.projectId ?? null,
      action: "create",
      targetTable: "employeeConsents",
      targetId: id,
      newValue: { consentType: args.consentType, grantedAt: now },
      note: `KVKK rıza alındı: ${args.consentType}`,
    });

    return id;
  },
});

export const revoke = authedMutation({
  args: { id: v.id("employeeConsents") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return;
    await requireEmployeeAccess(ctx, existing.employeeId);
    if (existing.revokedAt) return;
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, { revokedAt: now });

    const employee = await ctx.db.get(existing.employeeId);
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: employee?.projectId ?? null,
      action: "update",
      targetTable: "employeeConsents",
      targetId: args.id,
      newValue: { revokedAt: now },
      note: `KVKK rıza iptal: ${existing.consentType}`,
    });
  },
});

export { CONSENT_TYPES };
export type { ConsentType };
