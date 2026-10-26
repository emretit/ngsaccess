import type { StatusTone } from "@/lib/statusTone";
import type { PdksDayStatus } from "../../../convex/lib/pdksTable";

export type DayStatus = PdksDayStatus | "overtime";
interface StatusMeta {
  label: string;
  shortLabel: string;
  code: string;
  tone: StatusTone;
  bgClass: string;
  textClass: string;
  badgeClass: string;
}
const toneClasses: Record<StatusTone, [string, string]> = {
  neutral: ["bg-muted", "text-muted-foreground"],
  success: ["bg-success-bg", "text-success"],
  warning: ["bg-warning-bg", "text-warning"],
  danger: ["bg-danger-bg", "text-danger"],
  info: ["bg-info-bg", "text-info"],
};
function meta(
  label: string,
  code: string,
  tone: StatusTone = "neutral",
): StatusMeta {
  return {
    label,
    shortLabel: label,
    code,
    tone,
    bgClass: toneClasses[tone][0],
    textClass: toneClasses[tone][1],
    badgeClass:
      tone === "neutral"
        ? "bg-muted text-muted-foreground border-border"
        : `status-${tone}-badge`,
  };
}
export const STATUS_META: Record<DayStatus, StatusMeta> = {
  incomplete: meta("İnceleme", "—"),
  present: meta("Mevcut", "M", "success"),
  late: meta("Geç", "G", "warning"),
  absent: meta("Devamsız", "D", "danger"),
  leave: meta("İzinli", "İ", "info"),
  weekend: meta("Hafta tatili", "HT"),
  holiday: meta("Resmî tatil", "RT"),
  future: meta("Henüz gelmedi", "—"),
  notEmployed: meta("—", "—"),
  noData: meta("Veri yok", "—"),
  overtime: meta("Fazla mesai", "FM"),
};
export const IN_PROGRESS_META = meta("Devam ediyor", "DE", "info");
type StatusItem = { noShift?: boolean; status: DayStatus; firstEntry?: string | null };
export function isPdksInProgress(item: StatusItem): boolean {
  return item.status === "future" && typeof item.firstEntry === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.firstEntry);
}
export function statusMetaFor(item: StatusItem): StatusMeta {
  if (item.noShift) return meta("Vardiya yok", "—");
  return isPdksInProgress(item) ? IN_PROGRESS_META : STATUS_META[item.status];
}
export const STATUS_FILTER_LABELS = {
  all: "Tümü",
  ...Object.fromEntries(
    Object.entries(STATUS_META).map(([key, value]) => [key, value.label]),
  ),
  future: `${STATUS_META.future.label} / ${IN_PROGRESS_META.label}`,
} as Record<"all" | DayStatus, string>;
export function isDayStatus(s: string): s is DayStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_META, s);
}
