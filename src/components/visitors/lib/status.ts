import type { Visitor } from "@/types/visitor";

export type VisitorStatus = Visitor["status"];
export const visitorStatusInfo = {
  active: { label: "Erişim aktif", tone: "success" },
  checkedOut: { label: "Ziyaret sonlandırıldı", tone: "neutral" },
  expired: { label: "Süresi doldu", tone: "warning" },
  preRegistered: { label: "Ön kayıt", tone: "neutral" },
  inactive: { label: "Pasif", tone: "neutral" },
} as const satisfies Record<VisitorStatus, { label: string; tone: "success" | "warning" | "neutral" }>;

export function isVisitorStatus(value: string | null): value is VisitorStatus {
  return value !== null && Object.prototype.hasOwnProperty.call(visitorStatusInfo, value);
}
export const visitorPresenceLabels = { inside: "İçeride", outside: "Dışarıda", unknown: "Bilinmiyor" } as const;
