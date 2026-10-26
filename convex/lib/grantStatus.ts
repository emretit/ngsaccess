import { effectiveSchedule, toIdePermissionSegments } from "./accessSchedule";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const grantState = v.union(v.literal("pending"), v.literal("effective"), v.literal("failed"), v.literal("removed"));
export type GrantState = Doc<"accessGrantStatus">["state"];
export const GRANT_LIMIT = 1000;
export function bounded<T>(rows: T[], limit = GRANT_LIMIT): T[] {
  if (rows.length > limit) throw new ConvexError(`Yetki okuma sınırı aşıldı (${limit}); kapsamı daraltın`);
  return rows;
}
export function grantStale(appliedAt: number | undefined, updated: (string | undefined)[]): boolean {
  return appliedAt !== undefined && updated.some(value => value !== undefined && Date.parse(value) > appliedAt);
}

/** Bounded two-leg rule scope. Live door ownership wins over the link snapshot.
 * A stale selection suppresses Hik's all-doors fallback, exactly as the sender does. */
export async function grantRuleScope(ctx: QueryCtx, rule: Doc<"accessRules">) {
  const [links, selections] = await Promise.all([
    ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", rule._id)).take(201),
    ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).take(201),
  ]);
  bounded(links, 200); bounded(selections, 200);
  const deviceIds = new Set(links.map(link => link.deviceId));
  const selected = new Map<Id<"devices">, Doc<"doors">[]>();
  let orphanSelection = false;
  for (const link of selections) {
    const door = await ctx.db.get(link.doorId);
    if (!door && !link.deviceId) orphanSelection = true;
    if (link.deviceId && link.deviceId !== door?.deviceId && !selected.has(link.deviceId)) selected.set(link.deviceId, []);
    if (!door?.deviceId || door.projectId !== rule.projectId) continue;
    deviceIds.add(door.deviceId);
    selected.set(door.deviceId, [...selected.get(door.deviceId) ?? [], door]);
  }
  const template = rule.scheduleTemplateId ? await ctx.db.get(rule.scheduleTemplateId) : null;
  const hasSegments = toIdePermissionSegments(effectiveSchedule(rule, template)).length > 0;
  const scopes = [];
  for (const deviceId of deviceIds) {
    const device = await ctx.db.get(deviceId);
    if (!device || device.projectId !== rule.projectId || !device.isActive) continue;
    if (device.brand !== "hikvision" && device.brand !== "ide_smart") continue;
    const doors = bounded(await ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", deviceId)).take(201), 200)
      .filter(door => door.projectId === rule.projectId);
    const chosen = selected.get(deviceId);
    // Match ruleIoIdsForPanel: an explicit selection never widens to other doors.
    const ideCandidates = chosen ?? (orphanSelection ? [] : doors);
    const ioIds = new Set(ideCandidates.flatMap(door => typeof door.ioId === "number" && Number.isInteger(door.ioId) && door.ioId >= 0 && door.ioId <= 7 ? [door.ioId] : []));
    const effectiveDoors = device.brand === "ide_smart"
      ? doors.filter(door => door.ioId !== undefined && ioIds.has(door.ioId))
      : chosen === undefined ? doors : chosen.filter(door => Number.isInteger(door.hikDoorNo) && (door.hikDoorNo ?? 0) >= 1 && (door.hikDoorNo ?? 0) <= Math.max(1, device.hikDoorCount ?? (device.hikTransport === "localBridge" ? 4 : 1)));
    if (device.brand === "hikvision" && chosen !== undefined && effectiveDoors.length === 0) continue;
    const errorCode = device.brand === "ide_smart" && hasSegments && !ioIds.size ? "door_io_unresolved" as const : undefined;
    scopes.push({ device, doors: effectiveDoors, errorCode });
  }
  return scopes;
}

export async function employeeGrantGraph(ctx: QueryCtx, employee: Doc<"employees">) {
  const graph = new Map<Id<"devices">, { device: Doc<"devices">; ruleIds: Id<"accessRules">[]; doors: Doc<"doors">[] }>();
  if (!employee.projectId || employee.isActive === false) return graph;
  const links = bounded(await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id)).take(101), 100);
  for (const ruleId of new Set(links.map(link => link.groupId))) {
    const rule = await ctx.db.get(ruleId);
    if (!rule?.isActive || rule.projectId !== employee.projectId) continue;
    for (const scope of await grantRuleScope(ctx, rule)) {
      const previous = graph.get(scope.device._id);
      graph.set(scope.device._id, { device: scope.device, ruleIds: [...previous?.ruleIds ?? [], ruleId], doors: [...new Map([...previous?.doors ?? [], ...scope.doors].map(door => [door._id, door])).values()] });
    }
  }
  return graph;
}

export type GrantResult = {
  projectId: Id<"projects">; employeeId: Id<"employees">; deviceId: Id<"devices">;
  state: GrantState; ruleIds?: Id<"accessRules">[]; lastError?: string; lastRunId?: Id<"deviceSyncRuns">; lastOperationId?: string;
};
/** Runs inside the caller's existing transaction; never deletes history. */
export async function upsertGrantStatus(ctx: MutationCtx, args: GrantResult) {
  const [employee, device, existing] = await Promise.all([
    ctx.db.get(args.employeeId), ctx.db.get(args.deviceId),
    ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId)).unique(),
  ]);
  if (!device || device.projectId !== args.projectId || (employee && employee.projectId !== args.projectId)) return;
  const ruleIds = args.ruleIds ?? (args.state === "pending" && employee
    ? (await employeeGrantGraph(ctx, employee)).get(args.deviceId)?.ruleIds ?? []
    : existing?.ruleIds ?? []);
  const now = Date.now();
  const value = { ...args, ruleIds: [...new Set(ruleIds)], departmentId: employee ? employee.departmentId : existing?.departmentId,
    lastError: args.state === "failed" ? (args.lastError ?? "Cihaz işlemi başarısız").slice(0, 2000) : undefined,
    appliedAt: args.state === "effective" ? now : existing?.appliedAt, updatedAt: now };
  if (existing) await ctx.db.patch(existing._id, value);
  else await ctx.db.insert("accessGrantStatus", value);
}

/** Old operations without employeeId are intentionally ignored. No extra function call. */
export async function grantStatusForOperation(ctx: MutationCtx, op: {
  deviceId: Id<"devices">; projectId?: Id<"projects">; runId?: Id<"deviceSyncRuns">; payload: unknown; _id?: string; opType?: string; operation?: string;
}, state: GrantState, lastError?: string) {
  if (!op.payload || typeof op.payload !== "object") return;
  const payload = op.payload as Record<string, unknown>;
  if (typeof payload.employeeId !== "string") return;
  const employeeId = ctx.db.normalizeId("employees", payload.employeeId);
  if (!employeeId) return;
  const deletion = op.opType === "deleteUser" || op.operation === "deletePerson" || op.operation === "deleteCard";
  if (deletion) {
    const employee = await ctx.db.get(employeeId);
    const credential = payload.ideUserId ?? payload.cardNumber ?? payload.employeeNo;
    // A returned visitor card retains the operation's old identity and owner.
    // A genuinely new card must still be protected from delayed old-card cleanup.
    const returnedSuffix = `:${employeeId}`;
    const cardNumber = employee?.cardNumber;
    const ownedCard = employee?.isVisitor && cardNumber?.startsWith("IADE:") && cardNumber.endsWith(returnedSuffix)
      ? cardNumber.slice(5, -returnedSuffix.length) : cardNumber;
    const currentCredential = typeof payload.ideUserId === "number"
      ? Number(ownedCard) : ownedCard;
    if (employee && credential !== undefined && String(credential) !== String(currentCredential)) return;
  }
  if (state !== "pending" && op._id) {
    const current = await ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", employeeId).eq("deviceId", op.deviceId)).unique();
    if (current?.lastOperationId && current.lastOperationId !== op._id) return;
  }
  const device = await ctx.db.get(op.deviceId);
  const projectId = op.projectId ?? device?.projectId;
  if (!projectId) return;
  let ruleIds = Array.isArray(payload.ruleIds) ? payload.ruleIds.flatMap((id: unknown) => {
    const normalized = typeof id === "string" ? ctx.db.normalizeId("accessRules", id) : null;
    return normalized ? [normalized] : [];
  }) : undefined;
  if (deletion && ruleIds === undefined) {
    const existing = await ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", employeeId).eq("deviceId", op.deviceId)).unique();
    ruleIds = existing?.ruleIds ?? [];
  }
  await upsertGrantStatus(ctx, { projectId, employeeId, deviceId: op.deviceId, state, ruleIds,
    lastRunId: op.runId, lastOperationId: op._id, lastError: typeof payload.grantError === "string" && state === "effective" ? payload.grantError : lastError,
    ...(typeof payload.grantError === "string" && state === "effective" ? { state: "failed", lastError: payload.grantError } : {}) });
}
