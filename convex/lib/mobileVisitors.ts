import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { visitorStatus, visitorTime, visitorTimeISO } from "./visitorStatus";
import { visitorPresence, visitorIdeCardError } from "./visitorPresence";
import { resolveEmployeeIdeDeviceIds, resolveRuleIdeDeviceIds } from "./accessGraph";

export function visitorError(code: "ACCESS_DENIED" | "VISITOR_INVALID" | "VISITOR_LOCKED" | "VISITOR_NOTICE_CHANGED" | "REQUEST_CONFLICT") {
  return new ConvexError({ code });
}

export function hostProject(employee: Doc<"employees">): Id<"projects"> {
  if (!employee.projectId || employee.isVisitor === true) throw visitorError("ACCESS_DENIED");
  return employee.projectId;
}

export async function ownInvitation(ctx: QueryCtx | MutationCtx, host: Doc<"employees">, id: Id<"employees">) {
  const projectId = hostProject(host);
  const visitor = await ctx.db.get(id);
  if (!visitor || visitor.projectId !== projectId || visitor.hostEmployeeId !== host._id ||
      visitor.isVisitor !== true || !visitor.mobileVisitorRequestId) throw visitorError("ACCESS_DENIED");
  return visitor;
}

export function editableInvitation(visitor: Doc<"employees">) {
  return visitor.isActive === false && visitor.visitorStatus === "preRegistered" &&
    visitor.cardNumber.startsWith("PRE:") && !visitor.accessRuleId;
}

export const invitationFields = {
  firstName: 80, lastName: 80, visitPurpose: 500,
} as const;

export interface InvitationInput {
  firstName: string;
  lastName: string;
  visitorPhone?: string | null;
  notes?: string | null;
  visitPurpose: string;
  visitStart: string;
  visitEnd: string;
}

export function normalizedInvitation(input: InvitationInput, now = Date.now()) {
  const fields = {
    firstName: input.firstName.trim(), lastName: input.lastName.trim(),
    visitPurpose: input.visitPurpose.trim(),
  };
  for (const [key, limit] of Object.entries(invitationFields)) {
    const value = fields[key as keyof typeof fields];
    if (!value || value.length > limit || Array.from(value).some(char => (char.charCodeAt(0) < 32 && !(key === "visitPurpose" && [9, 10, 13].includes(char.charCodeAt(0)))) || char.charCodeAt(0) === 127)) throw visitorError("VISITOR_INVALID");
  }
  // Mobile dates must identify instants explicitly, never ambiguous local clocks.
  const explicit = /(?:Z|[+-]\d{2}:\d{2})$/;
  const start = visitorTime(input.visitStart);
  const end = visitorTime(input.visitEnd);
  if (!explicit.test(input.visitStart) || !explicit.test(input.visitEnd) || !Number.isFinite(start) ||
      !Number.isFinite(end) || end <= now || end <= start || end - start > 31 * 86400000) {
    throw visitorError("VISITOR_INVALID");
  }
  const optionalField = (value: string | null | undefined, limit: number, multiline: boolean) => {
    const normalized = value?.trim() || undefined;
    if (normalized && (normalized.length > limit || Array.from(normalized).some(char =>
      (char.charCodeAt(0) < 32 && !(multiline && [9, 10, 13].includes(char.charCodeAt(0)))) || char.charCodeAt(0) === 127))) throw visitorError("VISITOR_INVALID");
    return normalized;
  };
  return { ...fields, visitorPhone: optionalField(input.visitorPhone, 40, false), notes: optionalField(input.notes, 1000, true), accessStartsAt: new Date(start).toISOString(), accessExpiresAt: new Date(end).toISOString() };
}

export async function projectNotice(ctx: QueryCtx | MutationCtx, projectId: Id<"projects">) {
  const row = await ctx.db.query("projectPrivacySettings").withIndex("by_project", q => q.eq("projectId", projectId)).first();
  const url = row?.visitorKvkkUrl?.trim();
  const version = row?.visitorKvkkVersion?.trim();
  return { url: url && /^https?:\/\//i.test(url) && version ? url : null,
    version: url && /^https?:\/\//i.test(url) && version ? version : null };
}

export function invitationRow(visitor: Doc<"employees">, now = Date.now()) {
  return {
    id: visitor._id, firstName: visitor.firstName, lastName: visitor.lastName,
    visitStart: visitorTimeISO(visitor.accessStartsAt), visitEnd: visitorTimeISO(visitor.accessExpiresAt),
    status: visitorStatus(visitor, now), canEdit: editableInvitation(visitor),
  };
}

export async function invitationDetail(ctx: QueryCtx | MutationCtx, visitor: Doc<"employees">) {
  const latest = await ctx.db.query("cardReadings")
    .withIndex("by_employee_status_time", q => q.eq("employeeId", visitor._id).eq("accessStatus", "izin_verildi"))
    .order("desc").first();
  const simultaneous = latest?.projectId === visitor.projectId && latest ? await ctx.db.query("cardReadings")
    .withIndex("by_employee_status_time", q => q.eq("employeeId", visitor._id).eq("accessStatus", "izin_verildi").eq("accessTime", latest.accessTime))
    .take(51) : [];
  const presence = visitorPresence(simultaneous.length > 50 ? [] : simultaneous.filter(row => row.projectId === visitor.projectId));
  return { ...invitationRow(visitor), visitorPhone: visitor.visitorPhone ?? null, notes: visitor.notes ?? null, visitPurpose: visitor.visitPurpose ?? "",
    presence: presence.presence, lastSeenAt: presence.lastReadingAt,
    sync: await visitorSyncEvidence(ctx, visitor),
    noticeUrl: visitor.mobileVisitorNoticeUrl ?? null, noticeVersion: visitor.mobileVisitorNoticeVersion ?? null };
}


/** Check actual preset and existing employee targets before writing or queuing.
 * Other transports keep their current card spelling and validation semantics.
 */
export async function validateVisitorPresetCard(
  ctx: MutationCtx,
  projectId: Id<"projects"> | undefined,
  ruleId: Id<"accessRules"> | undefined,
  cardNumber: string,
  employeeId?: Id<"employees">,
) {
  const selectedPanels = ruleId ? await resolveRuleIdeDeviceIds(ctx, ruleId, projectId) : [];
  const existingPanels = employeeId ? await resolveEmployeeIdeDeviceIds(ctx, employeeId, projectId) : [];
  if (selectedPanels.length === 0 && existingPanels.length === 0) return;
  const error = visitorIdeCardError(cardNumber);
  if (error) throw new Error(error);
}

export type MobileVisitorStatus = ReturnType<typeof visitorStatus>;
export const MOBILE_VISITOR_SUMMARY_LIMIT = 1000;

export function normalizeVisitorSearch(search: string | undefined) {
  const value = (search ?? "").trim().toLocaleLowerCase("tr");
  if (value.length > 80) throw visitorError("VISITOR_INVALID");
  return value;
}

export function mobileVisitorMatches(visitor: Doc<"employees">, search: string, status: MobileVisitorStatus | undefined, now: number) {
  return Boolean(visitor.mobileVisitorRequestId) && (!status || visitorStatus(visitor, now) === status) &&
    (!search || `${visitor.firstName} ${visitor.lastName}`.toLocaleLowerCase("tr").includes(search));
}

interface BoundVisitorCursor {
  cursor: string | null;
  evaluatedAt: number;
}

export function decodeVisitorCursor(value: string | null, host: Doc<"employees">, search: string, status?: MobileVisitorStatus): BoundVisitorCursor {
  if (value === null) return { cursor: null, evaluatedAt: Date.now() };
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw visitorError("VISITOR_INVALID"); }
  if (typeof parsed !== "object" || parsed === null || !("version" in parsed) || parsed.version !== 1 ||
      !("host" in parsed) || parsed.host !== host._id || !("project" in parsed) || parsed.project !== host.projectId ||
      !("search" in parsed) || parsed.search !== search || !("status" in parsed) || parsed.status !== (status ?? null) ||
      !("cursor" in parsed) || typeof parsed.cursor !== "string" ||
      !("evaluatedAt" in parsed) || typeof parsed.evaluatedAt !== "number" || !Number.isFinite(parsed.evaluatedAt) ||
      parsed.evaluatedAt > Date.now() + 5000 || parsed.evaluatedAt < Date.now() - 15 * 60000) throw visitorError("VISITOR_INVALID");
  return { cursor: parsed.cursor, evaluatedAt: parsed.evaluatedAt };
}

export function encodeVisitorCursor(cursor: string, host: Doc<"employees">, search: string, status: MobileVisitorStatus | undefined, evaluatedAt: number) {
  return JSON.stringify({ version: 1, host: host._id, project: host.projectId, search, status: status ?? null, evaluatedAt, cursor });
}

export type VisitorSyncStatus = "pending" | "applied" | "failed" | "unknown";
export interface VisitorSyncEvidence { status: VisitorSyncStatus; observedAt: number; bounded: boolean }
const SYNC_TARGET_LIMIT = 16;
const SYNC_OPERATION_LIMIT = 8;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** No queue payload, device name/ID, card, or raw failure leaves this reader. */
export async function visitorSyncEvidence(ctx: QueryCtx | MutationCtx, visitor: Doc<"employees">): Promise<VisitorSyncEvidence> {
  const observedAt = Date.now();
  const unknown = (bounded = false): VisitorSyncEvidence => ({ status: "unknown", observedAt, bounded });
  if (!visitor.projectId || visitor.cardNumber.startsWith("PRE:")) return unknown();
  const memberships = await ctx.db.query("groupMembers").withIndex("by_project_employee", q =>
    q.eq("projectId", visitor.projectId).eq("employeeId", visitor._id)).take(11);
  if (memberships.length > 10) return unknown(true);
  const targets = new Map<Id<"devices">, Doc<"devices">>();
  let incomplete = false;
  for (const membership of memberships) {
    const rule = await ctx.db.get(membership.groupId);
    if (!rule || rule.projectId !== visitor.projectId) { incomplete = true; continue; }
    if (rule.isActive === false) continue;
    const [devices, doors] = await Promise.all([
      ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", visitor.projectId).eq("groupId", rule._id)).take(SYNC_TARGET_LIMIT + 1),
      ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).take(SYNC_TARGET_LIMIT + 1),
    ]);
    if (devices.length > SYNC_TARGET_LIMIT || doors.length > SYNC_TARGET_LIMIT) return unknown(true);
    const ids = new Set(devices.map(link => link.deviceId));
    for (const link of doors) {
      const door = await ctx.db.get(link.doorId);
      if (!door || door.projectId !== visitor.projectId) { incomplete = true; continue; }
      if (door.deviceId) ids.add(door.deviceId);
    }
    for (const id of ids) {
      if (targets.has(id)) continue;
      const device = await ctx.db.get(id);
      if (!device || device.projectId !== visitor.projectId) { incomplete = true; continue; }
      if (device.isActive === false) continue;
      targets.set(id, device);
      if (targets.size > SYNC_TARGET_LIMIT) return unknown(true);
    }
  }
  if (targets.size === 0) return unknown(incomplete);
  const revision = Date.parse(visitor.updatedAt ?? visitor.createdAt ?? "");
  if (!Number.isFinite(revision)) return unknown();
  const active = visitor.isActive !== false && visitorStatus(visitor, observedAt) === "active";
  const statuses: VisitorSyncStatus[] = [];
  let bounded = incomplete;
  for (const target of targets.values()) {
    if (target.brand === "ide_smart") {
      const pages = await Promise.all((["pending", "sent", "acked", "failed"] as const).map(status =>
        ctx.db.query("idePendingOperations").withIndex("by_device_status", q => q.eq("deviceId", target._id).eq("status", status)).order("desc").take(SYNC_OPERATION_LIMIT + 1)));
      bounded ||= pages.some(rows => rows.length > SYNC_OPERATION_LIMIT);
      const matching = pages.flatMap(rows => rows.slice(0, SYNC_OPERATION_LIMIT)).filter(op => {
        if (op.projectId !== visitor.projectId || op.createdAt < revision || op.createdAt > observedAt + 5000) return false;
        const payload = record(op.payload as unknown);
        if (!payload) return false;
        if (!active) return op.opType === "deleteUser" && String(payload.ideUserId) === String(Number(visitor.cardNumber));
        const user = record(payload.userRecord);
        return op.opType === "upsertUser" && user !== null && user.status === 1 && String(user.id) === String(Number(visitor.cardNumber));
      }).sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
      const operation = matching[0];
      const operationState = (op: Doc<"idePendingOperations"> | undefined): VisitorSyncStatus => !op ? "unknown" : op.status === "failed" ? "failed" :
        op.status === "pending" || op.status === "sent" ? "pending" : op.ackedAt !== undefined && op.ackedAt >= op.createdAt ? "applied" : "unknown";
      const targetStates = [operationState(operation)];
      if (active && operation) {
        const permissions = record(record(operation.payload as unknown)?.userRecord)?.permissions;
        if (!Array.isArray(permissions) || permissions.length === 0 || permissions.length > 16 ||
            !permissions.every((id: unknown) => typeof id === "number" && Number.isInteger(id) && id >= 1 && id <= 65535)) {
          targetStates.push("unknown");
        } else {
          for (const permission of permissions) {
            const permissionOperation = pages.flatMap(rows => rows.slice(0, SYNC_OPERATION_LIMIT)).filter(op =>
              op.projectId === visitor.projectId && op.createdAt >= revision && op.createdAt <= observedAt + 5000 &&
              op.opType === "upsertPermission" && record(record(op.payload as unknown)?.permissionRecord)?.id === permission)
              .sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime)[0];
            targetStates.push(operationState(permissionOperation));
          }
        }
      }
      statuses.push(targetStates.includes("failed") ? "failed" : targetStates.includes("pending") ? "pending" :
        targetStates.every(state => state === "applied") ? "applied" : "unknown");
    } else if (target.brand === "hikvision") {
      const pages = await Promise.all((["pending", "processing", "done", "failed"] as const).map(status =>
        ctx.db.query("hikPendingOperations").withIndex("by_device_status", q => q.eq("deviceId", target._id).eq("status", status)).order("desc").take(SYNC_OPERATION_LIMIT + 1)));
      bounded ||= pages.some(rows => rows.length > SYNC_OPERATION_LIMIT);
      const operation = pages.flatMap(rows => rows.slice(0, SYNC_OPERATION_LIMIT)).filter(op => {
        const payload = record(op.payload as unknown);
        return op.projectId === visitor.projectId && op.createdAt >= revision && op.createdAt <= observedAt + 5000 &&
          payload?.employeeId === visitor._id && (payload.cardNumber === undefined || payload.cardNumber === visitor.cardNumber) &&
          (active ? ["addPerson", "updatePerson", "addCard"].includes(op.operation) : ["deletePerson", "deleteCard"].includes(op.operation));
      }).sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime)[0];
      // The existing Hikvision pipeline's done means sent, not device verified.
      statuses.push(!operation ? "unknown" : operation.status === "failed" ? "failed" : operation.status === "done" ? "unknown" : "pending");
    } else statuses.push("unknown");
  }
  const status: VisitorSyncStatus = statuses.includes("failed") ? "failed" : statuses.includes("pending") ? "pending" :
    !bounded && statuses.length > 0 && statuses.every(value => value === "applied") ? "applied" : "unknown";
  return { status, observedAt, bounded };
}
