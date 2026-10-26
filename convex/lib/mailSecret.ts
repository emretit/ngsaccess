import { ConvexError } from "convex/values";

// Proje SMTP şifresi DB'de AES-GCM ile saklanır (MAIL_SECRET_KEY = base64 32 bayt).
// Yalnız action'lardan çağrılır: mutation'larda rastgelelik deterministik olduğundan IV tekrar edebilir.
const keyError = () => new ConvexError("E-posta şifreleme anahtarı (MAIL_SECRET_KEY) tanımlı değil");

function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
function encode(value: ArrayBuffer | Uint8Array): string {
  return btoa(Array.from(new Uint8Array(value), byte => String.fromCharCode(byte)).join(""));
}

async function mailKey(): Promise<CryptoKey> {
  try {
    const raw = process.env.MAIL_SECRET_KEY;
    if (!raw || !/^[A-Za-z0-9+/]{43}=?$/.test(raw)) throw keyError();
    const bytes = decode(raw);
    if (bytes.byteLength !== 32) throw keyError();
    return await globalThis.crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch { throw keyError(); }
}

/** Şifreli metni projeye bağlar: başka projenin satırına kopyalanan değer çözülmez. */
export function mailSecretAad(projectId: string): string {
  return `mailSettings:${projectId}`;
}

/** Biçim: `v1.<iv>.<ciphertext>` (base64). */
export async function encryptMailSecret(plain: string, aad: string): Promise<string> {
  const key = await mailKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, key, new TextEncoder().encode(plain));
  return `v1.${encode(iv)}.${encode(encrypted)}`;
}

export async function decryptMailSecret(stored: string, aad: string): Promise<string> {
  const key = await mailKey();
  try {
    const [version, iv, data] = stored.split(".");
    if (version !== "v1" || !iv || !data) throw new Error();
    const ivBytes = decode(iv);
    if (ivBytes.byteLength !== 12) throw new Error();
    const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes, additionalData: new TextEncoder().encode(aad) }, key, decode(data));
    return new TextDecoder().decode(plain);
  } catch { throw new ConvexError("Kayıtlı SMTP şifresi çözülemedi; şifreyi yeniden girip kaydedin."); }
}
