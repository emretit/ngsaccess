import { afterEach, describe, expect, it, vi } from "vitest";
import { assertTemplateKey, decryptTemplate, encryptTemplate } from "./fingerprintCrypto";

afterEach(() => vi.unstubAllEnvs());
const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(23)));
describe("fingerprint AES-256-GCM", () => {
  it("roundtrips with random 12-byte IVs and authenticated employee/slot", async () => {
    vi.stubEnv("FINGERPRINT_TEMPLATE_KEY", key);
    const template = await encryptTemplate("private-template", "employee:2");
    expect(await decryptTemplate(template, "employee:2")).toBe("private-template");
    expect(template.encData).not.toContain("private-template");
    expect(atob(template.iv)).toHaveLength(12);
    expect((await encryptTemplate("private-template", "employee:2")).iv).not.toBe(template.iv);
    await expect(decryptTemplate(template, "other:2")).rejects.toThrow("çözülemedi");
    await expect(decryptTemplate(template, "employee:3")).rejects.toThrow("çözülemedi");
    await expect(decryptTemplate({ ...template, keyVersion: "v2" }, "employee:2")).rejects.toThrow("çözülemedi");
  });
  it.each([undefined, "", "invalid", btoa("short"), btoa("x".repeat(33))])("fails closed for invalid key %s", async value => {
    vi.stubEnv("FINGERPRINT_TEMPLATE_KEY", value);
    await expect(assertTemplateKey()).rejects.toThrow("Parmak izi saklama anahtarı tanımlı değil");
    await expect(encryptTemplate("private-template", "employee:2")).rejects.toThrow("Parmak izi saklama anahtarı tanımlı değil");
  });
});

it("encodes only the bytes of an offset IV view", async () => {
  vi.stubEnv("FINGERPRINT_TEMPLATE_KEY", key);
  const iv = new Uint8Array(16).fill(7).subarray(2, 14);
  const random = vi.spyOn(globalThis.crypto, "getRandomValues").mockReturnValue(iv);
  try {
    const encrypted = await encryptTemplate("private", "employee:2");
    expect(atob(encrypted.iv)).toHaveLength(12);
    expect(await decryptTemplate(encrypted, "employee:2")).toBe("private");
  } finally { random.mockRestore(); }
});
