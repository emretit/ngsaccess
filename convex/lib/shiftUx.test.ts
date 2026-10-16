import { describe, expect, it } from "vitest";
import { validDay, validateRange, validateShift, schedulesOverlap, assignmentTouchesDay, overlapOnDay } from "./shiftUx";
import { toPatch } from "./nullablePatch";
const daytime = { startTime: "09:00", endTime: "18:00" };
describe("vardiya kuralları", () => {
  it("gerçek takvim günü ve en çok 365 gün aralık ister", () => {
    expect(validDay("2024-02-29")).toBe(true);
    for (const value of ["", "2026-02-29", "2026-04-31", "bad"]) expect(validDay(value)).toBe(false);
    expect(() => validateRange("", "")).toThrow();
    expect(() => validateRange("2026-01-02", "2026-01-01")).toThrow();
    expect(() => validateRange("2026-01-01", "2027-01-02")).toThrow();
  });
  it("gündüz ve gece molasının vardiya içinde olmasını ister", () => {
    expect(() => validateShift({ ...daytime, breakStart: "12:00", breakEnd: "13:00" })).not.toThrow();
    expect(() => validateShift({ startTime: "22:00", endTime: "06:00", breakStart: "01:00", breakEnd: "02:00" })).not.toThrow();
    for (const [breakStart, breakEnd] of [["12:00", "12:00"], ["20:00", "21:00"], ["09:00", "18:00"], ["12:00", ""]]) expect(() => validateShift({ ...daytime, breakStart, breakEnd })).toThrow();
  });
  it("mola ve tolerans temizliği nullable patch ile gerçekten kaldırılır", () => {
    const patch = toPatch({ breakStart: null, breakEnd: null, lateToleranceMinutes: null });
    expect(Object.prototype.hasOwnProperty.call(patch, "breakStart")).toBe(true);
    expect({ ...daytime, breakStart: "12:00", ...patch }.breakStart).toBeUndefined();
    expect(() => validateShift({ ...daytime, ...patch })).not.toThrow();
  });
  it("aynı gün ayrık saatler ve farklı tekrar günleri çakışmaz", () => {
    const range = { startDate: "2026-10-19", endDate: "2026-10-25" };
    expect(schedulesOverlap(range, daytime, range, { startTime: "18:00", endTime: "20:00" })).toBe(false);
    expect(schedulesOverlap({ ...range, weekPattern: ["MON"] }, daytime, { ...range, weekPattern: ["TUE"] }, daytime)).toBe(false);
    expect(schedulesOverlap(range, daytime, range, daytime)).toBe(true);
  });
  it("gece vardiyasını ertesi gün hücresinde ve çakışmasında gösterir", () => {
    const range = { startDate: "2026-10-19", endDate: "2026-10-19" };
    const night = { startTime: "22:00", endTime: "06:00" };
    expect(assignmentTouchesDay(range, night, "2026-10-20")).toBe(true);
    expect(assignmentTouchesDay(range, night, "2026-10-21")).toBe(false);
    expect(overlapOnDay(range, night, { startDate: "2026-10-20", endDate: "2026-10-20" }, { startTime: "05:00", endTime: "08:00" }, "2026-10-20")).toBe(true);
  });
  it("toleransta sıfırı korur; kesirli ve sonsuz sayıları reddeder", () => {
    expect(() => validateShift({ ...daytime, lateToleranceMinutes: 0 })).not.toThrow();
    for (const value of [-1, 241, 0.5, Infinity, NaN]) expect(() => validateShift({ ...daytime, lateToleranceMinutes: value })).toThrow();
  });
  it("gece taşmasını ertesi günün vardiyasıyla karşılaştırır", () => {
    expect(schedulesOverlap({ startDate: "2026-10-19", endDate: "2026-10-19" }, { startTime: "22:00", endTime: "06:00" }, { startDate: "2026-10-20", endDate: "2026-10-20" }, { startTime: "05:00", endTime: "08:00" })).toBe(true);
  });
});
