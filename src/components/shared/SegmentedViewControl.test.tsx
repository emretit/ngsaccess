import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SegmentedViewControl } from "./SegmentedViewControl";

const options = [
  { value: "person", label: "Kişi" },
  { value: "device", label: <span>Cihaz</span>, disabled: true },
] as const;

describe("SegmentedViewControl", () => {
  it("labels the group and marks only the selected option as pressed", () => {
    const html = renderToStaticMarkup(<SegmentedViewControl label="Görünüm" value="person" options={options} onChange={() => {}} />);
    expect(html).toContain('role="group" aria-label="Görünüm"');
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain('aria-pressed="true"');
    expect(buttons[0]).toContain("bg-secondary");
    expect(buttons[1]).toContain('aria-pressed="false"');
    expect(buttons[1]).not.toContain("bg-secondary");
    expect(buttons[1]).toContain('<span>Cihaz</span>');
  });

  it("disables only the unavailable option and uses non-submit buttons", () => {
    const html = renderToStaticMarkup(<SegmentedViewControl label="Görünüm" value="person" options={options} onChange={() => {}} />);
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons[0]).not.toContain('disabled=""');
    expect(buttons[1]).toContain('disabled=""');
    expect(buttons.every(button => button.includes('type="button"'))).toBe(true);
  });
});
