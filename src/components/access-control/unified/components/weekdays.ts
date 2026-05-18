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

export const formatWeekdaysAbbr = (days: string[]): string =>
  days.map((d) => ABBR_BY_VALUE[d] ?? d).join(", ");
