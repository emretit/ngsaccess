import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export interface EffectiveWorkSettings {
  workStartTime: string; // "HH:MM"
  workEndTime: string;
  maxLateMinutes: number;
  earlyExitToleranceMinutes: number;
  overtimeMultiplier: number;
  annualOvertimeLimitHours: number;
}

export const DEFAULT_WORK_SETTINGS: EffectiveWorkSettings = {
  workStartTime: "09:00",
  workEndTime: "18:00",
  maxLateMinutes: 15,
  earlyExitToleranceMinutes: 15,
  overtimeMultiplier: 1.5,
  annualOvertimeLimitHours: 270,
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
  settings: EffectiveWorkSettings
): { isLate: boolean; isEarlyExit: boolean } {
  const lateThresholdMin =
    parseHHMM(settings.workStartTime) + settings.maxLateMinutes;
  const earlyThresholdMin =
    parseHHMM(settings.workEndTime) - settings.earlyExitToleranceMinutes;

  let isLate = false;
  let isEarlyExit = false;

  if (entryISO) {
    const d = new Date(entryISO);
    const min = d.getHours() * 60 + d.getMinutes();
    isLate = min > lateThresholdMin;
  }
  if (exitISO) {
    const d = new Date(exitISO);
    const min = d.getHours() * 60 + d.getMinutes();
    isEarlyExit = min < earlyThresholdMin;
  }
  return { isLate, isEarlyExit };
}
