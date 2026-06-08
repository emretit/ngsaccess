import type { StatusFilter } from "./dashboard/PDKSFilterBar";

export type DayStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "overtime"
  | "weekend"
  | "holiday";

interface StatusMeta {
  label: string;
  shortLabel: string;
  bgClass: string;
  textClass: string;
  badgeClass: string;
}

export const STATUS_META: Record<DayStatus, StatusMeta> = {
  present: {
    label: "Mevcut",
    shortLabel: "Mevcut",
    bgClass: "status-success-bg",
    textClass: "status-success-text",
    badgeClass: "status-success-badge",
  },
  late: {
    label: "Geç kalan",
    shortLabel: "Geç",
    bgClass: "status-warning-bg",
    textClass: "status-warning-text",
    badgeClass: "status-warning-badge",
  },
  absent: {
    label: "Devamsız",
    shortLabel: "Yok",
    bgClass: "status-danger-bg",
    textClass: "status-danger-text",
    badgeClass: "status-danger-badge",
  },
  leave: {
    label: "İzinli",
    shortLabel: "İzinli",
    bgClass: "status-info-bg",
    textClass: "status-info-text",
    badgeClass: "status-info-badge",
  },
  overtime: {
    label: "Mesai yapan",
    shortLabel: "Mesai",
    bgClass: "status-purple-bg",
    textClass: "status-purple-text",
    badgeClass: "status-purple-badge",
  },
  weekend: {
    label: "Hafta sonu",
    shortLabel: "H.sonu",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  holiday: {
    label: "Tatil",
    shortLabel: "Tatil",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Tümü",
  present: STATUS_META.present.label,
  late: STATUS_META.late.label,
  absent: STATUS_META.absent.label,
  leave: STATUS_META.leave.label,
  overtime: STATUS_META.overtime.label,
};

export function isDayStatus(s: string): s is DayStatus {
  return s in STATUS_META;
}
