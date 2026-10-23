import { flexibleReportProjects } from "./lib/reportScope";
import { trDateKey } from "./lib/trDate";
import { addWorkDate, buildPdksWorkDateResolver, hasFlexiblePdksShift } from "./lib/pdksWorkDay";
import { buildPeriodDateKeys } from "./lib/pdksCalc";
import { buildBoundedShiftResolver } from "./lib/shiftResolver";
import { computePdksTableRow } from "./lib/pdksTable";
import { filterPdksReadings } from "./lib/pdksSource";
import { DEFAULT_OVERTIME_RATES, getEffectiveWorkSettings } from "./lib/pdksHelpers";
import { hasVersionedPdksPolicy, loadPdksPolicies } from "./lib/pdksRules";
import { v } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { employeeAuthedQuery } from "./lib/customFunctions";
import { liveReadingSource } from "./lib/liveReadings";
import {
  attendanceDateRange, attendanceError, attendancePageSize, parseAttendanceCursor,
  SUMMARY_MAX_DAYS, SUMMARY_MAX_READINGS, summarizeMovements,
} from "./lib/mobileAttendance";
import type { AttendanceCursor } from "./lib/mobileAttendance";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const nullableString = v.union(v.string(), v.null());
const dayValidator = v.object({
  date: v.string(), entryCount: v.number(), exitCount: v.number(), deniedCount: v.number(), unknownCount: v.number(),
  firstEntry: nullableString, lastEntry: nullableString, lastExit: nullableString,
  lastDirection: v.union(v.literal("entry"), v.literal("exit"), v.literal("unknown")),
});
const readingValidator = v.object({
  ...schema.tables.cardReadings.validator.fields,
  _id: v.id("cardReadings"), _creationTime: v.number(),
  source: v.union(v.literal("card"), v.literal("qr"), v.literal("mobile"), v.literal("biometric"), v.literal("unknown")),
  device: v.union(v.null(), v.object({
    _id: v.id("devices"), name: v.string(), description: nullableString, deviceSerial: nullableString,
  })),
});

async function enrichEmployeeReadings(ctx: QueryCtx, rows: Doc<"cardReadings">[], projectId?: Id<"projects">) {
  const ids = [...new Set(rows.flatMap(row => row.deviceId ? [row.deviceId] : []))];
  const devices = await Promise.all(ids.map(id => ctx.db.get(id)));
  const sameProjectDevices = new Map(devices
    .filter((device): device is NonNullable<typeof device> => device !== null &&
      projectId !== undefined && device.projectId === projectId)
    .map(device => [device._id, device]));
  return rows.map(row => {
    const device = row.deviceId ? sameProjectDevices.get(row.deviceId) : undefined;
    return {
      ...row, source: liveReadingSource(row),
      device: device ? {
        _id: device._id, name: device.name, description: device.description ?? null, deviceSerial: device.deviceSerial ?? null,
      } : null,
    };
  });
}

/** Employee-owned raw access attempts; never accepts an employee/project argument. */
export const listPage = employeeAuthedQuery({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())), numItems: v.optional(v.number()),
    startDate: v.optional(v.string()), endDate: v.optional(v.string()), deviceId: v.optional(v.id("devices")),
  },
  returns: v.object({ page: v.array(readingValidator), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const numItems = attendancePageSize(args.numItems);
    const range = attendanceDateRange(args.startDate, args.endDate);
    const employee = ctx.employee;
    if (args.deviceId) {
      const device = await ctx.db.get(args.deviceId);
      if (!employee.projectId || !device || device.projectId !== employee.projectId) throw attendanceError("DEVICE_NOT_FOUND");
    }
    const context = JSON.stringify([employee._id, employee.projectId ?? null, args.startDate ?? null, args.endDate ?? null, args.deviceId ?? null]);
    const prefix = args.deviceId ? [employee._id, args.deviceId] : [employee._id];
    const previous = args.cursor === undefined || args.cursor === null ? null : parseAttendanceCursor(
      args.cursor, context, prefix, id => ctx.db.normalizeId("cardReadings", id) !== null,
    );
    if (previous?.position === "[]") return { page: [], isDone: true, continueCursor: JSON.stringify(previous) };
    // Freeze membership by receive time. New old-event backfills do not alter an
    // existing archive traversal; a refresh starts a fresh archive snapshot.
    const newest = previous ? null : await ctx.db.query("cardReadings")
      .withIndex("by_employee", q => q.eq("employeeId", employee._id)).order("desc").first();
    const snapshotCreationTime = previous?.snapshotCreationTime ?? newest?._creationTime ?? 0;
    const readings = stream(ctx.db, schema).query("cardReadings");
    const query = args.deviceId
      ? readings.withIndex("by_employee_device_time", q => {
        const prefix = q.eq("employeeId", employee._id).eq("deviceId", args.deviceId);
        const lower = range.startISO === undefined ? prefix : prefix.gte("accessTime", range.startISO);
        return range.endISO === undefined ? lower : lower.lt("accessTime", range.endISO);
      })
      : readings.withIndex("by_employee_accessTime", q => {
        const prefix = q.eq("employeeId", employee._id);
        const lower = range.startISO === undefined ? prefix : prefix.gte("accessTime", range.startISO);
        return range.endISO === undefined ? lower : lower.lt("accessTime", range.endISO);
      });
    const result = await query.order("desc")
      .filterWith(async row => row._creationTime <= snapshotCreationTime)
      .paginate({ numItems, cursor: previous?.position ?? null, maximumRowsRead: 1000, maximumBytesRead: 1024 * 1024 });
    const cursor: AttendanceCursor = { version: 1, context, snapshotCreationTime, position: result.continueCursor };
    return {
      page: await enrichEmployeeReadings(ctx, result.page, employee.projectId),
      isDone: result.isDone, continueCursor: JSON.stringify(cursor),
    };
  },
});

/** Complete raw movement summary or a typed unavailable error, never a truncated total. */
export const summary = employeeAuthedQuery({
  args: { startDate: v.string(), endDate: v.string() },
  returns: v.object({
    startDate: v.string(), endDate: v.string(), timeZone: v.literal("Europe/Istanbul"), generatedAt: v.string(),
    days: v.array(dayValidator), totals: v.object({
      entryCount: v.number(), exitCount: v.number(), deniedCount: v.number(), unknownCount: v.number(), presentDays: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const { startISO, endISO } = attendanceDateRange(args.startDate, args.endDate, SUMMARY_MAX_DAYS);
    if (!startISO || !endISO) throw attendanceError("INVALID_ARGUMENT");
    const employee = ctx.employee;
    const projectId = employee.projectId;
    const policies = await loadPdksPolicies(ctx, [projectId], addWorkDate(args.startDate, -1), args.endDate);
    const policyFor = (date: string) => policies(projectId, date);
    const dates = buildPeriodDateKeys(args.startDate, args.endDate);
    const versioned = hasVersionedPdksPolicy(policies, projectId, addWorkDate(args.startDate, -1), args.endDate);
    const flexibleDefinitions = !versioned && projectId ? await flexibleReportProjects(ctx, [projectId], args.startDate, args.endDate, new Map([[projectId, [employee]]])) : new Set<Id<"projects">>();
    const earlyShifts = flexibleDefinitions.size ? await buildBoundedShiftResolver(ctx, [employee]) : undefined;
    const flexible = earlyShifts !== undefined && [...earlyShifts.shifts.values()].some(shift => shift.scheduleType === "flexible") && hasFlexiblePdksShift([employee], earlyShifts.resolve, args.startDate, args.endDate);
    const range = versioned || flexible ? attendanceDateRange(addWorkDate(args.startDate, -1), addWorkDate(args.endDate, 1)) : { startISO, endISO };
    const rows = await ctx.db.query("cardReadings").withIndex("by_employee_accessTime", q =>
      q.eq("employeeId", employee._id).gte("accessTime", range.startISO ?? startISO).lt("accessTime", range.endISO ?? endISO))
      .paginate({ numItems: SUMMARY_MAX_READINGS + 1, cursor: null, maximumRowsRead: SUMMARY_MAX_READINGS + 1, maximumBytesRead: 8 * 1024 * 1024 });
    if (!rows.isDone || rows.page.length > SUMMARY_MAX_READINGS) throw attendanceError("SUMMARY_TOO_LARGE");
    const calendarReadings = rows.page.filter(reading => reading.accessTime >= startISO && reading.accessTime < endISO);
    if (!versioned && !flexible) {
      return summarizeMovements(calendarReadings, args.startDate, args.endDate, projectId, new Date().toISOString(), policyFor);
    }
    const shifts = earlyShifts ?? await buildBoundedShiftResolver(ctx, [employee]);
    const resolveShift = (id: Id<"employees">, date: string) => {
      const shift = shifts.resolve(id, date);
      return shift?.projectId === projectId || shift?.scheduleType === "flexible" && !shift.projectId ? shift : null;
    };
    const hasFlexible = [...shifts.shifts.values()].some(shift => shift.scheduleType === "flexible");
    const [manual, leaves, projectHolidays, globalHolidays, workSettings, general] = await Promise.all([
      ctx.db.query("pdksRecords").withIndex("by_employee_date", q => q.eq("employeeId", employee._id).gte("date", hasFlexible ? addWorkDate(args.startDate, -1) : args.startDate).lte("date", hasFlexible ? addWorkDate(args.endDate, 1) : args.endDate)).take(1001),
      ctx.db.query("leaves").withIndex("by_employee_start", q => q.eq("employeeId", employee._id).lte("startDate", args.endDate)).take(1001),
      ctx.db.query("holidays").withIndex("by_project_date", q => q.eq("projectId", projectId).gte("date", args.startDate).lte("date", args.endDate)).take(1001),
      ctx.db.query("holidays").withIndex("by_project_date", q => q.eq("projectId", undefined).gte("date", args.startDate).lte("date", args.endDate)).take(1001),
      getEffectiveWorkSettings(ctx, projectId),
      ctx.db.query("generalSettings").withIndex("by_project", q => q.eq("projectId", projectId)).first(),
    ]);
    if ([manual, leaves, projectHolidays, globalHolidays].some(list => list.length > 1000)) throw attendanceError("SUMMARY_TOO_LARGE");
    const manualByDate = new Map(manual.filter(record => record.manualEntry && record.projectId === projectId).map(record => [`${employee._id}__${record.date}`, record]));
    const workDate = buildPdksWorkDateResolver([employee], resolveShift, hasFlexible ? {
      readings: rows.page, manualEntryFor: (id, date) => manualByDate.get(`${id}__${date}`)?.entryTime,
      eligibleEntry: reading => filterPdksReadings([reading], projectId, r => policyFor(trDateKey(r.accessTime))).length > 0,
    } : undefined, (_reading, date) => policyFor(date));
    const included = filterPdksReadings(rows.page, projectId, reading => policyFor(workDate(reading)));
    const row = computePdksTableRow({
      policyFor, employee, empKey: employee._id, empReadings: included, departmentName: "", periodDateKeys: dates,
      availableDateKeys: new Set(included.map(workDate)), startDate: args.startDate, isSingleDay: false, viewMode: "matrix",
      manualPdksByEmpDate: manualByDate,
      allLeaves: leaves.filter(leave => leave.status === "approved" && (!leave.projectId || leave.projectId === projectId)),
      holidayMap: new Map([...globalHolidays, ...projectHolidays].map(holiday => [holiday.date, holiday])),
      workingDays: general?.workingDays?.length ? general.workingDays : ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"],
      workSettings, overtimeRates: DEFAULT_OVERTIME_RATES, resolveShift, manualEditedBy: null,
    });
    const presentDates = new Set(row.days.filter(day => day.status === "present" || day.status === "late").map(day => day.date));
    const summary = summarizeMovements(calendarReadings, args.startDate, args.endDate, projectId, new Date().toISOString(), policyFor, { workDate, presentDates });
    if (hasFlexible) summary.totals.presentDays = summary.days.filter(day =>
      policyFor(day.date).punchMode === "requirements" || resolveShift(employee._id, day.date)?.scheduleType === "flexible"
        ? presentDates.has(day.date) : day.entryCount > 0).length;
    return summary;
  },
});
