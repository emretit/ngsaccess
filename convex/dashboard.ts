import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
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
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const tomorrowISO = new Date(today.getTime() + 86400000).toISOString();

    let employees: unknown[] = [];
    let devices: unknown[] = [];
    let todayReadings: unknown[] = [];
    let pendingRules: unknown[] = [];

    if (ctx.user.role === "super_admin") {
      [employees, devices, todayReadings, pendingRules] = await Promise.all([
        ctx.db.query("employees").collect(),
        ctx.db.query("devices").filter((q) => q.eq(q.field("isActive"), true)).collect(),
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time")
          .filter((q) =>
            q.and(
              q.gte(q.field("accessTime"), todayISO),
              q.lt(q.field("accessTime"), tomorrowISO)
            )
          )
          .collect(),
        ctx.db.query("accessRules").filter((q) => q.eq(q.field("isActive"), false)).collect(),
      ]);
    } else if (allowedProjectIds.length > 0) {
      const [empResults, devResults, readingResults, ruleResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("devices")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("cardReadings")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) =>
                q.and(
                  q.gte(q.field("accessTime"), todayISO),
                  q.lt(q.field("accessTime"), tomorrowISO)
                )
              )
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("accessRules")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), false))
              .collect()
          )
        ),
      ]);
      employees = empResults.flat();
      devices = devResults.flat();
      todayReadings = readingResults.flat();
      pendingRules = ruleResults.flat();
    }

    return {
      employees: employees.length,
      devices: devices.length,
      cardReadings: todayReadings.length,
      pendingRequests: pendingRules.length,
    };
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
  }
): Promise<{
  employees: Doc<"employees">[];
  readings: Doc<"cardReadings">[];
  leaves: Doc<"leaves">[];
  deptNameById: Map<string, string>;
  shiftResolver: ShiftResolver;
  workSettings: EffectiveWorkSettings;
}> {
  const allowedProjectIds = await getProjectIdsForUser(ctx);
  let employees: Doc<"employees">[] = [];
  let readings: Doc<"cardReadings">[] = [];

  if (ctx.user.role === "super_admin") {
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
          ctx.db
            .query("cardReadings")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .filter((q) =>
              q.and(
                q.gte(q.field("accessTime"), rangeStartISO),
                q.lte(q.field("accessTime"), rangeEndISO)
              )
            )
            .collect()
        )
      ),
    ]);
    employees = empResults.flat();
    readings = readingResults.flat();
  }

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
    ctx.user.role === "super_admin"
      ? employees[0]?.projectId
      : allowedProjectIds[0];
  const workSettings = settingsProjectId
    ? await getEffectiveWorkSettings(ctx, settingsProjectId)
    : DEFAULT_WORK_SETTINGS;

  return { employees, readings, leaves, deptNameById, shiftResolver, workSettings };
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
  const startDate = range.start.split("T")[0];
  const endDate = range.end.split("T")[0];

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
      const dateISO = r.accessTime.split("T")[0];
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
    const dateISO = first.accessTime.split("T")[0];
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

export const getPdksStats = authedQuery({
  args: {
    companyId: v.optional(v.id("companies")),
    departmentId: v.optional(v.id("departments")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    compareWithPrevious: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const baseDate = new Date(`${today}T00:00:00.000Z`);

    const filters = {
      companyId: args.companyId,
      departmentId: args.departmentId,
      positionId: args.positionId,
      shiftId: args.shiftId,
    };

    const earliestDate = new Date(baseDate);
    if (args.compareWithPrevious) {
      earliestDate.setUTCDate(earliestDate.getUTCDate() - 7);
    }
    const datasetStart = `${earliestDate.toISOString().split("T")[0]}T00:00:00.000`;
    const datasetEnd = `${today}T23:59:59.999`;

    const { employees, readings, leaves, deptNameById, shiftResolver, workSettings } =
      await loadPdksDataset(ctx, datasetStart, datasetEnd, filters);

    const todayRange = { start: `${today}T00:00:00.000`, end: `${today}T23:59:59.999` };
    const current = computePdksCoreInMemory(
      employees,
      readings,
      leaves,
      todayRange,
      deptNameById,
      shiftResolver,
      workSettings,
    );
    const topLateDept = [...current.lateByDept.entries()].sort(([, a], [, b]) => b - a)[0];

    let previous: PdksStatsCore | undefined;
    let previousSeries:
      | {
          presentToday: number[];
          lateArrivals: number[];
          overtimeHours: number[];
          leaveToday: number[];
        }
      | undefined;
    if (args.compareWithPrevious) {
      const dayOffsets = [7, 6, 5, 4, 3, 2, 1];
      const dailyCores = dayOffsets.map((offset) => {
        const day = new Date(baseDate);
        day.setUTCDate(day.getUTCDate() - offset);
        const dStr = day.toISOString().split("T")[0];
        return computePdksCoreInMemory(
          employees,
          readings,
          leaves,
          { start: `${dStr}T00:00:00.000`, end: `${dStr}T23:59:59.999` },
          deptNameById,
          shiftResolver,
          workSettings,
        ).core;
      });
      previous = dailyCores[dailyCores.length - 1];
      previousSeries = {
        presentToday: dailyCores.map((d) => d.presentToday),
        lateArrivals: dailyCores.map((d) => d.lateArrivals),
        overtimeHours: dailyCores.map((d) => d.overtimeHours),
        leaveToday: dailyCores.map((d) => d.leaveToday),
      };
    }

    return {
      ...current.core,
      topLateDepartment: topLateDept?.[0] ?? "-",
      topLateDepartmentCount: topLateDept?.[1] ?? 0,
      previous,
      previousSeries,
    };
  },
});

export const getAnnualOvertimeBalance = authedQuery({
  args: {
    year: v.optional(v.number()),
    employeeId: v.optional(v.id("employees")),
  },
  handler: async (ctx, args) => {
    const targetYear = args.year ?? new Date().getFullYear();
    const startISO = `${targetYear}-01-01T00:00:00.000`;
    const endISO = `${targetYear}-12-31T23:59:59.999`;

    const { employees, readings, shiftResolver } =
      await loadPdksDataset(ctx, startISO, endISO, {});

    const targetEmployees = args.employeeId
      ? employees.filter((e) => e._id === args.employeeId)
      : employees;

    const readingsByEmpDay = new Map<string, Map<string, Doc<"cardReadings">[]>>();
    for (const r of readings) {
      if (r.accessStatus !== "izin_verildi" || !r.employeeId) continue;
      const empKey = String(r.employeeId);
      const dateKey = r.accessTime.split("T")[0];
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
        dayEntries.push({ date, netMinutes: net, classification });
      }
      const buckets = bucketWeeklyOvertime(dayEntries);
      const totalMin = buckets.reduce((s, b) => s + b.overtimeMinutes + b.premiumMinutes, 0);
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
  },
  handler: async (ctx, args) => {
    const daysBack = args.daysBack ?? 30;
    const minCount = args.minCount ?? 3;
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - daysBack);
    const startISO = `${start.toISOString().split("T")[0]}T00:00:00.000`;
    const endISO = `${end.toISOString().split("T")[0]}T23:59:59.999`;

    const { employees, readings, shiftResolver, workSettings } =
      await loadPdksDataset(ctx, startISO, endISO, {});

    const empById = new Map(employees.map((e) => [String(e._id), e]));
    const firstEntryByEmpDay = new Map<string, string>();
    for (const r of readings) {
      if (r.accessStatus !== "izin_verildi" || !r.employeeId) continue;
      const key = `${String(r.employeeId)}__${r.accessTime.split("T")[0]}`;
      if (!firstEntryByEmpDay.has(key)) firstEntryByEmpDay.set(key, r.accessTime);
    }

    const lateCountByEmp = new Map<string, number>();
    for (const [key, accessTime] of firstEntryByEmpDay) {
      const [empKey, dateKey] = key.split("__");
      const emp = empById.get(empKey);
      if (!emp) continue;
      const shift = shiftResolver.resolve(emp._id, dateKey);
      const { lateThresholdMin } = thresholdsForShift(shift, workSettings);
      const arrivalMin = isoTimeToTRMinutes(accessTime);
      if (arrivalMin > lateThresholdMin) {
        lateCountByEmp.set(empKey, (lateCountByEmp.get(empKey) ?? 0) + 1);
      }
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
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const today = args.date ?? new Date().toISOString().split("T")[0];
    const startISO = `${today}T00:00:00.000`;
    const endISO = `${today}T23:59:59.999`;

    const { employees, readings, shiftResolver } =
      await loadPdksDataset(ctx, startISO, endISO, {});

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

export const getPdksDashboardWidgets = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    let pendingLeaves: { _id: string; employeeId: string; leaveType: string; startDate: string; endDate: string }[] = [];
    let upcomingShifts: { _id: string; employeeId: string; shiftId: string; startDate: string; endDate: string }[] = [];

    if (ctx.user.role === "super_admin") {
      pendingLeaves = await ctx.db
        .query("leaves")
        .filter((q) => q.eq(q.field("status"), "pending"))
        .collect();
      upcomingShifts = await ctx.db
        .query("shiftAssignments")
        .collect()
        .then((assignments) =>
          assignments
            .filter((a) => a.endDate >= new Date().toISOString().split("T")[0])
            .slice(0, 5)
        );
    } else if (allowedProjectIds.length > 0) {
      const [leaveResults, shiftResults] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("leaves")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("status"), "pending"))
              .collect()
          )
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("shiftAssignments")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .collect()
          )
        ),
      ]);
      pendingLeaves = leaveResults.flat();
      const allShifts = shiftResults.flat();
      const today = new Date().toISOString().split("T")[0];
      upcomingShifts = allShifts
        .filter((a) => a.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5);
    }

    return {
      pendingLeavesCount: pendingLeaves.length,
      pendingLeaves: pendingLeaves.slice(0, 3),
      upcomingShiftsCount: upcomingShifts.length,
      upcomingShifts,
    };
  },
});

/**
 * Şu an binada olan çalışanlar (bugün giriş yapmış, çıkış yapmamış)
 */
export const getCurrentlyInside = authedQuery({
  args: {},
  handler: async (ctx) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const today = new Date().toISOString().split("T")[0];
    const startISO = `${today}T00:00:00.000`;
    const endISO = `${today}T23:59:59.999`;

    let readings;
    if (ctx.user.role === "super_admin") {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(
            q.gte(q.field("accessTime"), startISO),
            q.lte(q.field("accessTime"), endISO)
          )
        )
        .collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .filter((q) =>
              q.and(
                q.gte(q.field("accessTime"), startISO),
                q.lte(q.field("accessTime"), endISO)
              )
            )
            .collect()
        )
      );
      readings = results.flat();
    } else {
      return [];
    }

    const granted = readings.filter((r) => r.accessStatus === "izin_verildi");
    const byEmployee = new Map<string, typeof granted>();
    for (const r of granted) {
      const key = r.employeeId ?? r.cardNo;
      if (!byEmployee.has(key)) byEmployee.set(key, []);
      byEmployee.get(key)!.push(r);
    }

    const inside: { employeeId: string; name: string; department: string; zone?: string; lastSeen: string }[] = [];

    for (const [empKey, empReadings] of byEmployee) {
      empReadings.sort(
        (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
      );
      if (empReadings.length % 2 === 1) {
        const last = empReadings[empReadings.length - 1];
        const employee = last.employeeId
          ? await ctx.db.get(last.employeeId as Id<"employees">)
          : null;
        const department =
          employee && "departmentId" in employee && employee.departmentId
            ? await ctx.db.get(employee.departmentId)
            : null;
        const device = last.deviceId
          ? await ctx.db.get(last.deviceId as Id<"devices">)
          : null;
        const zone =
          device && "zoneId" in device && device.zoneId
            ? await ctx.db.get(device.zoneId)
            : undefined;

        const empDoc = employee as { firstName?: string; lastName?: string } | null;
        const deptDoc = department as { name?: string } | null;
        const zoneDoc = zone as { name?: string } | undefined;

        inside.push({
          employeeId: empKey,
          name:
            last.employeeName ??
            (empDoc ? `${empDoc.firstName ?? ""} ${empDoc.lastName ?? ""}`.trim() || "Bilinmiyor" : "Bilinmiyor"),
          department: deptDoc?.name ?? "Bilinmiyor",
          zone: zoneDoc?.name,
          lastSeen: last.accessTime,
        });
      }
    }

    return inside.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getRecentReadings = authedQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const limit = args.limit ?? 10;

    let readings;
    if (ctx.user.role === "super_admin") {
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
            .withIndex("by_project", (q) => q.eq("projectId", pid))
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
