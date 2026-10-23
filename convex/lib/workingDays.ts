/** PDKS hafta sonu tanımı: `generalSettings.workingDays` Türkçe gün adlarını tutar (pdksHelpers.dateToWeekdayName ile aynı). */
export const WEEKDAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
export type WeekdayName = (typeof WEEKDAY_NAMES)[number];
export const DEFAULT_WORKING_DAYS: readonly WeekdayName[] = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

const isWeekdayName = (day: string): day is WeekdayName => WEEKDAY_NAMES.some(name => name === day);

/** Geçersiz/tekrarlı günleri reddeder, haftanın sırasına dizer. */
export function normalizeWorkingDays(days: readonly string[]): WeekdayName[] {
  const invalid = days.find(day => !isWeekdayName(day));
  if (invalid !== undefined) throw new Error(`Geçersiz gün: ${invalid}`);
  const unique = WEEKDAY_NAMES.filter(name => days.includes(name));
  if (unique.length === 0) throw new Error("En az bir çalışma günü seçin.");
  return unique;
}

/** Kayıtlı liste boşsa ya da bozuksa varsayılan (Pazartesi–Cuma). */
export function storedWorkingDays(days: readonly string[] | undefined): WeekdayName[] {
  if (!days?.length) return [...DEFAULT_WORKING_DAYS];
  try { return normalizeWorkingDays(days); } catch { return [...DEFAULT_WORKING_DAYS]; }
}
