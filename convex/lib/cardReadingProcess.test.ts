import { describe, it, expect } from "vitest";
import { ideTimeToISO, startOfTurkeyDayISO } from "./cardReadingProcess";

describe("cardReadingProcess – ideTimeToISO (panel UTC+3 → UTC ISO)", () => {
  it("boşluklu format, UTC+3 kabul → UTC'ye 3 saat geri", () => {
    expect(ideTimeToISO("2026-06-22 12:00:00")).toBe("2026-06-22T09:00:00.000Z");
  });

  it("T ayraçlı format da kabul edilir", () => {
    expect(ideTimeToISO("2026-06-22T12:00:00")).toBe("2026-06-22T09:00:00.000Z");
  });

  it("baş/son boşluk trim edilir", () => {
    expect(ideTimeToISO("  2026-06-22 00:00:00  ")).toBe(
      "2026-06-21T21:00:00.000Z",
    );
  });

  it("undefined → undefined", () => {
    expect(ideTimeToISO(undefined)).toBeUndefined();
  });

  it("boş string → undefined", () => {
    expect(ideTimeToISO("")).toBeUndefined();
  });

  it("format uymuyor → undefined", () => {
    expect(ideTimeToISO("22.06.2026 12:00")).toBeUndefined();
  });

  it("format uyuyor ama geçersiz tarih → undefined", () => {
    expect(ideTimeToISO("2026-13-99 99:99:99")).toBeUndefined();
  });
});

describe("cardReadingProcess – startOfTurkeyDayISO (TR gün başı)", () => {
  it("gün ortası → o TR gününün 00:00 (+03:00)", () => {
    expect(startOfTurkeyDayISO("2026-06-22T09:00:00.000Z")).toBe(
      "2026-06-22T00:00:00.000+03:00",
    );
  });

  it("TR günü 00:00 = UTC önceki günün 21:00 (sınır, hâlâ önceki gün)", () => {
    expect(startOfTurkeyDayISO("2026-06-22T20:59:00.000Z")).toBe(
      "2026-06-22T00:00:00.000+03:00",
    );
  });

  it("UTC 21:00 → TR ertesi güne geçer", () => {
    expect(startOfTurkeyDayISO("2026-06-22T21:00:00.000Z")).toBe(
      "2026-06-23T00:00:00.000+03:00",
    );
  });

  it("ay/yıl sınırı: 31 Aralık 22:00 UTC → 1 Ocak TR", () => {
    expect(startOfTurkeyDayISO("2026-12-31T22:00:00.000Z")).toBe(
      "2027-01-01T00:00:00.000+03:00",
    );
  });
});
