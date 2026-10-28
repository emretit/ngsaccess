# FAZ 2-B — Hik kuyruğu adil retry (C-08) + geçmiş olay taraması devamı (C-07)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Rapor: `/tmp/fix-f2-b-hik-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (C-07, C-08) + `M2-cihaz.md`.

## Ownership
`convex/hikvisionSync.ts` (yalnız retry aday seçimi, manuel retry ve stale temizlik uçları), `convex/actions/hikQueueWorker.ts`, `convex/lib/gatewayBackfill.ts`,
`convex/actions/hikQueueWorker.test.ts`, `convex/lib/gatewayBackfill.roster.test.ts` (gerekirse), yeni `convex/fixF2Hik.test.ts`.
DOKUNMA: `convex/schema.ts` (`hikPendingOperations.by_status_nextRetry` index'i ZATEN VAR), `convex/lib/processCardReadingCore.ts`, `convex/cardReadings.ts`.

## Değişiklikler
1. **C-08** — `listRetryCandidates` (~797): "en yeni limit*3 kaydı al, sonra filtrele" yerine `by_status_nextRetry` index'iyle `nextRetryAt <= şimdi` olan **en eski vadesi gelmiş**
   işleri sırayla al (sayfalı, sınırlı); denemesi bitmiş/terminal işler aday kümesini tıkamasın. Çevrimdışı cihazın işi sonraki pencereye ertelensin (`nextRetryAt` ileri),
   başkalarını engellemesin. Manuel "yeniden dene" seçili işi doğrudan çalıştırsın (genel taramaya düşmesin). Erişim silme işleri (revoke) önceliği korunur ve hiçbir zaman sessizce
   silinmez (mevcut davranış).
2. **C-07** — `gatewayBackfill.ts` (~75-89, ~192): 50 sayfa × 30 olay sınırına ulaşılırsa `hikLastBackfillAt`'i şimdiye ilerletme; son işlenen olayın zamanını kaydet ve aynı
   cihaz için devam işini `scheduler.runAfter` ile planla (bir çalıştırmada üst sınır kalsın). Sonuç kısmi ise `ok: false/partial` ve görünür uyarı.

## Kabul
- Testler: önde 60+ terminal/çevrimdışı iş varken vadesi gelmiş eski silme işi seçilir; manuel retry yalnız seçili işi çalıştırır; backfill sınırda zamanı ilerletmez ve devam planlar,
  sınır altında eski davranış aynı.
- `convex/actions/hikQueueWorker.test.ts`, `convex/hikRevocation.test.ts`, `convex/hikvisionSync.test.ts`, `convex/hikIsupStatus.test.ts`, gatewayBackfill testleri yeşil.
