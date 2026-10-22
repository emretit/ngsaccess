# W6-2 — Cihaz çevrimdışı süre/sayı geçmişi (UYGULAMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w6-device-offline` (dal `emretit/w6-device-offline`, taban `5d36adb`; `node_modules` ana repoya symlink — DOKUNMA). Arka plan: `/Users/emreaydin/ngsaccess/docs/hikconnect-audit/KIYAS.md` satır 25 ve 77 (Health Status: çevrimdışı süre/sayı geçmişi yok).

## Hedef (test edilebilir)
Cihaz detay çekmecesinde "Bağlantı geçmişi" bölümü: son 30 günde kaç kez çevrimdışı olduğu, toplam ve en uzun çevrimdışı süre, son 20 çevrimdışı dönem (başlangıç–bitiş, süre; İstanbul saati) ve şu an çevrimdışıysa "devam ediyor" satırı. **Ek cron/polling ve heartbeat başına ek yazma YOK.**

## Tasarım (zorunlu)
- Çevrim durumu tek kaynaktan: `convex/lib/deviceConnection.ts` (`deviceConnection`, `DEVICE_ONLINE_WINDOW_MS` = 5 dk). Aynı sinyal alanları: Hik gateway `hikLastSeenAt`/`hikOfflineHint`, diğerleri `lastSeen`.
- Dönem kaydı yalnız GEÇİŞ anında: bir heartbeat/son-görülme yazımı sırasında önceki sinyal `now - DEVICE_ONLINE_WINDOW_MS`'ten eskiyse (ya da `hikOfflineHint` doluyken çevrimiçi sinyal geldiyse) tek bir `deviceEvents` satırı ekle: `category: "status"`, `severity: "warning"`, `source` cihaz markasına göre (`hikvision`/`ide_smart`/`system`), `eventTime` = geri gelme anı (ISO), `label: "Çevrimdışı dönemi"`, `rawData` = JSON `{ offlineFrom, offlineTo, durationMs }` (offlineFrom = önceki son sinyal). Şema değişikliği YOK (mevcut alanlar + `by_device_and_event_time` indeksi).
- Tüm son-görülme yazıcılarını bul ve ortak bir yardımcıdan geçir (ör. `recordConnectivityTransition(ctx, device, nowMs)` `convex/lib/deviceConnection.ts`'te): `grep -rn "hikLastSeenAt\|lastSeenAt\|lastSeen:" convex` — en az Hik gateway (`convex/devices.ts:~1225` durum güncellemesi; 60 sn throttle ERKEN DÖNÜŞÜNDEN ÖNCE karşılaştır), Hik localBridge (`convex/hikBridge.ts`), IDE (MQTT köprüsü / heartbeat yolu), ESP32 kart okuyucu / diğer HTTP heartbeat'ler. Throttle'lı yazımlarda bile geçiş kaçmamalı (karşılaştırma yazımdan bağımsız, ama ek DB yazması yalnız geçişte).
- İlk kez görülen cihaz ("never" → online) dönem üretmez. Saat geri gitmesi / gelecekteki sinyal → dönem yok.
- Sorgu: `deviceEvents.ts` (ya da cihaz merkezi modülü) `getConnectivityHistory({ deviceId, days?: 30 })` — mevcut cihaz okuma yetkisiyle aynı (proje erişimi; `devices` sorgularındaki desen), `by_device_and_event_time` ile `gte(eventTime, now-30g)` + `category === "status"` süzme, `take(501)` sınırı (aşımda "son 500 dönem" notu). Dönüş: `{ count, totalMs, longestMs, periods: [...son 20], ongoing?: { since } , truncated }`; `ongoing` cihazın mevcut sinyalinden hesaplanır (yazma yok).
- UI: `src/components/devices/**` — cihaz detay çekmecesine (`DeviceDetailsPanel.tsx` / `DeviceConnectionSection.tsx`) "Bağlantı geçmişi" bölümü; tek seferlik `useQuery` (cihaz seçiliyken), boş durum "Son 30 günde çevrimdışı dönem yok". Süreler "2 sa 15 dk" biçiminde; saatler UTC+3. Yalnız okuma; mevcut rol görünürlüğüne uy (project_user cihaz detayını görüyorsa sorun yok, komut değil).
- Bilinen sınır (rapora yaz): cihaz hiç geri gelmezse dönem yazılmaz; açık dönem `ongoing` ile gösterilir. Geçmiş (yayın öncesi) dönemler yoktur.

## Ortak kurallar
- TypeScript strict; `any`/`as any`/`!`/`filter(Boolean)` YASAK. Sınırsız yeni `.collect()`, cron, polling YOK. `convex/_generated/ai/guidelines.md` oku. Türkçe metin.
- Ownership: `convex/lib/deviceConnection.ts`, son-görülme yazıcıları (yalnız geçiş kaydı satırları), `convex/deviceEvents.ts` (ya da sorgunun konacağı mevcut cihaz modülü), `src/components/devices/**` (yalnız bağlantı geçmişi bölümü), testler, `convex/_generated/api.d.ts` (yalnız yeni modül satırı gerekirse).
- YASAK: `convex/schema.ts`, `convex/doors.ts`, `convex/shifts.ts`, `src/components/access-control/**`, `src/components/shifts/**`, `src/components/audit/**`, `convex/actions/hikGatewayDevice.ts` ve `convex/actions/hikQueueWorker.ts`'in kapı planı kısımları (W6-3), commit, push, deploy, `npx convex *`, DB yazma, `git add/stash/checkout/reset/commit`.

## Testler
- convex-test: her yazıcı yolu için 5 dk'dan uzun boşluk → tek dönem; kısa boşluk → yok; throttle'lı ardışık heartbeat → ek yazma yok; `hikOfflineHint` → online geçişi dönem; never → online dönem yok; gelecekteki sinyal → yok.
- Sorgu: başka projenin cihazı reddi, 30 gün penceresi, count/total/longest, `ongoing`, `truncated`.
- UI: bölüm render (boş/dolu/devam ediyor), süre biçimi, TR saat.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 · `node_modules/.bin/vitest run` → tamamı yeşil (sayı) · `node_modules/.bin/vite build` → OK · `git diff --check` temiz.

## Rapor
`/tmp/w6-2-report.md`: yazıcı yolları listesi (file:line), sorgu, UI yeri, testler, ek yazma/okuma maliyeti. `worker_done`'da ≤10 satır.
