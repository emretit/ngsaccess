import type { EffectiveOvertimeRates } from "./pdksHelpers";

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

/** Ordered portions of a work day, split at midnight, night-rate and break boundaries.
 * date on the parent always remains the assigned PDKS work day. */
export interface OvertimeSegment {
  netMinutes: number;
  dailyOvertimeMinutes: number;
  classification: DayClassification;
  multiplier: number;
  eligible: boolean;
  /** Calendar date whose ISO week this portion counts toward; defaults to the work date. */
  calendarDate?: string;
}

export interface OvertimeDay {
  date: string;
  totalMinutes: number;
  overtimeSegments: readonly OvertimeSegment[];
}

/** Weekly settlement needs only preceding dates in the starting ISO week.
 * pdksWorkDayRange separately includes overnight exits in both modes. When
 * overnight shifts are split at midnight, the previous Sunday's shift can carry
 * Monday minutes into the starting week, so that Sunday is read as well. */
export function overtimePeriodRange(
  startDate: string, endDate: string,
  overtimeBasis?: EffectiveOvertimeRates["overtimeBasis"],
  nightShiftDayMode?: EffectiveOvertimeRates["nightShiftDayMode"],
) {
  if (overtimeBasis === "dailyShift") return { startDate, endDate };
  const monday = weekStartIsoForDate(startDate);
  if (nightShiftDayMode !== "splitAtMidnight") return { startDate: monday, endDate };
  const sunday = new Date(`${monday}T00:00:00.000Z`);
  sunday.setUTCDate(sunday.getUTCDate() - 1);
  return { startDate: sunday.toISOString().slice(0, 10), endDate };
}

/** Settle chronological segments on their assigned work date. Disabled portions
 * consume the weekly allowance but cannot transfer unpaid excess to other dates. */
export function calculatePeriodOvertime(
  days: readonly OvertimeDay[],
  options: {
    startDate: string;
    endDate: string;
    overtimeBasis?: EffectiveOvertimeRates["overtimeBasis"];
    hourlyRate?: number | null;
  },
) {
  let overtimeMinutes = 0;
  let weightedMinutes = 0;
  const inPeriod = (date: string) =>
    date >= options.startDate && date <= options.endDate;
  const overtimeByDate: Record<string, {
    overtimeMinutes: number; overtimePayTRY: number | null; overtimeMultiplier: number;
  }> = {};
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const weeklyMinutes = new Map<string, number>();
  for (const day of sorted) {
    if (day.date > options.endDate) continue;
    let dayMinutes = 0;
    let dayWeightedMinutes = 0;
    for (const segment of day.overtimeSegments) {
      let minutes = segment.dailyOvertimeMinutes;
      if (options.overtimeBasis !== "dailyShift") {
        if (segment.classification === "weekend" || segment.classification === "holiday") {
          minutes = segment.netMinutes;
        } else {
          const monday = weekStartIsoForDate(segment.calendarDate ?? day.date);
          const previous = weeklyMinutes.get(monday) ?? 0;
          const current = previous + segment.netMinutes;
          minutes = Math.max(0, current - WEEKLY_NORMAL_MINUTES)
            - Math.max(0, previous - WEEKLY_NORMAL_MINUTES);
          weeklyMinutes.set(monday, current);
        }
      }
      if (inPeriod(day.date) && segment.eligible) {
        dayMinutes += minutes;
        dayWeightedMinutes += minutes * segment.multiplier;
      }
    }
    if (!inPeriod(day.date)) continue;
    overtimeMinutes += dayMinutes;
    weightedMinutes += dayWeightedMinutes;
    overtimeByDate[day.date] = {
      overtimeMinutes: dayMinutes,
      overtimePayTRY: options.hourlyRate == null ? null : dayWeightedMinutes / 60 * options.hourlyRate,
      overtimeMultiplier: dayMinutes > 0 ? dayWeightedMinutes / dayMinutes : 0,
    };
  }
  return {
    overtimeByDate,
    overtimeMinutes,
    overtimePayTRY: options.hourlyRate == null ? null : weightedMinutes / 60 * options.hourlyRate,
    overtimeMultiplier: overtimeMinutes > 0 ? weightedMinutes / overtimeMinutes : 0,
    exceedsDaily11h: sorted.filter((d) => inPeriod(d.date) && d.totalMinutes > DAILY_MAX_MINUTES)
      .map((d) => d.date),
  };
}
