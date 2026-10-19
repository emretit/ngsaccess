import type { Doc, Id } from "../_generated/dataModel";
import { shiftTimeLabel, appliesOn, minute, scheduleIntervals, validateRange, type ScheduleRange } from "./shiftUx";

const DAY = 86_400_000;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const BULK_ASSIGN_LIMIT = 100;
export const ASSIGNMENT_SCAN_LIMIT = 5000;

export function shiftDateOffset(day: string, offset: number): string {
  return new Date(Date.parse(day) + offset * DAY).toISOString().slice(0, 10);
}

export function validateAssignRange(range: ScheduleRange): void {
  validateRange(range.startDate, range.endDate);
  if (range.weekPattern?.some(code => !WEEKDAYS.includes(code))) throw new Error("Geçersiz tekrar günü");
}

export type ShiftClock = Pick<Doc<"shifts">, "startTime" | "endTime">;
export interface ExistingShiftAssignment extends ScheduleRange {
  assignmentId: Id<"shiftAssignments">;
  shiftId: Id<"shifts">;
  shiftName: string;
  shift: ShiftClock;
}
export type AssignmentConflict = Omit<ExistingShiftAssignment, "shift"> & ShiftClock;
function intervalsOverlap(a: [number, number][], b: [number, number][]): boolean {
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
}): AssignmentDecision {
  validateAssignRange(input.range);
  const intervals = scheduleIntervals(input.range, input.shift);
  const base: AssignmentDecision = {
    status: "will_assign", reason: "Atanacak", occurrenceCount: intervals.length,
    conflict: null, leave: null, holiday: null,
  };
  if (input.shift.isActive === false) return { ...base, status: "skipped", reason: "Pasif vardiya atanamaz" };
  if (!intervals.length) return { ...base, status: "skipped", reason: "Seçilen aralıkta tekrar desenine uyan gün yok" };

  const touched = new Set<string>();
  for (const [start, end] of intervals) {
    for (let day = Math.floor(start / 1440); day * 1440 < end; day++) {
      touched.add(new Date(day * DAY).toISOString().slice(0, 10));
    }
  }
  for (const date of touched) {
    const leave = input.leaves.find(item => item.status === "approved" && item.startDate <= date && item.endDate >= date);
    if (leave && !base.leave) base.leave = { leaveId: leave._id, date, leaveType: leave.leaveType };
    const holiday = input.holidays.find(item => item.date === date);
    if (holiday && !base.holiday) base.holiday = { holidayId: holiday._id, date, name: holiday.name, isHalfDay: holiday.isHalfDay ?? false };
  }
  for (const existing of input.existing) {
    // Clip legacy long series before expanding, while preserving the previous night.
    const range = {
      ...existing,
      startDate: existing.startDate > shiftDateOffset(input.range.startDate, -1) ? existing.startDate : shiftDateOffset(input.range.startDate, -1),
      endDate: existing.endDate < shiftDateOffset(input.range.endDate, 1) ? existing.endDate : shiftDateOffset(input.range.endDate, 1),
    };
    const other = scheduleIntervals(range, existing.shift);
    if (intervalsOverlap(intervals, other)) {
      const { shift, ...assignment } = existing;
      base.conflict = { ...assignment, startTime: shift.startTime, endTime: shift.endTime };
      break;
    }
  }
  if (!input.calendarConfirmed && base.leave) return { ...base, status: "on_leave", reason: `İzin: ${base.leave.date}` };
  if (!input.calendarConfirmed && base.holiday) return { ...base, status: "holiday", reason: `${base.holiday.date}: ${base.holiday.name}` };
  if (!input.forceConfirm && base.conflict) return { ...base, status: "conflict", reason: `OVERLAP:1 ${base.conflict.shiftName} ${shiftTimeLabel(base.conflict)} (${base.conflict.startDate}–${base.conflict.endDate})` };
  return base;
}

/** Exact visible-day intersection, including the previous day's night tail. */
export function assignmentIntersectsRange(range: ScheduleRange, shift: ShiftClock, start: string, end: string): boolean {
  const first = range.startDate > shiftDateOffset(start, -1) ? range.startDate : shiftDateOffset(start, -1);
  const last = range.endDate < end ? range.endDate : end;
  const visibleStart = Date.parse(start) / 60000;
  const visibleEnd = Date.parse(shiftDateOffset(end, 1)) / 60000;
  const startMinute = minute(shift.startTime);
  let endMinute = minute(shift.endTime);
  if (endMinute <= startMinute) endMinute += 1440;
  for (let date = first; date <= last; date = shiftDateOffset(date, 1)) {
    const day = Date.parse(date) / 60000;
    if (appliesOn(range, date) && day + startMinute < visibleEnd && day + endMinute > visibleStart) return true;
  }
  return false;
}
