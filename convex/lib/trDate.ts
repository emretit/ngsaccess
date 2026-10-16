const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

// UTC getter'larıyla Türkiye yerel takvimini okumak için kaydırılmış tarih.
export function trCalendarDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + TR_OFFSET_MS);
}

export function trDateKey(iso: string): string {
  return trCalendarDate(iso).toISOString().slice(0, 10);
}

// Türkiye takvim günlerinin dahil UTC sorgu sınırları (UTC+3, DST yok).
export function trDayRangeISO(
  startDate: string,
  endDate: string,
): { startISO: string; endISO: string } {
  return {
    startISO: new Date(`${startDate}T00:00:00.000+03:00`).toISOString(),
    endISO: new Date(`${endDate}T23:59:59.999+03:00`).toISOString(),
  };
}

export function trTodayKey(now: Date = new Date()): string {
  return trDateKey(now.toISOString());
}

// Cihaz zamanını kanonik UTC ISO'ya (…Z) çevirir: accessTime/eventTime string olarak
// aralıkla süzülüp index'te sıralanıyor, karışık offset biçimi günü kaydırır.
// Offset'siz değer TR saati kabul edilir. Geçersizse undefined.
export function toUtcISO(time: string): string | undefined {
  const s = time.trim();
  // Date 2026-02-30'u sessizce Mart'a yuvarlar; takvim gününü ayrıca doğrula.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})[T ]/.exec(s);
  if (!ymd) return undefined;
  const calendarDay = new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
  if (calendarDay.toISOString().slice(0, 10) !== s.slice(0, 10)) return undefined;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasZone ? s : `${s.replace(" ", "T")}+03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
