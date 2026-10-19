import { v } from "convex/values";
import { internal } from "./_generated/api";
import { planNextWake, relayConfig } from "./lib/hikWake";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

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

async function assertProjectAccess(
  ctx: { user: { role?: string }; db: unknown },
  getAllowed: () => Promise<Id<"projects">[]>,
  projectId: Id<"projects">,
) {
  if (ctx.user.role === "super_admin") return;
  const allowed = await getAllowed();
  if (!isProjectAllowed(allowed, projectId)) {
    throw new Error("Bu projeye erişim yetkiniz yok");
  }
}

export const createBridge = adminMutation({
  args: { projectId: v.id("projects"), name: v.optional(v.string()) },
  returns: v.object({ token: v.string(), bridgeId: v.id("hikBridges") }),
  handler: async (ctx, args) => {
    await assertProjectAccess(ctx, () => getProjectIdsForUser(ctx), args.projectId);
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

export const listBridges = adminQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await assertProjectAccess(ctx, () => getProjectIdsForUser(ctx), args.projectId);
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

export const revokeBridge = adminMutation({
  args: { bridgeId: v.id("hikBridges") },
  handler: async (ctx, args) => {
    const bridge = await ctx.db.get(args.bridgeId);
    if (!bridge) return;
    await assertProjectAccess(ctx, () => getProjectIdsForUser(ctx), bridge.projectId);
    await ctx.db.delete(args.bridgeId);
  },
});
