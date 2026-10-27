import { deviceConnection } from "./deviceConnection";
import { skipReasons } from "./syncReasons";

export type TargetStatus = "queued" | "sent" | "verified" | "failed" | "skipped" | "unknown";
export type RunStatus = "running" | "done" | "partial" | "failed";
export type RunCounts = Record<TargetStatus, number>;

export const targetLabels: Record<TargetStatus, string> = {
  queued: "Kuyrukta", sent: "Gönderildi · teslim kanıtı yok",
  verified: "Cihazda doğrulandı", failed: "Başarısız", skipped: "Atlandı", unknown: "Bilinmiyor",
};
export { skipReasons };

export function skippedReason(device: {
  brand?: string; isActive?: boolean; status?: string; hikTransport?: string;
  hikDevIndex?: string; deviceIp?: string; deviceUsername?: string; devicePassword?: string;
  ideUuid?: string; ideUser?: string; idePassword?: string;
  hikLastSeenAt?: number; lastSeen?: string; hikOfflineHint?: string;
}, now: number): string | undefined {
  if (device.isActive === false) return skipReasons.inactive;
  if (device.brand !== "hikvision" && device.brand !== "ide_smart") return skipReasons.unsupported;
  if (device.status === "offline" || deviceConnection(device, now) === "offline") return skipReasons.offline;
  if (device.brand === "ide_smart") {
    if (!device.ideUuid || !device.ideUser || !device.idePassword) return skipReasons.configuration;
  } else if (device.hikTransport === "localBridge") {
    if (!device.deviceIp || !device.deviceUsername || !device.devicePassword) return skipReasons.configuration;
  } else if (!device.hikDevIndex) return skipReasons.configuration;
  return undefined;
}

export function operationStatus(brand: string, op: { status: string; ackedAt?: number }): TargetStatus {
  if (op.status === "failed") return "failed";
  if (op.status === "pending" || op.status === "processing" || (brand === "ide_smart" && op.status === "sent")) return "queued";
  if (brand === "hikvision" && op.status === "done") return "sent";
  if (brand === "ide_smart" && op.status === "acked" && op.ackedAt !== undefined) return "verified";
  return "unknown";
}

/** A target represents ALL its operations; partial evidence never verifies a target. */
export function targetStatus(statuses: readonly TargetStatus[], timedOut = false): TargetStatus {
  if (statuses.includes("queued") && !timedOut) return "queued";
  if (statuses.includes("failed")) return "failed";
  if (!statuses.length || statuses.includes("unknown") || statuses.includes("queued")) return "unknown";
  if (statuses.every((status) => status === "verified")) return "verified";
  if (statuses.every((status) => status === "sent" || status === "verified")) return "sent";
  return "skipped";
}

export function summarizeRun(statuses: readonly TargetStatus[], dispatchFinished: boolean): { counts: RunCounts; status: RunStatus } {
  const counts: RunCounts = { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 0, unknown: 0 };
  for (const status of statuses) counts[status]++;
  const success = counts.sent + counts.verified;
  const issues = counts.failed + counts.skipped + counts.unknown;
  const status: RunStatus = !dispatchFinished || counts.queued > 0 ? "running"
    : issues === 0 ? "done" : success > 0 || counts.skipped > 0 ? "partial" : "failed";
  return { counts, status };
}

/** One run-wide timer, with bounded backoff until the ten-minute watchdog. */
export function refreshDelay(attempt: number): number {
  return [5000, 15000, 30000, 60000][Math.min(3, Math.max(0, Math.floor(attempt)))];
}

export function summaryChanged(current: { status: RunStatus; counts: RunCounts; finishedAt?: number },
  next: { status: RunStatus; counts: RunCounts; finishedAt?: number }): boolean {
  return current.status !== next.status || current.finishedAt !== next.finishedAt
    || (Object.keys(next.counts) as TargetStatus[]).some(status => current.counts[status] !== next.counts[status]);
}
