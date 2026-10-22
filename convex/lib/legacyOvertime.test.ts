import { describe, expect, it } from "vitest";
import { legacyAttendanceDays, legacyOvertimeMinutes } from "./legacyOvertime";

describe("legacy takvim haftası fazla mesaisi", () => {
  const fourWeeks = (firstWeekHours: number) => new Map(Array.from({ length: 20 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 5, 1 + Math.floor(i / 5) * 7 + i % 5)).toISOString().slice(0, 10);
    return [date, (i < 5 ? firstWeekHours / 5 : 8) * 60];
  }));
  it("4 × 40 saat sıfır; yalnız bir hafta 50 saat ise 5 saat üretir", () => {
    expect(legacyOvertimeMinutes(fourWeeks(40))).toBe(0);
    expect(legacyOvertimeMinutes(fourWeeks(50))).toBe(300);
  });
  it("Pazar 23:59 ve Pazartesi 00:00 Türkiye takviminde farklı haftalardır", () => {
    const days = legacyAttendanceDays([
      { accessTime: "2026-06-07T13:59:00Z" }, { accessTime: "2026-06-07T20:59:00Z" },
      { accessTime: "2026-06-07T21:00:00Z" }, { accessTime: "2026-06-08T05:00:00Z" },
    ]);
    expect([...days]).toEqual([["2026-06-07", 420], ["2026-06-08", 480]]);
    days.set("2026-06-01", 40 * 60);
    expect(legacyOvertimeMinutes(days)).toBe(120);
  });
  it("ay ortasında başlayan haftayı bir sonraki haftayla birleştirmez", () => {
    expect(legacyOvertimeMinutes(new Map([["2026-10-01", 24 * 60], ["2026-10-04", 24 * 60], ["2026-10-05", 40 * 60]]))).toBe(180);
  });
  it("tek gün dalında 8 saat eşiği korunur", () => {
    expect(legacyOvertimeMinutes(new Map([["2026-06-01", 10 * 60]]))).toBe(120);
  });
  it("manuel uçları tek tek değiştirir, okumasız günü ekler ve boş kaydı atlar", () => {
    expect([...legacyAttendanceDays([
      { accessTime: "2026-06-01T05:00:00Z" }, { accessTime: "2026-06-01T13:00:00Z" },
    ], [
      { date: "2026-06-01", exitTime: "18:00" },
      { date: "2026-06-02", entryTime: "08:00", exitTime: "16:00" },
      { date: "2026-06-03" },
    ])]).toEqual([["2026-06-01", 600], ["2026-06-02", 480]]);
  });
  it.each([["22:00", "06:00", 480], ["08:00", "08:00", 1440]] as const)("manuel %s → %s ertesi güne taşınır", (entryTime, exitTime, minutes) => {
    expect(legacyAttendanceDays([], [{ date: "2026-06-01", entryTime, exitTime }]).get("2026-06-01")).toBe(minutes);
  });
  it.each([
    ["entry", undefined, "08:00", undefined, 0],
    ["exit", undefined, "08:00", undefined, 540],
    [undefined, undefined, "08:00", undefined, 540],
    ["entry", "08:00", undefined, "17:00", 540],
    ["exit", "08:00", undefined, "17:00", 0],
  ] as const)("tek ham uç yönü %s, manuel giriş %s/%s ve çıkış %s", (direction, rawTime, entryTime, exitTime, minutes) => {
    expect(legacyAttendanceDays([{ accessTime: `2026-06-01T${rawTime ?? "17:00"}:00+03:00`, direction }], [
      { date: "2026-06-01", entryTime, exitTime },
    ]).get("2026-06-01")).toBe(minutes);
  });
});
