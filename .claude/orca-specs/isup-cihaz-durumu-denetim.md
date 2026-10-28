# DENETİM — ISUP cihaz durumu (salt-okuma)
ÖNCE oku: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-denetim-ortak.md`. Spec: `.claude/orca-specs/isup-cihaz-durumu.md`. Yazar raporu: `/tmp/isup-durum-rapor.md` — rapora değil diff'e (`git diff HEAD` + yeni `convex/hikIsupStatus.test.ts`) ve kendi koştuğun kapıya dayan.
Rapor: `/tmp/isup-durum-denetim.md`.
Dosyalar: infra/hik-event-bridge/{bridge.mjs,bridge.nodetest.mjs,RUNBOOK.md}, convex/http.ts, convex/devices.ts, convex/schema.ts, convex/lib/deviceConnection.ts, convex/deviceEvents.ts, convex/deviceCenter.ts, convex/adminDevices.ts, src/components/admin/AdminDevicesPanel.tsx, convex/hikIsupStatus.test.ts.

## Odak
1. Güvenlik: `/hik-gateway/device-status` — token başka cihazın durumunu değiştirebilir mi (devIndex eşleşmesi, token→cihaz sabitleme), localBridge/IDE/ESP32 cihaza yazılabilir mi, başka proje sızıntısı, gövde doğrulama, rate (köprü dışı bir istemci flood ile alarm/e-posta üretebilir mi).
2. Zaman: köprü `devStatusChanged` için gateway `dateTime`'ını mı kullanıyor? Gateway saati/zaman dilimi yanlışsa (cihaz saatleri 1970 olabiliyor; kart olayları için EVENT_TIME_OFFSET var) olaylar "2 dk ileri" ya da "eski" diye sessizce reddedilip özellik hiç çalışmayabilir mi? Koordinatör tercihi: durum olaylarında `at` = köprünün alma anı (akış gerçek zamanlı). Bunu ENGEL/DÜZELTİLMELİ olarak değerlendir.
3. Alarm doğruluğu: <5 dk kopma kayıt/alarm üretmez; ≥5 dk tek exception + tek notify; reconnect resolvedAt, ikinci e-posta yok; confirm yarışları (kopma→geri→kopma); snapshot tekrarları geçiş üretmez; köprü yeniden başlayınca (snapshot) yanlış geçiş/alarm yok; mevcut `recordConnectivityTransition` yolu ISUP cihazında çift kayıt üretmiyor.
4. Bağlantı hesabı: 2,5 sa tazelik; köprü ölürse 2,5 sa sonra eski davranışa düşüş; `deviceConnection` çağıran tüm yerler (UI + backend: `adminDevices`, `deviceSyncRun`, kuyruk worker'ı `hikLastSeenAt` online tanımı `hikQueueWorker.ts:38`, `hikvisionSync.ts:818`) tutarlı mı — ör. ISUP online ama `hikLastSeenAt` eski olduğu için kuyruk retry/backfill cihazı "offline" sayıp atlıyor mu (davranış değişikliği gerekip gerekmediğini NOT olarak yaz).
5. Kota: yeni reaktif sorgu yok; saatlik snapshot × cihaz çağrı sayısı; scheduler yalnız geçişte.
6. Köprü: ortak kuyruk sınırı, retry, timer temizliği, log'da kişi verisi yok, mevcut kart akışı bozulmadı.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint <dosyalar>` · `node_modules/.bin/vitest run convex/hikIsupStatus.test.ts convex/deviceConnectivity.test.ts convex/alarmDelivery.test.ts` · `node --test infra/hik-event-bridge/bridge.nodetest.mjs`.

Salt-okuma: rapor hariç hiçbir dosyaya yazma. commit/push/deploy/`npx convex`/DB/SSH YOK.
Rapor: ENGEL / DÜZELTİLMELİ / NOT, file:line + senaryo + öneri. `worker_done`'da ≤10 satır + `--report-path /tmp/isup-durum-denetim.md`.
