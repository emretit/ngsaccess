import { describe, expect, it } from "vitest";
import { accessScheduleError, assertAccessSchedule, assertAccessScheduleUpdate } from "./accessRuleUx";
import { toPatch } from "./nullablePatch";

describe("erişim planı kayıt sözleşmesi", () => {
  it("tüm gün seçimi mevcut saatleri own undefined patch ile temizler ve priority 0 korunur", () => {
    const old = { days: ["Monday"], startTime: "09:00", endTime: "18:00", priority: 0 };
    const patch = toPatch({ startTime: null, endTime: null });
    const updated = { ...old, ...patch };
    expect(Object.prototype.hasOwnProperty.call(patch, "startTime")).toBe(true);
    expect(updated.startTime).toBeUndefined();
    expect(updated.endTime).toBeUndefined();
    expect(updated.priority).toBe(0);
    expect(() => assertAccessSchedule(updated)).not.toThrow();
  });
  it.each([
    { days: [] },
    { days: ["Monday"], startTime: "09:00" },
    { days: ["Monday"], endTime: "18:00" },
    { days: ["Monday"], startTime: "18:00", endTime: "09:00" },
    { days: ["Monday"], startTime: "25:00", endTime: "26:00" },
    { days: ["invalid"] },
  ])("geçersiz planı açık hatayla reddeder: %j", (input) => {
    expect(accessScheduleError(input)).toBeTruthy();
    expect(() => assertAccessSchedule(input)).toThrow();
  });
  it("gündüz saatli ve tüm gün planlarını kabul eder", () => {
    expect(accessScheduleError({ days: ["Sunday"], startTime: "09:00", endTime: "18:00" })).toBeNull();
    expect(accessScheduleError({ days: ["Sunday"], startTime: null, endTime: null })).toBeNull();
  });
});

describe("legacy erişim planı güncellemesi", () => {
  const legacy = { days: [], startTime: "22:00", endTime: "06:00" };
  it("isim veya aktiflik değişimi eski planı yeniden doğrulamaz", () => {
    const nameUpdate = { name: "Yeni ad" };
    const statusUpdate = { isActive: false };
    expect(() => assertAccessScheduleUpdate(legacy, { ...nameUpdate, days: undefined })).not.toThrow();
    expect(() => assertAccessScheduleUpdate(legacy, { ...statusUpdate, days: undefined })).not.toThrow();
  });
  it("plan alanı verildiğinde birleşik planı doğrular", () => {
    expect(() => assertAccessScheduleUpdate(legacy, { days: ["Monday"] })).toThrow("Bitiş");
    expect(() => assertAccessScheduleUpdate(legacy, { startTime: null, endTime: null })).toThrow("gün");
    expect(() => assertAccessScheduleUpdate(legacy, { days: ["Monday"], startTime: null, endTime: null })).not.toThrow();
  });
});
