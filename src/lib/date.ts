/**
 * Returns YYYY-MM-DD in the local timezone.
 * Use instead of `date.toISOString().split("T")[0]` which uses UTC and shifts the date
 * for users east/west of UTC near midnight.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDateString(s: string | undefined | null): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function formatDateString(d: Date | undefined): string {
  if (!d) return "";
  return toLocalDateString(d);
}

export function todayInTurkey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Calendar date in Turkey, independent of the browser's timezone. */
export function formatTrDate(value: number | Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatTrDateTime(
  value: number | Date,
  opts?: { seconds?: boolean },
): string {
  const time = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    ...(opts?.seconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).format(value);
  return `${formatTrDate(value)} ${time}`;
}
