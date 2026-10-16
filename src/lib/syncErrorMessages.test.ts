import { describe, expect, it } from "vitest";
import { friendlySyncError } from "./syncErrorMessages";

describe("senkron hata açıklamaları", () => {
  it("terminal timeout yeniden deneme vaat etmez", () => {
    const message = friendlySyncError("ack timeout", { status: "failed", attempts: 5, maxAttempts: 5, nextRetryAt: 30000 }, 0);
    expect(message).toContain("Tekrar deneme limiti doldu — müdahale gerekli");
    expect(message).not.toContain("yeniden denenecek");
  });
  it("bekleyen işlem için gerçek retry zamanını söyler", () => {
    expect(friendlySyncError("token expired", { status: "pending", attempts: 1, maxAttempts: 5, nextRetryAt: 31000 }, 1000)).toContain("~30 sn sonra tekrar denenecek");
  });
  it("failed ve limiti dolmamış olsa bile otomatik retry vaat etmez", () => {
    expect(friendlySyncError("timeout", { status: "failed", attempts: 1, maxAttempts: 5 }, 0)).toContain("yeniden deneme zamanı bilinmiyor");
  });
  it("bilinmeyen ham hata kullanıcı açıklaması yerine geçmez", () => {
    expect(friendlySyncError("SQL error 123")).toBe("Senkronizasyon işlemi tamamlanamadı.");
  });
  it("already exists güncel olduğunu iddia etmez", () => {
    expect(friendlySyncError("already exists")).not.toContain("Cihaz güncel");
  });
  it("geçmiş retry zamanı onay veya başarı değildir", () => {
    expect(friendlySyncError(null, { status: "pending", attempts: 1, maxAttempts: 5, nextRetryAt: 1 }, 1000)).toContain("cihaz onayı bekleniyor");
  });
});
