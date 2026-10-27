import { expect, it } from "vitest";
import { pastAttemptText } from "./pastAttempt";

const at = Date.parse("2026-10-22T10:09:00Z");

it("eski çevrimdışı gerekçesini tarihli ve geçmiş zamanla yazar", () => {
  expect(pastAttemptText(at, "Cihaz çevrimdışı")).toBe("Son deneme 22.10.2026 13:09 · cihaz o sırada çevrimdışıydı");
});
it("bilinmeyen gerekçeyi aynen, ISO zamanı da kabul eder", () => {
  expect(pastAttemptText("2026-10-22T10:09:00Z", "Kapı eşleşmedi")).toBe("Son deneme 22.10.2026 13:09 · Kapı eşleşmedi");
});
it("zaman yoksa güncelmiş gibi yazmaz", () => {
  expect(pastAttemptText(undefined, "Cihaz çevrimdışı")).toBe("Son denemede: cihaz o sırada çevrimdışıydı");
  expect(pastAttemptText(0, "")).toBe("Son deneme başarısız");
  expect(pastAttemptText(at)).toBe("Son deneme 22.10.2026 13:09");
});
