import { describe, expect, it } from "vitest";
import { assertDepartmentEmpty, assertSameProject, validatePay, employeeDependentTables, EMPLOYEE_BULK_DELETE_LIMIT, assertEmployeeBulkDeleteLimit } from "./employeeUx";
describe("personel yazma kuralları", () => {
  it("tekli ve toplu silmenin ortak bağımlılık politikası mobil oturumları ve atamaları içerir", () => {
    expect(employeeDependentTables).toEqual(["employeeAuth", "employeeSessions", "shiftAssignments"]);
  });
  it("departmanı yalnız çalışan ve çocuk bağı yoksa siler", () => {
    expect(() => assertDepartmentEmpty(0, 0)).not.toThrow();
    expect(() => assertDepartmentEmpty(3, 2)).toThrow("3 çalışan ve 2 alt departman");
    expect(() => assertDepartmentEmpty(1, 0)).toThrow();
    expect(() => assertDepartmentEmpty(0, 1)).toThrow();
  });
  it("toplu departman değişikliğinde proje karışımını engeller", () => {
    expect(() => assertSameProject("A", "A")).not.toThrow();
    expect(() => assertSameProject("A", "B")).toThrow();
    expect(() => assertSameProject(undefined, undefined)).toThrow();
  });
  it("ücret temizliğini ve sıfırı kabul eder; negatif/sonsuz değerleri reddeder", () => {
    expect(() => validatePay(null, undefined, 0, 125)).not.toThrow();
    for (const value of [-1, Infinity, NaN]) expect(() => validatePay(value)).toThrow();
  });
});

describe("toplu personel silme sınırı", () => {
  it("50 dahil küçük seçimleri kabul eder", () => {
    expect(EMPLOYEE_BULK_DELETE_LIMIT).toBe(50);
    for (const count of [0, 1, 49, 50]) expect(() => assertEmployeeBulkDeleteLimit(count)).not.toThrow();
  });
  it("sınırı aşan seçimi cascade başlamadan reddeder", () => {
    expect(() => assertEmployeeBulkDeleteLimit(51)).toThrow("en fazla 50 personel");
    expect(() => assertEmployeeBulkDeleteLimit(1000)).toThrow("Seçimi azaltın");
  });
});
