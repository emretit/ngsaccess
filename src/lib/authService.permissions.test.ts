import { describe, expect, it } from "vitest";
import { checkUserRole } from "@/services/authService";

describe("legacy account helper is not a project authorization source", () => {
  it("does not infer project management from the old account role", () => {
    expect(checkUserRole({ role: "project_admin" }, "project_admin")).toBe(false);
    expect(checkUserRole({ role: "project_user" }, "project_admin")).toBe(false);
    expect(checkUserRole(null, "project_user")).toBe(false);
  });
  it("preserves platform and signed-in compatibility checks", () => {
    expect(checkUserRole({ role: "super_admin" }, "super_admin")).toBe(true);
    expect(checkUserRole({ role: "project_user" }, "project_user")).toBe(true);
  });
});
