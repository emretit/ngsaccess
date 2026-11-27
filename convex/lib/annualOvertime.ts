import type { Id } from "../_generated/dataModel";
import { addWorkDate } from "./pdksWorkDay";
import { ANNUAL_OVERTIME_LIMIT_MINUTES } from "./overtimeCalc";

export type AnnualBalanceRow = {
  employeeId: Id<"employees">; firstName: string; lastName: string;
  totalOvertimeMinutes: number; totalOvertimeHours: number; limitHours: number;
  remainingHours: number; utilizationPct: number; exceedsDaily11h: string[];
};

/** Weeks are aligned to Monday; the first/last week contains only this year's days. */
export function annualOvertimeRanges(year: number) {
  if (!Number.isInteger(year) || year < 1000 || year > 9998) throw new Error("Geçerli bir yıl seçin");
  const end = `${year}-12-31`;
  const ranges: { startDate: string; endDate: string }[] = [];
  for (let start = `${year}-01-01`; start <= end;) {
    const weekday = new Date(`${start}T12:00:00Z`).getUTCDay();
    const last = addWorkDate(start, (7 - weekday) % 7);
    const endDate = last > end ? end : last;
    ranges.push({ startDate: start, endDate });
    start = addWorkDate(endDate, 1);
  }
  return ranges;
}

export function mergeAnnualBalances(parts: readonly AnnualBalanceRow[][]): AnnualBalanceRow[] {
  const result = new Map<Id<"employees">, AnnualBalanceRow>();
  for (const rows of parts) for (const row of rows) {
    const previous = result.get(row.employeeId);
    result.set(row.employeeId, { ...row,
      totalOvertimeMinutes: (previous?.totalOvertimeMinutes ?? 0) + row.totalOvertimeMinutes,
      exceedsDaily11h: [...(previous?.exceedsDaily11h ?? []), ...row.exceedsDaily11h],
    });
  }
  return [...result.values()].map(row => ({ ...row,
    totalOvertimeHours: Math.round(row.totalOvertimeMinutes / 60 * 10) / 10,
    remainingHours: Math.max(0, (ANNUAL_OVERTIME_LIMIT_MINUTES - row.totalOvertimeMinutes) / 60),
    utilizationPct: Math.min(100, Math.round(row.totalOvertimeMinutes / ANNUAL_OVERTIME_LIMIT_MINUTES * 100)),
  })).sort((a, b) => b.utilizationPct - a.utilizationPct);
}

