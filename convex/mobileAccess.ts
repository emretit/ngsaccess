import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { employeeAuthedQuery } from "./lib/customFunctions";
import { accessError, listMobileTargets, resolveMobileTarget, MOBILE_COMMAND_TTL_MS, mobileOperationAllowed, mobileOperationOutcome, syncVisitorDoorReading } from "./lib/mobileAccess";
import { getCurrentEmployee } from "./lib/employeeAuth";
import { dispatchDoorOpen } from "./lib/doorOpenDispatch";
import { isVirtualReader, READER_TOKEN_PATTERN } from "./lib/virtualReader";

/** Reader-scoped subscription for the asynchronous visitor door command. */
export const visitorDoorOpenStatus = query({
  args: { readerToken: v.string(), operationId: v.id("mobileAccessOperations") },
  returns: v.union(v.null(), v.object({ doorOpen: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("failed")), doorOpenMessage: v.optional(v.string()) })),
  handler: async (ctx, args) => {
    if (!READER_TOKEN_PATTERN.test(args.readerToken)) return null;
    const reader = await ctx.db.query("devices").withIndex("by_api_token", q => q.eq("apiToken", args.readerToken)).first();
    const row = await ctx.db.get(args.operationId);
    if (!reader || !isVirtualReader(reader) || reader.isActive === false || !row?.visitorPassId ||
        reader.projectId !== row.projectId || row.requestId.split(":")[2] !== reader._id) return null;
    const outcome = await mobileOperationOutcome(ctx, row);
    const doorOpen = outcome.status === "confirmed" ? "confirmed" as const
      : outcome.status === "failed" || outcome.status === "unknown" ? "failed" as const : "pending" as const;
    return { doorOpen, ...(doorOpen === "failed" ? { doorOpenMessage: "Kapı açılamadı — resepsiyona başvurun" } : {}) };
  },
});

export type OperationResult = {
  operationId: string;
  status: "pending" | "sent" | "confirmed" | "failed" | "unknown";
  deviceId: Id<"devices">;
  doorId?: Id<"doors">;
  deviceName: string;
  requestedAt: string;
  errorCode?: string;
};

export const listTargets = employeeAuthedQuery({
  args: {},
  handler: async ctx => await listMobileTargets(ctx, ctx.employee),
});

async function operationResult(ctx: QueryCtx, row: Doc<"mobileAccessOperations">): Promise<OperationResult> {
  const { status, errorCode } = await mobileOperationOutcome(ctx, row);
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
    await dispatchDoorOpen(ctx, operationId, device, target.actuator);
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
      await syncVisitorDoorReading(ctx, row._id);
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
    if (row?.transport === "hik_gateway" && (row.status === "sent" || (row.status === "unknown" && args.status === "confirmed"))) {
      await ctx.db.patch(row._id, { status: args.status, errorCode: args.status === "unknown" ? "COMMAND_OUTCOME_UNKNOWN" : undefined });
      await syncVisitorDoorReading(ctx, row._id);
    }
    return null;
  },
});

/** Persist expiry of unclaimed commands even while bridges are offline. Never retries. */
export const expireQueue = internalMutation({
  args: { operationId: v.id("mobileAccessOperations") },
  handler: async (ctx, { operationId }): Promise<null> => {
    const row = await ctx.db.get(operationId);
    if (!row || row.status === "confirmed" || row.status === "failed" || Date.now() - Date.parse(row.requestedAt) < MOBILE_COMMAND_TTL_MS) return null;
    if (row.status === "unknown") {
      const outcome = await mobileOperationOutcome(ctx, row);
      if (outcome.status === "confirmed") await ctx.db.patch(row._id, { status: "confirmed", errorCode: undefined });
      await syncVisitorDoorReading(ctx, row._id);
      return null;
    }
    let unsent = row.transport === "hik_gateway" && row.status === "pending";
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
    const outcome = unsent ? { status: "failed" as const, errorCode: "COMMAND_EXPIRED" }
      : await mobileOperationOutcome(ctx, row);
    await ctx.db.patch(row._id, outcome);
    await syncVisitorDoorReading(ctx, row._id);
    return null;
  },
});
