import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { isPdksEligibleReading } from "./pdksSource";

export const ATTENDANCE_TIME_ZONE = "Europe/Istanbul" as const;
export const SUMMARY_MAX_DAYS = 93;
export const SUMMARY_MAX_READINGS = 10_000;
const DAY_MS = 86_400_000;
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

type AttendanceErrorCode = "INVALID_ARGUMENT" | "INVALID_CURSOR" | "DEVICE_NOT_FOUND" | "SUMMARY_TOO_LARGE" | "SUMMARY_INVALID_DATA";
export function attendanceError(code: AttendanceErrorCode) {
  const messages: Record<AttendanceErrorCode, string> = {
    INVALID_ARGUMENT: "Geçersiz tarih aralığı veya sayfa boyutu",
    INVALID_CURSOR: "Geçmiş sayfası geçersiz; listeyi yenileyin",
    DEVICE_NOT_FOUND: "Cihaz bu projede bulunamadı",
    SUMMARY_TOO_LARGE: "Bu dönem için özet oluşturulamıyor; daha kısa bir dönem seçin",
    SUMMARY_INVALID_DATA: "Kayıt zamanları doğrulanamadığı için özet oluşturulamıyor",
  };
  return new ConvexError({ code, message: messages[code] });
}

function calendarDateMs(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw attendanceError("INVALID_ARGUMENT");
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
    throw attendanceError("INVALID_ARGUMENT");
  }
  return value;
}

/** Dates are inclusive Istanbul calendar dates; the DB upper bound is exclusive. */
export function attendanceDateRange(startDate?: string, endDate?: string, maxDays?: number) {
  const start = startDate === undefined ? undefined : calendarDateMs(startDate);
  const end = endDate === undefined ? undefined : calendarDateMs(endDate);
  if (start !== undefined && end !== undefined) {
    if (start > end) throw attendanceError("INVALID_ARGUMENT");
    if (maxDays !== undefined && (end - start) / DAY_MS + 1 > maxDays) {
      throw attendanceError("SUMMARY_TOO_LARGE");
    }
  }
  return {
    startISO: start === undefined ? undefined : new Date(start - ISTANBUL_OFFSET_MS).toISOString(),
    endISO: end === undefined ? undefined : new Date(end + DAY_MS - ISTANBUL_OFFSET_MS).toISOString(),
  };
}

export function attendancePageSize(numItems = 50): number {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > 100) {
    throw attendanceError("INVALID_ARGUMENT");
  }
  return numItems;
}

export type AttendanceCursor = {
  version: 1;
  context: string;
  snapshotCreationTime: number;
  position: string;
};

/** This envelope binds pagination to the server-resolved identity and filter set.
 * It is not an authorization credential: every DB range still uses ctx.employee. */
export function parseAttendanceCursor(
  cursor: string, context: string, prefix: readonly string[], isReadingId: (value: string) => boolean,
): AttendanceCursor {
  try {
    if (cursor.length > 4096) throw attendanceError("INVALID_CURSOR");
    const value: unknown = JSON.parse(cursor);
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw attendanceError("INVALID_CURSOR");
    const data = value as Record<string, unknown>;
    if (data.version !== 1 || data.context !== context || typeof data.snapshotCreationTime !== "number" ||
        !Number.isFinite(data.snapshotCreationTime) || data.snapshotCreationTime < 0 || typeof data.position !== "string") {
      throw attendanceError("INVALID_CURSOR");
    }
    const key: unknown = JSON.parse(data.position);
    // stream cursors contain the explicit index fields followed by creation time/id.
    // The empty array is the terminal cursor and is handled before querying.
    if (!Array.isArray(key)) throw attendanceError("INVALID_CURSOR");
    if (key.length !== 0) {
      const eventTime: unknown = key[prefix.length];
      const creationTime: unknown = key[prefix.length + 1];
      const id: unknown = key[prefix.length + 2];
      if (key.length !== prefix.length + 3 || !prefix.every((field, index) => key[index] === field) ||
          typeof eventTime !== "string" || !Number.isFinite(Date.parse(eventTime)) ||
          typeof creationTime !== "number" || !Number.isFinite(creationTime) || creationTime < 0 ||
          typeof id !== "string" || !isReadingId(id)) {
        throw attendanceError("INVALID_CURSOR");
      }
    }
    return { version: 1, context, snapshotCreationTime: data.snapshotCreationTime, position: data.position };
  } catch {
    throw attendanceError("INVALID_CURSOR");
  }
}

export type MovementDay = {
  date: string;
  entryCount: number;
  exitCount: number;
  deniedCount: number;
  unknownCount: number;
  firstEntry: string | null;
  lastEntry: string | null;
  lastExit: string | null;
  lastDirection: "entry" | "exit" | "unknown";
};

/** Raw calendar movements, deliberately independent from shift work-day/payroll
 * pairing (pdksWorkDay). A 01:00 exit belongs to its own Istanbul calendar day. */
export function summarizeMovements(
  readings: readonly Doc<"cardReadings">[], startDate: string, endDate: string,
  projectId: Doc<"employees">["projectId"], generatedAt: string,
) {
  attendanceDateRange(startDate, endDate, SUMMARY_MAX_DAYS);
  const days: MovementDay[] = [];
  const daysByDate = new Map<string, MovementDay>();
  for (let ms = calendarDateMs(startDate); ms <= calendarDateMs(endDate); ms += DAY_MS) {
    const day: MovementDay = {
      date: new Date(ms).toISOString().slice(0, 10), entryCount: 0, exitCount: 0,
      deniedCount: 0, unknownCount: 0, firstEntry: null, lastEntry: null, lastExit: null, lastDirection: "unknown",
    };
    days.push(day);
    daysByDate.set(day.date, day);
  }
  const sorted = [...readings].sort((a, b) => a.accessTime.localeCompare(b.accessTime) ||
    a._creationTime - b._creationTime || a._id.localeCompare(b._id));
  for (const reading of sorted) {
    const time = Date.parse(reading.accessTime);
    if (!Number.isFinite(time)) throw attendanceError("SUMMARY_INVALID_DATA");
    const day = daysByDate.get(new Date(time + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10));
    // An indexed in-range row resolving outside this calendar range indicates
    // inconsistent stored time data, not an authoritative zero movement count.
    if (!day) throw attendanceError("SUMMARY_INVALID_DATA");
    if (reading.accessStatus === "reddedildi") {
      day.deniedCount++;
    } else if (reading.accessStatus !== "izin_verildi" || !projectId || reading.projectId !== projectId ||
        !isPdksEligibleReading(reading) || (reading.direction !== "entry" && reading.direction !== "exit")) {
      day.unknownCount++;
      day.lastDirection = "unknown";
    } else if (reading.direction === "entry") {
      day.entryCount++;
      day.firstEntry ??= reading.accessTime;
      day.lastEntry = reading.accessTime;
      day.lastDirection = "entry";
    } else {
      day.exitCount++;
      day.lastExit = reading.accessTime;
      day.lastDirection = "exit";
    }
  }
  const totals = { entryCount: 0, exitCount: 0, deniedCount: 0, unknownCount: 0, presentDays: 0 };
  for (const day of days) {
    totals.entryCount += day.entryCount;
    totals.exitCount += day.exitCount;
    totals.deniedCount += day.deniedCount;
    totals.unknownCount += day.unknownCount;
    if (day.entryCount > 0) totals.presentDays++;
  }
  return { startDate, endDate, timeZone: ATTENDANCE_TIME_ZONE, generatedAt, days, totals };
}
