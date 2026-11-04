import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { ShiftResolver } from "./shiftResolver";
import { loadPayrollPeriod, type PayrollReadings } from "./pdksPayrollQuery";

import { addWorkDate, pdksWorkDayRange } from "./pdksWorkDay";

/** One bounded raw project scan shared by the SGK day and payroll adapters.
 * Eight preceding days cover ISO-week settlement, split Sunday and flexible entry.
 * Each consumer still applies its own date and policy boundaries. */
export async function loadPayrollReportReadings(ctx: QueryCtx, projectIds: Id<"projects">[], startDate: string, endDate: string): Promise<PayrollReadings> {
  const range = pdksWorkDayRange(addWorkDate(startDate, -8), endDate);
  const lists = await Promise.all(projectIds.map(projectId => ctx.db.query("cardReadings")
    .withIndex("by_project_access_time", q => q.eq("projectId", projectId).gte("accessTime", range.startISO).lte("accessTime", range.endISO)).take(20001)));
  if (lists.some(readings => readings.length > 20000)) throw new Error("Rapor okuma sınırı aşıldı; tarih aralığını daraltın");
  return { ...range, readings: lists.flat() };
}

type PayrollRow = Awaited<ReturnType<typeof loadPayrollPeriod>>["rows"][number];

/** Legacy report membership is retained, but durations come from payroll's net cells.
 * No report-specific break, daily threshold or weekly settlement is applied here. */
export function legacyAttendanceDays(
  cells: readonly Pick<PayrollRow["cells"][number], "date" | "noShift" | "totalMinutes">[],
  attendanceDates: ReadonlySet<string>,
): Map<string, number> {
  const byDate = new Map(cells.filter(cell => !cell.noShift).map(cell => [cell.date, cell.totalMinutes]));
  return new Map([...attendanceDates].map(date => [date, byDate.get(date) ?? 0]));
}

/** One settlement per project and period, also for annual summaries spanning month boundaries. */
export async function loadPayrollReport(
  ctx: QueryCtx & { user: Doc<"users"> }, projectIds: Id<"projects">[], startDate: string, endDate: string,
  preloaded: { employees?: Doc<"employees">[]; planResolvers?: ReadonlyMap<Id<"projects">, ShiftResolver>; readings?: PayrollReadings } = {},
) {
  const rows = (await Promise.all(projectIds.map(async projectId => {
    const result = await loadPayrollPeriod(ctx, { projectId, startDate, endDate }, undefined, {
      employees: preloaded.employees?.filter(employee => employee.projectId === projectId),
      shiftResolver: preloaded.planResolvers?.get(projectId),
      readings: preloaded.readings,
    });
    return result.rows.map(row => ({ ...row, projectId }));
  }))).flat();
  return new Map(rows.map(row => [row.employeeId, row]));
}

/** An optional report rate changes only the hourly amount, never the engine's weights. */
export function payrollOvertimeCost(row: PayrollRow, hourlyRate: number | null): number | null {
  if (hourlyRate === null) return null;
  return row.cells.reduce((sum, cell) => sum + cell.overtimeMinutes * cell.multiplier / 60 * hourlyRate, 0);
}
