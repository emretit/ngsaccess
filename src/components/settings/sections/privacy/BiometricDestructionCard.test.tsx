import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { dialogExcerpt, destructionStatusLabel, DESTRUCTION_WARNING, DestructionConfirmationFields } from "./BiometricDestructionCard";

const preview = { projectlessTemplateCount: 0, projectName: "Merkez", faceCount: 3, fingerprintCount: 2, employeeCount: 2, storageFileCount: 3, capped: false, biometricEnabled: false };
function render(overrides: Partial<Parameters<typeof DestructionConfirmationFields>[0]> = {}) {
  return renderToStaticMarkup(<DestructionConfirmationFields preview={preview} kinds={["face", "fingerprint"]} reason="Saklama amacı sona erdi" confirmText="Merkez" busy={false} moduleEnabled={false} onReason={vi.fn()} onConfirmText={vi.fn()} onContinue={vi.fn()} {...overrides} />);
}
function disabled(markup: string) { return /<button[^>]*disabled=""[^>]*>İmha işlemini onayla<\/button>/.test(markup); }
describe("biyometrik imha onayı", () => {
  it("sayım görülmeden imhaya izin vermez", () => { expect(disabled(render({ preview: null }))).toBe(true); });
  it("yanlış ya da kısmi proje adında düğme pasiftir", () => {
    for (const confirmText of ["", "Mer", "merkez", "Merkez "]) expect(disabled(render({ confirmText }))).toBe(true);
  });
  it("geçerli sayım, gerekçe ve tam proje adıyla onaya izin verir", () => { expect(disabled(render())).toBe(false); });
  it("modül açıkken, işlem sürerken, tür yokken ya da boş sonuçta pasiftir", () => {
    expect(disabled(render({ moduleEnabled: true }))).toBe(true);
    expect(disabled(render({ busy: true }))).toBe(true);
    expect(disabled(render({ kinds: [] }))).toBe(true);
    expect(disabled(render({ preview: { ...preview, faceCount: 0, fingerprintCount: 0 } }))).toBe(true);
    expect(disabled(render({ reason: "  " }))).toBe(true);
  });
  it("sınırlı sayım sıfır olsa da taranmayan eski şablonlar için imhaya izin verir", () => {
    expect(disabled(render({ preview: { ...preview, faceCount: 0, fingerprintCount: 0, capped: true } }))).toBe(false);
  });
  it("eşleşmeyen ad için erişilebilir hata ve kalıcı silme etkisini açıklar", () => {
    expect(render({ confirmText: "Yanlış" })).toContain('aria-invalid="true"');
    expect(render({ confirmText: "Yanlış" })).toContain("Proje adı tam olarak eşleşmelidir.");
    expect(DESTRUCTION_WARNING).toContain("Çalışan, kart ve okuma geçmişi silinmez");
  });
});

it("cihaz işlemi yoksa yalnız Convex silmesini bildirir", () => {
  const run = { status: "completed", deviceOperations: 0, deviceFailures: 0, deviceUnconfirmed: 0 };
  expect(destructionStatusLabel(run)).toBe("Convex'ten silindi; cihazlardaki şablonlar ayrıca silinmeli");
  expect(destructionStatusLabel({ ...run, deviceOperations: 1, deviceUnconfirmed: 1 })).toBe("Cihaz sonucu eksik");
});
it("onay diyaloğunda uzun boşluksuz metni kısaltır ve kırılabilir yapar", () => {
  const text = dialogExcerpt("a".repeat(500));
  expect(text).toContain("\u200b");
  expect(text).toContain("…");
  expect(text.split("\u200b").join("").length).toBe(161);
});
