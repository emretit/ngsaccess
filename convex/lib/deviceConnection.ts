import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const DEVICE_ONLINE_WINDOW_MS = 5 * 60 * 1000;

type ConnectionSignal = {
  brand?: string; hikTransport?: string; hikLastSeenAt?: number;
  lastSeen?: string | null; hikOfflineHint?: string;
};

const isHikGateway = (device: ConnectionSignal) => device.brand === "hikvision" && device.hikTransport !== "localBridge";

export function deviceLastSignal(device: ConnectionSignal): number | undefined {
  const signal = isHikGateway(device)
    ? device.hikLastSeenAt ?? (device.lastSeen ? Date.parse(device.lastSeen) : undefined)
    : device.lastSeen ? Date.parse(device.lastSeen) : undefined;
  return signal !== undefined && Number.isFinite(signal) ? signal : undefined;
}

/** Hik gateway/ISAPI devices only signal on card events, so a quiet night is not an outage. */
export function hasPeriodicHeartbeat(device: ConnectionSignal): boolean {
  return !isHikGateway(device);
}

export function deviceConnection(device: ConnectionSignal, now: number): "online" | "offline" | "never" {
  const signal = deviceLastSignal(device);
  if (device.hikOfflineHint) return "offline";
  if (signal === undefined) return "never";
  return signal <= now && signal > now - DEVICE_ONLINE_WINDOW_MS ? "online" : "offline";
}

/** Yalnız başarılı yeni sinyalden önce, mevcut cihaz yazımıyla aynı işlemde çağrılır. */
export async function recordConnectivityTransition(
  ctx: MutationCtx, device: Doc<"devices">, nowMs: number,
): Promise<boolean> {
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
  return true;
}
