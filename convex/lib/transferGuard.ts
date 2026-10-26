import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { cardNumericKey } from "./cardIdentity";
import { writeAudit } from "./audit";

export const TRANSFER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const TRANSFER_LIMIT = 500;
export const activeTransferStatuses = ["requested", "revoking", "revoked", "provisioning", "stuck"] as const;
const allStatuses = [...activeTransferStatuses, "done", "cancelled"] as const;
export type ReadCtx = Pick<QueryCtx, "db">;
export function transferError(code: string, message: string): never { throw new ConvexError({ code, message }); }
export function transferBound<T>(rows: T[], limit = TRANSFER_LIMIT): T[] {
  if (rows.length > limit) transferError("TRANSFER_LIMIT", `Taşıma okuma sınırı (${limit}) aşıldı. Kapsamı daraltın.`);
  return rows;
}
export function transferIsActive(transfer: Doc<"accessTransfers">): boolean {
  return activeTransferStatuses.some(status => status === transfer.status);
}
export async function employeeTransfer(ctx: ReadCtx, employeeId: Id<"employees">, latest = false): Promise<Doc<"accessTransfers"> | null> {
  const matches: Doc<"accessTransfers">[] = [];
  for (const status of latest ? allStatuses : activeTransferStatuses) {
    const sourceQuery = ctx.db.query("accessTransfers").withIndex("by_employee_status", q => q.eq("employeeId", employeeId).eq("status", status));
    const targetQuery = ctx.db.query("accessTransfers").withIndex("by_target_employee_status", q => q.eq("targetEmployeeId", employeeId).eq("status", status));
    const source = (await (latest ? sourceQuery.order("desc") : sourceQuery).take(1))[0];
    const target = (await (latest ? targetQuery.order("desc") : targetQuery).take(1))[0];
    if (!latest && (source || target)) return source ?? target;
    if (source) matches.push(source);
    if (target) matches.push(target);
  }
  return matches.sort((a, b) => Number(transferIsActive(b)) - Number(transferIsActive(a)) || b.requestedAt - a.requestedAt)[0] ?? null;
}
/** Source-side lookup for hot device paths: active people skip it, a transfer source is always inactive. */
export async function sourceTransfer(ctx: ReadCtx, employee: Doc<"employees"> | null): Promise<Doc<"accessTransfers"> | null> {
  if (!employee || (employee.isActive !== false && employee.terminationType !== "transfer")) return null;
  // Point lookups per status: a prefix scan would be crowded out by old cancelled runs.
  for (const status of activeTransferStatuses) {
    const active = await ctx.db.query("accessTransfers").withIndex("by_employee_status", q => q.eq("employeeId", employee._id).eq("status", status)).first();
    if (active) return active;
  }
  if (employee.terminationType !== "transfer") return null;
  // Cancel clears the source metadata, so a transferred source belongs to its latest completed run.
  return await ctx.db.query("accessTransfers").withIndex("by_employee_status", q => q.eq("employeeId", employee._id).eq("status", "done")).order("desc").first();
}
export async function assertNoEmployeeTransfer(ctx: ReadCtx, employeeId: Id<"employees">): Promise<void> {
  if (await employeeTransfer(ctx, employeeId)) transferError("TRANSFER_IN_PROGRESS", "Bu kişinin proje taşıması sürüyor. Taşımayı tamamlayın veya önce iptal edin.");
}
export async function transferTargets(ctx: ReadCtx, transferId: Id<"accessTransfers">): Promise<Doc<"accessTransferTargets">[]> {
  return transferBound(await ctx.db.query("accessTransferTargets").withIndex("by_transfer_state", q => q.eq("transferId", transferId)).take(TRANSFER_LIMIT + 1));
}

export function operationPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export const TRANSFER_INVALID_OPERATION = "Taşıma başladı: geçersiz";
export function isTransferAddition(op: { operation?: string; opType?: string }): boolean {
  return op.opType === "upsertUser" || ["addPerson", "updatePerson", "addCard", "addFace", "addFingerprint"].includes(op.operation ?? "");
}
export function transferOperationBelongsTo(op: { payload: unknown; opType?: string; idempotencyKey?: string }, employee: Doc<"employees">): boolean {
  const payload = operationPayload(op.payload);
  if (typeof payload.employeeId === "string") return payload.employeeId === employee._id;
  if (op.opType) {
    const key = cardNumericKey(employee.cardNumber);
    const identity = payload.ideUserId ?? operationPayload(payload.userRecord).id;
    const prefix = `${op.idempotencyKey?.split(":upsertUser:")[0]}:upsertUser:user:${key}`;
    return key !== null && (String(identity) === key || op.idempotencyKey === prefix || op.idempotencyKey?.startsWith(`${prefix}:`) === true);
  }
  return (payload.cardNumber ?? payload.employeeNo) === employee.cardNumber;
}

/** Only transfers block additions here; inactive visitors/ordinary lifecycle flows retain their policy. */
export async function transferBlocksAddition(ctx: ReadCtx, op: { deviceId: Id<"devices">; payload: unknown; operation?: string; opType?: string }): Promise<boolean> {
  if (!isTransferAddition(op)) return false;
  const payload = operationPayload(op.payload);
  const id = typeof payload.employeeId === "string" ? ctx.db.normalizeId("employees", payload.employeeId) : null;
  if (id) {
    const employee = await ctx.db.get(id);
    if (employee?.terminationType === "transfer") return true;
    const transfer = await employeeTransfer(ctx, id);
    return transfer?.employeeId === id;
  }
  // Legacy jobs may identify the credential without employeeId, including numeric IDE IDs.
  const identity = op.opType ? payload.ideUserId ?? operationPayload(payload.userRecord).id : payload.cardNumber ?? payload.employeeNo;
  if (identity === undefined) return false;
  const owners = await ctx.db.query("employees").withIndex("by_card", q => q.eq("cardNumber", String(identity))).take(TRANSFER_LIMIT + 1);
  if (owners.length > TRANSFER_LIMIT) return true;
  for (const employee of owners) {
    const transfer = await employeeTransfer(ctx, employee._id);
    if (employee.terminationType === "transfer" || transfer?.employeeId === employee._id) return true;
  }
  const targets: Doc<"accessTransferTargets">[] = [];
  for (const state of ["pending", "failed", "superseded"] as const) {
    const rows = await ctx.db.query("accessTransferTargets").withIndex("by_device_state", q => q.eq("deviceId", op.deviceId).eq("state", state)).take(TRANSFER_LIMIT + 1 - targets.length);
    targets.push(...rows);
    // Poll/retry must skip an ambiguous legacy job, never abort the whole batch.
    if (targets.length > TRANSFER_LIMIT) return true;
  }
  for (const target of targets) {
    const transfer = await ctx.db.get(target.transferId);
    if (!transfer || transfer.status === "cancelled") continue;
    const matches = op.opType ? String(identity) === cardNumericKey(transfer.cardNumber) : identity === transfer.cardNumber;
    if (matches && (transferIsActive(transfer) || (await ctx.db.get(transfer.employeeId))?.terminationType === "transfer")) return true;
  }
  return false;
}

export async function advanceTransfer(ctx: MutationCtx, transferId: Id<"accessTransfers">): Promise<void> {
  const transfer = await ctx.db.get(transferId);
  if (!transfer || !["requested", "revoking", "stuck"].includes(transfer.status)) return;
  const targets = await transferTargets(ctx, transferId);
  if (targets.some(target => target.state !== "confirmed" && target.state !== "deviceRemoved")) return;
  await ctx.db.patch(transferId, { status: "revoked", stuckReason: undefined, lastError: undefined });
  await ctx.scheduler.runAfter(0, internal.employeeTermination.completeTransfer, { transferId });
}

export async function updateTransferTarget(ctx: MutationCtx, employeeId: Id<"employees">, deviceId: Id<"devices">, state: "confirmed" | "failed" | "superseded", lastError?: string): Promise<void> {
  const rows = transferBound(await ctx.db.query("accessTransferTargets").withIndex("by_employee_device", q => q.eq("employeeId", employeeId).eq("deviceId", deviceId)).take(TRANSFER_LIMIT + 1));
  for (const row of rows) {
    const transfer = await ctx.db.get(row.transferId);
    if (!transfer || (!transferIsActive(transfer) && !(transfer.status === "done" && state !== "superseded")) || row.state === "confirmed" || row.state === "deviceRemoved") continue;
    if (row.state === "superseded" && state === "failed") continue;
    // A later failure/supersede cannot undo a positive physical acknowledgement.
    await ctx.db.patch(row._id, { state, lastError: state === "confirmed" ? undefined : lastError?.slice(0, 2000), confirmedAt: state === "confirmed" ? Date.now() : undefined, updatedAt: Date.now() });
    if (state === "superseded") await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "Silme işi başka bir işlem tarafından geçersiz kılındı. Taşımayı iptal edin veya cihazı kaynak projeden kaldırın.", lastError });
    if (state === "confirmed") await advanceTransfer(ctx, transfer._id);
  }
}
export async function transferOperationFailed(ctx: MutationCtx, op: { payload: unknown; deviceId: Id<"devices"> }, reason: string, state: "failed" | "superseded" = "failed"): Promise<void> {
  const payload = operationPayload(op.payload);
  const employeeId = typeof payload.employeeId === "string" ? ctx.db.normalizeId("employees", payload.employeeId) : null;
  if (!employeeId) return;
  const transfer = await sourceTransfer(ctx, await ctx.db.get(employeeId));
  if (!transfer) return;
  const sameCredential = payload.ideUserId !== undefined
    ? String(payload.ideUserId) === cardNumericKey(transfer.cardNumber)
    : (payload.cardNumber ?? payload.employeeNo) === transfer.cardNumber;
  if (sameCredential) await updateTransferTarget(ctx, employeeId, op.deviceId, state, reason);
}

/** Device deletion/reassignment closes only targets belonging to its old source project. */
export async function transferDeviceRemoved(ctx: MutationCtx & { user?: Doc<"users"> }, deviceId: Id<"devices">, projectId: Id<"projects"> | undefined): Promise<void> {
  for (const state of ["pending", "failed", "superseded"] as const) {
    const rows = transferBound(await ctx.db.query("accessTransferTargets").withIndex("by_device_state", q => q.eq("deviceId", deviceId).eq("state", state)).take(TRANSFER_LIMIT + 1));
    for (const row of rows) {
      const transfer = await ctx.db.get(row.transferId);
      if (!transfer || !transferIsActive(transfer) || transfer.sourceProjectId !== projectId) continue;
      await ctx.db.patch(row._id, { state: "deviceRemoved", updatedAt: Date.now(), lastError: undefined });
      await writeAudit(ctx, { user: ctx.user ?? null, projectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId, state: "deviceRemoved" }, note: "Taşıma hedefi kapandı: cihaz kaynak projeden kaldırıldı" });
      await advanceTransfer(ctx, transfer._id);
    }
  }
}

/** Explicit identity wins; only legacy payloads fall back to creation time. */
export function deletionMatchesTransfer(op: { payload: unknown; _creationTime?: number }, transfer: Doc<"accessTransfers">): boolean {
  const transferId = operationPayload(op.payload).transferId;
  return transferId !== undefined ? transferId === transfer._id : op._creationTime !== undefined && op._creationTime >= transfer.requestedAt;
}
