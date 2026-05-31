/** Cihaz "online" sayılır: son 5 dakika içinde lastSeen güncellenmiş. */
export const DEVICE_ONLINE_WINDOW_MS = 5 * 60 * 1000;

/**
 * lastSeen'e göre online/offline hesaplar. Hem Cihazlar (useProjectFilteredDevices)
 * hem Admin havuzu (AdminDevicesPanel) tek mantığı kullansın diye ortak util.
 * `nowMs` çağıran tarafından verilir (React render saflığı için Date.now() bir kez okunur).
 */
export function computeDeviceStatus(
  lastSeen: string | undefined | null,
  nowMs: number,
): "online" | "offline" {
  if (!lastSeen) return "offline";
  return new Date(lastSeen).getTime() > nowMs - DEVICE_ONLINE_WINDOW_MS
    ? "online"
    : "offline";
}
