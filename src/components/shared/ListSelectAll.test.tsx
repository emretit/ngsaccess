import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ListSelectAll } from "./ListSelectAll";

describe("ListSelectAll", () => {
  it.each([false, true, "indeterminate"] as const)("announces controlled state %s", checked => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(<ListSelectAll label="Görünenleri seç" checked={checked} onChange={onChange} />);
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-label="Görünenleri seç"');
    expect(html).toContain(`aria-checked="${checked === "indeterminate" ? "mixed" : checked}"`);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("normalizes the primitive change event to a boolean", () => {
    const onChange = vi.fn();
    const element = ListSelectAll({ label: "Tümü", checked: false, onChange });
    element.props.onCheckedChange(true);
    expect(onChange).toHaveBeenLastCalledWith(true);
    element.props.onCheckedChange(false);
    expect(onChange).toHaveBeenLastCalledWith(false);
    element.props.onCheckedChange("indeterminate");
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("disables the checkbox and uses the shared partial-state line", () => {
    const html = renderToStaticMarkup(<ListSelectAll label="Tümü" checked="indeterminate" onChange={() => {}} disabled />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("data-[state=indeterminate]:before:h-0.5");
    expect(html).toContain("[&amp;[data-state=indeterminate]_svg]:hidden");
  });
});
