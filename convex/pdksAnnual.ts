import { loadPdksPolicies, hasVersionedPdksPolicy } from "./lib/pdksRules";
import { usesShiftDayRules } from "./lib/pdksFixedRules";
import { v, ConvexError } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { assertPdksSourceRange, pdksSourceVersion, requirePdksReportAccess } from "./pdksBatches";
import { pdksReadingValidator, toPdksTransport } from "./lib/pdksTransport";
import { readBoundedPdks, pdksReadBudget, withPdksReadBudget } from "./lib/pdksTableQuery";
import { annualOvertimeDayEntries, dashboardWorkDateResolver } from "./dashboard";
import { type AnnualBalanceRow } from "./lib/annualOvertime";
import { addWorkDate, pdksWorkDayRange } from "./lib/pdksWorkDay";
import { trDayRangeISO } from "./lib/trDate";
import { buildBoundedShiftResolver, type ShiftResolver } from "./lib/shiftResolver";
import { scopedPdksPlan, usesPlanDayRules } from "./lib/pdksMultiShift";
import { loadRuleReportDays } from "./lib/reportAttendance";
import { filterPdksReadings } from "./lib/pdksSource";
import { getEffectiveWorkSettings } from "./lib/pdksHelpers";
import { bucketWeeklyOvertime, ANNUAL_OVERTIME_LIMIT_MINUTES } from "./lib/overtimeCalc";
import { buildPeriodDateKeys } from "./lib/pdksCalc";
import type { Doc } from "./_generated/dataModel";

const rangeArgs = { projectId: v.id("projects"), year: v.number(), startDate: v.string(), endDate: v.string() };
/** The same context used by the original annual engine, including rule history/night tails. */
export function annualSourceRange(year: number, startDate: string, endDate: string) {
  const previous = addWorkDate(startDate, -1);
  const start = previous < `${year}-01-01` ? `${year}-01-01` : previous;
  const end = [addWorkDate(endDate, 1), `${year}-12-31`].sort()[0] ?? endDate;
  return { start, end, ...pdksWorkDayRange(addWorkDate(start, -7), end) };
}
/** Unlinked badges are read once per month; linked badges use only the employee index. */
export const unlinkedPage = authedQuery({
  args: { ...rangeArgs, cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    await requirePdksReportAccess(ctx, args.projectId);
    const range = annualSourceRange(args.year, args.startDate, args.endDate);
    const page = await ctx.db.query("cardReadings").withIndex("by_project_employee_time", q => q.eq("projectId", args.projectId).eq("employeeId", undefined).gte("accessTime", range.startISO).lte("accessTime", range.endISO))
      .paginate({ cursor: args.cursor, numItems: 8000, maximumBytesRead: 14 * 1024 * 1024 });
    return { ...range, readings: page.page.map(toPdksTransport), isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
/** Month pieces own disjoint whole weeks; adaptive groups bound every transaction. */
export const month = authedQuery({
  args: { ...rangeArgs, employeeIds: v.array(v.id("employees")), employeeId: v.optional(v.id("employees")),
    unlinked: v.array(pdksReadingValidator), readingStartISO: v.string(), readingEndISO: v.string(), sourceVersion: v.string() },
  handler: async (queryCtx, args): Promise<AnnualBalanceRow[]> => {
    const ctx = withPdksReadBudget(queryCtx);
    await requirePdksReportAccess(ctx, args.projectId);
    const range = annualSourceRange(args.year, args.startDate, args.endDate);
    assertPdksSourceRange(args.readingStartISO, args.readingEndISO, range);
    if (args.sourceVersion !== await pdksSourceVersion(ctx, args.projectId)) throw new ConvexError({ code: "PDKS_SOURCE_STALE" });
    const employees: Doc<"employees">[] = [];
    for (const id of args.employeeIds) {
      const employee = await ctx.db.get(id);
      if (employee && employee.projectId !== args.projectId) throw new ConvexError({ code: "PDKS_FORBIDDEN" });
      if (employee?.isActive) employees.push(employee);
    }
    if (args.unlinked.some(reading => reading.projectId !== args.projectId || reading.employeeId)) throw new ConvexError({ code: "PDKS_FORBIDDEN" });
    const loaded = await buildBoundedShiftResolver(ctx, employees, { start: addWorkDate(range.start, -7), end: addWorkDate(range.end, 1) });
    const resolvePlan: ShiftResolver["resolvePlan"] = (id, date) => scopedPdksPlan(loaded.resolvePlan(id, date), args.projectId);
    const shifts: ShiftResolver = { ...loaded, resolvePlan,
      resolve: (id, date) => { const plan = resolvePlan(id, date); return plan.kind !== "none" ? plan.shifts[0] ?? null : null; },
      resolveLast: (id, date) => { const plan = resolvePlan(id, date); return plan.kind !== "none" ? plan.shifts[plan.shifts.length - 1] ?? null : null; },
    };
    const policies = await loadPdksPolicies(ctx, [args.projectId], addWorkDate(range.start, -7), addWorkDate(range.end, 1));
    const needsHistory = hasVersionedPdksPolicy(policies, args.projectId, addWorkDate(range.start, -1), range.end)
      || [...shifts.shifts.values()].some(usesShiftDayRules)
      || employees.some(employee => buildPeriodDateKeys(addWorkDate(range.start, -1), addWorkDate(range.end, 1)).some(date => usesPlanDayRules(shifts.resolvePlan(employee._id, date))));
    const linkedStart = needsHistory ? range.startISO : trDayRangeISO(range.start, range.end).startISO;
    const budget = pdksReadBudget();
    const raw: Doc<"cardReadings">[] = [...args.unlinked];
    for (const employee of employees) raw.push(...await readBoundedPdks(ctx.db.query("cardReadings").withIndex("by_project_employee_time", q => q.eq("projectId", args.projectId).eq("employeeId", employee._id).gte("accessTime", linkedStart).lte("accessTime", range.endISO)), budget));
    raw.sort((a, b) => a.accessTime.localeCompare(b.accessTime) || a._creationTime - b._creationTime);
    const report = await loadRuleReportDays(ctx, [args.projectId], range.start, range.end, { includeLegacyReadings: false, preloadedEmployees: employees,
      shiftResolver: shifts, preloadedReadings: { readings: raw, startISO: linkedStart, endISO: range.endISO } });
    const workDate = dashboardWorkDateResolver(employees, shifts, report.workDate);
    const activityRange = trDayRangeISO(range.start, range.end);
    const readings = filterPdksReadings(raw.filter(reading => reading.accessTime >= activityRange.startISO && reading.accessTime <= activityRange.endISO), undefined, reading => report.policies(reading.projectId, workDate(reading)));
    const dates = buildPeriodDateKeys(args.startDate, args.endDate);
    const targets = employees.filter(employee => (!args.employeeId || employee._id === args.employeeId) && dates.some(date => shifts.resolvePlan(employee._id, date).kind !== "none"));
    const owners = new Map(targets.filter(employee => employee.cardNumber).map(employee => [employee.cardNumber, employee._id]));
    const byEmployee = new Map<string, Doc<"cardReadings">[]>();
    for (const reading of readings) {
      const owner = reading.employeeId ?? owners.get(reading.cardNo);
      if (!owner) continue;
      const own = byEmployee.get(owner) ?? []; own.push(reading); byEmployee.set(owner, own);
    }
    const workSettings = await getEffectiveWorkSettings(ctx, args.projectId);
    return targets.map(employee => {
      const buckets = bucketWeeklyOvertime(annualOvertimeDayEntries({ employeeId: employee._id, readings: byEmployee.get(employee._id) ?? [], shiftResolver: shifts,
        workSettings, policyFor: date => report.policies(employee.projectId, date), startDate: args.startDate, endDate: args.endDate,
        managedDates: new Set(report.ruleRows.get(employee._id)?.days.map(day => day.date)) }));
      const total = buckets.reduce((sum, bucket) => sum + bucket.overtimeMinutes + bucket.premiumMinutes, 0)
        + (report.ruleRows.get(employee._id)?.days.filter(day => day.date >= args.startDate && day.date <= args.endDate).reduce((sum, day) => sum + day.overtimeMinutes, 0) ?? 0);
      const limit = ANNUAL_OVERTIME_LIMIT_MINUTES;
      return { employeeId: employee._id, firstName: employee.firstName, lastName: employee.lastName, totalOvertimeMinutes: total,
        totalOvertimeHours: Math.round(total / 60 * 10) / 10, limitHours: limit / 60, remainingHours: Math.max(0, (limit - total) / 60),
        utilizationPct: Math.min(100, Math.round(total / limit * 100)), exceedsDaily11h: buckets.flatMap(bucket => bucket.exceedsDaily11h) };
    });
  },
});
