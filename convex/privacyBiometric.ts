import { hasActiveDestructionRun } from "./lib/biometricDestructionState";
import { ConvexError, v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { adminQuery, adminMutation, authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, requireEmployeeAccess } from "./lib/auth";
import { getPrivacyRow, getPrivacySettings, upsertPrivacySettings } from "./lib/privacySettings";
import { internalQuery } from "./_generated/server";
import { assertBiometricAllowed, biometricReason } from "./lib/biometricGate";
import { writeAudit } from "./lib/audit";

async function requireProject(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">): Promise<void> {
  if (!(await getProjectIdsForUser(ctx)).includes(projectId)) {
    throw new ConvexError({ code: "PROJECT_ACCESS_DENIED", message: "Bu projeye erişim yetkiniz yok." });
  }
}

export const getBiometricModule = adminQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProject(ctx, projectId);
    const row = await getPrivacyRow(ctx, projectId);
    const settings = await getPrivacySettings(ctx, projectId);
    return { enabled: settings.biometricEnabled, reason: settings.biometricReason,
      changedAt: row?.biometricChangedAt ?? null, changedBy: row?.biometricChangedBy ?? null,
      legacy: row?.biometricEnabled === undefined };
  },
});

export const setBiometricModule = adminMutation({
  args: { projectId: v.id("projects"), enabled: v.boolean(), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const old = await getPrivacySettings(ctx, args.projectId);
    if (args.enabled && await hasActiveDestructionRun(ctx, args.projectId)) {
      throw new ConvexError({ code: "BIOMETRIC_DESTRUCTION_ACTIVE", message: "Şablon imhası sürerken modül açılamaz." });
    }
    if (old.biometricEnabled === args.enabled && !(args.enabled && args.reason !== undefined)) return null;
    const reason = biometricReason(args.enabled, args.reason);
    const patch = { biometricEnabled: args.enabled, biometricReason: reason,
      biometricChangedAt: new Date().toISOString(), biometricChangedBy: ctx.user._id };
    await upsertPrivacySettings(ctx, args.projectId, patch);
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: "update",
      targetTable: "projectPrivacySettings", targetId: args.projectId,
      oldValue: { biometricEnabled: old.biometricEnabled, biometricReason: old.biometricReason }, newValue: patch });
    return null;
  },
});

/** Public capture actions must resolve the device project on the server. */
export const assertBiometricDeviceAllowed = internalQuery({
  args: { deviceId: v.id("devices") },
  returns: v.null(),
  handler: async (ctx, { deviceId }) => {
    const device = await ctx.db.get(deviceId);
    if (!device) throw new ConvexError({ code: "DEVICE_NOT_FOUND", message: "Cihaz bulunamadı." });
    await assertBiometricAllowed(ctx, device.projectId);
    return null;
  },
});

/** Consent readers need only the module flag, not admin privacy metadata. */
export const getEmployeeBiometricModule = authedQuery({
  args: { employeeId: v.id("employees") },
  returns: v.object({ enabled: v.boolean() }),
  handler: async (ctx, { employeeId }) => {
    const employee = await requireEmployeeAccess(ctx, employeeId);
    const enabled = employee.projectId ? (await getPrivacySettings(ctx, employee.projectId)).biometricEnabled : true;
    return { enabled };
  },
});
