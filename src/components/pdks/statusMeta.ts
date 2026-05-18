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
    bgClass: "bg-green-500",
    textClass: "text-green-800",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
  },
  late: {
    label: "Geç kalan",
    shortLabel: "Geç",
    bgClass: "bg-yellow-500",
    textClass: "text-yellow-800",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  absent: {
    label: "Devamsız",
    shortLabel: "Yok",
    bgClass: "bg-red-500",
    textClass: "text-red-800",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
  },
  leave: {
    label: "İzinli",
    shortLabel: "İzinli",
    bgClass: "bg-blue-500",
    textClass: "text-blue-800",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  overtime: {
    label: "Mesai yapan",
    shortLabel: "Mesai",
    bgClass: "bg-purple-500",
    textClass: "text-purple-800",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
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
