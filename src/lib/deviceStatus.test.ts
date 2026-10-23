import { describe, expect, it } from "vitest";

import { commandResultMessage } from "./deviceStatus";

describe("dürüst komut ve özellik sonucu", () => {
  it("kuyruk kabulünü tamamlandı veya kapı açıldı olarak sunmaz", () => {
    expect(commandResultMessage({ ok: true, queued: true })).toContain("Sıraya alındı");
    expect(commandResultMessage({ ok: true, queued: true })).toContain("henüz alınmadı");
    expect(commandResultMessage({ ok: false, error: "Bağlantı yok" })).toBe("Bağlantı yok");
  });
});
