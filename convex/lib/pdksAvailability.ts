import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isPdksEligibleReading } from "./pdksSource";
import { pdksWorkDayRange } from "./pdksWorkDay";
import { trDateKey } from "./trDate";

/** Inputs are already scoped and filtered through the PDKS source boundary. */
export function pdksAvailableDateKeys(readings: readonly Doc<"cardReadings">[], workDate: (reading: Doc<"cardReadings">) => string = reading => trDateKey(reading.accessTime)): Set<string> {
  return new Set(readings.map(workDate));
}

/** Scan at most 20 indexed candidates; if all are excluded, use the selected period.
 * Unproven earlier history stays noData instead of manufacturing absences. */
export async function pdksFirstRecordDate(ctx: QueryCtx, employee: Doc<"employees">, readings: readonly Doc<"cardReadings">[], manualDates: readonly string[] = [], workDay: (reading: Doc<"cardReadings">) => string = reading => trDateKey(reading.accessTime)): Promise<string | null> {
  const candidates = await ctx.db.query("cardReadings")
    .withIndex("by_project_employee_time", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id))
    .order("asc").take(20);
  const first = candidates.find(r => r.projectId === employee.projectId && isPdksEligibleReading(r));
  const dates = [...manualDates, ...readings.filter(r => r.projectId === employee.projectId && (r.employeeId === employee._id || r.cardNo === employee.cardNumber)).map(workDay)];
  if (first && first.projectId === employee.projectId && isPdksEligibleReading(first)) dates.push(workDay(first));
  return dates.sort()[0] ?? null;
}

/** One pass over the project readings, shared by every employee row. */
export function pdksAvailableDatesByProject(readings: readonly Doc<"cardReadings">[], workDate: (reading: Doc<"cardReadings">) => string): Map<Id<"projects"> | undefined, Set<string>> {
  const result = new Map<Id<"projects"> | undefined, Set<string>>();
  for (const reading of readings) {
    let dates = result.get(reading.projectId);
    if (!dates) { dates = new Set(); result.set(reading.projectId, dates); }
    dates.add(workDate(reading));
  }
  return result;
}

export function pdksManualDatesByEmployee(records: Iterable<Doc<"pdksRecords">>): Map<Id<"employees">, string[]> {
  const result = new Map<Id<"employees">, string[]>();
  for (const record of records) {
    const dates = result.get(record.employeeId) ?? [];
    dates.push(record.date);
    result.set(record.employeeId, dates);
  }
  return result;
}

/** Legacy unscoped leave belongs to the employee in each caller's authorized project. */
export function pdksLeaveMatchesProject(leave: Pick<Doc<"leaves">, "projectId">, projectId: Id<"projects"> | undefined): boolean {
  return !leave.projectId || leave.projectId === projectId;
}

/** Indexed existence checks stop at the first eligible reading for each work day.
 * Include next-calendar-day exits and use all project employees' shift assignments. */
export async function readPdksAvailableDateKeys(ctx: QueryCtx, projectId: Id<"projects"> | undefined, dates: readonly string[], workDate: (reading: Doc<"cardReadings">) => string): Promise<Set<string>> {
  const available = await Promise.all(dates.map(async date => {
    const { startISO, endISO } = pdksWorkDayRange(date, date);
    const candidates = ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", projectId).gte("accessTime", startISO).lte("accessTime", endISO));
    for await (const reading of candidates) {
      if (isPdksEligibleReading(reading) && workDate(reading) === date) return date;
    }
    return null;
  }));
  return new Set(available.filter((date): date is string => date !== null));
}
