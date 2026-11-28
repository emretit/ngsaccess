# Self-host hazırlık kodu denetimi — 28 Kasım 2026

Denetlenen: Codex'in D1–D8 kod hazırlığı (çalışma ağacındaki commit'siz değişiklikler). Salt okuma; kod değiştirilmedi, SSH/`npx convex`/commit yok. `src/hooks` ve `src/components/dashboard` kapsam dışı (paralel denetim).

**Sonuç:** Engel yok. Fotoğraf silme ve mobil upload tarafı güvenli. Ancak dedup'ta canlı yol ile backfill'in kart no ve saat hesabı birbirini tutmadığı için seri-yalnız dedup'tan **içerik dedup'una geçiş bazı olaylarda çift kayıt açıyor**. Bunun yanında `reconcile` ve `forwarding write` yanlış ortamda veya yanlış cihazda koşulursa geri dönüşü zor zarar verebilir. 3 düzeltme önerildi.

**Kapılar (kendi koşumum):**
- `vitest run` (selfHost ×2, files ×2, cardReadings ×2, gatewayBackfill ×2, fixF2bEvents, hikDeviceImport, akisFaz1.authz, pdksCheckpointTypes, dashboardSummary): **13 dosya, 277/277 geçti**
- `node --test infra/hik-event-bridge/bridge.nodetest.mjs`: **19/19**
- `flutter test test/repositories/request_attachments_test.dart`: **7/7**
- `tsc --noEmit -p convex`: **0 hata**

---

## Engel

Yok.

---

## Düzeltilmeli

### Y1. Dedup: canlı yol ile backfill kart no'yu farklı kaynaktan alıyor, eskiden olmayan çift kayıt açılıyor
- Yeni kural (`convex/lib/hikEventDedup.ts:8`): aynı seri no'lu aday ancak **kart no birebir eşitse** tekrar sayılıyor.
- Canlı yolda kart no = `CARD_FIELDS` içinde bulunan ilk alan (`convex/lib/cardReaderParse.ts:8-18`, `:362`). Sıra: `cardNo`, …, `employeeNo`, `employeeNoString`, …, **`cardReaderNo`**. Bu değer `convex/http.ts:239` (deviceEvents) ve `:259` (cardReadings) ile yazılıyor.
- Backfill'de kart no = `cardNo || employeeNoString || ""` (`convex/cardReadings.ts:806`).
- **Senaryo:** kartsız bir olayda (kapı/okuyucu alarmı vb.) payload'da `cardReaderNo: 1` var.
  1. Canlı yol `deviceEvents.cardNo = "1"` yazar.
  2. Backfill aynı seri için `cardNo = ""` hesaplar.
  3. Eşleşme olmaz, **ikinci deviceEvent eklenir**.
  4. Olay tazeyse `notifyAlarmIfNeeded` ile çift alarm maili gidebilir (`convex/cardReadings.ts:841`, `convex/lib/alarmNotify.ts:18`).
- Eski seri-yalnız dedup bunu engelliyordu. Yani bu bir gerileme.
- Aynı risk `employeeNo` (sayı) ile `employeeNoString` (metin, ör. başında sıfır olan) farklı geldiğinde parmak izi/yüz olaylarında da var.
- **Öneri:** iki yolda kart no'yu aynı yardımcıyla normalize et. `cardReaderNo` kart no sayılmamalı (bkz. N4). Yalnız deviceEvents için kart no eşitliğini şart koşma (seri + zaman yeterli). Bu durumlar için test ekle.

### Y2. Dedup: deviceEvents'te canlı yol ile backfill saati farklı yorumluyor
- Canlı yol `eventTime = toUtcISO(ham)` ile ofset etiketini dikkate alıyor (`convex/deviceEvents.ts:137`, `:148`).
- Backfill ise `hikWallClockToUtcISO` kullanıyor: etiketi yok sayıp +03:00 basıyor (`convex/cardReadings.ts:802`, `convex/lib/trDate.ts:43-46`).
- deviceEvents'te `hikDateTime` alanı olmadığı için yalnızca ±10 dk zaman karşılaştırması kalıyor (`hikEventDedup.ts:11`).
- ISUP köprüsü etiketi `EVENT_TIME_OFFSET=+03:00` ile düzelttiği için (`infra/hik-event-bridge/bridge.mjs:248`) bu yolda sorun yok.
- **Sorun yeri:** cihaz httpHosts → `/card-reader` doğrudan yolu ve Windows SDK köprüsü. Cihaz etiketi yanlışsa (ör. `+08:00`/`Z`, `trDate.ts:42` yorumundaki bilinen durum), canlı ve backfill saatleri saatlerce ayrışıyor. Sonuç: backfill **çift deviceEvent** yazıyor.
- cardReadings bu durumdan `hikDateTime` eşitliği sayesinde korunuyor (`hikEventDedup.ts:10`).
- **Öneri:** deviceEvents backfill dedup'unda hem `hikWallClockToUtcISO` hem `toUtcISO(ham)` ile karşılaştır. Alternatif: deviceEvents'e ham cihaz saatini sakla ve cardReadings'teki gibi eşitlikle eşle.

### Y3. `reconcile` ve `forwarding write` yanlış hedefe karşı korumasız
- **`convex/selfHostReconcile.ts:20` `reconcile`:**
  - Olumlu: internalMutation, yalnızca admin key ile çağrılabiliyor. `dryRun` zorunlu boolean, varsayılanı yok. dryRun'da yazma ve zamanlama yapılmıyor (test `selfHostPreparation.test.ts:42` doğruluyor).
  - Sorun: yanlışlıkla **canlı Cloud'da** `dryRun:false` ile koşulursa çalışmakta olan işler bozulur:
    - Çalışan biyometrik imha "failed" yapılır ve `pendingOpIds` boşaltılır (`:47-50`). KVKK imha takibi kopar.
    - Kuyruktaki sync hedefleri "unknown", run'lar "failed" olur (`:40-45`).
    - O an gönderilen raporlar ve alarm mailleri "failed" olur (`:51-56`).
  - **Öneri:** hedef ortam kilidi ekle. Örnek: yalnız `process.env.SELF_HOST_RECONCILE=1` set edilmiş deployment'ta çalışsın, ya da `confirmHost` argümanı `CONVEX_SITE_URL` host'uyla eşleşsin.
- **`convex/actions/selfHostForwarding.ts:13` `forwarding`:**
  - Olumlu: super_admin kontrolü var (`:16`). Varsayılan salt okuma, yazma için `write === true` şart (`:30`). Hedef URL https + `/card-reader` olarak doğrulanıyor (`:20`). Token yanıtta maskeleniyor (`:29`).
  - Sorun: `write:true` verildiğinde sayfadaki 10 cihazın **hepsine koşulsuz** yazıyor ve httpHosts `id:1` üzerine yazılıyor (`convex/lib/gateway/devices.ts:338-350`). Bu, Cloud'u göstermeyen cihazları da etkiler: bilerek kapatılmış, başka hedefe yönlendirilmiş veya müşterinin kendi sunucusuna giden cihazlar.
  - Plan ise "Cloud'u gösteriyorsa yeniden yaz" diyor (self-host-review D2).
  - Ayrıca bu fonksiyon public `authedAction`. Web oturumu ele geçirilmiş bir super_admin, tek çağrıyla tüm cihazların olay hedefini değiştirebilir.
  - **Öneri:** yalnız `before` değeri `.convex.cloud`/`.convex.site` içeren cihazlara yaz. `deviceIds` allowlist'i iste. Mümkünse internalAction yap; CLI'dan çalıştırılıyor zaten.

---

## Not (doğrulandı veya küçük)

- **N1. Dedup doğru çalışan kısımlar:**
  - Seri sıfırlanınca farklı zamandaki yeni olay ekleniyor; aynı olayın tekrarı engelleniyor. Test `selfHostPreparation.test.ts:10`, kartlı ve kartsız iki durumda.
  - Farklı kartlı, aynı saniyedeki olaylar **yutulmuyor**: adaylar aynı cihaz + seri ile sınırlı ve kart eşitliği şart.
  - Canlı cardReadings davranışı değişmedi: eski satır içi mantık `processCardReadingCore.ts:195` ile birebir aynı.
- **N2. Saat bilgisi olmayan olay:** canlı payload'da `dateTime` yoksa olay zamanı = alınma zamanı (`http.ts:236`, `processCardReadingCore.ts:66,186`). Spool kesimden >10 dk sonra yeniden gönderirse çift kayıt olur; eski seri-yalnız dedup bunu da engelliyordu. ISUP olaylarında `dateTime` neredeyse hep var, risk düşük. Provada spool tekrarından sonra satır sayısı karşılaştırılmalı.
- **N3. Fotoğraf (D5):**
  - Kullanımdaki hiçbir fotoğraf silinmiyor. Kontrol edilenler: employees/users `photoStorageId`, employeeFaces, consents, requestAttachments; ayrıca URL-only kullanıcı varken genel kilit (`files.ts:121-126`, `:149-150`).
  - IDOR (başkasının dosya ID'sini kendi kaydına bağlama) yok: `saveUserPhoto` pending sahibi = oturumdaki kullanıcı şartını koruyor (`files.ts:77-78`). Başkasının storageId'si bağlanamıyor.
  - Yan etki: bugün foto'lu her kullanıcı URL-only olduğu için `hasLegacyPhotos` her zaman true. Cleanup **hiçbir blob'u silmiyor**, pending satırlarını sildiği için bu blob'lar kalıcı yetim kalıyor (depolama sızıntısı, kişi başı 20/gün sınırlı).
  - Öneri: Cloud'da **kesimden önce** `_storage` üzerinde `getUrl(id) === users.photoUrl` eşlemesiyle `photoStorageId` backfill'i yap. Bu, export manifest eşlemesi ihtiyacını da ortadan kaldırır.
  - Users taraması (`:123`) her çalışmada indeksli ama sınırsız; kullanıcı sayısı düşükken sorun değil.
- **N4. Önceden var olan sorun:** `cardReaderNo` `CARD_FIELDS` listesinde (`cardReaderParse.ts:17`). Kartsız bir erişim olayı canlıda `cardNo = "1"` ile cardReading olarak yazılırken backfill aynı olayı deviceEvents'e yazar (tablolar arası çift). Bu değişiklikten önce de vardı.
- **N5. `cancelImportedJob`** (`convex/lib/cancelImportedJob.ts:5-8`): içe aktarılmamış iş ID'sinde `system.get` null döner ve cancel atlanır. Doğru yaklaşım. Self-host'ta eski ID ile `db.system.get` çağrısının hata vermediği provada doğrulanmalı.
- **N6. `reconcile` verimi:**
  - `auditLog` ve `deviceEvents` tüm tablo, 50'şer satırlık sayfalarla taranıyor. Büyük tablolarda bu yüzlerce/binlerce CLI çağrısı demek.
  - `auditLog.by_table_timestamp` (`schema.ts:1556`) ve `deviceSyncRuns.by_status_and_finishedAt` (`:1053`) indeksleri kullanılabilir.
  - Süresi kesim sırasında geçmiş kullanıcıların expire işi yeniden kurulmuyor (`:30` yalnızca gelecek tarihliler). Erişim istek anında reddedildiği için düşük risk.
- **N7. Mobil (D4):** izinli host listesi gevşetilmemiş.
  - Eşleşme tam host üzerinden, küçük harfe çevrilerek. https, userinfo yok, path `/request-attachments` ve `ticket` şartları duruyor (`request_repository.dart:54-62`).
  - Release'te yalnız `--dart-define` okunuyor; `.env` yalnız debug'da (`convex_config.dart:21-26`).
  - Wildcard yok, rastgele host'a yükleme yapılamıyor; test `evil.example.com`'u reddediyor.
  - Küçük: port kontrol edilmiyor (aynı host, farklı port kabul edilir). URL backend'den geldiği için düşük risk.
- **N8. Köprü `MAX_QUEUE` (D7):**
  - Geçersiz değer açılışta hata veriyor (`bridge.mjs:148`). Varsayılan 1000 korunmuş (`:423`), test var.
  - Dikkat: `MAX_QUEUE=` (boş) yazılırsa `Number("")=0` olur ve köprü **başlamaz**.
  - Spool yüklemesi limiti saymıyor (`:208`). Limit spool'daki kayıt sayısının altına indirilirse, kuyruk boşalana kadar yeni canlı olaylar düşürülür.
- **N9. Sabit Cloud adresi (6):** canlı hedef seçen sabit fallback kalmadı.
  - `src/convexClient.ts:3-5` env zorunlu ve hata veriyor; `.env.local`'da `VITE_CONVEX_URL` mevcut. Netlify build env'inde de olduğu yayından önce teyit edilmeli.
  - Kalan metinler yalnız yorum/örnek: `scripts/*.mjs` başlıkları, `scripts/test-convex-endpoint.sh:4`, `bridge/windows/.../README.md:91`, `LocalConfigServer.cs:280` placeholder.
  - Uyum dönüşümü: `request_repository.dart:48-51`.
  - Windows köprüsü `appsettings.json:4` artık boş. Kurulu köprülerin ayarı yerel config'den geldiği için etkilenmez; yeni kurulumda URL girilmesi şart.

---

## 2. tur — Y1/Y2/Y3 düzeltmelerinin denetimi (28 Kasım 2026)

**Sonuç:** Y1 ve Y3 kapandı. **Y2 yarım kaldı:** doğrudan forwarding yolu düzeldi, ama ana yol olan ISUP köprüsü yolunda yanlış saat etiketli cihazda çift kayıt riski şimdi orada açılıyor.

**Kapılar (kendi koşumum):**
- `vitest run convex`: **297 dosya, 4559/4559 geçti**
- Hedefli koşu (selfHostReview, selfHostForwarding, selfHostPreparation, events.recovery, cardReadings ×2, gatewayBackfill ×2, hikDeviceImport, fixF2bEvents, cardReaderParse): 143/143
- `tsc --noEmit -p convex`: 0 hata

### Y1 — KAPANDI
- Canlı yol (`cardReaderParse.ts:369`) ve geçmiş satırı (`gateway/events.ts:154`) aynı fonksiyonu, `extractHikCardNo`'yu (`cardReaderParse.ts:97`) aynı alan sırasıyla kullanıyor.
- Backfill de bu fonksiyonu çağırıyor (`cardReadings.ts:807`). Gelen `event.cardNo` zaten bu fonksiyonun çıktısı olduğu için sonuç aynı kalıyor.
- Validator yeni kimlik alanlarını kabul ediyor (`cardReadings.ts:780-786`).
- Kartsız olayda (`cardReaderNo:1`) tek deviceEvent ve tek alarm işi oluşuyor: `selfHostReview.test.ts:12-33`, 3 kimlik varyantıyla.
- Her `CARD_FIELDS` alanında canlı ile geçmiş eşitliği test ediliyor: `events.recovery.test.ts:7`.
- Kartlı eşleşme bozulmadı: `cardNo` hâlâ ilk sırada, ilgili mevcut testler yeşil.
- **Not (önceden var olan durum, artık backfill'de de var):**
  - `cardReaderNo` kart no sayıldığı için kartsız ve kataloglanmamış `DEVICE_EVENT` olayları artık backfill'de de cardReading olarak yazılıyor. Sebep: `hasCardNo=true` (`hikEventCatalog.ts:214-219`).
  - Bu olaylar `cardNo="1"` ile personel eşlemesine giriyor (`findDeviceCardEmployee`). Kart no'su "1" olan bir personel varsa olay yanlış kişiye yazılabilir.
  - Canlıda zaten böyleydi, şimdi iki yol tutarlı. Kalıcı çözüm (cardReaderNo'yu kimlikten çıkarmak) ayrı bir iş.

### Y2 — DÜZELTİLMELİ (yarım)
- Backfill deviceEvents artık `toUtcISO(ham)` kullanıyor (`cardReadings.ts:815-817`). Bu, canlı `recordHikDeviceEvent` (`deviceEvents.ts:137,148`) ile birebir aynı. Sonuç: **doğrudan httpHosts → `/card-reader`** yolu düzeldi; test `selfHostReview.test.ts:35`.
- **Sorun:** ISUP olay köprüsü saat etiketini `EVENT_TIME_OFFSET=+03:00` ile **yeniden yazıyor** (`infra/hik-event-bridge/bridge.mjs:248`, `bridge.env.example:9`). Ama gateway'den gelen AcsEvent geçmişi cihazın ham etiketini taşıyor.
- **Senaryo:** etiketi yanlış bir cihaz (ör. `10:00+08:00`, gerçekte TR 10:00).
  1. Köprü canlı olayı `10:00+03:00` olarak yazar, yani 07:00Z.
  2. Backfill şimdi `02:00Z` hesaplar.
  3. Fark 5 saat, ±10 dk penceresinin dışında: **çift deviceEvent** oluşur.
  4. Olay tazeyse çift alarm maili gidebilir (`cardReadings.ts:841`).
- Eski kod (`hikWallClockToUtcISO`) tam bu yolda eşleşiyordu. Yani bu değişiklik, gateway cihazlarında (K1T804/NGS0002/ANKA) gerilemeye yol açıyor.
- Ayrıca backfill'in yazdığı `eventTime` artık yanlış etiketle saatlerce kayık kaydediliyor. Eskiden duvar saatine düzeltiliyordu.
- Test bu yolu kapsamıyor: canlı tarafta da ham `+08:00` verilmiş, köprünün yeniden yazdığı `+03:00` denenmemiş.
- **Öneri:**
  - Dedup iki aday saati de denesin: `toUtcISO(ham)` ve `hikWallClockToUtcISO(ham)`. Herhangi biri ±10 dk içindeyse tekrar sayılsın.
  - Kayıtta eskisi gibi `hikWallClockToUtcISO` kalsın, köprü ile tutarlı olsun.
  - Test: canlı `10:00+03:00` + backfill `10:00+08:00` ⇒ tek satır.

### Y3 — KAPANDI
- **Kilit** (`convex/lib/selfHostTarget.ts:2-12`) üç şartın üçünü de istiyor:
  1. `SELF_HOST_TARGET === "1"`
  2. `CONVEX_SITE_URL` https, yolu/sorgusu/kimlik bilgisi yok, host'u `*.convex.cloud`/`*.convex.site` **değil**
  3. `confirmHost === site.host`
- Cloud hedefi reddediliyor (test `selfHostReview.test.ts:52`, `live.convex.site`).
- **Atlatılabilir mi:** Cloud'da `CONVEX_SITE_URL` bir sistem değişkeni ve `*.convex.site`. Bu yüzden `SELF_HOST_TARGET=1` yanlışlıkla Cloud'a set edilse bile host kontrolü reddeder. Kilidi aşmak için Cloud'da özel alan adı (Pro özelliği) **ve** bayrak **ve** doğru `confirmHost` birlikte gerekir; bu kasıtlı bir eylem olur.
  - Ek savunma olarak `CONVEX_CLOUD_URL` da `convex.cloud` değil diye kontrol edilebilir (Not).
- **reconcile:** yalnız `dryRun:false` kilide tabi (`selfHostReconcile.ts:29`). Kilit reddederse satır değişmiyor ve iş zamanlanmıyor (test `:42-60`).
- **forwarding:**
  - `write:true` için sırayla kilit, `HIK_FORWARDING_URL` origin'inin onaylı deployment ile eşleşmesi ve 1–100 arası açık `deviceIds` şart (`selfHostForwarding.ts:22-27`).
  - **deviceIds boş veya verilmemişse hiçbir cihaza yazmıyor**, cihaz I/O'su (GET dahil) başlamadan hata veriyor. Test: `selfHostForwarding.test.ts:35`, 6 geçersiz varyant.
  - Yazma yalnız listedeki cihazlara yapılıyor (`:38`). Listedeki ama o sayfada olmayan cihazlar sessizce atlanıyor; operatör sayfaları `continueCursor` ile dolaşmalı.
  - Küçük: yazma kararı hâlâ `before` değerine bakmıyor. Cloud'u göstermeyen cihazı ayıklamak operatörün `deviceIds` seçimine kalıyor; GET listesi buna yetiyor.

---

## 3. tur — Y2 düzeltmesinin denetimi (28 Kasım 2026)

**Sonuç:** Y2 **kapandı**. Backfill sonrası tek olay ve tek alarm sağlanıyor, kayıp riski ihmal edilebilir. Geriye küçük bir açık kaldı: iki canlı yol (köprü + doğrudan forwarding) arasında sıraya bağlı çift kayıt.

**Kapılar (kendi koşumum):**
- 8 dosya hedefli vitest (selfHostReview, selfHostPreparation, cardReadings ×2, gatewayBackfill ×2, events.recovery, fixF2bEvents): **105/105 geçti**
- `tsc --noEmit -p convex`: 0 hata

### Doğrulanan
- **Seri no şartı var.** Tüm adaylar `by_device_and_hik_serial` indeksiyle aynı cihaz ve aynı seri no'ya sınırlı (`cardReadings.ts:819-824`, `deviceEvents.ts:135`). İki saat yorumu yalnız bu adaylar arasında deneniyor (`hikEventDedup.ts:14-15`).
- **cardReadings etkilenmedi.** `alternateTime` yalnız deviceEvents yollarında kullanılıyor (`deviceEvents.ts:137`, `cardReadings.ts:825`). Kart okumaları canlıda `processCardReadingCore.ts:195`, backfill'de `cardReadings.ts:855` ile eskisi gibi çalışıyor.
- **Kayıtlı saat yine duvar saati.** Backfill `hikWallClockToUtcISO` ile yazıyor (`cardReadings.ts:815`), 2. turdaki saat kayması geri alındı.
- **Yanlış etiketli ISUP + backfill:** tek satır, tek alarm işi, saat `07:00Z` (`selfHostReview.test.ts:49`). Doğru etiketli forwarding + backfill de tek satır.
- **Canlıda doğrudan forwarding köprüden sonra gelirse:** `toUtcISO(+08:00)=02:00Z` ile `hikWallClock=07:00Z` köprünün yazdığı 07:00Z satırıyla eşleşiyor, tek satır kalıyor.

### Kayıp riski (3 saatlik ofset penceresi) — kabul edilebilir
- Ek ±10 dk'lık pencere yalnız cihaz etiketi `+03:00` değilse oluşuyor. Etiket doğruysa iki yorum aynı saati veriyor, fazladan pencere yok.
- Gerçek farklı bir olayın yutulması için aynı anda şunların hepsi gerekir:
  1. Aynı cihaz
  2. **Aynı seri no**, yani araya bir seri sıfırlanması girmiş olmalı
  3. Aynı kart (kartsız olaylarda kart no `""` olduğu için bu şart kendiliğinden sağlanıyor)
  4. Eski olayla arasında tam ofset farkı ±10 dk (ör. `Z` etiketinde 3 sa)
- Bu, sıfırlamadan yaklaşık 3 saat önce aynı düşük seri no'nun üretilmiş olmasını gerektirir. Pratikte yalnız kurulum gününde art arda iki fabrika sıfırlaması yapılırsa olur.
- **Öneri:** kurulumda sıfırlama sonrası backfill sayısını kontrol et. Kod değişikliği gerekmez.

### Düzeltilmeli (küçük): iki canlı yolda sıraya bağlı çift kayıt
- **Senaryo:** etiketi yanlış (`+08:00`) bir cihaz olayı hem doğrudan httpHosts hem ISUP köprüsü üzerinden gönderiyor, ve **doğrudan yol önce** geliyor.
  1. Doğrudan yol satırı `02:00Z` olarak yazar (`deviceEvents.ts:148`, `toUtcISO`).
  2. Köprü olayı `+03:00` etiketiyle gelir; iki yorumu da `07:00Z` verir.
  3. Eşleşme olmaz, **ikinci satır ve ikinci alarm** oluşur.
- Sebep: eşleştirme yalnız gelen olayın iki yorumunu deniyor. Mevcut satırın ham etiketi saklanmadığı için onun alternatif yorumu bilinmiyor.
- Eski seri-yalnız dedup bu durumu engelliyordu. Gerileme yalnız iki yolun birlikte açık olduğu ve etiketi yanlış olan cihazlarda görülür.
- **Öneri:** `recordHikDeviceEvent` de saati `hikWallClockToUtcISO` ile kaydetsin; backfill ile aynı, tüm cihazlar TR'de. Alternatif: deviceEvents'e ham cihaz saatini sakla ve iki tarafın iki yorumunu karşılaştır. Test: doğrudan `+08:00` önce, köprü `+03:00` sonra ⇒ tek satır.
