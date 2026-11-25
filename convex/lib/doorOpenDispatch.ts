import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { scheduleBridgeWakeForProject } from "../hikBridge";
import { MOBILE_COMMAND_TTL_MS, resolveMobileTarget } from "./mobileAccess";
import type { VisitorPassOutcome } from "./visitorPass";

export type VisitorDoorResult = {
  doorOpen: "pending" | "confirmed" | "failed";
  doorOpenOperationId?: Id<"mobileAccessOperations">;
  doorOpenMessage?: string;
};
export const DOOR_OPEN_FAILED_MESSAGE = "Kapı açılamadı — resepsiyona başvurun";

/** The pass has already consumed this entry. Door errors must not undo that decision. */
export async function openVisitorDoor(ctx: MutationCtx, reader: Doc<"devices">, outcome: VisitorPassOutcome): Promise<VisitorPassOutcome & Partial<VisitorDoorResult>> {
  if (outcome.status !== "granted" || !outcome.doorId) return outcome;
  const readings = await ctx.db.query("cardReadings").withIndex("by_employee_accessTime", q =>
    q.eq("employeeId", outcome.visitorId).eq("accessTime", outcome.accessTime)).take(100);
  const reading = readings.find(row => row.deviceId === reader._id && row.accessStatus === "izin_verildi" &&
    !row.rawData?.includes('"doorOpen"'));
  const visitor = await ctx.db.get(outcome.visitorId);
  const pass = await ctx.db.get(outcome.visitorPassId);
  const door = await ctx.db.get(outcome.doorId);
  const device = door?.deviceId ? await ctx.db.get(door.deviceId) : null;
  let result: VisitorDoorResult = { doorOpen: "failed", doorOpenMessage: DOOR_OPEN_FAILED_MESSAGE };
  // Reuse the mobile topology/transport policy, including isolation and disabled bridge gates.
  let target: Awaited<ReturnType<typeof resolveMobileTarget>> | null = null;
  if (visitor && device && pass?.tokenHash && reading) {
    try { target = await resolveMobileTarget(ctx, visitor, device._id, outcome.doorId); } catch { /* fail closed */ }
  }
  const lastSeen = device?.lastSeen ? Date.parse(device.lastSeen) : NaN;
  const now = Date.now();
  if (target && device && pass?.tokenHash && reading && target.transport !== "unsupported" &&
      Number.isFinite(lastSeen) && lastSeen <= now && now - lastSeen < 5 * 60_000) {
    const operationId = await ctx.db.insert("mobileAccessOperations", {
      projectId: outcome.projectId, employeeId: outcome.visitorId, visitorPassId: outcome.visitorPassId,
      // Bind reader + reading + credential generation without persisting either credential.
      requestId: `visitor:${pass.tokenHash}:${reader._id}:${reading._id}`,
      deviceId: device._id, doorId: outcome.doorId, deviceName: device.name,
      requestedAt: outcome.accessTime, status: "pending", transport: target.transport, actuator: target.actuator,
    });
    await dispatchDoorOpen(ctx, operationId, device, target.actuator);
    result = { doorOpen: "pending", doorOpenOperationId: operationId };
  }
  if (reading) {
    const raw: unknown = JSON.parse(reading.rawData ?? "{}");
    await ctx.db.patch(reading._id, { rawData: JSON.stringify({
      ...(typeof raw === "object" && raw !== null ? raw : {}), ...result,
    }) });
  }
  return { ...outcome, ...result };
}

/** Queue the existing transport in the caller transaction; never perform external I/O here. */
export async function dispatchDoorOpen(ctx: MutationCtx, operationId: Id<"mobileAccessOperations">, device: Doc<"devices">, actuator: number) {
  const operation = await ctx.db.get(operationId);
  if (!operation) throw new Error("Missing door operation");
  const now = Date.parse(operation.requestedAt);
  if (operation.transport === "ide_mqtt") {
    const ideOperationId = await ctx.db.insert("idePendingOperations", {
      projectId: operation.projectId, deviceId: device._id, opType: "openDoor",
      payload: { dstId: device.ideUuid, ioId: actuator, keep: 1, mobileOperationId: operationId },
      idempotencyKey: `mobile:${operationId}`, status: "pending", attempts: 0, maxAttempts: 1, nextRetryAt: now, createdAt: now,
    });
    await ctx.db.patch(operationId, { ideOperationId });
  } else if (operation.transport === "hik_local_bridge") {
    const hikOperationId = await ctx.db.insert("hikPendingOperations", {
      projectId: operation.projectId, deviceId: device._id, operation: "openDoor",
      payload: { doorNo: actuator, mobileOperationId: operationId },
      status: "pending", attemptCount: 0, nextRetryAt: now, createdAt: now,
    });
    await ctx.db.patch(operationId, { hikOperationId });
    await scheduleBridgeWakeForProject(ctx, operation.projectId);
  } else {
    await ctx.scheduler.runAfter(0, internal.mobileAccessGateway.send, { operationId });
  }
  await ctx.scheduler.runAfter(MOBILE_COMMAND_TTL_MS, internal.mobileAccess.expireQueue, { operationId });
}
