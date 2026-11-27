import { setPdksHistoryReadings } from "./lib/pdksAvailability";
import { annualOvertimeRanges, mergeAnnualBalances, type AnnualBalanceRow } from "./lib/annualOvertime";
export { annualOvertimeRanges, mergeAnnualBalances } from "./lib/annualOvertime";
import { pdksReadingValidator } from "./lib/pdksTransport";
import { internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { readBoundedPdks, withPdksReadBudget, pdksReadBudget, type PdksBatchScope } from "./lib/pdksTableQuery";
import { resolveReadingScope, MONITORING_READING_PERMISSIONS, REPORT_READING_PERMISSIONS } from "./lib/readingAccess";
import { computePdksPlannedDay, scopedPdksPlan, shiftForInstant, usesPlanDayRules, splitReadingsByShift } from "./lib/pdksMultiShift";
import { buildPeriodDateKeys } from "./lib/pdksCalc";
import { hasFixedShiftRules, usesShiftDayRules } from "./lib/pdksFixedRules";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { resolveAttendanceEvidence } from "./lib/pdksEvidence";
import { addWorkDate, buildPdksWorkDateResolver, groupPdksWorkDays } from "./lib/pdksWorkDay";
import type { PdksTableRow } from "./lib/pdksTable";
import { filterPdksReadings } from "./lib/pdksSource";
import { cardKey } from "./lib/employeeUx";
import { summarizeDailyReadings } from "./lib/dashboardActivity";
import { countDashboardRows } from "./lib/dashboardCounts";
import { createHourlyCounter } from "./lib/dashboardTimeline";
import { trDateKey, trTodayKey, trDayRangeISO } from "./lib/trDate";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { authedAction, authedQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import {
  buildBoundedShiftResolver,
  thresholdsForShift,
  type ShiftResolver,
} from "./lib/shiftResolver";
import {
  getEffectiveWorkSettings,
  DEFAULT_WORK_SETTINGS,
  type EffectiveWorkSettings,
  isoTimeToTRMinutes,
  dailyOvertimeForShift,
} from "./lib/pdksHelpers";
import type { PdksDayPolicy, PdksProjectPolicies } from "./lib/pdksRules";
import {
  bucketWeeklyOvertime,
  type DayEntry,
  ANNUAL_OVERTIME_LIMIT_MINUTES,
} from "./lib/overtimeCalc";

type AuthedCtx = QueryCtx & { user: Doc<"users"> };

export const getStats = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    // Ana sayfa bugünkü okuma sayısını getTodayTimeline.total'dan alır; false verince okumalar
    // ikinci kez taranmaz ve sorgu her kart okumasında yeniden çalışmaz. Varsayılan true: 61cd264
    // öncesi/canlı eski web paketi cardReadings'i hâlâ okuyor; tüm paketler geçince alan kaldırılabilir.
    includeTodayReadings: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
    const today = trTodayKey();
    const { startISO: todayISO, endISO: todayEndISO } = trDayRangeISO(today, today);
    const includeTodayReadings = args.includeTodayReadings ?? true;

    let employees = 0;
    let devices = 0;
    let todayReadings = 0;
    let pendingRules = 0;

    if (ctx.user.role === "super_admin" && !args.projectId) {
      [employees, devices, todayReadings, pendingRules] = await Promise.all([
        countDashboardRows(ctx.db.query("employees").withIndex("by_project")),
        countDashboardRows(
          ctx.db.query("devices").withIndex("by_active", (q) => q.eq("isActive", true))
        ),
        includeTodayReadings
          ? countDashboardRows(
              ctx.db.query("cardReadings").withIndex("by_access_time", (q) =>
                q.gte("accessTime", todayISO).lte("accessTime", todayEndISO)
              )
            )
          : 0,
        countDashboardRows(
          ctx.db.query("accessRules").withIndex("by_active", (q) => q.eq("isActive", false))
        ),
      ]);
    } else if (allowedProjectIds.length > 0) {
      const [empResults, devResults, readingResults, ruleResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            countDashboardRows(ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid)))
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            countDashboardRows(ctx.db
              .query("devices")
              .withIndex("by_project_active", (q) =>
                q.eq("projectId", pid).eq("isActive", true)))
          )
        ),
        Promise.all(
          (includeTodayReadings ? allowedProjectIds : []).map((pid) =>
            countDashboardRows(ctx.db
              .query("cardReadings")
              .withIndex("by_project_access_time", (q) =>
                q.eq("projectId", pid).gte("accessTime", todayISO).lte("accessTime", todayEndISO)))
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            countDashboardRows(ctx.db
              .query("accessRules")
              .withIndex("by_project_active", (q) =>
                q.eq("projectId", pid).eq("isActive", false)))
          )
        ),
      ]);
      employees = empResults.reduce((sum, count) => sum + count, 0);
      devices = devResults.reduce((sum, count) => sum + count, 0);
      todayReadings = readingResults.reduce((sum, count) => sum + count, 0);
      pendingRules = ruleResults.reduce((sum, count) => sum + count, 0);
    }

    return {
      employees,
      devices,
      // Sayılmadıysa 0 değil undefined: "bugün okuma yok" ile karışmasın.
      cardReadings: includeTodayReadings ? todayReadings : undefined,
      pendingRequests: pendingRules,
    };
  },
});

/** Bugünkü kart okumalarının İstanbul saatine göre saatlik dağılımı (izin / ret). */
export const getTodayTimeline = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveReadingScope(ctx, args.projectId, MONITORING_READING_PERMISSIONS);
    const today = trTodayKey();
    const { startISO, endISO } = trDayRangeISO(today, today);
    const counter = createHourlyCounter();
    const queries =
      ctx.user.role === "super_admin" && !args.projectId
        ? [ctx.db.query("cardReadings").withIndex("by_access_time", (q) =>
            q.gte("accessTime", startISO).lte("accessTime", endISO))]
        : allowedProjectIds.map((pid) =>
            ctx.db.query("cardReadings").withIndex("by_project_access_time", (q) =>
              q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO)));
    for (const query of queries) {
      for await (const reading of query) counter.add(reading);
    }
    return counter.result();
  },
});

type PdksStatsCore = {
  totalEmployees: number;
  presentToday: number;
  lateArrivals: number;
  overtimeHours: number;
  insideBuilding: number;
  leaveToday: number;
  devamOrani: number;
};

async function loadPdksDataset(
  ctx: AuthedCtx,
  rangeStartISO: string,
  rangeEndISO: string,
  filters: {
    companyId?: Id<"companies">;
    departmentId?: Id<"departments">;
    positionId?: Id<"positions">;
    shiftId?: Id<"shifts">;
    projectId?: Id<"projects">;
  },
  batch?: PdksBatchScope & { readingStartISO: string; readingEndISO: string },
): Promise<{
  employees: Doc<"employees">[];
  readings: Doc<"cardReadings">[];
  activityReadings: Doc<"cardReadings">[];
  leaves: Doc<"leaves">[];
  deptNameById: Map<string, string>;
  shiftResolver: ShiftResolver;
  workSettings: EffectiveWorkSettings;
  ruleRows: Map<Id<"employees">, PdksTableRow>;
  policies: PdksProjectPolicies;
  workSettingsProjectId: Id<"projects"> | undefined;
}> {
  ctx = withPdksReadBudget(ctx);
  if (batch?.preloadedReadings) setPdksHistoryReadings(ctx, batch.preloadedReadings, batch.readingEndISO);
  const allowedProjectIds = await resolveReadingScope(ctx, filters.projectId, REPORT_READING_PERMISSIONS);
  let employees: Doc<"employees">[] = [];
  const readings: Doc<"cardReadings">[] = [];

  const budget = pdksReadBudget();
  if (batch) {
    employees = batch.employees.filter(employee => employee.isActive);
    readings.push(...(batch.preloadedReadings ?? []).filter(reading => reading.accessTime >= rangeStartISO && reading.accessTime <= rangeEndISO));
  } else {
  for (const pid of allowedProjectIds) {
    employees.push(...(await readBoundedPdks(ctx.db.query("employees")
      .withIndex("by_project", q => q.eq("projectId", pid)), budget)).filter(employee => employee.isActive));
    readings.push(...await readBoundedPdks(ctx.db.query("cardReadings")
      .withIndex("by_project_access_time", q => q.eq("projectId", pid)
        .gte("accessTime", rangeStartISO).lte("accessTime", rangeEndISO)), budget));
  }

  }

  const loadedResolver = await buildBoundedShiftResolver(ctx, employees, {
    start: addWorkDate(trDateKey(rangeStartISO), -7), end: addWorkDate(trDateKey(rangeEndISO), 1),
  });
  const employeeProjects = new Map(employees.map(employee => [employee._id, employee.projectId]));
  const resolvePlan: ShiftResolver["resolvePlan"] = (id, date) => scopedPdksPlan(loadedResolver.resolvePlan(id, date), employeeProjects.get(id));
  const shiftResolver: ShiftResolver = {
    ...loadedResolver, resolvePlan,
    resolve: (id, date) => { const plan = resolvePlan(id, date); return plan.kind !== "none" ? plan.shifts[0] ?? null : null; },
    resolveLast: (id, date) => { const plan = resolvePlan(id, date); return plan.kind !== "none" ? plan.shifts[plan.shifts.length - 1] ?? null : null; },
  };
  const ruleReport = await loadRuleReportDays(ctx, allowedProjectIds, trDateKey(rangeStartISO), trDateKey(rangeEndISO), {
    includeLegacyReadings: false, preloadedEmployees: employees, shiftResolver,
    preloadedReadings: batch ? { readings: batch.preloadedReadings ?? [], startISO: batch.readingStartISO, endISO: batch.readingEndISO } : { readings, startISO: rangeStartISO, endISO: rangeEndISO },
  });

  if (filters.companyId) employees = employees.filter((e) => e.companyId === filters.companyId);
  if (filters.departmentId) employees = employees.filter((e) => e.departmentId === filters.departmentId);
  if (filters.positionId) employees = employees.filter((e) => e.positionId === filters.positionId);

  const leaves: Doc<"leaves">[] = [];
  if (batch) {
    for (const employee of employees) leaves.push(...(await readBoundedPdks(ctx.db.query("leaves")
      .withIndex("by_project_employee_end", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id).gte("endDate", trDateKey(rangeStartISO))), budget))
      .filter(leave => leave.status === "approved" && leave.startDate <= trDateKey(rangeEndISO)));
  } else {
  for (const pid of allowedProjectIds) {
    leaves.push(...(await readBoundedPdks(ctx.db.query("leaves")
      .withIndex("by_project_end", q => q.eq("projectId", pid).gte("endDate", trDateKey(rangeStartISO))), budget))
      .filter(leave => leave.status === "approved" && leave.startDate <= trDateKey(rangeEndISO)));
  }
  }
  // Include legacy leaves without projectId, but only for this scope's employees.
  for (const employee of employees) {
    leaves.push(...(await readBoundedPdks(ctx.db.query("leaves")
      .withIndex("by_project_employee_end", q => q.eq("projectId", undefined).eq("employeeId", employee._id)
        .gte("endDate", trDateKey(rangeStartISO))), budget))
      .filter(leave => leave.status === "approved" && leave.startDate <= trDateKey(rangeEndISO)));
  }
  const deptDocs = (await Promise.all([...new Set(employees.flatMap(employee => employee.departmentId ? [employee.departmentId] : []))]
    .map(id => ctx.db.get(id)))).filter((doc): doc is NonNullable<typeof doc> => doc !== null);

  if (filters.shiftId) {
    // Shift filters match resolved shifts during the period, including overrides of employee defaults.
    const dates = buildPeriodDateKeys(trDateKey(rangeStartISO), trDateKey(rangeEndISO));
    employees = employees.filter(employee => dates.some(date => {
      const plan = shiftResolver.resolvePlan(employee._id, date);
      return plan.kind !== "none" && plan.shifts.some(shift => shift._id === filters.shiftId);
    }));
  }
  const deptNameById = new Map<string, string>(
    deptDocs.map((d) => [String(d._id), d.name])
  );

  const settingsProjectId =
    filters.projectId ?? (ctx.user.role === "super_admin"
      ? employees[0]?.projectId
      : allowedProjectIds[0]);
  const workSettings = settingsProjectId
    ? await getEffectiveWorkSettings(ctx, settingsProjectId)
    : DEFAULT_WORK_SETTINGS;

  const workDate = dashboardWorkDateResolver(employees, shiftResolver, ruleReport.workDate);
  const filtered = filterPdksReadings(readings, filters.projectId, r => ruleReport.policies(r.projectId, workDate(r)));
  const employeesById = new Map(employees.map(employee => [employee._id, employee]));
  const employeesByCard = new Map(employees.flatMap(employee => {
    const key = cardKey(employee.cardNumber);
    return key ? [[employee.cardNumber, employee] as const] : [];
  }));
  const legacy = filtered.filter(r => {
    const employee = r.employeeId ? employeesById.get(r.employeeId) : employeesByCard.get(r.cardNo);
    return employee && shiftResolver.resolvePlan(employee._id, workDate(r)).kind !== "none" && !ruleReport.managesReading(r);
  });
  const versioned: Doc<"cardReadings">[] = [];
  for (const employee of employees) {
    const employeeCard = cardKey(employee.cardNumber);
    for (const [date, list] of groupPdksWorkDays(ruleReport.readings.filter(r => r.employeeId === employee._id || (!r.employeeId && employeeCard !== undefined && r.cardNo === employee.cardNumber)), employee._id, shiftResolver.resolve, ruleReport.manualEntryFor, undefined, shiftResolver.resolveLast, date => ruleReport.policies(employee.projectId, date))) {
      const policy = ruleReport.policies(employee.projectId, date);
      if (policy.punchMode !== "requirements" && !usesPlanDayRules(shiftResolver.resolvePlan(employee._id, date)) && !usesShiftDayRules(shiftResolver.resolve(employee._id, date))) continue;
      const cell = ruleReport.ruleRows.get(employee._id)?.days.find(day => day.date === date);
      if (cell?.status !== "present" && cell?.status !== "late") continue;
      const evidence = resolveAttendanceEvidence(list, undefined, policy);
      const selected = list.filter(r => r.accessTime === evidence.firstISO || r.accessTime === evidence.lastISO);
      versioned.push(...(evidence.durationMeasured ? selected : selected.slice(0, 1)));
    }
  }
  return { employees, readings: [...legacy, ...versioned], activityReadings: filtered, leaves, deptNameById, shiftResolver, workSettings, ruleRows: ruleReport.ruleRows, policies: ruleReport.policies, workSettingsProjectId: settingsProjectId };
}

/** Keep the legacy boundary resolver for ordinary person-days, even with versioned policies. */
export function dashboardWorkDateResolver(
  employees: readonly Doc<"employees">[],
  shifts: ShiftResolver,
  reportWorkDate: (reading: Doc<"cardReadings">) => string,
) {
  const legacyWorkDate = buildPdksWorkDateResolver(employees, shifts.resolve, undefined, undefined, shifts.resolveLast);
  const hasShiftRules = [...shifts.shifts.values()].some(usesShiftDayRules);
  const byId = new Map(employees.map(employee => [employee._id, employee]));
  const byCard = new Map(employees.flatMap(employee => {
    const key = cardKey(employee.cardNumber);
    return key ? [[employee.cardNumber, employee] as const] : [];
  }));
  return (reading: Doc<"cardReadings">) => {
    const employee = reading.employeeId ? byId.get(reading.employeeId) : byCard.get(reading.cardNo);
    const date = trDateKey(reading.accessTime);
    const planned = employee && [date, addWorkDate(date, -1)].some(day => usesPlanDayRules(shifts.resolvePlan(employee._id, day)));
    return hasShiftRules || planned ? reportWorkDate(reading) : legacyWorkDate(reading);
  };
}

export function computePdksCoreInMemory(
  employees: Doc<"employees">[],
  readings: Doc<"cardReadings">[],
  leaves: Doc<"leaves">[],
  range: { start: string; end: string },
  deptNameById: Map<string, string>,
  shiftResolver: ShiftResolver,
  workSettings: EffectiveWorkSettings,
  ruleRows: ReadonlyMap<Id<"employees">, Pick<PdksTableRow, "days">> = new Map(),
): { core: PdksStatsCore; lateByDept: Map<string, number> } {
  const allowedEmpIds = new Set(employees.map((e) => String(e._id)));
  const startDate = trDateKey(range.start);
  const endDate = trDateKey(range.end);

  const dayReadings = readings.filter(
    (r) =>
      r.accessTime >= range.start &&
      r.accessTime <= range.end &&
      r.accessStatus === "izin_verildi" &&
      r.employeeId &&
      allowedEmpIds.has(String(r.employeeId)) &&
      scopedPdksPlan(shiftResolver.resolvePlan(r.employeeId, trDateKey(r.accessTime)), r.projectId).kind !== "none"
  );

  const presentSet = new Set<string>();
  const lateSet = new Set<string>();
  const empFirstEntry = new Map<string, string>();
  const empDayReadings = new Map<string, Doc<"cardReadings">[]>();

  for (const r of dayReadings) {
    const key = String(r.employeeId);
    if (!empFirstEntry.has(key)) {
      empFirstEntry.set(key, r.accessTime);
      presentSet.add(key);
      const arrivalMin = isoTimeToTRMinutes(r.accessTime);
      const dateISO = trDateKey(r.accessTime);
      const shift = shiftForInstant(dateISO, r.accessTime, shiftResolver.resolvePlan(r.employeeId as Id<"employees">, dateISO), r.direction);
      const { lateThresholdMin } = thresholdsForShift(shift, workSettings);
      if (arrivalMin > lateThresholdMin) lateSet.add(key);
    }
    const list = empDayReadings.get(key) ?? [];
    list.push(r);
    empDayReadings.set(key, list);
  }

  const managedDates = new Map<string, Set<string>>();
  let totalOvertimeMinutes = 0;
  for (const [employeeId, row] of ruleRows) {
    if (!allowedEmpIds.has(employeeId)) continue;
    const days = row.days.filter(day => day.date >= startDate && day.date <= endDate && usesPlanDayRules(shiftResolver.resolvePlan(employeeId, day.date)));
    managedDates.set(employeeId, new Set(days.map(day => day.date)));
    totalOvertimeMinutes += days.reduce((sum, day) => sum + day.overtimeMinutes, 0);
  }

  for (const [empId, allReadings] of empDayReadings) {
    const list = allReadings.filter(reading => !managedDates.get(empId)?.has(trDateKey(reading.accessTime)));
    list.sort((a, b) => Date.parse(a.accessTime) - Date.parse(b.accessTime));
    const first = list[0], last = list[list.length - 1];
    if (!first || !last || first === last) continue;
    const date = trDateKey(first.accessTime);
    const plan = shiftResolver.resolvePlan(empId as Id<"employees">, date);
    if (plan.kind === "none") continue;
    totalOvertimeMinutes += dailyOvertimeForShift({
      classification: plan.kind === "rest" ? "weekend" : "workday",
      netMinutes: Math.floor((Date.parse(last.accessTime) - Date.parse(first.accessTime)) / 60000),
      lastExitMinutes: isoTimeToTRMinutes(last.accessTime),
      shift: shiftResolver.resolve(empId as Id<"employees">, date),
      workSettings,
    });
  }

  const leaveToday = leaves.filter(
    (l) =>
      allowedEmpIds.has(String(l.employeeId)) &&
      buildPeriodDateKeys(startDate, endDate).some(date => date >= l.startDate && date <= l.endDate && scopedPdksPlan(shiftResolver.resolvePlan(l.employeeId, date), l.projectId).kind !== "none") &&
      ((startDate >= l.startDate && startDate <= l.endDate) ||
        (endDate >= l.startDate && endDate <= l.endDate) ||
        (l.startDate >= startDate && l.startDate <= endDate))
  ).length;

  const lateByDept = new Map<string, number>();
  const empById = new Map(employees.map((e) => [String(e._id), e]));
  for (const empId of lateSet) {
    const emp = empById.get(empId);
    if (emp?.departmentId) {
      const name = deptNameById.get(String(emp.departmentId)) ?? "Bilinmiyor";
      lateByDept.set(name, (lateByDept.get(name) ?? 0) + 1);
    }
  }

  const totalEmployees = employees.filter(employee => buildPeriodDateKeys(startDate, endDate).some(date => scopedPdksPlan(shiftResolver.resolvePlan(employee._id, date), employee.projectId).kind !== "none")).length;
  const presentToday = presentSet.size;
  // The production caller uses a single day; a multi-day attendance rate must count each day separately.
  const expectedEmployees = employees.filter(employee => scopedPdksPlan(shiftResolver.resolvePlan(employee._id, startDate), employee.projectId).kind === "shifts");
  const expectedPresent = expectedEmployees.filter(employee => presentSet.has(employee._id)).length;

  return {
    core: {
      totalEmployees,
      presentToday,
      lateArrivals: lateSet.size,
      overtimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
      insideBuilding: presentSet.size,
      leaveToday,
      devamOrani: expectedEmployees.length > 0 ? Math.round((expectedPresent / expectedEmployees.length) * 100) : 0,
    },
    lateByDept,
  };
}

/** Ordinary days retain weekly settlement; rule-managed days use their existing table totals.
 * Net minutes and work-date attribution always come from the shared PDKS engine. */
export function annualOvertimeDayEntries(params: {
  employeeId: Id<"employees">;
  readings: readonly Doc<"cardReadings">[];
  shiftResolver: ShiftResolver;
  workSettings: EffectiveWorkSettings;
  policyFor: (date: string) => PdksDayPolicy;
  startDate: string;
  endDate: string;
  managedDates?: ReadonlySet<string>;
}): DayEntry[] {
  const { employeeId, shiftResolver, workSettings, policyFor } = params;
  const days = groupPdksWorkDays(params.readings, employeeId, shiftResolver.resolve,
    undefined, undefined, shiftResolver.resolveLast, policyFor);
  const entries: DayEntry[] = [];
  for (const [date, readings] of days) {
    if (date < params.startDate || date > params.endDate || params.managedDates?.has(date)) continue;
    const day = computePdksPlannedDay({
      date, readings, policy: policyFor(date), workSettings,
      shift: shiftResolver.resolve(employeeId, date),
      dayPlan: shiftResolver.resolvePlan(employeeId, date),
      nextDayKind: shiftResolver.resolvePlan(employeeId, addWorkDate(date, 1)).kind === "rest" ? "rest" : "work",
    });
    if (!day.noShift) entries.push({ date, netMinutes: day.totalMinutes, classification: day.classification });
  }
  return entries;
}

export const getAnnualOvertimeBalance = authedAction({
  args: { year: v.optional(v.number()), employeeId: v.optional(v.id("employees")), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args): Promise<AnnualBalanceRow[]> => {
    const year = args.year ?? Number(trTodayKey().slice(0, 4));
    const parts: AnnualBalanceRow[][] = [];
    const ranges = annualOvertimeRanges(year);
    for (let offset = 0; offset < ranges.length; offset += 4) {
      const rows: AnnualBalanceRow[][] = await Promise.all(ranges.slice(offset, offset + 4).map(range =>
        ctx.runQuery(internal.dashboard.annualOvertimePart, { ...args, year, ...range })));
      parts.push(...rows);
    }
    return mergeAnnualBalances(parts);
  },
});

const annualPartArgs = {
  year: v.number(), employeeId: v.optional(v.id("employees")), projectId: v.optional(v.id("projects")), startDate: v.string(), endDate: v.string(),
  employeeIds: v.optional(v.array(v.id("employees"))), roster: v.optional(v.array(v.object({ employeeId: v.id("employees"), cardNumber: v.string() }))),
  readings: v.optional(v.array(pdksReadingValidator)), readingStartISO: v.optional(v.string()), readingEndISO: v.optional(v.string()),
};
const _annualPartValidator = v.object(annualPartArgs);
async function annualOvertimePartHandler(queryCtx: QueryCtx & { user?: Doc<"users"> }, args: typeof _annualPartValidator.type): Promise<AnnualBalanceRow[]> {
  const ctx = withPdksReadBudget({ ...queryCtx, user: queryCtx.user ?? await getCurrentUser(queryCtx) });
  let batch: (PdksBatchScope & { readingStartISO: string; readingEndISO: string }) | undefined;
  if (args.employeeIds) {
    if (!args.projectId || !args.readingStartISO || !args.readingEndISO) throw new Error("Proje ve okuma aralığı gerekli");
    await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);
    const employees: Doc<"employees">[] = [];
    for (const id of args.employeeIds) {
      const employee = await ctx.db.get(id);
      if (!employee || employee.projectId !== args.projectId) throw new Error("Çalışan seçili projeye ait değil");
      employees.push(employee);
    }
    if (args.readings?.some(reading => reading.projectId !== args.projectId)) throw new Error("Okuma seçili projeye ait değil");
    batch = { employees, allEmployeeIds: (args.roster ?? []).map(employee => employee.employeeId), cardOwners: args.roster ?? [],
      preloadedReadings: args.readings, readingStartISO: args.readingStartISO, readingEndISO: args.readingEndISO };
  }
    // One context day at each boundary preserves overnight attribution; never cross the year edge.
    const start = addWorkDate(args.startDate, -1) < `${args.year}-01-01` ? `${args.year}-01-01` : addWorkDate(args.startDate, -1);
    const end = addWorkDate(args.endDate, 1) > `${args.year}-12-31` ? `${args.year}-12-31` : addWorkDate(args.endDate, 1);
    const { startISO, endISO } = trDayRangeISO(start, end);
    const { employees, activityReadings, shiftResolver, ruleRows, policies, workSettings, workSettingsProjectId } =
      await loadPdksDataset(ctx, startISO, endISO, { projectId: args.projectId }, batch);

    const dates = buildPeriodDateKeys(args.startDate, args.endDate);
    const targetEmployees = employees.filter(e => (!args.employeeId || e._id === args.employeeId) && dates.some(date => shiftResolver.resolvePlan(e._id, date).kind !== "none"));
    // Load once per project, rather than once per employee or person-day.
    const settingsByProject = new Map(await Promise.all([...new Set(targetEmployees.map(e => e.projectId))].map(async projectId =>
      [projectId, projectId === workSettingsProjectId ? workSettings : projectId ? await getEffectiveWorkSettings(ctx, projectId) : DEFAULT_WORK_SETTINGS] as const,
    )));
    const employeesByCard = new Map(targetEmployees.flatMap(employee => {
      const key = cardKey(employee.cardNumber);
      return key ? [[`${employee.projectId}__${employee.cardNumber}`, employee._id] as const] : [];
    }));
    const readingsByEmployee = new Map<Id<"employees">, Doc<"cardReadings">[]>();
    for (const reading of activityReadings) {
      const employeeId = reading.employeeId ?? employeesByCard.get(`${reading.projectId}__${reading.cardNo}`);
      if (!employeeId) continue;
      const list = readingsByEmployee.get(employeeId) ?? [];
      list.push(reading);
      readingsByEmployee.set(employeeId, list);
    }

    const out = targetEmployees.map((emp) => {
      const dayEntries = annualOvertimeDayEntries({
        employeeId: emp._id,
        readings: readingsByEmployee.get(emp._id) ?? [],
        shiftResolver,
        workSettings: settingsByProject.get(emp.projectId) ?? DEFAULT_WORK_SETTINGS,
        policyFor: date => policies(emp.projectId, date),
        startDate: dates[0], endDate: dates[dates.length - 1],
        managedDates: new Set(ruleRows.get(emp._id)?.days.map(day => day.date)),
      });
      const buckets = bucketWeeklyOvertime(dayEntries);
      const totalMin = buckets.reduce((s, b) => s + b.overtimeMinutes + b.premiumMinutes, 0) + (ruleRows.get(emp._id)?.days.filter(day => day.date >= args.startDate && day.date <= args.endDate).reduce((sum, day) => sum + day.overtimeMinutes, 0) ?? 0);
      const limitMin = ANNUAL_OVERTIME_LIMIT_MINUTES;
      return {
        employeeId: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        totalOvertimeMinutes: totalMin,
        totalOvertimeHours: Math.round((totalMin / 60) * 10) / 10,
        limitHours: limitMin / 60,
        remainingHours: Math.max(0, (limitMin - totalMin) / 60),
        utilizationPct:
          limitMin > 0 ? Math.min(100, Math.round((totalMin / limitMin) * 100)) : 0,
        exceedsDaily11h: buckets.flatMap((b) => b.exceedsDaily11h),
      };
    });

    return out.sort((a, b) => b.utilizationPct - a.utilizationPct);
}
export const annualOvertimePart = internalQuery({ args: annualPartArgs, handler: annualOvertimePartHandler });
export const getAnnualOvertimePart = authedQuery({ args: annualPartArgs, handler: annualOvertimePartHandler });
export const getAnnualOvertimeRoster = authedQuery({
  args: { projectId: v.id("projects"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);
    const page = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", args.projectId)).paginate({ cursor: args.cursor, numItems: 100, maximumBytesRead: 1024 * 1024 });
    return { ...page, page: page.page.filter(employee => employee.isActive).map(employee => ({ employeeId: employee._id, cardNumber: employee.cardNumber })) };
  },
});

/**
 * "Sürekli geç kalanlar" — son `daysBack` gün içinde `minCount`+ kez geç gelmiş employee'ler.
 * Vardiya bilinçli (shiftResolver + thresholdsForShift).
 */
export const getRepeatLateOffenders = authedQuery({
  args: {
    daysBack: v.optional(v.number()),
    minCount: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 30;
    const minCount = args.minCount ?? 3;
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - daysBack);
    const { startISO, endISO } = trDayRangeISO(trDateKey(start.toISOString()), trDateKey(end.toISOString()));

    const { employees, readings, shiftResolver, workSettings, ruleRows } =
      await loadPdksDataset(ctx, startISO, endISO, { projectId: args.projectId });

    const empById = new Map(employees.map((e) => [String(e._id), e]));
    const firstEntryByEmpDay = new Map<string, string>();
    for (const r of readings) {
      if (r.accessStatus !== "izin_verildi" || !r.employeeId) continue;
      const key = `${String(r.employeeId)}__${trDateKey(r.accessTime)}`;
      if (!firstEntryByEmpDay.has(key)) firstEntryByEmpDay.set(key, r.accessTime);
    }

    const lateCountByEmp = new Map<string, number>();
    for (const [key, accessTime] of firstEntryByEmpDay) {
      const [empKey, dateKey] = key.split("__");
      const emp = empById.get(empKey);
      if (!emp) continue;
      if (ruleRows.get(emp._id)?.days.some(day => day.date === dateKey)) continue;
      const shift = shiftForInstant(dateKey, accessTime, shiftResolver.resolvePlan(emp._id, dateKey), "entry");
      const { lateThresholdMin } = thresholdsForShift(shift, workSettings);
      const arrivalMin = isoTimeToTRMinutes(accessTime);
      if (arrivalMin > lateThresholdMin) {
        lateCountByEmp.set(empKey, (lateCountByEmp.get(empKey) ?? 0) + 1);
      }
    }

    for (const [employeeId, row] of ruleRows) {
      if (!empById.has(employeeId)) continue;
      const count = row.days.filter(day => day.status === "late").length;
      if (count) lateCountByEmp.set(employeeId, (lateCountByEmp.get(employeeId) ?? 0) + count);
    }
    return [...lateCountByEmp.entries()]
      .filter(([, count]) => count >= minCount)
      .map(([empKey, count]) => {
        const emp = empById.get(empKey)!;
        return {
          employeeId: emp._id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          lateCount: count,
        };
      })
      .sort((a, b) => b.lateCount - a.lateCount);
  },
});

/**
 * "Mola ihlali" — verilen günde 7.5h+ çalışıp shift'in mola penceresi
 * dışında kalmış employee'ler. Şu an basit yaklaşım: günlük toplam çalışma
 * 450+ dakika olup molaya çıkmamış (cardReadings'te break aralığında giriş/çıkış yok).
 */
export const getBreakViolations = authedQuery({
  args: { date: v.optional(v.string()), projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const today = args.date ?? trTodayKey();
    const { startISO, endISO } = trDayRangeISO(today, today);

    const { employees, readings, shiftResolver } =
      await loadPdksDataset(ctx, startISO, endISO, { projectId: args.projectId });

    const empById = new Map(employees.map((e) => [String(e._id), e]));
    const empReadings = new Map<string, Doc<"cardReadings">[]>();
    for (const r of readings) {
      if (r.accessStatus !== "izin_verildi" || !r.employeeId) continue;
      const key = String(r.employeeId);
      if (!empReadings.has(key)) empReadings.set(key, []);
      empReadings.get(key)!.push(r);
    }

    const violations: Array<{
      employeeId: Id<"employees">;
      firstName: string;
      lastName: string;
      totalMinutes: number;
    }> = [];

    for (const [empKey, list] of empReadings) {
      const emp = empById.get(empKey);
      if (!emp) continue;
      list.sort((a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime());
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || first === last) continue;
      const totalMin = Math.floor(
        (new Date(last.accessTime).getTime() - new Date(first.accessTime).getTime()) / 60000,
      );
      if (totalMin < 450) continue;

      const plan = shiftResolver.resolvePlan(emp._id, today);
      const shifts = plan.kind !== "none" ? plan.shifts : [];
      const buckets = splitReadingsByShift(today, list, shifts);
      const missingBreak = shifts.some((shift, index) => {
        if (!shift.breakStart || !shift.breakEnd) return false;
        const [bsh, bsm] = shift.breakStart.split(":").map(Number);
        const [beh, bem] = shift.breakEnd.split(":").map(Number);
        return !(buckets[index] ?? []).some(reading => {
          const minute = isoTimeToTRMinutes(reading.accessTime);
          return minute >= bsh * 60 + bsm && minute <= beh * 60 + bem;
        });
      });
      if (missingBreak) violations.push({ employeeId: emp._id, firstName: emp.firstName, lastName: emp.lastName, totalMinutes: totalMin });
    }
    return violations.sort((a, b) => b.totalMinutes - a.totalMinutes);
  },
});

export const getRecentReadings = authedQuery({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveReadingScope(ctx, args.projectId, MONITORING_READING_PERMISSIONS);
    const limit = args.limit ?? 10;

    let readings;
    if (ctx.user.role === "super_admin" && !args.projectId) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .order("desc")
        .take(limit);
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project_access_time", (q) => q.eq("projectId", pid))
            .order("desc")
            .take(limit)
        )
      );
      readings = results
        .flat()
        .sort((a, b) => new Date(b.accessTime).getTime() - new Date(a.accessTime).getTime())
        .slice(0, limit);
    } else {
      return [];
    }

    return await Promise.all(
      readings.map(async (r) => {
        const device = r.deviceId ? await ctx.db.get(r.deviceId) as Doc<"devices"> | null : null;
        return {
          ...r,
          devices: device
            ? { name: device.name, deviceSerial: device.deviceSerial }
            : null,
        };
      })
    );
  },
});

export const getActivitySummary = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const today = trTodayKey();
    const { startISO, endISO } = trDayRangeISO(today, today);
    const dataset = await loadPdksDataset(ctx, startISO, endISO, args);
    const employeeIds = new Set(dataset.employees.map((employee) => employee._id));
    const readings = dataset.activityReadings.filter((reading) =>
      reading.employeeId && employeeIds.has(reading.employeeId) && reading.accessStatus === "izin_verildi"
    ).sort((a, b) => a.accessTime.localeCompare(b.accessTime));
    const daily = summarizeDailyReadings(readings.filter(r => r.direction === "entry" || r.direction === "exit" || (!r.employeeId || !dataset.ruleRows.has(r.employeeId))));
    const { core } = computePdksCoreInMemory(
      dataset.employees, readings.filter((reading) => reading.direction !== "exit"), dataset.leaves,
      { start: startISO, end: endISO }, dataset.deptNameById, dataset.shiftResolver, dataset.workSettings, dataset.ruleRows,
    );
    const ruleCells = [...dataset.ruleRows].filter(([id]) => employeeIds.has(id)).flatMap(([id, row]) => row.days.map(day => ({ id, day })));
    const governedIds = new Set(ruleCells.map(cell => cell.id));
    const legacyPresent = new Set(readings.filter(r => r.employeeId && dataset.shiftResolver.resolvePlan(r.employeeId, today).kind !== "none" && !governedIds.has(r.employeeId)).map(r => r.employeeId));
    const presentRules = new Set(readings.filter(r => r.employeeId && dataset.shiftResolver.resolvePlan(r.employeeId, today).kind !== "none" && governedIds.has(r.employeeId) && r.direction === "entry" && !usesPlanDayRules(dataset.shiftResolver.resolvePlan(r.employeeId, today)) && !hasFixedShiftRules(dataset.shiftResolver.resolve(r.employeeId, today))).map(r => r.employeeId));
    if (governedIds.size) {
      for (const { id, day } of ruleCells) {
        if ((day.status === "present" || day.status === "late") && (usesPlanDayRules(dataset.shiftResolver.resolvePlan(id, day.date)) || usesShiftDayRules(dataset.shiftResolver.resolve(id, day.date)))) presentRules.add(id);
      }
      core.presentToday = legacyPresent.size + presentRules.size;
      const firstEntries = new Map<Id<"employees">, Doc<"cardReadings">>();
      for (const reading of readings) {
        if (!reading.employeeId || dataset.shiftResolver.resolvePlan(reading.employeeId, today).kind === "none" || reading.direction === "exit" || (governedIds.has(reading.employeeId) && reading.direction !== "entry") || firstEntries.has(reading.employeeId)) continue;
        firstEntries.set(reading.employeeId, reading);
      }
      const lateIds = new Set([...firstEntries].filter(([id, reading]) => !usesPlanDayRules(dataset.shiftResolver.resolvePlan(id, today)) && isoTimeToTRMinutes(reading.accessTime) > thresholdsForShift(shiftForInstant(today, reading.accessTime, dataset.shiftResolver.resolvePlan(id, today), "entry"), dataset.workSettings).lateThresholdMin).map(([id]) => id));
      for (const { id, day } of ruleCells) {
        if (usesPlanDayRules(dataset.shiftResolver.resolvePlan(id, day.date)) && day.isLate) lateIds.add(id);
      }
      core.lateArrivals = lateIds.size;
    }
    const settingsProjectId = args.projectId ?? dataset.employees[0]?.projectId;
    const settings = settingsProjectId
      ? await ctx.db.query("workSettings").withIndex("by_project", (q) => q.eq("projectId", settingsProjectId)).first()
      : null;
    const hasReadings = readings.length > 0;
    return {
      workHours: hasReadings && settings
        ? `${dataset.workSettings.workStartTime} – ${dataset.workSettings.workEndTime}` : null,
      averageFirstEntry: daily.averageFirstEntry,
      averageLastExit: daily.averageLastExit,
      lateArrivals: hasReadings ? core.lateArrivals : null,
      presentToday: hasReadings || ruleCells.length ? core.presentToday : null,
      incompleteDays: ruleCells.filter(c => c.day.status === "incomplete").length,
      insideBuilding: hasReadings ? daily.insideBuilding : null,
    };
  },
});

/** Cache hits still re-authorize, and remain bound to the signed-in account. */
export const getAnnualOvertimeAccess = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveReadingScope(ctx, args.projectId, REPORT_READING_PERMISSIONS);
    return ctx.user._id;
  },
});
