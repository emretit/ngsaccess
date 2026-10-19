import { trDateKey } from "./trDate";
const DAY = 86400000;
const CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && trDateKey(date.toISOString()) === value;
}
export function validateRange(start: string, end: string) {
  if (!validDay(start) || !validDay(end)) throw new Error("Geçerli başlangıç ve bitiş tarihi seçin");
  if (start > end) throw new Error("Bitiş tarihi başlangıçtan önce olamaz");
  if ((Date.parse(end) - Date.parse(start)) / DAY > 365) throw new Error("Aralık 365 günden fazla olamaz");
}
export function minute(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Saat HH:MM biçiminde olmalıdır");
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function validateShift(shift: {startTime: string; endTime: string; breakStart?: string; breakEnd?: string; lateToleranceMinutes?: number; earlyExitToleranceMinutes?: number; overtimeStartToleranceMinutes?: number}) {
  const start = minute(shift.startTime);
  let end = minute(shift.endTime);
  if (start === end) throw new Error("Başlangıç ve bitiş aynı olamaz");
  if (end < start) end += 1440;
  if (Boolean(shift.breakStart) !== Boolean(shift.breakEnd)) throw new Error("Mola başlangıç ve bitiş birlikte verilmeli");
  if (shift.breakStart && shift.breakEnd) {
    let bs = minute(shift.breakStart); let be = minute(shift.breakEnd);
    if (bs < start) bs += 1440;
    if (be <= bs) be += 1440;
    if (bs < start || be > end || be <= bs || be - bs >= end - start) throw new Error("Mola vardiya içinde ve vardiyadan kısa olmalıdır");
  }
  for (const value of [shift.lateToleranceMinutes, shift.earlyExitToleranceMinutes, shift.overtimeStartToleranceMinutes]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 240)) throw new Error("Tolerans 0–240 arasında tam sayı olmalıdır");
  }
}
export interface ScheduleRange { startDate: string; endDate: string; weekPattern?: string[] }
export function appliesOn(range: ScheduleRange, day: string): boolean {
  return day >= range.startDate && day <= range.endDate && (!range.weekPattern?.length || range.weekPattern.includes(CODES[new Date(`${day}T12:00:00Z`).getUTCDay()]));
}
export function scheduleIntervals(range: ScheduleRange, shift: {startTime: string; endTime: string}): [number, number][] {
  const startMinute = minute(shift.startTime); let endMinute = minute(shift.endTime);
  if (endMinute <= startMinute) endMinute += 1440;
  const result: [number, number][] = [];
  for (let date = Date.parse(range.startDate); date <= Date.parse(range.endDate); date += DAY) {
    if (appliesOn(range, trDateKey(new Date(date).toISOString()))) result.push([date / 60000 + startMinute, date / 60000 + endMinute]);
  }
  return result;
}
export function schedulesOverlap(a: ScheduleRange, aShift: {startTime: string; endTime: string}, b: ScheduleRange, bShift: {startTime: string; endTime: string}): boolean {
  const ai = scheduleIntervals(a, aShift); const bi = scheduleIntervals(b, bShift);
  return ai.some(([start, end]) => bi.some(([otherStart, otherEnd]) => start < otherEnd && end > otherStart));
}
export function assignmentTouchesDay(range: ScheduleRange, shift: {startTime: string; endTime: string}, day: string): boolean {
  const start = Date.parse(day) / 60000;
  return scheduleIntervals(range, shift).some(([s, e]) => s < start + 1440 && e > start);
}
export function overlapOnDay(a: ScheduleRange, aShift: {startTime: string; endTime: string}, b: ScheduleRange, bShift: {startTime: string; endTime: string}, day: string): boolean {
  const start = Date.parse(day) / 60000;
  return scheduleIntervals(a, aShift).some(([s, e]) => scheduleIntervals(b, bShift).some(([bs, be]) => Math.max(s, bs, start) < Math.min(e, be, start + 1440)));
}

/** Shared display for every shift picker and summary. */
export function shiftTimeLabel(shift: { startTime: string; endTime: string }) {
  return `${shift.startTime}–${shift.endTime}${shift.endTime < shift.startTime ? " (+1 gün)" : ""}`;
}
