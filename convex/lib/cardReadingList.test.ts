import { describe, expect, it } from "vitest";
import { cardReadingDateBounds } from "./cardReadingList";

describe("kart okumaları TR tarih aralığı", () => {
  it("Türkiye gününün UTC sınırlarını kapsar", () => {
    expect(cardReadingDateBounds("2026-10-16", "2026-10-17")).toEqual({
      startISO: "2026-10-15T21:00:00.000Z", endISO: "2026-10-17T20:59:59.999Z",
    });
  });
  it("tek sınır bir TR günü, boş seçim tüm tarihler demektir", () => {
    expect(cardReadingDateBounds("2026-10-16")).toEqual(cardReadingDateBounds(undefined, "2026-10-16"));
    expect(cardReadingDateBounds()).toBeNull();
  });
  it.each([["2026-10-17", "2026-10-16"], ["2026-02-30", "2026-03-01"], ["2026-13-01", undefined], ["yanlış", undefined]])("geçersiz aralığı reddeder: %s", (start, end) => {
    expect(() => cardReadingDateBounds(start, end)).toThrow("Geçerli bir tarih aralığı seçin");
  });
});
