import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/shared/EmptyState";
import VisitorTable from "./VisitorTable";

describe("Ziyaretçi tablosu durumları", () => {
  it.each([false, true])("boş ve yükleme durumunda yedi başlığı korur (%s)", loading => {
    const html = renderToStaticMarkup(<VisitorTable visitors={[]} loading={loading} onOpen={vi.fn()} emptyState={<EmptyState title="Arama devam ediyor" action={{ label: "Daha fazla kayıt tara", onClick: vi.fn() }} />} />);
    expect(html).toContain("<thead");
    expect(html.match(/<th /g)).toHaveLength(7);
    expect(html).toContain('colSpan="7"');
    expect(html).toMatch(loading ? /<tbody.*aria-busy="true"/s : /<tbody.*Daha fazla kayıt tara/s);
  });
});
