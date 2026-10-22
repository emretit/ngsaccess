import { v, type Infer } from "convex/values";

/**
 * Sabit proje rolleri ve yetki anahtarları — tek kaynak (backend + frontend).
 * Tasarım ve varsayılan tablo: docs/roles/PLAN.md. Saf modül: ctx/_generated içe aktarmaz.
 */

export const PROJECT_ROLES = ["admin", "hr", "security", "technician", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PERMISSIONS = [
  "employees.view",
  "employees.manage",
  "biometrics.manage",
  "pay.view",
  "schedule.manage",
  "attendance.approve",
  "reports.view",
  "visitors.manage",
  "doors.open",
  "alarms.ack",
  "devices.manage",
  "accessRules.manage",
  "admin.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const projectRoleValidator = v.union(
  v.literal("admin"),
  v.literal("hr"),
  v.literal("security"),
  v.literal("technician"),
  v.literal("viewer"),
);

export const permissionValidator = v.union(
  v.literal("employees.view"),
  v.literal("employees.manage"),
  v.literal("biometrics.manage"),
  v.literal("pay.view"),
  v.literal("schedule.manage"),
  v.literal("attendance.approve"),
  v.literal("reports.view"),
  v.literal("visitors.manage"),
  v.literal("doors.open"),
  v.literal("alarms.ack"),
  v.literal("devices.manage"),
  v.literal("accessRules.manage"),
  v.literal("admin.manage"),
);

/** Davet rolü: eski kayıtlar project_admin/project_user taşır, yenileri proje rolü. */
export const inviteRoleValidator = v.union(v.literal("project_admin"), v.literal("project_user"), projectRoleValidator);

export const ROLE_LABELS: Record<ProjectRole, string> = {
  admin: "Yönetici",
  hr: "İK/PDKS",
  security: "Güvenlik",
  technician: "Teknik",
  viewer: "Görüntüleyici",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "employees.view": "Personeli görüntüleme",
  "employees.manage": "Personel ekleme/düzenleme",
  "biometrics.manage": "Biyometrik kayıt (yüz/parmak izi)",
  "pay.view": "Ücret bilgisini görme",
  "schedule.manage": "Vardiya, tatil ve PDKS kuralları",
  "attendance.approve": "İzin onayı, PDKS düzeltme",
  "reports.view": "Raporlar",
  "visitors.manage": "Ziyaretçi yönetimi",
  "doors.open": "Uzaktan kapı açma",
  "alarms.ack": "Alarm onaylama",
  "devices.manage": "Cihaz, kapı ve okuyucu yönetimi",
  "accessRules.manage": "Erişim kuralları",
  "admin.manage": "Kullanıcılar, roller, ayarlar, denetim kaydı",
};

/** Emre onaylı varsayılan tablo (2026-10-22). Sıra PERMISSIONS ile aynı tutulur. */
export const ROLE_DEFAULTS: Record<ProjectRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  hr: [
    "employees.view",
    "employees.manage",
    "biometrics.manage",
    "pay.view",
    "schedule.manage",
    "attendance.approve",
    "reports.view",
  ],
  security: ["employees.view", "reports.view", "visitors.manage", "doors.open", "alarms.ack"],
  technician: ["employees.view", "doors.open", "alarms.ack", "devices.manage", "accessRules.manage"],
  viewer: ["employees.view", "reports.view", "doors.open"],
};

/** Yalnız "admin" rolünde bulunur; başka role verilemez (kendini yükseltme engeli). */
export const ADMIN_ONLY_PERMISSIONS: readonly Permission[] = ["admin.manage"];

/** Yetkileri değiştirilemeyen rol. */
export const LOCKED_ROLE: ProjectRole = "admin";

export function isProjectRole(value: unknown): value is ProjectRole {
  return typeof value === "string" && (PROJECT_ROLES as readonly string[]).includes(value);
}

/**
 * Eski global rol / davet rolü → proje rolü. userProjects.role boşken ve eski davetlerde kullanılır.
 * project_admin / super_admin → admin; diğer her şey (project_user, undefined) → viewer.
 */
export function legacyRoleToProjectRole(role: string | undefined): ProjectRole {
  if (isProjectRole(role)) return role;
  const legacy: Readonly<Record<string, ProjectRole>> = { project_admin: "admin", super_admin: "admin" };
  return role ? legacy[role] ?? "viewer" : "viewer";
}

/**
 * Kaydedilecek yetki listesini kanonik hale getirir: tekrarları ve admin-yalnız anahtarları atar,
 * PERMISSIONS sırasına dizer. Kilitli rol için her zaman tam liste döner.
 */
export function normalizeRolePermissions(role: ProjectRole, permissions: readonly Permission[]): Permission[] {
  if (role === LOCKED_ROLE) return [...PERMISSIONS];
  const wanted = new Set(permissions);
  return PERMISSIONS.filter((p) => wanted.has(p) && !ADMIN_ONLY_PERMISSIONS.includes(p));
}

export function isDefaultPermissionSet(role: ProjectRole, permissions: readonly Permission[]): boolean {
  const normalized = normalizeRolePermissions(role, permissions);
  const defaults = normalizeRolePermissions(role, ROLE_DEFAULTS[role]);
  return normalized.length === defaults.length && normalized.every((p, i) => p === defaults[i]);
}

// Validator and catalog must describe exactly the same unions in both directions.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type CatalogValidatorAssertions = [
  Assert<Equal<Infer<typeof projectRoleValidator>, ProjectRole>>,
  Assert<Equal<Infer<typeof permissionValidator>, Permission>>,
];
