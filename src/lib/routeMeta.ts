import { REPORT_GROUPS, isReportGroupKey, reportGroupPath } from "./reports/groups";
import { getReport } from "./reports/registry";
import { permissionCapabilities } from "./capabilities";
import { ROLE_DEFAULTS, legacyRoleToProjectRole, type Permission } from "../../convex/lib/roleCatalog";
import { Activity, BarChart3, BellRing, ClipboardList, Cpu, DoorOpen, FileText, Home, Palmtree, Settings, Shield, ShieldCheck, Users, Wrench, User, type LucideIcon } from "lucide-react";

export interface RouteMeta { href: string; name: string; icon: LucideIcon; adminOnly?: boolean; permission?: Permission; anyPermission?: readonly Permission[]; settings?: boolean; superAdminOnly?: boolean; menu?: boolean; badge?: "Yakında"; group?: "main" | "attendance" | "management" }
export const routeMeta: RouteMeta[] = [
  { href: "/home", group: "main", name: "Ana Sayfa", icon: Home },
  { href: "/employees", group: "main", name: "Kişiler", icon: Users, permission: "employees.view" },
  { href: "/devices", group: "main", name: "Cihazlar", icon: Cpu },
  { href: "/access-control", group: "main", name: "Geçiş Kontrol", icon: Shield },
  { href: "/visitors", group: "main", name: "Ziyaretçiler", icon: DoorOpen, anyPermission: ["visitors.manage", "reports.view"] },
  { href: "/live-monitoring", group: "main", name: "Canlı İzleme", icon: Activity, anyPermission: ["reports.view", "devices.manage"] },
  { href: "/pdks-records", group: "attendance", name: "PDKS", icon: FileText, permission: "reports.view" },
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
    canAccessRoute(item, allowed) && (!item.settings || access.settingsTabs.length > 0) && (!item.adminOnly || access.admin) && (!item.superAdminOnly || access.systemAdmin));
}

/** Okuma verisi gösteren sayfaların doğrudan erişim kararı; korunmayan yolda null.
 * /pdks-records/settings kendi yetkisini (schedule.manage) denetler. Vardiya planı
 * reports.view veya schedule.manage ile açılır. */
export function readingRouteAccess(pathname: string, search: string, can: (permission: Permission) => boolean): boolean | null {
  if (pathname === "/pdks-records/plan") return can("reports.view") || can("schedule.manage");
  const route = routeMeta.find(item => item.href === "/live-monitoring"
    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
    : item.href === "/pdks-records" && pathname === item.href);
  if (!route) return null;
  if (route.href === "/pdks-records" && new URLSearchParams(search).get("plan") === "1") return can("reports.view") || can("schedule.manage");
  return canAccessRoute(route, can);
}

/** Navigation and direct route access share the same permission rules. */
export function canAccessRoute(route: RouteMeta, can: (permission: Permission) => boolean): boolean {
  return (!route.permission || can(route.permission)) && (!route.anyPermission || route.anyPermission.some(can));
}

export interface RouteBreadcrumb { name: string; href?: string }

/** Display context is independent of menu entries and permission metadata. */
export function resolveRouteContext(pathname: string): { title: string; breadcrumbs: RouteBreadcrumb[] } {
  const base = routeMeta.filter(item => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!base) return { title: "", breadcrumbs: [] };
  const breadcrumbs: RouteBreadcrumb[] = [{ name: "Ana Sayfa", href: "/home" }];
  if (pathname === "/home") return { title: base.name, breadcrumbs: [{ name: base.name }] };
  if (pathname === "/pdks-records/plan" || pathname === "/pdks-records/settings") {
    const title = pathname.endsWith("/plan") ? "Vardiya planı" : "PDKS Ayarları";
    return { title, breadcrumbs: [...breadcrumbs, { name: "PDKS", href: "/pdks-records" }, { name: title }] };
  }
  if (base.href === "/reports" && pathname !== base.href) {
    const [, , group, slug, extra] = pathname.split("/");
    const groupMeta = REPORT_GROUPS.find(item => item.key === group);
    if (groupMeta && isReportGroupKey(group) && !extra) {
      const report = slug ? getReport(group, slug) : undefined;
      const title = slug ? report?.title ?? "Rapor bulunamadı" : group === "resmi" ? "Muhasebe Raporları" : `${groupMeta.label} Raporları`;
      return { title, breadcrumbs: [...breadcrumbs, { name: "Raporlar", href: "/reports" },
        ...(slug ? [{ name: groupMeta.label, href: reportGroupPath(group) }] : []), { name: title }] };
    }
    return { title: "Rapor bulunamadı", breadcrumbs: [...breadcrumbs, { name: "Raporlar", href: "/reports" }, { name: "Rapor bulunamadı" }] };
  }
  return { title: base.name, breadcrumbs: [...breadcrumbs, { name: base.name }] };
}
