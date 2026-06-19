import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

/**
 * Tek-yer (ngsplus-only) localBridge yönetimi.
 *
 * Bridge EXE'ye yalnızca bir `hikBridges.token` girilir. Bridge bu token ile
 * `/hik-bridge/roster`'ı çağırır; backend o projedeki tüm localBridge cihazlarının
 * bağlantı bilgilerini (IP/port/kullanıcı/şifre) + bekleyen SDK işlerini döner.
 * Panel ekleme/IP/şifre artık bridge'de değil, ngsplus cihaz formunda yönetilir.
 *
 * Per-device token akışı (hikvisionSync.claimLocalBridgeOperations) geriye dönük
 * uyumluluk için duruyor; yeni kurulumlar bu roster akışını kullanır.
 */

const HIK_BRIDGE_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;
const HIK_BRIDGE_MAX_POLL = 25;
// Bir op bu kadar denemeden sonra terminal "failed" olur — geçici hatalar retry edilir
// (panel offline / worker yok / token yarışı), kalıcı hatalar sonsuza dek dönmez.
const HIK_BRIDGE_MAX_ATTEMPTS = 5;
const MAX_PANEL_PORT = 65535;
const DEFAULT_PANEL_PORT = 8000;
const DEFAULT_PANEL_USERNAME = "admin";
const DEFAULT_DOOR_COUNT = 4;

type RosterDevice = {
  deviceId: Id<"devices">;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  doorCount: number;
  /** Bu cihazın /card-reader event token'ı; yoksa roster sırasında üretilir. */
  apiToken: string;
};

type RosterOperation = {
  opId: Id<"hikPendingOperations">;
  deviceId: Id<"devices">;
  operation: string;
  payload: unknown;
  attemptCount: number;
  createdAt: number;
};

/**
 * Bridge token ile: o projedeki localBridge cihazlarının roster'ı + bekleyen işler.
 * Auth bridge token ile yapılır; geçersiz token hiçbir veri döndürmez.
 */
export const claimBridgeRoster = internalMutation({
  args: { token: v.string(), max: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const bridge = await ctx.db
      .query("hikBridges")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!bridge) {
      return { ok: false as const, error: "unauthorized", devices: [], operations: [] };
    }

    const now = Date.now();
    await ctx.db.patch(bridge._id, { lastSeenAt: now });

    const projectDevices = await ctx.db
      .query("devices")
      .withIndex("by_project", (q) => q.eq("projectId", bridge.projectId))
      .collect();
    const panels = projectDevices.filter(
      (d) =>
        d.brand === "hikvision" &&
        d.hikTransport === "localBridge" &&
        d.isActive !== false,
    );

    // Event token (apiToken) yoksa burada üret + persist; bridge kart-okutma
    // event'lerini /card-reader'a bu token ile basar (per-device auth korunur).
    const tokenNow = new Date().toISOString();
    const devices: RosterDevice[] = [];
    for (const d of panels) {
      let apiToken = d.apiToken;
      if (!apiToken) {
        apiToken = crypto.randomUUID();
        await ctx.db.patch(d._id, { apiToken, apiTokenCreatedAt: tokenNow });
      }
      devices.push({
        deviceId: d._id,
        name: d.name,
        host: d.deviceIp ?? "",
        // Clamp 1..65535 — bridge'de Port ushort; aralık dışı değer tüm roster
        // deserializasyonunu (dolayısıyla TÜM panelleri) düşürürdü.
        port: Math.min(Math.max(d.hikPort ?? DEFAULT_PANEL_PORT, 1), MAX_PANEL_PORT),
        username: d.deviceUsername ?? DEFAULT_PANEL_USERNAME,
        password: d.devicePassword ?? "",
        doorCount: d.hikDoorCount ?? DEFAULT_DOOR_COUNT,
        apiToken,
      });
    }

    const requestedMax = Math.floor(args.max ?? 10);
    const max = Math.min(Math.max(requestedMax, 1), HIK_BRIDGE_MAX_POLL);
    const staleCutoff = now - HIK_BRIDGE_PROCESSING_TIMEOUT_MS;
    const operations: RosterOperation[] = [];

    for (const panel of panels) {
      if (operations.length >= max) break;
      // IP girilmemiş panelin işini claim ETME — bridge worker'ı host'suz cihaz için
      // oluşmaz; claim edilirse op "panel worker bulunamadı" ile kalıcı failed olurdu.
      // IP girilene kadar pending'de bekler.
      if (!panel.deviceIp) continue;

      // Stuck processing kayıtlarını pending'e çek (bridge crash/timeout sonrası).
      const processing = await ctx.db
        .query("hikPendingOperations")
        .withIndex("by_device_status", (q) =>
          q.eq("deviceId", panel._id).eq("status", "processing"),
        )
        .take(50);
      await Promise.all(
        processing
          .filter((op) => (op.processingStartedAt ?? op.createdAt) < staleCutoff)
          .map((op) =>
            ctx.db.patch(op._id, {
              status: "pending",
              nextRetryAt: now,
              lastError: "Bridge claim timeout; pending'e alındı",
            }),
          ),
      );

      const remaining = max - operations.length;
      const pending = await ctx.db
        .query("hikPendingOperations")
        .withIndex("by_device_status", (q) =>
          q.eq("deviceId", panel._id).eq("status", "pending"),
        )
        .take(remaining * 2 + 10);
      const dueAll = pending.filter((op) => (op.nextRetryAt ?? 0) <= now);

      // Maksimum denemeyi aşanları terminal failed yap (sonsuz claim→stale→requeue önlenir).
      await Promise.all(
        dueAll
          .filter((op) => op.attemptCount >= HIK_BRIDGE_MAX_ATTEMPTS)
          .map((op) =>
            ctx.db.patch(op._id, {
              status: "failed",
              lastError: `Maksimum deneme (${HIK_BRIDGE_MAX_ATTEMPTS}) aşıldı`,
            }),
          ),
      );

      const due = dueAll
        .filter((op) => op.attemptCount < HIK_BRIDGE_MAX_ATTEMPTS)
        .slice(0, remaining);

      await Promise.all(
        due.map((op) =>
          ctx.db.patch(op._id, {
            status: "processing",
            attemptCount: op.attemptCount + 1,
            processingStartedAt: now,
            lastError: undefined,
          }),
        ),
      );
      for (const op of due) {
        operations.push({
          opId: op._id,
          deviceId: op.deviceId,
          operation: op.operation,
          payload: op.payload,
          attemptCount: op.attemptCount + 1,
          createdAt: op.createdAt,
        });
      }
    }

    return {
      ok: true as const,
      bridge: { projectId: bridge.projectId, name: bridge.name ?? null },
      devices,
      operations,
    };
  },
});

/**
 * Bridge token ile: claimed işi done/failed olarak kapat.
 * Op, token'ın bağlı olduğu projedeki bir cihaza ait olmalı (cross-tenant kapalı).
 */
export const ackBridgeOperation = internalMutation({
  args: {
    token: v.string(),
    opId: v.id("hikPendingOperations"),
    ok: v.boolean(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bridge = await ctx.db
      .query("hikBridges")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!bridge) return { ok: false as const, error: "unauthorized" };

    const op = await ctx.db.get(args.opId);
    if (!op) return { ok: false as const, error: "operation not found" };
    const device = await ctx.db.get(op.deviceId);
    if (!device || device.projectId !== bridge.projectId) {
      return { ok: false as const, error: "operation not found" };
    }

    if (args.ok) {
      await ctx.db.patch(args.opId, {
        status: "done",
        completedAt: Date.now(),
        lastError: undefined,
      });
    } else if (op.attemptCount < HIK_BRIDGE_MAX_ATTEMPTS) {
      // Geçici hata olabilir (panel offline / worker yok / token yarışı): backoff ile
      // pending'e geri çek. localBridge'in retry worker'ı yok; tek self-heal yolu budur.
      await ctx.db.patch(args.opId, {
        status: "pending",
        nextRetryAt: Date.now() + Math.min(60_000, 5_000 * Math.max(1, op.attemptCount)),
        lastError: args.message ?? "Bridge operation failed (yeniden denenecek)",
      });
    } else {
      await ctx.db.patch(args.opId, {
        status: "failed",
        lastError: args.message ?? "Bridge operation failed",
      });
    }
    return { ok: true as const };
  },
});

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
