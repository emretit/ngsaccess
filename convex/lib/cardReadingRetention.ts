import { MAX_CARD_READING_RETENTION_DAYS, MIN_CARD_READING_RETENTION_DAYS } from "./privacySettings";
import { trDayRangeISO, trTodayKey } from "./trDate";

export const RETENTION_BATCH_SIZE = 200;
export const RETENTION_MAX_BATCHES = 20;

export function validRetentionDays(days: number | null): boolean {
  return days === null || (Number.isInteger(days) && days >= MIN_CARD_READING_RETENTION_DAYS && days <= MAX_CARD_READING_RETENTION_DAYS);
}

/** Türkiye gün başlangıcından geriye say; sınırı UTC ISO olarak index'e ver. */
export function retentionCutoff(days: number | null, now: number): string | null {
  if (days === null) return null;
  if (!validRetentionDays(days)) throw new Error("Saklama süresi 1825–3650 arasında tam gün olmalıdır.");
  const today = trTodayKey(new Date(now));
  const start = trDayRangeISO(today, today).startISO;
  return new Date(Date.parse(start) - days * 86_400_000).toISOString();
}

export function retentionBatchPlan(deleted: number, completedBatches: number): { continueRun: boolean; dailyLimitReached: boolean } {
  const full = deleted === RETENTION_BATCH_SIZE;
  const dailyLimitReached = full && completedBatches >= RETENTION_MAX_BATCHES;
  return { continueRun: full && !dailyLimitReached, dailyLimitReached };
}
