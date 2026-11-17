import { OPEN_SHIFT_END, shiftEndLabel } from "./shiftRange";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { planShiftIds, validateShiftPlan, validatePlanStructure, type PlanRow, type ShiftPlan } from "./shiftPlan";
import type { Doc, Id } from "../_generated/dataModel";
import { shiftTimeLabel, scheduleIntervals, validateRange, type ScheduleRange } from "./shiftUx";

const DAY = 86_400_000;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const BULK_ASSIGN_LIMIT = 100;
export const ASSIGNMENT_SCAN_LIMIT = 5000;

export function shiftDateOffset(day: string, offset: number): string {
  return new Date(Math.min(Date.parse(OPEN_SHIFT_END), Date.parse(day) + offset * DAY)).toISOString().slice(0, 10);
}

export function validateAssignRange(range: ScheduleRange): void {
  validateRange(range.startDate, range.endDate);
  if (range.weekPattern?.some(code => !WEEKDAYS.includes(code))) throw new Error("Geçersiz tekrar günü");
}

export type ShiftClock = Pick<Doc<"shifts">, "startTime" | "endTime" | "scheduleType" | "flexible">;
export interface ExistingShiftAssignment extends ScheduleRange {
  assignmentId: Id<"shiftAssignments">;
  shiftId: Id<"shifts">;
  shiftName: string;
  shift: ShiftClock;
}
export type AssignmentConflict = Omit<ExistingShiftAssignment, "shift"> & ShiftClock;
export function intervalsOverlap(a: [number, number][], b: [number, number][]): boolean {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const [start, end] = a[i];
    const [otherStart, otherEnd] = b[j];
    if (start < otherEnd && end > otherStart) return true;
    if (end <= otherStart) i++;
    else j++;
  }
  return false;
}
export interface AssignmentDecision {
  status: "will_assign" | "conflict" | "on_leave" | "holiday" | "skipped";
  reason: string;
  occurrenceCount: number;
  conflict: AssignmentConflict | null;
  leave: { leaveId: Id<"leaves">; date: string; leaveType: Doc<"leaves">["leaveType"] } | null;
  holiday: { holidayId: Id<"holidays">; date: string; name: string; isHalfDay: boolean } | null;
}

/** Work intervals use TR civil dates; midnight splits a night shift into two days.
 * Empty/missing weekPattern retains the existing meaning: every day. */
export function evaluateShiftAssignment(input: {
  range: ScheduleRange;
  shift: ShiftClock & { isActive?: boolean };
  existing: ExistingShiftAssignment[];
  leaves: Pick<Doc<"leaves">, "_id" | "status" | "startDate" | "endDate" | "leaveType">[];
  holidays: Pick<Doc<"holidays">, "_id" | "date" | "name" | "isHalfDay">[];
  forceConfirm?: boolean;
  calendarConfirmed?: boolean;
  shifts?: ReadonlyMap<string, ShiftClock>;
}): AssignmentDecision {
  validateAssignRange(input.range);
  const occurrenceCount = countScheduledOccurrences(input.range, input.shift, input.shifts);
  const base: AssignmentDecision = {
    status: "will_assign", reason: "Atanacak", occurrenceCount,
    conflict: null, leave: null, holiday: null,
  };
  if (input.shift.isActive === false) return { ...base, status: "skipped", reason: "Pasif vardiya atanamaz" };

  // Weekly patterns need a selected work date; cycle rest-only assignments remain valid.
  if (!occurrenceCount && (!input.range.plan || input.range.plan.kind === "weekly")) return { ...base, status: "skipped", reason: "Seçilen günlere denk gelen tarih yok" };

  for (const leave of input.leaves) {
    if (leave.status !== "approved") continue;
    const date = firstScheduledTouch(input.range, input.shift, leave.startDate, leave.endDate, input.shifts);
    if (date && (!base.leave || date < base.leave.date)) base.leave = { leaveId: leave._id, date, leaveType: leave.leaveType };
  }
  for (const holiday of input.holidays) {
    const date = firstScheduledTouch(input.range, input.shift, holiday.date, holiday.date, input.shifts);
    if (date && (!base.holiday || date < base.holiday.date)) base.holiday = { holidayId: holiday._id, date, name: holiday.name, isHalfDay: holiday.isHalfDay ?? false };
  }
  for (const existing of input.existing) {
    // Clip legacy long series before expanding, while preserving the previous night.
    const range = {
      ...existing,
      startDate: existing.startDate > shiftDateOffset(input.range.startDate, -1) ? existing.startDate : shiftDateOffset(input.range.startDate, -1),
      endDate: existing.endDate < shiftDateOffset(input.range.endDate, 1) ? existing.endDate : shiftDateOffset(input.range.endDate, 1),
    };
    const ownsSameDate = existing.startDate <= input.range.endDate && existing.endDate >= input.range.startDate;
    // Ayrı dönemlerde yalnız gece vardiyasının sınırdaki devamı kesişebilir.
    const currentBoundary = {
      ...input.range,
      startDate: input.range.startDate > shiftDateOffset(existing.startDate, -1) ? input.range.startDate : shiftDateOffset(existing.startDate, -1),
      endDate: input.range.endDate < shiftDateOffset(existing.endDate, 1) ? input.range.endDate : shiftDateOffset(existing.endDate, 1),
    };
    if (ownsSameDate || intervalsOverlap(scheduleIntervals(currentBoundary, input.shift, input.shifts), scheduleIntervals(range, existing.shift, input.shifts))) {
      const { shift, ...assignment } = existing;
      base.conflict = { ...assignment, ...shift };
      break;
    }
  }
  if (!input.calendarConfirmed && base.leave) return { ...base, status: "on_leave", reason: `İzin: ${base.leave.date}` };
  if (!input.calendarConfirmed && base.holiday) return { ...base, status: "holiday", reason: `${base.holiday.date}: ${base.holiday.name}` };
  if (!input.forceConfirm && base.conflict) return { ...base, status: "conflict", reason: `OVERLAP:1 Mevcut planın üstünü örter: ${base.conflict.shiftName} ${shiftTimeLabel(base.conflict)} (${base.conflict.startDate}–${shiftEndLabel(base.conflict.endDate)})` };
  return base;
}

/** Sınırsız seri için de yalnız bir desen döngüsü açılır; toplam tam döngülerden hesaplanır. */
export function countScheduledOccurrences(range: ScheduleRange, shift: ShiftClock, shifts?: ReadonlyMap<string, ShiftClock>): number {
  const days = Math.floor((Date.parse(range.endDate) - Date.parse(range.startDate)) / DAY) + 1;
  if (days <= 0) return 0;
  const period = range.plan && range.plan.kind !== "weekly" ? range.plan.slots.length : 7;
  if (period < 1) return 0;
  const sample = { ...range, endDate: shiftDateOffset(range.startDate, Math.min(days, period) - 1) };
  const intervals = scheduleIntervals(sample, shift, shifts);
  if (days <= period) return intervals.length;
  const full = Math.floor(days / period);
  const remainderEnd = Date.parse(range.startDate) / 60000 + (days % period) * 1440;
  return full * intervals.length + intervals.filter(([start]) => start < remainderEnd).length;
}

/** Bir izin/tatil aralığındaki ilk çalışma günü, en fazla bir döngü ve gece devamından bulunur. */
function firstScheduledTouch(range: ScheduleRange, shift: ShiftClock, from: string, until: string, shifts?: ReadonlyMap<string, ShiftClock>): string | null {
  const startDate = range.startDate > shiftDateOffset(from, -1) ? range.startDate : shiftDateOffset(from, -1);
  const period = range.plan && range.plan.kind !== "weekly" ? range.plan.slots.length : 7;
  const sampleEnd = shiftDateOffset(startDate, period);
  const endDate = [range.endDate, until, sampleEnd].sort()[0];
  if (!endDate || startDate > endDate) return null;
  const windowStart = Date.parse(from) / 60000;
  const windowEnd = Date.parse(until) / 60000 + 1440;
  const interval = scheduleIntervals({ ...range, startDate, endDate }, shift, shifts).find(([start, end]) => start < windowEnd && end > windowStart);
  return interval ? new Date(Math.max(Math.floor(interval[0] / 1440) * DAY, Date.parse(from))).toISOString().slice(0, 10) : null;
}

/** Exact visible-day intersection, including the previous day's night tail. */
export function assignmentIntersectsRange(range: ScheduleRange, shift: ShiftClock, start: string, end: string, shifts?: ReadonlyMap<string, ShiftClock>): boolean {
  const first = range.startDate > shiftDateOffset(start, -1) ? range.startDate : shiftDateOffset(start, -1);
  const last = range.endDate < end ? range.endDate : end;
  const visibleStart = Date.parse(start) / 60000;
  const visibleEnd = Date.parse(end) / 60000 + 1440;
  return scheduleIntervals({ ...range, startDate: first, endDate: last }, shift, shifts)
    .some(([startMinute, endMinute]) => startMinute < visibleEnd && endMinute > visibleStart);
}


/** A single transaction owns the assignment and every secondary reference. */
export async function syncPlanRefs(ctx: MutationCtx, owner: { assignmentId: Id<"shiftAssignments"> } | { departmentAssignmentId: Id<"departmentShiftAssignments"> }, projectId: Id<"projects"> | undefined, plan?: ShiftPlan): Promise<void> {
  const existing = "assignmentId" in owner
    ? await ctx.db.query("shiftPlanRefs").withIndex("by_assignment", q => q.eq("assignmentId", owner.assignmentId)).take(2913)
    : await ctx.db.query("shiftPlanRefs").withIndex("by_department_assignment", q => q.eq("departmentAssignmentId", owner.departmentAssignmentId)).take(2913);
  if (existing.length > 2912) throw new ConvexError("Plan referans sınırı aşıldı");
  for (const ref of existing) await ctx.db.delete(ref._id);
  if (!plan) return;
  if (!projectId) throw new ConvexError("Plan için proje zorunludur");
  for (const shiftId of planShiftIds(plan)) await ctx.db.insert("shiftPlanRefs", { ...owner, projectId, shiftId });
}
export async function loadPlanShifts(ctx: QueryCtx | MutationCtx, row: Pick<PlanRow, "shiftId" | "plan">): Promise<Map<string, Doc<"shifts">>> {
  // Loading existing legacy rows must not impose the new write-time weekday requirement.
  if (row.plan) validatePlanStructure(row.plan, row.plan.kind === "weekly" ? WEEKDAYS : undefined);
  const ids = [...new Set([row.shiftId, ...planShiftIds(row.plan)])];
  const shifts = (await Promise.all(ids.map(id => ctx.db.get(id)))).filter((shift): shift is NonNullable<typeof shift> => shift !== null);
  return new Map(shifts.map(shift => [String(shift._id), shift]));
}
export async function normalizeAssignmentPlan(ctx: QueryCtx | MutationCtx, row: PlanRow & { projectId?: Id<"projects"> }) {
  if ((!row.plan || row.plan.kind === "weekly") && !row.weekPattern?.length) throw new ConvexError("En az bir çalışma günü seçin");
  const shifts = await loadPlanShifts(ctx, row);
  // Legacy inactive assignments keep their existing preview/skip behavior.
  const normalized = row.plan ? validateShiftPlan(row, shifts) : { shiftId: row.shiftId, plan: undefined };
  const shift = shifts.get(normalized.shiftId);
  if (!shift) throw new ConvexError("Vardiya bulunamadı");
  return { ...normalized, shift, shifts };
}
