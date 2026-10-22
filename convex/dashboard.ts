import { loadRuleReportDays } from "./lib/reportAttendance";
import { resolveAttendanceEvidence } from "./lib/pdksEvidence";
import { buildPdksWorkDateResolver, groupPdksWorkDays } from "./lib/pdksWorkDay";
import type { PdksTableRow } from "./lib/pdksTable";
import { filterPdksReadings } from "./lib/pdksSource";
import { summarizeDailyReadings } from "./lib/dashboardActivity";
import { countDashboardRows } from "./lib/dashboardCounts";
import { createHourlyCounter } from "./lib/dashboardTimeline";
import { trDateKey, trTodayKey, trDayRangeISO } from "./lib/trDate";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import {
  buildShiftResolver,
  thresholdsForShift,
  type ShiftResolver,
} from "./lib/shiftResolver";
import {
  getEffectiveWorkSettings,
  DEFAULT_WORK_SETTINGS,
  type EffectiveWorkSettings,
  dailyOvertimeForShift,
  isoTimeToTRMinutes,
  classifyDay,
} from "./lib/pdksHelpers";
import { netWorkMinutes } from "./lib/breakDeduction";
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
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
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
  }
): Promise<{
  employees: Doc<"employees">[];
  readings: Doc<"cardReadings">[];
  activityReadings: Doc<"cardReadings">[];
  leaves: Doc<"leaves">[];
  deptNameById: Map<string, string>;
  shiftResolver: ShiftResolver;
  workSettings: EffectiveWorkSettings;
  ruleRows: Map<Id<"employees">, PdksTableRow>;
}> {
  const allowedProjectIds = await resolveProjectScope(ctx, filters.projectId);
  let employees: Doc<"employees">[] = [];
  let readings: Doc<"cardReadings">[] = [];

  if (ctx.user.role === "super_admin" && !filters.projectId) {
    [employees, readings] = await Promise.all([
      ctx.db
        .query("employees")
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
      ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(
            q.gte(q.field("accessTime"), rangeStartISO),
            q.lte(q.field("accessTime"), rangeEndISO)
          )
        )
        .collect(),
    ]);
  } else if (allowedProjectIds.length > 0) {
    const [empResults, readingResults] = await Promise.all([
      Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("employees")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect()
        )
      ),
      Promise.all(
        allowedProjectIds.map((pid) =>
          filters.projectId
            ? ctx.db.query("cardReadings")
                .withIndex("by_project_access_time", (q) =>
                  q.eq("projectId", pid).gte("accessTime", rangeStartISO).lte("accessTime", rangeEndISO))
                .collect()
            : ctx.db.query("cardReadings")
                .withIndex("by_project", (q) => q.eq("projectId", pid))
                .filter((q) => q.and(q.gte(q.field("accessTime"), rangeStartISO), q.lte(q.field("accessTime"), rangeEndISO)))
                .collect()
        )
      ),
    ]);
    employees = empResults.flat();
    readings = readingResults.flat();
  }

  const ruleReport = await loadRuleReportDays(ctx, allowedProjectIds, trDateKey(rangeStartISO), trDateKey(rangeEndISO), {
    includeLegacyReadings: false,
    preloadedReadings: { readings, startISO: rangeStartISO, endISO: rangeEndISO },
  });

  if (filters.companyId) employees = employees.filter((e) => e.companyId === filters.companyId);
  if (filters.departmentId) employees = employees.filter((e) => e.departmentId === filters.departmentId);
  if (filters.positionId) employees = employees.filter((e) => e.positionId === filters.positionId);
  if (filters.shiftId) employees = employees.filter((e) => e.shiftId === filters.shiftId);

  const [leaves, deptDocs, shiftResolver] = await Promise.all([
    ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect(),
    ctx.db.query("departments").collect(),
    buildShiftResolver(ctx, employees),
  ]);
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

  const workDate = buildPdksWorkDateResolver(employees, shiftResolver.resolve);
  const filtered = filterPdksReadings(readings, filters.projectId, r => ruleReport.policies(r.projectId, workDate(r)));
  const legacy = filtered.filter(r => ruleReport.policies(r.projectId, workDate(r)).punchMode !== "requirements");
  const versioned: Doc<"cardReadings">[] = [];
  for (const employee of employees) {
    for (const [date, list] of groupPdksWorkDays(ruleReport.readings.filter(r => r.employeeId === employee._id || (!r.employeeId && r.cardNo === employee.cardNumber)), employee._id, shiftResolver.resolve)) {
      const policy = ruleReport.policies(employee.projectId, date);
      if (policy.punchMode !== "requirements") continue;
      const cell = ruleReport.ruleRows.get(employee._id)?.days.find(day => day.date === date);
      if (cell?.status !== "present" && cell?.status !== "late") continue;
      const evidence = resolveAttendanceEvidence(list, undefined, policy);
      const selected = list.filter(r => r.accessTime === evidence.firstISO || r.accessTime === evidence.lastISO);
      versioned.push(...(evidence.durationMeasured ? selected : selected.slice(0, 1)));
    }
  }
  return { employees, readings: [...legacy, ...versioned], activityReadings: filtered, leaves, deptNameById, shiftResolver, workSettings, ruleRows: ruleReport.ruleRows };
}

function computePdksCoreInMemory(
  employees: Doc<"employees">[],
  readings: Doc<"cardReadings">[],
  leaves: Doc<"leaves">[],
  range: { start: string; end: string },
  deptNameById: Map<string, string>,
  shiftResolver: ShiftResolver,
  workSettings: EffectiveWorkSettings,
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
      allowedEmpIds.has(String(r.employeeId))
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
      const shift = shiftResolver.resolve(r.employeeId as Id<"employees">, dateISO);
      const { lateThresholdMin } = thresholdsForShift(shift, workSettings);
      if (arrivalMin > lateThresholdMin) lateSet.add(key);
    }
    if (!empDayReadings.has(key)) empDayReadings.set(key, []);
    empDayReadings.get(key)!.push(r);
  }

  const defaultWorkingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  let totalOvertimeMinutes = 0;
  for (const [empId, list] of empDayReadings.entries()) {
    list.sort((a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime());
    const first = list[0];
    const last = list[list.length - 1];
    if (first === last) continue;
    const diff = new Date(last.accessTime).getTime() - new Date(first.accessTime).getTime();
    const netMin = Math.floor(diff / 60000);
    const dateISO = trDateKey(first.accessTime);
    const cls = classifyDay(dateISO, defaultWorkingDays);
    const shift = shiftResolver.resolve(empId as Id<"employees">, dateISO);
    totalOvertimeMinutes += dailyOvertimeForShift({
      classification: cls,
      netMinutes: netMin,
      lastExitMinutes: isoTimeToTRMinutes(last.accessTime),
      shift,
      workSettings,
    });
  }

  const leaveToday = leaves.filter(
    (l) =>
      allowedEmpIds.has(String(l.employeeId)) &&
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

  const totalEmployees = employees.length;
  const presentToday = presentSet.size;

  return {
    core: {
      totalEmployees,
      presentToday,
      lateArrivals: lateSet.size,
      overtimeHours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
      insideBuilding: presentSet.size,
      leaveToday,
      devamOrani: totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0,
    },
    lateByDept,
  };
}

export const getAnnualOvertimeBalance = authedQuery({
  args: {
    year: v.optional(v.number()),
    employeeId: v.optional(v.id("employees")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const targetYear = args.year ?? Number(trTodayKey().slice(0, 4));
    const { startISO, endISO } = trDayRangeISO(`${targetYear}-01-01`, `${targetYear}-12-31`);

    const { employees, readings, shiftResolver, ruleRows } =
      await loadPdksDataset(ctx, startISO, endISO, { projectId: args.projectId });

    const targetEmployees = args.employeeId
      ? employees.filter((e) => e._id === args.employeeId)
      : employees;

    const readingsByEmpDay = new Map<string, Map<string, Doc<"cardReadings">[]>>();
    for (const r of readings) {
      if (r.accessStatus !== "izin_verildi" || !r.employeeId) continue;
      const empKey = String(r.employeeId);
      const dateKey = trDateKey(r.accessTime);
      if (!readingsByEmpDay.has(empKey)) readingsByEmpDay.set(empKey, new Map());
      const dayMap = readingsByEmpDay.get(empKey)!;
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
      dayMap.get(dateKey)!.push(r);
    }

    const out = targetEmployees.map((emp) => {
      const dayMap =
        readingsByEmpDay.get(String(emp._id)) ?? new Map<string, Doc<"cardReadings">[]>();
      const dayEntries: DayEntry[] = [];
      for (const [date, list] of dayMap) {
        list.sort((a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime());
        const first = list[0];
        const last = list[list.length - 1];
        if (!first || first === last) continue;
        const rawMin = Math.floor(
          (new Date(last.accessTime).getTime() - new Date(first.accessTime).getTime()) / 60000,
        );
        const shift = shiftResolver.resolve(emp._id, date);
        const net = netWorkMinutes(rawMin, shift);
        const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
        const classification: DayEntry["classification"] = dow === 0 || dow === 6 ? "weekend" : "workday";
        if (!ruleRows.get(emp._id)?.days.some(day => day.date === date)) dayEntries.push({ date, netMinutes: net, classification });
      }
      const buckets = bucketWeeklyOvertime(dayEntries);
      const totalMin = buckets.reduce((s, b) => s + b.overtimeMinutes + b.premiumMinutes, 0) + (ruleRows.get(emp._id)?.days.reduce((sum, day) => sum + day.overtimeMinutes, 0) ?? 0);
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
      const shift = shiftResolver.resolve(emp._id, dateKey);
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

      const shift = shiftResolver.resolve(emp._id, today);
      if (!shift?.breakStart || !shift?.breakEnd) continue;
      const [bsh, bsm] = shift.breakStart.split(":").map(Number);
      const [beh, bem] = shift.breakEnd.split(":").map(Number);
      const bsMin = bsh * 60 + bsm;
      const beMin = beh * 60 + bem;

      const hadBreakReading = list.some((r) => {
        const m = isoTimeToTRMinutes(r.accessTime);
        return m >= bsMin && m <= beMin;
      });
      if (!hadBreakReading) {
        violations.push({
          employeeId: emp._id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          totalMinutes: totalMin,
        });
      }
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
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
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
      { start: startISO, end: endISO }, dataset.deptNameById, dataset.shiftResolver, dataset.workSettings,
    );
    const ruleCells = [...dataset.ruleRows].filter(([id]) => employeeIds.has(id)).flatMap(([id, row]) => row.days.map(day => ({ id, day })));
    const governedIds = new Set(ruleCells.map(cell => cell.id));
    const legacyPresent = new Set(readings.filter(r => r.employeeId && !governedIds.has(r.employeeId)).map(r => r.employeeId));
    const presentRules = new Set(readings.filter(r => r.employeeId && governedIds.has(r.employeeId) && r.direction === "entry").map(r => r.employeeId));
    if (governedIds.size) {
      core.presentToday = legacyPresent.size + presentRules.size;
      const firstEntries = new Map<Id<"employees">, Doc<"cardReadings">>();
      for (const reading of readings) {
        if (!reading.employeeId || reading.direction === "exit" || (governedIds.has(reading.employeeId) && reading.direction !== "entry") || firstEntries.has(reading.employeeId)) continue;
        firstEntries.set(reading.employeeId, reading);
      }
      core.lateArrivals = new Set([...firstEntries].filter(([id, reading]) => isoTimeToTRMinutes(reading.accessTime) > thresholdsForShift(dataset.shiftResolver.resolve(id, today), dataset.workSettings).lateThresholdMin).map(([id]) => id)).size;
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
