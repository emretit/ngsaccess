/**
 * Hikvision ISAPI access-control event kodları.
 * Referans: docs/sdk/appendix-c/c.1-access-control-event-types.md
 */

export const HIK_MAJOR_EVENT_TYPES = {
  DEVICE_ALARM: 1,
  DEVICE_EXCEPTION: 2,
  DEVICE_OPERATION: 3,
  DEVICE_EVENT: 5,
} as const;

/**
 * subEventType (minor) → izin verildi
 */
export const HIK_SUB_EVENT_GRANTED: ReadonlySet<number> = new Set([
  1, // Valid Card Auth Completed
  2, // Card + Password Auth Completed
  38, // Fingerprint Matched (0x26)
  75, // Face Authentication Completed (0x4B)
  76, // Face + Card Match (modele göre)
]);

/**
 * subEventType (minor) → reddedildi
 */
export const HIK_SUB_EVENT_DENIED: ReadonlySet<number> = new Set([
  3, // Card + Password Auth Failed
  5, // Card Auth Timed Out
  6, // No Permission
  7, // Card Invalid Period
  8, // Expired Card
  9, // Card Not Exist
  10, // Anti-passing Back Auth Failed
  39, // Fingerprint Mismatched
  77, // Face Authentication Failed (modele göre)
  80, // Face Recognition Failed
  104, // Face Anti-Spoofing Failed
  113, // Blocklist Event
  148, // Password Auth Failed Times Exceeded
]);

export type AccessDecision = "izin_verildi" | "reddedildi" | undefined;

/**
 * Spesifik ret nedeni — UI'da "Reddedildi (Yetki yok)" gibi gösterilir.
 * Sadece DENIED set'inde yer alan kodlar için doldurulur.
 */
export const HIK_DENIAL_REASONS: Record<number, string> = {
  3: "Şifre hatalı",
  5: "Kart okuma zaman aşımı",
  6: "Yetki yok",
  7: "Geçerlilik dışı (saat/tarih)",
  8: "Süresi dolmuş kart",
  9: "Kart tanımlı değil",
  10: "Anti-passback ihlali",
  39: "Parmak izi eşleşmedi",
  77: "Yüz tanıma başarısız",
  80: "Yüz tanınmadı",
  104: "Yüz canlılık testi başarısız",
  113: "Kara liste",
  148: "Şifre deneme limiti aşıldı",
};

export function inferDenialReason(subEventType: number | undefined): string | undefined {
  if (subEventType === undefined) return undefined;
  return HIK_DENIAL_REASONS[subEventType];
}

/**
 * Major/sub event kodlarından erişim kararı çıkarır.
 * Bilinmeyen kombinasyonlar için undefined döner — caller mevcut mantığa fallback eder.
 */
export function inferAccessStatus(
  majorEventType: number | undefined,
  subEventType: number | undefined,
): AccessDecision {
  if (
    majorEventType !== HIK_MAJOR_EVENT_TYPES.DEVICE_EVENT &&
    majorEventType !== HIK_MAJOR_EVENT_TYPES.DEVICE_ALARM
  ) {
    return undefined;
  }
  if (subEventType === undefined) return undefined;
  if (HIK_SUB_EVENT_GRANTED.has(subEventType)) return "izin_verildi";
  if (HIK_SUB_EVENT_DENIED.has(subEventType)) return "reddedildi";
  return undefined;
}
