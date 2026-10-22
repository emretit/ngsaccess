import { bucketWeeklyOvertime } from "./overtimeCalc";
import { addWorkDate, manualPdksTimes } from "./pdksWorkDay";
import { trDateKey } from "./trDate";

type LegacyReading = { accessTime: string; direction?: string };
type ManualDay = { date: string; entryTime?: string; exitTime?: string };

/** Legacy first/last duration, with each supplied manual time overriding that endpoint. */
export function legacyAttendanceDays<T extends LegacyReading>(
  readings: readonly T[],
  manual: readonly ManualDay[] = [],
  workDate: (reading: T) => string = reading => trDateKey(reading.accessTime),
): Map<string, number> {
  const byDate = new Map<string, T[]>();
  for (const reading of readings) {
    const date = workDate(reading);
    const times = byDate.get(date) ?? [];
    times.push(reading);
    byDate.set(date, times);
  }
  const overrides = new Map(manual.map(record => [record.date, record]));
  for (const record of manual) {
    if (record.entryTime || record.exitTime) {
      if (!byDate.has(record.date)) byDate.set(record.date, []);
    }
  }
  return new Map([...byDate].map(([date, times]) => {
    times.sort((a, b) => Date.parse(a.accessTime) - Date.parse(b.accessTime));
    const record = overrides.get(date);
    const manualTimes = manualPdksTimes(date, record, null);
    // Legacy manual pairs have no assigned shift to supply their midnight rollover.
    if (record?.entryTime && record.exitTime && record.exitTime <= record.entryTime) {
      manualTimes.exitISO = `${addWorkDate(date, 1)}T${record.exitTime}:00.000+03:00`;
    }
    const single = times.length === 1 ? times[0] : undefined;
    // A lone raw punch may supply only the opposite manual endpoint. Unknown
    // direction is usable when its timestamp unambiguously follows/precedes it.
    const rawEntry = single && manualTimes.exitISO && !manualTimes.entryISO
      ? single.direction !== "exit" && Date.parse(single.accessTime) < Date.parse(manualTimes.exitISO) ? single.accessTime : undefined
      : times[0]?.accessTime;
    const rawExit = single && manualTimes.entryISO && !manualTimes.exitISO
      ? single.direction !== "entry" && Date.parse(single.accessTime) > Date.parse(manualTimes.entryISO) ? single.accessTime : undefined
      : times.length > 1 ? times[times.length - 1]?.accessTime : undefined;
    const first = manualTimes.entryISO ?? rawEntry;
    const last = manualTimes.exitISO ?? rawExit;
    const duration = first && last ? Math.floor((Date.parse(last) - Date.parse(first)) / 60000) : 0;
    return [date, Number.isFinite(duration) ? Math.max(0, duration) : 0];
  }));
}

/** Dates are Europe/Istanbul calendar dates; partial weeks retain the full 45-hour threshold. */
export function legacyOvertimeMinutes(days: ReadonlyMap<string, number>, singleDayStandard = true): number {
  if (singleDayStandard && days.size <= 1) {
    return Math.max(0, [...days.values()].reduce((sum, minutes) => sum + minutes, 0) - 8 * 60);
  }
  // Legacy days have no holiday premium classification. Only their calendar week matters.
  return bucketWeeklyOvertime([...days].map(([date, netMinutes]) => ({ date, netMinutes, classification: "workday" })))
    .reduce((sum, week) => sum + week.overtimeMinutes, 0);
}
