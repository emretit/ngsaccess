import { describe, expect, it } from "vitest";
import { BIOMETRIC_NOTICE_TEMPLATE } from "./consentNotice";

describe("aydınlatma şablonu", () => {
  it("erişim amacı, alternatif, haklar ve danışman incelemesi içerir", () => {
    for (const text of ["yalnız fiziksel erişim kontrolü", "Mesai ve puantaj takibinde kullanılmaz", "yasal danışmanınıza doğrulatın", "Veri sorumlusu", "Hukuki sebep", "Aktarım", "Saklama ve imha", "Haklarınız", "Kart / PIN", "geri alabilirsiniz"]) expect(BIOMETRIC_NOTICE_TEMPLATE).toContain(text);
    expect(BIOMETRIC_NOTICE_TEMPLATE).not.toContain("KVKK'ya uygundur");
  });
  it("kuruma özel alanları ve rızadan ayrı metin olduğunu belirtir", () => {
    expect(BIOMETRIC_NOTICE_TEMPLATE).toContain("[Kurum unvanı");
    expect(BIOMETRIC_NOTICE_TEMPLATE).toContain("Rıza kaydı bu aydınlatmadan ayrı alınır");
    expect(BIOMETRIC_NOTICE_TEMPLATE).toContain("kapatmak mevcut verileri kendiliğinden silmez");
  });
});
