import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

// Ziyaretçi = employees(isVisitor=true). Tip, backend list sorgusunun dönüşünden türetilir
// (host adı, preset bölge ve son okuma ile zenginleştirilmiş). `any` yok.
export type Visitor = FunctionReturnType<typeof api.visitors.list>[number];

export type VisitorPresetRule = FunctionReturnType<
  typeof api.visitors.presetRules
>[number];

/** Ziyaretçi "şu an binada" mı? Aktif ve son okuması giriş yönündeyse içeride sayılır. */
export function isVisitorInside(v: Visitor): boolean {
  return v.isActive === true && v.lastDirection === "entry";
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

/** Ziyaretçi durum etiketi + badge varyantı (UI). */
export function visitorStatusInfo(v: Visitor): { label: string; variant: BadgeVariant } {
  if (v.isActive) {
    if (isVisitorInside(v)) return { label: "Binada", variant: "success" };
    return { label: "Aktif", variant: "default" };
  }
  if (v.visitorStatus === "expired") return { label: "Süresi Doldu", variant: "destructive" };
  if (v.visitorStatus === "checkedOut") return { label: "Çıkış Yapıldı", variant: "secondary" };
  if (v.visitorStatus === "preRegistered") return { label: "Ön Kayıt", variant: "outline" };
  return { label: "Pasif", variant: "secondary" };
}
