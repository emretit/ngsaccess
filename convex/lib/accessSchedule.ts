/** Pure schedule policy shared by cloud decisions and both device adapters. */
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Weekday = typeof WEEKDAYS[number];
export interface Interval { start: string; end: string }
export type WeekSchedule = Record<Weekday, Interval[]>;
export interface ScheduleRule {
  days?: readonly string[];
  startTime?: string;
  endTime?: string;
  scheduleTemplateId?: string | null;
  projectId?: string;
}
export interface ScheduleTemplate { week: WeekSchedule; projectId?: string }
export function emptyWeek(): WeekSchedule {
  return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
}
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function validTime(time: string, end = false): boolean { return TIME.test(time) || (end && time === "24:00"); }
export function normalizeWeek(week: WeekSchedule): WeekSchedule {
  const result = emptyWeek();
  for (const day of WEEKDAYS) {
    if (!Array.isArray(week[day])) throw new Error(`${day}: gün aralıkları zorunludur`);
    const intervals = week[day].map(({ start, end }) => {
      if (!validTime(start) || !validTime(end, true)) throw new Error("Saatleri HH:MM biçiminde girin (bitiş en fazla 24:00)");
      if (start >= end) throw new Error("Bitiş saati başlangıçtan sonra olmalı");
      return { start, end };
    }).sort((a, b) => a.start.localeCompare(b.start));
    for (const interval of intervals) {
      const last = result[day][result[day].length - 1];
      if (last && interval.start <= last.end) last.end = last.end > interval.end ? last.end : interval.end;
      else result[day].push(interval);
    }
    if (result[day].length > 8) throw new Error("Bir günde en fazla 8 zaman aralığı olabilir");
  }
  return result;
}
export function splitOvernight(day: Weekday, start: string, end: string): WeekSchedule {
  if (!validTime(start) || !validTime(end, true) || start === end) throw new Error("Geçerli ve farklı başlangıç/bitiş saatleri girin");
  const week = emptyWeek();
  if (start < end) week[day].push({ start, end });
  else {
    week[day].push({ start, end: "24:00" });
    const next = WEEKDAYS[(WEEKDAYS.indexOf(day) + 1) % 7];
    if (next && end !== "00:00") week[next].push({ start: "00:00", end });
  }
  return week;
}
export function effectiveSchedule(rule: ScheduleRule, template: ScheduleTemplate | null): WeekSchedule {
  if (rule.scheduleTemplateId) {
    if (!template || template.projectId !== rule.projectId) return emptyWeek();
    return normalizeWeek(template.week);
  }
  const week = emptyWeek();
  const start = rule.startTime?.trim() || "00:00";
  const end = rule.endTime?.trim() || "23:59";
  const rawDays = rule.days?.filter((day): day is string => Boolean(day)) ?? [];
  for (const day of WEEKDAYS) if (!rawDays.length || rawDays.includes(day)) week[day] = [{ start, end }];
  return week;
}
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Istanbul", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function isAllowedAt(week: WeekSchedule, nowMs: number): boolean {
  if (!Number.isFinite(nowMs)) return false;
  const parts = clock.formatToParts(new Date(nowMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  const day = WEEKDAYS.find(d => d === part("weekday"));
  const time = `${part("hour")}:${part("minute")}`;
  // Hik end HH:MM:59 includes the entire last minute; 24:00 ends at midnight.
  return !!day && week[day].some(i => validTime(i.start) && validTime(i.end, true) && i.start <= i.end && time >= i.start && time <= i.end);
}
export function toHikWeekSchedule(week: WeekSchedule): Array<{ week: Weekday; beginTime: string; endTime: string }> {
  for (const day of WEEKDAYS) if (week[day].length > 8) throw new Error("Hik: bir günde en fazla 8 zaman aralığı gönderilebilir");
  return WEEKDAYS.flatMap(day => week[day].map(i => ({ week: day, beginTime: `${i.start}:00`, endTime: i.end === "24:00" ? "24:00:00" : `${i.end}:59` })));
}
export function toIdePermissionSegments(week: WeekSchedule): Array<{ start: number; end: number; week_days: number[] }> {
  const groups = new Map<string, { start: number; end: number; week_days: number[] }>();
  const minutes = (s: string) => Math.min(1439, Number(s.slice(0, 2)) * 60 + Number(s.slice(3)));
  for (const [index, day] of WEEKDAYS.entries()) for (const i of week[day]) {
    if (!validTime(i.start) || !validTime(i.end, true) || i.start > i.end) throw new Error("IDE: geçersiz zaman aralığı");
    const key = `${i.start}/${i.end}`;
    const entry = groups.get(key) ?? { start: minutes(i.start), end: minutes(i.end), week_days: [] };
    entry.week_days.push((index + 1) % 7);
    groups.set(key, entry);
  }
  if (groups.size > 8) throw new Error("IDE: bir kural en fazla 8 farklı zaman aralığı içerebilir");
  return [...groups.values()].map(g => ({ ...g, week_days: g.week_days.sort((a, b) => a - b) }));
}
