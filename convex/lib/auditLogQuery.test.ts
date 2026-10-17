import { describe, expect, it } from "vitest";
import {
  auditDateRange,
  auditIndex,
  auditPageMatches,
  AUDIT_TARGET_LABELS,
} from "./auditLogQuery";

describe("denetim sorgusu", () => {
  it("TR gününü tarayıcı saatinden bağımsız UTC sınırlarına dönüştürür", () => {
    const range = auditDateRange("2026-10-16", "2026-10-16");
    expect(new Date(range.startTimestamp).toISOString()).toBe(
      "2026-10-15T21:00:00.000Z",
    );
    expect(new Date(range.endTimestamp).toISOString()).toBe(
      "2026-10-16T20:59:59.999Z",
    );
  });
  it("ters aralığı ve geçersiz takvim gününü reddeder", () => {
    expect(() => auditDateRange("2026-10-17", "2026-10-16")).toThrow(
      "Başlangıç",
    );
    expect(() => auditDateRange("2026-02-30")).toThrow("Geçerli");
    expect(() => auditDateRange("x")).toThrow("Geçerli");
  });
  it("proje/hedef/kullanıcı index önceliğini seçer", () => {
    expect(auditIndex("p", "employees", "u")).toBe(
      "by_project_table_timestamp",
    );
    expect(auditIndex("p", undefined, "u")).toBe("by_project_user_timestamp");
    expect(auditIndex("p")).toBe("by_project_timestamp");
    expect(auditIndex(undefined, "employees")).toBe("by_table_timestamp");
    expect(auditIndex(undefined, undefined, "u")).toBe("by_user_timestamp");
    expect(auditIndex()).toBe("by_timestamp");
    expect(auditIndex("p", "employees", "u", "delete")).toBe(
      "by_project_action_timestamp",
    );
    expect(auditIndex(undefined, "employees", "u", "update")).toBe(
      "by_action_timestamp",
    );
  });
  it("ikinci sayfada metin/kullanıcı/işlem eşleşmesini korur", () => {
    const rows = Array.from({ length: 260 }, (_, i) => ({
      userId: i === 255 ? "u" : "other",
      action: "update",
      targetTable: "employees",
      targetId: String(i),
      note: i === 255 ? "İzin değişti" : "başka",
    }));
    const filter = { userId: "u", action: "update", search: "izin" };
    expect(
      rows.slice(0, 200).filter((row) => auditPageMatches(row, filter)),
    ).toEqual([]);
    expect(
      rows
        .slice(200)
        .filter((row) => auditPageMatches(row, filter))
        .map((row) => row.targetId),
    ).toEqual(["255"]);
    expect(auditPageMatches(rows[255], { ...filter, action: "delete" })).toBe(
      false,
    );
  });
  it("hedef sözlüğü audit yazıcılarının desteklediği tabloları sunar", () => {
    expect(Object.keys(AUDIT_TARGET_LABELS).sort()).toEqual([
      "employeeConsents",
      "employees",
      "holidays",
      "overtimeRates",
      "pdksRecords",
    ]);
  });
});
