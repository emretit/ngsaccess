// Reading inputs must already be source-filtered at the handler/loader boundary.
import { classifyPdksDay } from "./pdksTable";
import type { Doc } from "../_generated/dataModel";
import {
  payrollCodeForDay,
  type EffectiveWorkSettings,
  type EffectiveOvertimeRates,
} from "./pdksHelpers";
import { settingsForShift } from "./shiftResolver";
import { formatIstanbulTime, formatHoursLabel } from "./pdksCalc";
import { calculatePeriodOvertime, type OvertimeDay } from "./overtimeCalc";
import { computePdksDay } from "./pdksDay";

export function computeAttendanceDetailDay(params: {
  date: string;
  availableDateKeys: ReadonlySet<string>;
  firstRecordDate?: string | null;
  dayReadings: Doc<"cardReadings">[];
  manualDay: Doc<"pdksRecords"> | undefined;
  leaves: Doc<"leaves">[];
  holiday: Doc<"holidays"> | null | undefined;
  holidayMap?: ReadonlyMap<string, Doc<"holidays">>;
  dayShift: Doc<"shifts"> | null;
  workSettings: EffectiveWorkSettings;
  workingDays: string[];
  overtimeRates?: EffectiveOvertimeRates;
}) {
  const { date, dayShift, workSettings } = params;
  const day = computePdksDay({
    date,
    readings: params.dayReadings,
    manual: params.manualDay,
    shift: dayShift,
    workSettings,
    overtimeRates: params.overtimeRates,
    workingDays: params.workingDays,
    holiday: params.holiday,
    holidayMap: params.holidayMap,
  });
  const leave = params.leaves.find(
    (l) => date >= l.startDate && date <= l.endDate,
  );
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
    hasLeave: !!leave,
    isLate: day.isLate,
  });
  const code = payrollCodeForDay({
    classification: day.classification,
    hasLeave: !!leave,
    hasAttendance: day.hasAttendance,
  });
  return {
    date,
    overtimeSegments: day.overtimeSegments,
    firstEntry: day.firstISO ? formatIstanbulTime(day.firstISO) : null,
    lastExit: day.lastISO ? formatIstanbulTime(day.lastISO) : null,
    totalMinutes: day.totalMinutes,
    rawTotalMinutes: day.rawTotalMinutes,
    totalHours: formatHoursLabel(day.totalMinutes),
    nightMinutes: day.nightMinutes,
    status,
    isLate: day.isLate,
    isEarlyExit: day.isEarlyExit,
    payrollCode:
      status === "future" || status === "noData" || status === "notEmployed"
        ? "—"
        : code,
    overtimeMinutes: day.overtimeMinutes,
    isManual: !!params.manualDay,
    isOvernightShift: day.isOvernightShift,
    exitNextDay: day.exitNextDay,
    manualNote: params.manualDay?.manualNote ?? null,
    leaveType: leave?.leaveType ?? null,
    rawReadings: params.dayReadings.map((r) => ({
      id: String(r._id),
      time: formatIstanbulTime(r.accessTime, true),
      accessStatus: r.accessStatus,
      direction: r.direction ?? ("unknown" as const),
      deviceId: r.deviceId ? String(r.deviceId) : null,
    })),
  };
}

/** Gün listesinden özet sayaçları (çalışılan/geç/devamsız/izinli + toplam dakika/mesai). */
export function summarizeAttendanceDays(
  days: ReadonlyArray<OvertimeDay & { status: string }>,
  options: Parameters<typeof calculatePeriodOvertime>[1],
) {
  const totals = days.reduce(
    (acc, d) => {
      if (d.date < options.startDate || d.date > options.endDate) return acc;
      acc.totalMinutes += d.totalMinutes;
      if (d.status === "present" || d.status === "late") acc.workedDays += 1;
      if (d.status === "late") acc.lateDays += 1;
      if (d.status === "absent") acc.absentDays += 1;
      if (d.status === "leave") acc.leaveDays += 1;
      return acc;
    },
    { totalMinutes: 0, workedDays: 0, lateDays: 0, absentDays: 0, leaveDays: 0 },
  );
  return { ...totals, ...calculatePeriodOvertime(days, options) };
}
