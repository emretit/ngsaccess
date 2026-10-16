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
