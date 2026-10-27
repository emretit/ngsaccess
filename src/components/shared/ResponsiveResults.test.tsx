import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResponsiveResults } from "./ResponsiveResults";

describe("ResponsiveResults", () => {
  it("keeps table and list semantics inside a single md breakpoint", () => {
    const html = renderToStaticMarkup(<ResponsiveResults label="Kayıtlar" desktop={<table><tbody><tr><td>Masaüstü</td></tr></tbody></table>} mobile={<ul><li>Mobil</li></ul>} />);
    expect(html).toContain('role="group" aria-label="Kayıtlar"');
    expect(html).toContain('class="hidden min-w-0 max-w-full overflow-x-auto rounded-md border md:block"><table>');
    expect(html).toContain('class="min-w-0 rounded-md border md:hidden"><ul>');
    expect(html).not.toContain("761px");
  });

  it("renders a shared footer once after both layouts and accepts caller styling", () => {
    const html = renderToStaticMarkup(<ResponsiveResults label="Sonuçlar" className="bg-surface" desktop={<span>Masaüstü</span>} mobile={<span>Mobil</span>} footer={<button>Devamı</button>} />);
    expect(html).toContain("min-w-0 bg-surface");
    expect(html.match(/Devamı/g)).toHaveLength(1);
    expect(html.indexOf("Devamı")).toBeGreaterThan(html.indexOf("Mobil"));
  });
});
