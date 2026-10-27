import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { validateShiftPlan, type ShiftPlan } from "./shiftPlan";
import { DEFAULT_FLEXIBLE } from "./pdksFlexible";
const projectId = "project" as Id<"projects">;
const shift = (id: string, startTime: string, endTime: string): Doc<"shifts"> => ({
  _id: id as Id<"shifts">, _creationTime: 0, projectId, name: id, startTime, endTime, createdAt: "", updatedAt: "",
});
const night = shift("night", "22:00", "06:00");
const early = shift("early", "05:00", "12:00");
const gap29 = shift("gap29", "06:29", "12:00");
const gap30 = shift("gap30", "06:30", "12:00");
const shifts = new Map([night, early, gap29, gap30].map(row => [String(row._id), row]));
const row = { projectId, shiftId: night._id, startDate: "2026-06-01", endDate: "2026-06-30" };
const validate = (plan: ShiftPlan, weekPattern?: string[]) => validateShiftPlan({ ...row, plan, weekPattern }, shifts);
const dayCycle = (slots: Id<"shifts">[][]): ShiftPlan => ({ kind: "dayCycle", anchorDate: row.startDate, slots });
describe("review: rest between consecutive planned days", () => {
  it.each([early, gap29])("rejects the overnight tail before $name in either cycle direction", morning => {
    expect(() => validate(dayCycle([[night._id], [morning._id]]))).toThrow("ertesi günün ilk vardiyası arasında en az 30");
    expect(() => validate(dayCycle([[morning._id], [night._id]]))).toThrow("ertesi günün ilk vardiyası arasında en az 30");
  });
  it("accepts exactly 30 minutes, including the cycle wrap", () => {
    expect(validate(dayCycle([[night._id], [gap30._id]]))).toBeDefined();
    expect(validate(dayCycle([[gap30._id], [night._id]]))).toBeDefined();
  });
  it("does not confuse a rest slot with the next working day", () => {
    expect(validate(dayCycle([[night._id], [], [early._id]]))).toBeDefined();
    expect(validate(dayCycle([[early._id], [night._id], []]))).toBeDefined();
  });
  it("checks the Sunday-to-Monday week-cycle boundary", () => {
    expect(() => validate({ kind: "weekCycle", anchorDate: row.startDate, slots: [[gap29._id], [], [], [], [], [], [night._id]] })).toThrow("30 dakika");
    expect(validate({ kind: "weekCycle", anchorDate: row.startDate, slots: [[gap30._id], [], [], [], [], [], [night._id]] })).toBeDefined();
  });
  it.each([undefined, [], ["MON", "TUE"], ["SAT", "SUN"], ["SUN", "MON"]])("checks adjacent selected weekly days (%j)", weekPattern => {
    expect(() => validate({ kind: "weekly", shiftIds: [night._id, gap29._id] }, weekPattern)).toThrow("30 dakika");
    expect(validate({ kind: "weekly", shiftIds: [night._id, gap30._id] }, weekPattern)).toBeDefined();
  });
  it("allows non-adjacent weekly days and preserves no-plan legacy validation", () => {
    expect(validate({ kind: "weekly", shiftIds: [gap29._id, night._id] }, ["MON", "WED", "FRI"])).toBeDefined();
    expect(validateShiftPlan(row, shifts)).toEqual({ shiftId: night._id });
  });
});

describe("esnekten sabite geçen ardışık günler", () => {
  const flexible = (checkOutEnd: string, checkOutEndDayOffset: 0 | 1): Doc<"shifts"> => ({
    ...shift(`flex-${checkOutEnd}-${checkOutEndDayOffset}`, "05:00", "22:00"), scheduleType: "flexible",
    flexible: { ...DEFAULT_FLEXIBLE, checkOutEnd, checkOutEndDayOffset },
  });
  const plan = (flex: Doc<"shifts">, next: Doc<"shifts">) => validateShiftPlan(
    { ...row, shiftId: flex._id, plan: dayCycle([[flex._id], [next._id]]) },
    new Map([...shifts, [String(flex._id), flex], [String(next._id), next]]),
  );
  it("esnek çıkış penceresi ertesi sabah vardiyasına 30 dakikadan az kalıyorsa reddeder", () => {
    // Varsayılan esnek: çıkış ertesi gün 14:00'e kadar; ertesi gün 08:00 sabiti sahipsiz okutma üretir.
    expect(() => plan(flexible("14:00", 1), shift("morning", "08:00", "17:00"))).toThrow("Esnek vardiyanın en geç çıkışı");
    expect(() => plan(flexible("07:31", 1), shift("morning", "08:00", "17:00"))).toThrow("30 dakika");
    expect(plan(flexible("07:30", 1), shift("morning", "08:00", "17:00"))).toBeDefined();
    expect(plan(flexible("23:00", 0), early)).toBeDefined();
    // Gece yarısında biten esnek: 00:10 sabit 10 dk kalır (red), 00:30 kabul.
    expect(() => plan(flexible("00:00", 1), shift("after-midnight", "00:10", "04:00"))).toThrow("30 dakika");
    expect(plan(flexible("00:00", 1), shift("after-midnight-ok", "00:30", "04:00"))).toBeDefined();
    expect(() => plan(flexible("23:50", 0), shift("next-0010", "00:10", "04:00"))).toThrow("30 dakika");
  });
  it("sabitin geçerli giriş penceresi başlangıcını da sayar; ardışık esnekleri motora bırakır", () => {
    const windowed = { ...shift("windowed", "08:00", "17:00"), validWindow: { checkInStart: "07:00", checkInEnd: "09:00", checkOutStart: "16:00", checkOutEnd: "18:00", checkOutEndDayOffset: 0 as const } };
    expect(() => plan(flexible("07:00", 1), windowed)).toThrow("30 dakika");
    const flex = flexible("14:00", 1);
    expect(validateShiftPlan({ ...row, shiftId: flex._id, plan: dayCycle([[flex._id], [flex._id]]) }, new Map([[String(flex._id), flex]]))).toBeDefined();
  });
});
