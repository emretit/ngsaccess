import type { EmploymentEmployee as Employee } from "../lib/employment";
import type { Id } from "../../../../convex/_generated/dataModel";
export function employeeSelectionName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName} (${employee.payrollCode || "Bordro kodu yok"})`;
}
export function selectedEmployeeNames(
  employees: Employee[],
  selectedEmployees: Id<"employees">[],
) {
  return employees
    .filter((emp) => selectedEmployees.includes(emp._id))
    .map(employeeSelectionName)
    .join(", ");
}
export function employeeSelectionState(
  employees: Employee[],
  selectedEmployees: Id<"employees">[],
): boolean | "indeterminate" {
  return employees.length > 0 &&
    employees.every((emp) => selectedEmployees.includes(emp._id))
    ? true
    : employees.some((emp) => selectedEmployees.includes(emp._id))
      ? "indeterminate"
      : false;
}

export function employeeColumnSort(
  sort: string,
  key: string,
): "ascending" | "descending" | "none" {
  return sort.startsWith(`${key}:`)
    ? sort.endsWith(":desc")
      ? "descending"
      : "ascending"
    : "none";
}
export function nextEmployeeSort(sort: string, key: string) {
  return `${key}:${sort === `${key}:asc` ? "desc" : "asc"}`;
}
export function employeeSortIndicator(sort: string, key: string) {
  return sort.startsWith(`${key}:`)
    ? sort.endsWith(":desc")
      ? " ↓"
      : " ↑"
    : "";
}
