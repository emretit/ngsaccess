import { capabilities } from "./capabilities";
import { Activity, BarChart3, BellRing, CalendarClock, ClipboardList, Cpu, DoorOpen, FileText, Home, Palmtree, Settings, Shield, ShieldCheck, Users, Wrench, ScanLine, User, type LucideIcon } from "lucide-react";

export interface RouteMeta { href: string; name: string; icon: LucideIcon; adminOnly?: boolean; superAdminOnly?: boolean; menu?: boolean; badge?: "Yakında"; group?: "main" | "attendance" | "management" }
export const routeMeta: RouteMeta[] = [
  { href: "/home", group: "main", name: "Ana Sayfa", icon: Home },
  { href: "/employees", group: "main", name: "Kişiler", icon: Users },
  { href: "/devices", group: "main", name: "Cihazlar", icon: Cpu },
  { href: "/virtual-readers", group: "main", name: "Sanal Okuyucular", icon: ScanLine, badge: "Yakında" },
  { href: "/access-control", group: "main", name: "Geçiş Kontrol", icon: Shield },
  { href: "/visitors", group: "main", name: "Ziyaretçiler", icon: DoorOpen },
  { href: "/live-monitoring", group: "main", name: "Canlı İzleme", icon: Activity },
  { href: "/pdks-records", group: "attendance", name: "PDKS Kayıtları", icon: FileText },
  { href: "/shifts", group: "attendance", name: "Vardiyalar", icon: CalendarClock },
  { href: "/leaves", group: "attendance", name: "İzinler", icon: Palmtree },
  { href: "/reports", group: "attendance", name: "Raporlar", icon: BarChart3 },
  { href: "/alarms", group: "management", name: "Alarmlar", icon: BellRing, adminOnly: true },
  { href: "/audit-log", group: "management", name: "Denetim Kaydı", icon: ClipboardList, adminOnly: true },
  { href: "/engineering-department", name: "Mühendislik", icon: Wrench, menu: false },
  { href: "/system-admin", group: "management", name: "Admin", icon: ShieldCheck, superAdminOnly: true },
  { href: "/settings", group: "management", name: "Ayarlar", icon: Settings, adminOnly: true },
  { href: "/profile", name: "Profil", icon: User, menu: false },
];

const hasUnsafeCharacters = (value: string) => [...value].some(char => char === "\\" || char.charCodeAt(0) <= 32);

/** Dönüş hedefi aynı origin içindeki uygulama yoludur; query/hash aynen korunur. */
export function safeReturnPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || hasUnsafeCharacters(next)) return "/home";
  try {
    const decoded = decodeURIComponent(next.split(/[?#]/)[0]);
    if (decoded.startsWith("//") || hasUnsafeCharacters(decoded)) return "/home";
    const url = new URL(next, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || ["/login", "/register", "/auth", "/verify-email"].includes(new URL(decoded, "https://app.invalid").pathname)) return "/home";
    return url.pathname + url.search + url.hash;
  } catch { return "/home"; }
}

/** Shared visibility source for shell, navigation search and quick links. */
export function visibleRoutes(role: string | undefined, includeProfile = false): RouteMeta[] {
  const access = capabilities(role);
  return routeMeta.filter(item => (item.menu !== false || (includeProfile && item.href === "/profile")) &&
    (!item.adminOnly || access.admin) && (!item.superAdminOnly || access.systemAdmin));
}
