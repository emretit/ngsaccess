import { trDateKey, trTodayKey } from "../../convex/lib/trDate";

const timeFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "şimdi", "5 dk önce", "3 sa önce", "2 gün önce"; geçersiz tarihte null. */
export function timeAgoTr(iso: string | null | undefined, nowMs: number): string | null {
  const date = parse(iso);
  if (!date) return null;
  const diff = Math.max(0, nowMs - date.getTime());
  if (diff < MINUTE) return "şimdi";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} dk önce`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} sa önce`;
  return `${Math.floor(diff / DAY)} gün önce`;
}

/** Akış zamanı: son bir saat göreli, bugün saat, daha eski gün.ay saat (İstanbul). */
export function feedTimeTr(iso: string | null | undefined, nowMs: number): string | null {
  const date = parse(iso);
  if (!date) return null;
  if (nowMs - date.getTime() < HOUR) return timeAgoTr(iso, nowMs);
  const dayKey = trDateKey(date.toISOString());
  if (dayKey === trTodayKey(new Date(nowMs))) return timeFormat.format(date);
  // tr-TR gün+ay kısa biçimi "18/10" verir; uygulamadaki "18.10" biçimi elle kurulur.
  const [, month, day] = dayKey.split("-");
  return `${day}.${month} ${timeFormat.format(date)}`;
}
