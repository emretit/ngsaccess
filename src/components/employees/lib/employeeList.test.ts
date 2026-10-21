import { describe, it, expect } from "vitest";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  clampPage,
  filterAndSortEmployees,
  safeSearchParam,
} from "./employeeList";
const person = (name: string, extra: Partial<Employee> = {}): Employee => ({
  _id: name as Id<"employees">,
  firstName: name,
  lastName: "Kişi",
  email: "",
  cardNumber: "001",
  isActive: true,
  ...extra,
});
describe("personel liste sözleşmesi", () => {
  it("Türkçe arama ve bordro; TC aranmaz", () => {
    const rows = [person("IŞIK", { payrollCode: "P-02", tcNo: "12345678901" })];
    expect(
      filterAndSortEmployees(rows, "ışık", "", "all", "name:asc"),
    ).toHaveLength(1);
    expect(
      filterAndSortEmployees(rows, "p-02", "", "all", "name:asc"),
    ).toHaveLength(1);
    expect(
      filterAndSortEmployees(rows, "12345678901", "", "all", "name:asc"),
    ).toHaveLength(0);
    expect(safeSearchParam("12345678901")).toBe("");
  });
  it("doğrudan departman ve atanmamış seçimini uygular", () => {
    const rows = [
      person("A", { departmentId: "parent" as Id<"departments"> }),
      person("B", { departmentId: "child" as Id<"departments"> }),
      person("C"),
    ];
    expect(
      filterAndSortEmployees(rows, "", "parent", "all", "name:asc").map(
        (p) => p.firstName,
      ),
    ).toEqual(["A"]);
    expect(
      filterAndSortEmployees(rows, "", "unassigned", "all", "name:asc").map(
        (p) => p.firstName,
      ),
    ).toEqual(["C"]);
  });
  it("sayfalamadan önce tüm kümeyi sıralar ve durumu süzer", () => {
    const rows = [person("Z"), person("Ç"), person("A", { isActive: false })];
    expect(
      filterAndSortEmployees(rows, "", "", "active", "name:asc").slice(0, 1)[0]
        .firstName,
    ).toBe("Ç");
  });
  it("silinen son sayfayı ve bozuk URL sayfasını sınırlar", () => {
    expect(clampPage(9, 11, 10)).toBe(2);
    expect(clampPage(2, 0, 10)).toBe(1);
    expect(clampPage(NaN, 3, 10)).toBe(1);
  });
});

it("11 haneli kart bellekte aranabilir, URL arama değeri temizlenir", () => {
  const rows = [person("Kart sahibi", { cardNumber: "12345678901" })];
  expect(
    filterAndSortEmployees(rows, "12345678901", "", "all", "name:asc"),
  ).toHaveLength(1);
  expect(safeSearchParam("12345678901")).toBe("");
});

it("Ayrılanlar filtresi ileri tarihli ve kapanmış ayrılıkları aynı sayımda tutar", () => {
  const terminated = { ...person("A"), employmentEndDate: "2026-10-15", isActive: false };
  const future = { ...person("B"), employmentEndDate: "2099-10-31" };
  expect(filterAndSortEmployees([terminated, future, person("C", { isActive: false })], "", "", "terminated", "name:asc").map(row => row.firstName)).toEqual(["A", "B"]);
});


it("Pasif excludes departures while future departures remain active and terminated", () => {
  const rows = [
    { ...person("A"), employmentEndDate: "2026-10-15", isActive: false },
    { ...person("B"), employmentEndDate: "2099-10-31" },
    person("C", { isActive: false }),
    person("D"),
  ];
  const names = (status: string) => filterAndSortEmployees(rows, "", "", status, "name:asc").map(row => row.firstName);
  expect(names("inactive")).toEqual(["C"]);
  expect(names("active")).toEqual(["B", "D"]);
  expect(names("terminated")).toEqual(["A", "B"]);
  expect(names("all")).toEqual(["A", "B", "C", "D"]);
});
