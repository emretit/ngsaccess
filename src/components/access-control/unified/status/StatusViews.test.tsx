import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GrantRows } from "./StatusViews";

describe("Yetki Durumu tablo durumları", () => {
  it.each([true, false])("keeps headers and matches the selection column when canManage=%s", canManage => {
    const html = renderToStaticMarkup(<GrantRows rows={[]} selected={[]} onToggle={() => undefined} onEmployee={() => undefined} canManage={canManage} emptyTitle="Bu filtrelerde kayıt bulunamadı." />);
    expect(html).toMatch(/<thead>.*Kişi.*Cihaz\/kapı.*Durum.*<\/thead>/s);
    expect(html).toMatch(new RegExp(`<tbody>.*colSpan="${3 + Number(canManage)}".*Bu filtrelerde kayıt bulunamadı.*</tbody>`, "s"));
  });
  it("shows loading in the body of the expanded device table", () => {
    const html = renderToStaticMarkup(<GrantRows rows={[]} selected={[]} onToggle={() => undefined} onEmployee={() => undefined} canManage hideDevice loading />);
    expect(html).toMatch(/<thead>.*Kapı.*<\/thead>/s);
    expect(html).toMatch(/<tbody>.*colSpan="4".*Yükleniyor….*<\/tbody>/s);
    expect(html).not.toContain("Bu filtrelerde kayıt bulunamadı.");
  });
});
