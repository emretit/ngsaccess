/**
 * Panel/cihaz sync hatalarının (IDE Smart + Hikvision) ham mesajını kullanıcıya
 * anlaşılır Türkçe açıklamaya çevirir. Eşleşme yoksa ham mesaj korunur (bilgi kaybı yok).
 *
 * Ham mesajlar genelde paneldekinden gelir (ör. "already exists",
 * "forbidden: create_data user requires level 1, you are 0"). UI bunları doğrudan
 * göstermek yerine bu eşlemeyle açıklar; teknik detay tooltip'te tutulabilir.
 */

interface ErrorRule {
  /** Ham mesajda aranan desen (case-insensitive). */
  match: RegExp;
  /** Kullanıcıya gösterilecek açıklama. */
  message: string;
}

// Sıra önemli: ilk eşleşen kazanır (özelden genele).
const RULES: ErrorRule[] = [
  {
    match: /already exists/i,
    message: "Cihaz güncel — bu kayıt panelde zaten mevcut.",
  },
  {
    match: /requires level 1|you are 0|level 1, you are/i,
    message: "Panel yetki seviyesi yetersiz — panele giriş (token) gerekiyor. Eski token'sız komut.",
  },
  {
    match: /token expired|token.*expire/i,
    message: "Panel oturumu (token) doldu — yeniden denenecek.",
  },
  {
    match: /not bound/i,
    message: "Oturum token'ı bu panele ait değil.",
  },
  {
    match: /tamper/i,
    message: "Panel kurcalama (tamper) koruması aktif — komut reddedildi.",
  },
  {
    match: /ack timeout|timed? ?out|timeout/i,
    message: "Panel zamanında yanıt vermedi (bağlantı/zaman aşımı) — yeniden denenecek.",
  },
  {
    match: /not permitted|not allowed/i,
    message: "Kullanıcının bu kapıya yetkisi yok.",
  },
  {
    match: /not found|does not exist/i,
    message: "Kayıt panelde bulunamadı.",
  },
  {
    match: /invalid|validation/i,
    message: "Geçersiz veri — panel kaydı doğrulayamadı.",
  },
  {
    match: /offline|unreachable|connection|connect/i,
    message: "Panele ulaşılamadı (çevrimdışı/bağlantı yok).",
  },
];

// Benign sınıflandırma backend ile ORTAK (tek doğruluk kaynağı): convex/lib/syncErrors.ts.
// Hem bu frontend modülü hem convex/syncStatus query'si aynı predicate'i kullanır.
export { isBenignSyncError } from "../../convex/lib/syncErrors";

/** Ham sync hatasını anlaşılır mesaja çevirir. Boşsa genel mesaj, eşleşme yoksa ham metin. */
export function friendlySyncError(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "Bilinmeyen senkronizasyon hatası.";
  for (const rule of RULES) {
    if (rule.match.test(raw)) return rule.message;
  }
  return raw;
}
