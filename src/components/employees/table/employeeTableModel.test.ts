import { expect, it } from "vitest";
import type { EmploymentEmployee as Employee } from "../lib/employment";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  employeeColumnSort,
  employeeSelectionState,
  employeeSortIndicator,
  nextEmployeeSort,
  selectedEmployeeNames,
} from "./employeeTableModel";
const id = "employee-1" as Id<"employees">;
const employee: Employee = {
  _id: id,
  firstName: "Ada",
  lastName: "Test",
  email: "ada@test.test",
  isActive: true,
  cardNumber: "",
};
it("distinguishes empty, partial, and full page selection", () => {
  expect(employeeSelectionState([], [])).toBe(false);
  expect(employeeSelectionState([employee], [])).toBe(false);
  expect(employeeSelectionState([employee], [id])).toBe(true);
  expect(
    employeeSelectionState(
      [employee, { ...employee, _id: "employee-2" as Id<"employees"> }],
      [id],
    ),
  ).toBe("indeterminate");
  expect(selectedEmployeeNames([employee], [id])).toBe(
    "Ada Test (Bordro kodu yok)",
  );
});
it("preserves sort toggling and header indicators", () => {
  expect(nextEmployeeSort("name:asc", "name")).toBe("name:desc");
  expect(nextEmployeeSort("name:desc", "name")).toBe("name:asc");
  expect(employeeColumnSort("name:desc", "name")).toBe("descending");
  expect(employeeColumnSort("name:asc", "email")).toBe("none");
  expect(employeeSortIndicator("name:asc", "name")).toBe(" ↑");
  expect(employeeSortIndicator("name:asc", "email")).toBe("");
});
