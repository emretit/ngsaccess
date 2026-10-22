import { resolveAttendanceEvidence } from "./pdksEvidence";
import { LEGACY_PDKS_POLICY, type PdksDayPolicy } from "./pdksRules";
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
import type { OvertimeSegment } from "./overtimeCalc";
import { addWorkDate, isOvernightShift, manualPdksTimes } from "./pdksWorkDay";

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
  policy?: PdksDayPolicy;
  date: string;
  readings: readonly Doc<"cardReadings">[];
  manual?: Doc<"pdksRecords">;
  shift: Doc<"shifts"> | null;
  workSettings: EffectiveWorkSettings;
  workingDays: string[];
  holiday?: Doc<"holidays"> | null;
  holidayMap?: ReadonlyMap<string, Doc<"holidays">>;
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
  const directedEntry = readings.find(r => r.direction === "entry")?.accessTime;
  const directedFallback = directedEntry ? `${String(Math.floor(isoTimeToTRMinutes(directedEntry) / 60)).padStart(2, "0")}:${String(isoTimeToTRMinutes(directedEntry) % 60).padStart(2, "0")}` : undefined;
  const evidenceManualTimes = manualPdksTimes(date, manual ? { ...manual, entryTime: manual.entryTime ?? directedFallback } : undefined, shift);
  const evidence = (params.policy ?? LEGACY_PDKS_POLICY).punchMode === "requirements"
    ? resolveAttendanceEvidence(readings, { entryISO: manual?.entryTime ? evidenceManualTimes.entryISO : undefined, exitISO: evidenceManualTimes.exitISO }, params.policy ?? LEGACY_PDKS_POLICY) : null;
  const firstISO = evidence ? evidence.firstISO : manual?.entryTime
    ? (manualTimes.entryISO ?? null)
    : (rawEntry ?? null);
  const lastISO = evidence ? evidence.lastISO :
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
  const nightWindows = recurringWindows(
    rates.nightShiftStart, rates.nightShiftEnd, interval.start, interval.end,
  );
  const rawNightMinutes = nightWindows.reduce(
    (sum, window) => sum + overlap(interval, window), 0,
  );
  const nightMinutes = Math.min(totalMinutes, Math.round(
    nightWindows.reduce((sum, window) => sum + netOverlap(window), 0),
  ));
  const boundaries = new Set([interval.start, interval.end]);
  const addBoundary = (minute: number) => {
    if (minute > interval.start && minute < interval.end) boundaries.add(minute);
  };
  addBoundary(overtimeThreshold);
  for (const window of [...nightWindows, ...scheduledBreaks]) {
    addBoundary(window.start);
    addBoundary(window.end);
  }
  for (let midnight = (Math.floor(interval.start / 1440) + 1) * 1440;
    midnight < interval.end; midnight += 1440) addBoundary(midnight);
  const points = [...boundaries].sort((a, b) => a - b);
  const portions = points.slice(1).map((end, index) => {
    const start = points[index];
    const window = { start, end };
    const calendarDate = addWorkDate(date, Math.floor(start / 1440));
    const cls = rates.nightShiftDayMode === "splitAtMidnight"
      ? classifyDay(calendarDate, params.workingDays,
          calendarDate === date ? params.holiday : params.holidayMap?.get(calendarDate))
      : classification;
    const premium = cls === "weekend" || cls === "holiday";
    const isNight = nightWindows.some((night) => overlap(window, night) > 0);
    const dayMultiplier = multiplierForClassification(cls, rates);
    // Round cumulative boundaries, rather than each portion independently, so
    // integer minutes are conserved even when an unspecified break is prorated.
    const netMinutes = Math.max(0,
      Math.round(netOverlap({ start: interval.start, end })) -
      Math.round(netOverlap({ start: interval.start, end: start })));
    // Preserve the daily-cell rule: unspecified legal breaks are deducted from
    // normal time first; explicitly scheduled breaks are deducted where taken.
    const dailyCandidate = premium ? netMinutes : start >= overtimeThreshold
      ? Math.max(0, end - start - scheduledBreaks.reduce(
          (sum, pause) => sum + overlap(window, pause), 0)) : 0;
    return {
      netMinutes,
      dailyOvertimeMinutes: dailyCandidate,
      classification: cls,
      multiplier: isNight
        ? combineNightMultiplier(dayMultiplier, rates.nightShiftMultiplier, rates.nightCombineMode)
        : dayMultiplier,
      eligible: shift?.overtimeEnabled !== false,
      // A split shift's post-midnight minutes belong to that calendar week.
      calendarDate: rates.nightShiftDayMode === "splitAtMidnight" ? calendarDate : date,
      isNight,
    };
  });
  const dailyTotal = shift?.overtimeEnabled === false ? 0 : Math.min(
    totalMinutes, portions.reduce((sum, p) => sum + p.dailyOvertimeMinutes, 0),
  );
  // Keep the existing daily rule's night cap: an unspecified break must not
  // become payable night overtime when the entire attendance is after shift end.
  let nightRemaining = Math.max(
    dailyTotal - portions.reduce((sum, p) => sum + (p.isNight ? 0 : p.dailyOvertimeMinutes), 0),
    Math.min(dailyTotal, nightMinutes,
      portions.reduce((sum, p) => sum + (p.isNight ? p.dailyOvertimeMinutes : 0), 0)),
  );
  let daytimeRemaining = dailyTotal - nightRemaining;
  for (const portion of [...portions].reverse()) {
    portion.dailyOvertimeMinutes = portion.eligible
      ? Math.min(portion.isNight ? nightRemaining : daytimeRemaining, portion.dailyOvertimeMinutes) : 0;
    if (portion.isNight) nightRemaining -= portion.dailyOvertimeMinutes;
    else daytimeRemaining -= portion.dailyOvertimeMinutes;
  }
  const overtimeSegments: OvertimeSegment[] = portions.map(({ isNight: _isNight, ...portion }) => portion);
  const overtimeMinutes = portions.reduce((sum, p) => sum + p.dailyOvertimeMinutes, 0);
  const nightOvertimeMinutes = portions.reduce(
    (sum, p) => sum + (p.isNight ? p.dailyOvertimeMinutes : 0), 0,
  );
  const lateTolerance =
    shift?.lateToleranceMinutes ?? workSettings.maxLateMinutes;
  const earlyTolerance =
    shift?.earlyExitToleranceMinutes ?? workSettings.earlyExitToleranceMinutes;
  const lateMinutes =
    entry === undefined ? 0 : Math.max(0, entry - shiftStart - lateTolerance);
  const earlyExitMinutes =
    exit === undefined ? 0 : Math.max(0, shiftEnd - earlyTolerance - exit);
  const weightedOvertimeMinutes = overtimeSegments.reduce(
    (sum, segment) => sum + segment.dailyOvertimeMinutes * segment.multiplier, 0,
  );
  const multiplier =
    overtimeMinutes > 0 ? weightedOvertimeMinutes / overtimeMinutes : 0;
  return {
    date,
    overtimeSegments,
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
    hasAttendance: evidence ? evidence.attendanceCredit : !!firstISO || !!lastISO,
    attendanceDecision: evidence?.decision,
    durationMeasured: evidence?.durationMeasured ?? (!!firstISO && !!lastISO),
    punchQuality: evidence?.punchQuality ?? (firstISO && lastISO ? "ok" as const : firstISO ? "missingExit" as const : lastISO ? "missingEntry" as const : "noPunch" as const),
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
