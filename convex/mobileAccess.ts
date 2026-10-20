import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";
import { employeeAuthedQuery } from "./lib/customFunctions";
import { accessError, listMobileTargets, resolveMobileTarget, MOBILE_COMMAND_TTL_MS, mobileOperationAllowed } from "./lib/mobileAccess";
import { getCurrentEmployee } from "./lib/employeeAuth";
import { scheduleBridgeWakeForProject } from "./hikBridge";

export type OperationResult = {
  operationId: string;
  status: "pending" | "sent" | "confirmed" | "failed" | "unknown";
  deviceId: Id<"devices">;
  doorId?: Id<"doors">;
  deviceName: string;
  requestedAt: string;
  errorCode?: string;
};
const OPERATION_LIFETIME_MS = MOBILE_COMMAND_TTL_MS;

export const listTargets = employeeAuthedQuery({
  args: {},
  handler: async ctx => await listMobileTargets(ctx, ctx.employee),
});

async function operationResult(ctx: QueryCtx, row: Doc<"mobileAccessOperations">): Promise<OperationResult> {
  let status = row.status;
  let errorCode = row.errorCode;
  const now = Date.now();
  if (row.ideOperationId) {
    const command = await ctx.db.get(row.ideOperationId);
    status = !command ? "unknown" : command.status === "acked" ? "confirmed"
      : command.status === "failed" ? command.attempts > 0 ? "unknown" : "failed"
      : command.status;
  }
  if (row.hikOperationId) {
    const command = await ctx.db.get(row.hikOperationId);
    status = !command ? "unknown" : command.status === "done" ? "confirmed"
      : command.status === "processing" ? "sent"
      : command.status === "failed" ? command.attemptCount > 0 ? "unknown" : "failed" : "pending";
  }
  if ((status === "pending" || status === "sent") && now - Date.parse(row.requestedAt) >= OPERATION_LIFETIME_MS) {
    status = status === "sent" ? "unknown" : "failed";
    errorCode = status === "unknown" ? "COMMAND_OUTCOME_UNKNOWN" : "COMMAND_EXPIRED";
  }
  if (status === "unknown") errorCode ??= "COMMAND_OUTCOME_UNKNOWN";
  if (status === "failed") errorCode ??= "COMMAND_FAILED";
  return {
    operationId: row._id, status, deviceId: row.deviceId, ...(row.doorId ? { doorId: row.doorId } : {}),
    deviceName: row.deviceName, requestedAt: row.requestedAt, ...(errorCode ? { errorCode } : {}),
  };
}

/** Atomic request binding + actual transport queue. This never writes attendance. */
export const requestOpen = mutation({
  args: { sessionToken: v.string(), requestId: v.string(), deviceId: v.id("devices"), doorId: v.optional(v.id("doors")) },
  handler: async (ctx, args): Promise<OperationResult> => {
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(args.requestId)) throw accessError("INVALID_REQUEST_ID");
    const employee = await getCurrentEmployee(ctx, args.sessionToken);
    const session = await ctx.db.query("employeeSessions").withIndex("by_token", q => q.eq("token", args.sessionToken)).first();
    if (!session) throw accessError("SESSION_INVALID");
    const existing = await ctx.db.query("mobileAccessOperations")
      .withIndex("by_employeeId_and_requestId", q => q.eq("employeeId", employee._id).eq("requestId", args.requestId)).unique();
    if (existing) {
      // Compare caller intent before policy lookup: an old request never resurrects or changes targets.
      if (existing.projectId !== employee.projectId || existing.deviceId !== args.deviceId || existing.doorId !== args.doorId) {
        throw accessError("REQUEST_TARGET_MISMATCH");
      }
      return await operationResult(ctx, existing);
    }
    const target = await resolveMobileTarget(ctx, employee, args.deviceId, args.doorId);
    if (!employee.projectId || target.transport === "unsupported") throw accessError("TARGET_NOT_ALLOWED");
    // Optional door omission is only permitted for a true standalone target. Persist the exact target selected.
    if (target.doorId && !args.doorId) throw accessError("DOOR_REQUIRED");
    const now = Date.now();
    const operationId = await ctx.db.insert("mobileAccessOperations", {
      projectId: employee.projectId, employeeId: employee._id, requestId: args.requestId,
      sessionId: session._id, authVersion: session.passwordVersion ?? 0,
      deviceId: target.deviceId, ...(target.doorId ? { doorId: target.doorId } : {}),
      deviceName: target.name, requestedAt: new Date(now).toISOString(), status: "pending",
      transport: target.transport, actuator: target.actuator,
    });
    const device = await ctx.db.get(target.deviceId);
    if (!device) throw accessError("TARGET_NOT_ALLOWED");
    if (target.transport === "ide_mqtt") {
      const ideOperationId = await ctx.db.insert("idePendingOperations", {
        projectId: employee.projectId, deviceId: device._id, opType: "openDoor",
        payload: { dstId: device.ideUuid, ioId: target.actuator, keep: 1, mobileOperationId: operationId },
        idempotencyKey: `mobile:${operationId}`, status: "pending", attempts: 0, maxAttempts: 1, nextRetryAt: now, createdAt: now,
      });
      await ctx.db.patch(operationId, { ideOperationId });
    } else if (target.transport === "hik_local_bridge") {
      const hikOperationId = await ctx.db.insert("hikPendingOperations", {
        projectId: employee.projectId, deviceId: device._id, operation: "openDoor",
        payload: { doorNo: target.actuator, mobileOperationId: operationId },
        status: "pending", attemptCount: 0, nextRetryAt: now, createdAt: now,
      });
      await ctx.db.patch(operationId, { hikOperationId });
      await scheduleBridgeWakeForProject(ctx, employee.projectId);
    } else {
      await ctx.scheduler.runAfter(0, internal.mobileAccessGateway.send, { operationId });
    }
    await ctx.scheduler.runAfter(MOBILE_COMMAND_TTL_MS, internal.mobileAccess.expireQueue, { operationId });
    return { operationId, status: "pending", deviceId: target.deviceId,
      ...(target.doorId ? { doorId: target.doorId } : {}), deviceName: target.name, requestedAt: new Date(now).toISOString() };
  },
});

export const getOperation = employeeAuthedQuery({
  args: { operationId: v.string() },
  handler: async (ctx, { operationId }): Promise<OperationResult> => {
    const id = ctx.db.normalizeId("mobileAccessOperations", operationId);
    const row = id ? await ctx.db.get(id) : null;
    if (!row || row.employeeId !== ctx.employee._id || !ctx.employee.projectId || row.projectId !== ctx.employee.projectId) {
      throw accessError("OPERATION_NOT_FOUND");
    }
    return await operationResult(ctx, row);
  },
});

export const getRequestOperation = employeeAuthedQuery({
  args: { requestId: v.string() },
  handler: async (ctx, { requestId }): Promise<OperationResult | null> => {
    const row = await ctx.db.query("mobileAccessOperations")
      .withIndex("by_employeeId_and_requestId", q => q.eq("employeeId", ctx.employee._id).eq("requestId", requestId)).unique();
    if (!row || row.projectId !== ctx.employee.projectId) return null;
    return await operationResult(ctx, row);
  },
});

/** A scheduled gateway action has no employee session: re-derive its owner from the bound record. */
export const claimGateway = internalMutation({
  args: { operationId: v.id("mobileAccessOperations") },
  handler: async (ctx, { operationId }): Promise<{ devIndex: string; actuator: number } | null> => {
    const row = await ctx.db.get(operationId);
    if (!row || row.transport !== "hik_gateway" || row.status !== "pending") return null;
    if (!(await mobileOperationAllowed(ctx, row))) {
      await ctx.db.patch(row._id, { status: "failed", errorCode: "TARGET_NOT_ALLOWED" });
      return null;
    }
    const device = await ctx.db.get(row.deviceId);
    if (!device?.hikDevIndex) return null;
    // Commit before external I/O. A repeated action cannot send twice, even if the previous action crashed.
    await ctx.db.patch(row._id, { status: "sent" });
    return { devIndex: device.hikDevIndex, actuator: row.actuator };
  },
});

export const finishGateway = internalMutation({
  args: { operationId: v.id("mobileAccessOperations"), status: v.union(v.literal("confirmed"), v.literal("unknown")) },
  handler: async (ctx, args): Promise<null> => {
    const row = await ctx.db.get(args.operationId);
    if (row?.transport === "hik_gateway" && row.status === "sent") {
      await ctx.db.patch(row._id, { status: args.status, ...(args.status === "unknown" ? { errorCode: "COMMAND_OUTCOME_UNKNOWN" } : {}) });
    }
    return null;
  },
});

/** Persist expiry of unclaimed commands even while bridges are offline. Never retries. */
export const expireQueue = internalMutation({
  args: { operationId: v.id("mobileAccessOperations") },
  handler: async (ctx, { operationId }): Promise<null> => {
    const row = await ctx.db.get(operationId);
    if (!row || row.status !== "pending" || Date.now() - Date.parse(row.requestedAt) < MOBILE_COMMAND_TTL_MS) return null;
    let unsent = row.transport === "hik_gateway";
    if (row.ideOperationId) {
      const command = await ctx.db.get(row.ideOperationId);
      if (command?.status === "pending") {
        await ctx.db.patch(command._id, { status: "failed", lastError: "COMMAND_EXPIRED" });
        unsent = true;
      }
    }
    if (row.hikOperationId) {
      const command = await ctx.db.get(row.hikOperationId);
      if (command?.status === "pending") {
        await ctx.db.patch(command._id, { status: "failed", lastError: "COMMAND_EXPIRED" });
        unsent = true;
      }
    }
    if (unsent) await ctx.db.patch(row._id, { status: "failed", errorCode: "COMMAND_EXPIRED" });
    return null;
  },
});
