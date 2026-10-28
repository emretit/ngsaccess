import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PDKSTableView } from "./PDKSTableView";

it.each([false, true])("keeps daily PDKS headers with no records (loading=%s)", loading => {
  const html = renderToStaticMarkup(<PDKSTableView records={[]} loading={loading} />);
  for (const label of ["Çalışan", "Departman", "İlk giriş", "Son çıkış", "Toplam süre", "Fazla mesai", "Durum / izin türü", "İşlemler"]) expect(html).toContain(label);
  expect(html).toMatch(/<tbody><tr[^>]*><td[^>]*colSpan="9"/);
  expect(html).toContain(loading ? "PDKS kayıtları yükleniyor." : "Bu projede personel bulunamadı.");
});
