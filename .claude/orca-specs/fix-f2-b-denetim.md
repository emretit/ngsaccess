# DENETİM — Faz 2-B (C-08 Hik adil retry, C-07 backfill devamı)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f2-b-hik.md`. Worker raporu: `/tmp/fix-f2-b-hik-rapor.md`.
Rapor: `/tmp/fix-f2-b-denetim.md`. Dosyalar: convex/hikvisionSync.ts convex/actions/hikQueueWorker.ts convex/lib/gatewayBackfill.ts convex/actions/hikQueueWorker.test.ts
convex/lib/gatewayBackfill.roster.test.ts convex/fixF2Hik.test.ts  (yalnız `git diff HEAD`)
Özel dikkat: erişim silme (revoke) işleri hiçbir yolda sessizce düşmüyor/silinmiyor mu; çevrimdışı cihaz ertelemesi sonsuz ertelemeye dönüşüyor mu; cron başına okuma/çağrı sayısı arttı mı (kota);
backfill devam zinciri sonsuz döngü yapabilir mi (üst sınır, aynı pencereyi tekrar okuma); manuel retry yetki kontrolü korunuyor mu.
