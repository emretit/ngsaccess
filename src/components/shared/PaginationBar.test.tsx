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
});
