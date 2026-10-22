import { trDayRangeISO } from "./trDate";

export const AUDIT_TARGET_LABELS: Record<string, string> = {
  shiftAssignments: "Vardiya atamaları",
  pdksRuleVersions: "PDKS kuralları",
  users: "Kullanıcılar",
  projectPrivacySettings: "Proje gizlilik ayarları",
  cardReadings: "Kart okumaları",
  biometricDestructionRun: "Biyometrik imha durumu",
  biometricDestruction: "Biyometrik imha tutanağı",
  biometricDestructionCheck: "Biyometrik cihaz kontrolü",
  biometricDestructionDeviceCheck: "Biyometrik cihaz kontrolü",
  biometricDestructionDevice: "Biyometrik cihaz imhası",
  pdksRecords: "PDKS kaydı",
  holidays: "Tatil",
  overtimeRates: "Mesai oranı",
  employees: "Çalışan",
  employeeConsents: "Çalışan izni / Ziyaretçi onayı",
  deviceEvents: "Cihaz olayı / Alarm",
  attendanceCorrections: "PDKS düzeltme talebi",
  alarmSettings: "Alarm bildirim ayarı",
  leaves: "İzin",
};

export function auditDateRange(startDate?: string, endDate?: string) {
  for (const date of [startDate, endDate]) {
    if (!date) continue;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    ) {
      throw new Error("Geçerli bir tarih girin");
    }
  }
  if (startDate && endDate && startDate > endDate)
    throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz");
  const range = trDayRangeISO(
    startDate || "0001-01-01",
    endDate || "9999-12-31",
  );
  return {
    startTimestamp: Date.parse(range.startISO),
    endTimestamp: Date.parse(range.endISO),
  };
}

export function auditIndex(
  projectId?: string,
  targetTable?: string,
  userId?: string,
  action?: string,
) {
  if (action)
    return projectId ? "by_project_action_timestamp" : "by_action_timestamp";
  if (projectId)
    return targetTable
      ? "by_project_table_timestamp"
      : userId
        ? "by_project_user_timestamp"
        : "by_project_timestamp";
  return targetTable
    ? "by_table_timestamp"
    : userId
      ? "by_user_timestamp"
      : "by_timestamp";
}

export function auditPageMatches(
  row: {
    userId?: string;
    action: string;
    targetTable: string;
    targetId: string;
    userName?: string;
    note?: string;
    oldValue?: unknown;
    newValue?: unknown;
  },
  filters: {
    userId?: string;
    action?: string;
    targetTable?: string;
    search?: string;
  },
) {
  if (filters.targetTable && row.targetTable !== filters.targetTable)
    return false;
  if (filters.userId && row.userId !== filters.userId) return false;
  if (filters.action && row.action !== filters.action) return false;
  const search = filters.search?.trim().toLocaleLowerCase("tr-TR");
  return (
    !search ||
    [
      row.targetId,
      row.targetTable,
      AUDIT_TARGET_LABELS[row.targetTable],
      row.userName,
      row.note,
      JSON.stringify(row.oldValue),
      JSON.stringify(row.newValue),
    ].some((value) => value?.toLocaleLowerCase("tr-TR").includes(search))
  );
}
