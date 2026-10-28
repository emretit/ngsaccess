# SİSTEM AUDIT — M2 CİHAZLAR, KAPI/OKUYUCU, KART OLAYLARI, ENTEGRASYON KÖPRÜLERİ

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/sistem-audit-ortak.md` dosyasını OKU; oradaki kurallar (YASAK listesi dahil) bağlayıcı.

**Rapor:** `docs/sistem-audit-2026-10-25/M2-cihaz.md` (yalnız bu dosyayı yazabilirsin). Bulgu ID öneki `C-`.

## Kapsam
- Backend: `convex/{devices,deviceCenter,adminDevices,deviceEvents,deviceSyncRuns,doors,zones,readers,virtualReaders,cardReadings,hikvisionSync,hikRosterReconcile,hikBridge,ideSync,ideDefaults,debugIde,http,crons}.ts`
  (crons.ts'te yalnız cihaz/Hik/IDE işleri), `convex/actions/{hikvisionSync,hikGatewayDevice,hikQueueWorker,hikRosterReconcile,hikBridgeWake,hikDebug,ideGatewayDevice}.ts`,
  `convex/lib/gateway/**`, `convex/lib/{device*,hik*,cardReader*,cardReading*,gateway*,doorStatusPlan,doorZoneDelete,processCardReadingCore,accessDecision,capabilitySnapshot,digestAuth,syncErrors,syncStatus*,reconcileMath,virtualReader,liveReadings,readingSearch}.ts`.
- Köprü/altyapı: `infra/{hik-event-bridge,hik-relay,mqtt}/**`, `scripts/{ide-mqtt-bridge,hikvision-bridge,ide-provision-agent,forward-card-reader-to-convex}.mjs`;
  `bridge/windows` yalnız aktif koddan kırık bağ açısından.
- Web: `src/components/{devices,live-monitoring,virtual-reader,sync}/**`, `src/pages/{Devices,LiveMonitoring,VirtualReaderKiosk}.tsx`,
  `src/hooks/{useDevices,useDeviceTable,useDeviceFilters,useProjectFilteredDevices,useZonesAndDoors}*`, `src/lib/{device*,syncErrorMessages}.ts`.
- Eski audit: `docs/genel-akis-audit/C-kurulum-cihaz-yonetim.md` + A raporunun cihaz adımları + OZET Faz 2/5.
- Hafıza notları (bilgi): ISUP online/offline köprüden (`/hik-gateway/device-status`), cihaz proje taşıma fix (7e131a49/47ae87d7),
  K1T807 seri no kuralı, IDE MQTT-only, IDE ideUuid 15 hane.

## Özellikle bak
- HTTP route'ları (`convex/http.ts`): kimlik doğrulama (token/HMAC/digest), rate limit, replay, büyük gövde, hata kodları.
- Kart olayı işleme: kişi/proje eşleşmesi (projeler arası sızma), yön (in/out/both), saat dilimi, tekrar (dedupe), pasif/silinmiş kişi,
  biyometrik kaynak etiketi (PDKS'e ne gidiyor), sanal okuyucu QR.
- Senkron kuyrukları (Hik queue, IDE, deviceSyncRuns): takılan iş, sonsuz retry, kota (cron sıklığı × fonksiyon çağrısı), hata görünürlüğü.
- Cihaz ekle/sil/proje taşı/çevrimdışı: kapı/okuyucu/kural/kişi listesi tutarlılığı; ehomeId/seri tekilliği.
- Kapı planları (haftalık açık/kilitli) ve uzaktan kapı açma yetkisi.
- Köprülerin Convex sözleşmesiyle uyumu (alan isimleri, route path, auth başlığı).

## İlişkiler (bölüm 4'te mutlaka işle)
M1 (kişi/kural → cihaz roster), M3 (kart olayları → PDKS, kontrol noktası/okuyucu tipi), M4 (alarm: çevrimdışı/olay alarmı,
denetim logu, admin cihaz paneli), M5 (mobil QR erişim → mobileAccessGateway/sanal okuyucu).
