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

export { deviceConnection } from "../../convex/lib/deviceConnection";

export function commandResultMessage(result: { ok: boolean; queued?: boolean; error?: string }): string {
  if (!result.ok) return result.error ?? "İşlem başarısız";
  return result.queued ? "Sıraya alındı — cihaz onayı henüz alınmadı" : "İşlem sonucu alındı";
}

export function capabilityLabel(probe: { ok: boolean; supported: boolean | null }): string {
  if (!probe.ok) return "Doğrulanamadı";
  return probe.supported === true ? "Destekli" : probe.supported === false ? "Desteklenmiyor" : "Belirsiz";
}
