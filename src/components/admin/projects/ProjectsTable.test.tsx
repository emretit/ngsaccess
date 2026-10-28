import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectsTable } from "./ProjectsTable";

describe("Projeler tablo durumları", () => {
  it.each([true, false])("keeps five headers and one body cell while loading=%s", loading => {
    const html = renderToStaticMarkup(<ProjectsTable projects={[]} loading={loading} emptyState={<p>Henüz proje yok</p>} onEdit={() => undefined} onDelete={() => undefined} />);
    expect(html).toMatch(/<thead.*Ad.*Durum.*Üyeler.*Oluşturulma.*İşlemler.*<\/thead>/s);
    expect(html).toMatch(/<tbody.*colSpan="5".*<\/tbody>/s);
    expect(html).toContain(loading ? "Projeler yükleniyor" : "Henüz proje yok");
  });
});
