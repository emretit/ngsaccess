import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { MAX_DAY_CYCLE, MAX_SHIFTS_PER_DAY, MAX_WEEK_CYCLE, MIN_SPLIT_GAP_MINUTES, planShiftIds, slotForDate, validateDayShifts, validateShiftPlan, type ShiftPlan } from "./shiftPlan";
import { evaluateShiftAssignment, assignmentIntersectsRange } from "./shiftAssign";
import { scheduleIntervals } from "./shiftUx";
const projectId = "project" as Id<"projects">;
const shift = (id: string, startTime = "08:00", endTime = "12:00", extra: Partial<Doc<"shifts">> = {}): Doc<"shifts"> => ({
  _id: id as Id<"shifts">, _creationTime: 0, projectId, name: id, startTime, endTime, isActive: true, createdAt: "", updatedAt: "", ...extra,
});
const morning = shift("morning");
const evening = shift("evening", "14:00", "18:00");
const night = shift("night", "22:00", "06:00");
const flexible = shift("flexible", "05:00", "22:00", { scheduleType: "flexible" });
const shifts = new Map([morning, evening, night, flexible].map(item => [String(item._id), item]));
const row = { shiftId: morning._id, projectId, startDate: "2026-06-01", endDate: "2026-06-30" };
const normalized = (plan: ShiftPlan, extra = {}) => validateShiftPlan({ ...row, plan, ...extra }, shifts);

describe("day plan validation", () => {
  it("exposes the agreed constants", () => expect([MAX_SHIFTS_PER_DAY, MIN_SPLIT_GAP_MINUTES, MAX_DAY_CYCLE, MAX_WEEK_CYCLE]).toEqual([8, 30, 31, 52]));
  it("sorts a copy by start, accepts eight and rejects nine", () => {
    const values = Array.from({ length: 9 }, (_, i) => shift(`s${i}`, `${String(i * 2).padStart(2, "0")}:00`, `${String(i * 2 + 1).padStart(2, "0")}:00`));
    const input = values.slice(0, 8).reverse();
    expect(validateDayShifts(input)).toEqual(values.slice(0, 8));
    expect(input[0]).toEqual(values[7]);
    expect(() => validateDayShifts(values)).toThrow("8");
  });
  it("requires 30 minutes, rejects 29 and duplicate ids", () => {
    expect(validateDayShifts([morning, shift("second", "12:30", "14:00")])).toHaveLength(2);
    expect(() => validateDayShifts([morning, shift("second", "12:29", "14:00")])).toThrow("30");
    expect(() => validateDayShifts([morning, morning])).toThrow("iki kez");
  });
  it("permits only the last shift overnight, spanning at most 1440 minutes", () => {
    expect(validateDayShifts([morning, night])).toEqual([morning, night]);
    expect(() => validateDayShifts([shift("earlyNight", "01:00", "00:30"), morning])).toThrow("Yalnız son");
    expect(validateDayShifts([shift("first", "01:00", "02:00"), shift("last", "22:00", "01:00")])).toHaveLength(2);
    expect(() => validateDayShifts([shift("first", "01:00", "02:00"), shift("last", "22:00", "01:01")])).toThrow("24 saat");
  });
  it("allows flexible alone but never flexible plus fixed", () => {
    expect(validateDayShifts([flexible])).toEqual([flexible]);
    expect(() => validateDayShifts([flexible, morning])).toThrow("Esnek vardiya başka vardiyayla aynı güne konamaz");
  });
  it("normalizes the primary id and elides single weekly plans", () => {
    expect(normalized({ kind: "weekly", shiftIds: [evening._id, morning._id] })).toEqual({ shiftId: morning._id, plan: { kind: "weekly", shiftIds: [morning._id, evening._id] } });
    expect(normalized({ kind: "weekly", shiftIds: [evening._id] })).toEqual({ shiftId: evening._id });
    expect(() => normalized({ kind: "weekly", shiftIds: [] })).toThrow("En az");
  });
  it("requires same-project active existing shifts", () => {
    for (const extra of [{ projectId: "other" as Id<"projects"> }, { isActive: false }]) {
      const changed = new Map(shifts); changed.set(morning._id, { ...morning, ...extra });
      expect(() => validateShiftPlan({ ...row, plan: { kind: "weekly", shiftIds: [morning._id] } }, changed)).toThrow();
    }
    expect(() => normalized({ kind: "weekly", shiftIds: ["missing" as Id<"shifts">] })).toThrow();
  });
  it.each([0, 32])("rejects %i-day cycles", length => expect(() => normalized({ kind: "dayCycle", anchorDate: "2026-06-01", slots: Array.from({ length }, () => [morning._id]) })).toThrow("1–31"));
  it("accepts the 31-day and 52-week boundaries", () => {
    expect(normalized({ kind: "dayCycle", anchorDate: "2026-06-01", slots: Array.from({ length: 31 }, () => [morning._id]) }).plan?.kind).toBe("dayCycle");
    expect(normalized({ kind: "weekCycle", anchorDate: "2026-06-01", slots: Array.from({ length: 364 }, () => [morning._id]) }).plan?.kind).toBe("weekCycle");
  });
  it.each([0, 6, 8, 371])("rejects %i slots in a week cycle", length => expect(() => normalized({ kind: "weekCycle", anchorDate: "2026-06-01", slots: Array.from({ length }, () => [morning._id]) })).toThrow("1–52"));
  it("validates real dates, Monday anchoring, nonempty cycle, and empty weekPattern", () => {
    const plan: ShiftPlan = { kind: "dayCycle", anchorDate: "2026-06-01", slots: [[], [evening._id, morning._id]] };
    expect(normalized(plan)).toMatchObject({ shiftId: morning._id, plan: { slots: [[], [morning._id, evening._id]] } });
    for (const date of ["2026-02-29", "2026-04-31", "2026-6-01", "bad"]) {
      expect(() => normalized({ ...plan, anchorDate: date })).toThrow();
      expect(() => normalized(plan, { startDate: date })).toThrow();
    }
    expect(() => normalized({ kind: "weekCycle", anchorDate: "2026-06-02", slots: Array.from({ length: 7 }, () => [morning._id]) })).toThrow("Pazartesi");
    expect(() => normalized({ ...plan, slots: [[], []] })).toThrow("dolu gün");
    expect(() => normalized(plan, { weekPattern: ["MON"] })).toThrow("boş olmalıdır");
    expect(normalized(plan, { weekPattern: [] })).toBeDefined();
  });
});
describe("slot selection and plan-aware intervals", () => {
  it("repeats 2S·2A·2B for twelve days and handles dates before anchor", () => {
    const plan: ShiftPlan = { kind: "dayCycle", anchorDate: "2026-06-03", slots: [[morning._id], [morning._id], [evening._id], [evening._id], [], []] };
    const result = Array.from({ length: 12 }, (_, i) => slotForDate({ ...row, plan }, `2026-06-${String(i + 3).padStart(2, "0")}`));
    expect(result).toEqual([...plan.slots, ...plan.slots]);
    expect(slotForDate({ ...row, plan }, "2026-06-01")).toEqual([]);
    expect(slotForDate({ ...row, plan }, "2026-05-31")).toBeNull();
  });
  it("selects two-week slots independently of weekPattern and deduplicates refs", () => {
    const plan: ShiftPlan = { kind: "weekCycle", anchorDate: "2026-06-01", slots: [...Array.from({ length: 7 }, () => [morning._id]), ...Array.from({ length: 7 }, () => [evening._id])] };
    expect(slotForDate({ ...row, plan }, "2026-06-08")).toEqual([evening._id]);
    expect(slotForDate({ ...row, plan }, "2026-06-15")).toEqual([morning._id]);
    expect(planShiftIds(plan)).toEqual([morning._id, evening._id]);
    expect(planShiftIds()).toEqual([]);
    expect(slotForDate({ ...row, weekPattern: ["TUE"] }, "2026-06-01")).toBeNull();
  });
  it("expands every shift, detects a secondary collision and skips rest days", () => {
    const range = { ...row, endDate: row.startDate, plan: { kind: "weekly" as const, shiftIds: [morning._id, evening._id] } };
    expect(scheduleIntervals(range, morning, shifts)).toHaveLength(2);
    const decision = evaluateShiftAssignment({ range, shift: morning, shifts, leaves: [], holidays: [], existing: [{ ...row, assignmentId: "existing" as Id<"shiftAssignments">, shiftId: evening._id, shiftName: evening.name, shift: evening }] });
    expect(decision.status).toBe("conflict");
    const cycle = { ...range, endDate: "2026-06-02", plan: { kind: "dayCycle" as const, anchorDate: "2026-06-01", slots: [[], [night._id]] } };
    expect(assignmentIntersectsRange(cycle, morning, "2026-06-01", "2026-06-01", shifts)).toBe(false);
    expect(assignmentIntersectsRange(cycle, morning, "2026-06-03", "2026-06-03", shifts)).toBe(true);
    expect(evaluateShiftAssignment({ range: { ...cycle, endDate: cycle.startDate }, shift: morning, shifts, existing: [], leaves: [], holidays: [] }).status).toBe("will_assign");
  });
});
