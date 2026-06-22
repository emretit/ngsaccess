import type { Doc, Id } from "../_generated/dataModel";
import {
  classifyDay,
  dailyOvertimeForShift,
  evaluateLateEarly,
  isoTimeToTRMinutes,
  multiplierForClassification,
  parseHHMM,
  payrollCodeForDay,
  resolveHourlyRate,
  overtimePayTRY,
  type EffectiveOvertimeRates,
  type EffectiveWorkSettings,
} from "./pdksHelpers";
import { settingsForShift } from "./shiftResolver";
import {
  computeLateMinutes,
  formatHoursLabel,
  formatIstanbulTime,
  manualOverrideMinutes,
  matchEmployeeKey,
  minutesBetweenISO,
  resolveDayStatus,
} from "./pdksCalc";

type TableStatus = "present" | "late" | "absent" | "leave";
type MatrixStatus =
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "weekend"
  | "holiday";

export type PdksTableDayCell = {
  date: string;
  firstEntry: string | null;
  lastExit: string | null;
  totalMinutes: number;
  status: MatrixStatus;
  isLate: boolean;
  lateMinutes: number;
  payrollCode: string;
  overtimeMinutes: number;
};

export type PdksTableRow = {
  id: string;
  name: string;
  employeeId: string;
  payrollCode: string;
  payrollEmployeeCode: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  overtime: string;
  overtimeHours: number;
  overtimeMultiplier: number;
  overtimePayTRY: number | null;
  hourlyRate: number | null;
  yearlyOvertimeLimit: number;
  leaveType: string;
  status: TableStatus;
  isLate: boolean;
  isEarlyExit: boolean;
  isManual: boolean;
  manualNote: string | null;
  manualEditedBy: string | null;
  detailedLogs: Array<{
    time: string;
    action: string;
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
  | "overtime";

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
  empKey: string;
  empReadings: Doc<"cardReadings">[];
  employee: Doc<"employees"> | null;
  departmentName: string;
  periodDateKeys: string[];
  startDate: string;
  isSingleDay: boolean;
  viewMode: "single" | "matrix";
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
  const {
    empKey,
    empReadings,
    employee,
    periodDateKeys,
    startDate,
    isSingleDay,
    viewMode,
    manualPdksByEmpDate,
    allLeaves,
    holidayMap,
    workingDays,
    workSettings,
    overtimeRates,
    resolveShift,
  } = params;
  const empId = employee?._id;
  const hasLeave = empId
    ? allLeaves.some((l) => {
        if (l.employeeId !== empId) return false;
        return periodDateKeys.some((dk) => dk >= l.startDate && dk <= l.endDate);
      })
    : false;
  const leaveRecord = empId
    ? allLeaves.find((l) => {
        if (l.employeeId !== empId) return false;
        return periodDateKeys.some((dk) => dk >= l.startDate && dk <= l.endDate);
      })
    : null;
  const leaveType = leaveRecord
    ? LEAVE_TYPE_LABELS[leaveRecord.leaveType] ?? leaveRecord.leaveType
    : "-";

  const granted = empReadings.filter((r) => r.accessStatus === "izin_verildi");

  const manualToday =
    isSingleDay && empId
      ? manualPdksByEmpDate.get(`${empKey}__${startDate}`)
      : undefined;

  const firstEntryISO = manualToday?.entryTime
    ? `${startDate}T${manualToday.entryTime}:00.000+03:00`
    : granted[0]?.accessTime;
  const lastExitISO = manualToday?.exitTime
    ? `${startDate}T${manualToday.exitTime}:00.000+03:00`
    : granted[granted.length - 1]?.accessTime;

  const refDateISO = isSingleDay
    ? startDate
    : (firstEntryISO?.split("T")[0] ?? startDate);
  const refShift = employee ? resolveShift(employee._id, refDateISO) : null;
  const refSettings = settingsForShift(refShift, workSettings);
  const { isLate, isEarlyExit } = evaluateLateEarly(
    firstEntryISO,
    lastExitISO !== firstEntryISO ? lastExitISO : undefined,
    refSettings,
  );

  const status = resolveDayStatus({
    mode: "summary",
    classification: "workday",
    hasAttendance: !!firstEntryISO,
    hasLeave,
    isLate,
  });

  const dayReadingsMap = new Map<string, Doc<"cardReadings">[]>();
  for (const r of granted) {
    const dateKey = r.accessTime.split("T")[0];
    const dayReadings = dayReadingsMap.get(dateKey);
    if (dayReadings) {
      dayReadings.push(r);
    } else {
      dayReadingsMap.set(dateKey, [r]);
    }
  }

  let totalMinutes = 0;
  for (const dayReadings of dayReadingsMap.values()) {
    dayReadings.sort(
      (a, b) =>
        new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime(),
    );
    const firstOfDay = dayReadings[0];
    const lastOfDay = dayReadings[dayReadings.length - 1];
    if (firstOfDay && lastOfDay && firstOfDay._id !== lastOfDay._id) {
      totalMinutes += minutesBetweenISO(
        firstOfDay.accessTime,
        lastOfDay.accessTime,
      );
    }
  }

  if (isSingleDay && manualToday?.entryTime && manualToday?.exitTime) {
    totalMinutes = manualOverrideMinutes(
      manualToday.entryTime,
      manualToday.exitTime,
    );
  }

  let overtimeMinutes = 0;
  let overtimePayMultiplier = 0;

  if (isSingleDay) {
    const cls = classifyDay(startDate, workingDays, holidayMap.get(startDate));
    let lastExitMin: number | undefined;
    if (manualToday?.exitTime) {
      lastExitMin = parseHHMM(manualToday.exitTime);
    } else if (granted.length > 1) {
      const sortedGranted = [...granted].sort(
        (a, b) =>
          new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime(),
      );
      const lastGranted = sortedGranted[sortedGranted.length - 1];
      if (lastGranted) lastExitMin = isoTimeToTRMinutes(lastGranted.accessTime);
    }
    overtimeMinutes = dailyOvertimeForShift({
      classification: cls,
      netMinutes: totalMinutes,
      lastExitMinutes: lastExitMin,
      shift: refShift,
      workSettings,
    });
    if (overtimeMinutes > 0) {
      overtimePayMultiplier = multiplierForClassification(cls, overtimeRates);
    }
  } else {
    for (const [dk, dayReadings] of dayReadingsMap.entries()) {
      if (dayReadings.length < 2) continue;
      const dayFirst = dayReadings[0];
      const dayLast = dayReadings[dayReadings.length - 1];
      if (!dayFirst || !dayLast) continue;
      const dayFirstISO = dayFirst.accessTime;
      const dayLastISO = dayLast.accessTime;
      const dayNetMin = Math.floor(
        (new Date(dayLastISO).getTime() - new Date(dayFirstISO).getTime()) /
          60000,
      );
      const dayCls = classifyDay(dk, workingDays, holidayMap.get(dk));
      const dayShift = employee ? resolveShift(employee._id, dk) : null;
      overtimeMinutes += dailyOvertimeForShift({
        classification: dayCls,
        netMinutes: dayNetMin,
        lastExitMinutes: isoTimeToTRMinutes(dayLastISO),
        shift: dayShift,
        workSettings,
      });
    }
    if (overtimeMinutes > 0) {
      overtimePayMultiplier = workSettings.overtimeMultiplier;
    }
  }

  const hourlyRate = resolveHourlyRate({
    hourlyRate: employee?.hourlyRate,
    monthlySalary: employee?.monthlySalary,
    monthlyHoursBase: workSettings.monthlyHoursBase,
  });
  const overtimePayAmountTRY = overtimePayTRY({
    overtimeMinutes,
    multiplier: overtimePayMultiplier,
    hourlyRate,
  });

  const payrollCode = isSingleDay
    ? payrollCodeForDay({
        classification: classifyDay(
          startDate,
          workingDays,
          holidayMap.get(startDate),
        ),
        hasLeave,
        hasAttendance: !!firstEntryISO,
      })
    : "—";

  const days: PdksTableDayCell[] = [];
  if (viewMode === "matrix") {
    for (const dk of periodDateKeys) {
      const dayReadings = (dayReadingsMap.get(dk) ?? []).slice().sort(
        (a, b) =>
          new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime(),
      );
      const manualDay = empId
        ? manualPdksByEmpDate.get(`${empKey}__${dk}`)
        : undefined;
      const firstISO = manualDay?.entryTime
        ? `${dk}T${manualDay.entryTime}:00.000+03:00`
        : dayReadings[0]?.accessTime ?? null;
      const lastISO = manualDay?.exitTime
        ? `${dk}T${manualDay.exitTime}:00.000+03:00`
        : dayReadings.length > 1
          ? dayReadings[dayReadings.length - 1]?.accessTime ?? null
          : null;

      let dayMinutes = 0;
      if (manualDay?.entryTime && manualDay?.exitTime) {
        dayMinutes = manualOverrideMinutes(
          manualDay.entryTime,
          manualDay.exitTime,
        );
      } else if (firstISO && lastISO) {
        dayMinutes = Math.max(0, minutesBetweenISO(firstISO, lastISO));
      }

      const cls = classifyDay(dk, workingDays, holidayMap.get(dk));
      const dayHasLeave = empId
        ? allLeaves.some(
            (l) =>
              l.employeeId === empId && dk >= l.startDate && dk <= l.endDate,
          )
        : false;
      const dayCode = payrollCodeForDay({
        classification: cls,
        hasLeave: dayHasLeave,
        hasAttendance: !!firstISO,
      });
      const dayShift = employee ? resolveShift(employee._id, dk) : null;
      const daySettings = settingsForShift(dayShift, workSettings);
      const { isLate: dayLate } = evaluateLateEarly(
        firstISO ?? undefined,
        lastISO ?? undefined,
        daySettings,
      );
      const lateMinutes = computeLateMinutes(firstISO, dayLate, daySettings);

      const dayStatus = resolveDayStatus({
        mode: "calendar",
        classification: cls,
        hasAttendance: !!firstISO,
        hasLeave: dayHasLeave,
        isLate: dayLate,
      });

      const dayLastExitMin = lastISO ? isoTimeToTRMinutes(lastISO) : undefined;
      const dayOvertime = dailyOvertimeForShift({
        classification: cls,
        netMinutes: dayMinutes,
        lastExitMinutes: dayLastExitMin,
        shift: dayShift,
        workSettings,
      });

      days.push({
        date: dk,
        firstEntry: firstISO ? formatIstanbulTime(firstISO) : null,
        lastExit: lastISO ? formatIstanbulTime(lastISO) : null,
        totalMinutes: dayMinutes,
        status: dayStatus,
        isLate: dayLate,
        lateMinutes,
        payrollCode: dayCode,
        overtimeMinutes: dayOvertime,
      });
    }
  }

  return {
    id: empKey,
    name: employee
      ? `${employee.firstName} ${employee.lastName}`.trim()
      : "Bilinmiyor",
    employeeId: employee?.cardNumber ?? empKey,
    payrollCode,
    payrollEmployeeCode: employee?.payrollCode ?? "",
    department: params.departmentName,
    firstEntry: firstEntryISO ? formatIstanbulTime(firstEntryISO) : "-",
    lastExit:
      lastExitISO && lastExitISO !== firstEntryISO
        ? formatIstanbulTime(lastExitISO)
        : "-",
    totalHours: formatHoursLabel(totalMinutes),
    overtime: overtimeMinutes > 0 ? `${overtimeMinutes}m` : "0m",
    overtimeHours: overtimeMinutes / 60,
    overtimeMultiplier: overtimePayMultiplier,
    overtimePayTRY: overtimePayAmountTRY,
    hourlyRate,
    yearlyOvertimeLimit: workSettings.annualOvertimeLimitHours,
    leaveType,
    status,
    isLate,
    isEarlyExit,
    isManual: !!manualToday,
    manualNote: manualToday?.manualNote ?? null,
    manualEditedBy: params.manualEditedBy,
    detailedLogs: empReadings.map((r) => ({
      time: formatIstanbulTime(r.accessTime),
      action: r.accessStatus === "izin_verildi" ? "Giriş" : "Reddedildi",
      location: "Bilinmiyor",
    })),
    days,
  };
}

export function filterPdksTableRows(
  rows: PdksTableRow[],
  statusFilter: PdksTableStatusFilter | undefined,
): PdksTableRow[] {
  if (!statusFilter || statusFilter === "all") return rows;
  return rows.filter((row) => {
    if (statusFilter === "overtime") return row.overtimeHours > 0;
    return row.status === statusFilter;
  });
}
