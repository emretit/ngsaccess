import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EmployeeBiometricsCell } from "./EmployeeBiometricsCell";

it("kayıtlı biyometriyi tikli, olmayanı soluk gösterir; etiket parmak adlarını içerir", () => {
  const html = renderToStaticMarkup(<EmployeeBiometricsCell biometrics={{ face: false, fingerNos: [2, 7] }} />);
  expect(html).toContain('aria-label="Yüz kaydı yok"');
  expect(html).toContain('aria-label="2 parmak izi kayıtlı: Sağ işaret, Sol işaret"');
  expect(html.match(/lucide-check/g)).toHaveLength(1);
});
