import { scheduleIntervals } from "../../../../convex/lib/shiftUx";
import { planShiftIds } from "../../../../convex/lib/shiftPlan";
import type { Shift } from "./planning";
import { toLocalDateString } from "@/lib/date";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type Holiday = FunctionReturnType<typeof api.holidays.listForRange>[number];
export type Leave = FunctionReturnType<typeof api.leaves.listForRange>[number];
export type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];

const WEEKDAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function weekdayCodeForDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return WEEKDAY_CODES[d.getUTCDay()];
}

export function holidayOn(iso: string, holidays: Holiday[]): Holiday | null {
  return holidays.find((h) => h.date === iso) ?? null;
}

export function leaveForEmployeeOn(
  iso: string,
  employeeId: string,
  leaves: Leave[],
): Leave | null {
  return (
    leaves.find(
      (l) =>
        String(l.employeeId) === employeeId &&
        l.status === "approved" &&
        iso >= l.startDate &&
        iso <= l.endDate,
    ) ?? null
  );
}

export function assignmentAppliesOnDate(
  a: Pick<Assignment, "startDate" | "endDate" | "weekPattern">,
  iso: string,
): boolean {
  if (iso < a.startDate || iso > a.endDate) return false;
  if (!a.weekPattern || a.weekPattern.length === 0) return true;
  return a.weekPattern.includes(weekdayCodeForDate(iso));
}

/** Calendar ownership includes rest days; a night tail alone does not own the next date. */
export function assignmentOwnsDate(a: Pick<Assignment, "startDate" | "endDate">, iso: string): boolean {
  return a.startDate <= iso && iso <= a.endDate;
}

/** Actual work on this date, including a previous day's overnight continuation. */
export function assignmentWorkingIntervalsOnDate(row: Assignment, iso: string, shifts: Shift[]) {
  const ids = row.plan ? planShiftIds(row.plan) : [row.shiftId];
  const referenced = new Map(ids.flatMap(id => {
    const shift = shifts.find(item => item._id === id);
    return shift ? [[id, shift] as const] : [];
  }));
  const first = referenced.values().next().value;
  if (!first || referenced.size !== ids.length) return [];
  const dayStart = Date.parse(iso) / 60000;
  const previous = new Date(`${iso}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const previousDate = previous.toISOString().slice(0, 10);
  return scheduleIntervals({ ...row, startDate: row.startDate > previousDate ? row.startDate : previousDate,
    endDate: row.endDate < iso ? row.endDate : iso }, first, referenced)
    .map(([start, end]) => [Math.max(start, dayStart), Math.min(end, dayStart + 1440)] as const)
    .filter(([start, end]) => start < end);
}

export function assignmentsConflictOnDate(assignments: Assignment[], iso: string, shifts: Shift[]) {
  return assignments.some((row, index) => assignments.slice(index + 1).some(other => {
    if (row.employeeId !== other.employeeId) return false;
    if (assignmentOwnsDate(row, iso) && assignmentOwnsDate(other, iso)) return true;
    // Preserve physical conflicts at the boundary where an earlier series ends overnight.
    return assignmentWorkingIntervalsOnDate(row, iso, shifts).some(([start, end]) =>
      assignmentWorkingIntervalsOnDate(other, iso, shifts).some(([a, b]) => start < b && a < end));
  }));
}

export interface RangeConflicts {
  leaveDates: { date: string; leaveType: string }[];
  holidayDates: { date: string; name: string }[];
}

export function findRangeConflicts(
  employeeId: string,
  startDate: string,
  endDate: string,
  leaves: Leave[],
  holidays: Holiday[],
  weekPattern?: string[],
): RangeConflicts {
  const leaveDates: { date: string; leaveType: string }[] = [];
  const holidayDates: { date: string; name: string }[] = [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const iso = toLocalDateString(d);
    if (weekPattern && weekPattern.length > 0 && !weekPattern.includes(weekdayCodeForDate(iso))) {
      continue;
    }
    const h = holidayOn(iso, holidays);
    if (h) holidayDates.push({ date: iso, name: h.name });
    const l = leaveForEmployeeOn(iso, employeeId, leaves);
    if (l) leaveDates.push({ date: iso, leaveType: l.leaveType });
  }
  return { leaveDates, holidayDates };
}

export const LEAVE_TYPE_LABEL_TR: Record<string, string> = {
  annual: "Yıllık",
  sick: "Hastalık",
  excuse: "Mazeret",
  unpaid: "Ücretsiz",
  parental: "Doğum/Ebeveyn",
  marriage: "Evlilik",
  bereavement: "Vefat",
  paternity: "Babalık",
  lactation: "Süt izni",
  compensatory: "Telafi",
};
