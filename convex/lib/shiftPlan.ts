import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { flexibleSchedule, flexibleSessionEnd } from "./pdksFlexible";

export const MAX_SHIFTS_PER_DAY = 8;
export const MIN_SPLIT_GAP_MINUTES = 30;
export const MAX_DAY_CYCLE = 31;
export const MAX_WEEK_CYCLE = 52;
const DAY = 86_400_000;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const daySlotValidator = v.array(v.id("shifts"));
export const shiftPlanValidator = v.union(
  v.object({ kind: v.literal("weekly"), shiftIds: daySlotValidator }),
  v.object({ kind: v.literal("dayCycle"), anchorDate: v.string(), slots: v.array(daySlotValidator) }),
  v.object({ kind: v.literal("weekCycle"), anchorDate: v.string(), slots: v.array(daySlotValidator) }),
);
export type ShiftPlan = Infer<typeof shiftPlanValidator>;
export const shiftPlanFields = {
  shiftId: v.id("shifts"), projectId: v.optional(v.id("projects")),
  startDate: v.string(), endDate: v.string(), weekPattern: v.optional(v.array(v.string())),
  plan: v.optional(shiftPlanValidator), createdAt: v.string(), updatedAt: v.string(),
};
export interface PlanRow {
  shiftId: Id<"shifts">; startDate: string; endDate: string; weekPattern?: string[]; plan?: ShiftPlan;
}
export function validPlanDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date;
}
export function slotForDate(row: PlanRow, date: string): Id<"shifts">[] | null {
  if (!validPlanDate(date) || date < row.startDate || date > row.endDate) return null;
  const plan = row.plan;
  if (!plan || plan.kind === "weekly") {
    if (row.weekPattern?.length && !row.weekPattern.includes(WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()])) return null;
    return plan ? plan.shiftIds : [row.shiftId];
  }
  const days = Math.round((Date.parse(date) - Date.parse(plan.anchorDate)) / DAY);
  const index = ((days % plan.slots.length) + plan.slots.length) % plan.slots.length;
  return plan.slots[index] ?? null;
}
export function planShiftIds(plan?: ShiftPlan): Id<"shifts">[] {
  return [...new Set(plan ? plan.kind === "weekly" ? plan.shiftIds : plan.slots.flat() : [])];
}
type DayShift = Pick<Doc<"shifts">, "_id" | "startTime" | "endTime" | "scheduleType">;
function minute(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ConvexError("Saat HH:MM biçiminde olmalıdır");
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
/** Returns a new, canonical start-time ordering; caller order is never persisted. */
export function validateDayShifts<T extends DayShift>(shifts: T[]): T[] {
  if (shifts.length > MAX_SHIFTS_PER_DAY) throw new ConvexError("Bir güne en fazla 8 vardiya konabilir");
  if (new Set(shifts.map(shift => shift._id)).size !== shifts.length) throw new ConvexError("Aynı vardiya bir güne iki kez konamaz");
  if (shifts.length > 1 && shifts.some(shift => shift.scheduleType === "flexible")) throw new ConvexError("Esnek vardiya başka vardiyayla aynı güne konamaz");
  const sorted = shifts.slice().sort((a, b) => a.startTime.localeCompare(b.startTime) || String(a._id).localeCompare(String(b._id)));
  if (sorted.length === 1 && sorted[0].scheduleType === "flexible") return sorted;
  let previousEnd: number | undefined;
  let firstStart: number | undefined;
  sorted.forEach((shift, index) => {
    const start = minute(shift.startTime);
    let end = minute(shift.endTime);
    if (start === end) throw new ConvexError("Başlangıç ve bitiş aynı olamaz");
    if (end < start) {
      if (index !== sorted.length - 1) throw new ConvexError("Yalnız son vardiya ertesi güne taşabilir");
      end += 1440;
    }
    firstStart ??= start;
    if (previousEnd !== undefined && start - previousEnd < MIN_SPLIT_GAP_MINUTES) throw new ConvexError("Ardışık vardiyalar arasında en az 30 dakika olmalıdır");
    if (end - firstStart > 1440) throw new ConvexError("Günün vardiyaları 24 saatten uzun olamaz");
    previousEnd = end;
  });
  return sorted;
}
/** Validate shape before resolving ids; the largest legal cycle has 364×8 entries. */
export function validatePlanStructure(plan: ShiftPlan, weekPattern?: string[]): void {
  if (plan.kind === "weekly") {
    if (plan.shiftIds.length < 1 || plan.shiftIds.length > MAX_SHIFTS_PER_DAY) throw new ConvexError("En az 1, en fazla 8 vardiya seçin");
    return;
  }
  if (weekPattern?.length) throw new ConvexError("Döngü planında haftalık gün seçimi boş olmalıdır");
  if (!validPlanDate(plan.anchorDate)) throw new ConvexError("Geçerli döngü başlangıç tarihi seçin");
  if (plan.kind === "dayCycle" && (plan.slots.length < 1 || plan.slots.length > MAX_DAY_CYCLE)) throw new ConvexError("Gün döngüsü 1–31 gün olmalıdır");
  if (plan.kind === "weekCycle" && (plan.slots.length < 7 || plan.slots.length > MAX_WEEK_CYCLE * 7 || plan.slots.length % 7 !== 0 || new Date(`${plan.anchorDate}T00:00:00Z`).getUTCDay() !== 1)) throw new ConvexError("Hafta döngüsü 1–52 hafta ve başlangıcı Pazartesi olmalıdır");
  if (plan.slots.some(slot => slot.length > MAX_SHIFTS_PER_DAY)) throw new ConvexError("Bir güne en fazla 8 vardiya konabilir");
  if (!plan.slots.some(slot => slot.length)) throw new ConvexError("Döngüde en az bir dolu gün olmalıdır");
}
/** Normalize a submitted plan, checking every referenced shift before any write. */
export function validateShiftPlan(row: PlanRow & { projectId?: Id<"projects"> }, shifts: ReadonlyMap<string, Doc<"shifts">>): { shiftId: Id<"shifts">; plan?: ShiftPlan } {
  if (!validPlanDate(row.startDate) || !validPlanDate(row.endDate) || row.startDate > row.endDate) throw new ConvexError("Geçerli başlangıç ve bitiş tarihi seçin");
  if (row.weekPattern?.some(code => !WEEKDAYS.includes(code))) throw new ConvexError("Geçersiz tekrar günü");
  const normalize = (ids: Id<"shifts">[]) => validateDayShifts(ids.map(id => {
    const shift = shifts.get(id);
    if (!shift || shift.projectId !== row.projectId) throw new ConvexError("Tüm vardiyalar aynı projeye ait olmalıdır");
    if (shift.isActive === false) throw new ConvexError("Pasif vardiya atanamaz");
    return shift;
  })).map(shift => shift._id);
  const validateNextDay = (previous: Id<"shifts">[], next: Id<"shifts">[]) => {
    const lastId = previous[previous.length - 1];
    const firstId = next[0];
    const last = lastId ? shifts.get(lastId) : undefined;
    const first = firstId ? shifts.get(firstId) : undefined;
    if (!last || !first) return;
    const flex = flexibleSchedule(last);
    if (flex) {
      // Ardışık esnek günlerin pencere çakışmasını hesap motoru çözer; sabite geçişte okutma sahipsiz kalmamalı.
      const nextEntry = 1440 + Math.min(minute(first.startTime), first.validWindow ? minute(first.validWindow.checkInStart) : Infinity);
      if (first.scheduleType !== "flexible" && nextEntry - flexibleSessionEnd(flex) < MIN_SPLIT_GAP_MINUTES) {
        throw new ConvexError("Esnek vardiyanın en geç çıkışı ile ertesi günün ilk vardiyası arasında en az 30 dakika olmalıdır");
      }
      return;
    }
    if (last.scheduleType === "flexible") return;
    const end = minute(last.endTime);
    if (end < minute(last.startTime) && minute(first.startTime) - end < MIN_SPLIT_GAP_MINUTES) {
      throw new ConvexError("Gece vardiyası ile ertesi günün ilk vardiyası arasında en az 30 dakika olmalıdır");
    }
  };
  const plan = row.plan;
  if (!plan) { normalize([row.shiftId]); return { shiftId: row.shiftId }; }
  validatePlanStructure(plan, row.weekPattern);
  if (plan.kind === "weekly") {
    const ids = normalize(plan.shiftIds);
    const selected = new Set(row.weekPattern?.length ? row.weekPattern : WEEKDAYS);
    if (WEEKDAYS.some((day, index) => selected.has(day) && selected.has(WEEKDAYS[(index + 1) % 7]))) validateNextDay(ids, ids);
    const shiftId = ids[0];
    if (!shiftId) throw new ConvexError("En az bir vardiya seçin");
    return { shiftId, ...(ids.length > 1 ? { plan: { kind: "weekly" as const, shiftIds: ids } } : {}) };
  }
  const slots = plan.slots.map(normalize);
  slots.forEach((slot, index) => validateNextDay(slot, slots[(index + 1) % slots.length]));
  const shiftId = slots.find(slot => slot.length > 0)?.[0];
  if (!shiftId) throw new ConvexError("Döngüde en az bir dolu gün olmalıdır");
  return { shiftId, plan: { ...plan, slots } };
}
