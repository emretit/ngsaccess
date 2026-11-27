import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { hikPersonIdentity } from "./lib/hikPersonIdentity";
import { cardNumberError } from "./lib/cardNumberRules";
import { requirePermission } from "./lib/permissions";

type DeliveryState = "delivered" | "pending" | "failed" | "missing";
const payloadOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};

/** Drawer-only read: all graph/history reads have a shared, explicit budget. */
export const getForEmployee = authedQuery({
  args: { employeeId: v.id("employees"), projectId: v.id("projects") },
  handler: async (ctx, { employeeId, projectId }) => {
    await requirePermission(ctx, ctx.user, projectId, "employees.view");
    const employee = await ctx.db.get(employeeId);
    if (!employee || employee.projectId !== projectId) throw new Error("Kişi bu projede bulunamadı.");
    let incomplete = false;
    const members = await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", employeeId)).take(21);
    incomplete ||= members.length > 20;
    const targetIds = new Set<Id<"devices">>();
    let budget = 200;
    for (const ruleId of new Set(members.slice(0, 20).map(member => member.groupId))) {
      const rule = await ctx.db.get(ruleId);
      if (!rule?.isActive || rule.projectId !== projectId) continue;
      if (budget === 0) { incomplete = true; break; }
      const links = await ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", rule._id)).take(budget + 1);
      incomplete ||= links.length > budget;
      for (const link of links.slice(0, budget)) targetIds.add(link.deviceId);
      budget -= Math.min(links.length, budget);
      if (budget === 0) { incomplete = true; break; }
      const doors = await ctx.db.query("groupDoors").withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", rule._id)).take(budget + 1);
      incomplete ||= doors.length > budget;
      for (const link of doors.slice(0, budget)) {
        const door = await ctx.db.get(link.doorId);
        if (door?.projectId === projectId && door.deviceId) targetIds.add(door.deviceId);
      }
      budget -= Math.min(doors.length, budget);
    }
    const grants = await ctx.db.query("accessGrantStatus").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", employeeId)).take(101);
    incomplete ||= grants.length > 100;
    const pages = await Promise.all((["addPerson", "updatePerson", "addCard"] as const).map(operation => ctx.db.query("hikPendingOperations").withIndex("by_employee_operation", q => q.eq("employeeId", employeeId).eq("operation", operation)).order("desc").take(101)));
    incomplete ||= pages.some(rows => rows.length > 100);
    // Legacy/early rejections store employeeId only in the payload, not the index field.
    const failures = await ctx.db.query("hikPendingOperations").withIndex("by_project_status_created", q => q.eq("projectId", projectId).eq("status", "failed")).order("desc").take(101);
    incomplete ||= failures.length > 100;
    const operations = [...new Map([...pages.flatMap(rows => rows.slice(0, 100)), ...failures.slice(0, 100).filter(row => payloadOf(row.payload).employeeId === employeeId && ["addPerson", "updatePerson", "addCard"].includes(row.operation))].map(row => [row._id, row])).values()].filter(row => row.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
    const ids = new Set([...targetIds, ...grants.slice(0, 100).map(row => row.deviceId), ...operations.map(row => row.deviceId)]);
    incomplete ||= ids.size > 50;
    const devices = [];
    for (const deviceId of [...ids].slice(0, 50)) {
      const device = await ctx.db.get(deviceId);
      if (!device || device.projectId !== projectId || !["hikvision", "ide_smart"].includes(device.brand ?? "")) continue;
      const target = targetIds.has(deviceId) && device.isActive !== false && employee.isActive !== false && employee.terminationType !== "transfer";
      const grant = grants.find(row => row.deviceId === deviceId);
      const changedAt = employee.deviceSyncUpdatedAt ?? (Date.parse(employee.updatedAt ?? "") || employee._creationTime);
      const matchesIdentity = (payload: Record<string, unknown>) => payload.cardNumber !== undefined
        ? payload.cardNumber === employee.cardNumber && (payload.employeeNo === undefined || payload.employeeNo === hikPersonIdentity(employee))
        : payload.employeeNo === hikPersonIdentity(employee) && payload.employeeNo !== undefined;
      const freshGrant = grant && grant.updatedAt >= changedAt;
      let state: DeliveryState = freshGrant && grant.state === "effective" ? "delivered" : freshGrant && grant.state === "pending" ? "pending" : freshGrant && grant.state === "failed" ? "failed" : "missing";
      let lastAttemptAt: number | null = null;
      let retry: { source: "hikvision"; id: Id<"hikPendingOperations"> } | { source: "ide"; id: Id<"idePendingOperations"> } | null = null;
      let lastResultAt = freshGrant ? grant.updatedAt : null;
      const rejection = operations.find(op => {
        const payload = payloadOf(op.payload);
        return op.deviceId === deviceId && op.status === "failed" && op.createdAt >= changedAt && (matchesIdentity(payload) || (payload.cardNumber === undefined && payload.employeeNo === undefined && payload.employeeId === employeeId));
      });
      if (rejection && (!freshGrant || rejection.createdAt > grant.updatedAt)) {
        state = "failed";
        lastResultAt = rejection.createdAt;
      }
      if (device.brand === "hikvision") {
        const row = operations.find(op => {
          const payload = payloadOf(op.payload);
          return op.deviceId === deviceId && op.createdAt >= changedAt && matchesIdentity(payload);
        });
        if (row) {
          lastAttemptAt = row.processingStartedAt ?? null;
          if (!lastResultAt || row.createdAt > lastResultAt) lastResultAt = row.completedAt ?? row.createdAt;
          // A single person/card ACK cannot prove that the full credential was delivered.
          if (!freshGrant || row.createdAt > grant.updatedAt) state = row.status === "failed" || row.dismissedAt !== undefined ? "failed" : row.status === "done" ? "missing" : "pending";
          if (target && state === "failed" && row.status === "failed" && payloadOf(row.payload).mobileOperationId === undefined) retry = { source: "hikvision", id: row._id };
        }
      } else if (grant?.lastOperationId) {
        const id = ctx.db.normalizeId("idePendingOperations", grant.lastOperationId);
        const row: Doc<"idePendingOperations"> | null = id ? await ctx.db.get(id) : null;
        const payload = payloadOf(row?.payload);
        const user = payloadOf(payload.userRecord);
        if (row?.projectId === projectId && row.deviceId === deviceId && row.opType === "upsertUser" && payload.employeeId === employeeId && String(user.id) === String(Number(employee.cardNumber)) && row.createdAt >= changedAt) {
          lastAttemptAt = row.sentAt ?? null;
          lastResultAt = row.ackedAt ?? row.createdAt;
          state = row.status === "failed" || payload.grantError ? "failed" : row.status === "acked" ? "delivered" : "pending";
          if (target && row.status === "failed" && payload.errorCode !== "door_io_unresolved" && payload.mobileOperationId === undefined) retry = { source: "ide", id: row._id };
        }
      }
      if (device.brand === "ide_smart" && !employee.hikCardless && cardNumberError(employee.cardNumber, { deviceBrand: "ide_smart" })) {
        const invalid = await ctx.db.query("idePendingOperations").withIndex("by_idempotency", q => q.eq("idempotencyKey", `${deviceId}:invalidCard:${employeeId}`)).order("desc").first();
        if (invalid?.projectId === projectId && invalid.deviceId === deviceId && invalid.status === "failed" && payloadOf(invalid.payload).employeeId === employeeId && payloadOf(invalid.payload).errorCode === "card_invalid" && invalid.createdAt >= changedAt && (lastResultAt === null || invalid.createdAt >= lastResultAt)) {
          state = "failed";
          lastResultAt = invalid.createdAt;
          retry = null; // Rejected credentials must be corrected before delivery.
        }
      }
      devices.push({ deviceId, name: device.name, target, state, lastAttemptAt, lastResultAt, retry });
    }
    return { devices, incomplete, hasCard: !!employee.cardNumber.trim() && !employee.hikCardless };
  },
});
