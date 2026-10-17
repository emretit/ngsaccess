import { describe, expect, it } from "vitest";
import {
  departmentScope,
  effectiveDoorIds,
  scopeSelectionState,
  selectionState,
  toggleDoors,
  toggleSelection,
} from "./selectionHelpers";

describe("erişim seçimi", () => {
  const departments = [
    { _id: "a" },
    { _id: "b", parentId: "a" },
    { _id: "c", parentId: "b" },
  ];
  const doors = [
    { _id: "d1", deviceId: "p" },
    { _id: "d2", deviceId: "p" },
  ];
  it("alt departmanları açık seçeneğe göre kapsar", () => {
    expect([...departmentScope(departments, "a", true)]).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect([...departmentScope(departments, "a", false)]).toEqual(["a"]);
  });
  it("bozuk döngüde sonlanır", () => {
    expect(
      departmentScope(
        [
          { _id: "a", parentId: "b" },
          { _id: "b", parentId: "a" },
        ],
        "a",
        true,
      ).size,
    ).toBe(2);
  });
  it("boş, kısmi ve tam seçimi ayırır", () => {
    expect(selectionState([], [])).toBe(false);
    expect(selectionState(["a", "b"], ["a"])).toBe("indeterminate");
    expect(selectionState(["a", "b"], ["a", "b"])).toBe(true);
    expect(toggleSelection(["a", "x"], ["a", "b"], true)).toEqual([
      "a",
      "x",
      "b",
    ]);
    expect(toggleSelection(["a", "x"], ["a", "b"], false)).toEqual(["x"]);
  });
  it("eski tüm-panel seçimini kapılara açar", () => {
    expect(
      effectiveDoorIds(doors, { selected_devices: ["p"], selected_doors: [] }),
    ).toEqual(["d1", "d2"]);
  });
  it("eski tüm-panel seçiminden bir kapı çıkarılabilir", () => {
    expect(
      toggleDoors(
        doors,
        { selected_devices: ["p"], selected_doors: [] },
        ["d1"],
        false,
      ),
    ).toEqual({ selected_devices: ["p"], selected_doors: ["d2"] });
  });
  it("son kapı kaldırılırken tüm-panel geri dönüşünü önler", () => {
    expect(
      toggleDoors(
        doors,
        { selected_devices: ["p"], selected_doors: ["d1"] },
        ["d1"],
        false,
      ),
    ).toEqual({ selected_devices: [], selected_doors: [] });
  });
  it("bölge panel üyeliği yerine kapı kapsamına göre kısmidir", () => {
    expect(scopeSelectionState(["d1", "d2"], [], ["d1"], ["p"])).toBe(
      "indeterminate",
    );
    expect(scopeSelectionState(["d1", "d2"], ["other"], ["d1", "d2"], [])).toBe(
      "indeterminate",
    );
  });
});
