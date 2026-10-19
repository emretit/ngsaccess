import { pdksAvailableDateKeys, pdksLeaveMatchesProject, pdksFirstRecordDate } from "./pdksAvailability";
import type { enrichReadingsForList } from "./cardReadingAudit";
import {
  classifyReadingSource,
  type PdksReadingSource,
  type PdksSourceReading,
} from "./pdksSource";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { buildPdksEmployeeReadingMap, computePdksTableRow } from "./pdksTable";
import { buildPeriodDateKeys } from "./pdksCalc";
import { getEffectiveWorkSettings, getEffectiveOvertimeRates, getHolidaysMap, classifyDay } from "./pdksHelpers";
import { buildShiftResolver, assignmentAppliesOnDate } from "./shiftResolver";
import { getTurkishHolidaysForYear, hasReligiousData } from "./turkishHolidays";
import { trTodayKey } from "./trDate";
import { buildPdksWorkDateResolver, pdksWorkDayRange } from "./pdksWorkDay";
import { readReportReadings, reportPeriod } from "./reportScope";

export const ATTENDANCE_RELIABILITY_NOTE = "Güvenilirlik sınırı: İşe giriş/çıkış tarihleri tutulmadığından dönem, bugün aktif olan personelin tamamına uygulanır; ay ortasında işe başlayanlar ayrıştırılamaz. Günler PDKS tablo motoruyla hesaplanır; yarım tatil günleri PDKS gibi tatil sayılır. Devam oranı, tamamlanmış beklenen günlerden izinler çıkarılarak hesaplanır. Tek izinli okuma veya manuel giriş devam kabul edilir; bu bir bordro onayı değildir.";

type TableParams = Parameters<typeof computePdksTableRow>[0];

/** Yalnız PDKS hücrelerini birleştirir; yeni gün sınıflandırma kuralı içermez. */
export function summarizeAttendance(params: TableParams, today: string, issues: string[] = []) {
  const periodDateKeys = params.periodDateKeys.filter((date) => date < today);
  const row = computePdksTableRow({ ...params, today, periodDateKeys, isSingleDay: false, viewMode: "matrix" });
  const workDays = row.days.filter((day) => ["N", "DV", "İZN"].includes(day.payrollCode));
  const presentDays = workDays.filter((day) => day.payrollCode === "N").length;
  const leaveDays = workDays.filter((day) => day.payrollCode === "İZN").length;
  const expectedDays = workDays.length - leaveDays;
  return {
    employeeId: row.id,
    name: row.name,
    department: row.department,
    presentDays,
    leaveDays,
    expectedDays: issues.length ? null : expectedDays,
    absentDays: issues.length ? null : workDays.filter((day) => day.payrollCode === "DV").length,
    devamOrani: issues.length || expectedDays === 0 ? null : Math.round(presentDays / expectedDays * 100),
    reliabilityNote: issues.join(" "),
  };
}

export function attendanceCalendarIssues(year: number, dates: string[], holidayMap: ReadonlyMap<string, Doc<"holidays">>) {
  const missing = getTurkishHolidaysForYear(year).filter((holiday) => dates.includes(holiday.date) && !holidayMap.has(holiday.date));
  return [
    ...(missing.length ? ["Resmi tatil takvimi eksik; devamsızlık ve oran doğrulanamadı."] : []),
    ...(dates.length > 0 && !hasReligiousData(year) ? ["Bu yılın dini tatil takvimi doğrulanamıyor."] : []),
  ];
}

export function hasUnsupportedShiftCalendar(assignments: Doc<"shiftAssignments">[], dates: string[], workingDays: string[], holidayMap: ReadonlyMap<string, Doc<"holidays">>) {
  return dates.some((date) => {
    const assignment = [...assignments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .find((item) => date >= item.startDate && date <= item.endDate);
    if (!assignment?.weekPattern?.length || holidayMap.has(date)) return false;
    return assignmentAppliesOnDate(assignment, date) !== (classifyDay(date, workingDays) === "workday");
  });
}

export async function loadAttendanceReport(ctx: QueryCtx, projectIds: Id<"projects">[], year: number, month: number) {
  const { startDate, endDate } = reportPeriod(year, month);
  const today = trTodayKey();
  const periodDateKeys = buildPeriodDateKeys(startDate, endDate).filter((date) => date < today);
  const { startISO, endISO } = pdksWorkDayRange(startDate, endDate);
  const projectRows = await Promise.all(projectIds.map(async (projectId) => {
    const [allEmployees, readings, workSettings, overtimeRates, holidayMap, generalSettings] = await Promise.all([
      ctx.db.query("employees").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect(),
      readReportReadings(ctx, [projectId], startISO, endISO),
      getEffectiveWorkSettings(ctx, projectId),
      getEffectiveOvertimeRates(ctx, projectId),
      getHolidaysMap(ctx, projectId, startDate, endDate),
      ctx.db.query("generalSettings").withIndex("by_project", (q) => q.eq("projectId", projectId)).first(),
    ]);
    const employees = allEmployees.filter((employee) => employee.isActive === true && employee.isVisitor !== true);
    const employeeMap = buildPdksEmployeeReadingMap({ employees, readings });
    const shiftResolver = await buildShiftResolver(ctx, allEmployees.filter(e => e.isActive));
    const workingDays = generalSettings?.workingDays?.length ? generalSettings.workingDays : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
    const leaveLists = await Promise.all(employees.map(employee => ctx.db.query("leaves")
      .withIndex("by_employee_start", q => q.eq("employeeId", employee._id).lte("startDate", endDate)).collect()));
    const leavesByEmployee = new Map(employees.map((employee, index) => [employee._id,
      leaveLists[index].filter(leave => pdksLeaveMatchesProject(leave, projectId) && leave.status === "approved" && leave.endDate >= startDate)]));
    const calendarIssues = attendanceCalendarIssues(year, periodDateKeys, holidayMap);
    const workDate = buildPdksWorkDateResolver(allEmployees.filter(e => e.isActive), (id, date) => { const shift = shiftResolver.resolve(id, date); return shift?.projectId === projectId ? shift : null; });
    const availableDateKeys = pdksAvailableDateKeys(readings, workDate);
    return await Promise.all(employees.map(async (employee) => {
      const [records, department, assignments] = await Promise.all([
        ctx.db.query("pdksRecords").withIndex("by_employee_date", (q) => q.eq("employeeId", employee._id).gte("date", startDate).lte("date", endDate)).collect(),
        employee.departmentId ? ctx.db.get(employee.departmentId) : null,
        ctx.db.query("shiftAssignments").withIndex("by_employee", (q) => q.eq("employeeId", employee._id)).collect(),
      ]);
      const issues = [...calendarIssues];
      if (hasUnsupportedShiftCalendar(assignments, periodDateKeys, workingDays, holidayMap)) {
        issues.push("Vardiya haftalık gün düzeni mevcut PDKS gün sınıflandırmasında kullanılmıyor; devamsızlık ve oran doğrulanamadı.");
      }
      const manualPdksByEmpDate = new Map(records.filter((record) => record.manualEntry && record.projectId === projectId).map((record) => [`${employee._id}__${record.date}`, record]));
      return {
        ...summarizeAttendance({
          availableDateKeys,
          firstRecordDate: await pdksFirstRecordDate(ctx, employee, employeeMap.get(employee._id) ?? [], records.filter(r => r.manualEntry && r.projectId === projectId).map(r => r.date), workDate),
          empKey: employee._id,
          employee,
          empReadings: employeeMap.get(employee._id) ?? [],
          departmentName: department?.projectId === projectId ? department.name : "Departmansız",
          periodDateKeys,
          startDate,
          isSingleDay: false,
          viewMode: "matrix",
          manualPdksByEmpDate,
          allLeaves: leavesByEmployee.get(employee._id) ?? [],
          holidayMap,
          workingDays,
          workSettings,
          overtimeRates,
          resolveShift: (employeeId, date) => {
            const shift = shiftResolver.resolve(employeeId, date);
            return shift?.projectId === projectId ? shift : null;
          },
          manualEditedBy: null,
        }, today, issues),
        projectId,
      };
    }));
  }));
  return {
    year, month, startDate, endDate,
    completedThrough: periodDateKeys[periodDateKeys.length - 1] ?? null,
    reliabilityNote: ATTENDANCE_RELIABILITY_NOTE,
    rows: projectRows.flat().sort((a, b) => a.name.localeCompare(b.name, "tr")),
  };
}

export type ReportTransactionResult = "granted" | "denied" | "unknown";

export function matchesReadingSources(
  source: PdksReadingSource,
  sources: readonly PdksReadingSource[] | undefined,
): boolean {
  return !sources?.length || sources.includes(source);
}

export type ReportTransactionRow = {
  _id: Id<"cardReadings">;
  accessTime: string;
  employeeId: Id<"employees"> | null;
  employeeName: string | null;
  department: string | null;
  cardNo: string;
  deviceName: string | null;
  doorName: string | null;
  direction: "entry" | "exit" | "unknown";
  result: ReportTransactionResult;
  denialReason: string | null;
  source: PdksReadingSource;
  sourceLabel: string;
};

export const READING_SOURCE_LABELS: Record<PdksReadingSource, string> = {
  card: "Kart",
  pin: "Şifre",
  qr: "QR",
  mobile: "Mobil",
  manual: "Manuel",
  biometric: "Biyometrik",
  unknown: "Belirsiz",
};

export function readingResult(status: Doc<"cardReadings">["accessStatus"]): ReportTransactionResult {
  if (status === "izin_verildi") return "granted";
  if (status === "reddedildi") return "denied";
  return "unknown";
}

/** Call only after splitting out biometric readings at the report query boundary. */
export function toReportTransactionRow(
  enriched: Awaited<ReturnType<typeof enrichReadingsForList>>[number],
): ReportTransactionRow {
  const source = classifyReadingSource(enriched);
  const employee = enriched.employees;
  return {
    _id: enriched._id,
    accessTime: enriched.accessTime,
    employeeId: enriched.employeeId ?? null,
    employeeName: employee
      ? `${employee.firstName} ${employee.lastName}`.trim()
      : enriched.employeeName ?? null,
    department: employee?.departments?.name ?? null,
    cardNo: enriched.cardNo,
    deviceName: enriched.devices?.name ?? null,
    doorName: enriched.door?.name ?? null,
    direction: enriched.direction ?? "unknown",
    result: readingResult(enriched.accessStatus),
    denialReason: enriched.hikDenialReason ?? null,
    source,
    sourceLabel: READING_SOURCE_LABELS[source],
  };
}

/** Raw report boundary: unknown is visible, only biometrics are hidden. */
export function splitPdksEligible<T extends PdksSourceReading>(
  rows: readonly T[],
): { eligible: T[]; hiddenBiometricCount: number } {
  const eligible: T[] = [];
  let hiddenBiometricCount = 0;
  for (const row of rows) {
    if (classifyReadingSource(row) !== "biometric") eligible.push(row);
    else hiddenBiometricCount += 1;
  }
  return { eligible, hiddenBiometricCount };
}
