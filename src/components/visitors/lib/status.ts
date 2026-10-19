import type { Visitor } from "@/types/visitor";

export type VisitorStatus = Visitor["status"];
export const visitorStatusInfo = {
  active: { label: "Erişim aktif", tone: "success" },
  checkedOut: { label: "Sonlandırıldı / pasif", tone: "neutral" },
  expired: { label: "Süresi doldu", tone: "warning" },
  preRegistered: { label: "Ön kayıt", tone: "neutral" },
} as const satisfies Record<VisitorStatus, { label: string; tone: "success" | "warning" | "neutral" }>;

export function isVisitorStatus(value: string | null): value is VisitorStatus {
  return value !== null && Object.prototype.hasOwnProperty.call(visitorStatusInfo, value);
}
export const visitorPresenceLabels = { inside: "İçeride", outside: "Dışarıda", unknown: "Bilinmiyor" } as const;

/** Derive expiry immediately from visitEnd while the boundary query refreshes. */
export function displayVisitorStatus(visitor: Pick<Visitor, "status" | "visitEnd">, now: number): VisitorStatus {
  return visitor.status !== "checkedOut" && visitor.visitEnd && Date.parse(visitor.visitEnd) <= now ? "expired" : visitor.status;
}
