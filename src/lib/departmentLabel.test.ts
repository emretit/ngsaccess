import { describe, expect, it } from "vitest";
import { departmentLabels } from "./departmentLabel";

describe("departmentLabels", () => {
  const companies = [{ _id: "c1", name: "NGS" }, { _id: "c2", name: "Fabrika" }];

  it("prefixes the company so same-named departments stay distinct", () => {
    const labels = departmentLabels([
      { _id: "d1", name: "Yönetim", companyId: "c1" },
      { _id: "d2", name: "Yönetim", companyId: "c2" },
      { _id: "d3", name: "Depo" },
    ], companies);
    expect([...labels.values()]).toEqual(["NGS / Yönetim", "Fabrika / Yönetim", "Depo"]);
  });

  it("uses the custom name and tolerates loading lists", () => {
    expect(departmentLabels([{ _id: "d1", name: "Muhasebe", companyId: "c1" }], companies, (d) => `Mali / ${d.name}`).get("d1")).toBe("NGS / Mali / Muhasebe");
    expect(departmentLabels(undefined, undefined).size).toBe(0);
    expect(departmentLabels([{ _id: "d1", name: "Depo", companyId: "c9" }], undefined).get("d1")).toBe("Depo");
  });
});
