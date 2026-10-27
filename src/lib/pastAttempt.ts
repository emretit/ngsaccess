import { formatTrDateTime } from "@/lib/date";

/** Stored reasons describe the device at attempt time; reword the ones that read as current state. */
const PAST_REASONS: Record<string, string> = {
  "Cihaz çevrimdışı": "cihaz o sırada çevrimdışıydı",
  "Cihaz pasif": "cihaz o sırada pasifti",
};

/** A stored failure is history, not live device state: always tie it to its attempt time.
 * "Son deneme 22.10.2026 13:09 · cihaz o sırada çevrimdışıydı" */
export function pastAttemptText(at: number | string | null | undefined, reason?: string | null): string {
  const time = typeof at === "string" ? Date.parse(at) : at;
  const when = typeof time === "number" && Number.isFinite(time) && time > 0 ? formatTrDateTime(time) : null;
  const trimmed = reason?.trim();
  const text = trimmed ? PAST_REASONS[trimmed] ?? trimmed : null;
  if (when && text) return `Son deneme ${when} · ${text}`;
  if (when) return `Son deneme ${when}`;
  return text ? `Son denemede: ${text}` : "Son deneme başarısız";
}
