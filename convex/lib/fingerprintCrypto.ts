import { ConvexError } from "convex/values";

const keyError = () => new ConvexError("Parmak izi saklama anahtarı tanımlı değil");
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
function encode(value: ArrayBuffer | Uint8Array): string {
  return btoa(Array.from((ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value)), byte => String.fromCharCode(byte)).join(""));
}

/** Called by actions before capture; no key material escapes this module. */
export async function assertTemplateKey(): Promise<CryptoKey> {
  try {
    const raw = process.env.FINGERPRINT_TEMPLATE_KEY;
    if (!raw || !/^[A-Za-z0-9+/]{43}=?$/.test(raw)) throw keyError();
    const bytes = decode(raw);
    if (bytes.byteLength !== 32) throw keyError();
    return await globalThis.crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch { throw keyError(); }
}

export async function encryptTemplate(plain: string, aad: string) {
  const key = await assertTemplateKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, key, new TextEncoder().encode(plain));
  return { encData: encode(encrypted), iv: encode(iv), keyVersion: "v1" as const };
}

export async function decryptTemplate(template: { encData: string; iv: string; keyVersion: string }, aad: string): Promise<string> {
  const key = await assertTemplateKey();
  try {
    if (template.keyVersion !== "v1") throw new Error();
    const iv = decode(template.iv);
    if (iv.byteLength !== 12) throw new Error();
    const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, key, decode(template.encData));
    return new TextDecoder().decode(plain);
  } catch { throw new ConvexError("Parmak izi şablonu çözülemedi"); }
}
