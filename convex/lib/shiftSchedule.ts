import { ConvexError, v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { ShiftPlan } from "./shiftPlan";

export const scheduleModeValidator = v.union(v.literal("daily"), v.literal("weekly"), v.literal("cycle"));
export type ScheduleMode = Infer<typeof scheduleModeValidator>;
export interface ShiftSchedule {
  scheduleMode?: ScheduleMode;
  dayPlan?: boolean[];
}
export const SCHEDULE_WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export const SCHEDULE_DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
export const DEFAULT_WEEKLY_PLAN = [true, true, true, true, true, false, false];
export const DEFAULT_CYCLE_PLAN = [true, true, false, false];

export function validateShiftSchedule(schedule: ShiftSchedule) {
  const mode = schedule.scheduleMode ?? "daily";
  const days = schedule.dayPlan ?? [];
  if (mode === "daily") {
    if (days.length) throw new ConvexError("Her gün düzeninde gün deseni boş olmalıdır");
    return;
  }
  if (mode === "weekly" && days.length !== 7) throw new ConvexError("Haftalık desen 7 gün olmalıdır");
  if (mode === "cycle" && (days.length < 2 || days.length > 31)) throw new ConvexError("Döngü 2–31 gün olmalıdır");
  if (!days.some(day => day)) throw new ConvexError("En az bir çalışma günü seçin");
}

/** Atama kendi desenini saklar. Tanımın sonraki değişiklikleri geçmiş serileri değiştirmez. */
export function scheduleForAssignment(shift: ShiftSchedule & { _id: Id<"shifts"> }, startDate: string): { weekPattern: (typeof SCHEDULE_WEEKDAYS)[number][]; plan?: ShiftPlan } {
  validateShiftSchedule(shift);
  if (shift.scheduleMode === "cycle") return {
    weekPattern: [],
    plan: { kind: "dayCycle", anchorDate: startDate, slots: (shift.dayPlan ?? []).map(works => works ? [shift._id] : []) },
  };
  return {
    weekPattern: SCHEDULE_WEEKDAYS.filter((_, index) => shift.scheduleMode !== "weekly" || shift.dayPlan?.[index]),
  };
}

export function shiftScheduleSummary(schedule: ShiftSchedule): string {
  const days = schedule.dayPlan ?? [];
  if (schedule.scheduleMode === "weekly") return SCHEDULE_DAY_LABELS.filter((_, index) => days[index]).join(", ");
  if (schedule.scheduleMode === "cycle") return `${days.length} günlük döngü · ${days.filter(day => day).length} çalışma günü`;
  return "Her gün";
}
