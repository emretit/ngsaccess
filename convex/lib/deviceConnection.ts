import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { notifyAlarmIfNeeded } from "./alarmNotify";

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
