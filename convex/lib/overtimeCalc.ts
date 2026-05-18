/**
 * 4857 sayılı İş Kanunu madde 41 / 63:
 * - Haftalık 45 saatin (2700 dk) üzeri = fazla mesai
 * - Günlük 11 saat (660 dk) tavanı; aşılması idari para cezası gerektirir
 * - Yıllık 270 saat (16200 dk) üst sınır
 *
 * Hafta tatili (Pazar) ve UBGT günlerinde çalışılan TÜM süre %100 zamlı FM
 * sayılır (haftalık 45h limitinden bağımsız).
 */

export const WEEKLY_NORMAL_MINUTES = 45 * 60; // 2700
export const DAILY_MAX_MINUTES = 11 * 60; // 660
export const ANNUAL_OVERTIME_LIMIT_MINUTES = 270 * 60; // 16200

export type DayClassification = "workday" | "weekend" | "holiday" | "halfDayHoliday";

export interface DayEntry {
  date: string; // YYYY-MM-DD
  netMinutes: number; // mola düşülmüş çalışma süresi
  classification: DayClassification;
}

export interface WeekBucket {
  weekStart: string; // ISO date of Monday
  workdayMinutes: number; // workday gün toplamları
  premiumMinutes: number; // weekend/holiday gün toplamları (%100 zamlı FM)
  overtimeMinutes: number; // workdayMinutes - 2700 (pozitif)
  exceedsDaily11h: string[]; // 11 saat aşan tarihler
}

function weekStartIsoForDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().split("T")[0];
}

/**
 * Günleri haftalık bucket'lara grupla, haftalık 45h üstünü FM say.
 * UBGT/Pazar günleri ayrı premiumMinutes olarak izlenir.
 */
export function bucketWeeklyOvertime(entries: DayEntry[]): WeekBucket[] {
  const byWeek = new Map<string, WeekBucket>();
  for (const e of entries) {
    const ws = weekStartIsoForDate(e.date);
    let bucket = byWeek.get(ws);
    if (!bucket) {
      bucket = {
        weekStart: ws,
        workdayMinutes: 0,
        premiumMinutes: 0,
        overtimeMinutes: 0,
        exceedsDaily11h: [],
      };
      byWeek.set(ws, bucket);
    }
    if (e.classification === "weekend" || e.classification === "holiday") {
      bucket.premiumMinutes += e.netMinutes;
    } else {
      bucket.workdayMinutes += e.netMinutes;
    }
    if (e.netMinutes > DAILY_MAX_MINUTES) bucket.exceedsDaily11h.push(e.date);
  }
  for (const bucket of byWeek.values()) {
    bucket.overtimeMinutes = Math.max(0, bucket.workdayMinutes - WEEKLY_NORMAL_MINUTES);
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function totalOvertimeMinutes(buckets: WeekBucket[]): number {
  return buckets.reduce((s, b) => s + b.overtimeMinutes + b.premiumMinutes, 0);
}

export function totalDailyExceedances(buckets: WeekBucket[]): string[] {
  return buckets.flatMap((b) => b.exceedsDaily11h);
}
