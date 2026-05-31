/**
 * Sync hatalarının ortak (saf) sınıflandırması — hem Convex backend (syncStatus query)
 * hem frontend (src/lib/syncErrorMessages.ts) tek bu kaynağı kullanır.
 *
 * Convex `src/`'ten import EDEMEZ; frontend `convex/`'ten saf fonksiyon import edebilir.
 * O yüzden paylaşılan predicate burada (convex/lib) durur. `"convex/server"` / `_generated`
 * bağımlılığı YOK → React tarafında güvenle import edilir.
 */

/**
 * "Sorun" sayılmayan durumlar: kayıt panelde zaten var ("already exists") → cihaz güncel,
 * problem listesine/sayısına dahil edilmez.
 */
export function isBenignSyncError(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /already exists/i.test(raw);
}
