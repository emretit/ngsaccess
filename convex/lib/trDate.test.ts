import { describe, expect, it, vi } from "vitest";
import { toUtcISO, trDateKey, trDayRangeISO, trTodayKey } from "./trDate";

describe("trDateKey", () => {
  it.each([
    ["2026-10-15T20:59:59.999Z", "2026-10-15"],
    ["2026-10-15T21:00:00.000Z", "2026-10-16"], // TR 00:00
    ["2026-10-15T22:30:00.000Z", "2026-10-16"],
    ["2026-10-15T23:59:59.999Z", "2026-10-16"], // TR 02:59
    ["2026-10-16T00:00:00.000Z", "2026-10-16"], // TR 03:00
    ["2026-10-16T20:59:59.999Z", "2026-10-16"],
    ["2026-10-16T21:00:00.000Z", "2026-10-17"],
    ["2026-01-31T21:00:00.000Z", "2026-02-01"],
    ["2026-12-31T21:00:00.000Z", "2027-01-01"],
    ["2028-02-28T21:00:00.000Z", "2028-02-29"],
    ["2026-10-16T00:00:00.000+03:00", "2026-10-16"],
  ])("%s → %s", (iso, expected) => {
    expect(trDateKey(iso)).toBe(expected);
  });
});

describe("trDayRangeISO", () => {
  it("tek Türkiye gününü dahil UTC Z sınırlarına çevirir", () => {
    expect(trDayRangeISO("2026-10-16", "2026-10-16")).toEqual({
      startISO: "2026-10-15T21:00:00.000Z",
      endISO: "2026-10-16T20:59:59.999Z",
    });
  });

  it.each([
    ["2026-02-01", "2026-02-28", "2026-01-31T21:00:00.000Z", "2026-02-28T20:59:59.999Z"],
    ["2027-01-01", "2027-01-01", "2026-12-31T21:00:00.000Z", "2027-01-01T20:59:59.999Z"],
  ])("%s–%s ay/yıl sınırlarını korur", (start, end, startISO, endISO) => {
    expect(trDayRangeISO(start, end)).toEqual({ startISO, endISO });
  });
});

describe("trTodayKey", () => {
  it("verilen anın Türkiye gününü döner", () => {
    expect(trTodayKey(new Date("2026-12-31T22:30:00.000Z"))).toBe("2027-01-01");
  });

  it("varsayılan olarak sunucunun şimdiki anını kullanır", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-15T22:30:00.000Z"));
      expect(trTodayKey()).toBe("2026-10-16");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("toUtcISO", () => {
  it("+03:00 cihaz zamanını UTC Z'ye çevirir (TR 22:30 aynı TR gününde kalır)", () => {
    expect(toUtcISO("2026-10-16T22:30:00+03:00")).toBe("2026-10-16T19:30:00.000Z");
    expect(trDateKey(toUtcISO("2026-10-16T22:30:00+03:00") ?? "")).toBe("2026-10-16");
  });
  it("Z ve milisaniyeli değerleri kanonik biçime getirir", () => {
    expect(toUtcISO("2026-10-16T06:00:00Z")).toBe("2026-10-16T06:00:00.000Z");
    expect(toUtcISO("2026-10-16T06:00:00.000Z")).toBe("2026-10-16T06:00:00.000Z");
  });
  it("offset'siz değeri TR saati kabul eder", () => {
    expect(toUtcISO("2026-10-16 09:00:00")).toBe("2026-10-16T06:00:00.000Z");
    expect(toUtcISO("2026-10-16T09:00:00")).toBe("2026-10-16T06:00:00.000Z");
  });
  it("geçersiz değerde undefined döner", () => {
    expect(toUtcISO("")).toBeUndefined();
    expect(toUtcISO("dün akşam")).toBeUndefined();
    expect(toUtcISO("2026-02-30T22:30:00+03:00")).toBeUndefined();
    expect(toUtcISO("2026-10-16")).toBeUndefined();
  });
});
