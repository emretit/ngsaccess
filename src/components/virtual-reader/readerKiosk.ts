import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { READER_TOKEN_PATTERN } from "../../../convex/lib/virtualReader";

export type ScanResult = FunctionReturnType<typeof api.virtualReaders.scan>;
export type ReaderInfo = NonNullable<FunctionReturnType<typeof api.virtualReaders.connect>>;

export const READER_TOKEN_STORAGE_KEY = "ngs.virtualReader.token";
export const READER_CAMERA_STORAGE_KEY = "ngs.virtualReader.camera";
/** Aynı kod bu süre içinde ikinci kez gönderilmez (tüketilmiş QR kamerada kalmaya devam eder). */
export const SAME_CODE_COOLDOWN_MS = 10_000;
export const RESULT_VISIBLE_MS = 3_500;
export const SCAN_TIMEOUT_MS = 8_000;

/** `/reader#<token>` — geçerli token URL parçasından alınır; başka biçim yok sayılır. */
export function readerTokenFromHash(hash: string): string | null {
  // UUID kodlanacak karakter içermez; decodeURIComponent bozuk adreste URIError atardı.
  const value = hash.replace(/^#/, "").trim();
  return READER_TOKEN_PATTERN.test(value) ? value : null;
}

export type ScanPresentation = { tone: "success" | "error"; title: string; detail: string };

const DENIAL_TEXT: Record<Extract<ScanResult, { status: "denied" }>["reason"], ScanPresentation> = {
  TOKEN_INVALID: { tone: "error", title: "Kod tanınmadı", detail: "Mobil uygulamadaki QR sekmesindeki kodu gösterin." },
  TOKEN_USED: { tone: "error", title: "Bu kod kullanıldı", detail: "Uygulamada yeni kodun gelmesini bekleyip tekrar okutun." },
  TOKEN_EXPIRED: { tone: "error", title: "Kodun süresi doldu", detail: "Uygulamada yeni kodun gelmesini bekleyip tekrar okutun." },
  SESSION_INVALID: { tone: "error", title: "Oturum geçersiz", detail: "Mobil uygulamada yeniden giriş yapın." },
  NOT_ALLOWED: { tone: "error", title: "Bu okuyucuda kayıt yapılamaz", detail: "Erişiminiz bu projede açık değil. Yöneticinize başvurun." },
  READER_INACTIVE: { tone: "error", title: "Okuyucu pasif", detail: "Yönetici okuyucuyu Cihazlar sayfasından etkinleştirmeli." },
};

const readerTimeFormat = new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: "Europe/Istanbul" });

export function formatReaderTime(iso: string): string {
  return readerTimeFormat.format(new Date(iso));
}

export function scanPresentation(result: ScanResult): ScanPresentation {
  if (result.status === "granted") {
    const label = result.direction === "exit" ? "Çıkış" : "Giriş";
    return { tone: "success", title: result.employeeName, detail: `${label} kaydedildi · ${formatReaderTime(result.accessTime)}` };
  }
  if (result.status === "denied") return DENIAL_TEXT[result.reason];
  return { tone: "error", title: "Okuyucu bağlantısı geçersiz", detail: "Yöneticiden yeni okuyucu bağlantısı isteyin." };
}

/** Kamera saniyede birkaç kez aynı kodu görür: meşgulken ve aynı kod için bekleme süresinde geçirmez. */
export function createScanGate(cooldownMs = SAME_CODE_COOLDOWN_MS) {
  let busy = false;
  let last: { code: string; at: number } | null = null;
  return {
    tryAcquire(code: string, now: number): boolean {
      if (busy || (last && last.code === code && now - last.at < cooldownMs)) return false;
      busy = true;
      last = { code, at: now };
      return true;
    },
    release(now: number) {
      busy = false;
      if (last) last = { ...last, at: now };
    },
  };
}
