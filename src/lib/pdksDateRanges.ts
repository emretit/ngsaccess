import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

export type PresetKey =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "last-7"
  | "last-30"
  | "ytd";

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: "Bugün",
  yesterday: "Dün",
  "this-week": "Bu hafta",
  "last-week": "Geçen hafta",
  "this-month": "Bu ay",
  "last-month": "Geçen ay",
  "last-7": "Son 7 gün",
  "last-30": "Son 30 gün",
  ytd: "Yıl başından",
};

export function getDateRange(key: PresetKey, now: Date = new Date()): { from: Date; to: Date } {
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "this-week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "last-week": {
      const lw = subWeeks(now, 1);
      return {
        from: startOfWeek(lw, { weekStartsOn: 1 }),
        to: endOfWeek(lw, { weekStartsOn: 1 }),
      };
    }
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last-month": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    case "last-7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "last-30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "ytd":
      return { from: startOfYear(now), to: endOfDay(now) };
  }
}
