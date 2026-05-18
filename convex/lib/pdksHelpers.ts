import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export interface EffectiveWorkSettings {
  workStartTime: string; // "HH:MM"
  workEndTime: string;
  maxLateMinutes: number;
  earlyExitToleranceMinutes: number;
  overtimeMultiplier: number;
  annualOvertimeLimitHours: number;
  overtimeStartToleranceMinutes: number;
  monthlyHoursBase: number;
}

export const DEFAULT_WORK_SETTINGS: EffectiveWorkSettings = {
  workStartTime: "09:00",
  workEndTime: "18:00",
  maxLateMinutes: 15,
  earlyExitToleranceMinutes: 15,
  overtimeMultiplier: 1.5,
  annualOvertimeLimitHours: 270,
  overtimeStartToleranceMinutes: 15,
  monthlyHoursBase: 225,
};

export interface EffectiveOvertimeRates {
  weekdayMultiplier: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  nightShiftMultiplier: number;
  nightShiftStart: string; // "HH:MM"
  nightShiftEnd: string;
}

export const DEFAULT_OVERTIME_RATES: EffectiveOvertimeRates = {
  weekdayMultiplier: 1.5,
  weekendMultiplier: 2.0,
  holidayMultiplier: 2.0,
  nightShiftMultiplier: 1.5,
  nightShiftStart: "22:00",
  nightShiftEnd: "06:00",
};

export const DEFAULT_WEEKEND_DAYS = ["Cumartesi", "Pazar"];

export async function getEffectiveWorkSettings(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects"> | undefined
): Promise<EffectiveWorkSettings> {
  const ws = await ctx.db
    .query("workSettings")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();
  return {
    workStartTime: ws?.workStartTime ?? DEFAULT_WORK_SETTINGS.workStartTime,
    workEndTime: ws?.workEndTime ?? DEFAULT_WORK_SETTINGS.workEndTime,
    maxLateMinutes:
      ws?.maxLateMinutes ?? DEFAULT_WORK_SETTINGS.maxLateMinutes,
    earlyExitToleranceMinutes:
      ws?.earlyExitToleranceMinutes ??
      DEFAULT_WORK_SETTINGS.earlyExitToleranceMinutes,
    overtimeMultiplier:
      ws?.overtimeMultiplier ?? DEFAULT_WORK_SETTINGS.overtimeMultiplier,
    annualOvertimeLimitHours:
      ws?.annualOvertimeLimitHours ??
      DEFAULT_WORK_SETTINGS.annualOvertimeLimitHours,
    overtimeStartToleranceMinutes:
      ws?.overtimeStartToleranceMinutes ??
      DEFAULT_WORK_SETTINGS.overtimeStartToleranceMinutes,
    monthlyHoursBase:
      ws?.monthlyHoursBase ?? DEFAULT_WORK_SETTINGS.monthlyHoursBase,
  };
}

export async function getEffectiveOvertimeRates(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects"> | undefined
): Promise<EffectiveOvertimeRates> {
  const r = await ctx.db
    .query("overtimeRates")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();
  return {
    weekdayMultiplier:
      r?.weekdayMultiplier ?? DEFAULT_OVERTIME_RATES.weekdayMultiplier,
    weekendMultiplier:
      r?.weekendMultiplier ?? DEFAULT_OVERTIME_RATES.weekendMultiplier,
    holidayMultiplier:
      r?.holidayMultiplier ?? DEFAULT_OVERTIME_RATES.holidayMultiplier,
    nightShiftMultiplier:
      r?.nightShiftMultiplier ?? DEFAULT_OVERTIME_RATES.nightShiftMultiplier,
    nightShiftStart:
      r?.nightShiftStart ?? DEFAULT_OVERTIME_RATES.nightShiftStart,
    nightShiftEnd: r?.nightShiftEnd ?? DEFAULT_OVERTIME_RATES.nightShiftEnd,
  };
}

export async function getHolidaysMap(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects"> | undefined,
  startDate: string,
  endDate: string
): Promise<Map<string, Doc<"holidays">>> {
  const projectHolidays = await ctx.db
    .query("holidays")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  // Tüm projeler için geçerli (projectId === undefined) tatiller
  const globalHolidays =
    projectId === undefined
      ? []
      : await ctx.db
          .query("holidays")
          .withIndex("by_project", (q) => q.eq("projectId", undefined))
          .collect();

  const map = new Map<string, Doc<"holidays">>();
  for (const h of [...projectHolidays, ...globalHolidays]) {
    if (h.date < startDate || h.date > endDate) continue;
    if (!map.has(h.date)) map.set(h.date, h);
  }
  return map;
}

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * UTC ISO string'i TR yerel zamanına (UTC+3) çevirip günün dakika offset'ini döner.
 * Ör: "2026-05-18T16:30:00.000Z" → 19*60 + 30 = 1170.
 */
export function isoTimeToTRMinutes(iso: string): number {
  const tr = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000);
  return tr.getUTCHours() * 60 + tr.getUTCMinutes();
}

export function dateToWeekdayName(dateStr: string): string {
  const names = [
    "Pazar",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
  ];
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return names[d.getUTCDay()];
}

export type DayClassification =
  | "workday"
  | "weekend"
  | "holiday"
  | "halfDayHoliday";

export function classifyDay(
  dateStr: string,
  workingDays: string[],
  holiday?: Doc<"holidays"> | null
): DayClassification {
  if (holiday) return holiday.isHalfDay ? "halfDayHoliday" : "holiday";
  const weekday = dateToWeekdayName(dateStr);
  return workingDays.includes(weekday) ? "workday" : "weekend";
}

export function multiplierForClassification(
  cls: DayClassification,
  rates: EffectiveOvertimeRates
): number {
  switch (cls) {
    case "holiday":
    case "halfDayHoliday":
      return rates.holidayMultiplier;
    case "weekend":
      return rates.weekendMultiplier;
    case "workday":
    default:
      return rates.weekdayMultiplier;
  }
}

export type PayrollCode = "N" | "RT" | "HT" | "İZN" | "DV" | "FM";

export function payrollCodeForDay(opts: {
  classification: DayClassification;
  hasLeave: boolean;
  hasAttendance: boolean;
}): PayrollCode {
  if (opts.classification === "holiday" || opts.classification === "halfDayHoliday") return "RT";
  if (opts.classification === "weekend") return "HT";
  if (opts.hasLeave) return "İZN";
  if (!opts.hasAttendance) return "DV";
  return "N";
}

/**
 * Bir günün entry/exit string'inden geç kalma + erken çıkış flag'lerini üretir.
 * `entryISO` ve `exitISO` aynı gün olmalı; öğeyi sadece HH:MM dakika cinsinden karşılaştırır.
 */
export function evaluateLateEarly(
  entryISO: string | undefined,
  exitISO: string | undefined,
  settings: EffectiveWorkSettings,
  shift?: {
    startTime?: string;
    endTime?: string;
    lateToleranceMinutes?: number;
    earlyExitToleranceMinutes?: number;
  } | null,
): { isLate: boolean; isEarlyExit: boolean } {
  const startStr = shift?.startTime ?? settings.workStartTime;
  const endStr = shift?.endTime ?? settings.workEndTime;
  const lateTolerance = shift?.lateToleranceMinutes ?? settings.maxLateMinutes;
  const earlyTolerance =
    shift?.earlyExitToleranceMinutes ?? settings.earlyExitToleranceMinutes;
  const lateThresholdMin = parseHHMM(startStr) + lateTolerance;
  const earlyThresholdMin = parseHHMM(endStr) - earlyTolerance;

  let isLate = false;
  let isEarlyExit = false;

  if (entryISO) {
    const tr = new Date(new Date(entryISO).getTime() + 3 * 60 * 60 * 1000);
    const min = tr.getUTCHours() * 60 + tr.getUTCMinutes();
    isLate = min > lateThresholdMin;
  }
  if (exitISO) {
    const tr = new Date(new Date(exitISO).getTime() + 3 * 60 * 60 * 1000);
    const min = tr.getUTCHours() * 60 + tr.getUTCMinutes();
    isEarlyExit = min < earlyThresholdMin;
  }
  return { isLate, isEarlyExit };
}

/**
 * Bir günün mesai dakikasını "vardiya bitiş saatinden sonra geçen süre" mantığıyla hesaplar.
 *
 * - Hafta sonu / tatil: tüm net çalışma süresi mesai (4857/41 — premium gün).
 * - İş günü: lastExit - (shiftEnd + tolerans). Negatif olursa 0.
 * - shiftEndTime yoksa global workSettings.workEndTime fallback.
 * - Tolerans: vardiyada shiftOvertimeStartToleranceMinutes doluysa o, yoksa workSettings global'i.
 */
export function dailyOvertimeMinutes(opts: {
  classification: DayClassification;
  netMinutes: number;
  lastExitMinutes: number | undefined;
  shiftEndTime: string | undefined;
  shiftOvertimeStartToleranceMinutes?: number;
  workSettings: EffectiveWorkSettings;
}): number {
  if (opts.classification === "weekend" || opts.classification === "holiday") {
    return Math.max(0, opts.netMinutes);
  }
  if (opts.lastExitMinutes === undefined) return 0;
  const endStr = opts.shiftEndTime ?? opts.workSettings.workEndTime;
  const tolerance =
    opts.shiftOvertimeStartToleranceMinutes ??
    opts.workSettings.overtimeStartToleranceMinutes;
  const thresholdMin = parseHHMM(endStr) + tolerance;
  return Math.max(0, opts.lastExitMinutes - thresholdMin);
}

/**
 * dailyOvertimeMinutes için ince sarmalayıcı: bir vardiya kaydından
 * endTime + overtimeStartToleranceMinutes alanlarını otomatik aktarır.
 * Beş çağırıcıdaki kopya boilerplate'i tek noktaya indirir.
 */
export function dailyOvertimeForShift(opts: {
  classification: DayClassification;
  netMinutes: number;
  lastExitMinutes: number | undefined;
  shift:
    | {
        endTime?: string;
        overtimeStartToleranceMinutes?: number;
        overtimeEnabled?: boolean;
      }
    | null
    | undefined;
  workSettings: EffectiveWorkSettings;
}): number {
  if (opts.shift?.overtimeEnabled === false) return 0;
  return dailyOvertimeMinutes({
    classification: opts.classification,
    netMinutes: opts.netMinutes,
    lastExitMinutes: opts.lastExitMinutes,
    shiftEndTime: opts.shift?.endTime,
    shiftOvertimeStartToleranceMinutes: opts.shift?.overtimeStartToleranceMinutes,
    workSettings: opts.workSettings,
  });
}

/**
 * Çalışan için saatlik ücreti çözer. Önce employee.hourlyRate, yoksa
 * monthlySalary / workSettings.monthlyHoursBase ile fallback hesaplar.
 * Hiçbiri yoksa null döner (TL hesabı yapılamaz).
 */
export function resolveHourlyRate(opts: {
  hourlyRate: number | undefined | null;
  monthlySalary: number | undefined | null;
  monthlyHoursBase: number;
}): number | null {
  if (typeof opts.hourlyRate === "number" && opts.hourlyRate > 0) {
    return opts.hourlyRate;
  }
  if (
    typeof opts.monthlySalary === "number" &&
    opts.monthlySalary > 0 &&
    opts.monthlyHoursBase > 0
  ) {
    return opts.monthlySalary / opts.monthlyHoursBase;
  }
  return null;
}

/**
 * Mesai TL hesabı: (dakika / 60) × çarpan × saatlik ücret.
 * hourlyRate null ise null döner.
 */
export function overtimePayTRY(opts: {
  overtimeMinutes: number;
  multiplier: number;
  hourlyRate: number | null;
}): number | null {
  if (opts.hourlyRate === null || opts.overtimeMinutes <= 0) return null;
  return (opts.overtimeMinutes / 60) * opts.multiplier * opts.hourlyRate;
}
