import { describe, expect, it } from "vitest";
import { createScanGate, readerTokenFromHash, scanPresentation } from "./readerKiosk";
import { virtualReaderUrl } from "@/components/devices/VirtualReaderDialog";

const token = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("sanal okuyucu ekranı", () => {
  it("okuyucu anahtarını yalnız geçerli URL parçasından alır", () => {
    expect(readerTokenFromHash(`#${token}`)).toBe(token);
    expect(readerTokenFromHash("")).toBeNull();
    expect(readerTokenFromHash("#abc")).toBeNull();
    expect(virtualReaderUrl(token, "https://ngsplus.app")).toBe(`https://ngsplus.app/reader#${token}`);
  });

  it("sonucu kapıdaki kişiye okunur Türkçe metne çevirir", () => {
    expect(scanPresentation({ status: "granted", employeeName: "Ada Test", direction: "exit", accessTime: "2026-10-23T06:05:00.000Z" }))
      .toEqual({ tone: "success", title: "Ada Test", detail: "Çıkış kaydedildi · 09:05" });
    expect(scanPresentation({ status: "denied", reason: "TOKEN_USED" })).toMatchObject({ tone: "error", title: "Bu kod kullanıldı" });
    expect(scanPresentation({ status: "reader_invalid" })).toMatchObject({ tone: "error", title: "Okuyucu bağlantısı geçersiz" });
  });

  it("meşgulken ve aynı kodu bekleme süresi içinde ikinci kez göndermez", () => {
    const gate = createScanGate(10_000);
    expect(gate.tryAcquire("A", 0)).toBe(true);
    expect(gate.tryAcquire("B", 100)).toBe(false);
    gate.release(3_000);
    expect(gate.tryAcquire("A", 9_000)).toBe(false);
    expect(gate.tryAcquire("B", 9_000)).toBe(true);
    gate.release(9_500);
    expect(gate.tryAcquire("A", 9_600)).toBe(true);
  });

  it.each(["TOKEN_INVALID", "READER_INACTIVE", "PIN_LOCKED", "NOT_ALLOWED", "NOT_ACTIVE", "NOT_STARTED", "EXPIRED", "REVOKED", "EXHAUSTED"] as const)("ziyaretçi reddini Türkçe açıklar: %s", reason => {
    const presentation = scanPresentation({ status: "denied", reason });
    expect(presentation.tone).toBe("error");
    expect(presentation.title).toBeTruthy();
    expect(presentation.detail).toBeTruthy();
    expect(presentation.title).not.toContain(reason);
  });

  it("kapı açma başarısızsa ziyaretçi adıyla resepsiyona yönlendirir", () => {
    const result = { status: "granted" as const, employeeName: "Ziyaretçi Ada", direction: "entry" as const, accessTime: "2026-11-25T06:05:00Z", doorOpen: "failed" as const };
    expect(scanPresentation(result)).toEqual({ tone: "error", title: "Ziyaretçi Ada", detail: "Kapı açılamadı — resepsiyona başvurun" });
  });
});
