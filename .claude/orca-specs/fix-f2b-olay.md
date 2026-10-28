# FAZ 2 DALGA B-3 — Kart olayı tekilleştirme (C-05) + Hik canlı olayda cihaz zamanı + köprü spool verimi

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK listesi dahil: git add/commit/stash/checkout YOK). Rapor: `/tmp/fix-f2b-olay-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` C-05 · `M2-cihaz.md` C-05 + §5 "A teyit 10" · `/tmp/fix-f2-a-denetim.md` NOT 4 + NOT 5.
Bağlam: 7ea7faf8 ile IDE köprüsü en-az-bir-kez teslim yapıyor (spool + tekrar). Sunucu tekilleştirmesi olmadan aynı geçiş accessLogs/PDKS'e iki kez yazılır ve yön (giriş/çıkış) son satıra göre çevrildiği için sahte çıkış oluşur. Köprü bu iş bitmeden sunucuya kurulmayacak.

## Hedef (test edilebilir)
Aynı Hik olayı (aynı cihaz + `hikSerialNo`) ya da aynı IDE olayı (aynı cihaz + io + panel olay zamanı + kart) ikinci kez gelince yeni `cardReadings` satırı, yön değişimi ve yan etki (alarm/bildirim/son seri güncelleme) OLUŞMAZ; Hik canlı satırının `accessTime`'ı cihaz olay zamanıdır.

## Ownership
`convex/lib/processCardReadingCore.ts`, `convex/lib/cardReadingProcess.ts`, `convex/http.ts` (yalnız `/card-reader`, Hik olay ve `/ide-bridge/event` rotaları), `scripts/lib/ide-mqtt-routing.mjs`, `scripts/ide-mqtt-bridge.mjs`,
bunların testleri (`*.test.ts`, `*.nodetest.mjs` / `scripts/**/*.test.mjs` — mevcut desen) + yeni `convex/fixF2bEvents.test.ts`.
`convex/schema.ts`: VARSAYILAN DOKUNMA. Mevcut index'ler yetiyor (`cardReadings.by_device_hik_serial`, `by_device_io_time`). Yeni alan/index gerçekten gerekiyorsa ÖNCE `ask`.
DOKUNMA: `convex/ideSync.ts`, `convex/actions/ideGatewayDevice.ts`, `convex/visitors.ts`, `convex/lib/grantStatus.ts`, `convex/deviceSyncRuns.ts` (B-2) · `convex/lib/gateway/persons.ts`, `convex/hikvisionSync.ts`, `convex/lib/hikSyncEmployee.ts`, `convex/employeeTermination.ts` (B-1) · `infra/hik-event-bridge/**` (sunucu tarafı tekilleştirme yeterli; köprüye dokunma) · `convex/cardReadings.ts` (backfill zaten `by_device_hik_serial` ile tekilleştiriyor — OKU).

## Değişiklikler
1. **Hik tekilleştirme** — `persistHikvisionReading` (processCardReadingCore.ts ~212): `hikSerialNo` tanımlıysa insert ve yön çözümü ÖNCESİ `by_device_hik_serial` ile ara; varsa satır yazma, `hikLastSerialNo` patch'i ve diğer yan etkileri atla, mevcut satırın `granted`'ını dön. Serisiz olay eski davranış.
2. **IDE tekilleştirme** — `persistIdeReading` (~258): `ideTime` çözülebiliyorsa `by_device_io_time` (deviceId, ideIoId, accessTime = panel zamanı) + aynı `cardNo` ile ara; varsa aynı şekilde atla. `ideTime` yoksa tekilleştirme yok (rapora not).
3. **Hik cihaz zamanı (A teyit 10)** — canlı Hik satırında `accessTime` = cihaz olay zamanı (`toUtcISO` ile kanonik UTC); geçersizse ya da `şimdi + 5 dk`'dan ileri / `şimdi − 7 gün`'den eskiyse sunucu alış zamanı (cihaz zamanı metadata'da kalır). Yön çözümü (`resolveDirection` `nowISO`) de bu zamanı kullansın (IDE yolu zaten böyle).
   http.ts'te Hik olay zamanının (`hikDateTime`) core'a nasıl taşındığını kontrol et; taşınmıyorsa taşı.
4. **Köprü spool (F2-A NOT 5)** — `ide-mqtt-routing.mjs`: (a) başarılı teslimde her seferinde tüm dosyayı yeniden yazma yerine baş-ofset/sayaç tut, dosyayı toplu sıkıştır (ör. her 100 başarılı satırda veya kuyruk boşalınca) — O(n²) disk yazımı kalksın; çökmede en kötü durum = bazı satırların tekrar gönderimi (sunucu artık tekilleştiriyor). (b) `event/heartbeat` spool'a YAZILMASIN; yalnız doğrudan POST, hata = log. Mevcut `.corrupt`/`.rejected` karantina ve 408/429 geçici davranışı korunsun.

## Kabul (testler)
- Aynı Hik payload'u iki kez → 1 satır, yön bir kez değişir; farklı seri → 2 satır. Hik eski olay (cihaz zamanı 2 sa önce) → `accessTime` cihaz zamanı; 10 dk ileri cihaz zamanı → alış zamanı.
- Aynı IDE olayı (aynı io/zaman/kart) iki kez → 1 satır; aynı saniye farklı kart → 2 satır; `ideTime` yok → 2 satır (eski davranış).
- Köprü node testleri: 1000 olay boşaltımında dosya yeniden yazım sayısı O(n/100); heartbeat spool'a girmez; çökme simülasyonunda teslim edilmemiş satır kaybolmaz.
- Yeşil: `convex/processCardReading*.test.ts`, `convex/cardReading*.test.ts`, `convex/http*.test.ts`, `convex/lib/cardReadingProcess*.test.ts`, mevcut köprü node testleri (`node --test` deseni, F2-A'da eklenenler).

## Kapsam dışı
Okuyucu yön ayarı (C-10), HTTP gövde sınırı (C-11), backfill (C-07), Hik köprüsü (`infra/**`), UI.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
