import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { tr } from "date-fns/locale";

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromISODate(iso: string): Date {
  return parseISO(iso);
}

export function isDateInRange(day: string, startDate: string, endDate: string): boolean {
  return day >= startDate && day <= endDate;
}

export function formatDayHeader(date: Date): { weekday: string; dayMonth: string } {
  return {
    weekday: format(date, "EEE", { locale: tr }),
    dayMonth: format(date, "d MMM", { locale: tr }),
  };
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${format(weekStart, "d MMM", { locale: tr })} – ${format(end, "d MMM yyyy", { locale: tr })}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}
