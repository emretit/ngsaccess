import type { Doc } from "../_generated/dataModel";
import { legalBreakMinutes } from "./breakDeduction";

export type FlexibleSchedule = NonNullable<Doc<"shifts">["flexible"]>;
export type ShiftSchedule = Pick<Doc<"shifts">, "startTime" | "endTime" | "scheduleType" | "flexible">;
export const DEFAULT_FLEXIBLE: FlexibleSchedule = {
  requiredNetMinutes: 480, checkInStart: "05:00", checkInEnd: "22:00",
  checkOutStart: "05:00", checkOutEnd: "14:00", checkOutEndDayOffset: 1,
  maxSpanMinutes: 960, breakMode: "duration", breakMinutes: 60,
};
export function flexibleSchedule(shift: Pick<ShiftSchedule, "scheduleType" | "flexible"> | null | undefined) {
  return shift?.scheduleType === "flexible" ? shift.flexible : undefined;
}
export function clockMinute(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Saat HH:MM biçiminde olmalıdır");
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
export function flexibleBreak(schedule: FlexibleSchedule, gross: number) {
  return Math.min(gross, schedule.breakMode === "duration" ? schedule.breakMinutes ?? 0 : legalBreakMinutes(gross));
}
export function flexibleExitEnd(schedule: FlexibleSchedule) {
  return clockMinute(schedule.checkOutEnd) + 1440 * schedule.checkOutEndDayOffset;
}
export function validateFlexible(schedule: FlexibleSchedule | undefined) {
  if (!schedule) throw new Error("Esnek vardiya bilgileri gereklidir");
  const { requiredNetMinutes: target, maxSpanMinutes: span, breakMinutes: pause, breakMode } = schedule;
  if (!Number.isInteger(target) || target <= 0) throw new Error("Hedef süre pozitif tam sayı dakika olmalıdır");
  if (!Number.isInteger(span) || span <= 0 || span > 1440) throw new Error("Azami oturum 1–1440 arasında tam sayı dakika olmalıdır");
  if (breakMode !== "duration" && breakMode !== "existingLegal") throw new Error("Geçerli mola modu seçin");
  if (breakMode === "duration" && pause === undefined) throw new Error("Mola süresi gereklidir");
  if (pause !== undefined && (!Number.isInteger(pause) || pause < 0 || pause >= span)) throw new Error("Mola 0 ile azami oturum arasında tam sayı dakika olmalıdır");
  if (schedule.checkOutEndDayOffset !== 0 && schedule.checkOutEndDayOffset !== 1) throw new Error("Çıkış gün farkı 0 veya 1 olmalıdır");
  const start = clockMinute(schedule.checkInStart), end = clockMinute(schedule.checkInEnd);
  const exitStart = clockMinute(schedule.checkOutStart), exitEnd = flexibleExitEnd(schedule);
  if (start > end) throw new Error("Giriş penceresi aynı gün içinde olmalıdır; başlangıç bitişten sonra olamaz");
  if (exitStart > exitEnd) throw new Error("Çıkış penceresi başlangıcı bitişten sonra olamaz");
  // Search is bounded by one day and also handles legal-break threshold jumps.
  for (let entry = start; entry <= end; entry++) {
    let reachable = false;
    for (let gross = Math.max(1, exitStart - entry); gross <= Math.min(span, exitEnd - entry); gross++) {
      if (gross - flexibleBreak(schedule, gross) >= target) { reachable = true; break; }
    }
    if (!reachable) throw new Error("Her izinli girişten hedef ve molaya ulaşılabilen bir çıkış olmalı; hedef + mola azami oturuma sığmalıdır");
  }
}
export function relativeMinute(date: string, iso: string) {
  return Math.floor((Date.parse(iso) - Date.parse(`${date}T00:00:00+03:00`)) / 60000);
}
export function validFlexibleEntry(schedule: FlexibleSchedule, minute: number) {
  return minute >= clockMinute(schedule.checkInStart) && minute <= clockMinute(schedule.checkInEnd);
}
export function validFlexibleExit(schedule: FlexibleSchedule, minute: number, entry?: number) {
  return minute >= clockMinute(schedule.checkOutStart) && minute <= flexibleExitEnd(schedule)
    && (entry === undefined || (minute > entry && minute - entry <= schedule.maxSpanMinutes));
}
/** Preserve directions and delegate the attendance decision to W5-A's resolver. */
export function flexibleReadings<T extends { accessTime: string; direction?: string }>(schedule: FlexibleSchedule, date: string, readings: readonly T[], manualEntry?: string) {
  const entry = manualEntry ?? readings.find(r => r.direction !== "exit" && validFlexibleEntry(schedule, relativeMinute(date, r.accessTime)))?.accessTime;
  const entryMinute = entry ? relativeMinute(date, entry) : undefined;
  return readings.filter(reading => {
    const minute = relativeMinute(date, reading.accessTime);
    if (reading.direction === "entry") return validFlexibleEntry(schedule, minute);
    if (reading.direction === "exit") return validFlexibleExit(schedule, minute, entryMinute);
    return validFlexibleEntry(schedule, minute) || validFlexibleExit(schedule, minute, entryMinute);
  });
}
export function flexiblePendingUntil(schedule: FlexibleSchedule, date: string, firstISO: string | null) {
  const latestEntry = firstISO ? relativeMinute(date, firstISO) : clockMinute(schedule.checkInEnd);
  return Date.parse(`${date}T00:00:00+03:00`) + Math.min(flexibleExitEnd(schedule), latestEntry + schedule.maxSpanMinutes) * 60000;
}
/** Only esnek results expose these keys, keeping fixed DTO snapshots intact. */
export type FlexibleMinutes = { requiredNetMinutes?: number; shortfallMinutes?: number | null; excessMinutes?: number; scheduleType?: "flexible"; leaveWorkWarning?: boolean };
export function flexibleMinuteFields(day: FlexibleMinutes): FlexibleMinutes {
  return day.scheduleType === "flexible" ? {
    scheduleType: day.scheduleType, requiredNetMinutes: day.requiredNetMinutes,
    shortfallMinutes: day.shortfallMinutes, excessMinutes: day.excessMinutes,
    leaveWorkWarning: day.leaveWorkWarning,
  } : {};
}
