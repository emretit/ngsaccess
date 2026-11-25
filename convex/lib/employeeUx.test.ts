import { describe, expect, it } from "vitest";
import { assertDepartmentEmpty, assertSameProject, validatePay, validateEmployeeText, employeeDependentTables, EMPLOYEE_BULK_DELETE_LIMIT, assertEmployeeBulkDeleteLimit, canSyncEmployeeToDevices, cardKey } from "./employeeUx";
it("card keys exclude blanks and retain leading zeroes", () => {
  expect(cardKey("")).toBeUndefined();
  expect(cardKey(" \t ")).toBeUndefined();
  expect(cardKey(" 00123 ")).toBe("00123");
});
describe("personel metin kuralları", () => {
  it("kartsız kaydı açık seçenekle kabul eder, varsayılan kart güvenliğini korur", () => {
    expect(() => validateEmployeeText({ cardNumber: "  " }, { allowCardless: true })).not.toThrow();
    expect(() => validateEmployeeText({ firstName: "", cardNumber: "" }, { allowCardless: true })).toThrow("Ad alanı");
  });
  it("cihaz kimliği yoksa göndermez; kart veya bağımsız biyometri kimliği varsa izin verir", () => {
    expect(canSyncEmployeeToDevices({ cardNumber: "  " })).toBe(false);
    expect(canSyncEmployeeToDevices({ cardNumber: "00123" })).toBe(true);
    expect(canSyncEmployeeToDevices({ cardNumber: "" }, "biometric-person-1")).toBe(true);
    expect(canSyncEmployeeToDevices({ cardNumber: "" }, "  ")).toBe(false);
  });
  it("geçerli kaydı ve boş e-postayı/TC'yi kabul eder", () => {
    expect(() => validateEmployeeText({ firstName: "Ada", lastName: "Test", email: "ada@example.test", tcNo: "10000000146", cardNumber: "007" })).not.toThrow();
    expect(() => validateEmployeeText({ firstName: "Ada", lastName: "Test", email: "", tcNo: null, cardNumber: "1" })).not.toThrow();
  });
  it("verilmeyen alanı denetlemez", () => {
    expect(() => validateEmployeeText({})).not.toThrow();
  });
  it("boş ad/soyad/kartı ve bozuk e-posta/TC'yi reddeder", () => {
    expect(() => validateEmployeeText({ firstName: " " })).toThrow("Ad alanı zorunludur");
    expect(() => validateEmployeeText({ lastName: "" })).toThrow("Soyad alanı zorunludur");
    expect(() => validateEmployeeText({ cardNumber: "  " })).toThrow("Kart numarası zorunludur");
    expect(() => validateEmployeeText({ email: "ada" })).toThrow("e-posta");
    for (const tcNo of ["123", "01234567890", "1234567890a", "12345678901"]) expect(() => validateEmployeeText({ tcNo })).toThrow("TC Kimlik No");
  });
});
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
