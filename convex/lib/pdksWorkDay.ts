import type { Doc, Id } from "../_generated/dataModel";
import { isoTimeToTRMinutes, parseHHMM } from "./pdksHelpers";
import { trDateKey, trDayRangeISO } from "./trDate";

export type PdksShift = Pick<Doc<"shifts">, "startTime" | "endTime">;
export type PdksShiftResolver = (
  employeeId: Id<"employees">,
  date: string,
) => Doc<"shifts"> | null;

export function addWorkDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isOvernightShift(shift: PdksShift | null | undefined): boolean {
  return !!shift && parseHHMM(shift.endTime) <= parseHHMM(shift.startTime);
}

/** Resolve against the assigned previous and current shifts, never global work hours.
 * The gap midpoint separates a previous night's late exit from today's early entry;
 * a following daytime shift starts its own work day from its scheduled start. */
export function pdksWorkDay(
  accessTime: string,
  employeeId: Id<"employees">,
  resolve: PdksShiftResolver,
  direction?: string,
): string {
  const date = trDateKey(accessTime);
  const previousDate = addWorkDate(date, -1);
  const previous = resolve(employeeId, previousDate);
  if (!previous || !isOvernightShift(previous)) return date;
  const current = resolve(employeeId, date);
  const end = parseHHMM(previous.endTime);
  const nextStart = current
    ? parseHHMM(current.startTime)
    : parseHHMM(previous.startTime);
  const minute = isoTimeToTRMinutes(accessTime);
  if (direction === "entry" && current && minute >= nextStart) return date;
  const cutoff = end + Math.max(0, nextStart - end) / 2;
  return minute <= cutoff ? previousDate : date;
}

export function groupPdksWorkDays<
  T extends { accessTime: string; direction?: string },
>(
  readings: readonly T[],
  employeeId: Id<"employees">,
  resolve: PdksShiftResolver,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const reading of readings) {
    const key = pdksWorkDay(
      reading.accessTime,
      employeeId,
      resolve,
      reading.direction,
    );
    const bucket = result.get(key) ?? [];
    bucket.push(reading);
    result.set(key, bucket);
  }
  for (const bucket of result.values())
    bucket.sort((a, b) => a.accessTime.localeCompare(b.accessTime));
  return result;
}

/** Include the following calendar day; consumers retain only requested work days. */
export function pdksWorkDayRange(startDate: string, endDate: string) {
  return trDayRangeISO(startDate, addWorkDate(endDate, 1));
}

export function manualPdksTimes(
  date: string,
  manual: { entryTime?: string; exitTime?: string } | undefined,
  shift: PdksShift | null,
) {
  const nextDay =
    isOvernightShift(shift) &&
    !!manual?.entryTime &&
    !!manual.exitTime &&
    manual.exitTime <= manual.entryTime;
  return {
    entryISO: manual?.entryTime
      ? `${date}T${manual.entryTime}:00.000+03:00`
      : undefined,
    exitISO: manual?.exitTime
      ? `${nextDay ? addWorkDate(date, 1) : date}T${manual.exitTime}:00.000+03:00`
      : undefined,
    exitNextDay: nextDay,
  };
}

/** Project availability uses the same work-day attribution as attendance pairs.
 * Unmatched readings retain their calendar day, as before. */
export function buildPdksWorkDateResolver(
  employees: readonly Doc<"employees">[],
  resolve: PdksShiftResolver,
) {
  const byId = new Map(
    employees.map((employee) => [String(employee._id), employee]),
  );
  const byCard = new Map(
    employees.map((employee) => [employee.cardNumber, employee]),
  );
  return (
    reading: Pick<
      Doc<"cardReadings">,
      "accessTime" | "employeeId" | "cardNo" | "direction"
    >,
  ) => {
    const employee =
      (reading.employeeId ? byId.get(String(reading.employeeId)) : undefined) ??
      byCard.get(reading.cardNo);
    return employee
      ? pdksWorkDay(
          reading.accessTime,
          employee._id,
          resolve,
          reading.direction,
        )
      : trDateKey(reading.accessTime);
  };
}
