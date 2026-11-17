import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";
import { PageTemplate } from "./PageTemplate";

describe("PageHeader primary action", () => {
  it("renders the label with the shared button classes and Plus icon", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Personel" primaryAction={{ label: "Personel ekle", onClick: vi.fn() }} />,
    );
    const button = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";

    expect(button.replace(/<[^>]*>/g, "")).toBe("Personel ekle");
    expect(button).toContain("text-xs");
    expect(button).toContain("min-h-11");
    expect(button).toContain("md:min-h-8");
    expect(button).toContain("gap-1.5");
    expect(button).toContain("lucide-plus");
    expect(button).toContain('aria-hidden="true"');
    expect(button).not.toContain(' disabled=""');
  });

  it("forwards disabled to the primary action button", () => {
    const html = renderToStaticMarkup(
      <PageHeader title="Personel" primaryAction={{ label: "Personel ekle", onClick: vi.fn(), disabled: true }} />,
    );

    expect(html).toContain(' disabled=""');
  });
});

it("supports primary slots without a forced icon and optional legacy icons", () => {
  const slot = renderToStaticMarkup(<PageHeader title="Raporlar" primaryAction={<a href="/reports">Rapor aç</a>} />);
  expect(slot).toContain('href="/reports"');
  expect(slot).not.toContain("lucide-plus");
  const legacy = renderToStaticMarkup(<PageHeader title="Raporlar" primaryAction={{ label: "Dışa aktar", onClick: vi.fn(), icon: null }} />);
  expect(legacy).toContain("Dışa aktar");
  expect(legacy).not.toContain("lucide-plus");
});

it("composes page slots in order with one heading and no extra main", () => {
  const html = renderToStaticMarkup(<PageTemplate title="Kişiler" scope="Proje kapsamı"
    backLink={<a href="/home">Geri bağlantısı</a>}
    secondaryActions={<button>İşlemler menüsü</button>} primaryAction={<button>Yeni kişi</button>}
    notice="Sayfa bildirimi" navigation="Yerel gezinme" summary="Sayfa özeti"
    aside={{ label: "Departmanlar", content: "Kapsam ağacı" }} filters="Arama filtreleri"
    footer="Sayfalama alanı" overlays="Ayrıntı paneli">Sonuç tablosu</PageTemplate>);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toMatch(/<main\b/);
  const slots = ["Geri bağlantısı", "Kişiler", "Proje kapsamı", "İşlemler menüsü", "Yeni kişi", "Sayfa bildirimi", "Yerel gezinme", "Sayfa özeti", "Kapsam ağacı", "Arama filtreleri", "Sonuç tablosu", "Sayfalama alanı", "Ayrıntı paneli"];
  slots.slice(1).forEach((slot, index) => expect(html.indexOf(slot)).toBeGreaterThan(html.indexOf(slots[index])));
  expect(html).toContain("space-y-6");
  expect(html).not.toContain("max-w-[800px]");
  expect(renderToStaticMarkup(<PageTemplate title="Ayarlar" width="form">Form</PageTemplate>)).toContain("max-w-[800px]");
});
