# Hikvision Gateway + ISAPI Detayli TODO

Tarih: 2026-06-23

Kaynak audit: `docs/HIKVISION_DOKUMAN_AUDIT_2026-06-23.md`

Amaç: Hikvision dokumanlarinda olup ngsaccess'te eksik/kismi olan ozellikleri kontrollu fazlarla tamamlamak. Her faz tek basina test edilebilir, geri alinabilir ve canli cihaz olmadiginda simule/unit test ile ilerleyebilir olmali.

## Calisma Prensipleri

- Once capability oku, sonra ozellik yaz.
- Gateway ve localBridge yollarini karistirma.
- Cihazdan gelen ham cevaplar `unknown` parse edilmeli; `any` yok.
- UI, cihaz desteklemiyorsa aksiyonu gizlemeli veya disabled gostermeli.
- Yikici islemler icin onay + audit/event kaydi olmali.
- Her faz sonunda:
  - `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
  - `node_modules/.bin/eslint src convex`
  - Ilgili unit test varsa calistirilir.

## Faz 0 - Canli Gateway Dogrulama Hazirligi

Durum: On kosul.

Amac: Yeni ozelliklere baslamadan mevcut gateway fonksiyonlarindaki belirsiz shape/path noktalarini canli cihazda dogrulamak.

TODO:

- [ ] Online gateway Hikvision cihaz listesini dogrula.
  - Komut: `npx convex run devices:listOnlineGatewayDevicesForBackfill`
  - Kabul: En az 1 `hikTransport="gateway"` ve `hikDevIndex` dolu cihaz.

- [ ] `AcsWorkStatus` shape dogrula.
  - Komut: `npx convex run actions/hikGatewayDevice:fetchDeviceWorkStatus '{"deviceId":"<id>"}'`
  - Kabul: `doorStatus`, `magneticStatus`, `cardReaderOnlineStatus` alanlari gercek cihaz yaniti ile uyumlu.
  - Gerekirse: `convex/lib/gateway/devices.ts#getAcsWorkStatus` parser duzelt.

- [ ] `AcsEvent` backfill shape/pagination dogrula.
  - Komut: `npx convex run actions/hikGatewayDevice:backfillDeviceEvents '{"deviceId":"<id>"}'`
  - Kabul: Ilk calisma `inserted > 0` olabilir; ikinci calisma ayni pencere icin `inserted=0`.
  - Gerekirse: `convex/lib/gateway/events.ts#searchAcsEventsOnDevice` parser duzelt.

- [ ] Card/face/fingerprint reconcile shape dogrula.
  - Komut: `npx convex run actions/hikGatewayDevice:reconcileDevice '{"deviceId":"<id>"}'`
  - Kabul: Cihazda bilinen kartlar/yuzler/parmak izleri beklenen sayilara yakin doner.
  - Gerekirse: `cards.ts`, `biometrics.ts` search parserlarini duzelt.

- [ ] `VerifyPlan` link path dogrula.
  - Komut: test kapisinda `applyVerifyPlan`.
  - Kabul: Cihaz web UI veya GET endpoint ile verify plan baginin gorulmesi.
  - Gerekirse: `convex/lib/gateway/plans.ts#linkVerifyPlan` path degistir.

Teslim:

- [ ] `docs/HIK_ISAPI_HANDOFF.md` icindeki VERIFY listesi guncellenir.
- [ ] Canli cihaz yoksa bu faz `blocked` olarak isaretlenir, Faz 1 unit/parser ile devam eder.

## Faz 1 - Capability Snapshot

Oncelik: P0.

Durum: Kismi tamamlandi. Backend helper/action/schema ve cihaz formu tarama paneli eklendi. Kalan: canli gateway cihazda snapshot dogrulama ve sonraki fazlarda butonlari capability'ye gore disable/gizleme.

Amac: Model/firmware destek matrisi olmadan aksiyon sunmayi birakmak.

Backend TODO:

- [x] Yeni dosya: `convex/lib/gateway/capabilities.ts`
  - [x] AccessControl capability probe.
  - [x] AcsEvent capability probe.
  - [x] CardReader capability probe.
  - [x] CaptureCard capability probe.
  - [x] CaptureFingerPrint capability probe.
  - [x] DoorStatusPlan capability probe.
  - [x] VerifyPlan capability probe.
  - [x] FaceRecognizeMode capability probe.
  - [x] Audit'teki ana eksikler icin ek probe'lar: anti-passback, holiday, event linkage, QR, iris, NFC/RF/Wiegand, local attendance.

- [x] Response parser tipi olustur.
  - `unknown` input.
  - Boolean support flag'leri tolerant parse.
  - Ham response preview snapshot icinde saklanir.

- [x] Schema karari:
  - Secenek A: `devices.hikCapabilitiesSnapshot?: string`, `hikCapabilitiesUpdatedAt?: number`
  - Secenek B: `hikDeviceCapabilities` tablosu.
  - Secilen: A.

- [x] `convex/devices.ts`
  - [x] Internal mutation: `setHikCapabilitiesSnapshot`
  - [ ] Public/authed query: cihaz capability summary oku. Simdilik cihaz dokumani uzerinden okunuyor.

- [x] `convex/actions/hikGatewayDevice.ts`
  - [x] Action: `fetchDeviceCapabilities({ deviceId })`
  - [x] Project access guard.
  - [x] Sadece `hikTransport="gateway"` ve `hikDevIndex` dolu cihazlarda calissin.

Frontend TODO:

- [x] `DeviceHikvisionSection` icine "Ozellikleri Tara" butonu.
- [x] Capability panel:
  - Cihaz destekliyor/desteklemiyor listesi.
  - Son tarama zamani.
  - Raw diagnostic snapshot backend'de saklanir; UI simdilik ozet gosterir.
- [ ] Mevcut butonlar capability yoksa temkinli davransin:
  - Capability hic taranmadiysa "Destek bilinmiyor" uyarisi.
  - Destek false ise disabled.

Test TODO:

- [ ] Parser unit testleri:
  - Bos response.
  - `true`, `"true"`, `1` varyantlari.
  - Nested capability object varyantlari.
- [x] tsc/eslint.
  - `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
  - `node_modules/.bin/eslint src convex`

Kabul kriterleri:

- [ ] Bir gateway cihazda capability snapshot DB'ye yazilir.
- [ ] UI son tarama zamanini ve destek ozetini gosterir.
- [ ] Desteklenmeyen ozellikte aksiyon butonu yanlis umut vermeden disabled/gizli olur.

## Faz 2 - Event Katalogu ve Event/Pdks Ayrimi

Oncelik: P0.

Durum: Backend ayrimi ve cihaz formu UI paneli tamamlandi. `deviceEvents` tablosu, event katalogu, canlı `/card-reader` yönlendirmesi, AcsEvent backfill ayrimi ve "Son Cihaz Olaylari" paneli eklendi. Kalan: daha genis parser/HTTP fixture testleri.

Amac: Hikvision event kodlarini sadece grant/deny kararina indirgemek yerine alarm/status/operation olaylarini da anlamlandirmak.

Backend TODO:

- [x] `convex/lib/hikEventCatalog.ts` olustur.
  - [x] Major event type label.
  - [x] Minor event type label.
  - [x] Kategori: `access`, `alarm`, `exception`, `operation`, `status`, `unknown`.
  - [x] Severity: `info`, `warning`, `critical`.
  - [x] Access decision: `izin_verildi`, `reddedildi`, `undefined`.

- [x] `convex/lib/hikEventCodes.ts` katalogu kullanacak sekilde sadeleştir.

- [x] Yeni tablo veya mevcut tablo karari:
  - Secenek A: `cardReadings` sadece PDKS/access olaylari.
  - Secenek B: `hikEvents`/`deviceEvents` genel cihaz olaylari.
  - Secilen: `deviceEvents` ayri tablo.

- [x] `convex/schema.ts`
  - [x] `deviceEvents` tablosu:
    - `projectId`
    - `deviceId`
    - `source: "hikvision" | "ide_smart" | "system"`
    - `eventTime`
    - `major`
    - `minor`
    - `category`
    - `severity`
    - `label`
    - `rawData`
    - `createdAt`
  - [x] Indexler:
    - `by_project`
    - `by_device`
    - `by_project_and_event_time`
    - `by_device_and_event_time`
    - `by_device_and_hik_serial`

- [x] `/card-reader` akisini guncelle.
  - Access grant/deny ise `cardReadings` devam.
  - Alarm/status/operation ise `deviceEvents` kaydi.
  - Heartbeat gürültüsü kaydedilmesin veya low-volume throttle uygulansin.

- [x] AcsEvent backfill ayrimi.
  - Access olaylari `cardReadings`.
  - Access disi olaylar `deviceEvents`.
  - `hikSerialNo` dedup iki tablo icin korunur.

Frontend TODO:

- [x] Cihaz detayinda "Son Cihaz Olaylari" paneli.
- [ ] Live Monitoring veya Audit Log icinde device event filtreleri.
- [ ] Reddedilme nedenlerinde daha zengin label.

Test TODO:

- [x] `hikEventCatalog` unit test.
- [ ] `/card-reader` parser fixture testleri:
  - valid card granted.
  - no permission.
  - anti-passback failed.
  - door forced open.
  - reader tamper/offline.
- [x] tsc/eslint.
  - `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
  - `node_modules/.bin/eslint src convex`

Kabul kriterleri:

- [x] Access eventleri PDKS kaydina dusmeye devam eder.
- [x] Alarm/status eventleri PDKS kaydini kirletmez.
- [x] UI'da alarm/status olaylari okunabilir label ile gorunur.

## Faz 3 - Okuyucu Bazli Hikvision Ayarlari

Oncelik: P1.

Durum: Read-only diagnostic tamamlandi. `CardReaderCfg`, `CardReaderPlan` ve `CardReaderAntiSneakCfg` cihazdan okunup `readers` uzerinde snapshot olarak saklaniyor; kapı ağacındaki okuyucu satırından tetiklenebiliyor. Kalan: canlı cihaz shape doğrulamasından sonra yazma/apply aksiyonları.

Amac: `readers` tablosundaki okuyucu modelini gercek Hikvision `CardReaderCfg` ve `CardReaderPlan` ile baglamak.

Backend TODO:

- [x] `convex/lib/gateway/readers.ts` olustur.
  - [x] `getCardReaderCfg(devIndex, readerNo)` read-only snapshot icinde.
  - [ ] `setCardReaderCfg(devIndex, readerNo, cfg)`
  - [x] `getCardReaderPlan(devIndex, readerNo)` read-only snapshot icinde.
  - [ ] `setCardReaderPlan(devIndex, readerNo, templateNo)`
  - [x] `getCardReaderAntiSneakCfg` snapshot icinde.

- [x] `convex/readers.ts`
  - [ ] `hikReaderNo` degisiklikleri icin validasyon.
  - [x] `getByIdInternal`.
  - [x] `setHikReaderSnapshot`.
  - [x] Kapinin `hikDoorNo` degisince entry/exit okuyucu no drift fix.

- [x] `convex/actions/hikGatewayDevice.ts`
  - [x] `fetchReaderCfg({ readerId })`
  - [ ] `applyReaderCfg({ readerId })`
  - [ ] `applyReaderVerifyPlan({ readerId })`

Schema TODO:

- [x] `readers.hikVerifyMode?: string`
- [ ] `readers.hikCardReaderPlan?: { enabled, beginTime, endTime, verifyMode }` veya kapidaki `hikVerifyPlan` ile iliski karari.
- [x] `readers.hikCardReaderPlanTemplateNo?: number`
- [x] `readers.hikCardReaderAntiSneakEnabled?: boolean`
- [x] `readers.hikLastCfgSnapshot?: string`
- [x] `readers.hikLastCfgAt?: number`

Frontend TODO:

- [ ] `EditReaderDialog` icinde Hikvision bolumu:
  - Fiziksel reader no.
  - Verify mode.
  - Cihazdan oku.
  - Cihaza uygula.
- [x] Zone/Door tree reader satirinda online/status bilgisini daha acik goster.
  - [x] Fiziksel Hikvision reader no.
  - [x] Plan template no.
  - [x] Anti-passback preview.
  - [x] Cihazdan oku aksiyonu.

Test TODO:

- [x] Reader no hesaplama testleri:
  - Door 1 entry=1, exit=2.
  - Door 2 entry=3, exit=4.
- [x] Parser unit test.
- [x] tsc/eslint.

Kabul kriterleri:

- [x] UI'da reader config cihazdan okunur.
- [ ] Verify mode reader seviyesinde cihaza yazilabilir.
- [x] `hikDoorNo` degisince reader no drift olusmaz.

## Faz 4 - Anti-Passback / Anti-Sneak

Oncelik: P1.

Amac: Gecis yon disiplinini cihaz seviyesinde uygulatmak ve gerektiğinde anti-passback state resetlemek.

Backend TODO:

- [ ] `convex/lib/gateway/antiPassback.ts`
  - [ ] `getAntiSneakCfg(devIndex)`
  - [ ] `setAntiSneakCfg(devIndex, cfg)`
  - [ ] `getCardReaderAntiSneakCfg(devIndex, readerNo)`
  - [ ] `setCardReaderAntiSneakCfg(devIndex, readerNo, cfg)`
  - [ ] `clearAntiSneakCfg(devIndex)`
  - [ ] `clearAntiSneakRecords(devIndex, opts)`
  - [ ] `getAntiPassbackTimeRange(devIndex)`
  - [ ] `setAntiPassbackTimeRange(devIndex, cfg)`

Schema TODO:

- [ ] Proje veya cihaz bazli policy karari:
  - Oneri: cihaz bazli basla.
- [ ] `devices.hikAntiPassback?: { enabled, mode, timeRangeMinutes?, updatedAt }`
- [ ] Reader pair mapping:
  - `readers.direction` zaten var.
  - Ek gerekirse `readers.hikAntiPassbackGroupNo`.

Frontend TODO:

- [ ] Cihaz detayinda "Anti-passback" paneli.
- [ ] Enable/disable.
- [ ] Giriş/çıkış okuyucu eşleştirme.
- [ ] Reset records butonu.
- [ ] Reset icin confirm dialog.

Test TODO:

- [ ] Config builder testleri.
- [ ] Reset aksiyonunda yikici islem onay UI testi.

Kabul kriterleri:

- [ ] Anti-passback policy cihaza yazilir.
- [ ] Denied eventlerde anti-passback ihlali UI'da ayri gorunur.
- [ ] Admin anti-passback state resetleyebilir.

## Faz 5 - Holiday Plan Entegrasyonu

Oncelik: P1.

Amac: Sistemdeki resmi tatil/ozel gun bilgisini Hikvision user right, door status ve verify planlarina baglamak.

Backend TODO:

- [ ] `convex/lib/gateway/scheduling.ts` mevcut `setHolidayGroup`, `setHolidayPlan` helperlarini dogrula.
- [ ] `convex/lib/gateway/plans.ts`
  - [ ] `setDoorStatusHolidayGroup`
  - [ ] `setDoorStatusHolidayPlan`
  - [ ] `setVerifyHolidayGroup`
  - [ ] `setVerifyHolidayPlan`

- [ ] Access rule sync:
  - [ ] `accessRules.hikHolidayGroupNo?: number`
  - [ ] Rule -> UserRightHolidayGroup/Plan -> PlanTemplate `holidayGroupNo`.

- [ ] Door plan sync:
  - [ ] `doors.hikDoorStatusPlan.holidayMode?`
  - [ ] `doors.hikVerifyPlan.holidayVerifyMode?`

Frontend TODO:

- [ ] Access rule formuna "Tatil davranisi" ekle.
- [ ] Door edit formuna tatil gunu kapi modu/dogrulama modu ekle.
- [ ] Holidays modulu ile baglanti: hangi tatil seti bu rule'a uygulanacak?

Test TODO:

- [ ] Holiday date range -> Hikvision payload builder test.
- [ ] Template `holidayGroupNo` baglama test.

Kabul kriterleri:

- [ ] Sistemdeki tatiller bir gateway cihaza holiday group olarak yazilir.
- [ ] Access rule tatil davranisi cihazda plan template'e baglanir.
- [ ] Kapı durum/verify planlarinda tatil davranisi uygulanabilir.

## Faz 6 - FaceRecognizeMode ve Biyometri Ileri Ayarlari

Oncelik: P1/P2.

Backend TODO:

- [ ] `getFaceRecognizeMode(devIndex)`
- [ ] `setFaceRecognizeMode(devIndex, mode)`
- [ ] Capability ile destek kontrolu.
- [ ] Face anti-spoof/recognition mode alanlarini modele gore parse et.

Frontend TODO:

- [ ] Cihaz detayinda "Yuz Tanima Ayarlari" paneli.
- [ ] Mevcut mode oku.
- [ ] Desteklenen modlari dropdown ile yaz.

Test TODO:

- [ ] Capability parser.
- [ ] Mode payload builder.

Kabul kriterleri:

- [ ] Cihazdaki face recognition mode okunur.
- [ ] Desteklenen mode cihaza yazilir.

## Faz 7 - Remote Open Guvenligi ve Cok Kapi Ergonomisi

Oncelik: P1/P2.

Backend TODO:

- [ ] `remoteControlPWCfg` ve `remoteControlPWCheck` helperlari.
- [ ] `remoteOpenDoor` action'inda doorNo validasyonu:
  - `hikDoorCount` varsa 1..N.
  - Yoksa capability/door list fallback.

Frontend TODO:

- [ ] Cihaz detayinda "Kapıyı Aç" icin door selector.
- [ ] Tek kapi cihazda mevcut ergonomi korunur.
- [ ] Remote open password policy opsiyonel panel.

Kabul kriterleri:

- [ ] Çok kapılı panelde hangi kapının açılacağı UI'dan secilir.
- [ ] Gecersiz doorNo backend'de reddedilir.

## Faz 8 - AcsEvent Diagnostics

Oncelik: P2.

Backend TODO:

- [ ] `getAcsEventTotalNum(devIndex, cond)`
- [ ] `getAcsEventStorageCfg(devIndex)`
- [ ] `setAcsEventStorageCfg(devIndex, cfg)` sadece gerekirse.

Frontend TODO:

- [ ] Backfill butonu yaninda tahmini toplam event sayisi.
- [ ] Cihaz event storage/retention diagnostic paneli.

Kabul kriterleri:

- [ ] Backfill oncesi toplam event sayisi gorulur.
- [ ] Storage config okunabilir.

## Faz 9 - Alarm Subscription

Oncelik: P2.

Backend TODO:

- [ ] `createAlarmSubscription`
- [ ] `subscribeDeviceToAlarmSubscription`
- [ ] `getAlarmSubscriptionStatus`
- [ ] `unsubscribeDevice`
- [ ] `deleteAlarmSubscription`

Schema TODO:

- [ ] `hikAlarmSubscriptions` tablosu:
  - `projectId`
  - `subscriptionId`
  - `callbackUrl`
  - `status`
  - `createdAt`
  - `updatedAt`

Frontend TODO:

- [ ] Gateway ayarlarinda subscription status.
- [ ] Per-device subscribe/unsubscribe.

Kabul kriterleri:

- [ ] Gateway subscription olusturulur.
- [ ] Bir cihaz subscription'a eklenir/cikarilir.
- [ ] Query status UI'da gorulur.

## Faz 10 - Event Linkage ve Alarm IO

Oncelik: P2/P3.

Backend TODO:

- [ ] `EventCardLinkageCfg` helperlari.
- [ ] `EventCardNoList` search/list.
- [ ] `ClearEventCardLinkageCfg`.
- [ ] Event optimization config.

Schema/UI:

- [ ] Linkage rule modeli tasarlanacak.
- [ ] Yikici clear icin confirm + audit.

Kabul kriterleri:

- [ ] Basit bir event -> output/linkage rule cihaza yazilabilir.

## Faz 11 - Door Security Module ve Donanim Diagnostics

Oncelik: P2/P3.

Backend TODO:

- [ ] Secure door control unit pair/switch/status helperlari.
- [ ] Door magnetic definite rule helperlari.
- [ ] Door OpenDoorParams helperlari.
- [ ] Lock/powered-off status helperlari.

Frontend TODO:

- [ ] Kapı donanim tanilama paneli.
- [ ] Manyetik kontak, kilit, guc kesilince davranis, security module status.

Kabul kriterleri:

- [ ] Montaj/servis icin kapi donanim durumu tek panelden okunur.

## Faz 12 - Bulk Async Import

Oncelik: P2.

Backend TODO:

- [ ] `UserInfo/asyncImportDatasTasks`.
- [ ] `UserPic/asyncImportDatasTasks`.
- [ ] Task status polling.
- [ ] Queue ile idempotent bulk sync.

Frontend TODO:

- [ ] Toplu push progress.
- [ ] Hata raporu indir/goruntule.

Kabul kriterleri:

- [ ] 500+ kisi senaryosunda tekil push'a gore daha hizli bulk sync.
- [ ] Hata satirlari kullaniciya raporlanir.

## Faz 13 - Local Attendance

Oncelik: P3.

Not: Mevcut PDKS mantigi Convex tarafinda. Bu faz sadece offline cihaz-ici attendance istenirse acilmali.

Backend TODO:

- [ ] `LocalAttendance/rule` get/set.
- [ ] `LocalAttendance/weekPlan` get/set.

Frontend TODO:

- [ ] Cihaz-ici attendance ayarlari paneli.

Kabul kriterleri:

- [ ] Cihaz lokal attendance kuralini okuyup yazabiliyoruz.

## Faz 14 - Kimlik Kanallari: QR/NFC/RF/M1/Wiegand/Iris

Oncelik: P3, talep bazli.

QR TODO:

- [ ] Hikvision `QRCodeInfo`, `QRCodeEvent`, `QRCodeEncryption` capability.
- [ ] QR credential modeli.
- [ ] QR event parse.

Iris TODO:

- [ ] `IrisInfo` search/count/record/modify/delete/setup.
- [ ] `captureIrisData` + progress.

NFC/RF/M1/Wiegand TODO:

- [ ] `NFCCfg`
- [ ] `RFCardCfg`
- [ ] `M1CardEncryptCfg`
- [ ] `WiegandCfg`
- [ ] `WiegandRuleCfg`

Kabul kriterleri:

- [ ] Her kanal icin once capability, sonra minimal read/write, sonra UI.

## Backlog Disi / Simdilik Yapma

- Video live view/playback/two-way audio.
- Elevator control.
- Video intercom call service.
- SecurityCP zone alarm paneli.
- Online firmware upgrade.

Bunlar dokumanlarda var ama ngsaccess'in mevcut PDKS/erisim urun hedefinden ayri moduller.

## Onerilen Ilk Sprint

Sprint 1 hedefi: guvenilir temel.

1. Faz 1 Capability Snapshot.
2. Faz 2 Event Katalogu.
3. Faz 3 Reader config icin sadece read-only `getCardReaderCfg` + UI diagnostic.

Sprint 1 sonunda kullanici sunlari gorebilmeli:

- Cihaz hangi Hikvision ozelliklerini destekliyor?
- Gelen event PDKS mi, alarm mi, cihaz status mu?
- Fiziksel okuyucular cihazda nasil gorunuyor?

Bu temel olmadan anti-passback, holiday veya bulk import'a gecmek sahada gereksiz hata uretir.
