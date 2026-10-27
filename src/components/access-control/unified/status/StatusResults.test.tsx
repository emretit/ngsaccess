import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StatusViewToggle, StatusResults } from "./StatusResults";

vi.mock("./StatusViews", () => ({
  DeviceCounters: () => null,
  GrantRows: () => null,
}));

function render(cursor: string | null, busy = false) {
  return renderToStaticMarkup(
    <StatusResults
      view="person"
      rows={[]}
      selected={[]}
      toggle={() => {}}
      setEmployee={() => {}}
      cursor={cursor}
      busy={busy}
      more={async () => {}}
      options={{ departments: [], devices: [], rules: [], templates: [] }}
      filters={{}}
      expanded={undefined}
      setExpanded={() => {}}
      deviceCounts={{}}
    />,
  );
}

describe("StatusResults boş sonuç", () => {
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
    expect(html).not.toContain('role="status"');
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
