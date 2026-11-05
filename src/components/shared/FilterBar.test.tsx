import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterBar, FilterField, FILTER_FIELD_CLASS } from "./FilterBar";

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
    expect(html).toContain('grid w-full min-w-0 gap-1 text-xs min-[761px]:w-auto min-[761px]:flex-[1_1_200px] min-[761px]:max-w-[260px]');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('<div class="ml-auto flex flex-wrap items-center gap-2"><span>Actions</span></div>');
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

it("shares the field width and gives a control one visible associated label", () => {
  const html = renderToStaticMarkup(<FilterField label="Durum" htmlFor="status"><select id="status"><option>Tüm durumlar</option></select></FilterField>);
  expect(html).toContain(`class="${FILTER_FIELD_CLASS}"`);
  expect(html).toContain('<label for="status">Durum</label>');
  expect(html).toContain('<select id="status">');
  expect(html.match(/>Durum</g)).toHaveLength(1);
  expect(html).not.toContain('aria-label');
  expect(renderToStaticMarkup(<FilterField label="Bilgi"><span>Değer</span></FilterField>)).toContain('<span>Bilgi</span>');
});
