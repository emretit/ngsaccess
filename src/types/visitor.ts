import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

// Ziyaretçi = employees(isVisitor=true). Tip, backend list sorgusunun dönüşünden türetilir
// (host adı, preset bölge ve son okuma ile zenginleştirilmiş). `any` yok.
export type Visitor = FunctionReturnType<typeof api.visitors.list>[number];

export type VisitorPresetRule = FunctionReturnType<
  typeof api.visitors.presetRules
>[number];

/** Son başarılı yönlü olayın gösterdiği konum, erişim süresinden bağımsızdır. */
export function isVisitorInside(v: Visitor): boolean {
  return v.presence === "inside";
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

/** Ziyaretçi durum etiketi + badge varyantı (UI). */
export function visitorStatusInfo(v: Visitor): { label: string; variant: BadgeVariant } {
  if (v.isActive && (!v.accessExpiresAt || Date.parse(v.accessExpiresAt) > Date.now())) {
    if (isVisitorInside(v)) return { label: "Binada", variant: "success" };
    return { label: "Aktif", variant: "default" };
  }
  if (v.visitorStatus === "expired" || (v.accessExpiresAt && Date.parse(v.accessExpiresAt) <= Date.now())) return { label: "Süresi Doldu", variant: "destructive" };
  if (v.visitorStatus === "checkedOut") return { label: "Ziyaret Sonlandırıldı", variant: "secondary" };
  if (v.visitorStatus === "preRegistered") return { label: "Ön Kayıt", variant: "outline" };
  return { label: "Pasif", variant: "secondary" };
}
