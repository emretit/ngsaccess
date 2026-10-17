import { describe, expect, it } from "vitest";
import {
  auditChanges,
  auditDisplayValue,
  auditFieldLabel,
  maskAuditValue,
  redactAuditValue,
} from "./auditLabels";

describe("denetim değişiklik ayrıntısı", () => {
  it("yalnız değişen alanları, eklenen ve kaldırılan değerleri gösterir", () => {
    expect(
      auditChanges(
        { a: 1, b: "eski", removed: true },
        { a: 1, b: "yeni", added: false },
      ),
    ).toEqual([
      { field: "b", before: "eski", after: "yeni" },
      { field: "removed", before: true, after: undefined },
      { field: "added", before: undefined, after: false },
    ]);
  });
  it("iç içe alanları açar ve nesne anahtar sırasını fark saymaz", () => {
    expect(auditChanges({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } })).toEqual(
      [],
    );
    expect(
      auditChanges({ cascade: { faces: 1 } }, { cascade: { faces: 2 } })[0]
        ?.field,
    ).toBe("cascade.faces");
  });
  it("oluşturma, silme, diziler ve ilkel değerleri korur", () => {
    expect(auditChanges(undefined, { name: "Ada" })).toEqual([
      { field: "name", before: undefined, after: "Ada" },
    ]);
    expect(auditChanges({ name: "Ada" }, undefined)).toEqual([
      { field: "name", before: "Ada", after: undefined },
    ]);
    expect(auditChanges([1], [2])).toHaveLength(1);
    expect(auditChanges(null, null)).toEqual([]);
    expect(auditChanges("a", "b")[0]?.field).toBe("Değer");
  });
  it("tabloya özel Türkçe etiketleri ve bilinmeyen ham alanı gösterir", () => {
    expect(auditFieldLabel("holidays", "name")).toBe("Tatil adı");
    expect(auditFieldLabel("employees", "name")).toBe("Ad");
    expect(auditFieldLabel("employees", "cascade.faces")).toBe(
      "Bağlı kayıtlar / Yüz kayıtları",
    );
    expect(auditFieldLabel("unknown", "customField")).toBe("customField");
  });
  it("yanlış veya sıfır değerlerini boş saymaz", () => {
    expect([false, true, 0, "", null].map(auditDisplayValue)).toEqual([
      "Hayır",
      "Evet",
      "0",
      "(boş)",
      "—",
    ]);
  });
});

describe("denetim ayrıntısı maskeleme", () => {
  it("kimlik ve kart değerlerini son 4 hane dışında gizler, sırları tamamen gizler", () => {
    expect(maskAuditValue("tcNo", "12345678901")).toBe("•••• 8901");
    expect(maskAuditValue("cardNumber", "123")).toBe("••••");
    expect(maskAuditValue("email", "ayse@ornek.com")).toBe("a•••@ornek.com");
    expect(maskAuditValue("idePassword", "x")).toBe("•••• (gizli)");
    expect(maskAuditValue("firstName", "Ayşe")).toBe("Ayşe");
    expect(maskAuditValue("tcNo", undefined)).toBeUndefined();
  });
  it("ham JSON'u iç içe alanlarda da maskeler", () => {
    expect(
      redactAuditValue({
        firstName: "Ada",
        tcNo: "12345678901",
        nested: { email: "a@b.co" },
        list: [{ cardNumber: "99990001" }],
      }),
    ).toEqual({
      firstName: "Ada",
      tcNo: "•••• 8901",
      nested: { email: "a•••@b.co" },
      list: [{ cardNumber: "•••• 0001" }],
    });
  });
});
