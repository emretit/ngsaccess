import { trCalendarDate } from "./trDate";

export function averageTRTime(timestamps: readonly string[]): string | null {
  const minutes = timestamps.map((timestamp) => {
    const date = trCalendarDate(timestamp);
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }).filter(Number.isFinite);
  if (minutes.length === 0) return null;
  const average = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
  return `${String(Math.floor(average / 60)).padStart(2, "0")}:${String(average % 60).padStart(2, "0")}`;
}

type DailyReading = {
  employeeId?: string;
  accessTime: string;
  direction?: "entry" | "exit";
};

export function summarizeDailyReadings(readings: readonly DailyReading[]) {
  const firstEntries = new Map<string, string>();
  const lastExits = new Map<string, string>();
  const latest = new Map<string, DailyReading>();
  for (const reading of readings) {
    if (!reading.employeeId) continue;
    const id = reading.employeeId;
    if (reading.direction !== "exit") {
      const first = firstEntries.get(id);
      if (!first || reading.accessTime < first) firstEntries.set(id, reading.accessTime);
    } else {
      const last = lastExits.get(id);
      if (!last || reading.accessTime > last) lastExits.set(id, reading.accessTime);
    }
    const previous = latest.get(id);
    if (!previous || reading.accessTime > previous.accessTime) latest.set(id, reading);
  }
  return {
    averageFirstEntry: averageTRTime([...firstEntries.values()]),
    averageLastExit: averageTRTime([...lastExits.values()]),
    insideBuilding: [...latest.values()].filter((reading) => reading.direction === "entry").length,
  };
}
