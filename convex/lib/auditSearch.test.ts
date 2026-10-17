import { describe, expect, it } from "vitest";
import { auditSearchText, normalizeAuditSearch } from "./auditSearch";

describe("denetim arama metni", () => {
  it("URL aramasını Türkçe harflerle normalleştirir ve boş sorguyu temizler", () => {
    expect(normalizeAuditSearch("  İZİN IŞIK  ")).toBe("izin ışık");
    expect(normalizeAuditSearch("  ")).toBe("");
    expect(normalizeAuditSearch()).toBe("");
  });
  it("yazım anındaki ad ve hedef etiketini içerir; serbest notu indekslemez", () => {
    expect(
      auditSearchText({
        userName: "Ayşe",
        targetTable: "holidays",
        oldValue: { name: "Eski" },
        newValue: { name: "Yeni" },
      }),
    ).toBe("ayşe tatil yeni eski");
  });
  it("izin verilmeyen kişisel alanları ve iç içe nesneleri indekslemez", () => {
    const text = auditSearchText({
      targetTable: "employees",
      newValue: {
        firstName: "Ada",
        lastName: "Can",
        tcNo: "12345",
        email: "private@example.com",
        phone: "555",
        cardNo: "999",
        biometric: "secret",
        nested: { name: "Gizli" },
      },
    });
    expect(text).toBe("çalışan ada can");
  });
  it("metin boyutunu sınırlar", () => {
    expect(
      auditSearchText({ targetTable: "employees", newValue: { name: "a".repeat(2000) } }),
    ).toHaveLength(500);
  });
});
