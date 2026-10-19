import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { isBiometricEnabled } from "./privacySettings";

export async function assertBiometricAllowed(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects"> | undefined,
): Promise<void> {
  if (!(await isBiometricEnabled(ctx, projectId))) {
    throw new ConvexError({ code: "BIOMETRIC_DISABLED", message: "Bu projede biyometri modülü kapalı. Yüz veya parmak izi eklenemez ve cihazlara gönderilemez." });
  }
}

export function biometricReason(enabled: boolean, reason: string | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if ((enabled && trimmed.length < 3) || trimmed.length > 500) {
    throw new ConvexError({ code: "INVALID_BIOMETRIC_REASON", message: "Kritik alan erişimi gerekçesi 3–500 karakter olmalıdır." });
  }
  return trimmed;
}

export function isBiometricAddition(operation: string): boolean {
  return operation === "addFace" || operation === "addFingerprint";
}

/** Resolve the actual employee project, never trust an operation's projectId. */
export async function biometricPayloadProject(
  ctx: QueryCtx | MutationCtx,
  payload: unknown,
): Promise<Id<"projects"> | undefined> {
  if (!payload || typeof payload !== "object" || !("employeeId" in payload) || typeof payload.employeeId !== "string") return undefined;
  const employeeId = ctx.db.normalizeId("employees", payload.employeeId);
  const employee = employeeId ? await ctx.db.get(employeeId) : null;
  return employee?.projectId;
}
