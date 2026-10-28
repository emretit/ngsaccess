import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GrantRow } from "./model";
import { StatusViewToggle, StatusResults } from "./StatusResults";

vi.mock("./StatusViews", async importOriginal => {
  const actual = await importOriginal<typeof import("./StatusViews")>();
  return {
    ...actual,
    DeviceCounters: () => null,
    GrantRows: (props: ComponentProps<typeof actual.GrantRows>) => props.rows.length === 0 ? <actual.GrantRows {...props} /> : null,
  };
});

function render(cursor: string | null, busy = false, rows: GrantRow[] = []) {
  return renderToStaticMarkup(
    <StatusResults
      view="person"
      rows={rows}
      selected={[]}
      toggle={() => {}}
      setEmployee={() => {}}
      cursor={cursor}
      busy={busy}
      more={async () => {}}
      options={{ departments: [], devices: [], rules: [] }}
      filters={{}}
      expanded={undefined}
      setExpanded={() => {}}
      deviceCounts={{}}
    />,
  );
}

describe("StatusResults boş sonuç", () => {
  it("filtre sonucu sayısını güncel kayıtlarla gösterir ve devam sayfasını açıklar", () => {
    // GrantRows is mocked: these rows only supply result cardinality here.
    const rows = [{}, {}] as GrantRow[];
    expect(render(null, false, rows)).toContain("Filtre sonucu: 2 kayıt");
    expect(render(null, false, rows.slice(0, 1))).toContain("Filtre sonucu: 1 kayıt");
    expect(render(null)).toContain("Filtre sonucu: 0 kayıt");
    expect(render("next-page", false, rows)).toContain("Filtre sonucu: 2 kayıt (yüklenenler; daha fazla kayıt olabilir)");
  });
  it("devam sayfası varken yalnız yüklenen kayıtlar için boş durum bildirir", () => {
    const html = render("next-page");
    expect(html).toContain('role="status"');
    expect(html).toContain("Yüklenen kayıtlarda bu filtrelerde eşleşme bulunamadı.");
    expect(html).toContain("Daha fazla yükle");
    expect(html).not.toContain("Bu filtrelerde kayıt bulunamadı.");
  });

  it("tarama tamamlandığında mevcut boş sonuç metnini korur", () => {
    const html = render(null);
    expect(html).toContain("Bu filtrelerde kayıt bulunamadı.");
    expect(html).not.toContain("Daha fazla yükle");
  });

  it("yükleme sırasında boş sonuç duyurmaz ve devam düğmesini devre dışı tutar", () => {
    const html = render("next-page", true);
    expect(html).toMatch(/<tbody>.*Yükleniyor….*<\/tbody>/s);
    expect(html).not.toContain("Bu filtrelerde kayıt bulunamadı.");
    expect(html).toContain('disabled=""');
    expect(html).toContain("Daha fazla yükle");
  });
});


describe("StatusViewToggle", () => {
  it("exposes the selected view as a pressed button in a group", () => {
    const html = renderToStaticMarkup(<StatusViewToggle view="device" setView={() => {}} />);
    expect(html).toContain('role="group" aria-label="Görünüm"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>Kişi/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Cihaz/);
  });
});
