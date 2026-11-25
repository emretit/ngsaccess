import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { loadPdksRulePolicy, type PdksPolicyResolver, type PdksProjectPolicies } from "./pdksRules";
import { isPdksIncludedReading } from "./pdksSource";
import { clockMinute, flexibleSessionEnd } from "./pdksFlexible";
import { pdksWorkDayRange } from "./pdksWorkDay";
import { trDateKey } from "./trDate";
import { cardKey } from "./employeeUx";

/** Fixed rollout boundary preserves historical payroll for devices without old checkpoints.
 * Cursor values are event serial numbers, never timestamp watermarks. */
export const PDKS_COMPLETENESS_START = "2026-11-17";

export class PdksAvailableDates extends Set<string> {
  constructor(dates: ReadonlySet<string>, readonly devices: readonly Doc<"devices">[], readonly projectId: Id<"projects"> | undefined, readonly policies?: PdksProjectPolicies) {
    super(dates);
  }

  trackedDevices(date: string): readonly Doc<"devices">[] {
    if (date < PDKS_COMPLETENESS_START) return [];
    const policy = this.policies?.(this.projectId, date);
    return this.devices.filter(device => device.brand === "hikvision" && device.hikTransport !== "localBridge"
      && device.isActive !== false && trDateKey(new Date(device._creationTime).toISOString()) <= date
      && (policy?.checkpointMode !== "selected" || policy.targets.some(target => target.deviceId === device._id)));
  }

  override has(date: string): boolean {
    // Tracked days enter classification even after an empty scan.
    // pdksDataPending gates absence until every required device has completed.
    return super.has(date) || this.trackedDevices(date).length > 0;
  }
}

/** Keep IDE, mobile/QR, virtual readers and local-bridge devices on legacy availability.
 * Gateway Hikvision devices require a completed scan, including devices never scanned. */
export async function withPdksDeviceAvailability(ctx: QueryCtx, projectId: Id<"projects"> | undefined, dates: ReadonlySet<string>, policies?: PdksProjectPolicies, endDate?: string): Promise<ReadonlySet<string>> {
  if (endDate && endDate < PDKS_COMPLETENESS_START) return dates;
  const devices = await ctx.db.query("devices").withIndex("by_project", q => q.eq("projectId", projectId)).take(1001);
  if (devices.length > 1000) throw new Error("PDKS cihaz kapsamı sınırı aşıldı");
  if (!devices.some(device => device.brand === "hikvision" && device.hikTransport !== "localBridge" && device.isActive !== false)) return dates;
  return new PdksAvailableDates(dates, devices, projectId, policies);
}

/** Shared by table, detail and payroll after their assigned day plan is resolved. */
export function pdksDataPending(dates: ReadonlySet<string>, date: string, timing: {
  shift: Doc<"shifts"> | null;
  shiftEnd: string;
  earlyExitTolerance: number;
  pendingUntil?: number;
}, hasOwnRecord: boolean): boolean {
  if (hasOwnRecord || !(dates instanceof PdksAvailableDates)) return false;
  const shift = timing.shift;
  const endMinute = clockMinute(timing.shiftEnd) + (shift && timing.shiftEnd <= shift.startTime ? 1440 : 0);
  const window = shift?.validWindow;
  const windowEnd = window ? clockMinute(window.checkOutEnd) + window.checkOutEndDayOffset * 1440 : 0;
  const flexEnd = shift?.scheduleType === "flexible" && shift.flexible ? flexibleSessionEnd(shift.flexible) : 0;
  const start = Date.parse(`${date}T00:00:00+03:00`);
  const deadline = Math.max(timing.pendingUntil ?? 0, start + Math.max(endMinute + timing.earlyExitTolerance, windowEnd, flexEnd) * 60000);
  return dates.trackedDevices(date).some(device => {
    const pending = device.hikBackfillPending;
    // A pending replay overlapping this day invalidates even an existing watermark.
    const pendingStart = pending?.startTime ? Date.parse(pending.startTime) : Number.NEGATIVE_INFINITY;
    const overlaps = pending && pending.startedAt >= start && (!Number.isFinite(pendingStart) || pendingStart <= deadline);
    return !Number.isFinite(device.hikLastBackfillAt) || (device.hikLastBackfillAt ?? 0) < deadline || !!overlaps;
  });
}

/** Inputs are already scoped and filtered through the PDKS source boundary. */
export function pdksAvailableDateKeys(readings: readonly Doc<"cardReadings">[], workDate: (reading: Doc<"cardReadings">) => string = reading => trDateKey(reading.accessTime)): Set<string> {
  return new Set(readings.map(workDate));
}

/** Scan at most 20 indexed candidates; if all are excluded, use the selected period.
 * Unproven earlier history stays noData instead of manufacturing absences. */
export async function pdksFirstRecordDate(ctx: QueryCtx, employee: Doc<"employees">, readings: readonly Doc<"cardReadings">[], manualDates: readonly string[] = [], workDay: (reading: Doc<"cardReadings">) => string = reading => trDateKey(reading.accessTime), policies?: PdksProjectPolicies): Promise<string | null> {
  const candidates = await ctx.db.query("cardReadings")
    .withIndex("by_project_employee_time", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id))
    .order("asc").take(20);
  // At most 20 historical dates, each with one predecessor lookup and bounded targets.
  const historical = new Map<string, PdksPolicyResolver>();
  const historyStart = policies?.historyStart(employee.projectId);
  if (historyStart) {
    const dates = [...new Set(candidates.map(workDay).filter(date => date < historyStart))];
    await Promise.all(dates.map(async date => historical.set(date, await loadPdksRulePolicy(ctx, employee.projectId, date, date))));
  }
  const policyFor = (reading: Doc<"cardReadings">) => historical.get(workDay(reading))?.(workDay(reading)) ?? policies?.(reading.projectId, workDay(reading));
  const eligibleCandidates = candidates.filter(r => isPdksIncludedReading(r, employee.projectId, policyFor(r)));
  const employeeCard = cardKey(employee.cardNumber);
  const periodReadings = readings.filter(r => isPdksIncludedReading(r, employee.projectId, policyFor(r))).filter(r => r.employeeId === employee._id || (!r.employeeId && employeeCard !== undefined && r.cardNo === employee.cardNumber));
  const allowed = [...eligibleCandidates, ...periodReadings].filter(r => r.accessStatus === "izin_verildi");
  // Rejected attempts only preserve the legacy fallback when no granted record is known.
  const history = allowed.length > 0 ? allowed : [...eligibleCandidates.slice(0, 1), ...periodReadings];
  const dates = [...manualDates, ...history.map(workDay)];
  return dates.sort()[0] ?? null;
}

/** One pass over the project readings, shared by every employee row. */
export function pdksAvailableDatesByProject(readings: readonly Doc<"cardReadings">[], workDate: (reading: Doc<"cardReadings">) => string): Map<Id<"projects"> | undefined, ReadonlySet<string>> {
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
export async function readPdksAvailableDateKeys(ctx: QueryCtx, projectId: Id<"projects"> | undefined, dates: readonly string[], workDate: (reading: Doc<"cardReadings">) => string, policies?: PdksProjectPolicies): Promise<ReadonlySet<string>> {
  const available = await Promise.all(dates.map(async date => {
    const { startISO, endISO } = pdksWorkDayRange(date, date);
    const candidates = ctx.db.query("cardReadings").withIndex("by_project_access_time", q => q.eq("projectId", projectId).gte("accessTime", startISO).lte("accessTime", endISO));
    for await (const reading of candidates) {
      if (isPdksIncludedReading(reading, projectId, policies?.(reading.projectId, workDate(reading))) && workDate(reading) === date) return date;
    }
    return null;
  }));
  return withPdksDeviceAvailability(ctx, projectId, new Set(available.filter((date): date is string => date !== null)), policies, [...dates].sort().slice(-1)[0]);
}
