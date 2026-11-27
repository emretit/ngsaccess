import { loadPdksDeviceAvailability, pdksDeviceAvailabilityValidator } from "./lib/pdksAvailability";
import { pdksReadingValidator, toPdksTransport } from "./lib/pdksTransport";
import { ConvexError, getConvexSize } from "convex/values";
import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { resolveReadingScope, REPORT_READING_PERMISSIONS } from "./lib/readingAccess";
import { getPdksTableData, readBoundedPdks, pdksReadBudget, withPdksReadBudget, type PdksBatchScope } from "./lib/pdksTableQuery";
import { loadPayrollPeriod, type MonthlyPayrollSheet } from "./lib/pdksPayrollQuery";
import { employedDuring } from "./lib/employment";
import { getEffectiveOvertimeRates } from "./lib/pdksHelpers";
import { overtimePeriodRange } from "./lib/overtimeCalc";
import { addWorkDate, pdksWorkDayRange } from "./lib/pdksWorkDay";
import { buildPeriodDateKeys } from "./lib/pdksCalc";
import { loadPdksPolicies } from "./lib/pdksRules";
import { isPdksIncludedReading } from "./lib/pdksSource";
import { trDateKey, trTodayKey, trDayRangeISO } from "./lib/trDate";
import { canSeePayInProject } from "./lib/payVisibility";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const tableArgs = v.object({
  projectId: v.id("projects"), date: v.optional(v.string()), startDate: v.optional(v.string()), endDate: v.optional(v.string()),
  companyId: v.optional(v.id("companies")), departmentId: v.optional(v.id("departments")), positionId: v.optional(v.id("positions")), shiftId: v.optional(v.id("shifts")),
  statusFilter: v.optional(v.union(v.literal("all"), v.literal("present"), v.literal("late"), v.literal("absent"), v.literal("leave"), v.literal("overtime"), v.literal("weekend"), v.literal("holiday"), v.literal("future"), v.literal("noData"), v.literal("awaitingData"), v.literal("notEmployed"), v.literal("incomplete"))),
  person: v.optional(v.string()), employeeId: v.optional(v.id("employees")), viewMode: v.optional(v.union(v.literal("single"), v.literal("matrix"))), includePunches: v.optional(v.boolean()),
});
const payrollArgs = v.object({ projectId: v.id("projects"), year: v.number(), month: v.number(), companyId: v.optional(v.id("companies")) });
const requestValidator = v.union(v.object({ kind: v.literal("table"), args: tableArgs }), v.object({ kind: v.literal("payroll"), args: payrollArgs }));
const cursor = v.union(v.string(), v.null());
const rosterValidator = v.array(v.object({ employeeId: v.id("employees"), cardNumber: v.string() }));
type Request = typeof requestValidator.type;
export function pdksRequestDates(request: Request) {
  if (request.kind === "table") {
    const today = request.args.date ?? trTodayKey();
    return { startDate: request.args.startDate ?? today, endDate: request.args.endDate ?? today };
  }
  const { year, month } = request.args;
  if (!Number.isInteger(year) || year < 1000 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Geçerli bir yıl ve ay seçin");
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return { startDate: `${prefix}-01`, endDate: `${prefix}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` };
}

export async function requirePdksReportAccess(ctx: QueryCtx & { user: Doc<"users"> }, projectId: Id<"projects">) {
  try { return await resolveReadingScope(ctx, projectId, REPORT_READING_PERMISSIONS); }
  catch { throw new ConvexError({ code: "PDKS_FORBIDDEN", message: "Bu projeye erişim yetkiniz yok" }); }
}
/** Version includes immutable rule identities and editable setting/holiday values. */
export async function pdksSourceVersion(ctx: QueryCtx, projectId: Id<"projects">) {
  const budget = pdksReadBudget();
  const [work, rates, rules, holidays, globalHolidays] = await Promise.all([
    ctx.db.query("workSettings").withIndex("by_project", q => q.eq("projectId", projectId)).first(),
    ctx.db.query("overtimeRates").withIndex("by_project", q => q.eq("projectId", projectId)).first(),
    readBoundedPdks(ctx.db.query("pdksRuleVersions").withIndex("by_projectId_and_effectiveFrom", q => q.eq("projectId", projectId)), budget),
    readBoundedPdks(ctx.db.query("holidays").withIndex("by_project", q => q.eq("projectId", projectId)), budget),
    readBoundedPdks(ctx.db.query("holidays").withIndex("by_project", q => q.eq("projectId", undefined)), budget),
  ]);
  return JSON.stringify([work && [work._id, work.updatedAt ?? ""], rates && [rates._id, rates.updatedAt],
    rules.map(rule => [rule._id, rule.createdAt]), holidays, globalHolidays]);
}
export const sourceVersion = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requirePdksReportAccess(ctx, projectId);
    return pdksSourceVersion(withPdksReadBudget(ctx), projectId);
  },
});
export function assertPdksSourceRange(startISO: string | undefined, endISO: string | undefined, required: { startISO: string; endISO: string }) {
  if (!startISO || !endISO || !Number.isFinite(Date.parse(startISO)) || !Number.isFinite(Date.parse(endISO)) || startISO > required.startISO || endISO < required.endISO) throw new ConvexError({ code: "PDKS_SOURCE_STALE" });
}

export const rosterPage = authedQuery({
  args: { request: requestValidator, cursor },
  handler: async (ctx, { request, cursor }) => {
    await requirePdksReportAccess(ctx, request.args.projectId);
    const dates = pdksRequestDates(request);
    const page = await ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", request.args.projectId))
      .paginate({ cursor, numItems: 100, maximumBytesRead: 1024 * 1024 });
    return { ...page, page: page.page.filter(employee => employedDuring(employee, dates.startDate, dates.endDate)
      && (request.kind !== "payroll" || employee.isVisitor !== true && (!request.args.companyId || employee.companyId === request.args.companyId)))
      .map(employee => ({ employeeId: employee._id, cardNumber: employee.cardNumber })) };
  },
});

/** Dates contributed by readings without a roster match still affect global availability. */
export const unassignedDatesPage = authedQuery({
  args: { request: requestValidator, roster: rosterValidator, cursor },
  handler: async (ctx, { request, cursor }) => {
    await requirePdksReportAccess(ctx, request.args.projectId);
    const dates = pdksRequestDates(request);
    const rates = await getEffectiveOvertimeRates(ctx, request.args.projectId);
    const range = overtimePeriodRange(dates.startDate, dates.endDate, rates.overtimeBasis, rates.nightShiftDayMode);
    const { startISO, endISO } = pdksWorkDayRange(addWorkDate(range.startDate, -1), range.endDate);
    const page = await ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", request.args.projectId).gte("accessTime", startISO).lte("accessTime", endISO))
      .paginate({ cursor, numItems: 2000, maximumBytesRead: 4 * 1024 * 1024 });
    const policies = await loadPdksPolicies(ctx, [request.args.projectId], addWorkDate(range.startDate, -1), addWorkDate(range.endDate, 1));
    const readings = page.page.map(reading => {
      const compact = toPdksTransport(reading);
      return isPdksIncludedReading(compact, request.args.projectId, policies(reading.projectId, trDateKey(reading.accessTime)))
        ? { ...compact, unassignedDate: trDateKey(reading.accessTime) } : compact;
    });
    return { isDone: page.isDone, continueCursor: page.continueCursor, readings, startISO, endISO, sourceBytes: page.page.reduce((sum, reading) => sum + getConvexSize(reading), 0) };

  },
});

export const calculate = authedQuery({
  args: { request: requestValidator, roster: rosterValidator, employeeIds: v.array(v.id("employees")), readings: v.optional(v.array(pdksReadingValidator)), readingStartISO: v.optional(v.string()), readingEndISO: v.optional(v.string()), sourceVersion: v.optional(v.string()), deviceAvailability: v.optional(v.array(pdksDeviceAvailabilityValidator)), availabilityOnly: v.boolean(), availableDates: v.optional(v.array(v.string())), forceFlexible: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    ctx = withPdksReadBudget(ctx);
    const { request } = args;
    await requirePdksReportAccess(ctx, request.args.projectId);
    if (args.readings) {
      const dates = pdksRequestDates(request);
      const rates = await getEffectiveOvertimeRates(ctx, request.args.projectId);
      const range = overtimePeriodRange(dates.startDate, dates.endDate, rates.overtimeBasis, rates.nightShiftDayMode);
      assertPdksSourceRange(args.readingStartISO, args.readingEndISO, pdksWorkDayRange(addWorkDate(range.startDate, -1), range.endDate));
      if (args.sourceVersion !== await pdksSourceVersion(ctx, request.args.projectId)) throw new ConvexError({ code: "PDKS_SOURCE_STALE" });
    }
    const employees: Doc<"employees">[] = [];
    for (const id of args.employeeIds) {
      const employee = await ctx.db.get(id);
      if (employee) employees.push(employee);
    }
    if (employees.some(employee => employee.projectId !== request.args.projectId)) throw new Error("Çalışan seçili projeye ait değil");
    // Completeness hints only affect presentation; access and actual employee project
    // ownership above are always checked server-side, independently of these hints.
    if (args.deviceAvailability?.some(device => device.projectId !== request.args.projectId)) throw new Error("Cihaz seçili projeye ait değil");
    if (args.readings?.some(reading => reading.projectId !== request.args.projectId)) throw new Error("Okuma seçili projeye ait değil");
    let availableDates: string[] = [], hasFlexible = false, eligibleEmployeeIds: typeof args.employeeIds = [];
    const owners = new Map(args.roster.filter(employee => employee.cardNumber).map(employee => [employee.cardNumber, employee.employeeId]));
    const batch: PdksBatchScope = { preloadedReadings: args.readings, readingEndISO: args.readingEndISO, employees, allEmployeeIds: args.roster.map(employee => employee.employeeId),
      cardOwners: [...owners].map(([cardNumber, employeeId]) => ({ cardNumber, employeeId })), availabilityOnly: args.availabilityOnly,
      deviceAvailability: args.deviceAvailability, availableDates: args.availableDates, forceFlexible: args.forceFlexible,
      onAvailability: (dates, flexible, ids) => { availableDates = dates; hasFlexible = flexible; eligibleEmployeeIds = ids; },
    };
    const helpers = { scopedPdksShift: (shift: Doc<"shifts"> | null, projectId?: string) => projectId && shift?.projectId !== projectId && !(shift?.scheduleType === "flexible" && !shift.projectId) ? null : shift,
      flexiblePreviousReadings: async () => [] };
    if (request.kind === "table") return { kind: "table" as const, rows: await getPdksTableData(ctx, request.args, helpers, batch), availableDates, hasFlexible, eligibleEmployeeIds };
    const dates = pdksRequestDates(request);
    const sheet = await loadPayrollPeriod(ctx, { ...request.args, ...dates }, helpers, { batch });
    return { kind: "payroll" as const, sheet: { ...sheet, year: request.args.year, month: request.args.month, isClosed: false }, availableDates, hasFlexible, eligibleEmployeeIds };
  },
});

/** Closed snapshots are read in full, including exports; no 25-person truncation. */
export const closedPayrollPage = authedQuery({
  args: { args: payrollArgs, cursor },
  handler: async (ctx, { args, cursor }): Promise<{ sheet: MonthlyPayrollSheet; isDone: boolean; continueCursor: string } | null> => {
    await requirePdksReportAccess(ctx, args.projectId);
    const period = `${args.year}-${String(args.month).padStart(2, "0")}`;
    const saved = await ctx.db.query("payrollPeriods").withIndex("by_projectId_and_period", q => q.eq("projectId", args.projectId).eq("period", period)).order("desc").first();
    if (saved?.status !== "closed") return null;
    const dates = pdksRequestDates({ kind: "payroll", args });
    const base = { year: args.year, month: args.month, days: buildPeriodDateKeys(dates.startDate, dates.endDate), isClosed: true };
    if (!saved.snapshotReady) return { sheet: { ...base, rows: [], snapshotPending: true }, isDone: true, continueCursor: "" };
    const page = await ctx.db.query("payrollPeriodRows").withIndex("by_periodId_and_employeeId", q => q.eq("periodId", saved._id)).paginate({ cursor, numItems: 25, maximumBytesRead: 1024 * 1024 });
    const payVisible = await canSeePayInProject(ctx, ctx.user, args.projectId);
    const rows = page.page.filter(row => !args.companyId || row.companyId === args.companyId).map(row => {
      const parsed = JSON.parse(row.rowJson) as MonthlyPayrollSheet["rows"][number];
      return payVisible ? parsed : { ...parsed, hourlyRate: null, cells: parsed.cells.map(cell => ({ ...cell, overtimePayTRY: null })), totals: { ...parsed.totals, overtimePayTRY: null } };
    });
    return { sheet: { ...base, rows }, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Stable roster subscription: badge traffic does not reread employee metadata. */
export const todayRoster = authedQuery({
  args: { projectId: v.id("projects"), date: v.string() },
  handler: async (queryCtx, { projectId, date }) => {
    const ctx = withPdksReadBudget(queryCtx);
    await requirePdksReportAccess(ctx, projectId);
    const today = date;
    return (await readBoundedPdks(ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)), pdksReadBudget()))
      .filter(employee => employedDuring(employee, today, today)).map(employee => ({ employeeId: employee._id, cardNumber: employee.cardNumber }));
  },
});
/** Unknown badges contribute global availability; stop at the first eligible event.
 * The unlinked index probe avoids walking regular staff readings when an unknown badge exists. */
export const todayAvailability = authedQuery({
  args: { projectId: v.id("projects"), date: v.string(), roster: rosterValidator },
  handler: async (queryCtx, { projectId, date, roster }) => {
    const ctx = withPdksReadBudget(queryCtx);
    await requirePdksReportAccess(ctx, projectId);
    const today = date;
    const { startISO, endISO } = trDayRangeISO(today, today);
    const policies = await loadPdksPolicies(ctx, [projectId], today, today);
    const ids = new Set(roster.map(employee => employee.employeeId));
    const cards = new Set(roster.filter(employee => employee.cardNumber).map(employee => employee.cardNumber));
    const eligible = (reading: Doc<"cardReadings">) => !((reading.employeeId && ids.has(reading.employeeId)) || cards.has(reading.cardNo))
      && isPdksIncludedReading(reading, projectId, policies(projectId, today));
    // Probe unlinked cards first: regular staff events do not touch this index range.
    for await (const reading of ctx.db.query("cardReadings").withIndex("by_project_employee_time", q => q.eq("projectId", projectId).eq("employeeId", undefined).gte("accessTime", startISO).lte("accessTime", endISO))) {
      if (eligible(reading)) return [today];
    }
    // This live hint excludes deleted/moved IDs and stale departed employees/visitors.
    // Late device events for those people remain in snapshot/payroll source ranges.
    const employees = await readBoundedPdks(ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId)), pdksReadBudget());
    const recentEndDate = addWorkDate(today, -2);
    const candidates = employees.filter(employee => {
      if (ids.has(employee._id)) return false;
      if (employee.isVisitor !== true && employee.employmentEndDate && employee.employmentEndDate < recentEndDate) return false;
      const updatedAt = employee.updatedAt;
      if (employee.isVisitor && employee.isActive === false && updatedAt && Number.isFinite(Date.parse(updatedAt)) && trDateKey(updatedAt) < today) return false;
      return true;
    });
    // null means unknown, not a failed table: retain headroom below 4,096 DB calls.
    if (candidates.length > 4000) return null;
    for (const employee of candidates) {
      for await (const reading of ctx.db.query("cardReadings").withIndex("by_project_employee_time", q => q.eq("projectId", projectId).eq("employeeId", employee._id).gte("accessTime", startISO).lte("accessTime", endISO))) {
        if (eligible(reading)) return [today];
      }
    }
    return [];
  },
});

/** The sole live device subscription; unchanged projected values keep group args stable. */
export const todayDeviceAvailability = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requirePdksReportAccess(ctx, projectId);
    return await loadPdksDeviceAvailability(ctx, projectId);
  },
});
