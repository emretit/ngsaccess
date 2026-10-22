import { describe, expect, it } from "vitest";
import { buildDoorPlans, buildPersonPayload } from "./persons";

const person = { employeeNo: "123", name: "Employee", beginTime: "2026-01-01T00:00:00" };
describe("Hik door-to-plan payload", () => {
  it("preserves single-rule all-door payload exactly", () => {
    const old = buildPersonPayload({ ...person, doorCount: 2, planTemplateNo: 4 });
    expect(buildPersonPayload({ ...person, ...buildDoorPlans(2, [{ planTemplateNo: 4 }]) })).toEqual(old);
    expect(old).toMatchObject({ doorRight: "1,2", RightPlan: [{ doorNo: 1, planTemplateNo: "4" }, { doorNo: 2, planTemplateNo: "4" }] });
  });
  it("door-leg grants only selected doors", () => {
    expect(buildPersonPayload({ ...person, ...buildDoorPlans(4, [{ planTemplateNo: 5, doorNos: [2] }]) })).toMatchObject({ doorRight: "2", RightPlan: [{ doorNo: 2, planTemplateNo: "5" }] });
  });
  it("merges every rule into deterministic per-door comma-separated templates", () => {
    const scope = buildDoorPlans(3, [{ planTemplateNo: 7, doorNos: [2, 3] }, { planTemplateNo: 4 }, { planTemplateNo: 7, doorNos: [2] }]);
    expect(buildPersonPayload({ ...person, ...scope })).toMatchObject({ doorRight: "1,2,3", RightPlan: [{ doorNo: 1, planTemplateNo: "4" }, { doorNo: 2, planTemplateNo: "4,7" }, { doorNo: 3, planTemplateNo: "4,7" }] });
  });
  it("skips missing/out-of-range mappings and emits warnings", () => {
    const scope = buildDoorPlans(4, [{ planTemplateNo: 5, doorNos: [undefined, 0, 5, 2] }]);
    expect(scope.warnings).toHaveLength(3);
    expect(scope.doorPlans).toEqual([{ doorNo: 2, planTemplateNos: [5] }]);
  });
  it("empty scope is unauthorized even with a legacy fallback plan", () => {
    const scope = buildDoorPlans(4, [{ planTemplateNo: 5, doorNos: [undefined] }]);
    expect(() => buildPersonPayload({ ...person, planTemplateNo: 1, ...scope })).toThrow("unauthorized");
    expect(() => buildPersonPayload({ ...person, doorPlans: [] })).toThrow("unauthorized");
  });
});
