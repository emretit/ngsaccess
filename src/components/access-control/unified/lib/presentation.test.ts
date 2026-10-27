import { describe, expect, it } from "vitest";
import {
  ruleDaysSummary,
  ruleTypeMatches,
  runSummary,
  runDisplay,
  targetLabels,
  targetTone,
} from "./presentation";
describe("gönderim kanıtı ve kapsam sunumu", () => {
  it("gönderildi sonucunu cihaz doğrulaması olarak sunmaz", () => {
    expect(targetLabels.sent).toBe("Cihaza gönderildi");
    expect(Object.values(targetLabels).join(" ")).not.toContain("teslim kanıtı");
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
      "1 kuyrukta · 2 kayıt cihaza gönderildi · 3 cihazda doğrulandı · 4 başarısız · 5 atlandı · 6 bilinmiyor",
    );
  });
  it("ziyaretçi şablonunu personelden ayırır; eski türü personel sayar", () => {
    expect(ruleTypeMatches("visitor", "visitor")).toBe(true);
    expect(ruleTypeMatches("visitor", "personnel")).toBe(false);
    expect(ruleTypeMatches(undefined, "personnel")).toBe(true);
    expect(ruleTypeMatches("department", "all")).toBe(true);
  });
});

it("hiç gönderilmeyen kısmi işlemi başarısız gösterir", () => {
  const counts = { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 2, unknown: 0 };
  expect(runDisplay("partial", counts)).toEqual({ label: "Gönderilemedi", tone: "danger" });
  expect(runDisplay("partial", { ...counts, sent: 1 })).toEqual({ label: "Kısmi sonuç", tone: "warning" });
  expect(runDisplay("partial", { ...counts, verified: 1 }).label).toBe("Kısmi sonuç");
  expect(runDisplay("running", counts).label).toBe("İşleniyor");
});

it("gün özetinde ardışık aralığı kısaltır ve aralıklı günleri korur", () => {
  expect(ruleDaysSummary(["Friday", "Monday", "Tuesday", "Wednesday", "Thursday"])).toBe("Pzt–Cum");
  expect(ruleDaysSummary(["Friday", "Monday"])).toBe("Pzt, Cum");
  expect(ruleDaysSummary(["Monday"])).toBe("Pzt");
  expect(ruleDaysSummary([])).toBe("Gün seçilmedi");
});
