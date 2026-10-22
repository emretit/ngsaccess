import { describe, expect, it } from "vitest";
import { readRuleFilters, scopeText } from "./accessRulesListModel";
import type { Summary } from "./accessRulesListModel";

describe("readRuleFilters", () => {
  it("keeps valid URL filters and the search text unchanged", () => {
    expect(
      readRuleFilters(
        new URLSearchParams("q= Ada &by=door&durum=inactive&tur=visitor"),
      ),
    ).toEqual({
      search: " Ada ",
      searchBy: "door",
      status: "inactive",
      type: "visitor",
    });
  });
  it("uses the original defaults for missing or unknown filters", () => {
    expect(
      readRuleFilters(new URLSearchParams("by=other&durum=other&tur=other")),
    ).toEqual({ search: "", searchBy: "rule", status: "all", type: "all" });
  });
});

it("scope labels preserve truncation, panel ordering and missing-panel warnings", () => {
  const rule = { panels: [], unassignedDoors: [] } as unknown as Summary;
  expect(scopeText(rule)).toBe("Kapı veya panel seçilmemiş");
  expect(
    scopeText({ ...rule, panels: [{ label: "B" }, { label: "A" }] } as Summary),
  ).toBe("B, A");
  expect(scopeText({ ...rule, scopeTruncated: true })).toBe(
    "Geniş kapsam · Ayrıntıyı aç",
  );
});
