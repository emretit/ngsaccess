import { WEEKDAYS, formatWeekdaysAbbr, sortWeekdays } from "../components/weekdays";

export type TargetStatus =
  | "queued"
  | "sent"
  | "verified"
  | "failed"
  | "skipped"
  | "unknown";
export const targetLabels: Record<TargetStatus, string> = {
  queued: "Kuyrukta",
  sent: "Cihaza gönderildi",
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
  return `${counts.queued} kuyrukta · ${counts.sent} kayıt cihaza gönderildi · ${counts.verified} cihazda doğrulandı · ${counts.failed} başarısız · ${counts.skipped} atlandı · ${counts.unknown} bilinmiyor`;
}
/** Only non-zero counts, in display order; empty when the run had no targets. */
export function runCountParts(counts: Record<TargetStatus, number>) {
  const labels: [TargetStatus, string][] = [
    ["verified", "cihazda doğrulandı"],
    ["sent", "kayıt cihaza gönderildi"],
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

export function ruleDaysSummary(days: string[]) {
  const sorted = sortWeekdays([...new Set(days)]);
  if (sorted.length === 0) return "Gün seçilmedi";
  const indices = sorted.map((day) => WEEKDAYS.findIndex((item) => item.value === day));
  if (sorted.length > 2 && indices.every((index, i) => index >= 0 && (i === 0 || index === indices[i - 1] + 1))) {
    return `${formatWeekdaysAbbr(sorted.slice(0, 1))}–${formatWeekdaysAbbr(sorted.slice(-1))}`;
  }
  return formatWeekdaysAbbr(sorted);
}
