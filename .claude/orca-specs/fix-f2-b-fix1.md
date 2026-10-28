# FAZ 2-B FIX1 — Backfill devam zinciri sınırı (ENGEL) + kalıcı uygunsuz retry kayıtları (DÜZELT)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU. Denetim: `/tmp/fix-f2-b-denetim.md` (ENGEL + DÜZELT + NOT'lar — oku). Rapor: `/tmp/fix-f2-b-fix1-rapor.md`.
## Ownership
`convex/lib/gatewayBackfill.ts`, `convex/hikvisionSync.ts`, `convex/actions/hikQueueWorker.ts`, `convex/fixF2Hik.test.ts`, `convex/lib/gatewayBackfill.roster.test.ts`,
"Olayları tara" butonunun `src` dosyası (yalnız varsayılan pencere göndermek için).
## Değişiklik
1. **ENGEL** — Backfill devam zinciri (`gatewayBackfill.ts` ~99-117): zincir başına toplam hop sınırı (ör. 10) + ilerleme koruması (cursor/son olay zamanı ilerlemiyorsa dur, kısmi + uyarı).
   Manuel "Olayları tara" `startTime` vermiyorsa varsayılan pencere son 24 saat (backend'de zorunlu kıl; UI de göndersin). Kota etkisini rapora yaz.
2. **DÜZELT** — `hikvisionSync.ts` ~818-837 `defer()`: kalıcı uygunsuz kayıtlar (localBridge, silinmiş cihaz, biyometri kapalı) her 3 dk yeniden patch'lenmesin — terminal/uzun erteleme
   (`nextRetryAt` = MAX veya ilgili durum değişince yeniden açılacak şekilde); geçici olanlar (offline) mevcut erteleme. Revoke işleri asla silinmez (koru).
## Kabul
Testler: devam zinciri hop sınırında durur; ilerlemeyen cursor'da durur; startTime'sız manuel tarama son 24 saati tarar; kalıcı uygunsuz kayıt ikinci cron turunda tekrar patch'lenmez.
`convex/actions/hikQueueWorker.test.ts`, `convex/hikRevocation.test.ts`, `convex/fixF2Hik.test.ts` yeşil.
