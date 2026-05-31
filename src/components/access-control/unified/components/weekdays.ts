export type WeekdayValue =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface Weekday {
  value: WeekdayValue;
  short: string;
  abbr: string;
  full: string;
}

export const WEEKDAYS: Weekday[] = [
  { value: "Monday",    short: "Pt", abbr: "Pzt", full: "Pazartesi" },
  { value: "Tuesday",   short: "Sa", abbr: "Sal", full: "Salı" },
  { value: "Wednesday", short: "Ça", abbr: "Çar", full: "Çarşamba" },
  { value: "Thursday",  short: "Pe", abbr: "Per", full: "Perşembe" },
  { value: "Friday",    short: "Cu", abbr: "Cum", full: "Cuma" },
  { value: "Saturday",  short: "Ct", abbr: "Cmt", full: "Cumartesi" },
  { value: "Sunday",    short: "Pz", abbr: "Paz", full: "Pazar" },
];

export const DEFAULT_WORKDAYS: WeekdayValue[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const ABBR_BY_VALUE: Record<string, string> = Object.fromEntries(
  WEEKDAYS.map((d) => [d.value, d.abbr]),
);

const ORDER_BY_VALUE: Record<string, number> = Object.fromEntries(
  WEEKDAYS.map((d, i) => [d.value, i]),
);

// Günleri her zaman sabit hafta sırasına (Pzt→Paz) göre sırala; seçim/silme
// sırasından bağımsız tutarlı görünsün. Bilinmeyen değerler sona gider.
export const sortWeekdays = <T extends string>(days: T[]): T[] =>
  [...days].sort(
    (a, b) =>
      (ORDER_BY_VALUE[a] ?? WEEKDAYS.length) -
      (ORDER_BY_VALUE[b] ?? WEEKDAYS.length),
  );

export const formatWeekdaysAbbr = (days: string[]): string =>
  sortWeekdays(days)
    .map((d) => ABBR_BY_VALUE[d] ?? d)
    .join(", ");
