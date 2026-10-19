// Reading inputs must already be source-filtered at the handler/loader boundary.
import { classifyPdksDay } from "./pdksTable";
import type { Doc } from "../_generated/dataModel";
import {
  payrollCodeForDay,
  type EffectiveWorkSettings,
  type EffectiveOvertimeRates,
} from "./pdksHelpers";
import { settingsForShift } from "./shiftResolver";
import { computePdksDay } from "./pdksDay";

export function computePayrollCell(params: {
  date: string;
  availableDateKeys: ReadonlySet<string>;
  firstRecordDate?: string | null;
  manual: Doc<"pdksRecords"> | undefined;
  dayReadings: Doc<"cardReadings">[];
  hasLeave: boolean;
  holiday: Doc<"holidays"> | null | undefined;
  workingDays: string[];
  dayShift: Doc<"shifts"> | null;
  workSettings: EffectiveWorkSettings;
  overtimeRates: EffectiveOvertimeRates;
  empHourlyRate: number | null;
}) {
  const { date, dayShift, workSettings } = params;
  const day = computePdksDay({
    date,
    readings: params.dayReadings,
    manual: params.manual,
    shift: dayShift,
    workSettings,
    overtimeRates: params.overtimeRates,
    hourlyRate: params.empHourlyRate,
    workingDays: params.workingDays,
    holiday: params.holiday,
  });
  const settings = settingsForShift(dayShift, workSettings);
  const status = classifyPdksDay({
    date,
    dataAvailable: params.availableDateKeys.has(date),
    firstRecordDate: params.firstRecordDate,
    shiftStart: dayShift?.startTime,
    hasAssignedShift:
      params.firstRecordDate !== undefined ? dayShift !== null : undefined,
    lateTolerance: settings.maxLateMinutes,
    classification: day.classification,
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
    status,
    payrollCode:
      status === "future" || status === "noData" || status === "notEmployed"
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
