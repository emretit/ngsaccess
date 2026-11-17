import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getEffectiveWorkSettings } from "./pdksHelpers";
import { buildShiftResolver, thresholdsForShift } from "./shiftResolver";
import { loadPdksPolicies } from "./pdksRules";
import { filterPdksReadings } from "./pdksSource";
import { addWorkDate, buildPdksWorkDateResolver } from "./pdksWorkDay";
import { shiftForInstant, splitReadingsByShift } from "./pdksMultiShift";
import { relativeMinute } from "./pdksFlexible";
import { validFixedPunch } from "./pdksFixedRules";
import { trDateKey, trDayRangeISO } from "./trDate";

/** Notify only the first eligible entry of its dated shift piece. The reading and
 * scheduled notification commit together, so concurrent/repeated punches cannot resend. */
export async function notifyLateReading(ctx: MutationCtx, employee: Doc<"employees">, readingId: Id<"cardReadings">): Promise<void> {
  const projectId = employee.projectId;
  if (!projectId || employee.isVisitor) return;
  const current = await ctx.db.get(readingId);
  if (!current || current.accessStatus !== "izin_verildi") return;
  const calendarDate = trDateKey(current.accessTime);
  const previous = addWorkDate(calendarDate, -1);
  const policies = await loadPdksPolicies(ctx, [projectId], previous, calendarDate);
  const resolver = await buildShiftResolver(ctx, [employee], { start: previous, end: calendarDate });
  const { startISO } = trDayRangeISO(previous, calendarDate);
  const candidates = await ctx.db.query("cardReadings").withIndex("by_employee_status_time", q =>
    q.eq("employeeId", employee._id).eq("accessStatus", "izin_verildi")
      .gte("accessTime", startISO).lte("accessTime", current.accessTime)).take(1001);
  // Do not turn a truncated history into a false "first entry" notification.
  if (candidates.length > 1000) return;
  const workDateFor = buildPdksWorkDateResolver([employee], (id, date) => resolver.resolve(id, date), {
    readings: candidates,
    eligibleEntry: (reading, date) => filterPdksReadings([reading], projectId, r => policies(r.projectId, date ?? trDateKey(r.accessTime))).length > 0,
  }, (reading, date) => policies(reading.projectId, date), (id, date) => resolver.resolveLast(id, date));
  const readings = filterPdksReadings(candidates, projectId, reading => policies(reading.projectId, workDateFor(reading)));
  const entry = readings.find(reading => reading._id === readingId);
  if (entry?.direction !== "entry") return;
  const date = workDateFor(entry);
  const plan = resolver.resolvePlan(employee._id, date);
  if (plan.kind !== "shifts") return;
  const shift = shiftForInstant(date, entry.accessTime, plan, "entry");
  if (!shift || shift.scheduleType === "flexible") return;
  const index = plan.shifts.findIndex(piece => piece._id === shift._id);
  const bucket = splitReadingsByShift(date, readings.filter(reading => workDateFor(reading) === date), plan.shifts)[index] ?? [];
  const firstEntry = bucket.find(reading => reading.direction === "entry" &&
    (!shift.validWindow || validFixedPunch(shift.validWindow, date, reading.accessTime, "entry")));
  if (firstEntry?._id !== readingId) return;
  const settings = await getEffectiveWorkSettings(ctx, projectId);
  if (relativeMinute(date, entry.accessTime) <= thresholdsForShift(shift, settings).lateThresholdMin) return;
  const [notifications] = await ctx.db.query("notificationSettings").withIndex("by_project", q => q.eq("projectId", projectId)).take(1);
  if (notifications?.lateNotifications === false) return;
  const [general] = await ctx.db.query("generalSettings").withIndex("by_project", q => q.eq("projectId", projectId)).take(1);
  const to = general?.email ?? process.env.NOTIFICATION_EMAIL;
  if (!to) return;
  await ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendLateNotification, {
    to, employeeName: `${employee.firstName} ${employee.lastName}`, projectId,
    lateTime: new Date(entry.accessTime).toLocaleTimeString("tr-TR", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
    }),
  });
}
