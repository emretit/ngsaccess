import { describe, expect, it, vi } from "vitest";
import { listSelectionChecked, selectAllListSelection, toggleListSelection, useListSelection } from "./useListSelection";

describe("list selection", () => {
  it("toggles without mutating the controlled set, preserving unrelated ids", () => {
    const selected = new Set(["a", "outside"]);
    expect([...toggleListSelection(selected, "a")]).toEqual(["outside"]);
    expect([...toggleListSelection(selected, "b")]).toEqual(["a", "outside", "b"]);
    expect([...selected]).toEqual(["a", "outside"]);
  });

  it("selects only visible ids and clears the entire selection", () => {
    expect([...selectAllListSelection(["a", "b", "a"], true)]).toEqual(["a", "b"]);
    expect(selectAllListSelection(["a"], false).size).toBe(0);
  });

  it("derives all three states from visible ids only", () => {
    expect(listSelectionChecked([], new Set(["a"]))).toBe(false);
    expect(listSelectionChecked(["a", "b"], new Set(["outside"]))).toBe(false);
    expect(listSelectionChecked(["a", "b"], new Set(["a", "outside"]))).toBe("indeterminate");
    expect(listSelectionChecked(["a", "b"], new Set(["a", "b"]))).toBe(true);
  });

  it("reports changes through the controlled callback without choosing a reset policy", () => {
    const onChange = vi.fn();
    const actions = useListSelection({ visibleIds: ["a", "b"], selected: new Set(["a"]), onChange });
    expect(actions.checked).toBe("indeterminate");
    expect(onChange).not.toHaveBeenCalled();
    actions.toggle("b");
    expect(onChange).toHaveBeenLastCalledWith(new Set(["a", "b"]));
    actions.selectAll(false);
    expect(onChange).toHaveBeenLastCalledWith(new Set());
  });
});
