import { v } from "convex/values";
import { internal } from "./_generated/api";
import { planNextWake, relayConfig } from "./lib/hikWake";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { requirePermission } from "./lib/permissions";

/**
 * Köprü token yönetimi (hikBridges) + relay uyandırması.
 *
 * Eski roster akışı (/hik-bridge/roster + roster-ack, claimBridgeRoster, ackBridgeOperation)
 * 2026-10-19'da kaldırıldı; Windows köprüsü baştan yazılacak.
 */

/** Aynı projedeki işleri köprü başına en fazla iki saniyede bir uyandırır. */
export async function scheduleBridgeWakeForProject(
  ctx: MutationCtx,
  projectId: Id<"projects"> | undefined,
): Promise<void> {
  if (!projectId || !relayConfig(process.env)) return;
  const bridges = await ctx.db.query("hikBridges")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(10);
  const now = Date.now();
  for (const bridge of bridges) {
    const plan = planNextWake(now, bridge.nextWakeAt);
    if (!plan.schedule) continue;
    await ctx.db.patch(bridge._id, { nextWakeAt: plan.fireAt });
    await ctx.scheduler.runAt(plan.fireAt, internal.actions.hikBridgeWake.wake, { bridgeId: bridge._id });
  }
}

// ────────────────────────────────────────────────────────────
// Admin: bridge token yönetimi (ngsplus ayarları)
// ────────────────────────────────────────────────────────────

export const createBridge = authedMutation({
  args: { projectId: v.id("projects"), name: v.optional(v.string()) },
  returns: v.object({ token: v.string(), bridgeId: v.id("hikBridges") }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
    const token = crypto.randomUUID();
    const bridgeId = await ctx.db.insert("hikBridges", {
      projectId: args.projectId,
      token,
      name: args.name?.trim() || undefined,
      createdAt: Date.now(),
    });
    return { token, bridgeId };
  },
});

export const listBridges = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
    const bridges = await ctx.db
      .query("hikBridges")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return bridges.map((b) => ({
      _id: b._id,
      name: b.name ?? null,
      token: b.token,
      lastSeenAt: b.lastSeenAt ?? null,
      lastClientInfo: b.lastClientInfo ?? null,
      createdAt: b.createdAt,
    }));
  },
});

export const revokeBridge = authedMutation({
  args: { bridgeId: v.id("hikBridges") },
  handler: async (ctx, args) => {
    const bridge = await ctx.db.get(args.bridgeId);
    if (!bridge) return;
    await requirePermission(ctx, ctx.user, bridge.projectId, "devices.manage");
    await ctx.db.delete(args.bridgeId);
  },
});
