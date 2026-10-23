import { usesShiftDayRules } from "./lib/pdksFixedRules";
import { requirePermission } from "./lib/permissions";
import { processCardReadingCore } from "./lib/processCardReadingCore";
import { getPdksTableData as getPdksTableDataQuery } from "./lib/pdksTableQuery";
import { getMonthlyPayrollSheet as getMonthlyPayrollSheetQuery } from "./lib/pdksPayrollQuery";
import { loadPdksPolicies } from "./lib/pdksRules";
import { employedDuring, employedOn } from "./lib/employment";
import { mergedStream, stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { canSeePayInProject } from "./lib/payVisibility";
import { classifyReadingSource, countExcludedUnknownPdksReadings, filterPdksReadings } from "./lib/pdksSource";
import { matchesReadingSources, toReportTransactionRow } from "./lib/reportAttendance";
import { paginationOptsValidator, type PaginationResult } from "convex/server";
import { resolveProjectScope } from "./lib/projectScope";
import { cardReadingDateBounds, scopedCardReadingQuery } from "./lib/cardReadingList";
import { assignmentPrecondition, ASSIGN_CARD_ERRORS, liveReadingSource, liveReadingWindow, matchesReadingResult } from "./lib/liveReadings";
import { matchesPersonSearch, readingSearchTerm } from "./lib/readingSearch";
import { getEmployeeTargetDevices } from "./lib/peopleHikSnapshot";
import { writeAudit } from "./lib/audit";
import { isFreshAlarmEvent, notifyAlarmIfNeeded } from "./lib/alarmNotify";
import { toUtcISO, trDateKey, trTodayKey, trDayRangeISO } from "./lib/trDate";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import {
  authedQuery,
  authedMutation,
  employeeAuthedQuery,
  employeeAuthedMutation,
} from "./lib/customFunctions";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getEffectiveWorkSettings,
  getEffectiveOvertimeRates,
  getHolidaysMap,
  resolveHourlyRate,
} from "./lib/pdksHelpers";
import {
  buildShiftResolver,
} from "./lib/shiftResolver";
import { overtimePeriodRange } from "./lib/overtimeCalc";
import { inferAccessStatus, inferDenialReason } from "./lib/hikEventCodes";
import {
  classifyHikEvent,
  shouldCreateCardReadingForHikEvent,
} from "./lib/hikEventCatalog";
import {
  buildPeriodDateKeys,
  formatHoursLabel,
} from "./lib/pdksCalc";
import {
  enrichReadingsForList,
  enrichWithDeviceInfo,
} from "./lib/cardReadingAudit";
import {
  computeAttendanceDetailDay,
  summarizeAttendanceDays,
} from "./lib/pdksDetail";
import { addWorkDate, buildPdksWorkDateResolver, groupPdksWorkDays, hasPdksShiftDayRules, pdksWorkDayRange } from "./lib/pdksWorkDay";
import { pdksLeaveMatchesProject, readPdksAvailableDateKeys, pdksFirstRecordDate } from "./lib/pdksAvailability";

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
    /** Kişi adı/soyadı (sözcük başı) ya da tam kart numarası. */
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const bounds = cardReadingDateBounds(args.startDate, args.endDate);
    const search = readingSearchTerm(args.search);
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
    const searched = search ? await (async () => {
      // Arama: tam kart numarası + adı/soyadı uyan kişilerin okumaları, zamana göre tek akışta birleşir.
      const people = (await Promise.all([
        ctx.db.query("employees").withSearchIndex("search_first_name", q => q.search("firstName", search).eq("projectId", args.projectId)).take(50),
        ctx.db.query("employees").withSearchIndex("search_last_name", q => q.search("lastName", search).eq("projectId", args.projectId)).take(50),
      ])).flat().filter(person => matchesPersonSearch(person, search) && (args.employeeId === undefined || person._id === args.employeeId));
      const personIds = [...new Set(people.map(person => person._id))].slice(0, 20);
      const streams = [
        ...(/^[A-Za-z0-9_-]{1,32}$/.test(search) ? [query.withIndex("by_project_card_time", q => {
          const prefix = q.eq("projectId", args.projectId).eq("cardNo", search);
          return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
        }).order("desc")] : []),
        ...personIds.map(id => stream(ctx.db, schema).query("cardReadings").withIndex("by_project_employee_time", q => {
          const prefix = q.eq("projectId", args.projectId).eq("employeeId", id);
          return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
        }).order("desc")),
      ];
      return streams.length ? mergedStream(streams, ["accessTime"]) : null;
    })() : undefined;
    if (searched === null) return { page: [], isDone: true, continueCursor: "", scannedCount: 0, matchedCount: 0, scanLimitReached: false, filterScope: "boundedScan" as const };
    const indexed = searched ?? (() => {
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
    })().order("desc");
    let scannedCount = 0;
    // filterWith runs JS classification inside the stream, before pagination. Its
    // cursor advances over rejected rows too; no native paginate loop is needed.
    const page = await indexed.filterWith(async row => {
      scannedCount += 1;
      return row.projectId === args.projectId
        && (deviceId === undefined || row.deviceId === deviceId)
        && (door?.ioId === undefined || row.ideIoId === door.ioId)
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

export const assignCardFromReading = authedMutation({
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
    await requirePermission(ctx, ctx.user, employee.projectId, "employees.manage");
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
    return getPdksTableDataQuery(ctx, args, { scopedPdksShift, flexiblePreviousReadings });
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
    return getMonthlyPayrollSheetQuery(ctx, args, { scopedPdksShift, flexiblePreviousReadings });
  },
});

// Kart-okuma yön/zaman/kural helper'ları (ideTimeToISO, startOfTurkeyDayISO,
// resolveDirection, resolveActiveMatchingRuleIds + AccessDirection) lib/cardReadingProcess.ts'e
// taşındı — saf ikili golden testlerle donduruldu.

/** Kart adaylarını cihazın projesine göre seç; projesiz cihazın legacy davranışını koru. */
async function findDeviceCardEmployee(ctx: MutationCtx, cardNo: string, projectId?: Id<"projects">) {
  const candidates = await ctx.db.query("employees")
    .withIndex("by_card", q => q.eq("cardNumber", cardNo))
    .take(20);
  return candidates.find(candidate => !projectId || candidate.projectId === projectId) ?? null;
}

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
    hikCardReaderNo: v.optional(v.number()),
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
    return processCardReadingCore(ctx, args, findDeviceCardEmployee);
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
    const detailHasFlexible = [...detailBoundaryShiftResolver.shifts.values()].some(usesShiftDayRules) && hasPdksShiftDayRules([employee], (id, date) => scopedPdksShift(detailBoundaryShiftResolver.resolve(id, date), args.projectId), overtimeRange.startDate, overtimeRange.endDate);
    if (detailHasFlexible) readings = [...await flexiblePreviousReadings(ctx, overtimeRange.startDate, allowedProjectIds, employee), ...readings];
    const sourceReadings = readings;
    const earlyDetailRecords = detailHasFlexible ? await ctx.db.query("pdksRecords")
      .withIndex("by_employee_date", q => q.eq("employeeId", args.employeeId).gte("date", addWorkDate(overtimeRange.startDate, -1)).lte("date", addWorkDate(overtimeRange.endDate, 1))).take(1001) : undefined;
    if (earlyDetailRecords && earlyDetailRecords.length > 1000) throw new Error("Manuel kayıt sınırı aşıldı; tarih aralığını daraltın");
    const detailBoundaryManual = new Map((earlyDetailRecords ?? []).filter(record => record.manualEntry && (!args.projectId || record.projectId === args.projectId)).map(record => [record.date, record]));
    const detailBoundaryWorkDate = buildPdksWorkDateResolver(availabilityEmployees, (id, date) => scopedPdksShift(detailBoundaryShiftResolver.resolve(id, date), args.projectId), { readings: sourceReadings, manualEntryFor: (id, date) => id === employee._id ? detailBoundaryManual.get(date)?.entryTime : undefined, eligibleEntry: r => filterPdksReadings([r], args.projectId, candidate => policies(candidate.projectId, trDateKey(candidate.accessTime))).length > 0 }, (reading, date) => policies(reading.projectId, date));
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
      hourlyRate: (await canSeePayInProject(ctx, ctx.user, employee.projectId)) ? resolveHourlyRate({
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
      cardReaderNo: v.optional(v.number()),
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

    // Canlı olaylarla aynı cihaz-projesi eşleştirmesini kullan.
    const employee = await findDeviceCardEmployee(ctx, cardNo, device.projectId);
    const projectId = device.projectId ?? employee?.projectId;

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
      hikCardReaderNo: args.event.cardReaderNo,
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
