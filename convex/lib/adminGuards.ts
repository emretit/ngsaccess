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
