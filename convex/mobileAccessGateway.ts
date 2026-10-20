"use node";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { gatewayApiCallChecked } from "./lib/gateway/core";

/** One dispatch attempt. Missing/negative ACK is unknown; it is never retried automatically. */
export const send = internalAction({
  args: { operationId: v.id("mobileAccessOperations") },
  handler: async (ctx, { operationId }): Promise<null> => {
    const command = await ctx.runMutation(internal.mobileAccess.claimGateway, { operationId });
    if (!command) return null;
    let status: "confirmed" | "unknown" = "unknown";
    try {
      const result = await gatewayApiCallChecked(
        `/ISAPI/AccessControl/RemoteControl/door/${command.actuator}`, "PUT",
        { RemoteControlDoor: { cmd: "open" } }, command.devIndex,
      );
      if (result.ok) status = "confirmed";
    } catch {
      // Never persist transport bodies, credentials or panel details in the mobile DTO.
    }
    await ctx.runMutation(internal.mobileAccess.finishGateway, { operationId, status });
    return null;
  },
});
