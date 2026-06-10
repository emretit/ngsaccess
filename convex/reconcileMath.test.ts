import { describe, it, expect } from "vitest";
import { diffIds, orphanPanels, staleGroupDoorIds } from "./lib/reconcileMath";

describe("reconcileMath – diffIds", () => {
  it("çıkarılan / eklenen / korunan ayrımı", () => {
    const r = diffIds(["a", "b", "c"], ["b", "c", "d"]);
    expect(r.removed.sort()).toEqual(["a"]);
    expect(r.added.sort()).toEqual(["d"]);
    expect(r.kept.sort()).toEqual(["b", "c"]);
  });

  it("aynı edit'te yeniden eklenen (eski+yeni'de) → removed boş", () => {
    const r = diffIds(["talip", "emre"], ["talip", "emre"]);
    expect(r.removed).toEqual([]);
    expect(r.added).toEqual([]);
    expect(r.kept.sort()).toEqual(["emre", "talip"]);
  });

  it("tüm üyeler çıkarıldı", () => {
    const r = diffIds(["a", "b"], []);
    expect(r.removed.sort()).toEqual(["a", "b"]);
    expect(r.added).toEqual([]);
    expect(r.kept).toEqual([]);
  });

  it("boş eski liste → hepsi added", () => {
    const r = diffIds([], ["a", "b"]);
    expect(r.removed).toEqual([]);
    expect(r.added.sort()).toEqual(["a", "b"]);
  });

  it("eski listede yinelenenler tekilleşir", () => {
    const r = diffIds(["a", "a", "b"], ["b"]);
    expect(r.removed).toEqual(["a"]);
    expect(r.kept).toEqual(["b"]);
  });
});

describe("reconcileMath – orphanPanels", () => {
  it("hâlâ erişilen panel orphan değil (başka kuralla erişim)", () => {
    // aday: kuralın panelleri; remaining: çalışanın kalan panelleri
    expect(orphanPanels(["p1", "p2"], ["p2"])).toEqual(["p1"]);
  });

  it("hiç kalan yok → tüm adaylar orphan", () => {
    expect(orphanPanels(["p1", "p2"], [])).toEqual(["p1", "p2"]);
  });

  it("hepsi hâlâ erişiliyor → orphan yok", () => {
    expect(orphanPanels(["p1"], ["p1", "p2"])).toEqual([]);
  });

  it("aday listesi tekilleşir", () => {
    expect(orphanPanels(["p1", "p1"], [])).toEqual(["p1"]);
  });
});

describe("reconcileMath – staleGroupDoorIds", () => {
  const rows = [
    { _id: "gd1", doorId: "d1" },
    { _id: "gd2", doorId: "d2" },
    { _id: "gd3", doorId: "d3" },
  ];

  it("çıkarılan cihazın kapısına ait satır silinir, kalan cihazınki kalır", () => {
    const doorDeviceById = new Map([
      ["d1", "devA"],
      ["d2", "devB"],
      ["d3", "devA"],
    ]);
    expect(staleGroupDoorIds(rows, doorDeviceById, new Set(["devA"]))).toEqual([
      "gd1",
      "gd3",
    ]);
  });

  it("taşınmış kapı (canlı deviceId artık başka cihazda) silinmez", () => {
    // gd1 yazıldığında kapı devA'daydı; sonradan devC'ye taşındı → canlı harita devC der.
    const doorDeviceById = new Map([["d1", "devC"]]);
    expect(staleGroupDoorIds([rows[0]], doorDeviceById, new Set(["devA"]))).toEqual([]);
  });

  it("silinmiş kapı (haritada yok) dokunulmaz", () => {
    const doorDeviceById = new Map<string, string | undefined>();
    expect(staleGroupDoorIds([rows[0]], doorDeviceById, new Set(["devA"]))).toEqual([]);
  });

  it("cihaza bağlı olmayan kapı (deviceId undefined) dokunulmaz", () => {
    const doorDeviceById = new Map<string, string | undefined>([["d1", undefined]]);
    expect(staleGroupDoorIds([rows[0]], doorDeviceById, new Set(["devA"]))).toEqual([]);
  });

  it("birden çok çıkarılan cihaz aynı geçişte yakalanır", () => {
    const doorDeviceById = new Map([
      ["d1", "devA"],
      ["d2", "devB"],
      ["d3", "devC"],
    ]);
    expect(
      staleGroupDoorIds(rows, doorDeviceById, new Set(["devA", "devB"])),
    ).toEqual(["gd1", "gd2"]);
  });
});
