import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PaginationBar, pageRange } from "./PaginationBar";

const noop = () => {};
// Tailwind sınıflarında "disabled:" geçtiği için yalnız HTML özniteliğine bak.
const DISABLED = ' disabled=""';
const button = (html: string, label: string) =>
  html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? "";

describe("PaginationBar", () => {
  it("formats the visible range", () => {
    expect(pageRange(0, 1, 25)).toBe("0–0");
    expect(pageRange(60, 3, 25)).toBe("51–60");
  });
  it("shows page / total and disables the ends when the page count is known", () => {
    const first = renderToStaticMarkup(<PaginationBar summary="1–25" page={1} pageCount={3} onPrevious={noop} onNext={noop} />);
    expect(first).toContain("1 / 3");
    expect(button(first, "Önceki")).toContain(DISABLED);
    expect(button(first, "Sonraki")).not.toContain(DISABLED);
    const last = renderToStaticMarkup(<PaginationBar summary="" page={3} pageCount={3} onPrevious={noop} onNext={noop} />);
    expect(button(last, "Sonraki")).toContain(DISABLED);
  });
  it("shows only the page number for cursor lists and honours explicit disabling", () => {
    const html = renderToStaticMarkup(
      <PaginationBar summary="Sayfa 2" page={2} onPrevious={noop} onNext={noop} nextDisabled nextLabel="Devam" />,
    );
    expect(html).not.toContain("/ ");
    expect(button(html, "Devam")).toContain(DISABLED);
    expect(button(html, "Önceki")).not.toContain(DISABLED);
  });
  it.each([0, 1])("hides all controls and the empty group for a single page at the smallest size (pageCount=%s)", (pageCount) => {
    const html = renderToStaticMarkup(
      <PaginationBar summary="30 kayıt" page={1} pageCount={pageCount} pageSize={50} pageSizes={[100, 50, 200]} onPageSizeChange={noop} onPrevious={noop} onNext={noop} />,
    );
    expect(html).toContain('<span role="status">30 kayıt</span>');
    expect(html).not.toContain("Önceki");
    expect(html).not.toContain("Sonraki");
    expect(html).not.toContain("tabular-nums");
    expect(html).not.toContain('role="combobox"');
    expect(html.match(/<div\b/g)).toHaveLength(1);
  });
  it("keeps the size selector but hides navigation for a single page at a larger size", () => {
    const html = renderToStaticMarkup(
      <PaginationBar summary="30 kayıt" page={1} pageCount={1} pageSize={100} pageSizes={[50, 100, 200]} onPageSizeChange={noop} onPrevious={noop} onNext={noop} />,
    );
    expect(html).toContain('<span role="status">30 kayıt</span>');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Sayfadaki kayıt sayısı"');
    expect(html).not.toContain("Önceki");
    expect(html).not.toContain("Sonraki");
    expect(html).not.toContain("tabular-nums");
  });
  it("keeps all controls for cursor lists even on the first page at the smallest size", () => {
    const html = renderToStaticMarkup(
      <PaginationBar summary="30 kayıt" page={1} pageSize={50} pageSizes={[50, 100, 200]} onPageSizeChange={noop} onPrevious={noop} onNext={noop} />,
    );
    expect(html).toContain('<span role="status">30 kayıt</span>');
    expect(html).toContain('role="combobox"');
    expect(button(html, "Önceki")).toContain(DISABLED);
    expect(button(html, "Sonraki")).not.toBe("");
    expect(button(html, "Sonraki")).not.toContain(DISABLED);
    expect(html).toContain('<span class="tabular-nums">1</span>');
  });
  it("keeps navigation when the current page exceeds one despite a reduced page count", () => {
    const html = renderToStaticMarkup(
      <PaginationBar summary="" page={2} pageCount={1} onPrevious={noop} onNext={noop} />,
    );
    expect(button(html, "Önceki")).not.toBe("");
    expect(button(html, "Önceki")).not.toContain(DISABLED);
    expect(html).toContain("2 / 1");
    expect(button(html, "Sonraki")).toContain(DISABLED);
  });
});
