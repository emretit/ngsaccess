import { ConvexError } from "convex/values";

export const requestMessages = {
  "REQUEST_PROJECT_MISSING": "Çalışanın proje bilgisi bulunamadı",
  "REQUEST_NOTE_TOO_LONG": "Not en fazla 500 karakter olabilir",
  "REQUEST_DATE_INVALID": "Geçerli bir tarih girin (YYYY-MM-DD)",
  "REQUEST_RANGE_INVALID": "Bitiş tarihi başlangıçtan önce olamaz",
  "REQUEST_START_TOO_OLD": "İzin başlangıcı en fazla 30 gün geçmiş olabilir",
  "REQUEST_RANGE_TOO_LONG": "İzin aralığı en fazla 60 gün olabilir",
  "REQUEST_PENDING_LIMIT": "En fazla 10 bekleyen izin talebiniz olabilir",
  "REQUEST_OVERLAP_PENDING": "Seçilen tarihler bekleyen başka bir izin talebiyle çakışıyor",
  "REQUEST_OVERLAP_APPROVED": "Seçilen tarihler onaylı başka bir izinle çakışıyor",
  "REQUEST_NOT_FOUND": "Bu izin talebine erişim yetkiniz yok",
  "REQUEST_NOT_PENDING": "Yalnız bekleyen kendi izin talebinizi geri çekebilirsiniz",
  "CORRECTION_DATE_OUT_OF_RANGE": "Tarih bugün ile son 30 gün arasında olmalı",
  "CORRECTION_REASON_LENGTH": "Gerekçe 5–300 karakter olmalı",
  "CORRECTION_TIMES_MISMATCH": "Düzeltme türüne uygun giriş ve çıkış saatlerini belirtin",
  "CORRECTION_TIME_INVALID": "Geçersiz giriş saati (HH:mm)",
  "CORRECTION_PENDING_EXISTS": "Bu gün için bekleyen bir düzeltme talebiniz var"
} as const;

export type RequestErrorCode = keyof typeof requestMessages;

export function requestError(code: RequestErrorCode, message: string = requestMessages[code]) {
  return new ConvexError({ code, message });
}

const DAY_MS = 86_400_000;

export function overlaps(start: string, end: string, otherStart: string, otherEnd: string): boolean {
  return start <= otherEnd && end >= otherStart;
}

export function validateRequestDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw requestError("REQUEST_DATE_INVALID");
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw requestError("REQUEST_DATE_INVALID");
  return time;
}

export function validateLeaveRequestRange(start: string, end: string, today: string): void {
  const from = validateRequestDate(start);
  const to = validateRequestDate(end);
  const todayTime = validateRequestDate(today);
  if (to < from) throw requestError("REQUEST_RANGE_INVALID");
  if (from < todayTime - 30 * DAY_MS) throw requestError("REQUEST_START_TOO_OLD");
  if ((to - from) / DAY_MS + 1 > 60) throw requestError("REQUEST_RANGE_TOO_LONG");
}

export function validateCorrectionDate(date: string, today: string): void {
  const dateTime = validateRequestDate(date);
  const todayTime = validateRequestDate(today);
  if (dateTime > todayTime || dateTime < todayTime - 30 * DAY_MS) throw requestError("CORRECTION_DATE_OUT_OF_RANGE");
}

export function istanbulToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
