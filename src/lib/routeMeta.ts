import { Activity, CalendarClock, ClipboardList, Cpu, DoorOpen, FileText, Home, Palmtree, Settings, Shield, ShieldCheck, Users, Wrench, ScanLine, User, type LucideIcon } from "lucide-react";

export interface RouteMeta { href: string; name: string; icon: LucideIcon; adminOnly?: boolean; superAdminOnly?: boolean; menu?: boolean }
export const routeMeta: RouteMeta[] = [
  { href: "/home", name: "Ana Sayfa", icon: Home },
  { href: "/employees", name: "Kişiler", icon: Users },
  { href: "/devices", name: "Cihazlar", icon: Cpu },
  { href: "/virtual-readers", name: "Sanal Okuyucular", icon: ScanLine },
  { href: "/access-control", name: "Geçiş Kontrol", icon: Shield },
  { href: "/visitors", name: "Ziyaretçiler", icon: DoorOpen },
  { href: "/live-monitoring", name: "Canlı İzleme", icon: Activity },
  { href: "/pdks-records", name: "PDKS Kayıtları", icon: FileText },
  { href: "/shifts", name: "Vardiyalar", icon: CalendarClock },
  { href: "/leaves", name: "İzinler", icon: Palmtree },
  { href: "/audit-log", name: "Denetim Kaydı", icon: ClipboardList, adminOnly: true },
  { href: "/engineering-department", name: "Mühendislik", icon: Wrench, menu: false },
  { href: "/system-admin", name: "Admin", icon: ShieldCheck, superAdminOnly: true },
  { href: "/settings", name: "Ayarlar", icon: Settings, adminOnly: true },
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
