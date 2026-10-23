import { hasDirectionalPdksCheckpoints } from "./pdksRules";
import { flexibleMinuteFields } from "./pdksFlexible";
import type { PdksPolicyResolver } from "./pdksRules";
// Reading inputs must already be source-filtered at the handler/loader boundary.
import { classifyPdksDay } from "./pdksTable";
import type { Doc } from "../_generated/dataModel";
import {
  payrollCodeForDay,
  type EffectiveWorkSettings,
  type EffectiveOvertimeRates,
} from "./pdksHelpers";
import { settingsForShift } from "./shiftResolver";
import { computePdksPlannedDay, plannedDayFields } from "./pdksMultiShift";
import type { DayPlan } from "./shiftResolver";

export function computePayrollCell(params: {
  policyFor?: PdksPolicyResolver;
  date: string;
  availableDateKeys: ReadonlySet<string>;
  firstRecordDate?: string | null;
  manual: Doc<"pdksRecords"> | undefined;
  dayReadings: Doc<"cardReadings">[];
  hasLeave: boolean;
  holiday: Doc<"holidays"> | null | undefined;
  holidayMap?: ReadonlyMap<string, Doc<"holidays">>;
  workingDays: string[];
  dayShift: Doc<"shifts"> | null;
  dayPlan?: DayPlan;
  workSettings: EffectiveWorkSettings;
  overtimeRates: EffectiveOvertimeRates;
  empHourlyRate: number | null;
}) {
  const { date, dayShift, workSettings } = params;
  const day = computePdksPlannedDay({
    hasLeave: params.hasLeave,
      policy: params.policyFor?.(date),
    date,
    readings: params.dayReadings,
    manual: params.manual,
    shift: dayShift,
    dayPlan: params.dayPlan,
    workSettings,
    overtimeRates: params.overtimeRates,
    hourlyRate: params.empHourlyRate,
    workingDays: params.workingDays,
    holiday: params.holiday,
    holidayMap: params.holidayMap,
  });
  const lastShift = params.dayPlan?.kind === "shifts" ? params.dayPlan.shifts[params.dayPlan.shifts.length - 1] ?? dayShift : dayShift;
  const settings = settingsForShift(lastShift, workSettings);
  const status = classifyPdksDay({
    date,
    dataAvailable: params.availableDateKeys.has(date) || (params.policyFor?.(date).punchMode === "requirements" && !!params.manual),
    firstRecordDate: params.firstRecordDate,
    shiftStart: dayShift?.startTime ?? (params.policyFor?.(date).punchMode === "requirements" ? settings.workStartTime : undefined),
    shiftEnd: settings.workEndTime,
    earlyExitTolerance: settings.earlyExitToleranceMinutes,
    hasAssignedShift:
      params.firstRecordDate !== undefined ? dayShift !== null : undefined,
    lateTolerance: dayShift?.lateToleranceMinutes ?? workSettings.maxLateMinutes,
    classification: day.classification,
    pendingUntil: day.pendingUntil,
    durationMeasured: day.durationMeasured,
    attendanceDecision: day.attendanceDecision,
    hasAttendance: day.hasAttendance,
    hasLeave: params.hasLeave,
    isLate: day.isLate,
  });
  const code = payrollCodeForDay({
    classification: day.classification,
    hasLeave: params.hasLeave,
    hasAttendance: day.hasAttendance,
  });
  return {
    date,
    ...flexibleMinuteFields(day),
    ...plannedDayFields(day),
    ...(day.segments || day.scheduleType === "flexible" || params.policyFor?.(date).calculationMode === "eachPunch" || params.policyFor?.(date).punchMode === "requirements" || params.policyFor && hasDirectionalPdksCheckpoints(params.policyFor(date)) ? { durationMeasured: day.durationMeasured, punchQuality: day.punchQuality } : {}),
    overtimeSegments: day.overtimeSegments,
    status,
    payrollCode:
      status === "incomplete" || status === "future" || status === "noData" || status === "notEmployed"
        ? "—"
        : code,
    totalMinutes: day.totalMinutes,
    rawTotalMinutes: day.rawTotalMinutes,
    nightMinutes: day.nightMinutes,
    overtimeMinutes: day.overtimeMinutes,
    multiplier: day.multiplier,
    overtimePayTRY: day.overtimePayTRY,
    isLate: day.isLate,
    isEarlyExit: day.isEarlyExit,
    isManual: !!params.manual,
    classification: day.classification,
  };
}
