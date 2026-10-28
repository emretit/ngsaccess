import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type DeviceHistoryResult = FunctionReturnType<
  typeof api.actions.hikGatewayDevice.backfillDeviceEvents
>;
export type HistoryScope = "recent" | "date" | "all";

export function historyScopeArgs(
  scope: HistoryScope,
  date: string,
  now = Date.now(),
) {
  return scope === "all"
    ? { fromAll: true as const }
    : {
        startTime:
          scope === "date"
            ? `${date}T00:00:00+03:00`
            : new Date(now - 24 * 3600 * 1000).toISOString(),
      };
}
export function historyResultText(result: DeviceHistoryResult) {
  if (!result.ok && !result.partial) return null;
  return !result.ok && result.partial
    ? `${result.scanned} kayıt tarandı, kalanı arka planda sürüyor. Birkaç dakika sonra Geçiş Kayıtları'na bakın.`
    : `${result.scanned} kayıt tarandı · ${result.inserted} eklendi · ${result.skipped} zaten vardı / atlandı`;
}
