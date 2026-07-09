import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  authedQuery,
  employeeAuthedQuery,
  employeeAuthedMutation,
} from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  getEffectiveWorkSettings,
  getEffectiveOvertimeRates,
  getHolidaysMap,
  resolveHourlyRate,
} from "./lib/pdksHelpers";
import {
  buildShiftResolver,
  thresholdsForShift,
} from "./lib/shiftResolver";
import { bucketWeeklyOvertime, type DayEntry } from "./lib/overtimeCalc";
import { inferAccessStatus, inferDenialReason } from "./lib/hikEventCodes";
import {
  classifyHikEvent,
  shouldCreateCardReadingForHikEvent,
} from "./lib/hikEventCatalog";
import { ideResultGranted } from "./lib/cardReaderParse";
import { canEmployeeAccessDevice } from "./lib/accessDecision";
import {
  buildPeriodDateKeys,
  matchEmployeeKey,
  formatHoursLabel,
} from "./lib/pdksCalc";
import {
  enrichReadingsForList,
  enrichWithDeviceName,
  enrichWithDeviceInfo,
} from "./lib/cardReadingAudit";
import {
  ideTimeToISO,
  resolveDirection,
  resolveActiveMatchingRuleIds,
} from "./lib/cardReadingProcess";
import {
  computeAttendanceDetailDay,
  summarizeAttendanceDays,
} from "./lib/pdksDetail";
import { computePayrollCell } from "./lib/pdksPayroll";
import {
  buildPdksEmployeeReadingMap,
  computePdksTableRow,
  filterPdksTableRows,
} from "./lib/pdksTable";
import { computePdksChartData, emptyPdksChartData } from "./lib/pdksChart";

type AuthedReadCtx = QueryCtx & { user: Doc<"users"> };

const CARD_READING_LIST_SCAN_LIMIT = 5000;
const CARD_READING_PAGE_SIZE_MAX = 200;

function normalizePage(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function normalizePageSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 100;
  return Math.min(CARD_READING_PAGE_SIZE_MAX, Math.max(1, Math.floor(value)));
}

function dayBounds(date: string | undefined) {
  if (!date) return null;
  return {
    startISO: `${date}T00:00:00.000`,
    endISO: `${date}T23:59:59.999`,
  };
}

async function loadScopedCardReadings(
  ctx: AuthedReadCtx,
  opts: {
    limit: number;
    startISO?: string;
    endISO?: string;
  },
): Promise<Doc<"cardReadings">[]> {
  const limit = Math.min(Math.max(1, opts.limit), CARD_READING_LIST_SCAN_LIMIT);
  const range =
    opts.startISO && opts.endISO
      ? { startISO: opts.startISO, endISO: opts.endISO }
      : null;
  const allowedProjectIds = await getProjectIdsForUser(ctx);

  if (ctx.user.role === "super_admin") {
    const query =
      range
        ? ctx.db
            .query("cardReadings")
            .withIndex("by_access_time", (q) =>
              q.gte("accessTime", range.startISO).lte("accessTime", range.endISO),
            )
        : ctx.db.query("cardReadings").withIndex("by_access_time");
    return await query.order("desc").take(limit);
  }

  if (allowedProjectIds.length === 0) return [];
  const perProjectLimit = Math.max(limit, Math.ceil(limit / allowedProjectIds.length));
  const results = await Promise.all(
    allowedProjectIds.map((pid) => {
      const query =
        range
          ? ctx.db
              .query("cardReadings")
              .withIndex("by_project_access_time", (q) =>
                q
                  .eq("projectId", pid)
                  .gte("accessTime", range.startISO)
                  .lte("accessTime", range.endISO),
              )
          : ctx.db
              .query("cardReadings")
              .withIndex("by_project_access_time", (q) => q.eq("projectId", pid));
      return query.order("desc").take(perProjectLimit);
    }),
  );

  return results
    .flat()
    .sort((a, b) => new Date(b.accessTime).getTime() - new Date(a.accessTime).getTime())
    .slice(0, limit);
}

/**
 * Ziyaretçi kayıt ekranı için: seçilen okuyucuda (device) okutulan en son BİLİNMEYEN
 * (atanmamış = `employeeId` yok) kartı döner. Reaktif — kart bastırılınca `useQuery`
 * anında günceller. `sinceTime` (kayıt ekranının açıldığı an) eski okumaları eler.
 */
export const getLastUnknownByDevice = authedQuery({
  args: {
    deviceId: v.id("devices"),
    sinceTime: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ cardNo: v.string(), accessTime: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;
    if (device.projectId && ctx.user.role !== "super_admin") {
      const allowed = await getProjectIdsForUser(ctx);
      if (!allowed.some((id) => id === device.projectId)) return null;
    }
    const since = args.sinceTime;
    const reading = await ctx.db
      .query("cardReadings")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .filter((q) =>
        since
          ? q.and(
              q.eq(q.field("employeeId"), undefined),
              q.gt(q.field("accessTime"), since),
            )
          : q.eq(q.field("employeeId"), undefined),
      )
      .first();
    if (!reading) return null;
    return { cardNo: reading.cardNo, accessTime: reading.accessTime };
  },
});

export const list = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    searchTerm: v.optional(v.string()),
    dateFilter: v.optional(v.string()),
    accessFilter: v.optional(
      v.union(v.literal("all"), v.literal("granted"), v.literal("denied"))
    ),
  },
  handler: async (ctx, args) => {
    const pageSize = normalizePageSize(args.pageSize);
    const page = normalizePage(args.page);
    const bounds = dayBounds(args.dateFilter);
    const scanLimit = Math.min(
      CARD_READING_LIST_SCAN_LIMIT,
      Math.max(page * pageSize * 3, pageSize),
    );
    let readings = await loadScopedCardReadings(ctx, {
      limit: scanLimit,
      startISO: bounds?.startISO,
      endISO: bounds?.endISO,
    });

    // Filters
    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();
      readings = readings.filter(
        (r) =>
          r.employeeName?.toLowerCase().includes(term) ||
          r.cardNo.toLowerCase().includes(term)
      );
    }

    if (args.accessFilter && args.accessFilter !== "all") {
      const status = args.accessFilter === "granted" ? "izin_verildi" : "reddedildi";
      readings = readings.filter((r) => r.accessStatus === status);
    }

    const totalCount = readings.length;
    const from = (page - 1) * pageSize;
    const paginated = readings.slice(from, from + pageSize);

    const enriched = await enrichReadingsForList(ctx, paginated);

    return { readings: enriched, totalCount };
  },
});

export const getRecentByProjects = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 10), 100);
    const readings = await loadScopedCardReadings(ctx, { limit });
    return await enrichWithDeviceName(ctx, readings);
  },
});

export const getPdksTableData = authedQuery({
  args: {
    date: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    departmentId: v.optional(v.id("departments")),
    positionId: v.optional(v.id("positions")),
    shiftId: v.optional(v.id("shifts")),
    statusFilter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("present"),
        v.literal("late"),
        v.literal("absent"),
        v.literal("leave"),
        v.literal("overtime")
      )
    ),
    person: v.optional(v.string()),
    viewMode: v.optional(v.union(v.literal("single"), v.literal("matrix"))),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    const today = args.date ?? new Date().toISOString().split("T")[0];
    const startDate = args.startDate ?? today;
    const endDate = args.endDate ?? today;
    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;
    const isSingleDay = startDate === endDate;
    const viewMode = args.viewMode ?? "single";

    let readings;
    let employees: Doc<"employees">[];
    if (ctx.user.role === "super_admin") {
      [readings, employees] = await Promise.all([
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time")
          .filter((q) =>
            q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
          )
          .collect(),
        ctx.db
          .query("employees")
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect(),
      ]);
    } else if (allowedProjectIds.length > 0) {
      const [readingResults, empResults] = await Promise.all([
        Promise.all(
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
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
      ]);
      readings = readingResults.flat();
      employees = empResults.flat();
    } else {
      return [];
    }

    // Çalışan filtreleri (company/department/position/shift/person)
    if (args.companyId) {
      employees = employees.filter((e) => e.companyId === args.companyId);
    }
    if (args.departmentId) {
      employees = employees.filter((e) => e.departmentId === args.departmentId);
    }
    if (args.positionId) {
      employees = employees.filter((e) => e.positionId === args.positionId);
    }
    if (args.shiftId) {
      employees = employees.filter((e) => e.shiftId === args.shiftId);
    }
    if (args.person && args.person.trim()) {
      const term = args.person.trim().toLowerCase();
      employees = employees.filter((e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(term)
      );
    }

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const empById = new Map<string, Doc<"employees">>();
    for (const emp of employees) {
      empById.set(String(emp._id), emp);
    }
    const employeeMap = buildPdksEmployeeReadingMap({ employees, readings });

    // Settings & holidays per project (super_admin için global = undefined)
    const referenceProjectId =
      ctx.user.role === "super_admin"
        ? undefined
        : allowedProjectIds[0] ?? undefined;
    const [workSettings, holidayMap, generalSettings, shiftResolver, overtimeRates] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, startDate, endDate),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        buildShiftResolver(ctx, employees),
        getEffectiveOvertimeRates(ctx, referenceProjectId),
      ]);
    const workingDays =
      generalSettings?.workingDays && generalSettings.workingDays.length > 0
        ? generalSettings.workingDays
        : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

    // pdksRecords manuel override haritası
    const manualPdksByEmpDate = new Map<string, Doc<"pdksRecords">>();
    for (const empKey of employeeMap.keys()) {
      const emp = empById.get(empKey);
      if (!emp) continue;
      const recs = await ctx.db
        .query("pdksRecords")
        .withIndex("by_employee_date", (q) => q.eq("employeeId", emp._id))
        .filter((q) =>
          q.and(
            q.gte(q.field("date"), startDate),
            q.lte(q.field("date"), endDate)
          )
        )
        .collect();
      for (const r of recs) {
        if (r.manualEntry) {
          manualPdksByEmpDate.set(`${empKey}__${r.date}`, r);
        }
      }
    }

    const allLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const periodDateKeys = buildPeriodDateKeys(startDate, endDate);

    const tableDepartments = await ctx.db.query("departments").collect();
    const tableDeptById = new Map(tableDepartments.map((d) => [String(d._id), d]));

    const tableData = await Promise.all(
      Array.from(employeeMap.entries()).map(async ([empKey, empReadings]) => {
        const employee = empById.get(empKey) ?? null;
        const department = employee?.departmentId
          ? tableDeptById.get(String(employee.departmentId)) ?? null
          : null;
        const empId = employee?._id;
        const manualToday =
          isSingleDay && empId
            ? manualPdksByEmpDate.get(`${empKey}__${startDate}`)
            : undefined;
        const editor = manualToday?.editedBy
          ? await ctx.db.get(manualToday.editedBy)
          : null;

        return computePdksTableRow({
          empKey,
          empReadings,
          employee,
          departmentName: department?.name ?? "-",
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
          resolveShift: (employeeId, dateISO) =>
            shiftResolver.resolve(employeeId, dateISO),
          manualEditedBy: editor?.fullName ?? editor?.name ?? editor?.email ?? null,
        });
      })
    );

    // Status filtresi (frontend'den önce sunucu tarafında uygula)
    const filtered = filterPdksTableRows(tableData, args.statusFilter);

    return filtered.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  },
});

/**
 * PDKS grafik verileri - devam oranı, departman devamsızlık, geç kalma dağılımı
 */
export const getPdksChartData = authedQuery({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const startISO = `${args.startDate}T00:00:00.000`;
    const endISO = `${args.endDate}T23:59:59.999`;

    let readings;
    if (ctx.user.role === "super_admin") {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time")
        .filter((q) =>
          q.and(q.gte(q.field("accessTime"), startISO), q.lte(q.field("accessTime"), endISO))
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
      return emptyPdksChartData();
    }

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const chartProjectId =
      ctx.user.role === "super_admin"
        ? undefined
        : allowedProjectIds[0] ?? undefined;
    const chartSettings = await getEffectiveWorkSettings(ctx, chartProjectId);

    const chartEmployees =
      ctx.user.role === "super_admin"
        ? await ctx.db.query("employees").collect()
        : (
            await Promise.all(
              allowedProjectIds.map((pid) =>
                ctx.db
                  .query("employees")
                  .withIndex("by_project", (q) => q.eq("projectId", pid))
                  .collect(),
              ),
            )
          ).flat();
    const chartShiftResolver = await buildShiftResolver(ctx, chartEmployees);

    const empToDept = new Map<string, string>();
    for (const r of readings) {
      const empKey = r.employeeId ?? r.cardNo;
      if (empToDept.has(empKey)) continue;
      const emp = r.employeeId ? await ctx.db.get(r.employeeId) : null;
      if (emp?.departmentId) {
        const dept = await ctx.db.get(emp.departmentId);
        empToDept.set(empKey, dept?.name ?? "Bilinmiyor");
      } else {
        empToDept.set(empKey, "Bilinmiyor");
      }
    }

    return computePdksChartData({
      readings,
      startDate: args.startDate,
      endDate: args.endDate,
      chartSettings,
      employeeDepartmentByKey: empToDept,
      resolveShift: (employeeId, dateISO) =>
        chartShiftResolver.resolve(employeeId, dateISO),
    });
  },
});

/**
 * Aylık bordro cetveli - çalışan × gün matrisi.
 * Her gün için: payrollCode (N/RT/HT/İZN/DV), çalışılan dakika, geç kalma flag,
 * fazla mesai dakikası ve günün çarpanı.
 */
export const getMonthlyPayrollSheet = authedQuery({
  args: {
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    const monthStr = String(args.month).padStart(2, "0");
    const lastDay = new Date(args.year, args.month, 0).getUTCDate();
    const startDate = `${args.year}-${monthStr}-01`;
    const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const startISO = `${startDate}T00:00:00.000`;
    const endISO = `${endDate}T23:59:59.999`;

    let readings;
    let employees: Doc<"employees">[];
    if (ctx.user.role === "super_admin") {
      [readings, employees] = await Promise.all([
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time")
          .filter((q) =>
            q.and(
              q.gte(q.field("accessTime"), startISO),
              q.lte(q.field("accessTime"), endISO)
            )
          )
          .collect(),
        ctx.db
          .query("employees")
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect(),
      ]);
    } else if (allowedProjectIds.length > 0) {
      const [readingResults, empResults] = await Promise.all([
        Promise.all(
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
        ),
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("employees")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .filter((q) => q.eq(q.field("isActive"), true))
              .collect()
          )
        ),
      ]);
      readings = readingResults.flat();
      employees = empResults.flat();
    } else {
      return { days: [], rows: [], year: args.year, month: args.month };
    }

    const referenceProjectId =
      ctx.user.role === "super_admin"
        ? undefined
        : allowedProjectIds[0] ?? undefined;
    const [workSettings, holidayMap, generalSettings, overtimeRates, payrollShiftResolver] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, startDate, endDate),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        getEffectiveOvertimeRates(ctx, referenceProjectId),
        buildShiftResolver(ctx, employees),
      ]);
    const workingDays =
      generalSettings?.workingDays && generalSettings.workingDays.length > 0
        ? generalSettings.workingDays
        : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

    // Liste tüm günler için
    const days: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      days.push(`${args.year}-${monthStr}-${String(d).padStart(2, "0")}`);
    }

    // Onaylı izinler
    const approvedLeaves = await ctx.db
      .query("leaves")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Manuel pdksRecords her çalışan için ay aralığı (batch: tek query, in-memory filter)
    const empIds = employees.map((e) => e._id);
    const empIdSet = new Set<string>(empIds.map((id) => String(id)));
    const manualByEmpDate = new Map<string, Doc<"pdksRecords">>();
    const allRecs = await ctx.db
      .query("pdksRecords")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    const recs = allRecs.filter((r) => empIdSet.has(String(r.employeeId)));
    {
      for (const r of recs) {
        if (r.manualEntry) manualByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
      }
    }

    // readings'i çalışan × gün'e grupla
    const empIdByCard = new Map<string, string>();
    for (const e of employees) {
      if (e.cardNumber) empIdByCard.set(e.cardNumber, String(e._id));
    }

    const empDayReadings = new Map<string, Doc<"cardReadings">[]>();
    for (const r of readings) {
      const empId = matchEmployeeKey(
        { employeeId: r.employeeId, cardNo: r.cardNo },
        empIdSet,
        empIdByCard,
      );
      if (!empId) continue;
      const dateKey = r.accessTime.split("T")[0];
      const key = `${empId}__${dateKey}`;
      if (!empDayReadings.has(key)) empDayReadings.set(key, []);
      empDayReadings.get(key)!.push(r);
    }

    const allDepartments = await ctx.db.query("departments").collect();
    const deptById = new Map(allDepartments.map((d) => [String(d._id), d]));

    const rows = await Promise.all(
      employees.map(async (emp) => {
        const department = emp.departmentId
          ? deptById.get(String(emp.departmentId)) ?? null
          : null;

        const empHourlyRate = resolveHourlyRate({
          hourlyRate: emp.hourlyRate,
          monthlySalary: emp.monthlySalary,
          monthlyHoursBase: workSettings.monthlyHoursBase,
        });

        const cells = days.map((d) =>
          computePayrollCell({
            date: d,
            manual: manualByEmpDate.get(`${emp._id}__${d}`),
            dayReadings: empDayReadings.get(`${emp._id}__${d}`) ?? [],
            hasLeave: approvedLeaves.some(
              (l) =>
                l.employeeId === emp._id &&
                d >= l.startDate &&
                d <= l.endDate
            ),
            holiday: holidayMap.get(d),
            workingDays,
            dayShift: payrollShiftResolver.resolve(emp._id, d),
            workSettings,
            overtimeRates,
            empHourlyRate,
          })
        );

        const dayEntries: DayEntry[] = cells.map((c) => ({
          date: c.date,
          netMinutes: c.totalMinutes,
          classification: c.classification,
        }));
        const buckets = bucketWeeklyOvertime(dayEntries);
        const weeklyOvertimeMin = buckets.reduce(
          (s, b) => s + b.overtimeMinutes + b.premiumMinutes,
          0,
        );
        const exceedsDaily11h = buckets.flatMap((b) => b.exceedsDaily11h);

        const totals = cells.reduce(
          (acc, c) => {
            acc.totalMinutes += c.totalMinutes;
            acc.overtimePayTRY += c.overtimePayTRY ?? 0;
            if (c.payrollCode === "İZN") acc.leaveDays += 1;
            if (c.payrollCode === "DV") acc.absentDays += 1;
            if (c.isLate) acc.lateDays += 1;
            return acc;
          },
          {
            totalMinutes: 0,
            overtimePayTRY: 0,
            leaveDays: 0,
            absentDays: 0,
            lateDays: 0,
          }
        );

        return {
          employeeId: emp._id,
          payrollCode: emp.payrollCode ?? "",
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          cardNumber: emp.cardNumber,
          department: department?.name ?? "-",
          hourlyRate: empHourlyRate,
          cells,
          totals: {
            ...totals,
            overtimeMinutes: weeklyOvertimeMin,
            overtimePayTRY: empHourlyRate !== null ? totals.overtimePayTRY : null,
            exceedsDaily11h,
          },
        };
      })
    );

    return {
      days,
      rows: rows.sort((a, b) => a.name.localeCompare(b.name, "tr")),
      year: args.year,
      month: args.month,
    };
  },
});

// Kart-okuma yön/zaman/kural helper'ları (ideTimeToISO, startOfTurkeyDayISO,
// resolveDirection, resolveActiveMatchingRuleIds + AccessDirection) lib/cardReadingProcess.ts'e
// taşındı — saf ikili golden testlerle donduruldu.

/**
 * Kart okuyucu cihazlarından gelen istekleri işler (internal - HTTP action'dan çağrılır).
 * Erişim kontrolü yapar ve card_readings kaydı oluşturur.
 */
export const processCardReading = internalMutation({
  args: {
    cardNo: v.string(),
    deviceSerial: v.string(),
    deviceIp: v.optional(v.string()),
    /**
     * Token doğrulanmış istekte (per-device apiToken) cihaz buradan SABİTLENİR;
     * body serial/IP'ye güvenilmez (cross-tenant forge önlenir). Yoksa eski lookup.
     */
    authedDeviceId: v.optional(v.id("devices")),
    rawBody: v.optional(v.string()),
    hikDevIndex: v.optional(v.string()),
    hikEhomeID: v.optional(v.string()),
    hikMajorEventType: v.optional(v.number()),
    hikSubEventType: v.optional(v.number()),
    hikCurrentVerifyMode: v.optional(v.string()),
    hikSerialNo: v.optional(v.number()),
    hikFrontSerialNo: v.optional(v.number()),
    hikDateTime: v.optional(v.string()),
    hikPictureURL: v.optional(v.string()),
    hikMask: v.optional(v.string()),
    hikHelmet: v.optional(v.string()),
    hikTemperature: v.optional(v.number()),
    hikEventState: v.optional(v.string()),
    // IDE Smart panel event alanları
    ideUuid: v.optional(v.string()),
    ideIoId: v.optional(v.number()),
    /** Panel erişim kararı (payload.result). Kod anlamları: lib/cardReaderParse ideResultGranted. */
    ideResult: v.optional(v.number()),
    /** Panel olay zamanı ("YYYY-MM-DD HH:MM:SS", panel TZ = UTC+3). */
    ideTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accessTime = new Date().toISOString();
    const firstProjectId = (await ctx.db.query("projects").first())?._id;
    const projectForRow = (
      employeeProject: typeof firstProjectId,
      deviceProject: typeof firstProjectId
    ) => employeeProject ?? deviceProject ?? firstProjectId;

    // Tüm cardReadings insert'lerine spread edilecek Hikvision metadata
    const hikFields = {
      hikDevIndex: args.hikDevIndex,
      hikMajorEventType: args.hikMajorEventType,
      hikSubEventType: args.hikSubEventType,
      hikCurrentVerifyMode: args.hikCurrentVerifyMode,
      hikSerialNo: args.hikSerialNo,
      hikFrontSerialNo: args.hikFrontSerialNo,
      hikDateTime: args.hikDateTime,
      hikPictureURL: args.hikPictureURL,
      hikMask: args.hikMask,
      hikHelmet: args.hikHelmet,
      hikTemperature: args.hikTemperature,
      hikEventState: args.hikEventState,
    } as const;

    // 1. Cihazı bul. Token doğrulanmış istekte (authedDeviceId) attribution o cihaza
    //    SABİTLENİR — body'deki serial/IP/uuid'ye GÜVENİLMEZ. Bu, /card-reader'daki
    //    localBridge guard-skip + IP-global lookup ile bir token sahibinin BAŞKA tenant'ın
    //    cihazına forged kart/audit satırı yazmasını engeller. Token yoksa (deprecated
    //    unauth yol) eski serial→devIndex→ehome→uuid→IP zincirine düşülür.
    let device = null;
    if (args.authedDeviceId) {
      device = await ctx.db.get(args.authedDeviceId);
    } else {
      if (args.deviceSerial?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_device_serial", (q) =>
            q.eq("deviceSerial", args.deviceSerial!.trim())
          )
          .first();
      }
      // Gateway-passthrough event'inde serial yerine devIndex gelir → indexli lookup
      if (!device && args.hikDevIndex?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_hik_dev_index", (q) =>
            q.eq("hikDevIndex", args.hikDevIndex!.trim())
          )
          .first();
      }
      // Cihaz event'i `deviceID` field'ında ehomeID gönderir (gateway register'da atadığımız)
      if (!device && args.hikEhomeID?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_ehome_id", (q) =>
            q.eq("ehomeID", args.hikEhomeID!.trim())
          )
          .first();
      }
      // IDE Smart panel event'i: serial yerine panel UUID gelebilir.
      if (!device && args.ideUuid?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", args.ideUuid!.trim()))
          .first();
      }
      if (!device && args.deviceIp?.trim()) {
        device = await ctx.db
          .query("devices")
          .withIndex("by_device_ip", (q) =>
            q.eq("deviceIp", args.deviceIp!.trim())
          )
          .first();
      }
    }

    // Hikvision brand-dispatch: karar cihazda verilir, biz sadece audit yazarız.
    // QR vs. cihazlar aşağıdaki mevcut akışa düşer (Convex DB lookup → granted hesapla).
    if (device?.brand === "hikvision") {
      const inferred = inferAccessStatus(
        args.hikMajorEventType,
        args.hikSubEventType,
      );
      const accessStatus: "izin_verildi" | "reddedildi" =
        inferred ?? "reddedildi";
      const granted = accessStatus === "izin_verildi";
      const denialReason = granted
        ? undefined
        : inferDenialReason(args.hikSubEventType);

      const employee = await ctx.db
        .query("employees")
        .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
        .first();

      const direction = employee
        ? await resolveDirection(ctx, {
            device,
            employeeId: employee._id,
            nowISO: accessTime,
          })
        : undefined;

      // serialNo gap detection — event ardışıklığı bozulduysa AcsEvent backfill için işaretle.
      // Şimdilik sadece warn log; Phase 5.2'de history backfill kuyruğu eklenecek.
      if (
        args.hikSerialNo !== undefined &&
        args.hikFrontSerialNo !== undefined &&
        device.hikLastSerialNo !== undefined &&
        args.hikFrontSerialNo !== device.hikLastSerialNo
      ) {
        console.warn(
          `[hik-event-gap] device=${device.name} expected front=${device.hikLastSerialNo} got=${args.hikFrontSerialNo} current=${args.hikSerialNo}`,
        );
      }
      if (
        args.hikSerialNo !== undefined &&
        args.hikSerialNo !== device.hikLastSerialNo
      ) {
        await ctx.db.patch(device._id, { hikLastSerialNo: args.hikSerialNo });
      }

      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee?.projectId, device.projectId),
        deviceId: device._id,
        employeeId: employee?._id,
        cardNo: args.cardNo,
        employeeName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : undefined,
        accessTime,
        accessStatus,
        direction,
        rawData: args.rawBody,
        ...hikFields,
        hikDenialReason: denialReason,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted };
    }

    // IDE Smart brand-dispatch: erişim kararını PANEL verir (payload.result).
    // Hikvision gibi: biz sadece audit yazarız, kartı ekrana düşürürüz.
    // Kayıtlı olmayan kart da yazılır (employee yoksa isim boş, accessStatus panel kararı).
    if (device?.brand === "ide_smart") {
      // Erişim kararını PANEL verir; result kodu (1/2/3 = grant, kapı açılır) → ideResultGranted.
      const granted = ideResultGranted(args.ideResult);
      const accessStatus: "izin_verildi" | "reddedildi" = granted
        ? "izin_verildi"
        : "reddedildi";

      // Panel olay zamanı (payload.time, panel TZ = UTC+3) → UTC ISO. Offline kuyruktan
      // toplu push edilen event'lerde gerçek okutma anı korunur (sunucu alış anı değil).
      const ideAccessTime = ideTimeToISO(args.ideTime) ?? accessTime;

      const employee = await ctx.db
        .query("employees")
        .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
        .first();

      const direction = await resolveDirection(ctx, {
        device,
        employeeId: employee?._id ?? null,
        nowISO: ideAccessTime,
        ideIoId: args.ideIoId,
      });

      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee?.projectId, device.projectId),
        deviceId: device._id,
        employeeId: employee?._id,
        cardNo: args.cardNo,
        employeeName: employee
          ? `${employee.firstName} ${employee.lastName}`
          : undefined,
        accessTime: ideAccessTime,
        accessStatus,
        direction,
        ideIoId: args.ideIoId,
        rawData: args.rawBody,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted };
    }

    // Mobil dinamik QR token branch'i: cihaz QR'ı kart gibi POST'lar.
    // UUID v4 formatı gerçek kart numaralarıyla çakışmaz (kartlar tiresiz).
    const isToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.cardNo);
    if (isToken) {
      const tokenRow = await ctx.db
        .query("checkInTokens")
        .withIndex("by_token", (q) => q.eq("token", args.cardNo))
        .first();

      if (!tokenRow) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(undefined, device?.projectId),
          deviceId: device?._id,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      if (tokenRow.usedAt) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(undefined, device?.projectId),
          deviceId: device?._id,
          employeeId: tokenRow.employeeId,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      if (new Date(accessTime) > new Date(tokenRow.expiresAt)) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(undefined, device?.projectId),
          deviceId: device?._id,
          employeeId: tokenRow.employeeId,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      const tokenEmployee = await ctx.db.get(tokenRow.employeeId);
      if (!tokenEmployee || !tokenEmployee.isActive) {
        await ctx.db.insert("cardReadings", {
          projectId: projectForRow(tokenEmployee?.projectId, device?.projectId),
          deviceId: device?._id,
          employeeId: tokenRow.employeeId,
          cardNo: args.cardNo,
          accessTime,
          accessStatus: "reddedildi",
          rawData: args.rawBody,
          ...hikFields,
          createdAt: accessTime,
          updatedAt: accessTime,
        });
        return { granted: false };
      }

      // Cihaz + grup erişim kontrolü (kart akışıyla aynı kural)
      let tokenHasAccess = false;
      if (device) {
        const deviceGroups = await ctx.db
          .query("groupDevices")
          .withIndex("by_project_device", (q) =>
            q.eq("projectId", device.projectId).eq("deviceId", device._id),
          )
          .collect();
        const deviceGroupIds = deviceGroups.map((gd) => gd.groupId);
        const employeeAccessGroups = await ctx.db
          .query("groupMembers")
          .withIndex("by_project_employee", (q) =>
            q.eq("projectId", tokenEmployee.projectId).eq("employeeId", tokenEmployee._id),
          )
          .collect();
        const employeeGroupIds = employeeAccessGroups.map((gm) => gm.groupId);
        const activeRuleIds = await resolveActiveMatchingRuleIds(
          ctx,
          deviceGroupIds,
          employeeGroupIds,
        );
        tokenHasAccess = canEmployeeAccessDevice({
          deviceGroupIds,
          employeeGroupIds,
          activeRuleIds,
        });
      }

      await ctx.db.patch(tokenRow._id, { usedAt: accessTime });
      const tokenDirection = await resolveDirection(ctx, {
        device,
        employeeId: tokenEmployee._id,
        nowISO: accessTime,
      });
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(tokenEmployee.projectId, device?.projectId),
        deviceId: device?._id,
        employeeId: tokenEmployee._id,
        cardNo: tokenEmployee.cardNumber,
        employeeName: `${tokenEmployee.firstName} ${tokenEmployee.lastName}`,
        accessTime,
        accessStatus: tokenHasAccess ? "izin_verildi" : "reddedildi",
        direction: tokenDirection,
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: tokenHasAccess };
    }

    // 2. Çalışanı kart numarasına göre bul
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", args.cardNo))
      .first();

    if (!employee) {
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(undefined, device?.projectId),
        deviceId: device?._id,
        cardNo: args.cardNo,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    if (!employee.isActive) {
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee.projectId, device?.projectId),
        deviceId: device?._id,
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    if (!device) {
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee.projectId, undefined),
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    // 3. Cihazın hiçbir grupta olup olmadığını kontrol et
    const deviceGroups = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", device._id),
      )
      .collect();

    if (deviceGroups.length === 0) {
      const noGroupDirection = await resolveDirection(ctx, {
        device,
        employeeId: employee._id,
        nowISO: accessTime,
      });
      await ctx.db.insert("cardReadings", {
        projectId: projectForRow(employee.projectId, device.projectId),
        deviceId: device._id,
        employeeId: employee._id,
        cardNo: args.cardNo,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        accessTime,
        accessStatus: "reddedildi",
        direction: noGroupDirection,
        rawData: args.rawBody,
        ...hikFields,
        createdAt: accessTime,
        updatedAt: accessTime,
      });
      return { granted: false };
    }

    // 4. Çalışanın bu cihaza erişimi var mı? (groupMembers + accessRules)
    const deviceGroupIds = deviceGroups.map((gd) => gd.groupId);
    const employeeAccessGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
      )
      .collect();
    const employeeGroupIds = employeeAccessGroups.map((gm) => gm.groupId);
    const activeRuleIds = await resolveActiveMatchingRuleIds(
      ctx,
      deviceGroupIds,
      employeeGroupIds,
    );
    const hasAccess = canEmployeeAccessDevice({
      deviceGroupIds,
      employeeGroupIds,
      activeRuleIds,
    });

    // 5. Kayıt oluştur
    const cardDirection = await resolveDirection(ctx, {
      device,
      employeeId: employee._id,
      nowISO: accessTime,
    });
    await ctx.db.insert("cardReadings", {
      projectId: projectForRow(employee.projectId, device.projectId),
      deviceId: device._id,
      employeeId: employee._id,
      cardNo: args.cardNo,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime,
      accessStatus: hasAccess ? "izin_verildi" : "reddedildi",
      direction: cardDirection,
      rawData: args.rawBody,
      ...hikFields,
      createdAt: accessTime,
      updatedAt: accessTime,
    });

    // 6. Geç kalma bildirimi (hasAccess + geç giriş)
    if (hasAccess) {
      const settings = await getEffectiveWorkSettings(ctx, employee.projectId);
      const dayShiftResolver = await buildShiftResolver(ctx, [employee]);
      const dayShift = dayShiftResolver.resolve(employee._id, accessTime.split("T")[0]);
      const { lateThresholdMin } = thresholdsForShift(dayShift, settings);
      const tr = new Date(new Date(accessTime).getTime() + 3 * 60 * 60 * 1000);
      const h = tr.getUTCHours();
      const m = tr.getUTCMinutes();
      const isLate = h * 60 + m > lateThresholdMin;
      if (isLate && employee.projectId) {
        const notifSettings = await ctx.db
          .query("notificationSettings")
          .withIndex("by_project", (q) => q.eq("projectId", employee.projectId!))
          .first();
        const generalSettings = await ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", employee.projectId!))
          .first();
        const notifyEmail = generalSettings?.email ?? process.env.NOTIFICATION_EMAIL;
        if (
          notifSettings?.lateNotifications !== false &&
          notifyEmail
        ) {
          ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendLateNotification, {
            to: notifyEmail,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            lateTime: new Date(accessTime).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            projectId: employee.projectId,
          });
        }
      }
    }

    return { granted: hasAccess };
  },
});

/**
 * Mobile uygulama için: oturum açmış çalışanın kendi son kart okumalarını döner.
 * `employeeAuthedQuery` `sessionToken` arg'ını otomatik ekler ve
 * `ctx.employee`'yi enjekte eder — `users` tablosuyla ilişki yok.
 */
export const listForEmployee = employeeAuthedQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const employee = ctx.employee;

    const readings = await ctx.db
      .query("cardReadings")
      .withIndex("by_employee", (q) => q.eq("employeeId", employee._id))
      .order("desc")
      .take(limit);

    return await enrichWithDeviceInfo(ctx, readings);
  },
});

/**
 * Mobile QR check-in. `employeeAuthedMutation` üzerinden çalışana doğrudan
 * `ctx.employee` ile erişir; QR'dan gelen `deviceId` / `deviceSerial` ile
 * cihazı bulur, erişim kuralını değerlendirir ve kayıt atar.
 */
export const selfCheckIn = employeeAuthedMutation({
  args: {
    deviceId: v.optional(v.id("devices")),
    deviceSerial: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = ctx.employee;

    let device: Doc<"devices"> | null = null;
    if (args.deviceId) {
      device = (await ctx.db.get(args.deviceId)) as Doc<"devices"> | null;
    }
    if (!device && args.deviceSerial?.trim()) {
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) =>
          q.eq("deviceSerial", args.deviceSerial!.trim())
        )
        .first();
    }
    if (!device) {
      throw new Error("Cihaz bulunamadı");
    }

    const deviceGroups = await ctx.db
      .query("groupDevices")
      .withIndex("by_project_device", (q) =>
        q.eq("projectId", device.projectId).eq("deviceId", device._id),
      )
      .collect();
    const groupIds = deviceGroups.map((g) => g.groupId);

    const employeeGroups = await ctx.db
      .query("groupMembers")
      .withIndex("by_project_employee", (q) =>
        q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
      )
      .collect();
    const employeeGroupIds = new Set(employeeGroups.map((g) => g.groupId));
    const matching = groupIds.filter((g) => employeeGroupIds.has(g));

    let hasAccess = false;
    for (const groupId of matching) {
      const rule = await ctx.db.get(groupId);
      if (rule?.isActive) {
        hasAccess = true;
        break;
      }
    }

    const accessTime = new Date().toISOString();
    const direction = await resolveDirection(ctx, {
      device,
      employeeId: employee._id,
      nowISO: accessTime,
    });
    const readingId = await ctx.db.insert("cardReadings", {
      projectId: employee.projectId ?? device.projectId,
      deviceId: device._id,
      employeeId: employee._id,
      cardNo: employee.cardNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime,
      accessStatus: hasAccess ? "izin_verildi" : "reddedildi",
      direction,
      rawData: JSON.stringify({ source: "mobile_qr" }),
      createdAt: accessTime,
      updatedAt: accessTime,
    });

    return { granted: hasAccess, readingId };
  },
});

/**
 * Tek çalışanın belirli aralıktaki gün gün katılım detayı.
 * Drill-down panel için: özet + her gün için ham kart okuma izleri.
 */
export const getEmployeeAttendanceDetail = authedQuery({
  args: {
    employeeId: v.id("employees"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    const employee = await ctx.db.get(args.employeeId);
    if (!employee) return null;

    if (
      ctx.user.role !== "super_admin" &&
      employee.projectId &&
      !allowedProjectIds.includes(employee.projectId)
    ) {
      return null;
    }

    const startISO = `${args.startDate}T00:00:00.000`;
    const endISO = `${args.endDate}T23:59:59.999`;

    const readings = await ctx.db
      .query("cardReadings")
      .withIndex("by_employee_device_time", (q) =>
        q.eq("employeeId", args.employeeId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("accessTime"), startISO),
          q.lte(q.field("accessTime"), endISO)
        )
      )
      .collect();

    readings.sort(
      (a, b) =>
        new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const referenceProjectId =
      ctx.user.role === "super_admin" ? undefined : employee.projectId;
    const [workSettings, holidayMap, generalSettings, manualRecords, leaves, department, company, position, shift, detailShiftResolver] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, args.startDate, args.endDate),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        ctx.db
          .query("pdksRecords")
          .withIndex("by_employee_date", (q) => q.eq("employeeId", args.employeeId))
          .filter((q) =>
            q.and(
              q.gte(q.field("date"), args.startDate),
              q.lte(q.field("date"), args.endDate)
            )
          )
          .collect(),
        ctx.db
          .query("leaves")
          .withIndex("by_employee", (q) => q.eq("employeeId", args.employeeId))
          .filter((q) => q.eq(q.field("status"), "approved"))
          .collect(),
        employee.departmentId ? ctx.db.get(employee.departmentId) : Promise.resolve(null),
        employee.companyId ? ctx.db.get(employee.companyId) : Promise.resolve(null),
        employee.positionId ? ctx.db.get(employee.positionId) : Promise.resolve(null),
        employee.shiftId ? ctx.db.get(employee.shiftId) : Promise.resolve(null),
        buildShiftResolver(ctx, [employee]),
      ]);

    const workingDays =
      generalSettings?.workingDays && generalSettings.workingDays.length > 0
        ? generalSettings.workingDays
        : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

    const manualByDate = new Map<string, Doc<"pdksRecords">>();
    for (const m of manualRecords) {
      if (m.manualEntry) manualByDate.set(m.date, m);
    }

    const periodDateKeys = buildPeriodDateKeys(args.startDate, args.endDate);

    const readingsByDate = new Map<string, typeof readings>();
    for (const r of readings) {
      const dk = r.accessTime.split("T")[0];
      if (!readingsByDate.has(dk)) readingsByDate.set(dk, []);
      readingsByDate.get(dk)!.push(r);
    }

    const days = periodDateKeys.map((dk) =>
      computeAttendanceDetailDay({
        date: dk,
        dayReadings: readingsByDate.get(dk) ?? [],
        manualDay: manualByDate.get(dk),
        leaves,
        holiday: holidayMap.get(dk),
        dayShift: detailShiftResolver.resolve(employee._id, dk),
        workSettings,
        workingDays,
      })
    );

    const summary = summarizeAttendanceDays(days);

    return {
      employee: {
        id: String(employee._id),
        firstName: employee.firstName,
        lastName: employee.lastName,
        cardNumber: employee.cardNumber,
        photoUrl: employee.photoUrl ?? null,
        payrollCode: employee.payrollCode ?? null,
        department: department?.name ?? null,
        company: company?.name ?? null,
        position: position?.name ?? null,
        shift: shift?.name ?? null,
      },
      summary: {
        totalMinutes: summary.totalMinutes,
        totalHours: formatHoursLabel(summary.totalMinutes),
        workedDays: summary.workedDays,
        lateDays: summary.lateDays,
        absentDays: summary.absentDays,
        leaveDays: summary.leaveDays,
        overtimeMinutes: summary.overtimeMinutes,
        overtimeHours: Math.round((summary.overtimeMinutes / 60) * 10) / 10,
      },
      days,
    };
  },
});

// ---------------------------------------------------------------------------
// AcsEvent backfill — tek event satırı yazar, dedup kontrolü yapar.
// ---------------------------------------------------------------------------

/**
 * Cihazdan tarihsel olarak çekilen tek bir AcsEvent satırını cardReadings'e yazar.
 * Dedup: by_device_hik_serial index ile (deviceId, hikSerialNo) çifti daha önce
 * yazılmışsa insert atlanır.
 * NOT: hikLastSerialNo (canlı cursor) PATCH'lenmez — backfill yalnız hikBackfillCursor'u kullanır.
 */
export const backfillHikEventRow = internalMutation({
  args: {
    deviceId: v.id("devices"),
    event: v.object({
      time: v.string(),
      cardNo: v.string(),
      cardType: v.optional(v.string()),
      name: v.optional(v.string()),
      employeeNoString: v.optional(v.string()),
      major: v.number(),
      minor: v.number(),
      doorNo: v.optional(v.number()),
      currentVerifyMode: v.optional(v.string()),
      serialNo: v.number(),
      pictureURL: v.optional(v.string()),
      attendanceStatus: v.optional(v.string()),
    }),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ inserted: boolean; reason?: string }> => {
    // Device'ı al (projectId için).
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      return { inserted: false, reason: "device-not-found" };
    }

    const cardNo = args.event.cardNo.trim();
    const shouldCreateCardReading = shouldCreateCardReadingForHikEvent(
      args.event.major,
      args.event.minor,
      cardNo.length > 0,
    );

    if (!shouldCreateCardReading) {
      const existingEvent = await ctx.db
        .query("deviceEvents")
        .withIndex("by_device_and_hik_serial", (q) =>
          q.eq("deviceId", args.deviceId).eq("hikSerialNo", args.event.serialNo),
        )
        .first();
      if (existingEvent) {
        return { inserted: false, reason: "duplicate" };
      }

      const event = classifyHikEvent(args.event.major, args.event.minor);
      const rawData = JSON.stringify(args.event);
      await ctx.db.insert("deviceEvents", {
        projectId: device.projectId,
        deviceId: args.deviceId,
        source: "hikvision",
        eventTime: args.event.time,
        category: event.category,
        severity: event.severity,
        label: event.label,
        major: args.event.major,
        minor: args.event.minor,
        cardNo: cardNo || undefined,
        rawData: rawData.length > 10000 ? rawData.slice(0, 10000) : rawData,
        hikDevIndex: device.hikDevIndex,
        hikSerialNo: args.event.serialNo,
        createdAt: args.event.time,
        updatedAt: args.event.time,
      });
      return { inserted: true, reason: "device-event" };
    }

    // Dedup: (deviceId, serialNo) çifti zaten kayıtlıysa atla.
    const existing = await ctx.db
      .query("cardReadings")
      .withIndex("by_device_hik_serial", (q) =>
        q.eq("deviceId", args.deviceId).eq("hikSerialNo", args.event.serialNo),
      )
      .first();
    if (existing) {
      return { inserted: false, reason: "duplicate" };
    }

    const accessStatus: "izin_verildi" | "reddedildi" =
      inferAccessStatus(args.event.major, args.event.minor) ?? "reddedildi";
    const granted = accessStatus === "izin_verildi";
    const denialReason = granted
      ? undefined
      : inferDenialReason(args.event.minor);

    // cardNo'dan çalışan ara (by_card index — canlı branch ile aynı yol)
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_card", (q) => q.eq("cardNumber", cardNo))
      .first();

    // projectId: employee'nin projesi > cihazın projesi
    const projectId = employee?.projectId ?? device.projectId;

    const employeeName = employee
      ? `${employee.firstName} ${employee.lastName}`
      : (args.event.name?.trim() || undefined);

    await ctx.db.insert("cardReadings", {
      projectId,
      deviceId: args.deviceId,
      employeeId: employee?._id,
      cardNo,
      employeeName,
      // accessTime = event'in cihaz zamanı (Date.now() DEĞİL — backfill)
      accessTime: args.event.time,
      accessStatus,
      hikMajorEventType: args.event.major,
      hikSubEventType: args.event.minor,
      hikCurrentVerifyMode: args.event.currentVerifyMode,
      hikSerialNo: args.event.serialNo,
      hikDevIndex: device.hikDevIndex,
      hikPictureURL: args.event.pictureURL,
      hikDateTime: args.event.time,
      hikDenialReason: denialReason,
      createdAt: args.event.time,
      updatedAt: args.event.time,
    });

    return { inserted: true };
  },
});
