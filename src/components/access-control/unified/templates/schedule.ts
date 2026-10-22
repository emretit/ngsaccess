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
export function inspectSchedule(raw: WeekSchedule) {
  const expanded = emptyWeek();
  const overnight: string[] = [];
  try {
    for (const [index, day] of WEEKDAYS.entries())
      for (const interval of raw[day]) {
        const split = splitOvernight(day, interval.start, interval.end);
        for (const d of WEEKDAYS) expanded[d].push(...split[d]);
        if (interval.end < interval.start)
          overnight.push(
            `${DAY_NAMES[index]} ${interval.start}–${interval.end}: Ertesi güne taşan aralık → ${formatSchedule(split)}`,
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
