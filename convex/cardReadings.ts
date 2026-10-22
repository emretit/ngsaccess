import { loadPdksPolicies } from "./lib/pdksRules";
import { employedDuring, employedOn } from "./lib/employment";
import { genericReaderTokenAllowed } from "./lib/mobileAccess";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { canSeePay } from "./lib/payVisibility";
import { classifyReadingSource, countExcludedUnknownPdksReadings, filterPdksReadings } from "./lib/pdksSource";
import { matchesReadingSources, toReportTransactionRow } from "./lib/reportAttendance";
import { paginationOptsValidator, type PaginationResult } from "convex/server";
import { resolveProjectScope } from "./lib/projectScope";
import { cardReadingDateBounds, scopedCardReadingQuery } from "./lib/cardReadingList";
import { assignmentPrecondition, ASSIGN_CARD_ERRORS, liveReadingSource, liveReadingWindow, matchesReadingResult } from "./lib/liveReadings";
import { getEmployeeTargetDevices } from "./lib/peopleHikSnapshot";
import { writeAudit } from "./lib/audit";
import { isFreshAlarmEvent, notifyAlarmIfNeeded } from "./lib/alarmNotify";
import { toUtcISO, trDateKey, trTodayKey, trDayRangeISO } from "./lib/trDate";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import {
  authedQuery,
  adminMutation,
  employeeAuthedQuery,
  employeeAuthedMutation,
} from "./lib/customFunctions";
import type { Doc, Id } from "./_generated/dataModel";
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
import { calculatePeriodOvertime, overtimePeriodRange } from "./lib/overtimeCalc";
import { inferAccessStatus, inferDenialReason } from "./lib/hikEventCodes";
import {
  classifyHikEvent,
  shouldCreateCardReadingForHikEvent,
} from "./lib/hikEventCatalog";
import { ideResultGranted } from "./lib/cardReaderParse";
import { canEmployeeAccessDevice } from "./lib/accessDecision";
import {
  buildPeriodDateKeys,
  formatHoursLabel,
} from "./lib/pdksCalc";
import {
  enrichReadingsForList,
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
import { addWorkDate, buildPdksWorkDateResolver, groupPdksWorkDays, hasFlexiblePdksShift, pdksWorkDayRange } from "./lib/pdksWorkDay";
import {
  buildPdksEmployeeReadingMap,
  computePdksTableRow,
  filterPdksTableRows,
} from "./lib/pdksTable";
import { pdksAvailableDatesByProject, pdksManualDatesByEmployee, pdksLeaveMatchesProject, readPdksAvailableDateKeys, pdksFirstRecordDate } from "./lib/pdksAvailability";

export type CardReadingListPage = PaginationResult<Awaited<ReturnType<typeof enrichReadingsForList>>[number]>;

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

const monitoringSource = v.union(v.literal("card"), v.literal("qr"), v.literal("mobile"), v.literal("biometric"));

/** Bounded person picker for monitoring filters and card assignment. */
export const searchMonitoringPeople = authedQuery({
  args: { projectId: v.id("projects"), search: v.string(), selectedId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const term = args.search.trim().slice(0, 100);
    const people = term
      ? (await Promise.all([
          ctx.db.query("employees").withSearchIndex("search_first_name", q => q.search("firstName", term).eq("projectId", args.projectId)).take(20),
          ctx.db.query("employees").withSearchIndex("search_last_name", q => q.search("lastName", term).eq("projectId", args.projectId)).take(20),
        ])).flat()
      : await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(20);
    const selectedId = args.selectedId ? ctx.db.normalizeId("employees", args.selectedId) : null;
    const selected = selectedId ? await ctx.db.get(selectedId) : null;
    if (selected?.projectId === args.projectId) people.push(selected);
    return [...new Map(people.filter(person => person.isVisitor !== true).map(person => [person._id, person])).values()].slice(0, 41).map(person => ({
      _id: person._id, firstName: person.firstName, lastName: person.lastName,
      cardNumber: person.cardNumber, isActive: person.isActive,
    }));
  },
});

/** Last received reading, including days before today's live window. */
export const lastMonitoringReading = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const row = await ctx.db.query("cardReadings").withIndex("by_project", q => q.eq("projectId", args.projectId)).order("desc").first();
    return row ? { accessTime: row.accessTime } : null;
  },
});

/** Scan until the requested matches are found or the bounded read budget is exhausted. */
export const listFiltered = authedQuery({
  args: {
    projectId: v.id("projects"),
    source: v.optional(monitoringSource),
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
    const query = stream(ctx.db, schema).query("cardReadings");
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
      if (deviceId) return query.withIndex("by_project_device_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("deviceId", deviceId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      return query.withIndex("by_project_access_time", q => {
        const prefix = q.eq("projectId", args.projectId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
    })();
    let scannedCount = 0;
    // filterWith runs JS classification inside the stream, before pagination. Its
    // cursor advances over rejected rows too; no native paginate loop is needed.
    const page = await indexed.order("desc").filterWith(async row => {
      scannedCount += 1;
      return row.projectId === args.projectId
        && (args.employeeId === undefined || row.employeeId === args.employeeId)
        && matchesReadingResult(row.accessStatus, args.result)
        && (args.source === undefined || liveReadingSource(row) === args.source);
    }).paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 200), maximumRowsRead: 2000, maximumBytesRead: 2_000_000 });
    return {
      ...page,
      page: await enrichReadingsForList(ctx, page.page),
      scannedCount,
      matchedCount: page.page.length,
      scanLimitReached: page.pageStatus === "SplitRequired",
      filterScope: "boundedScan" as const,
    };
  },
});

/** Intake-day snapshot and bounded reconnect catch-up, independent of device event time. */
export const listLiveSince = authedQuery({
  args: {
    projectId: v.id("projects"),
    source: v.optional(monitoringSource),
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
    let scannedCount = 0;
    let latestCreationTime = args.afterCreationTime ?? null;
    const page = await stream(ctx.db, schema).query("cardReadings")
      .withIndex("by_project", q => {
        const prefix = q.eq("projectId", args.projectId);
        return args.afterCreationTime === undefined
          ? prefix.gte("_creationTime", dayStart)
          : prefix.gt("_creationTime", args.afterCreationTime);
      }).order("desc").filterWith(async row => {
        scannedCount += 1;
        latestCreationTime = Math.max(latestCreationTime ?? 0, row._creationTime);
        return args.source === undefined || liveReadingSource(row) === args.source;
      }).paginate({ cursor: null, numItems: args.limit + 1, maximumRowsRead: 2000, maximumBytesRead: 2_000_000 });
    const window = liveReadingWindow(page.page, args.limit, args.afterCreationTime);
    return {
      ...window,
      latestCreationTime,
      hasMore: window.hasMore || !page.isDone,
      rows: await enrichReadingsForList(ctx, window.rows),
      scannedCount,
      matchedCount: page.page.length,
      scanLimitReached: page.pageStatus === "SplitRequired",
    };
  },
});

/** Null deliberately covers missing, unscoped and inaccessible direct links alike. */
export const getReading = authedQuery({
  args: { readingId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("cardReadings", args.readingId);
    if (!id) return null;
    const reading = await ctx.db.get(id);
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

function scopedPdksShift(shift: Doc<"shifts"> | null, projectId?: Id<"projects">) {
  return projectId && shift?.projectId !== projectId && !(shift?.scheduleType === "flexible" && !shift.projectId) ? null : shift;
}

/** Only flexible scopes need the previous entry to attribute the first night's exit.
 * Keep the existing fixed queries and their ordering intact. */
async function flexiblePreviousReadings(
  ctx: QueryCtx, startDate: string, projectIds: readonly Id<"projects">[] | undefined,
  employee?: Doc<"employees">,
) {
  const previousDate = addWorkDate(startDate, -1);
  const { startISO, endISO } = trDayRangeISO(previousDate, previousDate);
  const limit = 20000;
  let lists: Doc<"cardReadings">[][];
  if (employee) {
    lists = await Promise.all([employee._id, ...(employee.cardNumber ? [undefined] : [])].map(employeeId => ctx.db.query("cardReadings")
      .withIndex("by_project_employee_time", q => q.eq("projectId", employee.projectId).eq("employeeId", employeeId).gte("accessTime", startISO).lte("accessTime", endISO)).take(limit + 1)));
  } else if (projectIds) {
    lists = await Promise.all(projectIds.map(projectId => ctx.db.query("cardReadings")
      .withIndex("by_project_access_time", q => q.eq("projectId", projectId).gte("accessTime", startISO).lte("accessTime", endISO)).take(limit + 1)));
  } else {
    lists = [await ctx.db.query("cardReadings").withIndex("by_access_time", q => q.gte("accessTime", startISO).lte("accessTime", endISO)).take(limit + 1)];
  }
  if (lists.some(list => list.length > limit) || lists.flat().length > limit) throw new Error("Esnek vardiya önceki gün okuma sınırı aşıldı; proje kapsamını daraltın");
  return lists.flat().filter(reading => !employee || reading.employeeId === employee._id || !reading.employeeId && reading.cardNo === employee.cardNumber);
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
        v.literal("noData"),
        v.literal("notEmployed"),
        v.literal("incomplete")
      )
    ),
    person: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    viewMode: v.optional(v.union(v.literal("single"), v.literal("matrix"))),
    includePunches: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const payVisible = canSeePay(ctx.user);
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

    const today = args.date ?? trTodayKey();
    const startDate = args.startDate ?? today;
    const endDate = args.endDate ?? today;
    const referenceProjectId = args.projectId ?? (
      ctx.user.role === "super_admin" && !args.projectId
        ? undefined
        : allowedProjectIds[0] ?? undefined);
    const overtimeRates = await getEffectiveOvertimeRates(ctx, referenceProjectId);
    const overtimeRange = overtimePeriodRange(startDate, endDate, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
    const { startISO, endISO } = pdksWorkDayRange(overtimeRange.startDate, overtimeRange.endDate);
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
              .collect()
          )
        ),
      ]);
      readings = readingResults.flat();
      employees = empResults.flat();
    } else {
      return [];
    }

    employees = employees.filter(employee => employedDuring(employee, startDate, endDate));
    const availabilityEmployees = employees;
    if (args.employeeId) employees = employees.filter(e => e._id === args.employeeId);

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

    const tableBoundaryShiftResolver = await buildShiftResolver(ctx, availabilityEmployees);
    const tableHasFlexible = [...tableBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
    if (tableHasFlexible) readings = [...await flexiblePreviousReadings(ctx, overtimeRange.startDate, ctx.user.role === "super_admin" && !args.projectId ? undefined : allowedProjectIds), ...readings];
    const sourceReadings = readings;
    const earlyTableRecords = tableHasFlexible ? await Promise.all(availabilityEmployees.map(emp => ctx.db.query("pdksRecords")
      .withIndex("by_employee_date", q => q.eq("employeeId", emp._id).gte("date", addWorkDate(overtimeRange.startDate, -1)).lte("date", addWorkDate(overtimeRange.endDate, 1))).take(1001))) : undefined;
    if (earlyTableRecords?.some(records => records.length > 1000)) throw new Error("Manuel kayıt sınırı aşıldı; tarih aralığını daraltın");
    const tableBoundaryManual = new Map((earlyTableRecords ?? []).flat().filter(record => record.manualEntry && (!args.projectId || record.projectId === args.projectId)).map(record => [`${record.employeeId}__${record.date}`, record]));
    const tableBoundaryWorkDate = buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: sourceReadings, manualEntryFor: (id, date) => tableBoundaryManual.get(`${id}__${date}`)?.entryTime, eligibleEntry: r => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, trDateKey(candidate.accessTime))).length > 0 });
    const policies = await loadPdksPolicies(ctx, availabilityEmployees.map(e => e.projectId), tableHasFlexible ? addWorkDate(overtimeRange.startDate, -1) : overtimeRange.startDate, overtimeRange.endDate);
    readings = filterPdksReadings(readings, args.projectId, r => policies(r.projectId, tableBoundaryWorkDate(r)));

    readings.sort(
      (a, b) => new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const empById = new Map<string, Doc<"employees">>();
    for (const emp of employees) {
      empById.set(String(emp._id), emp);
    }
    const employeeMap = buildPdksEmployeeReadingMap({ employees, readings });

    // Settings & holidays per project (super_admin için global = undefined)
    const [workSettings, holidayMap, generalSettings, shiftResolver] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, overtimeRange.startDate, addWorkDate(overtimeRange.endDate, 1)),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        Promise.resolve(tableBoundaryShiftResolver),
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
    const recsByEmployee = earlyTableRecords ?? await Promise.all(
      periodEmployees.map((emp) =>
        ctx.db
          .query("pdksRecords")
          .withIndex("by_employee_date", (q) =>
            q.eq("employeeId", emp._id).gte("date", overtimeRange.startDate).lte("date", overtimeRange.endDate)
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

    const allLeaves = (await Promise.all(employees.map(emp => ctx.db.query("leaves")
      .withIndex("by_employee_start", q => q.eq("employeeId", emp._id).lte("startDate", endDate)).collect())))
      .flat().filter(l => l.status === "approved" && l.endDate >= startDate);

    const periodDateKeys = buildPeriodDateKeys(startDate, endDate);

    const tableDepartments = await Promise.all([...new Set(employees.flatMap(e => e.departmentId ? [e.departmentId] : []))].map(id => ctx.db.get(id)));
    const tableDeptById = new Map(tableDepartments.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [String(d._id), d]));

    const tableWorkDate = [...tableBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") ? buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(tableBoundaryShiftResolver.resolve(id, date), args.projectId), { readings, manualEntryFor: (id, date) => manualPdksByEmpDate.get(`${id}__${date}`)?.entryTime }) : tableBoundaryWorkDate;
    const tablePeriodDates = new Set(periodDateKeys);
    const sourceReadingsByEmployee = buildPdksEmployeeReadingMap({
      employees,
      readings: sourceReadings.filter(r => tablePeriodDates.has(tableWorkDate(r))),
    });
    const tableAvailableDates = pdksAvailableDatesByProject(readings, tableWorkDate);
    const tableManualDates = pdksManualDatesByEmployee(manualPdksByEmpDate.values());
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

        const firstRecordDate = employee ? await pdksFirstRecordDate(ctx, employee, empReadings, tableManualDates.get(employee._id) ?? [], tableWorkDate, policies) : null;
        const row = computePdksTableRow({
          policyFor: date => policies(employee?.projectId, date),
          availableDateKeys: tableAvailableDates.get(employee?.projectId) ?? new Set<string>(),
          firstRecordDate,
          empKey,
          empReadings,
          // Stored pay fields are optional numbers; absent inputs resolve to null pay.
          employee: employee ? {
            ...employee,
            hourlyRate: payVisible ? employee.hourlyRate : undefined,
            monthlySalary: payVisible ? employee.monthlySalary : undefined,
          } : null,
          departmentName: department?.projectId === employee?.projectId ? department?.name ?? "" : "",
          periodDateKeys: periodDateKeys.filter(date => !employee || employedOn(employee, date)),
          startDate,
          isSingleDay,
          viewMode,
          includePunches: args.includePunches,
          manualPdksByEmpDate,
          allLeaves: allLeaves.filter(l => l.employeeId === employee?._id && pdksLeaveMatchesProject(l, employee?.projectId)),
          holidayMap,
          workingDays,
          workSettings,
          overtimeRates,
          resolveShift: (employeeId, dateISO) => {
            const shift = shiftResolver.resolve(employeeId, dateISO);
            return scopedPdksShift(shift, args.projectId);
          },
          manualEditedBy: editor?.fullName ?? editor?.name ?? editor?.email ?? null,
        });
        return {
          ...row,
          excludedUnknownReadings: countExcludedUnknownPdksReadings(
            sourceReadingsByEmployee.get(empKey) ?? [],
            employee?.projectId,
          ),
        };
      })
    );

    // Status filtresi (frontend'den önce sunucu tarafında uygula)
    const filtered = filterPdksTableRows(tableData, args.statusFilter);

    return filtered.sort((a, b) => a.name.localeCompare(b.name, "tr"));
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
    const payVisible = canSeePay(ctx.user);
    const allowedProjectIds = await resolveProjectScope(ctx, args.projectId);

    if (!Number.isInteger(args.year) || args.year < 1000 || args.year > 9999 || !Number.isInteger(args.month) || args.month < 1 || args.month > 12) {
      throw new Error("Geçerli bir yıl ve ay seçin");
    }
    const monthStr = String(args.month).padStart(2, "0");
    const lastDay = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();
    const startDate = `${args.year}-${monthStr}-01`;
    const endDate = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const referenceProjectId = args.projectId ?? (
      ctx.user.role === "super_admin" && !args.projectId
        ? undefined
        : allowedProjectIds[0] ?? undefined);
    const overtimeRates = await getEffectiveOvertimeRates(ctx, referenceProjectId);
    const overtimeRange = overtimePeriodRange(startDate, endDate, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
    const { startISO, endISO } = pdksWorkDayRange(overtimeRange.startDate, overtimeRange.endDate);

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
              .collect()
          )
        ),
      ]);
      readings = readingResults.flat();
      employees = empResults.flat();
    } else {
      return { days: [], rows: [], year: args.year, month: args.month };
    }

    employees = employees.filter(employee => employedDuring(employee, startDate, endDate));
    const payrollBoundaryShiftResolver = await buildShiftResolver(ctx, employees);
    const payrollHasFlexible = [...payrollBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift(employees, (id, date) => scopedPdksShift(payrollBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
    if (payrollHasFlexible) readings = [...await flexiblePreviousReadings(ctx, overtimeRange.startDate, ctx.user.role === "super_admin" && !args.projectId ? undefined : allowedProjectIds), ...readings];
    const earlyPayrollRecords = payrollHasFlexible ? await ctx.db.query("pdksRecords")
      .withIndex("by_date", q => q.gte("date", addWorkDate(overtimeRange.startDate, -1)).lte("date", addWorkDate(overtimeRange.endDate, 1))).take(10001) : undefined;
    if (earlyPayrollRecords && earlyPayrollRecords.length > 10000) throw new Error("Manuel kayıt sınırı aşıldı; proje veya tarih aralığını daraltın");
    const payrollEmployeeIds = new Set(employees.map(employee => employee._id));
    const payrollBoundaryManual = new Map((earlyPayrollRecords ?? []).filter(record => payrollEmployeeIds.has(record.employeeId) && record.manualEntry && (!args.projectId || record.projectId === args.projectId)).map(record => [`${record.employeeId}__${record.date}`, record]));
    const payrollBoundaryWorkDate = buildPdksWorkDateResolver(employees, (id, date) => scopedPdksShift(payrollBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: readings, manualEntryFor: (id, date) => payrollBoundaryManual.get(`${id}__${date}`)?.entryTime, eligibleEntry: r => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, trDateKey(candidate.accessTime))).length > 0 });
    const policies = await loadPdksPolicies(ctx, employees.map(e => e.projectId), payrollHasFlexible ? addWorkDate(overtimeRange.startDate, -1) : overtimeRange.startDate, overtimeRange.endDate);
    readings = filterPdksReadings(readings, args.projectId, r => policies(r.projectId, payrollBoundaryWorkDate(r)));

    const [workSettings, holidayMap, generalSettings, payrollShiftResolver] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, overtimeRange.startDate, addWorkDate(overtimeRange.endDate, 1)),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        Promise.resolve(payrollBoundaryShiftResolver),
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

    const approvedLeaves = (await Promise.all(employees.map(emp => ctx.db.query("leaves")
      .withIndex("by_employee_start", q => q.eq("employeeId", emp._id).lte("startDate", endDate)).collect())))
      .flat().filter(l => l.status === "approved" && l.endDate >= startDate);

    // Manuel pdksRecords her çalışan için ay aralığı (batch: tek query, in-memory filter)
    const empIds = employees.map((e) => e._id);
    const empIdSet = new Set<string>(empIds.map((id) => String(id)));
    const manualByEmpDate = new Map<string, Doc<"pdksRecords">>();
    const allRecs = earlyPayrollRecords ?? await ctx.db
      .query("pdksRecords")
      .withIndex("by_date", (q) => q.gte("date", overtimeRange.startDate).lte("date", overtimeRange.endDate))
      .collect();
    const recs = allRecs.filter((r) => empIdSet.has(String(r.employeeId)));
    {
      for (const r of recs) {
        if (r.manualEntry && (!args.projectId || r.projectId === args.projectId)) manualByEmpDate.set(`${String(r.employeeId)}__${r.date}`, r);
      }
    }

    const payrollEmployeesById = new Map(employees.map(e => [String(e._id), e]));
    const payrollEmployeeReadings = buildPdksEmployeeReadingMap({ employees, readings });
    const payrollWorkDate = [...payrollShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") ? buildPdksWorkDateResolver(employees, (id, date) => scopedPdksShift(payrollShiftResolver.resolve(id, date), args.projectId), { readings, manualEntryFor: (id, date) => manualByEmpDate.get(`${id}__${date}`)?.entryTime }) : payrollBoundaryWorkDate;
    const payrollAvailableDates = pdksAvailableDatesByProject(readings, payrollWorkDate);
    const payrollManualDates = pdksManualDatesByEmployee(manualByEmpDate.values());
    const empDayReadings = new Map<string, Doc<"cardReadings">[]>();
    for (const [empId, employeeReadings] of payrollEmployeeReadings) {
      const employee = payrollEmployeesById.get(empId);
      if (!employee) continue;
      const byDay = groupPdksWorkDays(employeeReadings, employee._id, (id, date) => scopedPdksShift(payrollShiftResolver.resolve(id, date), args.projectId), (id, date) => manualByEmpDate.get(`${id}__${date}`)?.entryTime);
      for (const [date, dayReadings] of byDay) empDayReadings.set(`${empId}__${date}`, dayReadings);
    }

    const allDepartments = (await Promise.all([...new Set(employees.flatMap(e => e.departmentId ? [e.departmentId] : []))].map(id => ctx.db.get(id)))).filter((d): d is NonNullable<typeof d> => d !== null);
    const deptById = new Map(allDepartments.map((d) => [String(d._id), d]));

    const rows = await Promise.all(
      employees.map(async (emp) => {
        const department = emp.departmentId
          ? deptById.get(String(emp.departmentId)) ?? null
          : null;

        const empHourlyRate = payVisible ? resolveHourlyRate({
          hourlyRate: emp.hourlyRate,
          monthlySalary: emp.monthlySalary,
          monthlyHoursBase: workSettings.monthlyHoursBase,
        }) : null;

        const firstRecordDate = await pdksFirstRecordDate(ctx, emp, payrollEmployeeReadings.get(String(emp._id)) ?? [], payrollManualDates.get(emp._id) ?? [], payrollWorkDate, policies);
        const availableDateKeys = payrollAvailableDates.get(emp.projectId) ?? new Set<string>();
        const allCells = buildPeriodDateKeys(overtimeRange.startDate, overtimeRange.endDate).filter(date => employedOn(emp, date)).map((d) =>
          computePayrollCell({
            policyFor: date => policies(emp.projectId, date),
            availableDateKeys,
            firstRecordDate,
            date: d,
            manual: manualByEmpDate.get(`${emp._id}__${d}`),
            dayReadings: empDayReadings.get(`${emp._id}__${d}`) ?? [],
            hasLeave: approvedLeaves.some(
              (l) =>
                l.employeeId === emp._id &&
                pdksLeaveMatchesProject(l, emp.projectId) &&
                d >= l.startDate &&
                d <= l.endDate
            ),
            holiday: holidayMap.get(d),
            holidayMap,
            workingDays,
            dayShift: scopedPdksShift(payrollShiftResolver.resolve(emp._id, d), args.projectId),
            workSettings,
            overtimeRates,
            empHourlyRate,
          })
        );

        const periodOvertime = calculatePeriodOvertime(allCells, {
          startDate, endDate, overtimeBasis: overtimeRates.overtimeBasis,
          hourlyRate: empHourlyRate,
        });
        const cells = allCells.filter((c) => c.date >= startDate && c.date <= endDate)
          .map(({ overtimeSegments: _segments, ...cell }) => {
            const overtime = periodOvertime.overtimeByDate[cell.date];
            return { ...cell, overtimeMinutes: overtime?.overtimeMinutes ?? 0,
              overtimePayTRY: overtime?.overtimePayTRY ?? null,
              multiplier: overtime?.overtimeMultiplier ?? 0 };
          });

        const totals = cells.reduce(
          (acc, c) => {
            acc.totalMinutes += c.totalMinutes;
            if (c.payrollCode === "İZN") acc.leaveDays += 1;
            if (c.status === "incomplete") acc.incompleteDays += 1;
            if (c.payrollCode === "DV") acc.absentDays += 1;
            if (c.isLate && c.status !== "incomplete") acc.lateDays += 1;
            return acc;
          },
          {
            totalMinutes: 0,
            leaveDays: 0,
            incompleteDays: 0,
            absentDays: 0,
            lateDays: 0,
          }
        );

        const { incompleteDays, ...legacyTotals } = totals;
        return {
          employeeId: emp._id,
          payrollCode: emp.payrollCode ?? "",
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          cardNumber: emp.cardNumber,
          department: department?.projectId === emp.projectId ? department?.name ?? "Departmansız" : "Departmansız",
          hourlyRate: empHourlyRate,
          cells,
          totals: {
            ...legacyTotals,
            ...(cells.some(c => c.durationMeasured !== undefined) ? { incompleteDays } : {}),
            overtimeMinutes: periodOvertime.overtimeMinutes,
            overtimePayTRY: periodOvertime.overtimePayTRY,
            exceedsDaily11h: periodOvertime.exceedsDaily11h,
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

    // Reader credentials must never be misinterpreted as native IDE/Hik card identifiers.
    const isReaderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.cardNo);
    if (isReaderUuid && (!args.authedDeviceId || device?.brand === "ide_smart" || device?.brand === "hikvision")) return { granted: false };

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

    // Reader-purpose UUIDs can only be consumed by authenticated generic readers.
    const isToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.cardNo);
    if (isToken) {
      const tokenRow = await ctx.db.query("checkInTokens")
        .withIndex("by_token", q => q.eq("token", args.cardNo)).first();
      const now = Date.now();
      if (!device || !tokenRow || tokenRow.purpose !== "reader" || tokenRow.usedAt ||
          !Number.isFinite(Date.parse(tokenRow.expiresAt)) || Date.parse(tokenRow.expiresAt) <= now) return { granted: false };
      const session = tokenRow.sessionId ? await ctx.db.get(tokenRow.sessionId) : null;
      if (!session || session.employeeId !== tokenRow.employeeId ||
          !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now ||
          (session.passwordVersion ?? 0) !== tokenRow.authVersion) return { granted: false };
      const tokenEmployee = await ctx.db.get(tokenRow.employeeId);
      if (!tokenEmployee || tokenRow.projectId !== tokenEmployee.projectId || tokenRow.projectId !== device.projectId) return { granted: false };
      const auth = await ctx.db.query("employeeAuth")
        .withIndex("by_employee", q => q.eq("employeeId", tokenEmployee._id)).first();
      if (!auth?.passwordHash || tokenRow.authVersion !== (auth.passwordVersion ?? 0) ||
          !(await genericReaderTokenAllowed(ctx, tokenEmployee, device, now))) return { granted: false };
      const consumedAt = new Date(now).toISOString();
      const employeeName = `${tokenEmployee.firstName} ${tokenEmployee.lastName}`;
      await ctx.db.patch(tokenRow._id, { usedAt: consumedAt, employeeName, locationRecorded: false });
      const direction = await resolveDirection(ctx, { device, employeeId: tokenEmployee._id, nowISO: consumedAt });
      await ctx.db.insert("cardReadings", {
        projectId: device.projectId, deviceId: device._id, employeeId: tokenEmployee._id,
        cardNo: tokenEmployee.cardNumber, employeeName, accessTime: consumedAt,
        accessStatus: "izin_verildi", direction, rawData: JSON.stringify({ source: "qr", protocol: "generic_reader" }),
        createdAt: consumedAt, updatedAt: consumedAt,
      });
      return { granted: true };
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
    const { activeRuleIds, openRuleIds } = await resolveActiveMatchingRuleIds(
      ctx,
      deviceGroupIds,
      employeeGroupIds,
      Date.now(),
    );
    const hasAccess = canEmployeeAccessDevice({
      deviceGroupIds,
      employeeGroupIds,
      activeRuleIds,
      openRuleIds,
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
      ...(!hasAccess && activeRuleIds.size > 0 ? { hikDenialReason: "Zaman penceresi dışında" } : {}),
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

/** Legacy phone endpoint: a static device identifier is not physical presence evidence. */
export const selfCheckIn = employeeAuthedMutation({
  args: {
    deviceId: v.optional(v.id("devices")),
    deviceSerial: v.optional(v.string()),
  },
  handler: async () => ({
    granted: false as const,
    code: "READER_REQUIRED" as const,
    error: "Fiziksel okuyucu olayı gerekir; kapı komutu için mobileAccess:requestOpen kullanın",
  }),
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

    const referenceProjectId = args.projectId ?? (
      ctx.user.role === "super_admin" && !args.projectId ? undefined : employee.projectId);
    const overtimeRates = await getEffectiveOvertimeRates(ctx, referenceProjectId);
    const overtimeRange = overtimePeriodRange(args.startDate, args.endDate, overtimeRates.overtimeBasis, overtimeRates.nightShiftDayMode);
    const { startISO, endISO } = pdksWorkDayRange(overtimeRange.startDate, overtimeRange.endDate);

    let readings = await ctx.db.query("cardReadings")
      .withIndex("by_project_employee_time", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id).gte("accessTime", startISO).lte("accessTime", endISO))
      .collect();
    // Legacy card-only events use the employee-less index prefix, never all project rows.
    if (employee.cardNumber) {
      const unassigned = ctx.db.query("cardReadings")
        .withIndex("by_project_employee_time", q => q.eq("projectId", employee.projectId).eq("employeeId", undefined).gte("accessTime", startISO).lte("accessTime", endISO));
      for await (const reading of unassigned) {
        if (!reading.employeeId && reading.cardNo === employee.cardNumber) readings.push(reading);
      }
    }
    const availabilityEmployees = await ctx.db.query("employees")
      .withIndex("by_project", q => q.eq("projectId", employee.projectId)).collect();

    const detailBoundaryShiftResolver = await buildShiftResolver(ctx, availabilityEmployees.filter(e => employedDuring(e, args.startDate, args.endDate)));
    const detailHasFlexible = [...detailBoundaryShiftResolver.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift([employee], (id, date) => scopedPdksShift(detailBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
    if (detailHasFlexible) readings = [...await flexiblePreviousReadings(ctx, overtimeRange.startDate, allowedProjectIds, employee), ...readings];
    const sourceReadings = readings;
    const earlyDetailRecords = detailHasFlexible ? await ctx.db.query("pdksRecords")
      .withIndex("by_employee_date", q => q.eq("employeeId", args.employeeId).gte("date", addWorkDate(overtimeRange.startDate, -1)).lte("date", addWorkDate(overtimeRange.endDate, 1))).take(1001) : undefined;
    if (earlyDetailRecords && earlyDetailRecords.length > 1000) throw new Error("Manuel kayıt sınırı aşıldı; tarih aralığını daraltın");
    const detailBoundaryManual = new Map((earlyDetailRecords ?? []).filter(record => record.manualEntry && (!args.projectId || record.projectId === args.projectId)).map(record => [record.date, record]));
    const detailBoundaryWorkDate = buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(detailBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: sourceReadings, manualEntryFor: (id, date) => id === employee._id ? detailBoundaryManual.get(date)?.entryTime : undefined, eligibleEntry: r => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, trDateKey(candidate.accessTime))).length > 0 });
    const policies = await loadPdksPolicies(ctx, availabilityEmployees.map(e => e.projectId), detailHasFlexible ? addWorkDate(overtimeRange.startDate, -1) : overtimeRange.startDate, overtimeRange.endDate);
    readings = filterPdksReadings(readings, args.projectId, r => policies(r.projectId, detailBoundaryWorkDate(r)));

    readings.sort(
      (a, b) =>
        new Date(a.accessTime).getTime() - new Date(b.accessTime).getTime()
    );

    const [workSettings, holidayMap, generalSettings, manualRecords, leaves, department, company, position, shift, detailShiftResolver] =
      await Promise.all([
        getEffectiveWorkSettings(ctx, referenceProjectId),
        getHolidaysMap(ctx, referenceProjectId, overtimeRange.startDate, addWorkDate(overtimeRange.endDate, 1)),
        ctx.db
          .query("generalSettings")
          .withIndex("by_project", (q) => q.eq("projectId", referenceProjectId))
          .first(),
        earlyDetailRecords ? Promise.resolve(earlyDetailRecords) : ctx.db
          .query("pdksRecords")
          .withIndex("by_employee_date", (q) => q.eq("employeeId", args.employeeId))
          .filter((q) =>
            q.and(
              q.gte(q.field("date"), overtimeRange.startDate),
              q.lte(q.field("date"), overtimeRange.endDate)
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
        Promise.resolve(detailBoundaryShiftResolver),
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

    const readingsByDate = groupPdksWorkDays(readings, employee._id, (id, date) => scopedPdksShift(detailShiftResolver.resolve(id, date), args.projectId), (_id, date) => manualByDate.get(date)?.entryTime);

    const detailWorkDate = buildPdksWorkDateResolver(availabilityEmployees.filter(e => employedDuring(e, args.startDate, args.endDate)), (id, date) => scopedPdksShift(detailShiftResolver.resolve(id, date), args.projectId), { readings, manualEntryFor: (id, date) => id === employee._id ? manualByDate.get(date)?.entryTime : undefined });
    const detailPeriodDates = new Set(periodDateKeys);
    const excludedUnknownReadings = countExcludedUnknownPdksReadings(
      sourceReadings.filter(r => detailPeriodDates.has(detailWorkDate(r))),
      employee.projectId,
    );
    const availableDateKeys = await readPdksAvailableDateKeys(ctx, employee.projectId, periodDateKeys, detailWorkDate, policies);
    const firstRecordDate = await pdksFirstRecordDate(ctx, employee, readings, [...manualByDate.keys()], detailWorkDate, policies);
    const scopedLeaves = leaves.filter(l => pdksLeaveMatchesProject(l, employee.projectId));
    const allDays = buildPeriodDateKeys(overtimeRange.startDate, overtimeRange.endDate).filter(date => employedOn(employee, date)).map((dk) =>
      computeAttendanceDetailDay({
        policyFor: date => policies(employee.projectId, date),
        availableDateKeys,
        firstRecordDate,
        date: dk,
        dayReadings: readingsByDate.get(dk) ?? [],
        manualDay: manualByDate.get(dk),
        leaves: scopedLeaves,
        holiday: holidayMap.get(dk),
        holidayMap,
        dayShift: scopedPdksShift(detailShiftResolver.resolve(employee._id, dk), args.projectId),
        workSettings,
        overtimeRates,
        workingDays,
      })
    );

    const summary = summarizeAttendanceDays(allDays, {
      startDate: args.startDate, endDate: args.endDate,
      overtimeBasis: overtimeRates.overtimeBasis,
      hourlyRate: canSeePay(ctx.user) ? resolveHourlyRate({
        hourlyRate: employee.hourlyRate, monthlySalary: employee.monthlySalary,
        monthlyHoursBase: workSettings.monthlyHoursBase,
      }) : null,
    });
    const days = allDays.filter((d) => d.date >= args.startDate && d.date <= args.endDate)
      .map(({ overtimeSegments: _segments, ...day }) => ({ ...day, overtimeMinutes: summary.overtimeByDate[day.date]?.overtimeMinutes ?? 0 }));

    return {
      excludedUnknownReadings,
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
        incompleteDays: summary.incompleteDays,
        leaveDays: summary.leaveDays,
        overtimeMinutes: summary.overtimeMinutes,
        overtimePayTRY: summary.overtimePayTRY,
        exceedsDaily11h: summary.exceedsDaily11h,
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
      const eventId = await ctx.db.insert("deviceEvents", {
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
      // Canlı köprü yolu (deviceEvents.ts) gibi alarm e-postasını tetikle; günlük backfill'in
      // getirdiği eski olaylar için toplu e-posta gitmesin diye yalnız taze olayda.
      if (isFreshAlarmEvent(eventTime)) await notifyAlarmIfNeeded(ctx, eventId);
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

/** Server filters run before pagination; each cursor reads at most 2,000 candidates. */
export const listReportTransactions = authedQuery({
  args: {
    projectId: v.id("projects"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
    departmentId: v.optional(v.id("departments")),
    result: v.optional(v.union(v.literal("granted"), v.literal("denied"), v.literal("unknown"))),
    sources: v.optional(v.array(v.union(v.literal("card"), v.literal("pin"), v.literal("qr"), v.literal("mobile"), v.literal("manual"), v.literal("unknown")))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const bounds = cardReadingDateBounds(args.startDate, args.endDate);
    if (args.departmentId) {
      const department = await ctx.db.get(args.departmentId);
      if (department?.projectId !== args.projectId) throw new ConvexError("Departman seçili projede bulunamadı");
    }
    if (args.employeeId) {
      const employee = await ctx.db.get(args.employeeId);
      if (employee?.projectId !== args.projectId) throw new ConvexError("Kişi seçili projede bulunamadı");
    }
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) {
      throw new ConvexError("Sayfa boyutu pozitif bir tam sayı olmalı");
    }
    const status = args.result === "granted" ? "izin_verildi" : args.result === "denied" ? "reddedildi" : undefined;
    const query = stream(ctx.db, schema).query("cardReadings");
    const indexed = (() => {
      if (args.employeeId) return query.withIndex("by_project_employee_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("employeeId", args.employeeId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      if (status !== undefined) return query.withIndex("by_project_status_time", q => {
        const prefix = q.eq("projectId", args.projectId).eq("accessStatus", status);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
      return query.withIndex("by_project_access_time", q => {
        const prefix = q.eq("projectId", args.projectId);
        return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
      });
    })();
    let scannedCount = 0;
    let hiddenBiometricCount = 0;
    const employees = new Map<Id<"employees">, Doc<"employees"> | null>();
    const page = await indexed.order("desc").filterWith(async row => {
      scannedCount += 1;
      if (row.projectId !== args.projectId
        || (args.employeeId !== undefined && row.employeeId !== args.employeeId)
        || !matchesReadingResult(row.accessStatus, args.result)) return false;
      if (args.departmentId) {
        if (!row.employeeId) return false;
        if (!employees.has(row.employeeId)) employees.set(row.employeeId, await ctx.db.get(row.employeeId));
        const employee = employees.get(row.employeeId);
        if (employee?.projectId !== args.projectId || employee.departmentId !== args.departmentId) return false;
      }
      if (classifyReadingSource(row) === "biometric") { hiddenBiometricCount += 1; return false; }
      return matchesReadingSources(classifyReadingSource(row), args.sources);
    }).paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 200), maximumRowsRead: 2000, maximumBytesRead: 2_000_000 });
    const enriched = await enrichReadingsForList(ctx, page.page);
    return {
      ...page,
      page: enriched.map(toReportTransactionRow),
      scannedCount,
      hiddenBiometricCount,
    };
  },
});
