import { flexibleSchedule, relativeMinute, validFlexibleEntry, validFlexibleExit, type ShiftSchedule } from "./pdksFlexible";
import type { Doc, Id } from "../_generated/dataModel";
import { isoTimeToTRMinutes, parseHHMM } from "./pdksHelpers";
import { effectiveDirection, matchesPdksCheckpoint, type PdksDayPolicy } from "./pdksRules";
import { trDateKey, trDayRangeISO } from "./trDate";

export type PdksShift = ShiftSchedule;
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
  const flex = flexibleSchedule(shift);
  return flex ? flex.checkOutEndDayOffset === 1 : !!shift && parseHHMM(shift.endTime) <= parseHHMM(shift.startTime);
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
  const flex = flexibleSchedule(previous);
  if (flex) return direction === "exit" && validFlexibleExit(flex, relativeMinute(previousDate, accessTime)) ? previousDate : date;
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
  manualEntryFor?: (employeeId: Id<"employees">, date: string) => string | undefined,
  eligibleEntry?: (reading: T) => boolean,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  // Entries open their calendar day. A previous open session can start a night
  // tail; subsequent directed exits on that tail retain its last-exit rule.
  const active = new Map<string, { first: string; open: boolean; nightTail?: boolean }>();
  const markConflict = (workDate: string) => {
    const prior = result.get(workDate);
    if (prior) result.set(workDate, prior.map(item => ({ ...item, flexibleConflict: true })));
  };
  for (const reading of [...readings].sort((a, b) => a.accessTime.localeCompare(b.accessTime))) {
    const date = trDateKey(reading.accessTime);
    const previousDate = addWorkDate(date, -1);
    const currentFlex = flexibleSchedule(resolve(employeeId, date));
    const previousFlex = flexibleSchedule(resolve(employeeId, previousDate));
    let key = pdksWorkDay(
      reading.accessTime,
      employeeId,
      resolve,
      reading.direction,
    );
    if ((currentFlex || previousFlex) && (!("accessStatus" in reading) || reading.accessStatus === "izin_verildi")) {
      // Preserve the fixed night rule when only the current schedule is flexible.
      key = previousFlex || reading.direction === "entry" ? date : key;
      let conflict = false;
      for (const [workDate, flex] of [[previousDate, previousFlex], [date, currentFlex]] as const) {
        const manualEntry = manualEntryFor?.(employeeId, workDate);
        if (flex && manualEntry && !active.has(workDate)) {
          const iso = `${workDate}T${manualEntry}:00+03:00`;
          if (Date.parse(iso) <= Date.parse(reading.accessTime) && validFlexibleEntry(flex, relativeMinute(workDate, iso))) active.set(workDate, { first: new Date(iso).toISOString(), open: true });
        }
      }
      const previous = active.get(previousDate);
      const current = active.get(date);
      const previousExit = previousFlex && previous && !current
        && validFlexibleExit(previousFlex, relativeMinute(previousDate, reading.accessTime), relativeMinute(previousDate, previous.first));
      const currentEntry = currentFlex && validFlexibleEntry(currentFlex, relativeMinute(date, reading.accessTime))
        && (!eligibleEntry || eligibleEntry(reading));
      const undirected = reading.direction !== "entry" && reading.direction !== "exit";
      // An undirected repeat on a closed night tail stays on D unless it can open D+1.
      if (undirected && previousExit && (previous.open || previous.nightTail && !currentEntry)) {
        if (currentEntry) {
          conflict = true;
          previous.open = false;
          markConflict(previousDate);
          active.set(date, { first: reading.accessTime, open: true });
        } else {
          key = previousDate;
          previous.open = false;
          previous.nightTail = true;
        }
      } else if (reading.direction === "exit" && previousExit && (previous.open || previous.nightTail)) {
        // A tail already closed on D+1 may extend to its last exit on D+1.
        // An ordinary session closed on D must never consume an orphan D+1 exit.
        key = previousDate;
        previous.open = false;
        previous.nightTail = true;
      } else if ((reading.direction === "entry" || undirected && key === date) && currentEntry) {
        if (previous?.open && previousFlex && validFlexibleExit(previousFlex, relativeMinute(previousDate, reading.accessTime), relativeMinute(previousDate, previous.first))) {
          conflict = true;
          markConflict(previousDate);
        }
        active.set(date, { first: current?.first ?? reading.accessTime, open: true });
      } else if (reading.direction === "exit" && currentFlex && current
          && validFlexibleExit(currentFlex, relativeMinute(date, reading.accessTime), relativeMinute(date, current.first))) {
        current.open = false;
      }
      if (conflict) {
        const bucket = result.get(key) ?? [];
        bucket.push({ ...reading, flexibleConflict: true });
        result.set(key, bucket);
        continue;
      }
    }
    const bucket = result.get(key) ?? [];
    bucket.push(reading);
    result.set(key, bucket);
  }
  for (const bucket of result.values())
    bucket.sort((a, b) => a.accessTime.localeCompare(b.accessTime));
  return result;
}

/** Gate loaders by assigned schedules in the requested scope, including night tails. */
export function hasFlexiblePdksShift(
  employees: readonly Doc<"employees">[], resolve: PdksShiftResolver, startDate: string, endDate: string,
) {
  const dates: string[] = [];
  for (let date = addWorkDate(startDate, -1), last = addWorkDate(endDate, 1); date <= last; date = addWorkDate(date, 1)) dates.push(date);
  return employees.some(employee => dates.some(date => flexibleSchedule(resolve(employee._id, date))));
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
  const flex = flexibleSchedule(shift);
  const nextDay = flex
    ? flex.checkOutEndDayOffset === 1 && !!manual?.entryTime && !!manual.exitTime && manual.exitTime <= manual.entryTime
    : isOvernightShift(shift) &&
    !!manual?.entryTime &&
    !!manual.exitTime &&
    (manual.exitTime < manual.entryTime ||
      (manual.exitTime === manual.entryTime && shift?.startTime === shift?.endTime));
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
type WorkDateReading = Pick<Doc<"cardReadings">, "accessTime" | "employeeId" | "cardNo" | "direction"> & Partial<Pick<Doc<"cardReadings">, "_id" | "deviceId" | "projectId" | "ideIoId" | "hikCardReaderNo">>;

export function buildPdksWorkDateResolver(
  employees: readonly Doc<"employees">[],
  resolve: PdksShiftResolver,
  options?: {
    readings: readonly Doc<"cardReadings">[];
    manualEntryFor?: (employeeId: Id<"employees">, date: string) => string | undefined;
    eligibleEntry?: (reading: Doc<"cardReadings">) => boolean;
  },
  policyFor?: (reading: WorkDateReading, date: string) => PdksDayPolicy,
) {
  const byId = new Map(
    employees.map((employee) => [String(employee._id), employee]),
  );
  const byCard = new Map(
    employees.map((employee) => [employee.cardNumber, employee]),
  );
  const employeeFor = (reading: Pick<Doc<"cardReadings">, "employeeId" | "cardNo">) =>
    (reading.employeeId ? byId.get(String(reading.employeeId)) : undefined) ?? byCard.get(reading.cardNo);
  // Resolve the previous shift's policy for a night tail before choosing a day.
  // This also preserves the previous version across a midnight rule transition.
  const withDirection = <T extends WorkDateReading>(reading: T): T => {
    if (!policyFor) return reading;
    const day = trDateKey(reading.accessTime);
    const previous = addWorkDate(day, -1);
    const employee = employeeFor(reading);
    const previousPolicy = policyFor(reading, previous);
    const previousDirection = effectiveDirection(reading, previousPolicy);
    const date = employee && matchesPdksCheckpoint(reading, previousPolicy) &&
      pdksWorkDay(reading.accessTime, employee._id, resolve, previousDirection) === previous ? previous : day;
    const direction = effectiveDirection(reading, policyFor(reading, date));
    return direction === reading.direction ? reading : { ...reading, direction };
  };
  // Build once on first use, after callers have loaded date-specific policies.
  let workDates: Map<string, string> | undefined;
  function preparedWorkDates() {
    if (workDates) return workDates;
    workDates = new Map();
    const byEmployee = new Map<string, { employee: Doc<"employees">; readings: Doc<"cardReadings">[] }>();
    for (const rawReading of options?.readings ?? []) {
      const reading = withDirection(rawReading);
      const employee = employeeFor(reading);
      if (!employee || reading.direction === "entry" && options?.eligibleEntry && !options.eligibleEntry(reading)) continue;
      const bucket = byEmployee.get(String(employee._id)) ?? { employee, readings: [] };
      bucket.readings.push(reading);
      byEmployee.set(String(employee._id), bucket);
    }
    for (const { employee, readings } of byEmployee.values()) {
      for (const [date, grouped] of groupPdksWorkDays(readings, employee._id, resolve, options?.manualEntryFor, options?.eligibleEntry)) {
        for (const reading of grouped) workDates.set(String(reading._id), date);
      }
    }
    return workDates;
  }
  return (rawReading: WorkDateReading) => {
    const reading = withDirection(rawReading);
    const employee = employeeFor(reading);
    const day = trDateKey(reading.accessTime);
    if (options && employee && reading._id && (flexibleSchedule(resolve(employee._id, day)) || flexibleSchedule(resolve(employee._id, addWorkDate(day, -1))))) {
      return preparedWorkDates().get(String(reading._id)) ?? day;
    }
    return employee
      ? pdksWorkDay(
          reading.accessTime,
          employee._id,
          resolve,
          reading.direction,
        )
      : day;
  };
}
