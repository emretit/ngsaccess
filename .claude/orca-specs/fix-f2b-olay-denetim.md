# DENETİM — Faz 2 Dalga B-3 (C-05 olay tekilleştirme + Hik cihaz zamanı + köprü spool)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f2b-olay.md`. Worker raporu: `/tmp/fix-f2b-olay-rapor.md`.
Rapor: `/tmp/fix-f2b-olay-denetim.md`. Dosyalar (yalnız `git diff HEAD` / yeni dosya): convex/lib/processCardReadingCore.ts convex/processCardReading.characterization.test.ts convex/fixF2bEvents.test.ts
scripts/lib/ide-mqtt-routing.mjs scripts/lib/ide-mqtt-routing.nodetest.mjs. (Bağlam için oku, denetleme: convex/http.ts, convex/cardReadings.ts backfill tekilleştirmesi, scripts/ide-mqtt-bridge.mjs.)
DİKKAT: aynı ağaçta B-2 (ideSync/ideGatewayDevice/visitors/grantStatus/accessGrantStatus/deviceSyncRuns) worker'ı yazıyor ve B-1 denetimi sürüyor — onları DENETLEME, dokunma.
Özel dikkat: tekilleştirme yön çözümü ve TÜM yan etkilerden (alarm, bildirim, hikLastSerialNo patch, deviceEvents, PDKS tetikleri) ÖNCE mi; aynı mutation içinde mi (Convex OCC ile iki eşzamanlı teslim ikisi de "yok" görüp ikisini de yazabilir mi — aynı index aralığını okuyorsa OCC çakışması korur, okumuyorsa yazmaz);
Hik serial'ı cihaz yeniden başlayınca sıfırlanırsa meşru yeni olay "tekrar" sayılıp YUTULUR mu (seri + zaman penceresiyle sınırlama gerekir mi); IDE anahtarında aynı saniyede iki meşru okuma (aynı kart, aynı io) kaybı kabul edilebilir mi;
Hik cihaz zamanı sınırları (+5 dk / −7 gün) ve TR ofset dönüşümü; geç gelen olayın yön çözümünü bozması (geçmiş zamanlı satır sonrakilerin yönünü değiştirir mi);
spool: sıkıştırma sırasında çökme → veri kaybı/çift gönderim; baş-ofset kalıcılığı; heartbeat doğrudan POST hata yolunda süreç çökmesi; mevcut .corrupt/.rejected karantina ve 408/429 davranışı korunuyor mu.
