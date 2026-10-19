"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { itemValidator, splitDestructionBatches } from "../lib/biometricDestruction";
import { deleteFaceFromDevice, deleteFingerprintFromDevice } from "../lib/gateway/biometrics";

/** Snapshot arrives in the durable scheduler payload before any template/storage deletion. */
export const destroyBatch = internalAction({
  args: { runId: v.id("auditLog"), batch: v.number(), projectId: v.id("projects"), item: itemValidator },
  handler: async (ctx, args): Promise<void> => {
    if (!await ctx.runQuery(internal.biometricDestruction.isBatchActive, { runId: args.runId, batch: args.batch })) return;
    const queuedOpIds: Id<"hikPendingOperations">[] = [];
    let deviceFailures = 0;
    let deviceUnconfirmed = args.item.unconfirmed;
    const item = args.item;
    // Each target is isolated: an offline device never rolls back Convex erasure.
    for (const targets of splitDestructionBatches(item.targets, 5)) {
      if (!await ctx.runQuery(internal.biometricDestruction.isBatchActive, { runId: args.runId, batch: args.batch })) return;
      await Promise.all(targets.map(async target => {
        try {
          if (item.kind === "fingerprint" && (item.fingerPrintID === undefined || !Number.isInteger(item.fingerPrintID) || item.fingerPrintID < 1 || item.fingerPrintID > 10)) { deviceUnconfirmed += 1; return; }
          if (target.hikTransport === "localBridge") {
            const opId: Id<"hikPendingOperations"> | null = await ctx.runMutation(internal.biometricDestruction.queueBridgeOperation, {
              runId: args.runId, batch: args.batch, deviceId: target.deviceId, employeeId: item.employeeId,
              cardNumber: item.cardNumber, kind: item.kind, fingerPrintID: item.fingerPrintID,
            });
            if (!opId) { deviceUnconfirmed += 1; return; }
            queuedOpIds.push(opId);
            return;
          }
          const opId: Id<"hikPendingOperations"> | null = await ctx.runMutation(internal.biometricDestruction.createGatewayOperation, {
            runId: args.runId, batch: args.batch, deviceId: target.deviceId, employeeId: item.employeeId,
            cardNumber: item.cardNumber, kind: item.kind, fingerPrintID: item.fingerPrintID, hikDevIndex: target.hikDevIndex,
          });
          if (!opId) { deviceUnconfirmed += 1; return; }
          let ok = false;
          try {
            if (target.hikDevIndex && item.cardNumber) {
              const result = item.kind === "face"
                ? await deleteFaceFromDevice(target.hikDevIndex, item.cardNumber)
                : await deleteFingerprintFromDevice(target.hikDevIndex, item.cardNumber, item.fingerPrintID);
              ok = result.ok;
            }
          } catch { /* Store a sanitized failure; no device/biometric payload goes into audit. */ }
          await ctx.runMutation(internal.biometricDestruction.finishGatewayOperation, { runId: args.runId, opId, ok });
          if (!ok) deviceFailures += 1;
        } catch {
          deviceFailures += 1;
        }
      }));
    }
    await ctx.runMutation(internal.biometricDestruction.finishBatch, {
      runId: args.runId, batch: args.batch, item,
      deviceOperations: item.targets.length, deviceFailures, deviceUnconfirmed, queuedOpIds,
    });
  },
});
