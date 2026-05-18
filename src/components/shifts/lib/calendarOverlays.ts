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
    const iso = d.toISOString().split("T")[0];
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
