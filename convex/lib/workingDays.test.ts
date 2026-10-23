import { describe, expect, it } from "vitest";
import { DEFAULT_WORKING_DAYS, normalizeWorkingDays, storedWorkingDays } from "./workingDays";

describe("çalışma günleri", () => {
  it("haftanın sırasına dizer ve tekrarı atar", () => {
    expect(normalizeWorkingDays(["Cumartesi", "Pazartesi", "Pazartesi"])).toEqual(["Pazartesi", "Cumartesi"]);
  });
  it("geçersiz günü ve boş listeyi reddeder", () => {
    expect(() => normalizeWorkingDays(["Monday"])).toThrow("Geçersiz gün: Monday");
    expect(() => normalizeWorkingDays([])).toThrow("En az bir çalışma günü seçin.");
  });
  it("kayıt yoksa ya da bozuksa Pazartesi–Cuma döner", () => {
    expect(storedWorkingDays(undefined)).toEqual([...DEFAULT_WORKING_DAYS]);
    expect(storedWorkingDays(["xx"])).toEqual([...DEFAULT_WORKING_DAYS]);
    expect(storedWorkingDays(["Pazar"])).toEqual(["Pazar"]);
  });
});
