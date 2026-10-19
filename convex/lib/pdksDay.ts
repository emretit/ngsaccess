import type { Doc } from "../_generated/dataModel";
import { legalBreakMinutes } from "./breakDeduction";
import { minutesBetweenISO } from "./pdksCalc";
import {
  DEFAULT_OVERTIME_RATES,
  classifyDay,
  isoTimeToTRMinutes,
  multiplierForClassification,
  parseHHMM,
  type NightCombineMode,
  type EffectiveOvertimeRates,
  type EffectiveWorkSettings,
} from "./pdksHelpers";
import { isOvernightShift, manualPdksTimes } from "./pdksWorkDay";

type Interval = { start: number; end: number };
const overlap = (a: Interval, b: Interval) =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

function recurringWindows(
  start: string,
  end: string,
  from: number,
  to: number,
): Interval[] {
  const startMin = parseHHMM(start),
    endMin = parseHHMM(end);
  if (startMin === endMin) return [];
  const result: Interval[] = [];
  for (
    let day = Math.floor(from / 1440) - 1;
    day <= Math.floor(to / 1440);
    day++
  ) {
    const window = {
      start: day * 1440 + startMin,
      end: day * 1440 + endMin + (endMin < startMin ? 1440 : 0),
    };
    if (overlap(window, { start: from, end: to }) > 0) result.push(window);
  }
  return result;
}

/** One calculation for table, detail and payroll. All minutes are on the shift-start
 * day's timeline; legal breaks without a scheduled window are allocated proportionally. */
export function computePdksDay(params: {
  date: string;
  readings: readonly Doc<"cardReadings">[];
  manual?: Doc<"pdksRecords">;
  shift: Doc<"shifts"> | null;
  workSettings: EffectiveWorkSettings;
  workingDays: string[];
  holiday?: Doc<"holidays"> | null;
  overtimeRates?: EffectiveOvertimeRates;
  hourlyRate?: number | null;
}) {
  const { date, shift, manual, workSettings } = params;
  const rates = params.overtimeRates ?? DEFAULT_OVERTIME_RATES;
  const readings = params.readings
    .filter((r) => r.accessStatus === "izin_verildi")
    .slice()
    .sort((a, b) => a.accessTime.localeCompare(b.accessTime));
  const rawEntry = readings[0]?.accessTime;
  const fallbackEntry = rawEntry
    ? `${String(Math.floor(isoTimeToTRMinutes(rawEntry) / 60)).padStart(2, "0")}:${String(isoTimeToTRMinutes(rawEntry) % 60).padStart(2, "0")}`
    : undefined;
  const manualTimes = manualPdksTimes(
    date,
    manual
      ? { ...manual, entryTime: manual.entryTime ?? fallbackEntry }
      : undefined,
    shift,
  );
  const firstISO = manual?.entryTime
    ? (manualTimes.entryISO ?? null)
    : (rawEntry ?? null);
  const lastISO =
    manualTimes.exitISO ??
    (readings.length > 1
      ? (readings[readings.length - 1]?.accessTime ?? null)
      : null);
  const origin = new Date(`${date}T00:00:00.000+03:00`).getTime();
  const entry = firstISO
    ? Math.floor((new Date(firstISO).getTime() - origin) / 60000)
    : undefined;
  const exit = lastISO
    ? Math.floor((new Date(lastISO).getTime() - origin) / 60000)
    : undefined;
  const rawTotalMinutes =
    firstISO && lastISO ? Math.max(0, minutesBetweenISO(firstISO, lastISO)) : 0;
  const interval = { start: entry ?? 0, end: exit ?? entry ?? 0 };
  const scheduledBreaks =
    shift?.breakStart && shift.breakEnd
      ? recurringWindows(
          shift.breakStart,
          shift.breakEnd,
          interval.start,
          interval.end,
        )
      : [];
  const scheduledBreakMinutes = scheduledBreaks.reduce(
    (sum, window) => sum + overlap(interval, window),
    0,
  );
  const breakMinutes = Math.min(
    rawTotalMinutes,
    scheduledBreakMinutes || legalBreakMinutes(rawTotalMinutes),
  );
  const totalMinutes = rawTotalMinutes - breakMinutes;
  const netOverlap = (window: Interval) => {
    const raw = overlap(interval, window);
    if (scheduledBreakMinutes > 0) {
      return (
        raw -
        scheduledBreaks.reduce(
          (sum, pause) =>
            sum +
            overlap(
              {
                start: Math.max(interval.start, window.start),
                end: Math.min(interval.end, window.end),
              },
              pause,
            ),
          0,
        )
      );
    }
    return rawTotalMinutes > 0 ? (raw * totalMinutes) / rawTotalMinutes : 0;
  };
  const classification = classifyDay(date, params.workingDays, params.holiday);
  const shiftStart = parseHHMM(shift?.startTime ?? workSettings.workStartTime);
  const shiftEnd =
    parseHHMM(shift?.endTime ?? workSettings.workEndTime) +
    (isOvernightShift(shift) ? 1440 : 0);
  const tolerance =
    shift?.overtimeStartToleranceMinutes ??
    workSettings.overtimeStartToleranceMinutes;
  const overtimeThreshold = shiftEnd + tolerance;
  const premiumDay =
    classification === "weekend" || classification === "holiday";
  const overtimeWindow = premiumDay
    ? interval
    : { start: Math.max(interval.start, overtimeThreshold), end: interval.end };
  const scheduledOvertimeBreak = scheduledBreaks.reduce(
    (sum, pause) => sum + overlap(overtimeWindow, pause),
    0,
  );
  const overtimeMinutes =
    shift?.overtimeEnabled === false
      ? 0
      : premiumDay
        ? totalMinutes
        : Math.min(
            totalMinutes,
            Math.max(
              0,
              overlap(interval, overtimeWindow) - scheduledOvertimeBreak,
            ),
          );
  const nightWindows = recurringWindows(
    rates.nightShiftStart,
    rates.nightShiftEnd,
    interval.start,
    interval.end,
  );
  const rawNightMinutes = nightWindows.reduce(
    (sum, window) => sum + overlap(interval, window),
    0,
  );
  const nightMinutes = Math.min(
    totalMinutes,
    Math.round(
      nightWindows.reduce((sum, window) => sum + netOverlap(window), 0),
    ),
  );
  const nightOvertimeMinutes =
    overtimeMinutes === 0
      ? 0
      : premiumDay
        ? nightMinutes
        : Math.min(
            overtimeMinutes,
            nightMinutes,
            Math.round(
              nightWindows.reduce((sum, window) => {
                const portion = {
                  start: Math.max(
                    interval.start,
                    window.start,
                    overtimeWindow.start,
                  ),
                  end: Math.min(interval.end, window.end, overtimeWindow.end),
                };
                const raw = Math.max(0, portion.end - portion.start);
                return (
                  sum +
                  raw -
                  scheduledBreaks.reduce(
                    (breakSum, pause) => breakSum + overlap(portion, pause),
                    0,
                  )
                );
              }, 0),
            ),
          );
  const lateTolerance =
    shift?.lateToleranceMinutes ?? workSettings.maxLateMinutes;
  const earlyTolerance =
    shift?.earlyExitToleranceMinutes ?? workSettings.earlyExitToleranceMinutes;
  const lateMinutes =
    entry === undefined ? 0 : Math.max(0, entry - shiftStart - lateTolerance);
  const earlyExitMinutes =
    exit === undefined ? 0 : Math.max(0, shiftEnd - earlyTolerance - exit);
  const dayMultiplier = multiplierForClassification(classification, rates);
  const weightedOvertimeMinutes =
    (overtimeMinutes - nightOvertimeMinutes) * dayMultiplier +
    nightOvertimeMinutes *
      combineNightMultiplier(
        dayMultiplier,
        rates.nightShiftMultiplier,
        rates.nightCombineMode,
      );
  const multiplier =
    overtimeMinutes > 0 ? weightedOvertimeMinutes / overtimeMinutes : 0;
  return {
    firstISO,
    lastISO,
    rawTotalMinutes,
    breakMinutes,
    totalMinutes,
    overtimeMinutes,
    nightMinutes,
    rawNightMinutes,
    nightOvertimeMinutes,
    multiplier,
    classification,
    isLate: lateMinutes > 0,
    lateMinutes,
    isEarlyExit: earlyExitMinutes > 0,
    earlyExitMinutes,
    exitNextDay: exit !== undefined && exit >= 1440,
    isOvernightShift: isOvernightShift(shift),
    hasAttendance: !!firstISO || !!lastISO,
    overtimePayTRY:
      params.hourlyRate != null && overtimeMinutes > 0
        ? (weightedOvertimeMinutes / 60) * params.hourlyRate
        : null,
  };
}

/** Night premium applies only to overtime minutes inside the configured window. */
export function combineNightMultiplier(
  dayMultiplier: number,
  nightMultiplier: number,
  mode: NightCombineMode = "max",
) {
  if (mode === "multiply") return dayMultiplier * nightMultiplier;
  if (mode === "additive") return dayMultiplier + nightMultiplier - 1;
  return Math.max(dayMultiplier, nightMultiplier);
}
