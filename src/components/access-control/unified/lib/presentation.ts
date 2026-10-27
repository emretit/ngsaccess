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
/** Only non-zero counts, in display order; empty when the run had no targets. */
export function runCountParts(counts: Record<TargetStatus, number>) {
  const labels: [TargetStatus, string][] = [
    ["verified", "cihazda doğrulandı"],
    ["sent", "gönderildi (teslim kanıtı yok)"],
    ["queued", "kuyrukta"],
    ["failed", "başarısız"],
    ["skipped", "atlandı"],
    ["unknown", "bilinmiyor"],
  ];
  return labels
    .filter(([status]) => counts[status] > 0)
    .map(([status, label]) => `${counts[status]} ${label}`);
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
export function runTone(status: keyof typeof runLabels) {
  return status === "done"
    ? "success"
    : status === "failed"
      ? "danger"
      : status === "partial"
        ? "warning"
        : "info";
}
export const runKindLabels = {
  project_resync: "Proje gönderimi",
  template_sync: "Şablon gönderimi",
  rule_sync: "Kural gönderimi",
};

export function runDisplay(
  status: keyof typeof runLabels,
  counts: Pick<Record<TargetStatus, number>, "sent" | "verified">,
) {
  if (status === "partial" && counts.sent + counts.verified === 0) {
    return { label: "Gönderilemedi", tone: "danger" } as const;
  }
  return { label: runLabels[status], tone: runTone(status) } as const;
}
