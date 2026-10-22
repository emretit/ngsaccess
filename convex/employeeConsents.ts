import { assertBiometricAllowed } from "./lib/biometricGate";
import { ConvexError, v } from "convex/values";
import { authedQuery, adminMutation, adminQuery } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";
import { requireEmployeeAccess } from "./lib/auth";

import { assertUploadOwner } from "./lib/peopleScope";
import { scheduleFingerprintPurge } from "./lib/employeeCardChange";

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

export const grant = adminMutation({
  args: {
    employeeId: v.id("employees"),
    consentType: v.union(
      v.literal("biometric_face"),
      v.literal("biometric_fingerprint"),
      v.literal("photo"),
    ),
    documentUrl: v.optional(v.string()),
    documentStorageId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = await requireEmployeeAccess(ctx, args.employeeId);
    if (args.consentType === "biometric_face" || args.consentType === "biometric_fingerprint") {
      await assertBiometricAllowed(ctx, employee.projectId);
    }

    const existing = await ctx.db
      .query("employeeConsents")
      .withIndex("by_employee_type", (q) =>
        q.eq("employeeId", args.employeeId).eq("consentType", args.consentType),
      )
      .filter((q) => q.eq(q.field("revokedAt"), undefined))
      .first();
    if (existing && !args.documentStorageId) return existing._id;
    if (existing && (existing.documentStorageId || existing.documentUrl)) {
      throw new ConvexError("Bu rıza için zaten belge var");
    }

    const storageId = args.documentStorageId;
    if (storageId) {
      const linked = await ctx.db.query("employeeConsents").withIndex("by_document_storage", q => q.eq("documentStorageId", storageId)).first();
      if (linked) throw new ConvexError("Dosya zaten bir rızaya bağlı");
      const pending = await ctx.db.query("pendingUploads").withIndex("by_storage", q => q.eq("storageId", storageId)).unique();
      assertUploadOwner(pending?.userId, ctx.user._id);
      const metadata = await ctx.db.system.get(storageId);
      if (!metadata || !["application/pdf", "image/jpeg", "image/png"].includes(metadata.contentType ?? "") || metadata.size > 10 * 1024 * 1024) {
        throw new Error("PDF, JPEG veya PNG biçiminde, en çok 10 MB bir dosya seçin.");
      }
      if (pending) await ctx.db.delete(pending._id);
    }
    if (existing) {
      await ctx.db.patch(existing._id, { documentStorageId: storageId });
      await writeAudit(ctx, {
        user: ctx.user,
        projectId: employee.projectId ?? null,
        action: "update",
        targetTable: "employeeConsents",
        targetId: existing._id,
        newValue: { documentStorageId: storageId },
        note: `KVKK rıza belgesi eklendi: ${args.consentType}`,
      });
      return existing._id;
    }
    const now = new Date().toISOString();
    const id = await ctx.db.insert("employeeConsents", {
      employeeId: args.employeeId,
      consentType: args.consentType,
      grantedAt: now,
      documentUrl: args.documentUrl,
      documentStorageId: args.documentStorageId,
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

export const revoke = adminMutation({
  args: { id: v.id("employeeConsents") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return;
    const employee = await requireEmployeeAccess(ctx, existing.employeeId);
    if (existing.revokedAt) return;
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, { revokedAt: now });

    let purgeCount = 0;
    if (existing.consentType === "biometric_fingerprint") {
      const enrollments = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", existing.employeeId)).take(100);
      purgeCount = enrollments.length;
      await scheduleFingerprintPurge(ctx, existing.employeeId, employee.cardNumber);
    }
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: employee?.projectId ?? null,
      action: "update",
      targetTable: "employeeConsents",
      targetId: args.id,
      newValue: { revokedAt: now },
      note: `KVKK rıza iptal: ${existing.consentType}${existing.consentType === "biometric_fingerprint" ? `; cihaz parmak izleri silme kuyruğuna alındı (${purgeCount})` : ""}`,
    });
  },
});

export { CONSENT_TYPES };
export type { ConsentType };

export const getDocumentUrl = adminQuery({
  args: { id: v.id("employeeConsents") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const consent = await ctx.db.get(args.id);
    if (!consent) return null;
    await requireEmployeeAccess(ctx, consent.employeeId);
    return consent.documentStorageId ? await ctx.storage.getUrl(consent.documentStorageId) : null;
  },
});
