import { describe, expect, it } from "vitest";
import { matchesPersonSearch, matchesReadingSearch, readingSearchTerm } from "./readingSearch";

describe("Canlı İzleme araması", () => {
  it("boşlukları sadeleştirir, terimleri sınırlar, boşu aramasız sayar", () => {
    expect(readingSearchTerm("  Emre   Aydın ")).toBe("Emre Aydın");
    expect(readingSearchTerm("   ")).toBeUndefined();
    expect(readingSearchTerm(undefined)).toBeUndefined();
    expect(readingSearchTerm(Array.from({ length: 20 }, (_, i) => `k${i}`).join(" "))?.split(" ")).toHaveLength(8);
  });
  it("kişi: her sözcük ad/soyad sözcüklerinden birinin başı olmalı (Türkçe harf duyarsız)", () => {
    const person = { firstName: "Emre", lastName: "Aydın" };
    expect(matchesPersonSearch(person, "emre ayd")).toBe(true);
    expect(matchesPersonSearch(person, "AYDIN")).toBe(true);
    expect(matchesPersonSearch(person, "emre kaya")).toBe(false);
    expect(matchesPersonSearch(person, "mre")).toBe(false);
  });
  it("okuma: tam kart numarası ya da kişi adı; kart parçası eşleşmez", () => {
    const reading = { cardNo: "0008292535", employeeName: "Emre Aydın" };
    expect(matchesReadingSearch(reading, "0008292535")).toBe(true);
    expect(matchesReadingSearch(reading, "8292535")).toBe(false);
    expect(matchesReadingSearch(reading, "aydın")).toBe(true);
    expect(matchesReadingSearch({ cardNo: "1" }, "emre")).toBe(false);
  });
});
