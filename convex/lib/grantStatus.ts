import { effectiveSchedule, toIdePermissionSegments } from "./accessSchedule";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { sourceTransfer, updateTransferTarget, deletionMatchesTransfer, transferBound } from "./transferGuard";
import { enqueueTransferDeletion } from "./accessTransfer";
import { writeAudit } from "./audit";

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

/** Fetch each current employee once for a bounded page/candidate batch. */
export async function grantEmployees(ctx: QueryCtx, rows: readonly { employeeId: Id<"employees"> }[]) {
  return new Map(await Promise.all([...new Set(rows.map(row => row.employeeId))].map(async id =>
    [id, await ctx.db.get(id)] as const)));
}

/** Start with current department membership; unrelated project grants use no read budget. */
export async function departmentGrantCandidates(
  ctx: QueryCtx, projectId: Id<"projects">, departmentId: Id<"departments">,
  deviceId?: Id<"devices">,
) {
  const members = await ctx.db.query("employees").withIndex("by_department", q => q.eq("departmentId", departmentId)).take(GRANT_LIMIT + 1);
  const employees = new Map(members.slice(0, GRANT_LIMIT)
    .filter(employee => employee.projectId === projectId).map(employee => [employee._id, employee] as const));
  const rows: Doc<"accessGrantStatus">[] = [];
  for (const employee of employees.values()) {
    if (deviceId) {
      const deviceRows = await ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", employee._id).eq("deviceId", deviceId)).take(GRANT_LIMIT + 1 - rows.length);
      rows.push(...deviceRows.filter(row => row.projectId === projectId));
    } else {
      rows.push(...await ctx.db.query("accessGrantStatus").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", employee._id)).take(GRANT_LIMIT + 1 - rows.length));
    }
    if (rows.length > GRANT_LIMIT) break;
  }
  return { rows: rows.slice(0, GRANT_LIMIT), employees, capped: members.length > GRANT_LIMIT || rows.length > GRANT_LIMIT };
}

export type GrantResult = {
  projectId: Id<"projects">; employeeId: Id<"employees">; deviceId: Id<"devices">;
  state: GrantState; ruleIds?: Id<"accessRules">[]; lastError?: string; lastRunId?: Id<"deviceSyncRuns">; lastOperationId?: string;
};
/** Runs inside the caller's existing transaction; never deletes history. */
export async function upsertGrantStatus(ctx: MutationCtx, args: GrantResult) {
  const transferSource = args.state === "effective" || args.state === "removed" ? await ctx.db.get(args.employeeId) : null;
  const sourceRun = await sourceTransfer(ctx, transferSource);
  if (args.state === "effective") {
    const employee = transferSource;
    const transfer = sourceRun;
    if (employee?.terminationType === "transfer" || transfer?.employeeId === args.employeeId) {
      const device = await ctx.db.get(args.deviceId);
      if (employee && transfer?.employeeId === args.employeeId && device?.projectId === transfer.sourceProjectId && args.projectId === transfer.sourceProjectId) {
        // The old source may already have released its card to the target.
        try {
          await enqueueTransferDeletion(ctx, { ...employee, cardNumber: transfer.cardNumber }, device, transfer._id);
        } catch (error) {
          // A batched grant write must not fail for one unrecoverable late write; leave evidence instead.
          await writeAudit(ctx, { user: null, projectId: transfer.sourceProjectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId: device._id, state: "failed" }, note: `Taşıma sırasında geç yazım yakalandı; silme kuyruğa alınamadı: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) });
          return;
        }
        const target = transferBound(await ctx.db.query("accessTransferTargets").withIndex("by_employee_device", q => q.eq("employeeId", args.employeeId).eq("deviceId", args.deviceId)).take(501));
        const row = target.find(row => row.transferId === transfer._id);
        if (row) await ctx.db.patch(row._id, { state: "pending", confirmedAt: undefined, updatedAt: Date.now() });
        else if (device.brand === "hikvision" || device.brand === "ide_smart") await ctx.db.insert("accessTransferTargets", { transferId: transfer._id, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
        if (transfer.status === "revoked") await ctx.db.patch(transfer._id, { status: "revoking" });
        await writeAudit(ctx, { user: null, projectId: transfer.sourceProjectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId: device._id, state: "pending" }, note: "Taşıma sırasında geç yazım yakalandı; cihaz silmesi yeniden kuyruğa alındı" });
      }
      return;
    }
  }
  if (args.state === "removed") {
    const transfer = sourceRun;
    if (transfer?.employeeId === args.employeeId) {
      // Batched gateway results have no operation identity/time. The tracked deletion
      // ACK calls this hook separately; a delayed aggregate result is not evidence.
      const operationId = args.lastOperationId;
      const id = operationId ? ctx.db.normalizeId("hikPendingOperations", operationId) ?? ctx.db.normalizeId("idePendingOperations", operationId) : null;
      const operation = id ? await ctx.db.get(id) : null;
      if (!operation || !deletionMatchesTransfer(operation, transfer)) return;
    }
  }
  const [employee, device, existing] = await Promise.all([
    args.state === "effective" || args.state === "removed" ? Promise.resolve(transferSource) : ctx.db.get(args.employeeId), ctx.db.get(args.deviceId),
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
  if (args.state === "removed") await updateTransferTarget(ctx, args.employeeId, args.deviceId, "confirmed");
}

/** Old operations without employeeId are intentionally ignored. No extra function call. */
export async function grantStatusForOperation(ctx: MutationCtx, op: {
  deviceId: Id<"devices">; projectId?: Id<"projects">; runId?: Id<"deviceSyncRuns">; payload: unknown; _id?: string; _creationTime?: number; opType?: string; operation?: string;
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
    const cardNumber = employee?.terminationType === "transfer" ? employee.cardNumber || employee.transferredCardNumber : employee?.cardNumber;
    const ownedCard = employee?.isVisitor && cardNumber?.startsWith("IADE:") && cardNumber.endsWith(returnedSuffix)
      ? cardNumber.slice(5, -returnedSuffix.length) : cardNumber;
    const currentCredential = typeof payload.ideUserId === "number"
      ? Number(ownedCard) : ownedCard;
    if (employee && credential !== undefined && String(credential) !== String(currentCredential)) return;
  }
  const transfer = deletion && state === "removed" ? await sourceTransfer(ctx, await ctx.db.get(employeeId)) : null;
  if (transfer?.employeeId === employeeId) {
    const opId = op._id ? ctx.db.normalizeId(op.opType === "deleteUser" ? "idePendingOperations" : "hikPendingOperations", op._id) : null;
    const createdAt = op._creationTime ?? (opId ? (await ctx.db.get(opId))?._creationTime : undefined);
    if (!deletionMatchesTransfer({ payload, _creationTime: createdAt }, transfer)) return;
  }
  if (state !== "pending" && op._id) {
    const current = await ctx.db.query("accessGrantStatus").withIndex("by_employee_device", q => q.eq("employeeId", employeeId).eq("deviceId", op.deviceId)).unique();
    if (current?.lastOperationId && current.lastOperationId !== op._id) {
      // A real old-card deletion ACK remains useful after the transfer was retried.
      if (!transfer || transfer.employeeId !== employeeId) return;
    }
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
