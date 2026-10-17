export type TargetStatus =
  | "queued"
  | "sent"
  | "verified"
  | "failed"
  | "skipped"
  | "unknown";
export const targetLabels: Record<TargetStatus, string> = {
  queued: "Kuyrukta",
  sent: "Gönderildi · teslim kanıtı yok",
  verified: "Cihazda doğrulandı",
  failed: "Başarısız",
  skipped: "Atlandı",
  unknown: "Bilinmiyor",
};
export function targetTone(status: TargetStatus) {
  return status === "verified"
    ? "success"
    : status === "failed"
      ? "danger"
      : status === "unknown"
        ? "warning"
        : status === "queued"
          ? "info"
          : "neutral";
}
export function runSummary(counts: Record<TargetStatus, number>) {
  return `${counts.queued} kuyrukta · ${counts.sent} gönderildi (teslim kanıtı yok) · ${counts.verified} cihazda doğrulandı · ${counts.failed} başarısız · ${counts.skipped} atlandı · ${counts.unknown} bilinmiyor`;
}
export function ruleTypeMatches(
  targetType: string | undefined,
  filter: string,
) {
  return (
    filter === "all" ||
    (filter === "visitor" ? targetType === "visitor" : targetType !== "visitor")
  );
}
export const runLabels = {
  running: "İşleniyor",
  done: "Tamamlandı",
  partial: "Kısmi sonuç",
  failed: "Başarısız",
};
