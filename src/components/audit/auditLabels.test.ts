import { describe, expect, it } from "vitest";
import {
  auditChanges,
  auditDisplayValue,
  auditFieldLabel,
  maskAuditValue,
  redactAuditValue,
} from "./auditLabels";

describe("denetim değişiklik ayrıntısı", () => {
  it("alarm test e-postasını Türkçe etiketler ve yalnız alıcı sayısını gösterir", () => {
    expect(auditFieldLabel("deviceEvents", "alarmEmailTest")).toBe("Alarm test e-postası");
    expect(auditFieldLabel("deviceEvents", "recipientCount")).toBe("Alıcı sayısı");
    expect(auditDisplayValue(true)).toBe("Evet");
  });
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

it("gizlilik ayarlarındaki tüm kaydedilen alanları Türkçe gösterir", () => {
 expect(auditFieldLabel("projectPrivacySettings", "biometricEnabled")).toBe("Biyometrik veri işleme");
 expect(auditFieldLabel("projectPrivacySettings", "cardReadingRetentionDays")).toBe("Kart okuma saklama süresi (gün)");
 expect(auditFieldLabel("projectPrivacySettings", "aiMaskNames")).toBe("Yapay zekâda adları gizleme");
 for (const field of ["biometricReason", "biometricChangedAt", "biometricChangedBy"]) expect(auditFieldLabel("projectPrivacySettings", field)).not.toBe(field);
});

// Parse source rather than executing mutations. Dynamic keys and non-literal
// payloads cannot be resolved here and are intentionally left to runtime tests.
import ts from "typescript";
const auditSources = import.meta.glob("../../../convex/**/*.ts", { eager: true, query: "?raw", import: "default" });
it("labels every statically known oldValue/newValue object key written by Convex", () => {
  const missing = new Set<string>();
  const checked = new Set<string>();
  function key(name: ts.PropertyName): string | undefined {
    return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
  }
  function fields(value: ts.Expression, table: string) {
    if (!ts.isObjectLiteralExpression(value)) return;
    for (const property of value.properties) {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
      const field = key(property.name);
      if (!field) continue;
      checked.add(field);
      if (auditFieldLabel(table, field) === field) missing.add(`${table}.${field}`);
      if (ts.isPropertyAssignment(property)) fields(property.initializer, table);
    }
  }
  for (const [path, source] of Object.entries(auditSources)) {
    if (path.includes("/_generated/") || path.endsWith(".test.ts") || typeof source !== "string") continue;
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "writeAudit") {
        const payload = node.arguments[1];
        if (payload && ts.isObjectLiteralExpression(payload)) {
          const tableProperty = payload.properties.find(property => ts.isPropertyAssignment(property) && key(property.name) === "targetTable");
          const table = tableProperty && ts.isPropertyAssignment(tableProperty) && ts.isStringLiteral(tableProperty.initializer) ? tableProperty.initializer.text : "unknown";
          for (const property of payload.properties) {
            if (ts.isPropertyAssignment(property) && ["oldValue", "newValue"].includes(key(property.name) ?? "")) fields(property.initializer, table);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  for (const field of ["visitorKvkkUrl", "visitorKvkkVersion", "documentVersion"]) expect(checked.has(field)).toBe(true);
  expect([...missing].sort()).toEqual([]);
});
