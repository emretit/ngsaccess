import { fixedPunchEvidence } from "./pdksFixedRules";
import { flexibleSchedule, flexibleBreak, flexibleReadings, flexiblePendingUntil, relativeMinute, validFlexibleEntry, validFlexibleExit } from "./pdksFlexible";
import { resolveAttendanceEvidence } from "./pdksEvidence";
import { hasDirectionalPdksCheckpoints, LEGACY_PDKS_POLICY, type PdksDayPolicy } from "./pdksRules";
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
import { addWorkDate, exitMayCrossMidnight, isOvernightShift, manualPdksTimes } from "./pdksWorkDay";

import { pairPdksPunches, pdksPairReadings, pdksPunchSegments } from "./pdksPunchPairs";

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
  includePunchSegments?: boolean;
  hasLeave?: boolean;
  dayKind?: "rest" | "work";
  /** Split plans attribute a manual exit against the last piece, independently of the first entry. */
  manualExitNextDay?: boolean;
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
  const eachPunch = params.policy?.calculationMode === "eachPunch";
  const rates = params.overtimeRates ?? DEFAULT_OVERTIME_RATES;
  const flex = flexibleSchedule(shift);
  const candidateReadings = params.readings
    .filter((r) => r.accessStatus === "izin_verildi")
    .slice()
    .sort((a, b) => a.accessTime.localeCompare(b.accessTime));
  const provisionalManual = manualPdksTimes(date, manual, shift);
  const validManualEntry = provisionalManual.entryISO && (!flex || validFlexibleEntry(flex, relativeMinute(date, provisionalManual.entryISO))) ? provisionalManual.entryISO : undefined;
  let readings = flex ? flexibleReadings(flex, date, candidateReadings, validManualEntry) : candidateReadings;
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
  if (params.manualExitNextDay && manual?.exitTime) {
    const exitISO = `${addWorkDate(date, 1)}T${manual.exitTime}:00.000+03:00`;
    manualTimes.exitISO = exitISO;
    evidenceManualTimes.exitISO = exitISO;
  }
  const flexEntry = validManualEntry ?? readings.find(r => r.direction === "entry")?.accessTime;
  const validManualExit = evidenceManualTimes.exitISO && (!flex || validFlexibleExit(flex, relativeMinute(date, evidenceManualTimes.exitISO), flexEntry ? relativeMinute(date, flexEntry) : undefined)) ? evidenceManualTimes.exitISO : undefined;
  let evidence = flex
    ? resolveAttendanceEvidence(readings, { entryISO: validManualEntry, exitISO: validManualExit }, params.policy ?? LEGACY_PDKS_POLICY, { scheduleType: "flexible" })
    : eachPunch || (params.policy ?? LEGACY_PDKS_POLICY).punchMode === "requirements" || hasDirectionalPdksCheckpoints(params.policy ?? LEGACY_PDKS_POLICY)
    ? resolveAttendanceEvidence(readings, { entryISO: manual?.entryTime ? evidenceManualTimes.entryISO : undefined, exitISO: evidenceManualTimes.exitISO }, params.policy ?? LEGACY_PDKS_POLICY) : null;
  const fixedRules = shift?.scheduleType !== "flexible" ? shift : null;
  const resolvedFixedEvidence = fixedRules && (fixedRules.validWindow || fixedRules.missingCheckInLateMinutes !== undefined)
    ? fixedPunchEvidence({ rules: fixedRules, date, readings: candidateReadings,
      manual: { entryISO: manual?.entryTime ? evidenceManualTimes.entryISO : undefined, exitISO: evidenceManualTimes.exitISO },
      policy: params.policy ?? LEGACY_PDKS_POLICY }) : undefined;
  const fixedEvidence = fixedRules?.validWindow || resolvedFixedEvidence?.missingEntryLate ? resolvedFixedEvidence : undefined;
  if (fixedEvidence) {
    readings = fixedEvidence.readings;
    evidence = fixedEvidence.evidence;
  }
  if (flex && !eachPunch && evidence?.durationMeasured) {
    const entryMinute = evidence.firstISO ? relativeMinute(date, evidence.firstISO) : undefined;
    const validFirst = entryMinute !== undefined && validFlexibleEntry(flex, entryMinute);
    const validLast = evidence.lastISO && validFlexibleExit(flex, relativeMinute(date, evidence.lastISO), validFirst ? entryMinute : undefined);
    if (!validFirst || !validLast) {
      evidence = resolveAttendanceEvidence([], {
        entryISO: validFirst ? evidence.firstISO ?? undefined : undefined,
        exitISO: validLast ? evidence.lastISO ?? undefined : undefined,
      }, params.policy ?? LEGACY_PDKS_POLICY);
    }
  }
  const flexibleConflict = !!flex && readings.some(reading => "flexibleConflict" in reading && reading.flexibleConflict === true);
  if (flexibleConflict && evidence) {
    evidence.decision = "incomplete";
    evidence.punchQuality = "undirected";
    evidence.durationMeasured = false;
    evidence.attendanceCredit = false;
    evidence.lastISO = null;
  }
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
  const minPunchInterval = params.policy?.minPunchIntervalMinutes ?? 1;
  const resolvedPairReadings = eachPunch || params.includePunchSegments ? flexibleConflict ? [] : pdksPairReadings(readings, fixedEvidence?.manual ?? {
    entryISO: flex ? validManualEntry : manual?.entryTime ? evidenceManualTimes.entryISO : undefined,
    exitISO: flex ? validManualExit : evidenceManualTimes.exitISO,
  }, minPunchInterval) : [];
  const pairResult = eachPunch ? pairPdksPunches(resolvedPairReadings, minPunchInterval) : undefined;
  const pairIntervals = pairResult?.pairs.map(pair => ({
    start: (Date.parse(pair.entryISO) - origin) / 60000,
    end: (Date.parse(pair.exitISO) - origin) / 60000,
  })) ?? [];
  const rawTotalMinutes = pairResult ? pairResult.totalMinutes :
    firstISO && lastISO ? Math.max(0, minutesBetweenISO(firstISO, lastISO)) : 0;
  const interval = eachPunch ? { start: Math.min(entry ?? Infinity, pairIntervals[0]?.start ?? Infinity), end: Math.max(exit ?? 0, pairIntervals[pairIntervals.length - 1]?.end ?? 0) } : { start: entry ?? 0, end: exit ?? entry ?? 0 };
  if (!Number.isFinite(interval.start)) interval.start = 0;
  const scheduledBreaks =
    !eachPunch && !flex && shift?.breakStart && shift.breakEnd
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
  // Outside time is already excluded by pairing; never deduct a second break.
  const breakMinutes = eachPunch ? 0 : Math.min(
    rawTotalMinutes,
    flex ? flexibleBreak(flex, rawTotalMinutes) : scheduledBreakMinutes || legalBreakMinutes(rawTotalMinutes),
  );
  const totalMinutes = rawTotalMinutes - breakMinutes;
  const netOverlap = (window: Interval) => {
    if (eachPunch) return pairIntervals.reduce((sum, pair) => sum + overlap(pair, window), 0);
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
  const wholeMinutes = eachPunch ? Math.floor : Math.round;
  const holidayFor = (holiday: Doc<"holidays"> | null | undefined) => shift?.holidayWorkRequired ? undefined : holiday;
  // A cycle shift owns its whole work day, including the next calendar day after midnight.
  // dayKind therefore stays anchored to the shift-start date even in splitAtMidnight mode.
  const classify = (day: string, holiday: Doc<"holidays"> | null | undefined) => {
    const effectiveHoliday = holidayFor(holiday);
    return effectiveHoliday || params.dayKind === undefined
      ? classifyDay(day, params.workingDays, effectiveHoliday)
      : params.dayKind === "rest" ? "weekend" as const : "workday" as const;
  };
  const classification = classify(date, params.holiday);
  const requiredNetMinutes = flex ? params.hasLeave || classification === "weekend" || classification === "holiday" ? 0 : classification === "halfDayHoliday" ? flex.requiredNetMinutes / 2 : flex.requiredNetMinutes : undefined;
  const shiftStart = parseHHMM(shift?.startTime ?? workSettings.workStartTime);
  const shiftEnd =
    parseHHMM(shift?.endTime ?? workSettings.workEndTime) +
    (isOvernightShift(shift) ? 1440 : 0);
  const tolerance =
    shift?.overtimeStartToleranceMinutes ??
    workSettings.overtimeStartToleranceMinutes;
  const netThreshold = (requiredNetMinutes ?? 0) + tolerance;
  const overtimeThreshold = flex
    ? interval.start + (totalMinutes > 0 ? netThreshold * rawTotalMinutes / totalMinutes : 0)
    : shiftEnd + tolerance;
  const nightWindows = recurringWindows(
    rates.nightShiftStart, rates.nightShiftEnd, interval.start, interval.end,
  );
  const rawNightMinutes = nightWindows.reduce(
    (sum, window) => sum + (eachPunch ? netOverlap(window) : overlap(interval, window)), 0,
  );
  let nightMinutes = Math.min(totalMinutes, Math.round(
    nightWindows.reduce((sum, window) => sum + netOverlap(window), 0),
  ));
  const boundaries = new Set([interval.start, interval.end]);
  const addBoundary = (minute: number) => {
    if (minute > interval.start && minute < interval.end) boundaries.add(minute);
  };
  addBoundary(overtimeThreshold);
  for (const pair of pairIntervals) { addBoundary(pair.start); addBoundary(pair.end); }
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
      ? classify(calendarDate, calendarDate === date ? params.holiday : params.holidayMap?.get(calendarDate))
      : classification;
    const premium = cls === "weekend" || cls === "holiday";
    const isNight = nightWindows.some((night) => overlap(window, night) > 0);
    const dayMultiplier = multiplierForClassification(cls, rates);
    // Round cumulative boundaries, rather than each portion independently, so
    // integer minutes are conserved even when an unspecified break is prorated.
    const netMinutes = Math.max(0,
      wholeMinutes(netOverlap({ start: interval.start, end })) -
      wholeMinutes(netOverlap({ start: interval.start, end: start })));
    // Preserve the daily-cell rule: unspecified legal breaks are deducted from
    // normal time first; explicitly scheduled breaks are deducted where taken.
    const dailyCandidate = flex
      ? premium ? netMinutes : Math.max(0, wholeMinutes(netOverlap({ start: interval.start, end })) - netThreshold)
        - Math.max(0, wholeMinutes(netOverlap({ start: interval.start, end: start })) - netThreshold)
      : premium ? netMinutes : start >= overtimeThreshold
      ? eachPunch ? netMinutes : Math.max(0, end - start - scheduledBreaks.reduce(
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
  if (flex || eachPunch) nightMinutes = portions.reduce((sum, portion) => sum + (portion.isNight ? portion.netMinutes : 0), 0);
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
    fixedEvidence?.missingEntryLate ? fixedRules?.missingCheckInLateMinutes ?? 0 :
    flex || entry === undefined ? 0 : Math.max(0, entry - shiftStart - lateTolerance);
  const earlyExitMinutes =
    flex || exit === undefined ? 0 : Math.max(0, shiftEnd - earlyTolerance - exit);
  const weightedOvertimeMinutes = overtimeSegments.reduce(
    (sum, segment) => sum + segment.dailyOvertimeMinutes * segment.multiplier, 0,
  );
  const multiplier =
    overtimeMinutes > 0 ? weightedOvertimeMinutes / overtimeMinutes : 0;
  // En az net çalışma sabit ve esnekte ortak; geç kalma eşiği yalnız sabit saatte anlamlı.
  const absentByFixedRule = !!shift && classification === "workday" && !params.hasLeave && (
    (fixedRules?.absentAfterLateMinutes !== undefined && lateMinutes > fixedRules.absentAfterLateMinutes) ||
    (shift.minWorkMinutes !== undefined && (evidence?.durationMeasured ?? (!!firstISO && !!lastISO)) && totalMinutes < shift.minWorkMinutes)
  );
  const attendanceDecision = fixedEvidence?.outsideWindow ? "incomplete" as const
    : absentByFixedRule && evidence ? "absent" as const : evidence?.decision;
  return {
    date,
    ...(params.includePunchSegments ? { punchSegments: pdksPunchSegments(resolvedPairReadings, minPunchInterval) } : {}),
    ...(flex ? {
      scheduleType: "flexible" as const,
      requiredNetMinutes,
      shortfallMinutes: evidence?.durationMeasured ? Math.max(0, (requiredNetMinutes ?? 0) - totalMinutes) : requiredNetMinutes === 0 ? 0 : null,
      excessMinutes: evidence?.durationMeasured ? Math.max(0, totalMinutes - (requiredNetMinutes ?? 0)) : 0,
      pendingUntil: flexiblePendingUntil(flex, date, firstISO),
      leaveWorkWarning: !!params.hasLeave && (!!firstISO || !!lastISO),
    } : {}),
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
    isOvernightShift: exitMayCrossMidnight(shift),
    hasAttendance: absentByFixedRule || fixedEvidence?.outsideWindow ? false : evidence ? evidence.attendanceCredit : !!firstISO || !!lastISO,
    attendanceDecision,
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
