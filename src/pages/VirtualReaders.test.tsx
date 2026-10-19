import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import VirtualReaders from "./VirtualReaders";

describe("Sanal okuyucular durum ekranı", () => {
  it("explains mobile QR entry and offers devices as a secondary destination", () => {
    const html = renderToStaticMarkup(<MemoryRouter><VirtualReaders /></MemoryRouter>);
    expect(html).toContain("Çalışanlar şimdilik mobil uygulamadaki QR tarama ile giriş yapabilir.");
    expect(html).toMatch(/<a[^>]*href="\/devices"[^>]*>Cihazlara git<\/a>/);
    expect(html).toContain("border border-line bg-surface hover:bg-accent");
    expect(html).not.toContain("bg-primary");
  });
  it("keeps the static compact card independent of project scope", () => {
    const html = renderToStaticMarkup(<MemoryRouter><VirtualReaders /></MemoryRouter>);
    expect(html).toContain("Yakında");
    expect(html).toContain("max-w-xl");
    expect(html).toContain("py-6");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("Proje seçilmedi");
    expect(html).toContain("Telefonla QR okutulan giriş noktaları");
  });
});
