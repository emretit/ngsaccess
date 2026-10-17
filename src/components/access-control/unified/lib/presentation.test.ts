import { describe, expect, it } from "vitest";
import {
  ruleTypeMatches,
  runSummary,
  targetLabels,
  targetTone,
} from "./presentation";
describe("gönderim kanıtı ve kapsam sunumu", () => {
  it("gönderildi sonucunu cihaz doğrulaması olarak sunmaz", () => {
    expect(targetLabels.sent).toContain("teslim kanıtı yok");
    expect(targetTone("sent")).not.toBe("success");
    expect(targetTone("verified")).toBe("success");
    expect(
      runSummary({
        queued: 1,
        sent: 2,
        verified: 3,
        failed: 4,
        skipped: 5,
        unknown: 6,
      }),
    ).toBe(
      "1 kuyrukta · 2 gönderildi (teslim kanıtı yok) · 3 cihazda doğrulandı · 4 başarısız · 5 atlandı · 6 bilinmiyor",
    );
  });
  it("ziyaretçi şablonunu personelden ayırır; eski türü personel sayar", () => {
    expect(ruleTypeMatches("visitor", "visitor")).toBe(true);
    expect(ruleTypeMatches("visitor", "personnel")).toBe(false);
    expect(ruleTypeMatches(undefined, "personnel")).toBe(true);
    expect(ruleTypeMatches("department", "all")).toBe(true);
  });
});
