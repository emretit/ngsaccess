import {
  emptyWeek,
  normalizeWeek,
  splitOvernight,
  toIdePermissionSegments,
  WEEKDAYS,
  type WeekSchedule,
} from "../../../../../convex/lib/accessSchedule";
export { emptyWeek, WEEKDAYS };
export type { WeekSchedule };
export const DAY_NAMES = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
const SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export function formatSchedule(week: WeekSchedule): string {
  const groups: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = WEEKDAYS[i];
    if (!week[day].length) continue;
    const key = JSON.stringify(week[day]);
    let end = i;
    while (end < 6 && JSON.stringify(week[WEEKDAYS[end + 1]]) === key) end++;
    groups.push(
      `${SHORT[i]}${end > i ? `–${SHORT[end]}` : ""} ${week[day].map((r) => `${r.start}–${r.end}`).join(", ")}`,
    );
    i = end;
  }
  return groups.join(" · ") || "Erişim yok";
}
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
/** Aralıktaki tek saat alanı geçersiz mi: HH:MM değil (bitişte 24:00 serbest) ya da başlangıç = bitiş. */
export function invalidTimeField(
  interval: { start: string; end: string },
  field: "start" | "end",
): boolean {
  return !!timeFieldError(interval, field);
}
export function timeFieldError(
  interval: { start: string; end: string },
  field: "start" | "end",
): string {
  const value = interval[field];
  const label = field === "start" ? "başlangıç" : "bitiş";
  if (field === "end" && /^\d{2}:\d{2}$/.test(value) && value > "24:00")
    return "bitiş 24:00'ü geçemez";
  if (!(TIME.test(value) || (field === "end" && value === "24:00")))
    return `${label} saatini 22:00 biçiminde girin${field === "end" ? " (en fazla 24:00)" : " (00:00–23:59)"}`;
  if (interval.start === interval.end)
    return "başlangıç ve bitiş saatleri farklı olmalı";
  return "";
}
export function overnightDescription(
  day: (typeof WEEKDAYS)[number],
  interval: { start: string; end: string },
): string {
  if (
    invalidTimeField(interval, "start") ||
    invalidTimeField(interval, "end") ||
    interval.end >= interval.start
  )
    return "";
  return `Ertesi güne taşan aralık → ${formatSchedule(splitOvernight(day, interval.start, interval.end))}`;
}
export function inspectSchedule(raw: WeekSchedule) {
  const expanded = emptyWeek();
  const overnight: string[] = [];
  try {
    for (const [index, day] of WEEKDAYS.entries())
      for (const interval of raw[day]) {
        const split = splitOvernight(day, interval.start, interval.end);
        for (const d of WEEKDAYS) expanded[d].push(...split[d]);
        const description = overnightDescription(day, interval);
        if (description)
          overnight.push(
            `${DAY_NAMES[index]} ${interval.start}–${interval.end}: ${description}`,
          );
      }
    const week = normalizeWeek(expanded);
    const hik = Math.max(...WEEKDAYS.map((d) => week[d].length));
    let ide = 0;
    let ideError = "";
    try {
      ide = toIdePermissionSegments(week).length;
    } catch (error) {
      ide = new Set(
        WEEKDAYS.flatMap((d) => week[d].map((r) => `${r.start}/${r.end}`)),
      ).size;
      ideError = error instanceof Error ? error.message : "Geçersiz aralık";
    }
    return { week, hik, ide, overnight, error: ideError };
  } catch (error) {
    return {
      week: null,
      hik: Math.max(...WEEKDAYS.map((d) => expanded[d].length)),
      ide: 0,
      overnight,
      error: error instanceof Error ? error.message : "Geçersiz aralık",
    };
  }
}
