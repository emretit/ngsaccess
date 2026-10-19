import { describe, expect, it } from "vitest";
import { findDuplicateImportRows, normalizeEmployeeImportName, validateEmployeeImportRow } from "./employeeImportValidation";

const valid = { rowNumber: 2, firstName: "Ada", lastName: "Yılmaz", email: "ada@example.com", tcNo: "10000000146", cardNumber: "A-1" };

describe("employee import validation", () => {
  it("rejects empty required fields and malformed identity numbers", () => {
    expect(validateEmployeeImportRow({ ...valid, firstName: " ", lastName: "", tcNo: "12" })).toEqual(expect.arrayContaining(["Ad zorunludur", "Soyad zorunludur", "T.C. Kimlik No geçersiz"]));
  });
  it("detects file duplicates across identifiers", () => {
    expect(findDuplicateImportRows([valid, { ...valid, rowNumber: 3, email: "ADA@example.com", cardNumber: "A-2" }]).get(3)).toContain("E-posta");
  });
  it("normalizes Turkish dotted and dotless I consistently", () => {
    expect(normalizeEmployeeImportName(" İŞ  Güvenliği ")).toBe(normalizeEmployeeImportName("iş güvenliği"));
  });
  it("reports each excessive name length once", () => {
    expect(validateEmployeeImportRow({ ...valid, firstName: "a".repeat(257), lastName: "a".repeat(257) })).toEqual([
      "Ad en fazla 256 karakter olabilir", "Soyad en fazla 256 karakter olabilir",
    ]);
  });
  it("uses stored email normalization for ASCII I while keeping card identifiers case-sensitive", () => {
    const first = { ...valid, tcNo: undefined, email: "INFO@example.com", cardNumber: "CARD" };
    expect(findDuplicateImportRows([first, { ...first, rowNumber: 3, email: "info@example.com", cardNumber: "OTHER" }]).get(3)).toContain("E-posta");
    expect(findDuplicateImportRows([first, { ...first, rowNumber: 3, email: "different@example.com", cardNumber: "card" }]).size).toBe(0);
  });
});
