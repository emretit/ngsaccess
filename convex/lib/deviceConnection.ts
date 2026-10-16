export const DEVICE_ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function deviceConnection(device: {
  brand?: string; hikTransport?: string; hikLastSeenAt?: number;
  lastSeen?: string | null; hikOfflineHint?: string;
}, now: number): "online" | "offline" | "never" {
  const signal = device.brand === "hikvision" && device.hikTransport !== "localBridge"
    ? device.hikLastSeenAt ?? (device.lastSeen ? Date.parse(device.lastSeen) : undefined)
    : device.lastSeen ? Date.parse(device.lastSeen) : undefined;
  if (device.hikOfflineHint) return "offline";
  if (signal === undefined || !Number.isFinite(signal)) return "never";
  return signal <= now && signal > now - DEVICE_ONLINE_WINDOW_MS ? "online" : "offline";
}
