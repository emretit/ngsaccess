import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import {
  emptyWeek,
  normalizeWeek,
  splitOvernight,
  type WeekSchedule,
} from "./accessSchedule";
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
      mode: plan.mode,
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

/** Convert a template snapshot; no subscription or automatic device send. */
export function templateToDoorStatusPlan(
  week: WeekSchedule,
  mode: "remainOpen" | "remainClosed",
  enabled = true,
): DoorStatusPlan {
  const expanded = emptyWeek();
  let normalized: WeekSchedule;
  // accessSchedule düz Error atar; istemci mesajı görebilsin diye ConvexError'a çevrilir.
  try {
    for (const day of DOOR_STATUS_DAYS)
      for (const range of week[day]) {
        const split = splitOvernight(day, range.start, range.end);
        for (const target of DOOR_STATUS_DAYS)
          expanded[target].push(...split[target]);
      }
    normalized = normalizeWeek(expanded);
  } catch (error: unknown) {
    throw new ConvexError(
      error instanceof Error ? error.message : "Zaman şablonu kapı planına çevrilemedi",
    );
  }
  return normalizeDoorStatusPlan({
    enabled,
    beginTime: "08:00",
    endTime: "18:00",
    mode,
    weekly: DOOR_STATUS_DAYS.map((day) => ({
      day,
      segments: normalized[day].map((range) => ({
        beginTime: `${range.start}:00`,
        endTime: range.end === "24:00" ? "23:59:59" : `${range.end}:00`,
        mode,
      })),
    })),
  });
}

const dayValidator = v.union(...DOOR_STATUS_DAYS.map((day) => v.literal(day)));
export const verifyPlanValidator = v.object({
  enabled: v.boolean(),
  beginTime: v.string(),
  endTime: v.string(),
  verifyMode: v.string(),
  weekly: v.optional(
    v.array(
      v.object({
        day: dayValidator,
        segments: v.array(
          v.object({
            beginTime: v.string(),
            endTime: v.string(),
            verifyMode: v.string(),
          }),
        ),
      }),
    ),
  ),
});
export type VerifyPlan = Infer<typeof verifyPlanValidator>;
export function normalizeVerifyPlan(plan: VerifyPlan): VerifyPlan {
  const validateMode = (mode: string) => {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(mode))
      throw new ConvexError("Geçersiz doğrulama modu");
    return mode === "cardAndFace" ? "faceAndCard" : mode;
  };
  validateMode(plan.verifyMode);
  plan.weekly?.forEach((day) =>
    day.segments.forEach((segment) => validateMode(segment.verifyMode)),
  );
  const normalized = normalizeDoorStatusPlan({
    ...plan,
    mode: "normal",
    weekly: plan.weekly?.map((day) => ({
      day: day.day,
      segments: day.segments.map((segment) => ({
        ...segment,
        mode: "normal" as const,
      })),
    })),
  });
  const weekly = normalized.weekly?.map((day, i) => ({
    day: day.day,
    segments: day.segments.map((segment, j) => ({
      beginTime: segment.beginTime,
      endTime: segment.endTime,
      verifyMode: validateMode(
        plan.weekly?.[i]?.segments[j]?.verifyMode ?? plan.verifyMode,
      ),
    })),
  }));
  const first = weekly?.flatMap((day) => day.segments)[0];
  return {
    enabled: plan.enabled,
    beginTime: normalized.beginTime,
    endTime: normalized.endTime,
    verifyMode: first?.verifyMode ?? validateMode(plan.verifyMode),
    ...(weekly ? { weekly } : {}),
  };
}
export function buildVerifySegments(plan: VerifyPlan) {
  const normalized = normalizeVerifyPlan(plan);
  const days =
    normalized.weekly ??
    DOOR_STATUS_DAYS.map((day) => ({ day, segments: [normalized] }));
  return days.flatMap(({ day, segments }) =>
    segments.map((segment, i) => ({
      week: day,
      id: i + 1,
      enable: true,
      beginTime: segment.beginTime,
      endTime: segment.endTime,
      verifyMode: segment.verifyMode,
    })),
  );
}

export const holidayPlanValidator = v.object({
  enabled: v.boolean(),
  year: v.number(),
  mode: v.union(
    v.literal("remainOpen"),
    v.literal("remainClosed"),
    v.literal("normal"),
  ),
});
export function holidayRanges(
  dates: string[],
): { beginDate: string; endDate: string }[] {
  const ranges: { beginDate: string; endDate: string }[] = [];
  for (const date of [...new Set(dates)].sort()) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
    )
      throw new ConvexError("Geçersiz tatil tarihi");
    const previous = ranges[ranges.length - 1];
    if (
      previous &&
      Date.parse(date) - Date.parse(previous.endDate) === 86400000
    )
      previous.endDate = date;
    else ranges.push({ beginDate: date, endDate: date });
  }
  if (ranges.length > 16)
    throw new ConvexError(
      "Tatil grubu en fazla 16 ayrı tarih aralığı içerebilir",
    );
  return ranges;
}
export function holidaySupportFromSnapshot(raw?: string): boolean | null {
  if (!raw) return null;
  try {
    const snapshot: unknown = JSON.parse(raw);
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      !("probes" in snapshot) ||
      !Array.isArray(snapshot.probes)
    )
      return null;
    for (const probe of snapshot.probes) {
      if (
        probe &&
        typeof probe === "object" &&
        "key" in probe &&
        probe.key === "doorStatusHoliday" &&
        "supported" in probe &&
        typeof probe.supported === "boolean"
      )
        return probe.supported;
    }
  } catch {
    /* Unknown capability is checked on the server before any PUT. */
  }
  return null;
}
