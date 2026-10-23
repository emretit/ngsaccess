import { permissionCapabilities } from "./capabilities";
import { ROLE_DEFAULTS, legacyRoleToProjectRole, type Permission } from "../../convex/lib/roleCatalog";
import { Activity, BarChart3, BellRing, ClipboardList, Cpu, DoorOpen, FileText, Home, Palmtree, Settings, Shield, ShieldCheck, Users, Wrench, User, type LucideIcon } from "lucide-react";

export interface RouteMeta { href: string; name: string; icon: LucideIcon; adminOnly?: boolean; permission?: Permission; settings?: boolean; superAdminOnly?: boolean; menu?: boolean; badge?: "Yakında"; group?: "main" | "attendance" | "management" }
export const routeMeta: RouteMeta[] = [
  { href: "/home", group: "main", name: "Ana Sayfa", icon: Home },
  { href: "/employees", group: "main", name: "Kişiler", icon: Users, permission: "employees.view" },
  { href: "/devices", group: "main", name: "Cihazlar", icon: Cpu },
  { href: "/access-control", group: "main", name: "Geçiş Kontrol", icon: Shield },
  { href: "/visitors", group: "main", name: "Ziyaretçiler", icon: DoorOpen },
  { href: "/live-monitoring", group: "main", name: "Canlı İzleme", icon: Activity },
  { href: "/pdks-records", group: "attendance", name: "PDKS", icon: FileText },
  { href: "/leaves", group: "attendance", name: "İzinler", icon: Palmtree },
  { href: "/reports", group: "attendance", name: "Raporlar", icon: BarChart3, permission: "reports.view" },
  { href: "/alarms", group: "management", name: "Alarmlar", icon: BellRing },
  { href: "/audit-log", group: "management", name: "Denetim Kaydı", icon: ClipboardList, permission: "admin.manage" },
  { href: "/engineering-department", name: "Mühendislik", icon: Wrench, menu: false },
  { href: "/system-admin", group: "management", name: "Admin", icon: ShieldCheck, superAdminOnly: true },
  { href: "/settings", group: "management", name: "Ayarlar", icon: Settings, settings: true },
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
export function visibleRoutes(role: string | undefined, includeProfile = false, can?: (permission: Permission) => boolean): RouteMeta[] {
  // Compatibility callers without a permission snapshot use catalog defaults.
  const allowed = can ?? ((permission: Permission) => Boolean(role) && (role === "super_admin" || ROLE_DEFAULTS[legacyRoleToProjectRole(role)].includes(permission)));
  const access = permissionCapabilities(allowed, role ?? null);
  return routeMeta.filter(item => (item.menu !== false || (includeProfile && item.href === "/profile")) &&
    (!item.permission || allowed(item.permission)) && (!item.settings || access.settingsTabs.length > 0) && (!item.adminOnly || access.admin) && (!item.superAdminOnly || access.systemAdmin));
}
