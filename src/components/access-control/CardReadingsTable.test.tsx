import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CardReadingsTable } from "./CardReadingsTable";

describe("Okuma tablosu durumları", () => {
  it.each([false, true])("boş ve yükleme durumunda yedi başlığı korur (%s)", loading => {
    const html = renderToStaticMarkup(<CardReadingsTable readings={[]} loading={loading} onOpen={vi.fn()} />);
    expect(html).toContain("<thead");
    expect(html.match(/<th /g)).toHaveLength(7);
    expect(html).toContain('colSpan="7"');
    expect(html).toMatch(loading ? /<tbody.*aria-busy="true"/s : /<tbody.*Okuma bulunamadı/s);
  });
  it("eski kayıtlarda arama aksiyonunu gövdede tutar", () => {
    const html = renderToStaticMarkup(<CardReadingsTable readings={[]} onOpen={vi.fn()} emptyAction={{ label: "Daha eski kayıtlarda ara", onClick: vi.fn() }} />);
    expect(html).toMatch(/<tbody.*Daha eski kayıtlarda ara/s);
  });
  it("geçersiz tarih mesajını tablo gövdesinde gösterir", () => {
    const html = renderToStaticMarkup(<CardReadingsTable readings={[]} onOpen={vi.fn()} message={<p role="alert">Bitiş tarihi başlangıçtan önce olamaz.</p>} />);
    expect(html).toContain("<thead");
    expect(html).toMatch(/<tbody.*Bitiş tarihi başlangıçtan önce olamaz/s);
  });
});
