import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { notifyAlarmIfNeeded } from "./alarmNotify";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const DEVICE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const HIK_ISUP_FRESHNESS_MS = 2.5 * 60 * 60 * 1000;

type ConnectionSignal = {
  brand?: string; hikTransport?: string; hikLastSeenAt?: number;
  lastSeen?: string | null; hikOfflineHint?: string;
  hikIsupOnline?: boolean; hikIsupStatusAt?: number; hikIsupOfflineSince?: number;
};

const isHikGateway = (device: ConnectionSignal) => device.brand === "hikvision" && device.hikTransport !== "localBridge";

export function hasFreshIsupStatus(device: ConnectionSignal, now = Date.now()): boolean {
  return isHikGateway(device) && typeof device.hikIsupOnline === "boolean" &&
    device.hikIsupStatusAt !== undefined && Number.isFinite(device.hikIsupStatusAt) &&
    device.hikIsupStatusAt >= now - HIK_ISUP_FRESHNESS_MS && device.hikIsupStatusAt <= now + 120_000;
}

export function deviceLastSignal(device: ConnectionSignal, now = Date.now()): number | undefined {
  if (hasFreshIsupStatus(device, now)) {
    return device.hikIsupOnline ? device.hikIsupStatusAt : device.hikIsupOfflineSince;
  }
  const signal = isHikGateway(device)
    ? device.hikLastSeenAt ?? (device.lastSeen ? Date.parse(device.lastSeen) : undefined)
    : device.lastSeen ? Date.parse(device.lastSeen) : undefined;
  return signal !== undefined && Number.isFinite(signal) ? signal : undefined;
}

/** ISUP snapshots establish continuity even when there are no card events. */
export function hasPeriodicHeartbeat(device: ConnectionSignal, now = Date.now()): boolean {
  return !isHikGateway(device) || hasFreshIsupStatus(device, now);
}

export function deviceConnection(device: ConnectionSignal, now: number): "online" | "offline" | "never" {
  if (hasFreshIsupStatus(device, now)) return device.hikIsupOnline ? "online" : "offline";
  const signal = deviceLastSignal(device, now);
  if (device.hikOfflineHint) return "offline";
  if (signal === undefined) return "never";
  return signal <= now && signal > now - DEVICE_ONLINE_WINDOW_MS ? "online" : "offline";
}

/** Yalnız başarılı yeni sinyalden önce, mevcut cihaz yazımıyla aynı işlemde çağrılır. */
export async function recordConnectivityTransition(
  ctx: MutationCtx, device: Doc<"devices">, nowMs: number,
): Promise<boolean> {
  if (expectsHeartbeat(device) && !device.heartbeatCheckAt && device.isActive !== false) {
    const checkAt = nowMs + DEVICE_ONLINE_WINDOW_MS + 1;
    await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
    await ctx.scheduler.runAfter(DEVICE_ONLINE_WINDOW_MS + 1, internal.devices.checkHeartbeatOffline, { deviceId: device._id, checkAt });
  }
  if (hasFreshIsupStatus(device, nowMs)) return false;
  const offlineFrom = deviceLastSignal(device);
  if (offlineFrom === undefined || offlineFrom >= nowMs ||
    deviceConnection(device, nowMs) !== "offline") return false;
  if (!device.hikOfflineHint && !hasPeriodicHeartbeat(device)) return false;
  const now = new Date(nowMs).toISOString();
  await ctx.db.insert("deviceEvents", {
    deviceId: device._id, projectId: device.projectId,
    source: device.brand === "hikvision" ? "hikvision" : device.brand === "ide_smart" ? "ide_smart" : "system",
    category: "status", severity: "warning", label: "Çevrimdışı dönemi",
    eventTime: now, createdAt: now, updatedAt: now,
    rawData: JSON.stringify({ offlineFrom, offlineTo: nowMs, durationMs: nowMs - offlineFrom }),
  });
  const previous = device.heartbeatOfflineEventId ? await ctx.db.get(device.heartbeatOfflineEventId) : null;
  if (previous?.deviceId === device._id && previous.projectId === device.projectId && !previous.resolvedAt) {
    await ctx.db.patch(previous._id, { resolvedAt: now, updatedAt: now,
      rawData: JSON.stringify({ offlineFrom, offlineTo: nowMs, durationMs: nowMs - offlineFrom }) });
    await ctx.db.patch(device._id, { heartbeatOfflineEventId: undefined });
    return true;
  }
  const eventId = await ctx.db.insert("deviceEvents", {
    deviceId: device._id, projectId: device.projectId,
    source: device.brand === "hikvision" ? "hikvision" : device.brand === "ide_smart" ? "ide_smart" : "system",
    category: "exception", severity: "warning", label: "Arıza: cihaz çevrimdışı",
    eventTime: now, createdAt: now, updatedAt: now, resolvedAt: now,
    rawData: JSON.stringify({ offlineFrom, offlineTo: nowMs, durationMs: nowMs - offlineFrom }),
  });
  await notifyAlarmIfNeeded(ctx, eventId);
  return true;
}

function expectsHeartbeat(device: ConnectionSignal) {
  return device.brand === "ide_smart" || (device.brand === "hikvision" && device.hikTransport === "localBridge");
}

/** Seed existing panels on rollout without manufacturing a successful heartbeat. */
export async function initializeHeartbeatMonitoring(ctx: MutationCtx, device: Doc<"devices">): Promise<void> {
  if (!expectsHeartbeat(device) || device.isActive === false || device.heartbeatCheckAt || device.heartbeatOfflineEventId) return;
  const now = Date.now();
  const signal = deviceLastSignal(device, now);
  if (signal === undefined || signal > now) return;
  const checkAt = Math.max(now, signal + DEVICE_ONLINE_WINDOW_MS + 1);
  await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
  await ctx.scheduler.runAfter(checkAt - now, internal.devices.checkHeartbeatOffline, { deviceId: device._id, checkAt });
}

/** One timer per monitored device; newer successful signals postpone its deadline. */
export async function checkHeartbeatOffline(ctx: MutationCtx, args: { deviceId: Id<"devices">; checkAt: number }): Promise<void> {
  const device = await ctx.db.get(args.deviceId);
  if (!device || device.heartbeatCheckAt !== args.checkAt) return;
  if (!expectsHeartbeat(device) || device.isActive === false) {
    await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
    return;
  }
  const signal = deviceLastSignal(device);
  const nowMs = Date.now();
  if (signal === undefined || signal > nowMs) {
    await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
    return;
  }
  const checkAt = signal + DEVICE_ONLINE_WINDOW_MS + 1;
  if (nowMs < checkAt) {
    await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
    await ctx.scheduler.runAfter(checkAt - nowMs, internal.devices.checkHeartbeatOffline, { deviceId: device._id, checkAt });
    return;
  }
  await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
  if (device.heartbeatOfflineEventId) {
    const existing = await ctx.db.get(device.heartbeatOfflineEventId);
    if (existing && !existing.resolvedAt) return;
  }
  const now = new Date(nowMs).toISOString();
  const eventId = await ctx.db.insert("deviceEvents", {
    deviceId: device._id, projectId: device.projectId,
    source: device.brand === "ide_smart" ? "ide_smart" : "hikvision",
    category: "exception", severity: "warning", label: "Arıza: cihaz çevrimdışı",
    eventTime: now, createdAt: now, updatedAt: now,
  });
  await ctx.db.patch(device._id, { heartbeatOfflineEventId: eventId });
  await notifyAlarmIfNeeded(ctx, eventId);
}
