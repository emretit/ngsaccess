import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  matchesRuleStatus,
  panelScope,
  pageRuleCandidates,
  personSearchTerms,
  activeRuleCursor,
} from "./accessRuleSummary";

const device = { _id: "panel" as Id<"devices">, name: "Panel X", doorCount: 4 };
const doors = [1, 2, 3, 4].map((index) => ({
  _id: `d${index}` as Id<"doors">,
  name: `Kapı ${index}`,
}));
describe("erişim kapsam özeti", () => {
  it("tek kapıyı tüm panelden ayırır", () => {
    expect(panelScope(device, doors, new Set(["d1"]), true)).toMatchObject({
      label: "Panel X — 1/4 kapı",
      selectedDoors: 1,
      wholePanel: false,
    });
    expect(panelScope(device, doors, new Set(), true)).toMatchObject({
      label: "Panel X — tüm kapılar",
      selectedDoors: 4,
      wholePanel: true,
    });
  });
  it("bütün kapılar tek tek seçilmişse tüm panel der", () => {
    expect(
      panelScope(device, doors, new Set(doors.map((door) => door._id)), true)
        .wholePanel,
    ).toBe(true);
  });
  it("panel bağı yokken boş kapı kümesi yetki vermez", () => {
    expect(panelScope(device, doors, new Set(), false).selectedDoors).toBe(0);
  });
  it("yalnız tanımlanmış kapıların tümüne seçili diye fiziksel paneli tüm saymaz", () => {
    expect(
      panelScope(device, doors.slice(0, 1), new Set(["d1"]), true).label,
    ).toBe("Panel X — 1/4 kapı");
  });
  it("eski isActive alanı olmayan kuralları aktif sayar", () => {
    expect(matchesRuleStatus(undefined, "active")).toBe(true);
    expect(matchesRuleStatus(undefined, "inactive")).toBe(false);
    expect(matchesRuleStatus(false, "active")).toBe(false);
    expect(matchesRuleStatus(false, "all")).toBe(true);
  });
});

describe("ters arama sayfalama", () => {
  const rules = [
    { _id: "a", _creationTime: 3 },
    { _id: "b", _creationTime: 2 },
    { _id: "c", _creationTime: 1 },
  ];
  it("aynı oluşturma zamanında kararlı sıra ile yinelenmeden ilerler", () => {
    const first = pageRuleCandidates(rules, null, 2, "project:person:ali");
    expect(first.page.map((rule) => rule._id)).toEqual(["a", "b"]);
    expect(first.isDone).toBe(false);
    expect(
      pageRuleCandidates(
        rules,
        first.continueCursor,
        2,
        "project:person:ali",
      ).page.map((rule) => rule._id),
    ).toEqual(["c"]);
    const equal = [
      { _id: "a", _creationTime: 1 },
      { _id: "b", _creationTime: 1 },
    ];
    const next = pageRuleCandidates(equal, null, 1, "same");
    expect(
      pageRuleCandidates(equal, next.continueCursor, 1, "same").page.map(
        (rule) => rule._id,
      ),
    ).toEqual(["a"]);
  });
  it("filtre/proje değişince eski cursor kabul etmez", () => {
    const first = pageRuleCandidates(rules, null, 1, "p1");
    expect(() =>
      pageRuleCandidates(rules, first.continueCursor, 1, "p2"),
    ).toThrow("Arama değişti");
  });
  it("yeni kayıt veya önceki kayıt silinmesi sayfayı kaydırmaz", () => {
    const first = pageRuleCandidates(rules, null, 1, "p1");
    expect(
      pageRuleCandidates(
        [{ _id: "new", _creationTime: 4 }, ...rules.slice(1)],
        first.continueCursor,
        2,
        "p1",
      ).page.map((rule) => rule._id),
    ).toEqual(["b", "c"]);
  });
});

it("tam kişi adında yaygın kısa ad yerine uzun terimle daraltır", () => {
  expect(personSearchTerms(" Ali YILDIRIM ")).toEqual({
    words: ["ali", "yıldırım"],
    lookup: "yıldırım",
  });
});

it("aktif sayfalama eski kayıt aşamasını ve filtre kapsamını korur", () => {
  expect(activeRuleCursor(null, "p")).toEqual({
    phase: "active",
    cursor: null,
  });
  const cursor = JSON.stringify({
    scope: "p",
    phase: "legacy",
    cursor: "native-cursor",
  });
  expect(activeRuleCursor(cursor, "p")).toEqual({
    phase: "legacy",
    cursor: "native-cursor",
  });
  expect(() => activeRuleCursor(cursor, "other")).toThrow("Arama değişti");
  expect(() =>
    activeRuleCursor(
      JSON.stringify({ scope: "p", phase: "inactive", cursor: null }),
      "p",
    ),
  ).toThrow();
});

// The native query is called once per response; partitions are checked without pagination.
describe("tür filtresi tüm kayıtlarda sayfalanır", () => {
  it("sonraki tür bölümünü ve bölüm içindeki sayfaları kayıpsız gezer", async () => {
    const { pageRuleStages } = await import("./accessRuleSummary");
    const batches = [["legacy-person"], [], Array.from({ length: 21 }, (_, i) => `person-${i}`)];
    let paginations = 0;
    const fetch = async (phase: number, cursor: string | null) => {
      paginations += 1;
      const start = Number(cursor ?? 0);
      const rows = batches[phase] ?? [];
      return { page: rows.slice(start, start + 20), isDone: start + 20 >= rows.length, continueCursor: String(start + 20) };
    };
    const exists = async (phase: number) => Boolean(batches[phase]?.length);
    const first = await pageRuleStages(3, "personnel", null, fetch, exists);
    expect(first.page).toEqual(["legacy-person"]);
    expect(first.isDone).toBe(false);
    const second = await pageRuleStages(3, "personnel", first.continueCursor, fetch, exists);
    expect(second.page).toHaveLength(20);
    const third = await pageRuleStages(3, "personnel", second.continueCursor, fetch, exists);
    expect(third.page).toEqual(["person-20"]);
    expect(third.isDone).toBe(true);
    expect(paginations).toBe(3);
    await expect(pageRuleStages(3, "visitor", first.continueCursor, fetch, exists)).rejects.toThrow("Arama değişti");
  });
  it("eski ve bilinmeyen personel türlerini, eksik aktiflik alanını korur", async () => {
    const { personnelRuleTypes, ruleTypeStages, matchesRuleType } = await import("./accessRuleSummary");
    const rows = [{}, { targetType: "employee" }, { targetType: "legacy-custom" }, { targetType: "visitor" }];
    let index = 0;
    const types = await personnelRuleTypes(async () => rows[index++] ?? null);
    expect(types).toEqual([undefined, "employee", "legacy-custom"]);
    const stages = ruleTypeStages("personnel", "active", types);
    expect(stages).toHaveLength(6);
    expect(stages).toContainEqual({ targetType: "legacy-custom", isActive: undefined });
    expect(stages.some(stage => stage.targetType === "visitor")).toBe(false);
    expect(ruleTypeStages("visitor", "inactive")).toEqual([{ targetType: "visitor", isActive: false }]);
    expect(matchesRuleType("legacy-custom", "personnel")).toBe(true);
    expect(matchesRuleType(undefined, "visitor")).toBe(false);
  });
  it("boş bütün tür bölümlerinde kayıt varmış gibi sonraki sayfa sunmaz", async () => {
    const { pageRuleStages } = await import("./accessRuleSummary");
    expect(await pageRuleStages(2, "p", null, async () => { throw new Error("paginate çağrılmamalı"); }, async () => false)).toEqual({ page: [], isDone: true, continueCursor: "" });
  });
});
