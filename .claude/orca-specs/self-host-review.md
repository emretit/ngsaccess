# Self-host planı bağımsız denetimi — 28 Kasım 2026

Denetlenen: `docs/convex-audit/SELF_HOST_PLAN_2026-11-28.md` (Codex). Salt okuma: kod, `node_modules` ve resmî Convex sayfaları okundu. SSH, `npx convex`, deploy ve canlı veri işlemi yapılmadı.

**Sonuç:** Plan teknik olarak dikkatli ve kod atıflarının çoğu doğru. Ancak **4 Aralık müşteri açılışını self-host kesimine bağlamak yanlış**. Planın hiç değerlendirmediği **Convex Cloud Starter** (kullandığın kadar öde) seçeneği, aynı aylık maliyetle (~17–18 $/ay) ve taşıma riski olmadan bugünkü Free kota sorununu çözüyor. Self-host yapılacaksa açılıştan sonra, acele etmeden yapılmalı.

---

## Engel

### E1. Daha basit ve ucuz yol atlanmış: Cloud Starter planı
- Kaynak: [convex.dev/pricing](https://www.convex.dev/pricing). Starter: "Free or $0/month and pay as you go". Ek ücretler: DB I/O **$0,22/GB**, fonksiyon çağrısı **$2,20 / 1M**, DB depolama **$0,22/GB**.
- FREE_PLAN'ın bugünkü HEAD tahmini (`FREE_PLAN_2026-11-28.md` §2): 79,98 GB I/O, 1,278 M çağrı, 0,736 GB DB.
  → (80−1)×0,22 ≈ **$17,4** + 0,278 M×2,2 ≈ **$0,6** + 0,24 GB×0,22 ≈ **$0,05** ⇒ **≈ $18/ay**.
- Professional: $25/geliştirici/ay, 50 GB I/O dahil ⇒ ≈ **$31/ay**. Buna otomatik periyodik yedek de dahil; Free'de yok (FREE_PLAN:180).
- Self-host'un en ucuz güvenli paketi (plan §6) **€17–19/ay** ve buna nöbet, yedek, restore ve güncelleme işi de ekleniyor. Yani maliyet aynı; risk ve işletim yükü self-host tarafında.
- FREE_PLAN:176 Starter'ı yalnızca "ücretsiz kalma talebi" yüzünden dışarıda bırakmış. Self-host planı bu varsayımı sorgulamamış.
- **Öneri:** 4 Aralık için Cloud'da Starter'a geç, harcama uyarısı veya limit kur. Sonra ya Dalga a–c ile I/O'yu düşür ya da self-host'u Aralık ortası/Ocak'ta prova ederek yap.
- Teyit edilecek: canlı sistem **dev** deployment'ında (`notable-tern-4`). Starter ücretinin ve limitlerinin dev deployment'a da aynı şekilde uygulandığını pricing/usage sayfasında doğrula.

### E2. 4 Aralık takvimi gerçekçi değil
- Bugün 28 Kasım **Cumartesi**. Planın takvimi: prova 30 Kasım (Pazartesi), kesim 1 Aralık (Salı), müşteri canlısı 4 Aralık (Cuma).
- Planın kendi tahmini 3–5 iş günü + 24 saat izleme. Prova öncesinde kalan süre yalnızca hafta sonu.
- §7'deki 9 sorunun hiçbiri yanıtlanmış değil: VM, alan adı, köprü sürümü, cihaz firmware'i, secret sorumlusu, mobil dağıtım vb.
- Kesim için mobil uygulamada kod değişikliği ve yeni binary şart (bkz. D4). Ancak hafıza notuna göre iOS hesabı ve applicationId kararı bekliyor; 1.0.5 için store build yok. Sahada eski binary varsa paused Cloud'a gitmeye devam eder.
- Aynı hafta içinde backend taşıma ve yeni müşterinin 10 cihaz/500 kişi açılışı birleşiyor. Bir sorun çıkarsa sebebini ayırmak zor olur, geri dönüş de mobil yüzünden yavaş olur.

---

## Düzeltilmeli

### D1. Zamanlanmış işler taşınmıyor; plan hangilerinin etkilendiğini adlandırmamış
Snapshot ZIP'e yalnız tablolar ve `_storage` girer. `_scheduled_functions` taşınmaz: export dokümanı bunu belirtmiyor, provada doğrulanmalı. Koddaki uzun gecikmeli işler:
- `convex/accountAccess.ts:47-49`: `users.accessExpiryJobId` hesap süresi bitişinde oturumları kapatan işin ID'sini tutuyor. Import'tan sonra bu iş yok, oturumlar kapatılmaz.
  - Erişim istek anında yine de reddedilir (`convex/lib/accountAccess.ts:7`).
  - Yeni sistemde eski ID ile `scheduler.cancel` çağrısının ne yaptığı test edilmeli: hata verirse hesap süresi değiştirilemez.
- Yarıda kalan işler kaybolur: `biometricDestruction.ts:110,147` (KVKK biyometrik imha izleyicisi), `deviceSyncRuns.ts:117,370`, `reports.ts:386,423` (zamanlı rapor), `alarms.ts:190,218` (alarm maili yeniden denemesi), `devices.ts:1127` (offline teyidi).
- **Gerekli:** import sonrası bir uzlaştırma script'i. Süresi gelecekte olan kullanıcıların işlerini yeniden kur, `running` durumundaki sync/imha kayıtlarını kapat veya yeniden başlat. Kesimi açık bir biyometrik imha işi varken yapma.
- Geri dönüşte risk var: pause dokümanı "Scheduled jobs will queue and run when the deployment is resumed" diyor ([pause-deployment](https://docs.convex.dev/production/pause-deployment)). Cloud resume edildiğinde birikmiş cihaz komutları ve mailler çalışır. Plan §3 adım 9'daki geri dönüş satırı bunu söylemiyor.

### D2. Cihazlara yazılmış forwarding URL'si env değişikliğiyle güncellenmez
- `convex/lib/gatewayCommand.ts:130-140`: cihaz kaydı sırasında `HIK_FORWARDING_URL` (Cloud `/card-reader` + token) cihazın/gateway'in httpHosts ayarına **yazılıyor**.
- Env'i değiştirmek, daha önce kaydedilmiş cihazları güncellemez. O cihazlar paused Cloud'a POST atmaya devam eder ve bu olaylar köprü dışında kaybolur.
- Plan bunu yalnızca "gerekliyse forwarding URL değiştirilir" diye geçiyor.
- **Gerekli:** 10 cihazın her birinin httpHosts değeri tek tek okunmalı. Cloud'u gösteriyorsa yeni adrese yeniden yazılmalı ya da kapatılmalı. Bu, cihaz yazma işi olduğu için ayrıca Emre onayı ister.

### D3. Kart dedup'u canlı yol ve backfill'de farklı çalışıyor
- Canlı yol: seri no + kart no + zaman (±10 dk) eşleşmesine bakar ve seri sayacı sıfırlanmasını tolere eder (`convex/lib/processCardReadingCore.ts:186-204`).
- Backfill: **yalnız seri no**'ya bakar (`convex/cardReadings.ts:841-850`; deviceEvents için de aynısı, `:811-819`).
- Sonuç: cihaz resetlenmiş veya firmware sayacı sıfırlamışsa, kesim sonrası backfill yeni olayları "duplicate" sayıp **sessizce atlar**.
- Bu çift kayıt riski değil, kayıp riski. Kesimin olay mutabakatı tamamen backfill'e dayandığı için provada her cihazın seri aralığı kontrol edilmeli. Backfill dedup'unun canlı yolla aynı içerik kontrolünü yapması ayrı bir kod işi.
- Canlı + spool + backfill tekrarında çift kayıt: seri no gelen olaylarda ikisi de engelliyor, plan bu noktada doğru.

### D4. Mobil upload host kontrolü doğrulandı; düzeltilmeden mobil ek dosya yüklemesi kırılır
- `mobile/lib/repositories/request_repository.dart:48-58`: host `.convex.cloud` ile bitmiyorsa beklenen upload host'u API host'unun aynısı oluyor.
- Planın önerdiği ayrı `api.` / `site.` alan adları yapısında her upload `ProtocolError` ile reddedilir. Plan bunu doğru tespit etmiş.
- Bu düzeltme olmadan, mobil sürüm sahaya ulaşmadan kesim yapılamaz. E2 ile birlikte en büyük takvim riski bu.

### D5. Fotoğraf ve URL alanları
- `users.photoUrl` yalnızca URL tutuyor, storageId tutmuyor (`convex/schema.ts:99`, `convex/files.ts:81-84`). Yeniden türetilemez.
  - Convex storage URL'sindeki anahtarın import'tan sonra aynı kalıp kalmadığı dokümanda belirtilmiyor.
  - Export manifest'i ile eşleme script'i gerekiyor.
- `files.ts:135-139` (`cleanupPendingUploads`) kullanıcı fotoğrafının kullanımda olup olmadığına URL eşitliğiyle karar veriyor. URL düzeltilmeden cron açılırsa, bekleyen kaydı kalmış bir kullanıcı fotoğrafı **silinebilir**. URL düzeltmesi cron'lar açılmadan önce yapılmalı.
- Personel fotoğrafında sorun yok: `photoStorageId` var (`convex/lib/peoplePhoto.ts:20-23`). Hik yüz senkronu da storageId'den blob okuyor (`convex/actions/hikvisionSync.ts:230`).
- Taranacak diğer URL alanları: `logoUrl` (`schema.ts:1161,1244`), `documentUrl` (`:1474`), `visitorKvkkUrl` (`:1628`, `privacyRetention.ts:182`), `mobileVisitorNoticeUrl` (`:214`). Export içinde tüm string alanlarda `convex.cloud` / `convex.site` araması yapılmalı.

### D6. Env envanterinde eksikler
- `HIK_RELAY_URL`, `HIK_RELAY_SECRET` eksik (`convex/lib/hikWake.ts:32-37`, `convex/actions/hikBridgeWake.ts:10`, `convex/hikBridge.ts:24`). Taşınmazsa roster wake özelliği sessizce kapanır.
- `HIK_GATEWAY_DEBUG` (`convex/lib/gateway/core.ts:90`) listede yok; düşük önem.
- `infra/hik-relay/` (nginx + `ngs-hik-relay.service`) ve `scripts/ide-mqtt-bridge.mjs:41` (IDE MQTT köprüsü, `CONVEX_SITE_URL`) kesim sırasına alınmamış. IDE köprüsünde spool yok, canlı IDE panel olaylarının kesimdeki davranışı belirsiz.

### D7. Köprü kuyruğu kesimden sonra yavaş boşalabilir
- `infra/hik-event-bridge/bridge.mjs:157-180,183-205`: kuyruk **sıralı** işleniyor. Her başarısız deneme 3 deneme × 15 sn timeout + 2/4/6 sn bekleme alıyor. Backend kapalıyken birikmiş yüzlerce iş, backend dönünce yeni canlı olayların önünde bekleyebilir.
- `maxQueue` env'den ayarlanamıyor (`:146`, `:416-425`), 1000'de olay düşürülüyor (`:213-216`). Plan bunu doğru yazmış.
- **Öneri:** yeni URL ile köprüyü yeniden başlat; spool diskten yeniden yükleniyor (`:208`). Boşalma süresini provada ölç.
- Paused Cloud herhangi bir 4xx/5xx döndürse bile olay spool'da kalıyor, çünkü yalnız 2xx kaydı siliyor (`:186-195`). Kayıp yok, plan doğru.

### D8. Web oturumu: yeniden giriş kesin
- Auth React istemcisi token'ları `storageNamespace = client.address` altında saklıyor (`node_modules/@convex-dev/auth/dist/react/index.js:61`). Issuer da `CONVEX_SITE_URL` (`convex/auth.config.ts:4`).
- URL değişince **tüm web kullanıcıları** yeniden giriş yapmak zorunda kalır. Plan bunu "gerektirebilir" diyor; aslında kesin. Müşteri açılışı haftasında duyurulması gerekir.

---

## Not (doğrulandı veya küçük)

- **Doğru atıflar:**
  - spool fsync + atomik rename (`queue.mjs`), başarıdan sonra silme (`bridge.mjs:186`), varsayılan kuyruk dizini (`:425`).
  - backfill 48 saat / 5 dk overlap (`convex/lib/gatewayBackfill.ts:356-366`).
  - Cloud fallback'leri: `src/convexClient.ts:3`, `bridge/windows/.../appsettings.json:4` + `installer/.../appsettings.json:4`, `scripts/*.mjs`, `docs/HETZNER_CARD_READER_BRIDGE.md:14,154`.
- **CLI:** `--replace-all` ve `--component` var (`node_modules/convex/src/cli/lib/command.ts:468,499`). Kurulu convex **1.47.0**, `package.json` `^1.39.1`; lockfile sürümü sabitlenmeli.
- **Component tabloları:** migrations ve rate-limiter tablolarının ZIP'e girdiği resmî dokümanda **belirtilmiyor**. Provada migrations checkpoint'leri sayılmalı. Plan "tüm migration'ları yeniden çalıştırma" yasağını doğru koymuş.
- **`_storage`:** ID'ler korunuyor. Import dokümanı: "preserve `_storage` documents, including their `_id`…".
- **Pause:** dokümanda "New function calls will return an error". HTTP durum kodu ve pause sırasında export yapılıp yapılamayacağı **belirtilmiyor**. Planın "pause'da export provası" şartı doğru.
- **SQLite + yedek (RPO/RTO):** resmî README "start with SQLite … separate SQL database for a production-ready configuration as needed" diyor; bu yük için tek SQLite yeterli.
  - Saatlik ZIP ile RPO ≤1 saat makul. Bugünkü Cloud Free'de periyodik yedek hiç yok, yani mevcut durumdan iyi.
  - RTO ≤2 saat yalnızca restore provası yapılırsa ve DNS TTL düşük tutulursa geçerli.
  - `INSTANCE_SECRET` kaybolursa admin key de kaybolur; ayrı kasada tutulmalı.
  - Aynı VM'de yedek tutmamak ve çalışan SQLite'ı `cp` ile kopyalamamak kuralları doğru.
- **Resmî uyarı:** "Self hosting is not for everyone… we recommend using the Convex-hosted product" ([docs.convex.dev/self-hosting](https://docs.convex.dev/self-hosting)). Ayrıca "supports all the free-tier features" diyor, Cloud'daki Pro özellikleri gelmiyor.
- **ESP32 nginx yolu:** spool yok; plan doğru işaretlemiş.

## Kaynaklar
- https://www.convex.dev/pricing
- https://docs.convex.dev/database/import-export/import
- https://docs.convex.dev/database/import-export/export
- https://docs.convex.dev/production/pause-deployment
- https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md
- https://docs.convex.dev/self-hosting
