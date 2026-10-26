import { getProjectRole, requirePermission } from "./permissions";
import type { QueryCtx } from "../_generated/server";
import { accessBlockReason } from "./accountAccess";
import type { Doc, Id } from "../_generated/dataModel";
/** Compare stored membership sets; ordering and legacy duplicate rows are irrelevant. */
export function membershipChanged(
  liveProjectIds: readonly Id<"projects">[],
  expectedProjectIds: readonly Id<"projects">[] | undefined,
): boolean {
  if (expectedProjectIds === undefined) return false;
  const live = new Set(liveProjectIds);
  const expected = new Set(expectedProjectIds);
  return live.size !== expected.size || [...expected].some(id => !live.has(id));
}

export function userProtectionError({
  isSelf, isSuperAdmin, removesSuperAdmin, adminCount, deleting,
}: {
  isSelf: boolean;
  isSuperAdmin: boolean;
  removesSuperAdmin: boolean;
  adminCount: number;
  deleting: boolean;
}): string | null {
  if (isSuperAdmin && removesSuperAdmin && adminCount <= 1) {
    return deleting
      ? "Sistemdeki son süper admin silinemez"
      : "Sistemdeki son süper adminin rolü düşürülemez";
  }
  if (isSelf && (deleting || removesSuperAdmin)) {
    return deleting ? "Kendi hesabınızı silemezsiniz" : "Kendi rolünüzü düşüremezsiniz";
  }
  return null;
}

/** Every projectId table has one policy; schema coverage is tested. Histories retain their project reference. */
export const projectDeletionMatrix = [
  { table: "employees", index: "by_project", label: "personel", policy: "block" },
  { table: "devices", index: "by_project", label: "cihaz", policy: "block" },
  { table: "zones", index: "by_project", label: "bölge", policy: "block" },
  { table: "doors", index: "by_project", label: "kapı", policy: "block" },
  { table: "readers", index: "by_project", label: "okuyucu", policy: "block" },
  { table: "hikBridges", index: "by_project", label: "Hikvision köprüsü", policy: "block" },
  { table: "accessRules", index: "by_project", label: "erişim kuralı", policy: "block" },
  { table: "cardReadings", index: "by_project", label: "kart okuma kaydı", policy: "block" },
  { table: "pdksRecords", index: "by_project", label: "PDKS kaydı", policy: "block" },
  { table: "leaves", index: "by_project", label: "izin", policy: "block" },
  { table: "shifts", index: "by_project", label: "vardiya", policy: "block" },
  { table: "shiftAssignments", index: "by_project", label: "vardiya ataması", policy: "block" },
  { table: "departmentShiftAssignments", index: "by_project_end", label: "departman vardiya ataması", policy: "block" },
  { table: "shiftPlanRefs", index: "by_project", label: "vardiya planı referansı", policy: "block" },
  { table: "companies", index: "by_project", label: "firma", policy: "block" },
  { table: "departments", index: "by_project", label: "departman", policy: "block" },
  { table: "positions", index: "by_project", label: "pozisyon", policy: "block" },
  { table: "employeeFaces", index: "by_project", label: "yüz kaydı", policy: "block" },
  { table: "employeeFingerprints", index: "by_project", label: "parmak izi kaydı", policy: "block" },
  { table: "groupMembers", index: "by_project_employee", label: "grup üyeliği", policy: "block" },
  { table: "groupDevices", index: "by_project_device", label: "grup cihaz bağlantısı", policy: "block" },
  { table: "groupDoors", index: "by_project_group", label: "grup kapı bağlantısı", policy: "block" },
  { table: "deviceEvents", index: "by_project", label: "cihaz olayı", policy: "block" },
  { table: "attendanceCorrections", index: "by_project_status", label: "puantaj düzeltmesi", policy: "block" },
  { table: "deviceFingerprintEnrollments", index: "scan", label: "cihaz parmak izi kaydı", policy: "block" },
  { table: "userProjects", index: "by_project", label: "Kullanıcı proje üyelikleri", policy: "delete" },
  { table: "generalSettings", index: "by_project", label: "Genel ayarlar", policy: "delete" },
  { table: "mailSettings", index: "by_project", label: "E-posta ayarları", policy: "delete" },
  { table: "notificationSettings", index: "by_project", label: "Bildirim ayarları", policy: "delete" },
  { table: "workSettings", index: "by_project", label: "Çalışma ayarları", policy: "delete" },
  { table: "overtimeRates", index: "by_project", label: "Fazla mesai oranları", policy: "delete" },
  { table: "holidays", index: "by_project", label: "Tatiller", policy: "delete" },
  { table: "reportScheduleSettings", index: "by_project", label: "Rapor zamanlamaları", policy: "delete" },
  { table: "leaveBalances", index: "by_project", label: "İzin bakiyeleri", policy: "delete" },
  { table: "chatConversations", index: "by_project", label: "Sohbetler", policy: "delete" },
  { table: "projectPrivacySettings", index: "by_project", label: "Gizlilik ayarları", policy: "delete" },
  { table: "projectRolePermissions", index: "by_projectId_and_role", label: "Rol yetkileri", policy: "delete" },
  { table: "invites", index: "scan", label: "Davetler", policy: "delete" },
  { table: "alarmSettings", index: "by_project", label: "Alarm ayarları", policy: "delete" },
  { table: "pdksRuleVersions", index: "by_projectId_and_effectiveFrom", label: "PDKS kural sürümleri", policy: "delete" },
  { table: "pdksCheckpointSelections", index: "scan", label: "PDKS kontrol noktaları", policy: "delete" },
  { table: "accessScheduleTemplates", index: "by_project", label: "Erişim takvim şablonları", policy: "delete" },
  { table: "checkInTokens", index: "scan", label: "Mobil giriş tokenları", policy: "delete" },
  { table: "employeeAuth", index: "scan", label: "Kişi kimlik bilgileri", policy: "delete" },
  { table: "idePanelUsers", index: "scan", label: "Panel kişi kopyaları", policy: "preserve" },
  { table: "auditLog", index: "by_project_timestamp", label: "Denetim geçmişi", policy: "preserve" },
  { table: "accessGrantStatus", index: "by_project_state", label: "Yetki geçmişi", policy: "preserve" },
  { table: "deviceSyncRuns", index: "by_project_started", label: "Cihaz gönderim geçmişi", policy: "preserve" },
  { table: "mobileAccessOperations", index: "scan", label: "Mobil işlem geçmişi", policy: "preserve" },
  { table: "hikPendingOperations", index: "by_project_status_created", label: "Hik işlem geçmişi", policy: "preserve" },
  { table: "idePendingOperations", index: "by_project_status_created", label: "IDE işlem geçmişi", policy: "preserve" },
] as const;

export const projectDeletionBlockingTables = projectDeletionMatrix.filter(entry => entry.policy === "block");
export const projectDeletionCleanupTables = projectDeletionMatrix.filter(entry => entry.policy === "delete").map(entry => entry.table);

export function projectDeletionBlockers(counts: Readonly<Partial<Record<string, number>>>): string[] {
  return projectDeletionBlockingTables
    .map(({ table, label }) => linkedCountLabel(counts[table] ?? 0, label))
    .filter((label): label is string => label !== null);
}

export function linkedCountLabel(count: number, label: string): string | null {
  return count === 0 ? null : `${count >= 101 ? "en az " : ""}${count} ${label}`;
}

export function projectDeletionError(linked: string[]): string | null {
  return linked.length === 0 ? null
    : `Bu projeye bağlı ${linked.join(", ")} var; önce bunları taşıyın veya silin. Geçmiş kayıtlarını korumak için projeyi pasife alabilirsiniz.`;
}

export function reportSchedulePayload(reportType: string, email: string, enabled: boolean) {
  const trimmedEmail = email.trim();
  if (enabled && !trimmedEmail) throw new Error("E-posta adresi girin");
  return { reportType, email: trimmedEmail, enabled };
}

/** Shared bounded blocker read, also rerun by remove inside its transaction. */
export async function projectDeletionCounts(ctx: Pick<QueryCtx, "db">, projectId: Id<"projects">) {
  const counts = await Promise.all(projectDeletionBlockingTables.map(async entry => {
    const rows = await projectDeletionTableQuery(ctx, entry, projectId).take(101);
    return [entry.table, rows.length] as const;
  }));
  return Object.fromEntries(counts);
}

export function projectDeletionImpactRows(counts: Readonly<Partial<Record<string, number>>>) {
  const row = (table: string, label: string) => ({
    table, label, count: Math.min(counts[table] ?? 0, 100), capped: (counts[table] ?? 0) > 100,
  });
  const blockers = projectDeletionBlockingTables.filter(entry => (counts[entry.table] ?? 0) > 0)
    .map(entry => row(entry.table, entry.label));
  const cleanup = projectDeletionCleanupTables.filter(table => (counts[table] ?? 0) > 0)
    .map(table => row(table, projectDeletionMatrix.find(entry => entry.table === table)?.label ?? table));
  return { canDelete: blockers.length === 0, blockers, cleanup };
}

export async function projectDeletionImpact(ctx: Pick<QueryCtx, "db">, projectId: Id<"projects">) {
  const counts = await projectDeletionCounts(ctx, projectId);
  for (const table of projectDeletionCleanupTables) {
    // Same cleanup predicate as remove; invites has no project index.
    const rows = await projectDeletionCleanupQuery(ctx, table, projectId).take(101);
    counts[table] = rows.length;
  }
  return projectDeletionImpactRows(counts);
}

/** Keep preview and transactional cleanup on exactly the same table predicates. */
export function projectDeletionCleanupQuery(
  ctx: Pick<QueryCtx, "db">,
  table: typeof projectDeletionCleanupTables[number],
  projectId: Id<"projects">,
) {
  const entry = projectDeletionMatrix.find(entry => entry.table === table);
  if (!entry) throw new Error("Proje silme politikası bulunamadı");
  return projectDeletionTableQuery(ctx, entry, projectId);
}

/** Tables without a project index use a bounded result scan; no collect. */
function projectDeletionTableQuery(
  ctx: Pick<QueryCtx, "db">,
  entry: typeof projectDeletionMatrix[number],
  projectId: Id<"projects">,
) {
  if (entry.index === "scan") return ctx.db.query(entry.table).filter(q => q.eq(q.field("projectId"), projectId));
  // Narrow the discriminated entry before selecting its schema-checked index.
  if (entry.index === "by_project") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_end") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_employee") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_device") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_group") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_status") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_projectId_and_role") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_projectId_and_effectiveFrom") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_timestamp") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_state") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_started") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  if (entry.index === "by_project_status_created") return ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId));
  throw new Error("Proje silme indeksi bulunamadı");
}

/** Stop after two active admins; fail closed if the bounded scan is exhausted. */
export async function activeSuperAdminCount(
  ctx: Pick<QueryCtx, "db">,
  options: { excludeId?: Id<"users">; requireNoExpiry?: boolean } = {},
): Promise<number> {
  const rows = await ctx.db.query("users").withIndex("by_role", q => q.eq("role", "super_admin")).take(1001);
  let count = 0;
  for (const user of rows) {
    if (user._id === options.excludeId) continue;
    if (accessBlockReason(user, Date.now()) === null &&
      (user.accessExpiresAt === undefined || options.requireNoExpiry !== true) &&
      ++count === 2) return count;
  }
  if (rows.length > 1000) throw new Error("Yönetici sınırı aşıldı; işlem güvenle tamamlanamadı");
  return count;
}

export async function requireAccountAccessTarget(
  ctx: Pick<QueryCtx, "db">,
  caller: Doc<"users">,
  userId: Id<"users">,
  restrictAccess: boolean,
): Promise<Doc<"users">> {
  if (caller._id === userId) throw new Error("Kendi hesabınız için bu işlemi yapamazsınız");
  const target = await ctx.db.get(userId);
  if (!target) throw new Error("Kullanıcı bulunamadı");
  if (caller.role !== "super_admin") {
    if (target.role === "super_admin") throw new Error("Bu işlem için yetkiniz yok");
    const memberships = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", userId)).take(1001);
    if (memberships.length === 0 || memberships.length > 1000) throw new Error("Bu kullanıcı başka projelerde de üye; yalnız sistem yöneticisi işlem yapabilir");
    for (const { projectId } of memberships) {
      if (await getProjectRole(ctx, target, projectId) === "admin") throw new Error("Bu işlem için yetkiniz yok");
      await requirePermission(ctx, caller, projectId, "admin.manage");
    }
  }
  if (restrictAccess && target.role === "super_admin" && await activeSuperAdminCount(ctx, {
    excludeId: userId, requireNoExpiry: true,
  }) === 0) {
    throw new Error("Sistemdeki son etkin süper adminin erişimi kısıtlanamaz");
  }
  return target;
}
