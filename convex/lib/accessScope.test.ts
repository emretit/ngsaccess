import { describe, expect, it } from "vitest";
import { assertAccessProjectUnchanged, assertSameAccessProject } from "./accessScope";

describe("erişim ilişkilerinde proje eşitliği", () => {
  for (const label of ["Ziyaretçi kuralı", "Ev sahibi personel", "Personel", "Cihaz", "Kapı", "Bölge", "Kural bağlantısı"]) {
    it(`${label}: aynı proje kabul edilir, farklı/eksik proje reddedilir`, () => {
      expect(() => assertSameAccessProject("a", { projectId: "a" }, label)).not.toThrow();
      expect(() => assertSameAccessProject("a", { projectId: "b" }, label)).toThrow(`${label} aynı projede olmalıdır`);
      expect(() => assertSameAccessProject("a", {}, label)).toThrow("aynı projede");
      expect(() => assertSameAccessProject("a", null, label)).toThrow("bulunamadı");
      expect(() => assertSameAccessProject(undefined, {}, label)).toThrow("proje seçin");
    });
  }
  it("güncellemede proje değişimi reddedilir", () => {
    expect(() => assertAccessProjectUnchanged("a", "b")).toThrow("taşınamaz");
    expect(() => assertAccessProjectUnchanged("a", "a")).not.toThrow();
    expect(() => assertAccessProjectUnchanged("a")).not.toThrow();
  });
});
