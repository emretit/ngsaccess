import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MasterDetailListLayout } from "./MasterDetailListLayout";

describe("MasterDetailListLayout", () => {
  it("renders the sidebar before the flexible results column", () => {
    const html = renderToStaticMarkup(
      <MasterDetailListLayout sidebar={<aside className="w-full min-[1100px]:w-[220px]">Tree</aside>}>
        <section>Results</section>
      </MasterDetailListLayout>,
    );
    expect(html).toBe('<div class="flex min-w-0 flex-col gap-4 min-[1100px]:flex-row min-[1100px]:gap-5"><aside class="w-full min-[1100px]:w-[220px]">Tree</aside><div class="min-w-0 flex-1 space-y-4"><section>Results</section></div></div>');
  });

  it("renders only the results column when no sidebar is supplied", () => {
    const html = renderToStaticMarkup(<MasterDetailListLayout><p>Results</p></MasterDetailListLayout>);
    expect(html).toContain('<div class="min-w-0 flex-1 space-y-4"><p>Results</p></div>');
    expect(html.match(/<div\b/g)).toHaveLength(2);
  });

  it("merges caller classes with the outer layout classes", () => {
    const html = renderToStaticMarkup(<MasterDetailListLayout className="mb-6 gap-6">Results</MasterDetailListLayout>);
    const outer = html.slice(0, html.indexOf(">"));
    expect(outer).toContain("mb-6");
    expect(outer).toContain("gap-6");
    expect(outer).not.toMatch(/\bgap-4\b/);
    expect(outer).toContain("min-[1100px]:flex-row");
  });
});
