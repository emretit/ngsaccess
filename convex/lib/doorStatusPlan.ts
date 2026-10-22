import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import type { DoorStatusSegment } from "./gateway/plans";

export const DOOR_STATUS_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
// gateway/scheduling.ts MAX_SEGMENTS_PER_DAY (Node runtime) ile aynı Hik sınırı.
export const DOOR_STATUS_MAX_SEGMENTS = 8;
const modeValidator = v.union(
  v.literal("remainOpen"),
  v.literal("normal"),
  v.literal("remainClosed"),
);
export const doorStatusPlanValidator = v.object({
  enabled: v.boolean(),
  beginTime: v.string(),
  endTime: v.string(),
  mode: modeValidator,
  weekly: v.optional(
    v.array(
      v.object({
        day: v.union(
          v.literal("Monday"),
          v.literal("Tuesday"),
          v.literal("Wednesday"),
          v.literal("Thursday"),
          v.literal("Friday"),
          v.literal("Saturday"),
          v.literal("Sunday"),
        ),
        segments: v.array(
          v.object({
            beginTime: v.string(),
            endTime: v.string(),
            mode: modeValidator,
          }),
        ),
      }),
    ),
  ),
});
export type DoorStatusPlan = Infer<typeof doorStatusPlanValidator>;
export type DoorStatusInterval = Pick<
  DoorStatusPlan,
  "beginTime" | "endTime" | "mode"
>;

export function normalizeDoorStatusTime(time: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    throw new ConvexError("Saat HH:MM veya HH:MM:SS biçiminde olmalıdır.");
  }
  return time.length === 5 ? `${time}:00` : time;
}

/** Doğrulama ve eski okuyucular için zorunlu tek-aralık alanları. */
export function normalizeDoorStatusPlan(plan: DoorStatusPlan): DoorStatusPlan {
  const interval = (segment: DoorStatusInterval): DoorStatusInterval => {
    const beginTime = normalizeDoorStatusTime(segment.beginTime);
    const endTime = normalizeDoorStatusTime(segment.endTime);
    if (beginTime >= endTime)
      throw new ConvexError(
        "Başlangıç bitişten önce olmalıdır; gece yarısını geçen aralığı iki güne bölün.",
      );
    return { beginTime, endTime, mode: segment.mode };
  };
  if (plan.weekly === undefined)
    return { enabled: plan.enabled, ...interval(plan) };
  const seen = new Set<string>();
  const weekly = plan.weekly.map(({ day, segments }) => {
    if (!DOOR_STATUS_DAYS.some((value) => value === day) || seen.has(day))
      throw new ConvexError(
        "Haftanın her günü en fazla bir kez tanımlanabilir.",
      );
    seen.add(day);
    if (segments.length > DOOR_STATUS_MAX_SEGMENTS)
      throw new ConvexError(
        "Bir günde en fazla 8 zaman aralığı tanımlanabilir.",
      );
    const normalized = segments.map(interval);
    const sorted = [...normalized].sort((a, b) =>
      a.beginTime.localeCompare(b.beginTime),
    );
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (previous && current && previous.endTime > current.beginTime)
        throw new ConvexError("Aynı gündeki zaman aralıkları çakışamaz.");
    }
    return { day, segments: normalized };
  });
  const first = weekly.flatMap((day) => day.segments)[0];
  return {
    enabled: plan.enabled,
    ...(first ?? {
      beginTime: "08:00:00",
      endTime: "18:00:00",
      mode: "remainOpen",
    }),
    weekly,
  };
}

export function buildDoorStatusSegments(
  plan: DoorStatusPlan,
): DoorStatusSegment[] {
  const normalized = normalizeDoorStatusPlan(plan);
  if (normalized.weekly === undefined) {
    return DOOR_STATUS_DAYS.map((week, index) => ({
      week,
      id: index + 1,
      enable: true,
      doorStatus: normalized.mode,
      beginTime: normalized.beginTime,
      endTime: normalized.endTime,
    }));
  }
  return normalized.weekly.flatMap(({ day, segments }) =>
    segments.map((segment, index) => ({
      week: day,
      id: index + 1,
      enable: true,
      doorStatus: segment.mode,
      beginTime: segment.beginTime,
      endTime: segment.endTime,
    })),
  );
}
