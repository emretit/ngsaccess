import { describe, expect, it } from "vitest";
import { projectScopedPdksParams } from "./filterParams";
describe("PDKS project scope", () => {
  const query = "company=c&dept=d&pos=p&shift=s&person=Ayşe&employeeId=employee&date=2026-10-16&from=2026-10-01&to=2026-10-31&report=monthly&status=late&other=keep";
  it("clears organization and person on a project switch before querying, preserving period and other state", () => {
    const original = new URLSearchParams(query);
    const result = projectScopedPdksParams(original, "old", "new");
    for (const key of ["company", "dept", "pos", "shift", "person", "employeeId"])
      expect(result.has(key)).toBe(false);
    expect(result.toString()).toBe("date=2026-10-16&from=2026-10-01&to=2026-10-31&report=monthly&status=late&other=keep");
    expect(original.get("dept")).toBe("d");
  });
  it("preserves deep links on first load and while initial project loads", () => {
    const params = new URLSearchParams(query);
    expect(projectScopedPdksParams(params, undefined, undefined)).toBe(params);
    expect(projectScopedPdksParams(params, undefined, "first")).toBe(params);
    expect(projectScopedPdksParams(params, "same", "same")).toBe(params);
  });
  it("clears stale scope when an existing project is deselected", () => {
    expect(projectScopedPdksParams(new URLSearchParams(query), "old", undefined).has("dept")).toBe(false);
  });
});
