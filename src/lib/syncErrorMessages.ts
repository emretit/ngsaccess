/**
 * Panel/cihaz sync hatalarının (IDE Smart + Hikvision) ham mesajını kullanıcıya
 * anlaşılır Türkçe açıklamaya çevirir. Ham mesaj arayüzde ikincil teknik ayrıntı olarak gösterilir.
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
    message: "Kayıt panelde zaten mevcut; işlemin uygulandığı doğrulanmadı.",
  },
  {
    match: /requires level 1|you are 0|level 1, you are/i,
    message: "Panel yetki seviyesi yetersiz — panele giriş (token) gerekiyor. Eski token'sız komut.",
  },
  {
    match: /token expired|token.*expire/i,
    message: "Panel oturumu (token) doldu.",
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
    message: "Panel zamanında yanıt vermedi (bağlantı/zaman aşımı).",
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

export interface SyncRetryState {
  status: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: number;
}

/** Yeniden deneme vaadi yalnız kuyruk durumu ve zamanıyla doğrulanır. */
export function friendlySyncError(
  raw: string | null | undefined,
  operation?: SyncRetryState,
  now = Date.now(),
): string {
  const description = RULES.find((rule) => raw && rule.match.test(raw))?.message
    ?? "Senkronizasyon işlemi tamamlanamadı.";
  if (!operation) return description;
  let retry = "";
  if (operation.status === "failed" && operation.attempts >= operation.maxAttempts) {
    retry = "Tekrar deneme limiti doldu — müdahale gerekli.";
  } else if (operation.status === "failed") {
    retry = "İşlem başarısız — otomatik yeniden deneme zamanı bilinmiyor.";
  } else if (operation.status === "pending") {
    retry = operation.nextRetryAt !== undefined && operation.nextRetryAt > now
      ? `~${Math.ceil((operation.nextRetryAt - now) / 1000)} sn sonra tekrar denenecek.`
      : "Yeniden deneme kuyruğunda; cihaz onayı bekleniyor.";
  } else if (operation.status === "sent" || operation.status === "processing") {
    retry = "Cihaz yanıtı bekleniyor.";
  }
  return [description, retry].filter(Boolean).join(" ");
}
