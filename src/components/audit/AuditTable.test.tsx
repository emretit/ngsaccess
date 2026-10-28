import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AuditTable } from "./AuditTable";
import { AuditResults } from "./AuditResults";

vi.mock("convex/react", () => ({ usePaginatedQuery: () => ({ results: [], status: "LoadingFirstPage", loadMore: vi.fn() }) }));

describe("Denetim tablosu durumları", () => {
  it.each([false, true])("boş ve yükleme durumunda başlıkları ve kolon kapsamını korur (%s)", allProjects => {
    for (const loading of [false, true]) {
      const html = renderToStaticMarkup(<AuditTable rows={[]} allProjects={allProjects} loading={loading} onSelect={vi.fn()} />);
      expect(html).toContain("<thead");
      expect(html).toContain("Zaman (TR)");
      expect(html).toContain(`colSpan="${allProjects ? 7 : 6}"`);
      expect(html).toMatch(loading ? /<tbody>.*aria-busy="true"/s : /<tbody>.*Henüz denetim kaydı yok/s);
    }
  });
  it("ilk sorgu yüklenirken tabloyu gösterir", () => {
    const html = renderToStaticMarkup(<AuditResults args={{ allProjects: true }} />);
    expect(html).toContain("<thead");
    expect(html).toContain('colSpan="7"');
    expect(html).toContain("Denetim kayıtları yükleniyor");
  });
});
