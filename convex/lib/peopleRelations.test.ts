import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import { employeeRelationsToValidate } from "./peopleRelations";
import { assertPeopleProject } from "./peopleScope";

const projectId = "project-a" as Id<"projects">;
const departmentId = "broken-department" as Id<"departments">;
const current = { projectId, departmentId, companyId: "old-company" as Id<"companies"> };

describe("employee update relation selection", () => {
  it("does not revalidate broken old relations for an active flag update", () => {
    const updates = { isActive: false };
    const selected = employeeRelationsToValidate(current, { projectId: undefined, ...updates });
    expect(selected).toEqual({ projectId });
    expect(selected.departmentId).toBeUndefined();
  });
  it("selects a newly supplied department so its foreign project is rejected", () => {
    const selected = employeeRelationsToValidate(current, { departmentId: "new-department" as Id<"departments"> });
    expect(selected.departmentId).toBe("new-department");
    expect(selected.companyId).toBeUndefined();
    expect(() => assertPeopleProject(selected.projectId, "project-b", "Çalışan ve departman")).toThrow("aynı projede");
  });
  it("validates all retained relations when the project changes", () => {
    expect(employeeRelationsToValidate(current, { projectId: "project-b" as Id<"projects"> })).toMatchObject({
      projectId: "project-b", departmentId, companyId: current.companyId,
    });
  });
  it("keeps relation removal and same-project updates selective", () => {
    expect(employeeRelationsToValidate(current, { departmentId: undefined, projectId })).toEqual({ projectId, departmentId: undefined });
  });
});
