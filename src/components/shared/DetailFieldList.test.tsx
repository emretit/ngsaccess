import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailFieldList } from "./DetailFieldList";

describe("DetailFieldList", () => {
  it("replaces only null, undefined and empty strings", () => {
    const html = renderToStaticMarkup(<DetailFieldList fields={[
      { key: "null", label: "Null", value: null },
      { key: "undefined", label: "Undefined", value: undefined },
      { key: "empty", label: "Empty", value: "" },
      { key: "zero", label: "Zero", value: 0 },
      { key: "false", label: "False", value: false },
      { key: "space", label: "Space", value: " " },
    ]} />);
    expect(html.match(/>—<\/dd>/g)).toHaveLength(3);
    expect(html).toContain('>0</dd>');
    expect(html).toContain('>False</dt><dd class="mt-1 text-sm break-words"></dd>');
    expect(html).toContain('> </dd>');
  });

  it("supports a custom empty value and preserves value slots", () => {
    const html = renderToStaticMarkup(<DetailFieldList emptyValue={<em>Eksik</em>} fields={[
      { key: "empty", label: "Empty", value: null },
      { key: "slot", label: "Slot", value: <button>Göster</button>, numeric: true },
    ]} />);
    expect(html).toContain('<em>Eksik</em>');
    expect(html).toContain('<button>Göster</button>');
    expect(html).toContain('text-sm break-words tabular-nums');
    expect(html).toMatch(/<dl[^>]*><div[^>]*><dt[^>]*>Empty<\/dt><dd/);
  });

  it("uses vertical spacing by default and a responsive grid for two columns", () => {
    const single = renderToStaticMarkup(<DetailFieldList fields={[]} />);
    const double = renderToStaticMarkup(<DetailFieldList fields={[]} columns={2} className="border-y" />);
    expect(single).toContain('space-y-4');
    expect(single).not.toContain('grid');
    expect(double).toContain('grid gap-4 sm:grid-cols-2 border-y');
    expect(double).not.toContain('space-y-4');
  });
});
