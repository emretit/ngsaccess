import { classifyReadingSource, filterPdksReadings } from "./lib/pdksSource";
import { matchesReadingSources, splitPdksEligible, toReportTransactionRow } from "./lib/reportAttendance";
import { paginationOptsValidator, type PaginationResult } from "convex/server";
import { resolveProjectScope } from "./lib/projectScope";
import { cardReadingDateBounds, scopedCardReadingQuery } from "./lib/cardReadingList";
import { assignmentPrecondition, ASSIGN_CARD_ERRORS, liveReadingWindow, matchesReadingResult } from "./lib/liveReadings";
import { getEmployeeTargetDevices } from "./lib/peopleHikSnapshot";
import { writeAudit } from "./lib/audit";
import { toUtcISO, trDateKey, trTodayKey, trDayRangeISO } from "./lib/trDate";
import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  authedQuery,
  adminMutation,
  employeeAuthedQuery,
  employeeAuthedMutation,
} from "./lib/customFunctions";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  isoTimeToTRMinutes,
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

export type CardReadingListPage = PaginationResult<Awaited<ReturnType<typeof enrichReadingsForList>>[number]>;

type AuthedReadCtx = QueryCtx & { user: Doc<"users"> };

async function loadScopedCardReadings(
  ctx: AuthedReadCtx,
  opts: { limit: number; projectId?: Id<"projects">; projectIds?: Id<"projects">[] },
): Promise<Doc<"cardReadings">[]> {
  const allowed = await resolveProjectScope(ctx, opts.projectId);
  const projects = opts.projectIds ? allowed.filter(id => opts.projectIds?.includes(id)) : allowed;
  const results = await Promise.all(projects.map(projectId =>
    ctx.db.query("cardReadings")
      .withIndex("by_project_access_time", q => q.eq("projectId", projectId))
      .order("desc").take(opts.limit),
  ));
  return results.flat().sort((a, b) => b.accessTime.localeCompare(a.accessTime)).slice(0, opts.limit);
}

/** Kayıt okuyucusunun seçili projedeki son atanmamış kartı. */
export const getLastUnknownByDevice = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    deviceId: v.id("devices"),
    sinceTime: v.optional(v.string()),
  },
  returns: v.union(v.object({ cardNo: v.string(), accessTime: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const allowed = await resolveProjectScope(ctx, args.projectId);
    const device = await ctx.db.get(args.deviceId);
    if (!device?.projectId || !allowed.includes(device.projectId)) return null;
    const reading = await ctx.db.query("cardReadings")
      .withIndex("by_project_device_employee_time", q => {
        const prefix = q.eq("projectId", device.projectId).eq("deviceId", args.deviceId).eq("employeeId", undefined);
        return args.sinceTime ? prefix.gt("accessTime", args.sinceTime) : prefix;
      }).order("desc").first();
    return reading ? { cardNo: reading.cardNo, accessTime: reading.accessTime } : null;
  },
});

export const list = authedQuery({
  args: {
    projectId: v.id("projects"),
    deviceId: v.optional(v.id("devices")),
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    accessFilter: v.optional(v.union(v.literal("all"), v.literal("granted"), v.literal("denied"))),
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const result = await scopedCardReadingQuery(ctx, args).order("desc").paginate(args.paginationOpts);
    return { ...result, page: await enrichReadingsForList(ctx, result.page) };
  },
});

/** Each cursor consumes at most 200 candidates; residual filters may leave an empty page. */
export const listFiltered = authedQuery({
  args: {
    projectId: v.id("projects"),
    deviceId: v.optional(v.id("devices")),
    employeeId: v.optional(v.id("employees")),
    doorId: v.optional(v.id("doors")),
    result: v.optional(v.union(v.literal("granted"), v.literal("denied"), v.literal("unknown"))),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const bounds = cardReadingDateBounds(args.startDate, args.endDate);
    const door = args.doorId ? await ctx.db.get(args.doorId) : null;
    if (args.doorId && (!door || door.projectId !== args.projectId || !door.deviceId || door.ioId === undefined)) {
      throw new ConvexError("Bu kapı seçili projede bir IDE okuyucusuyla eşleşmiyor");
    }
    if (door?.deviceId && args.deviceId && door.deviceId !== args.deviceId) {
      throw new ConvexError("Seçili kapı bu cihaza bağlı değil");
    }
    const deviceId = door?.deviceId ?? args.deviceId;
    if (deviceId) {
      const device = await ctx.db.get(deviceId);
      if (device?.projectId !== args.projectId) throw new ConvexError("Cihaz seçili projede bulunamadı");
    }
    if (args.employeeId) {
      const employee = await ctx.db.get(args.employeeId);
      if (employee?.projectId !== args.projectId) throw new ConvexError("Kişi seçili projede bulunamadı");
    }
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) {
      throw new ConvexError("Sayfa boyutu pozitif bir tam sayı olmalı");
    }
    const status = args.result === "granted" ? "izin_verildi" : args.result === "denied" ? "reddedildi" : undefined;
    const query = ctx.db.query("cardReadings");
    const indexed = (() => {
      if (door && deviceId && door.ioId !== undefined) return query.withIndex("by_device_io_time", q => {
        const prefix = q.eq("deviceId", deviceId).eq("ideIoId", door.ioId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      if (args.employeeId && deviceId) return query.withIndex("by_project_device_employee_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("deviceId", deviceId).eq("employeeId", args.employeeId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      if (args.employeeId) return query.withIndex("by_project_employee_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("employeeId", args.employeeId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      if (deviceId && args.result !== undefined) return query.withIndex("by_project_device_status_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("deviceId", deviceId).eq("accessStatus", status);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      if (args.result !== undefined) return query.withIndex("by_project_status_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("accessStatus", status);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      return scopedCardReadingQuery(ctx, { ...args, deviceId });
    })();
    const page = await indexed.order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.min(args.paginationOpts.numItems, 200),
      maximumRowsRead: 200,
    });
    const matching = page.page.filter(row =>
      row.projectId === args.projectId
      && (args.employeeId === undefined || row.employeeId === args.employeeId)
      && matchesReadingResult(row.accessStatus, args.result),
    );
    return {
      ...page,
      page: await enrichReadingsForList(ctx, matching),
      scannedCount: page.page.length,
      filterScope: "candidatePage" as const,
    };
  },
});

/** Intake-day snapshot and bounded reconnect catch-up, independent of device event time. */
export const listLiveSince = authedQuery({
  args: {
    projectId: v.id("projects"),
    afterCreationTime: v.optional(v.number()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 500) {
      throw new ConvexError("Canlı kayıt sınırı 1–500 arasında tam sayı olmalı");
    }
    if (args.afterCreationTime !== undefined && (!Number.isFinite(args.afterCreationTime) || args.afterCreationTime < 0)) {
      throw new ConvexError("Geçersiz canlı kayıt işaretçisi");
    }
    const today = trTodayKey();
    const dayStart = Date.parse(trDayRangeISO(today, today).startISO);
    const readings = await ctx.db.query("cardReadings")
      // Convex appends _creationTime to every index, including by_project.
      .withIndex("by_project", q => {
        const prefix = q.eq("projectId", args.projectId);
        return args.afterCreationTime === undefined
          ? prefix.gte("_creationTime", dayStart)
          : prefix.gt("_creationTime", args.afterCreationTime);
      }).order("desc").take(args.limit + 1);
    const window = liveReadingWindow(readings, args.limit, args.afterCreationTime);
    return { ...window, rows: await enrichReadingsForList(ctx, window.rows) };
  },
});

/** Null deliberately covers missing, unscoped and inaccessible direct links alike. */
export const getReading = authedQuery({
  args: { readingId: v.id("cardReadings") },
  handler: async (ctx, args) => {
    const reading = await ctx.db.get(args.readingId);
    if (!reading?.projectId) return null;
    const allowed = await resolveProjectScope(ctx);
    if (!allowed.includes(reading.projectId)) return null;
    const [enriched] = await enrichReadingsForList(ctx, [reading]);
    return enriched ?? null;
  },
});

export const assignCardFromReading = adminMutation({
  args: {
    readingId: v.id("cardReadings"),
    employeeId: v.id("employees"),
    expectedCurrentCard: v.union(v.string(), v.null()),
  },
  returns: v.object({ employeeId: v.id("employees"), cardNumber: v.string(), syncStatus: v.union(v.literal("pending"), v.literal("notRequested"), v.literal("noTargets")) }),
  handler: async (ctx, args): Promise<{ employeeId: Id<"employees">; cardNumber: string; syncStatus: "pending" | "notRequested" | "noTargets" }> => {
    const reading = await ctx.db.get(args.readingId);
    const allowed = await resolveProjectScope(ctx);
    if (!reading?.projectId || !allowed.includes(reading.projectId)) {
      throw new ConvexError({ code: "READING_NOT_FOUND", message: ASSIGN_CARD_ERRORS.READING_NOT_FOUND });
    }
    const employee = await ctx.db.get(args.employeeId);
    if (!employee || !employee.projectId || !allowed.includes(employee.projectId)) {
      throw new ConvexError({ code: "EMPLOYEE_NOT_FOUND", message: ASSIGN_CARD_ERRORS.EMPLOYEE_NOT_FOUND });
    }
    const preconditions = {
      reading,
      employeeProjectId: employee.projectId,
      employeeIsActive: employee.isActive,
      currentCard: employee.cardNumber ?? null,
      expectedCurrentCard: args.expectedCurrentCard,
      duplicate: false,
    };
    const initialError = assignmentPrecondition(preconditions);
    if (initialError) throw new ConvexError({ code: initialError, message: ASSIGN_CARD_ERRORS[initialError] });
    // Same global exact-string by_card rule as employees.findDuplicateEmployee.
    // Two candidates suffice: at most one can be this employee, any other is a conflict.
    const cardOwners = await ctx.db.query("employees")
      .withIndex("by_card", q => q.eq("cardNumber", reading.cardNo)).take(2);
    const error = assignmentPrecondition({ ...preconditions, duplicate: cardOwners.some(owner => owner._id !== employee._id) });
    if (error) throw new ConvexError({ code: error, message: ASSIGN_CARD_ERRORS[error] });

    const targets = employee.cardNumber === reading.cardNo ? null : await getEmployeeTargetDevices(ctx, employee, {
      membershipLimit: 101, linkLimit: 201, activeOnly: true,
    });
    const hasNoTargets = targets !== null && !targets.truncated
      && !targets.devices.some(device => device.brand === "hikvision" || device.brand === "ide_smart");

    // A mutation-to-mutation call is a subtransaction. Keep the existing old-card
    // cleanup and Hik/IDE scheduling in employees.update, with no duplicate sync logic.
    const employeeId: Id<"employees"> = await ctx.runMutation(api.employees.update, {
      employeeId: employee._id,
      cardNumber: reading.cardNo,
    });
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: reading.projectId,
      action: "update",
      targetTable: "employees",
      targetId: employeeId,
      oldValue: { cardNumber: employee.cardNumber },
      newValue: { cardNumber: reading.cardNo, readingId: reading._id },
      note: "Canlı İzleme okumasından kart kişiye atandı; geçmiş okuma değiştirilmedi.",
    });
    return { employeeId, cardNumber: reading.cardNo, syncStatus: employee.cardNumber === reading.cardNo ? "notRequested" : hasNoTargets ? "noTargets" : "pending" };
  },
});

export const getRecentByProjects = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    projectIds: v.optional(v.array(v.id("projects"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 10), 100);
    const readings = await loadScopedCardReadings(ctx, { limit, projectId: args.projectId, projectIds: args.projectIds });
    return await enrichWithDeviceName(ctx, readings);
  },
});

function scopedPdksShift(shift: Doc<"shifts"> | null, projectId?: Id<"projects">) {
  return projectId && shift?.projectId !== projectId ? null : shift;
}

export const getPdksTableData = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
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
        v.literal("overtime"),
        v.literal("weekend"),
        v.literal("holiday"),
        v.literal("future"),
        v.literal("noData")
      )
    ),
    person: v.optional(v.string()),
    viewMode: v.optional(v.union(v.literal("single"), v.literal("matrix"))),
    includePunches: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

    const today = args.date ?? trTodayKey();
    const startDate = args.startDate ?? today;
    const endDate = args.endDate ?? today;
    const { startISO, endISO } = trDayRangeISO(startDate, endDate);
    const isSingleDay = startDate === endDate;
    const viewMode = args.viewMode ?? "single";

    let readings;
    let employees: Doc<"employees">[];
    if (ctx.user.role === "super_admin" && !args.projectId) {
      [readings, employees] = await Promise.all([
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time", (q) =>
            q.gte("accessTime", startISO).lte("accessTime", endISO)
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
              .withIndex("by_project_access_time", (q) =>
                q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO)
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
      const term = args.person.trim().toLocaleLowerCase("tr-TR");
      employees = employees.filter((e) =>
        `${e.firstName} ${e.lastName}`.toLocaleLowerCase("tr-TR").includes(term)
      );
    }

    readings = filterPdksReadings(readings, args.projectId);

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const empById = new Map<string, Doc<"employees">>();
    for (const emp of employees) {
      empById.set(String(emp._id), emp);
    }
    const employeeMap = buildPdksEmployeeReadingMap({ employees, readings });

    // Settings & holidays per project (super_admin için global = undefined)
    const referenceProjectId = args.projectId ?? (
      ctx.user.role === "super_admin" && !args.projectId
        ? undefined
        : allowedProjectIds[0] ?? undefined);
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
    const periodEmployees = Array.from(employeeMap.keys())
      .map((empKey) => empById.get(empKey))
      .filter((emp): emp is NonNullable<typeof emp> => emp !== undefined);
    const recsByEmployee = await Promise.all(
      periodEmployees.map((emp) =>
        ctx.db
          .query("pdksRecords")
          .withIndex("by_employee_date", (q) =>
            q.eq("employeeId", emp._id).gte("date", startDate).lte("date", endDate)
          )
          .collect()
      )
    );
    for (const recs of recsByEmployee) {
      for (const r of recs) {
        if (r.manualEntry && (!args.projectId || r.projectId === args.projectId)) {
          manualPdksByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
        }
      }
    }

    // Yalnız dönemle kesişen onaylı izinler (gün eşleşmesi pdksTable'da).
    const allLeaves = (
      await ctx.db
        .query("leaves")
        .withIndex("by_status", (q) => q.eq("status", "approved"))
        .collect()
    ).filter((l) => (!args.projectId || !l.projectId || l.projectId === args.projectId) && l.startDate <= endDate && l.endDate >= startDate);

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
          includePunches: args.includePunches,
          manualPdksByEmpDate,
          allLeaves,
          holidayMap,
          workingDays,
          workSettings,
          overtimeRates,
          resolveShift: (employeeId, dateISO) => {
            const shift = shiftResolver.resolve(employeeId, dateISO);
            return args.projectId && shift?.projectId !== args.projectId ? null : shift;
          },
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
    projectId: v.optional(v.id("projects")),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);
    const { startISO, endISO } = trDayRangeISO(args.startDate, args.endDate);

    let readings;
    if (ctx.user.role === "super_admin" && !args.projectId) {
      readings = await ctx.db
        .query("cardReadings")
        .withIndex("by_access_time", q => q.gte("accessTime", startISO).lte("accessTime", endISO))
        .collect();
    } else if (allowedProjectIds.length > 0) {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("cardReadings")
            .withIndex("by_project_access_time", q => q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO))
            .collect()
        )
      );
      readings = results.flat();
    } else {
      return emptyPdksChartData();
    }

    readings = filterPdksReadings(readings, args.projectId);

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const chartProjectId = args.projectId ?? (
      ctx.user.role === "super_admin" && !args.projectId
        ? undefined
        : allowedProjectIds[0] ?? undefined);
    const chartSettings = await getEffectiveWorkSettings(ctx, chartProjectId);

    const chartEmployees =
      ctx.user.role === "super_admin" && !args.projectId
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
      resolveShift: (employeeId, dateISO) => {
        const shift = chartShiftResolver.resolve(employeeId, dateISO);
        return args.projectId && shift?.projectId !== args.projectId ? null : shift;
      },
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
    projectId: v.optional(v.id("projects")),
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

    if (!Number.isInteger(args.year) || args.year < 1000 || args.year > 9999 || !Number.isInteger(args.month) || args.month < 1 || args.month > 12) {
      throw new Error("Geçerli bir yıl ve ay seçin");
    }
    const monthStr = String(args.month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();
    const startDate = `${args.year}-${monthStr}-01`;
    const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const { startISO, endISO } = trDayRangeISO(startDate, endDate);

    let readings;
    let employees: Doc<"employees">[];
    if (ctx.user.role === "super_admin" && !args.projectId) {
      [readings, employees] = await Promise.all([
        ctx.db
          .query("cardReadings")
          .withIndex("by_access_time", q => q.gte("accessTime", startISO).lte("accessTime", endISO))
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
              .withIndex("by_project_access_time", q => q.eq("projectId", pid).gte("accessTime", startISO).lte("accessTime", endISO))
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

    readings = filterPdksReadings(readings, args.projectId);

    const referenceProjectId = args.projectId ?? (
      ctx.user.role === "super_admin" && !args.projectId
        ? undefined
        : allowedProjectIds[0] ?? undefined);
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
        if (r.manualEntry && (!args.projectId || r.projectId === args.projectId)) manualByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
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
      const dateKey = trDateKey(r.accessTime);
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
                (!args.projectId || !l.projectId || l.projectId === args.projectId) &&
                d >= l.startDate &&
                d <= l.endDate
            ),
            holiday: holidayMap.get(d),
            workingDays,
            dayShift: scopedPdksShift(payrollShiftResolver.resolve(emp._id, d), args.projectId),
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
      const dayShift = dayShiftResolver.resolve(employee._id, trDateKey(accessTime));
      const { lateThresholdMin } = thresholdsForShift(dayShift, settings);
      const isLate = isoTimeToTRMinutes(accessTime) > lateThresholdMin;
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
    projectId: v.optional(v.id("projects")),
    employeeId: v.id("employees"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

    const employee = await ctx.db.get(args.employeeId);
    if (!employee || (args.projectId && employee.projectId !== args.projectId)) return null;

    // Projesiz (orphan) çalışan yalnız super_admin'e açıktır.
    if (
      ctx.user.role !== "super_admin" &&
      (!employee.projectId || !allowedProjectIds.includes(employee.projectId))
    ) {
      return null;
    }

    const { startISO, endISO } = trDayRangeISO(args.startDate, args.endDate);

    let readings = args.projectId
      ? (await ctx.db.query("cardReadings")
          .withIndex("by_project_access_time", q => q.eq("projectId", args.projectId).gte("accessTime", startISO).lte("accessTime", endISO))
          .collect()).filter(reading => reading.employeeId === args.employeeId)
      : await ctx.db
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

    readings = filterPdksReadings(readings, args.projectId);

    readings.sort(
      (a, b) =>
        new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const referenceProjectId = args.projectId ?? (
      ctx.user.role === "super_admin" && !args.projectId ? undefined : employee.projectId);
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
      if (m.manualEntry && (!args.projectId || m.projectId === args.projectId)) manualByDate.set(m.date, m);
    }

    const periodDateKeys = buildPeriodDateKeys(args.startDate, args.endDate);

    const readingsByDate = new Map<string, typeof readings>();
    for (const r of readings) {
      const dk = trDateKey(r.accessTime);
      if (!readingsByDate.has(dk)) readingsByDate.set(dk, []);
      readingsByDate.get(dk)!.push(r);
    }

    const days = periodDateKeys.map((dk) =>
      computeAttendanceDetailDay({
        date: dk,
        dayReadings: readingsByDate.get(dk) ?? [],
        manualDay: manualByDate.get(dk),
        leaves: leaves.filter(l => !args.projectId || !l.projectId || l.projectId === args.projectId),
        holiday: holidayMap.get(dk),
        dayShift: scopedPdksShift(detailShiftResolver.resolve(employee._id, dk), args.projectId),
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

    // Cihaz zamanı (+03:00 vb.) UTC Z'ye: aralık sorguları ve index sırası string karşılaştırır.
    // Geçersizse atla — tarihsel olayı "şimdi" ile yazmak PDKS'te yanlış güne düşürür.
    const eventTime = toUtcISO(args.event.time);
    if (!eventTime) {
      return { inserted: false, reason: "invalid-time" };
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
        eventTime,
        category: event.category,
        severity: event.severity,
        label: event.label,
        major: args.event.major,
        minor: args.event.minor,
        cardNo: cardNo || undefined,
        rawData: rawData.length > 10000 ? rawData.slice(0, 10000) : rawData,
        hikDevIndex: device.hikDevIndex,
        hikSerialNo: args.event.serialNo,
        createdAt: eventTime,
        updatedAt: eventTime,
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
      accessTime: eventTime,
      accessStatus,
      hikMajorEventType: args.event.major,
      hikSubEventType: args.event.minor,
      hikCurrentVerifyMode: args.event.currentVerifyMode,
      hikSerialNo: args.event.serialNo,
      hikDevIndex: device.hikDevIndex,
      hikPictureURL: args.event.pictureURL,
      hikDateTime: args.event.time,
      hikDenialReason: denialReason,
      createdAt: eventTime,
      updatedAt: eventTime,
    });

    return { inserted: true };
  },
});

/** Each cursor scans at most 200 candidates; biometric readings never become report rows. */
export const listReportTransactions = authedQuery({
  args: {
    projectId: v.id("projects"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    result: v.optional(v.union(v.literal("granted"), v.literal("denied"), v.literal("unknown"))),
    sources: v.optional(v.array(v.union(v.literal("card"), v.literal("pin"), v.literal("qr"), v.literal("mobile"), v.literal("manual"), v.literal("unknown")))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const bounds = cardReadingDateBounds(args.startDate, args.endDate);
    if (args.employeeId) {
      const employee = await ctx.db.get(args.employeeId);
      if (employee?.projectId !== args.projectId) throw new ConvexError("Kişi seçili projede bulunamadı");
    }
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) {
      throw new ConvexError("Sayfa boyutu pozitif bir tam sayı olmalı");
    }
    const status = args.result === "granted" ? "izin_verildi" : args.result === "denied" ? "reddedildi" : undefined;
    const query = ctx.db.query("cardReadings");
    const indexed = (() => {
      if (args.employeeId) return query.withIndex("by_project_employee_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("employeeId", args.employeeId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      if (status !== undefined) return query.withIndex("by_project_status_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("accessStatus", status);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      return scopedCardReadingQuery(ctx, args);
    })();
    const page = await indexed.order("desc").paginate({
      ...args.paginationOpts,
      numItems: args.sources?.length ? 1000 : Math.min(args.paginationOpts.numItems, 200),
      maximumRowsRead: args.sources?.length ? 1000 : 200,
    });
    const matching = page.page.filter(row =>
      row.projectId === args.projectId
      && (args.employeeId === undefined || row.employeeId === args.employeeId)
      && matchesReadingResult(row.accessStatus, args.result),
    );
    const { eligible, hiddenBiometricCount } = splitPdksEligible(matching);
    const sourceMatching = eligible.filter(row => matchesReadingSources(classifyReadingSource(row), args.sources));
    const enriched = await enrichReadingsForList(ctx, sourceMatching);
    return {
      ...page,
      page: enriched.map(toReportTransactionRow),
      scannedCount: page.page.length,
      hiddenBiometricCount,
    };
  },
});
