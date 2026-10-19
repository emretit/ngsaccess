import { ConvexError } from "convex/values";

const DAY_MS = 86_400_000;

export function overlaps(start: string, end: string, otherStart: string, otherEnd: string): boolean {
  return start <= otherEnd && end >= otherStart;
}

export function validateRequestDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ConvexError("Geçerli bir tarih girin (YYYY-MM-DD)");
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new ConvexError("Geçerli bir tarih girin (YYYY-MM-DD)");
  return time;
}

export function validateLeaveRequestRange(start: string, end: string, today: string): void {
  const from = validateRequestDate(start);
  const to = validateRequestDate(end);
  const todayTime = validateRequestDate(today);
  if (to < from) throw new ConvexError("Bitiş tarihi başlangıçtan önce olamaz");
  if (from < todayTime - 30 * DAY_MS) throw new ConvexError("İzin başlangıcı en fazla 30 gün geçmiş olabilir");
  if ((to - from) / DAY_MS + 1 > 60) throw new ConvexError("İzin aralığı en fazla 60 gün olabilir");
}

export function validateCorrectionDate(date: string, today: string): void {
  const dateTime = validateRequestDate(date);
  const todayTime = validateRequestDate(today);
  if (dateTime > todayTime || dateTime < todayTime - 30 * DAY_MS) throw new ConvexError("Tarih bugün ile son 30 gün arasında olmalı");
}

export function istanbulToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
