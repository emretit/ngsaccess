import { formatTrDate } from "@/lib/date";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import {
  assignmentTouchesDay,
  scheduleIntervals,
} from "../../../../convex/lib/shiftUx";
import {
  assignmentAppliesOnDate,
  holidayOn,
  leaveForEmployeeOn,
  type Leave,
  type Holiday,
} from "./calendarOverlays";
export type Employee = FunctionReturnType<typeof api.employees.list>[number];
export type Shift = FunctionReturnType<typeof api.shifts.list>[number];
export type Assignment = FunctionReturnType<
  typeof api.shifts.listAssignments
>[number];
export type Preview = FunctionReturnType<typeof api.shifts.previewBulkAssign>;
export type Apply = FunctionReturnType<typeof api.shifts.bulkAssignShift>;
export type Period = "week" | "month" | "day";
export const DAYS = [
  ["MON", "Pzt"],
  ["TUE", "Sal"],
  ["WED", "Çar"],
  ["THU", "Per"],
  ["FRI", "Cum"],
  ["SAT", "Cmt"],
  ["SUN", "Paz"],
] as const;
export function istanbulToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
  }).format(now);
}
export function offsetDay(day: string, offset: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function visibleRange(day: string, period: Period) {
  if (period === "day") return { rangeStart: day, rangeEnd: day, days: [day] };
  const d = new Date(`${day}T12:00:00Z`);
  const start =
    period === "week"
      ? offsetDay(day, -((d.getUTCDay() + 6) % 7))
      : `${day.slice(0, 7)}-01`;
  const count =
    period === "week"
      ? 7
      : new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        ).getUTCDate();
  return {
    rangeStart: start,
    rangeEnd: offsetDay(start, count - 1),
    days: Array.from({ length: count }, (_, i) => offsetDay(start, i)),
  };
}
export function nextPeriod(day: string, period: Period, direction: number) {
  if (period !== "month")
    return offsetDay(day, direction * (period === "week" ? 7 : 1));
  const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + direction);
  return d.toISOString().slice(0, 10);
}
export function dayLabel(day: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "short",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(`${day}T12:00:00Z`));
}
export const decisionLabels = {
  will_assign: "Atanacak",
  conflict: "Mevcut vardiyayla çakışıyor",
  on_leave: "Onaylı izinle çakışıyor",
  holiday: "Tatil gününe denk geliyor",
  skipped: "Atlanacak",
  assigned: "Atandı",
  skipped_conflict: "Çakışma nedeniyle atlandı",
  skipped_leave: "İzin nedeniyle atlandı",
  failed: "Atanamadı",
};
export function decisionTone(
  status: keyof typeof decisionLabels,
): "success" | "warning" | "danger" | "info" | "neutral" {
  return status === "assigned"
    ? "success"
    : status === "will_assign"
      ? "neutral"
      : status === "on_leave" || status === "skipped_leave"
        ? "info"
        : status === "conflict" || status === "skipped_conflict"
          ? "danger"
          : "warning";
}
export function previewSummary(summary: Preview["summary"]) {
  return `${summary.total} kişi: ${summary.willAssign} atanacak, ${summary.conflict} çakışma, ${summary.onLeave} izin, ${summary.holiday} tatil, ${summary.skipped} atlanacak.`;
}
export function resultSummary(result: Apply) {
  return `${result.results.length} kişiden ${result.insertedCount} kişiye atama yapıldı. ${result.results.length - result.insertedCount} kişi atlandı.`;
}
export function cellData(
  employee: Employee,
  date: string,
  assignments: Assignment[],
  shifts: Shift[],
  leaves: Leave[],
  holidays: Holiday[],
) {
  const records = assignments.flatMap((a) => {
    const shift = shifts.find((s) => s._id === a.shiftId);
    return a.employeeId === employee._id &&
      shift &&
      assignmentTouchesDay(
        {
          ...a,
          startDate:
            a.startDate > offsetDay(date, -1)
              ? a.startDate
              : offsetDay(date, -1),
          endDate: a.endDate < date ? a.endDate : date,
        },
        shift,
        date,
      )
      ? [
          {
            assignment: a,
            shift,
            continuation: !assignmentAppliesOnDate(a, date),
          },
        ]
      : [];
  });
  const dayStart = Date.parse(date) / 60000;
  const intervals = records.map((r) =>
    scheduleIntervals(
      {
        ...r.assignment,
        startDate:
          r.assignment.startDate > offsetDay(date, -1)
            ? r.assignment.startDate
            : offsetDay(date, -1),
        endDate: r.assignment.endDate < date ? r.assignment.endDate : date,
      },
      r.shift,
    )
      .map(
        ([start, end]) =>
          [Math.max(start, dayStart), Math.min(end, dayStart + 1440)] as const,
      )
      .filter(([start, end]) => start < end),
  );
  const conflict = intervals.some((list, i) =>
    intervals
      .slice(i + 1)
      .some((other) =>
        list.some(([start, end]) =>
          other.some(
            ([otherStart, otherEnd]) => start < otherEnd && otherStart < end,
          ),
        ),
      ),
  );
  return {
    records,
    conflict,
    leave: leaveForEmployeeOn(date, employee._id, leaves),
    holiday: holidayOn(
      date,
      holidays.filter(
        (h) => !h.projectId || h.projectId === employee.projectId,
      ),
    ),
  };
}
export type DayData = ReturnType<typeof cellData>;

export { shiftTimeLabel } from "../../../../convex/lib/shiftUx";
export function shortDate(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) ? formatTrDate(date) : "Tarih seçilmedi";
}
export function shortDayLabel(day: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", weekday: "short", timeZone: "Europe/Istanbul" }).format(new Date(`${day}T12:00:00Z`));
}
export function assignmentInitial(day: string, employeeIds?: string[]) {
  return { startDate: day, endDate: day, ...(employeeIds ? { employeeIds } : {}) };
}

/** Old deployments may still include ISO keys inside conflict/error messages. */
export function shiftMessage(message: string) {
  return message.replace(/\b\d{4}-\d{2}-\d{2}\b/g, shortDate);
}
