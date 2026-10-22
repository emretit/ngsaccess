import { flexibleMinuteFields, type FlexibleMinutes } from "./pdksFlexible";
import { employedOn } from "./employment";
import type { PdksPolicyResolver } from "./pdksRules";
// Reading inputs must already be source-filtered at the handler/loader boundary.
import { trTodayKey } from "./trDate";
import type { Doc, Id } from "../_generated/dataModel";
import {
  payrollCodeForDay,
  resolveHourlyRate,
  type EffectiveOvertimeRates,
  type EffectiveWorkSettings,
} from "./pdksHelpers";
import { settingsForShift } from "./shiftResolver";
import {
  buildPeriodDateKeys,
  computeBreakViolation,
  formatHoursLabel,
  formatIstanbulTime,
  matchEmployeeKey,
  resolveDayStatus,
} from "./pdksCalc";
import { calculatePeriodOvertime, overtimePeriodRange } from "./overtimeCalc";
import { computePdksDay } from "./pdksDay";
import { pdksLeaveMatchesProject } from "./pdksAvailability";
import { addWorkDate, groupPdksWorkDays } from "./pdksWorkDay";

export type PdksDayStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "weekend"
  | "holiday"
  | "future"
  | "noData"
  | "notEmployed"
  | "incomplete";

/** Absence needs project data and a known employment period; time before shift start is pending. */
export function classifyPdksDay(params: {
  pendingUntil?: number;
  durationMeasured?: boolean;
  attendanceDecision?: "present" | "absent" | "incomplete";
  date: string;
  today?: string;
  dataAvailable: boolean;
  firstRecordDate?: string | null;
  shiftStart?: string;
  shiftEnd?: string;
  earlyExitTolerance?: number;
  hasAssignedShift?: boolean;
  lateTolerance?: number;
  now?: number;
  classification: "workday" | "weekend" | "holiday" | "halfDayHoliday";
  hasAttendance: boolean;
  hasLeave: boolean;
  isLate: boolean;
}): PdksDayStatus {
  if (params.date > (params.today ?? trTodayKey())) return "future";
  const status = resolveDayStatus({
    ...params,
    mode: "calendar",
    classification: params.classification === "halfDayHoliday" ? "holiday" : params.classification,
  });
  if (params.pendingUntil !== undefined && !params.durationMeasured && !params.hasLeave
      && params.classification === "workday" && (params.now ?? Date.now()) <= params.pendingUntil) return "future";
  if (params.attendanceDecision !== undefined) {
    // Rest days and approved leave never become missing-data/review days.
    if (status === "weekend" || status === "holiday" || status === "leave") return status;
    if (params.pendingUntil === undefined && params.attendanceDecision !== "present" && params.shiftEnd) {
      const endDate = params.shiftStart && params.shiftEnd <= params.shiftStart
        ? addWorkDate(params.date, 1) : params.date;
      const threshold = Date.parse(`${endDate}T${params.shiftEnd}:00+03:00`) + (params.earlyExitTolerance ?? 0) * 60000;
      if ((params.now ?? Date.now()) <= threshold) return "future";
    }
    if (status === "absent" && params.firstRecordDate === null && !params.hasAttendance) return "noData";
    if (!params.hasAttendance && params.firstRecordDate && params.date < params.firstRecordDate) return "notEmployed";
    if (status === "absent" && !params.dataAvailable) return "noData";
    return status;
  }
  if (status !== "absent") return status;
  if (!params.hasAttendance && params.firstRecordDate && params.date < params.firstRecordDate)
    return "notEmployed";
  if (
    !params.hasAttendance &&
    params.date === (params.today ?? trTodayKey()) &&
    params.shiftStart
  ) {
    const threshold =
      new Date(`${params.date}T${params.shiftStart}:00+03:00`).getTime() +
      (params.lateTolerance ?? 0) * 60000;
    if ((params.now ?? Date.now()) <= threshold) return "future";
  }
  if (params.firstRecordDate === null && !params.hasAttendance) return "noData";
  if (!params.hasAttendance && params.dataAvailable === false) return "noData";
  if (
    !params.hasAttendance &&
    !params.hasLeave &&
    params.hasAssignedShift === false &&
    params.classification === "workday"
  )
    return "noData";
  return status;
}

/** Rapor ekranları için gün ayrıntısı: plan (vardiya) ve gerçekleşen yan yana. */
export type PdksDayDetail = {
  dayType: "workday" | "weekend" | "holiday" | "halfDayHoliday";
  shiftName: string | null;
  plannedStart: string;
  plannedEnd: string;
  isEarlyExit: boolean;
  /** `lateMinutes` gibi tolerans düşülerek hesaplanır. */
  earlyExitMinutes: number;
  readingCount: number;
  isManual: boolean;
  punches: Array<{ time: string; direction: "entry" | "exit" | "unknown" }>;
  plannedBreakStart: string | null;
  plannedBreakEnd: string | null;
  breakViolation: boolean;
};

export type PdksTableDayCell = FlexibleMinutes & {
  durationMeasured?: boolean;
  punchQuality?: import("./pdksEvidence").PunchQuality;
  date: string;
  firstEntry: string | null;
  lastExit: string | null;
  totalMinutes: number;
  status: PdksDayStatus;
  leaveType: string | null;
  isLate: boolean;
  lateMinutes: number;
  payrollCode: string;
  overtimeMinutes: number;
  nightMinutes?: number;
  rawTotalMinutes?: number;
  /** Matris modunda her zaman dolu; testlerde elle kurulan hücrelerde yok. */
  detail?: PdksDayDetail;
};

export type PdksTableRow = FlexibleMinutes & {
  incompleteDays?: number;
  durationMeasured?: boolean;
  punchQuality?: import("./pdksEvidence").PunchQuality;
  id: string;
  name: string;
  employeeId: string;
  cardNumber: string;
  payrollCode: string;
  payrollEmployeeCode: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes?: number;
  rawTotalMinutes?: number;
  overtime: string;
  overtimeHours: number;
  overtimeMultiplier: number;
  overtimePayTRY: number | null;
  hourlyRate: number | null;
  yearlyOvertimeLimit: number;
  leaveType: string;
  status: PdksDayStatus;
  isLate: boolean;
  isEarlyExit: boolean;
  isManual: boolean;
  manualNote: string | null;
  manualEditedBy: string | null;
  detailedLogs: Array<{
    time: string;
    action: string;
    direction: "entry" | "exit" | "unknown";
    location: string;
  }>;
  days: PdksTableDayCell[];
};

export type PdksTableStatusFilter =
  | "all"
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "overtime"
  | "weekend"
  | "holiday"
  | "future"
  | "noData"
  | "notEmployed"
  | "incomplete";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Yıllık",
  sick: "Hastalık",
  excuse: "Mazeret",
  unpaid: "Ücretsiz",
  parental: "Doğum/Ebeveyn",
  marriage: "Evlilik",
  bereavement: "Vefat",
  paternity: "Babalık",
  lactation: "Süt izni",
  compensatory: "Telafi",
};

export function buildPdksEmployeeReadingMap(params: {
  employees: Doc<"employees">[];
  readings: Doc<"cardReadings">[];
}): Map<string, Doc<"cardReadings">[]> {
  const empById = new Map<string, Doc<"employees">>();
  const empIdByCard = new Map<string, string>();
  for (const emp of params.employees) {
    empById.set(String(emp._id), emp);
    if (emp.cardNumber) empIdByCard.set(emp.cardNumber, String(emp._id));
  }
  const validEmpIds = new Set(empById.keys());

  const employeeMap = new Map<string, Doc<"cardReadings">[]>();
  for (const emp of params.employees) {
    employeeMap.set(String(emp._id), []);
  }

  for (const r of params.readings) {
    const empKey = matchEmployeeKey(
      { employeeId: r.employeeId, cardNo: r.cardNo },
      validEmpIds,
      empIdByCard,
    );
    if (!empKey) continue;
    const empReadings = employeeMap.get(empKey);
    if (empReadings) empReadings.push(r);
  }

  return employeeMap;
}

export function computePdksTableRow(params: {
  policyFor?: PdksPolicyResolver;
  today?: string;
  now?: number;
  firstRecordDate?: string | null;
  /** Dates with at least one eligible reading in this employee's project. */
  availableDateKeys: ReadonlySet<string>;
  empKey: string;
  empReadings: Doc<"cardReadings">[];
  employee: Doc<"employees"> | null;
  departmentName: string;
  periodDateKeys: string[];
  startDate: string;
  isSingleDay: boolean;
  viewMode: "single" | "matrix";
  includePunches?: boolean;
  manualPdksByEmpDate: ReadonlyMap<string, Doc<"pdksRecords">>;
  allLeaves: Doc<"leaves">[];
  holidayMap: ReadonlyMap<string, Doc<"holidays">>;
  workingDays: string[];
  workSettings: EffectiveWorkSettings;
  overtimeRates: EffectiveOvertimeRates;
  resolveShift: (
    employeeId: Id<"employees">,
    dateISO: string,
  ) => Doc<"shifts"> | null;
  manualEditedBy: string | null;
}): PdksTableRow {
  const { employee, empKey, workSettings, overtimeRates } = params;
  const empId = employee?._id;
  const byDate = empId
    ? groupPdksWorkDays(params.empReadings, empId, params.resolveShift, (id, date) => params.manualPdksByEmpDate.get(`${id}__${date}`)?.entryTime)
    : new Map<string, Doc<"cardReadings">[]>();
  const hourlyRate = resolveHourlyRate({
    hourlyRate: employee?.hourlyRate,
    monthlySalary: employee?.monthlySalary,
    monthlyHoursBase: workSettings.monthlyHoursBase,
  });
  const sortedDates = [...params.periodDateKeys].sort();
  const periodStart = sortedDates[0] ?? params.startDate;
  const periodEnd = sortedDates[sortedDates.length - 1] ?? params.startDate;
  const range = overtimePeriodRange(periodStart, periodEnd, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
  const allCalculations = buildPeriodDateKeys(range.startDate, range.endDate).map((date) => {
    const outsideEmployment = params.policyFor?.(date).punchMode === "requirements" && employee !== null && !employedOn(employee, date);
    const readings = outsideEmployment ? [] : byDate.get(date) ?? [];
    const shift = empId ? params.resolveShift(empId, date) : null;
    const manual = outsideEmployment ? undefined : params.manualPdksByEmpDate.get(`${empKey}__${date}`);
    const leave = params.allLeaves.find(
      (l) => l.employeeId === empId && pdksLeaveMatchesProject(l, employee?.projectId) && date >= l.startDate && date <= l.endDate,
    );
    const settings = settingsForShift(shift, workSettings);
    const day = computePdksDay({
      policy: params.policyFor?.(date),
      hasLeave: !!leave,
      date,
      readings,
      manual,
      shift,
      workSettings,
      overtimeRates,
      hourlyRate,
      workingDays: params.workingDays,
      holiday: params.holidayMap.get(date),
      holidayMap: params.holidayMap,
    });
    const status = outsideEmployment ? "notEmployed" : classifyPdksDay({
      date,
      firstRecordDate: params.firstRecordDate,
      shiftStart: shift?.startTime ?? (params.policyFor?.(date).punchMode === "requirements" ? settings.workStartTime : undefined),
      shiftEnd: settings.workEndTime,
      earlyExitTolerance: settings.earlyExitToleranceMinutes,
      hasAssignedShift:
        params.firstRecordDate !== undefined ? shift !== null : undefined,
      lateTolerance: settings.maxLateMinutes,
      now: params.now,
      today: params.today,
      dataAvailable: employee !== null && (params.availableDateKeys.has(date) || (params.policyFor?.(date).punchMode === "requirements" && !!manual)),
      classification: day.classification,
      pendingUntil: day.pendingUntil,
      durationMeasured: day.durationMeasured,
      attendanceDecision: day.attendanceDecision,
    hasAttendance: day.hasAttendance,
      hasLeave: !!leave,
      isLate: day.isLate,
    });
    const code = payrollCodeForDay({
      classification: day.classification,
      hasLeave: !!leave,
      hasAttendance: day.hasAttendance,
    });
    const cell: PdksTableDayCell = {
      date,
      ...flexibleMinuteFields(day),
      ...(day.scheduleType === "flexible" || params.policyFor?.(date).punchMode === "requirements" ? { durationMeasured: day.durationMeasured, punchQuality: day.punchQuality } : {}),
      firstEntry: day.firstISO ? formatIstanbulTime(day.firstISO) : null,
      lastExit: day.lastISO ? formatIstanbulTime(day.lastISO) : null,
      totalMinutes: day.totalMinutes,
      rawTotalMinutes: day.rawTotalMinutes,
      nightMinutes: day.nightMinutes,
      overtimeMinutes: day.overtimeMinutes,
      status,
      leaveType: leave?.leaveType ?? null,
      isLate: day.isLate,
      lateMinutes: day.lateMinutes,
      payrollCode:
        status === "incomplete" || status === "future" || status === "noData" || status === "notEmployed"
          ? "—"
          : code,
      detail: {
        dayType: day.classification,
        shiftName: shift?.name ?? null,
        plannedStart: day.scheduleType === "flexible" ? "Esnek" : settings.workStartTime,
        plannedEnd: day.scheduleType === "flexible" ? "Esnek" : settings.workEndTime,
        isEarlyExit: day.isEarlyExit,
        earlyExitMinutes: day.earlyExitMinutes,
        readingCount: readings.filter((r) => r.accessStatus === "izin_verildi")
          .length,
        isManual: !!manual,
        punches: params.includePunches
          ? readings
              .filter((r) => r.accessStatus === "izin_verildi")
              .slice(0, 24)
              .map((r) => ({
                time: formatIstanbulTime(r.accessTime),
                direction: r.direction ?? "unknown",
              }))
          : [],
        plannedBreakStart: day.scheduleType === "flexible" ? null : shift?.breakStart ?? null,
        plannedBreakEnd: day.scheduleType === "flexible" ? null : shift?.breakEnd ?? null,
        breakViolation:
          day.scheduleType === "flexible" || manual?.entryTime && manual.exitTime
            ? false
            : computeBreakViolation({
                punchTimes: readings
                  .filter((r) => r.accessStatus === "izin_verildi")
                  .map((r) => r.accessTime),
                breakStart: shift?.breakStart,
                breakEnd: shift?.breakEnd,
              }),
      },
    };
    return { day, cell, manual, leave, readings };
  });
  const calculationByDate = new Map(allCalculations.map((c) => [c.cell.date, c]));
  const calculations = params.periodDateKeys.flatMap((date) => {
    const calculation = calculationByDate.get(date);
    return calculation ? [calculation] : [];
  });
  const periodOvertime = calculatePeriodOvertime(allCalculations.map((c) => c.day), {
    startDate: periodStart, endDate: periodEnd,
    overtimeBasis: overtimeRates.overtimeBasis, hourlyRate,
  });
  for (const calculation of calculations) {
    calculation.cell.overtimeMinutes = periodOvertime.overtimeByDate[calculation.cell.date]?.overtimeMinutes ?? 0;
  }
  const first = calculations.find((c) => c.day.firstISO) ?? calculations[0];
  const last = [...calculations].reverse().find((c) => c.day.lastISO);
  const totalMinutes = calculations.reduce(
    (sum, c) => sum + c.day.totalMinutes,
    0,
  );
  const { overtimeMinutes } = periodOvertime;
  const leaveRecord = calculations.find((c) => c.leave)?.leave;
  const status = first?.cell.status ?? "noData";
  const flexibleDays = calculations.filter(c => c.day.scheduleType === "flexible");
  return {
    ...(flexibleDays.length ? {
      scheduleType: "flexible" as const,
      requiredNetMinutes: flexibleDays.reduce((sum, c) => sum + (c.day.requiredNetMinutes ?? 0), 0),
      shortfallMinutes: flexibleDays.some(c => c.day.shortfallMinutes === null) ? null : flexibleDays.reduce((sum, c) => sum + (c.day.shortfallMinutes ?? 0), 0),
      excessMinutes: flexibleDays.reduce((sum, c) => sum + (c.day.excessMinutes ?? 0), 0),
      leaveWorkWarning: flexibleDays.some(c => c.day.leaveWorkWarning),
    } : {}),
    incompleteDays: calculations.filter(c => c.cell.status === "incomplete").length,
    durationMeasured: calculations.every(c => c.day.durationMeasured),
    punchQuality: first?.day.punchQuality ?? "noPunch",
    id: empKey,
    name: employee
      ? `${employee.firstName} ${employee.lastName}`.trim()
      : "Bilinmiyor",
    employeeId: employee?.cardNumber ?? "",
    cardNumber: employee?.cardNumber ?? "",
    payrollCode: params.isSingleDay ? (first?.cell.payrollCode ?? "—") : "—",
    payrollEmployeeCode: employee?.payrollCode ?? "",
    department: params.departmentName,
    firstEntry: first?.day.firstISO
      ? formatIstanbulTime(first.day.firstISO)
      : "-",
    lastExit: last?.day.lastISO ? formatIstanbulTime(last.day.lastISO) : "-",
    totalHours: formatHoursLabel(totalMinutes),
    totalMinutes,
    rawTotalMinutes: calculations.reduce(
      (sum, c) => sum + c.day.rawTotalMinutes,
      0,
    ),
    nightMinutes: calculations.reduce((sum, c) => sum + c.day.nightMinutes, 0),
    overtimeMinutes,
    overtime: `${overtimeMinutes}m`,
    overtimeHours: overtimeMinutes / 60,
    overtimeMultiplier: periodOvertime.overtimeMultiplier,
    overtimePayTRY: periodOvertime.overtimePayTRY,
    hourlyRate,
    yearlyOvertimeLimit: workSettings.annualOvertimeLimitHours,
    leaveType: leaveRecord
      ? (LEAVE_TYPE_LABELS[leaveRecord.leaveType] ?? leaveRecord.leaveType)
      : "",
    status,
    isLate: first?.day.isLate ?? false,
    isEarlyExit: last?.day.isEarlyExit ?? false,
    isManual: params.isSingleDay && !!first?.manual,
    manualNote: params.isSingleDay ? (first?.manual?.manualNote ?? null) : null,
    manualEditedBy: params.manualEditedBy,
    detailedLogs: calculations
      .flatMap((c) => c.readings)
      .map((r) => ({
        time: formatIstanbulTime(r.accessTime),
        action:
          r.accessStatus !== "izin_verildi"
            ? "Reddedildi"
            : r.direction === "entry"
              ? "Giriş"
              : r.direction === "exit"
                ? "Çıkış"
                : "Yön belirtilmemiş",
        direction: r.direction ?? "unknown",
        location: "Bilinmiyor",
      })),
    days: params.viewMode === "matrix" ? calculations.map((c) => c.cell) : [],
  };
}

export function filterPdksTableRows<T extends PdksTableRow>(
  rows: T[],
  statusFilter: PdksTableStatusFilter | undefined,
): T[] {
  if (!statusFilter || statusFilter === "all") return rows;
  return rows.filter((row) => {
    if (statusFilter === "overtime") return row.overtimeHours > 0;
    return row.status === statusFilter;
  });
}
