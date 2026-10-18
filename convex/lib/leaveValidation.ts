import { ConvexError } from "convex/values";

// One inclusive leap-year span; longer absences must be split into adjacent records.
export const MAX_LEAVE_DAYS = 366;
const DAY_MS = 86_400_000;

export const LEAVE_ERRORS = {
  LEAVE_INVALID_DATE: "Geçerli bir tarih girin.",
  LEAVE_RANGE_REVERSED: "Bitiş tarihi başlangıçtan önce olamaz.",
  LEAVE_TOO_LONG: "Tek bir izin kaydı en fazla 366 takvim günü olabilir.",
  LEAVE_OVERLAP: "Bu kişi için seçilen tarihlerle çakışan izin var.",
  LEAVE_READ_ONLY: "Yalnız onaylı izin kayıtları düzenlenebilir.",
  LEAVE_STALE: "Bu izin kaydı değiştirildi. Güncel kaydı açıp tekrar deneyin.",
  LEAVE_NOT_FOUND: "İzin kaydı bulunamadı.",
  LEAVE_EMPLOYEE_UNAVAILABLE: "Bu çalışana erişim yetkiniz yok.",
  LEAVE_PROJECT_MISMATCH: "İzin ve çalışan aynı projede olmalıdır.",
  LEAVE_SCAN_LIMIT: "İzin kontrolü okuma sınırına ulaştı. Daha dar bir dönem seçin veya yöneticinizle iletişime geçin.",
  LEAVE_INVALID_PAGE_SIZE: "Sayfa boyutu 1–200 arasında tam sayı olmalı.",
} as const;

export function leaveError(code: keyof typeof LEAVE_ERRORS): never {
  throw new ConvexError({ code, message: LEAVE_ERRORS[code] });
}

function dateTimestamp(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) {
    return leaveError("LEAVE_INVALID_DATE");
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return leaveError("LEAVE_INVALID_DATE");
  }
  return timestamp;
}

/** UTC calendar arithmetic, inclusive of both dates; no DST or working-day logic. */
export function calendarDays(startDate: string, endDate: string): number {
  const start = dateTimestamp(startDate);
  const end = dateTimestamp(endDate);
  if (end < start) return leaveError("LEAVE_RANGE_REVERSED");
  return (end - start) / DAY_MS + 1;
}

/** Query ranges may exceed 366 days; only a single saved leave has this limit. */
export function validateLeaveRange(startDate: string, endDate: string): number {
  const days = calendarDays(startDate, endDate);
  if (days > MAX_LEAVE_DAYS) return leaveError("LEAVE_TOO_LONG");
  return days;
}

/** Valid, canonical ISO date ranges intersect at shared endpoints too. */
export function overlaps(startDate: string, endDate: string, otherStart: string, otherEnd: string): boolean {
  return startDate <= otherEnd && endDate >= otherStart;
}
