import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import * as shared from "./employeeListShared";
import * as frontendList from "../../src/components/employees/lib/employeeList";
import * as frontendKeys from "../../src/components/employees/lib/employeeListKeys";

it("frontend list and indexed keys use the same dependency-free backend implementation", () => {
  expect(frontendList.filterAndSortEmployees).toBe(shared.filterAndSortEmployees);
  expect(frontendList.employeeDepartmentScope).toBe(shared.employeeDepartmentScope);
  expect(frontendKeys.employeeNaturalKey).toBe(shared.employeeNaturalKey);
  expect(frontendKeys.EMPLOYEE_LIST_VERSION).toBe(shared.EMPLOYEE_LIST_VERSION);
  const rows = ["Kat 10", "Kat 2"].map((firstName, index) => ({ _id: String(index), firstName, lastName: "", email: "", cardNumber: "", departmentId: "child" }));
  expect(shared.filterAndSortEmployees(rows, "Kat", "root", "all", "name:asc", { departmentIds: shared.employeeDepartmentScope("root", true, [{ _id: "child", parentId: "root" }]) }).map(row => row.firstName)).toEqual(["Kat 2", "Kat 10"]);
});

it("production Convex sources never import frontend paths or application aliases", () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === "_generated") return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
  for (const path of files(root)) expect(readFileSync(path, "utf8"), path).not.toMatch(/["'](?:@\/|(?:\.\.\/)+src\/)/);
});
