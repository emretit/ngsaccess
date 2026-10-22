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

export const projectDeletionBlockingTables = [
  { table: "employees", index: "by_project", label: "personel" },
  { table: "devices", index: "by_project", label: "cihaz" },
  { table: "zones", index: "by_project", label: "bölge" },
  { table: "doors", index: "by_project", label: "kapı" },
  { table: "readers", index: "by_project", label: "okuyucu" },
  { table: "hikBridges", index: "by_project", label: "Hikvision köprüsü" },
  { table: "accessRules", index: "by_project", label: "erişim kuralı" },
  { table: "cardReadings", index: "by_project", label: "kart okuma kaydı" },
  { table: "pdksRecords", index: "by_project", label: "PDKS kaydı" },
  { table: "leaves", index: "by_project", label: "izin" },
  { table: "shifts", index: "by_project", label: "vardiya" },
  { table: "shiftAssignments", index: "by_project", label: "vardiya ataması" },
  { table: "companies", index: "by_project", label: "firma" },
  { table: "departments", index: "by_project", label: "departman" },
  { table: "positions", index: "by_project", label: "pozisyon" },
  { table: "employeeFaces", index: "by_project", label: "yüz kaydı" },
  { table: "employeeFingerprints", index: "by_project", label: "parmak izi kaydı" },
  { table: "groupMembers", index: "by_project_employee", label: "grup üyeliği" },
  { table: "groupDevices", index: "by_project_device", label: "grup cihaz bağlantısı" },
  { table: "groupDoors", index: "by_project_group", label: "grup kapı bağlantısı" },
  { table: "deviceEvents", index: "by_project", label: "cihaz olayı" },
] as const;

export const projectDeletionCleanupTables = [
  "userProjects",
  "generalSettings",
  "mailSettings",
  "notificationSettings",
  "workSettings",
  "overtimeRates",
  "holidays",
  "reportScheduleSettings",
  "leaveBalances",
  "chatConversations",
  "projectPrivacySettings",
  "invites",
] as const;

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
    const rows = entry.index === "by_project"
      ? await ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId)).take(101)
      : entry.index === "by_project_employee"
        ? await ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId)).take(101)
        : entry.index === "by_project_device"
          ? await ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId)).take(101)
          : await ctx.db.query(entry.table).withIndex(entry.index, q => q.eq("projectId", projectId)).take(101);
    return [entry.table, rows.length] as const;
  }));
  return Object.fromEntries(counts);
}

const cleanupLabels: Record<typeof projectDeletionCleanupTables[number], string> = {
  userProjects: "Kullanıcı proje üyelikleri", generalSettings: "Genel ayarlar",
  mailSettings: "E-posta ayarları", notificationSettings: "Bildirim ayarları",
  workSettings: "Çalışma ayarları", overtimeRates: "Fazla mesai oranları",
  holidays: "Tatiller", reportScheduleSettings: "Rapor zamanlamaları",
  leaveBalances: "İzin bakiyeleri", chatConversations: "Sohbetler",
  projectPrivacySettings: "Gizlilik ayarları", invites: "Davetler",
};

export function projectDeletionImpactRows(counts: Readonly<Partial<Record<string, number>>>) {
  const row = (table: string, label: string) => ({
    table, label, count: Math.min(counts[table] ?? 0, 100), capped: (counts[table] ?? 0) > 100,
  });
  const blockers = projectDeletionBlockingTables.filter(entry => (counts[entry.table] ?? 0) > 0)
    .map(entry => row(entry.table, entry.label));
  const cleanup = projectDeletionCleanupTables.filter(table => (counts[table] ?? 0) > 0)
    .map(table => row(table, cleanupLabels[table]));
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
  return table === "invites"
    ? ctx.db.query(table).filter(q => q.eq(q.field("projectId"), projectId))
    : ctx.db.query(table).withIndex("by_project", q => q.eq("projectId", projectId));
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
    if (caller.role !== "project_admin" || target.role !== "project_user") throw new Error("Bu işlem için yetkiniz yok");
    const own = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", caller._id)).take(1001);
    const memberships = await ctx.db.query("userProjects").withIndex("by_user", q => q.eq("userId", userId)).take(1001);
    if (memberships.length === 0 || own.length > 1000 || memberships.length > 1000 || memberships.some(row => !own.some(p => p.projectId === row.projectId))) {
      throw new Error("Bu kullanıcı başka projelerde de üye; yalnız sistem yöneticisi işlem yapabilir");
    }
  }
  if (restrictAccess && target.role === "super_admin" && await activeSuperAdminCount(ctx, {
    excludeId: userId, requireNoExpiry: true,
  }) === 0) {
    throw new Error("Sistemdeki son etkin süper adminin erişimi kısıtlanamaz");
  }
  return target;
}
