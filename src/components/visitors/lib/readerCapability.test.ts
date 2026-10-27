import { describe, expect, it } from "vitest";
import { canCaptureVisitorCard } from "./readerCapability";

describe("kart okuyabilen cihazlar", () => {
  it.each(["Yüz Tanıma", "Turnike", "Parmak İzi Okuyucu", undefined])("DS-K1T807 modelini %s tipinden bağımsız kabul eder", deviceType => {
    expect(canCaptureVisitorCard({ brand: "hikvision", hikModel: "DS-K1T807", deviceType })).toBe(true);
  });
  it("kontrolörleri de model kataloğundan çözer", () => {
    expect(canCaptureVisitorCard({ brand: "hikvision", hikModel: "DS-K2804" })).toBe(true);
  });
  it.each(["QR Kod Okuyucu", "Sanal Okuyucu", "virtual-reader"])("%s için model ve marka istisnası tanımaz", deviceType => {
    expect(canCaptureVisitorCard({ brand: "hikvision", hikModel: "DS-K1T807", deviceType })).toBe(false);
    expect(canCaptureVisitorCard({ brand: "ide_smart", deviceType })).toBe(false);
  });
  it("pasif cihazı dışlar, katalog dışı cihazda tip bilgisini kullanır", () => {
    expect(canCaptureVisitorCard({ brand: "hikvision", hikModel: "DS-K1T807", isActive: false })).toBe(false);
    expect(canCaptureVisitorCard({ brand: "hikvision", hikModel: "unknown", deviceType: "Kart Okuyucu" })).toBe(true);
    expect(canCaptureVisitorCard({ brand: "hikvision", deviceType: "Yüz Tanıma" })).toBe(false);
    expect(canCaptureVisitorCard({ brand: "ide_smart" })).toBe(true);
  });
});
