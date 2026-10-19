/** Raporlar modülü grup sözleşmesi: sidebar, hub ve route'lar bu listeyi paylaşır. */
export type ReportGroupKey = "kayitlar" | "gunluk" | "aylik" | "resmi";

export interface ReportGroupMeta {
  key: ReportGroupKey;
  label: string;
  description: string;
}

export const REPORT_GROUPS: readonly ReportGroupMeta[] = [
  { key: "kayitlar", label: "Kayıtlar", description: "Cihazlardan gelen ham geçiş kayıtları" },
  { key: "gunluk", label: "Günlük", description: "Kişi × gün puantaj, geç kalma, devamsızlık ve fazla mesai" },
  { key: "aylik", label: "Aylık", description: "Aylık durum ve puantaj özetleri" },
  { key: "resmi", label: "Resmi", description: "SGK ve maliyet raporları (Ayarlar → Raporlar)" },
];

export const REPORTS_BASE_PATH = "/reports";

export function isReportGroupKey(value: string | undefined): value is ReportGroupKey {
  return REPORT_GROUPS.some(group => group.key === value);
}

export function reportGroupPath(group: ReportGroupKey, slug?: string): string {
  return slug ? `${REPORTS_BASE_PATH}/${group}/${slug}` : `${REPORTS_BASE_PATH}/${group}`;
}
