import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("renders children and an inactive clear button without a search input", () => {
    const html = renderToStaticMarkup(<FilterBar label="Rapor filtreleri" onClear={vi.fn()}><select aria-label="Departman" /></FilterBar>);
    expect(html).not.toContain('<input');
    expect(html).toContain('aria-label="Rapor filtreleri"');
    expect(html).toContain('aria-label="Departman"');
    expect(html).toMatch(/disabled=""[^>]*>Filtreleri temizle/);
  });

  it("keeps the existing search layout, label association and clear behavior", () => {
    const html = renderToStaticMarkup(<FilterBar search="Ayşe" onSearchChange={vi.fn()} searchLabel="Kişi ara" placeholder="Ad soyad" onClear={vi.fn()} end={<span>Actions</span>} />);
    const id = html.match(/<input[^>]*id="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain('type="search"');
    expect(html).toContain('value="Ayşe"');
    expect(html).toContain('placeholder="Ad soyad"');
    expect(html).toContain('flex flex-wrap items-end gap-3');
    expect(html).toContain('w-full space-y-1 min-[761px]:w-[260px]');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('<div class="ml-auto"><span>Actions</span></div>');
  });

  it("disables clear only when both search and filters are empty", () => {
    expect(renderToStaticMarkup(<FilterBar search="" onSearchChange={vi.fn()} onClear={vi.fn()} />)).toMatch(/disabled=""[^>]*>Filtreleri temizle/);
    expect(renderToStaticMarkup(<FilterBar hasFilters onClear={vi.fn()} />)).not.toContain('disabled=""');
  });

  it("preserves grid order and allows consumers without a clear action", () => {
    const html = renderToStaticMarkup(<FilterBar layout="grid" search="" onSearchChange={vi.fn()} searchLabel="Ad ara"><select aria-label="Departman" /></FilterBar>);
    expect(html).toContain('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2');
    expect(html.indexOf('<select')).toBeLessThan(html.indexOf('<input'));
    expect(html).toContain('sr-only');
    expect(html).not.toContain('Filtreleri temizle');
  });
});
