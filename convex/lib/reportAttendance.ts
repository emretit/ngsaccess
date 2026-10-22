import { hasVersionedPdksPolicy, loadPdksPolicies } from "./pdksRules";
import { employedDuring, employedOn } from "./employment";
import { pdksAvailableDateKeys, pdksLeaveMatchesProject, pdksFirstRecordDate } from "./pdksAvailability";
import type { enrichReadingsForList } from "./cardReadingAudit";
import {
  classifyReadingSource,
  filterPdksReadings,
  type PdksReadingSource,
  type PdksSourceReading,
} from "./pdksSource";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { buildPdksEmployeeReadingMap, computePdksTableRow } from "./pdksTable";
import { buildPeriodDateKeys } from "./pdksCalc";
import { getEffectiveWorkSettings, getEffectiveOvertimeRates, getHolidaysMap, classifyDay } from "./pdksHelpers";
import { buildBoundedShiftResolver, buildShiftResolver, assignmentAppliesOnDate } from "./shiftResolver";
import { getTurkishHolidaysForYear, hasReligiousData } from "./turkishHolidays";
import { trDateKey, trDayRangeISO, trTodayKey } from "./trDate";
import { buildPdksWorkDateResolver, pdksWorkDayRange, addWorkDate, hasFlexiblePdksShift } from "./pdksWorkDay";
import { readReportReadings, reportPeriod, flexibleReportProjects } from "./reportScope";

export const ATTENDANCE_RELIABILITY_NOTE = "Güvenilirlik sınırı: İşe giriş tarihi tutulmadığından ay ortasında işe başlayanlar ayrıştırılamaz; ayrılanların son çalışma gününden sonraki günleri hesaplanmaz. Günler PDKS tablo motoruyla hesaplanır; yarım tatil günleri PDKS gibi tatil sayılır. Devam oranı, tamamlanmış beklenen günlerden izinler çıkarılarak hesaplanır. Tek izinli okuma veya manuel giriş devam kabul edilir; bu bir bordro onayı değildir.";

async function readReportManualRecords(ctx: QueryCtx, employeeId: Id<"employees">, startDate: string, endDate: string) {
  const records = await ctx.db.query("pdksRecords").withIndex("by_employee_date", q =>
    q.eq("employeeId", employeeId).gte("date", startDate).lte("date", endDate)).take(1001);
  if (records.length > 1000) throw new Error("Rapor manuel kayıt sınırı aşıldı");
  return records;
}

type TableParams = Parameters<typeof computePdksTableRow>[0];

/** Yalnız PDKS hücrelerini birleştirir; yeni gün sınıflandırma kuralı içermez. */
export function summarizeAttendance(params: TableParams, today: string, issues: string[] = []) {
  const periodDateKeys = params.periodDateKeys.filter((date) => date < today && (!params.employee || employedOn(params.employee, date)));
  const row = computePdksTableRow({ ...params, today, periodDateKeys, isSingleDay: false, viewMode: "matrix" });
  const workDays = row.days.filter((day) => ["N", "DV", "İZN"].includes(day.payrollCode));
  const presentDays = workDays.filter((day) => day.payrollCode === "N").length;
  const leaveDays = workDays.filter((day) => day.payrollCode === "İZN").length;
  const expectedDays = workDays.length - leaveDays;
  return {
    ...(row.scheduleType === "flexible" ? {
      requiredNetMinutes: row.requiredNetMinutes,
      shortfallMinutes: row.shortfallMinutes,
      excessMinutes: row.excessMinutes,
    } : {}),
    employeeId: row.id,
    name: row.name,
    department: row.department,
    presentDays,
    leaveDays,
    ...(params.policyFor ? { incompleteDays: row.days.filter(day => day.status === "incomplete").length } : {}),
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
  const projectRows = await Promise.all(projectIds.map(async (projectId) => {
    const [allEmployees, workSettings, overtimeRates, holidayMap, generalSettings] = await Promise.all([
      ctx.db.query("employees").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect(),
      getEffectiveWorkSettings(ctx, projectId),
      getEffectiveOvertimeRates(ctx, projectId),
      getHolidaysMap(ctx, projectId, startDate, endDate),
      ctx.db.query("generalSettings").withIndex("by_project", (q) => q.eq("projectId", projectId)).first(),
    ]);
    const employees = allEmployees.filter((employee) => employedDuring(employee, startDate, endDate) && employee.isVisitor !== true);
    const shiftResolver = await buildShiftResolver(ctx, allEmployees.filter(e => employedDuring(e, startDate, endDate)));
    const workingDays = generalSettings?.workingDays?.length ? generalSettings.workingDays : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
    const leaveLists = await Promise.all(employees.map(employee => ctx.db.query("leaves")
      .withIndex("by_employee_start", q => q.eq("employeeId", employee._id).lte("startDate", endDate)).collect()));
    const leavesByEmployee = new Map(employees.map((employee, index) => [employee._id,
      leaveLists[index].filter(leave => pdksLeaveMatchesProject(leave, projectId) && leave.status === "approved" && leave.endDate >= startDate)]));
    const calendarIssues = attendanceCalendarIssues(year, periodDateKeys, holidayMap);
    const flexible = [...shiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift(employees, shiftResolver.resolve, startDate, endDate);
    const earlyRecords = flexible ? new Map(await Promise.all(employees.map(async employee => {
      const records = await ctx.db.query("pdksRecords").withIndex("by_employee_date", q => q.eq("employeeId", employee._id).gte("date", addWorkDate(startDate, -1)).lte("date", addWorkDate(endDate, 1))).take(1001);
      if (records.length > 1000) throw new Error("Rapor manuel kayıt sınırı aşıldı");
      return [employee._id, records] as const;
    }))) : undefined;
    const manualEntries = new Map([...(earlyRecords?.values() ?? [])].flat().filter(record => record.manualEntry && record.projectId === projectId).map(record => [`${record.employeeId}__${record.date}`, record]));
    const policies = await loadPdksPolicies(ctx, [projectId], flexible ? addWorkDate(startDate, -1) : startDate, endDate);
    const { startISO, endISO } = pdksWorkDayRange(flexible ? addWorkDate(startDate, -1) : startDate, endDate);
    const raw = flexible ? await readReportReadings(ctx, [projectId], startISO, endISO, { policies, raw: true }) : [];
    const workDate = buildPdksWorkDateResolver(allEmployees.filter(e => employedDuring(e, startDate, endDate)), (id, date) => { const shift = shiftResolver.resolve(id, date); return shift?.projectId === projectId || shift?.scheduleType === "flexible" && !shift.projectId ? shift : null; }, flexible ? {
      readings: raw, manualEntryFor: (id, date) => manualEntries.get(`${id}__${date}`)?.entryTime,
      eligibleEntry: reading => filterPdksReadings([reading], projectId, r => policies(projectId, trDateKey(r.accessTime))).length > 0,
    } : undefined);
    const readings = flexible ? filterPdksReadings(raw, projectId, r => policies(projectId, workDate(r))) : await readReportReadings(ctx, [projectId], startISO, endISO, { policies, workDate });
    const employeeMap = buildPdksEmployeeReadingMap({ employees, readings });
    const availableDateKeys = pdksAvailableDateKeys(readings, workDate);
    return await Promise.all(employees.map(async (employee) => {
      const [records, department, assignments] = await Promise.all([
        earlyRecords?.get(employee._id) ?? ctx.db.query("pdksRecords").withIndex("by_employee_date", (q) => q.eq("employeeId", employee._id).gte("date", startDate).lte("date", endDate)).collect(),
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
          policyFor: date => policies(projectId, date),
          availableDateKeys,
          firstRecordDate: await pdksFirstRecordDate(ctx, employee, employeeMap.get(employee._id) ?? [], records.filter(r => r.manualEntry && r.projectId === projectId).map(r => r.date), workDate, policies),
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
            return shift?.projectId === projectId || shift?.scheduleType === "flexible" && !shift.projectId ? shift : null;
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

/** Versioned report adapter. Legacy report rows keep their existing aggregations. */
export async function loadRuleReportDays(ctx: QueryCtx, projectIds: Id<"projects">[], startDate: string, endDate: string, options: { includeLegacyReadings?: boolean; preloadedReadings?: { readings: readonly Doc<"cardReadings">[]; startISO: string; endISO: string } } = {}) {
  const policies = await loadPdksPolicies(ctx, projectIds, addWorkDate(startDate, -7), addWorkDate(endDate, 1));
  const dates = buildPeriodDateKeys(startDate, endDate);
  const activeProjects = projectIds.filter(id => hasVersionedPdksPolicy(policies, id, addWorkDate(startDate, -1), endDate));
  const ruleEmployees = new Map<Id<"employees">, Doc<"employees">>();
  const result = new Map<Id<"employees">, ReturnType<typeof computePdksTableRow>>();
  const readingsByProject = new Map<Id<"projects">, Doc<"cardReadings">[]>();
  const workDates = new Map<string, string>();
  const manualEntriesByEmployee = new Map<string, Doc<"pdksRecords">>();
  const legacyManualRecords = new Map<Id<"employees">, Doc<"pdksRecords">[]>();
  const legacyEmployees = new Map<Id<"employees">, Doc<"employees">>();
  const rememberLegacyManual = (employee: Doc<"employees">, records: Doc<"pdksRecords">[], managedDates = new Set<string>()) => {
    const legacy = records.filter(record => record.manualEntry && record.projectId === employee.projectId &&
      record.date >= startDate && record.date <= endDate && employedOn(employee, record.date) &&
      policies(employee.projectId, record.date).punchMode !== "requirements" && !managedDates.has(record.date));
    if (legacy.some(record => record.entryTime || record.exitTime)) {
      legacyManualRecords.set(employee._id, legacy);
      legacyEmployees.set(employee._id, employee);
    }
  };
  const discoveryEmployees = new Map<Id<"projects">, Doc<"employees">[]>();
  const flexibleProjects = await flexibleReportProjects(ctx, projectIds.filter(id => !activeProjects.includes(id)), startDate, endDate, discoveryEmployees);
  const managedProjects = projectIds.filter(id => activeProjects.includes(id) || flexibleProjects.has(id));
  const legacyProjects = projectIds.filter(id => !managedProjects.includes(id));
  if (options.includeLegacyReadings !== false && legacyProjects.length) {
    const { startISO, endISO } = trDayRangeISO(startDate, endDate);
    const readings = await readReportReadings(ctx, legacyProjects, startISO, endISO, { policies, workDate: r => trDateKey(r.accessTime) });
    for (const id of legacyProjects) readingsByProject.set(id, readings.filter(r => r.projectId === id));
    for (const projectId of legacyProjects) {
      const employees = discoveryEmployees.get(projectId) ?? await ctx.db.query("employees")
        .withIndex("by_project", q => q.eq("projectId", projectId)).take(10001);
      if (employees.length > 10000) throw new Error("Rapor personel sınırı aşıldı");
      for (const employee of employees.filter(e => employedDuring(e, startDate, endDate))) {
        rememberLegacyManual(employee, await readReportManualRecords(ctx, employee._id, startDate, endDate));
      }
    }
  }
  for (const projectId of managedProjects) {
    const allEmployees = discoveryEmployees.get(projectId) ?? await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)).take(10001);
    if (allEmployees.length > 10000) throw new Error("Rapor personel sınırı aşıldı");
    const shifts = await buildBoundedShiftResolver(ctx, allEmployees);
    const flexible = [...shifts.shifts.values()].some(shift => shift.scheduleType === "flexible");
    const earlyManual = flexible ? new Map(await Promise.all(allEmployees.filter(e => employedDuring(e, startDate, endDate)).map(async employee => {
      const records = await readReportManualRecords(ctx, employee._id, addWorkDate(startDate, -7), addWorkDate(endDate, 1));
      return [employee._id, records] as const;
    }))) : undefined;
    const manualEntries = new Map([...(earlyManual?.values() ?? [])].flat().filter(record => record.manualEntry && record.projectId === projectId).map(record => [`${record.employeeId}__${record.date}`, record]));
    if (!flexible && !activeProjects.includes(projectId)) {
      if (options.includeLegacyReadings !== false) {
        const legacyRange = trDayRangeISO(startDate, endDate);
        const readings = await readReportReadings(ctx, [projectId], legacyRange.startISO, legacyRange.endISO, { policies, workDate: r => trDateKey(r.accessTime) });
        readingsByProject.set(projectId, readings);
        for (const employee of allEmployees.filter(e => employedDuring(e, startDate, endDate))) {
          rememberLegacyManual(employee, earlyManual?.get(employee._id) ?? await readReportManualRecords(ctx, employee._id, startDate, endDate));
        }
      }
      continue;
    }
    let raw: Doc<"cardReadings">[];
    const boundaryWorkDate = buildPdksWorkDateResolver(allEmployees, shifts.resolve);
    const range = pdksWorkDayRange(addWorkDate(startDate, -7), endDate);
    const preloaded = options.preloadedReadings;
    if (preloaded) {
      // Reuse the dashboard range, reading only the missing history and night-shift tail.
      const before: Doc<"cardReadings">[] = [];
      const after: Doc<"cardReadings">[] = [];
      if (range.startISO < preloaded.startISO) {
        before.push(...await readReportReadings(ctx, [projectId], range.startISO,
          new Date(Date.parse(preloaded.startISO) - 1).toISOString(), { policies, workDate: boundaryWorkDate, raw: flexible }));
      }
      if (range.endISO > preloaded.endISO) {
        after.push(...await readReportReadings(ctx, [projectId],
          new Date(Date.parse(preloaded.endISO) + 1).toISOString(), range.endISO, { policies, workDate: boundaryWorkDate, raw: flexible }));
      }
      raw = [
        ...before,
        ...preloaded.readings.filter(reading => reading.projectId === projectId && reading.accessTime >= range.startISO && reading.accessTime <= range.endISO),
        ...after,
      ];
    } else {
      raw = await readReportReadings(ctx, [projectId], range.startISO, range.endISO, { policies, workDate: boundaryWorkDate, raw: flexible });
    }
    const flexibleWorkDate = flexible ? buildPdksWorkDateResolver(allEmployees, shifts.resolve, {
      readings: raw, manualEntryFor: (id, date) => manualEntries.get(`${id}__${date}`)?.entryTime,
      eligibleEntry: reading => filterPdksReadings([reading], projectId, r => policies(projectId, trDateKey(r.accessTime))).length > 0,
    }) : boundaryWorkDate;
    const employeesById = new Map(allEmployees.map(employee => [employee._id, employee]));
    const employeesByCard = new Map(allEmployees.map(employee => [employee.cardNumber, employee]));
    const workDate = (reading: Doc<"cardReadings">) => {
      if (activeProjects.includes(projectId)) return flexibleWorkDate(reading);
      const employee = reading.employeeId ? employeesById.get(reading.employeeId) : employeesByCard.get(reading.cardNo);
      const date = trDateKey(reading.accessTime);
      return employee && (shifts.resolve(employee._id, date)?.scheduleType === "flexible" || shifts.resolve(employee._id, addWorkDate(date, -1))?.scheduleType === "flexible") ? flexibleWorkDate(reading) : date;
    };
    const readings = filterPdksReadings(raw, undefined, reading => policies(projectId, workDate(reading)));
    for (const [key, record] of manualEntries) manualEntriesByEmployee.set(key, record);
    for (const reading of raw) workDates.set(reading._id, workDate(reading));
    readingsByProject.set(projectId, readings.filter(reading => workDate(reading) >= startDate && workDate(reading) <= endDate));
    if (!flexible && !dates.some(date => policies(projectId, date).punchMode === "requirements")) continue;
    const [workSettings, overtimeRates, holidayMap, general] = await Promise.all([
      getEffectiveWorkSettings(ctx, projectId), getEffectiveOvertimeRates(ctx, projectId), getHolidaysMap(ctx, projectId, startDate, endDate),
      ctx.db.query("generalSettings").withIndex("by_project", q => q.eq("projectId", projectId)).first(),
    ]);
    const availableDateKeys = pdksAvailableDateKeys(readings, workDate);
    const employeeReadings = buildPdksEmployeeReadingMap({ employees: allEmployees, readings });
    for (const employee of allEmployees.filter(e => employedDuring(e, startDate, endDate))) {
      const [manual, leaves] = await Promise.all([
        earlyManual?.get(employee._id) ?? readReportManualRecords(ctx, employee._id, startDate, endDate),
        ctx.db.query("leaves").withIndex("by_employee_start", q => q.eq("employeeId", employee._id).lte("startDate", endDate)).take(1001),
      ]);
      if (manual.length > 1000 || leaves.length > 1000) throw new Error("Rapor kayıt sınırı aşıldı");
      const records = manual.filter(r => r.manualEntry && r.projectId === projectId);
      const empReadings = employeeReadings.get(employee._id) ?? [];
      const row = computePdksTableRow({
        policyFor: date => policies(projectId, date), availableDateKeys,
        firstRecordDate: await pdksFirstRecordDate(ctx, employee, empReadings, records.map(r => r.date), workDate, policies),
        employee, empKey: employee._id, empReadings, departmentName: "", periodDateKeys: dates.filter(date => employedOn(employee, date)),
        startDate, isSingleDay: false, viewMode: "matrix", manualPdksByEmpDate: new Map(records.map(r => [`${employee._id}__${r.date}`, r])),
        allLeaves: leaves.filter(l => l.status === "approved" && pdksLeaveMatchesProject(l, projectId)), holidayMap,
        workingDays: general?.workingDays?.length ? general.workingDays : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"],
        workSettings, overtimeRates, resolveShift: shifts.resolve, manualEditedBy: null,
      });
      const managedDays = row.days.filter(day => policies(projectId, day.date).punchMode === "requirements" || shifts.resolve(employee._id, day.date)?.scheduleType === "flexible");
      rememberLegacyManual(employee, records, new Set(managedDays.map(day => day.date)));
      if (managedDays.length) {
        ruleEmployees.set(employee._id, employee);
        result.set(employee._id, { ...row, days: managedDays });
      }
    }
  }
  const dateFor = (reading: Doc<"cardReadings">) => workDates.get(reading._id) ?? trDateKey(reading.accessTime);
  const employeeByCard = new Map([...ruleEmployees.values()].map(employee => [`${employee.projectId}__${employee.cardNumber}`, employee]));
  const managesReading = (reading: Doc<"cardReadings">) => {
    const date = dateFor(reading);
    const employeeId = reading.employeeId ?? employeeByCard.get(`${reading.projectId}__${reading.cardNo}`)?._id;
    return policies(reading.projectId, date).punchMode === "requirements" ||
      (employeeId !== undefined && result.get(employeeId)?.days.some(day => day.date === date) === true);
  };
  return { policies, workDate: dateFor, managesReading,
    manualEntryFor: (id: Id<"employees">, date: string) => manualEntriesByEmployee.get(`${id}__${date}`)?.entryTime,
    legacyManualRecords, reportEmployees: new Map([...legacyEmployees, ...ruleEmployees]),
    ruleRows: result, ruleEmployees, readings: [...readingsByProject.values()].flat() };
}
