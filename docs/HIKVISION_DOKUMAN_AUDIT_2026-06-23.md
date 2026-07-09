# Hikvision Dokuman Audit - Gateway + ISAPI Bosluk Analizi

Tarih: 2026-06-23

Kapsam:
- `/Users/emreaydin/Downloads/Hik DeviceGateway(V1.8.0.4Build20250227)_Linux64_EN/`
- `/Users/emreaydin/Downloads/ISAPI_Controllers_Value Series/`
- `/Users/emreaydin/Downloads/ISAPI_FingerPrint Terminals_Pro Series/`
- `/Users/emreaydin/Downloads/ISAPI_Face Recognition Terminals_Value Series/`

Karsilastirilan yazilim kapsami:
- Gateway client: `convex/lib/gateway/*`
- Gateway action'lari: `convex/actions/hikGatewayDevice.ts`, `convex/actions/hikvisionSync.ts`, `convex/actions/hikQueueWorker.ts`
- HTTP event girisi: `convex/http.ts`, `convex/lib/cardReaderParse.ts`, `convex/lib/hikEventCodes.ts`
- Veri modeli: `convex/schema.ts`
- UI: `DeviceHikvisionSection`, `EditDoorDialog`, access-control okuyucu/kapi ekranlari

## Kisa Sonuc

Sistemde Hikvision icin temel PDKS/erisim akisi iyi durumda:

- Gateway'e cihaz ekleme/silme/listeleme, online/offline heartbeat.
- Person, card, face, fingerprint yazma/silme ve kismi arama/reconcile.
- Access rule -> week plan -> plan template -> person RightPlan zinciri.
- Remote door open, reboot, device time set.
- AcsEvent backfill ve `/card-reader` canli event parse.
- DoorStatusPlan ve VerifyPlan icin basit tek zaman araligi.
- AcsWorkStatus icin kismi status kaydi.
- LocalBridge icin offline operation queue/claim/ack modeli.

Dokumanlarda olup bizde eksik/kismi kalan ana alanlar:

1. Capability discovery ve model bazli destek matrisi yok.
2. Alarm subscription / gateway event subscription yonetimi yok; sadece device `httpHosts` forwarding kullaniyoruz.
3. CardReaderCfg, CardReaderPlan ve okuyucu bazli authentication/anti-passback ayarlari yok.
4. Anti-passback / anti-sneak policy ve reset akislari yok.
5. Holiday planlari backend helper olarak kismi var, UI/model/sync akisi yok.
6. FaceRecognizeMode, QR, NFC, RF/M1, Wiegand, iris gibi kimlik dogrulama kanallari yok.
7. Event-card linkage, alarm output/input, clear/reset ve event optimization yok.
8. AcsCfg, door security module, lock/open-door parametreleri ve gelismis kapi parametreleri yok.
9. Local Attendance cihaz-ici PDKS kurallari yok.
10. Bulk/async import task'leri yok; mevcut sync kisi/kart bazli.
11. Video intercom/elevator/security panel alanlari kapsam disi.

## Mevcut Kapsam Matrisi

| Dokuman alani | Sistemde durum | Kod referansi | Not |
|---|---:|---|---|
| Gateway auth + passthrough | Var | `convex/lib/gateway/core.ts` | Digest auth + `devIndex` query passthrough. |
| Device add/delete/list | Var | `convex/lib/gateway/devices.ts` | `addDevice`, `delDevice`, `deviceList`. |
| Gateway ping | Var | `pingGateway` | `/ISAPI/System/deviceInfo`. |
| Device time set | Var | `setDeviceTime` | Manuel TR local time push; NTP server/client detaylari yok. |
| Reboot | Var | `rebootDeviceOnGateway` | Gateway transport UI'da var. |
| HTTP host forwarding | Var | `setHttpHostForwarding` | `/ISAPI/Event/notification/httpHosts`; subscription alternatifi yok. |
| Alarm subscription | Yok | - | Gateway docs 5.5 `subscribeDeviceMgmt` ailesi. |
| Person add/update/delete/search/count | Kismi/var | `persons.ts` | `Record`, `SetUp`, `Search`, `Count`, `Delete`; `Modify` yok ama `SetUp` kullaniliyor. |
| Card add/update/delete/search/count | Var | `cards.ts` | `CardInfo/SetUp` yok. |
| Face add/delete/search/count | Kismi/var | `biometrics.ts` | FDLib add/delete/search var; face recognize mode yok. |
| Fingerprint capture/add/delete/search/count | Kismi/var | `biometrics.ts` | `FingerPrintModify` yok; `CaptureFingerPrint/capabilities` yok. |
| Door remote control | Var | `remoteOpenDoor` | UI sadece doorNo=1 yolluyor; cok kapi secimi zayif. |
| Door param | Kismi | `setDoorParam` | `openDuration`, magnetic alarm, timeout; dokumandaki lock/open-door/security module detaylari yok. |
| AcsWorkStatus | Kismi | `getAcsWorkStatus` | Door/magnetic/card-reader/power kismi parse. |
| User permission week/template | Var | `scheduling.ts` | 7 gun x 8 segment destekli. |
| User holiday schedule | Helper var, urun akisi yok | `setHolidayGroup`, `setHolidayPlan` | Schema/UI/access rule sync'e bagli degil. |
| DoorStatus plan | Kismi/var | `plans.ts`, `EditDoorDialog` | Tek aralik UI; holiday yok. |
| Verify plan | Kismi/var | `plans.ts`, `EditDoorDialog` | Tek aralik UI; `linkVerifyPlan` path'i canli cihazla teyit bekliyor. |
| AcsEvent search/backfill | Var | `events.ts`, `backfillDeviceEvents` | Total number endpoint yok; storage cfg yok. |
| Event code mapping | Kismi | `hikEventCodes.ts` | Sadece grant/deny icin sinirli minor set. |
| Card reader management | Yok/kismi model | `readers` tablosu gorsel | ISAPI `CardReaderCfg`, `CardReaderPlan`, reader verify mode yazilmiyor. |
| Anti-passback | Yok | - | Sadece event denial reason'da `10` taniniyor. |
| Multi-card / multi-factor | Yok | - | UI'daki verify modes sinirli; `MultiCardCfg` yok. |
| QR access | Yok | - | App icinde QR componentleri var ama Hikvision `QRCodeInfo/QRCodeEvent` entegrasyonu degil. |
| Iris | Yok | - | `IrisInfo` ailesi yok. |
| NFC/RF/M1/Wiegand | Yok | - | `NFCCfg`, `RFCardCfg`, `M1CardEncryptCfg`, `WiegandCfg` yok. |
| Local attendance | Yok | - | `LocalAttendance/rule`, `weekPlan` yok. |
| Async import | Yok | - | `UserInfo/asyncImportDatasTasks`, `UserPic/asyncImportDatasTasks` yok. |

## Oncelikli Bosluklar

### P0 - Canli dogrulama ve guvenilirlik

1. Capability discovery
   - Dokumanlarda neredeyse her ozellik once `/ISAPI/AccessControl/capabilities` veya ozellik-spesifik `.../capabilities` ile kontrol ediliyor.
   - Bizde varsayimla endpoint cagiriyoruz.
   - Eksik model: `devices.hikCapabilities` veya ayri `hikDeviceCapabilities` tablosu.
   - Etki: desteklemeyen modelde sessiz hata, yanlis UI aksiyonu, firmware farklarinda parse bos doner.
   - Oneri:
     - `fetchHikCapabilities(deviceId)` action.
     - AccessControl, Door, CardReader, FingerPrint, CaptureCard, Face, DoorStatus, Verify, AcsEvent capability subset parse.
     - UI'da butonlari capability'ye gore goster/disable et.

2. VerifyPlan path ve response shape canli teyidi
   - Kodda `linkVerifyPlan` icin dokumandan net olmayan path tahmini var.
   - `docs/HIK_ISAPI_HANDOFF.md` zaten bunu VERIFY olarak isaretlemis.
   - Oneri: Gateway cihaz online olur olmaz runbook ile `applyVerifyPlan` test et.

3. Event code kapsam genisletme
   - Dokuman `Access Control Event Types and Event Linkage Types.pdf` cok daha genis minor event listesi veriyor.
   - Biz sadece temel grant/deny setini tanimliyoruz.
   - Eksik durumlar: door held open, forced open, tamper, reader offline/online, anti-passback reset, remote open, duress, blacklist, local attendance durumlari.
   - Oneri:
     - `hikEventCatalog.ts` ile major/minor -> kategori, severity, label.
     - `cardReadings` disinda `hikEvents` veya `deviceEvents` tablosu dusun.
     - Access granted/denied PDKS kaydi ile cihaz alarm/status event'lerini ayir.

### P1 - PDKS/erisim urun degeri yuksek eksikler

4. CardReaderCfg ve okuyucu bazli dogrulama
   - Dokuman: `/ISAPI/AccessControl/CardReaderCfg/<ID>`, `CardReaderPlan/<cardReaderID>`.
   - Bizde `readers` tablosu var ama Hikvision'a reader config yazilmiyor.
   - Eksik ozellikler:
     - reader verify mode.
     - reader online/status ayrimi.
     - fingerprint capacity/current count icin reader cfg.
     - entry/exit okuyucu fiziksel mapping dogrulama.
   - Oneri:
     - `readers.hikReaderNo` zorunlulastirma/gorsel dogrulama.
     - `setCardReaderCfg`, `getCardReaderCfg`, `setCardReaderPlan`.
     - `EditReaderDialog` icine Hikvision bolumu.

5. Anti-passback / anti-sneak
   - Dokuman: `AntiSneakCfg`, `CardReaderAntiSneakCfg`, `ClearAntiSneakCfg`, `ClearAntiSneak`, `AntiPassback/timeRange`.
   - Bizde yalniz event denial reason olarak `Anti-passback ihlali` var; politika yazma yok.
   - Gerekli model:
     - Proje/cihaz/okuyucu bazli anti-passback mode.
     - Soft/hard davranis, time window, reader pair mapping.
     - Admin "anti-passback kayitlarini temizle" aksiyonu.
   - Oneri: PDKS icin P1, cunku giris-cikis disiplinini dogrudan etkiler.

6. Holiday plan entegrasyonu
   - Helper var ama product flow yok.
   - Dokuman: user right holiday group/plan, door status holiday group/plan, verify holiday group/plan.
   - Bizim `holidays` modulu var; Hikvision planlarina baglanmiyor.
   - Oneri:
     - `holidays` -> Hik holiday group generator.
     - Access rule template'e `holidayGroupNo`.
     - DoorStatus/Verify planlara holiday group baglama.

7. FaceRecognizeMode
   - Dokuman: `/ISAPI/AccessControl/FaceRecognizeMode`.
   - Biz yuz kaydi push ediyoruz ama cihazdaki face recognition mode'u yonetmiyoruz.
   - Eksik ayarlar modele gore "normal/deep", spoofing/recognition parametreleri olabilir.
   - Oneri: once capability GET + current GET, sonra UI'da ileri ayar.

8. Remote control password
   - Dokuman: `remoteControlPWCfg`, `remoteControlPWCheck`.
   - Biz remote open'u dogrudan yolluyoruz.
   - Oneri: fiziksel guvenlik icin opsiyonel remote-open password policy.

9. AcsEvent storage config ve total number
   - Dokuman: `AcsEvent/StorageCfg`, `AcsEventTotalNum`.
   - Biz event search/backfill yapiyoruz ama cihazdaki event storage policy veya total count yok.
   - Oneri: backfill oncesi toplam tahmini, retention/storage config UI'da "diagnostic" olarak.

### P2 - Operasyonel ve ileri seviye eksikler

10. Alarm subscription
    - Gateway dokumani 5.5: `subscribeDeviceMgmt`, per-device subscribe/unsubscribe/queryStatus.
    - Biz `httpHosts` forwarding kullaniyoruz.
    - Artisi: subscription status sorgulanabilir, gateway tarafindan daha merkezi event yonetimi.
    - Eksisi: mevcut `/card-reader` akisi calisiyorsa hemen sart degil.

11. Event-card linkage / alarm output
    - Dokuman: `EventCardLinkageCfg`, `EventCardNoList`, `ClearEventCardLinkageCfg`, event optimization.
    - Kullanilabilecek senaryo: belirli kart/event -> relay/alarm/audio/linkage.
    - Bizde yok; PDKS core icin P2.

12. Door security module ve lock/open-door parametreleri
    - Dokuman: secure door control unit pairing/switch/status, lock powered-off status, door magnetic definite rule, `Door/OpenDoorParams`.
    - Bizde yalniz `Door/param/<doorID>` kismi var.
    - Oneri: saha montaj sorunlarini azaltmak icin "Kapı Donanım Tanılama" ekrani.

13. Bulk async import
    - Dokuman: `UserInfo/asyncImportDatasTasks`, `UserPic/asyncImportDatasTasks`.
    - Biz kisi/kart/yuz sync'i tekil operasyonlarla yapiyoruz.
    - Cihaz basina yuzlerce/binlerce kisi push edilecekse performans icin degerli.
    - Oneri: once mevcut queue metrikleriyle gercek ihtiyaci olc.

14. Local Attendance
    - Dokuman: `LocalAttendance/rule`, `LocalAttendance/weekPlan`.
    - Biz PDKS mantigini Convex tarafinda tutuyoruz.
    - Cihaz offline iken lokal PDKS raporu istenirse gerekli olabilir; bugun ana mimari icin P2/P3.

### P3 - Simdilik kapsam disi ya da ayri urun karari

15. QR/NFC/RF/M1/Wiegand/Iris
    - Dokumanlarda endpoint aileleri var.
    - Sistemde QR UI componentleri var ama Hikvision QR credential degil.
    - Iris hic yok.
    - Wiegand bugun sadece okuyucu numarasi yorumunda geciyor; cihaz Wiegand config yok.
    - Bunlar cihaz modeli ve musteri talebine gore secilmeli.

16. Video intercom, elevator, SecurityCP, video/audio/live view/playback
    - Face terminal dokumaninda genis yer kapliyor.
    - NGS Access'in mevcut PDKS/erisim hedefinden ayri moduller.
    - Acil backlog'a alinmamali.

## Uygulama Backlog Onerisi

### Faz A - Capability ve event katalogu

Backend:
- `convex/lib/gateway/capabilities.ts`
  - `getAccessControlCapabilities`
  - `getCardReaderCapabilities`
  - `getAcsEventCapabilities`
  - `getDoorCapabilities` mevcut fonksiyonun genisletilmesi
- Schema:
  - `devices.hikCapabilitiesSnapshot?: string`
  - `devices.hikCapabilitiesUpdatedAt?: number`
  - veya ayri `hikDeviceCapabilities` tablosu
- UI:
  - Cihaz detayinda "Desteklenen Ozellikler" paneli.
  - Desteklenmeyen butonlar gizlenir veya acik gerekceyle disabled.

Test:
- Helper parser unit testleri.
- Online gateway cihaz gelince canli smoke.

### Faz B - Okuyucu bazli ayarlar

Backend:
- `getCardReaderCfg`, `setCardReaderCfg`
- `setCardReaderPlan`
- `readers.hikReaderNo` drift fix: `hikDoorNo` degisince reader no yeniden hesaplama.

UI:
- `EditReaderDialog` icinde:
  - fiziksel reader no
  - dogrulama modu
  - online/status gostergesi

Risk:
- Mevcut permission modeli kapi bazli; okuyucu bazli mode ile kapi bazli access rule'u karistirmamak gerekir.

### Faz C - Anti-passback

Backend:
- `get/setAntiSneakCfg`
- `get/setCardReaderAntiSneakCfg`
- `clearAntiSneakRecords`
- `get/setAntiPassbackTimeRange`

Schema/UI:
- Cihaz veya proje bazli anti-passback ayari.
- Reader pair mapping: giris okuyucu, cikis okuyucu.
- Admin action: anti-passback state reset.

### Faz D - Holiday planlar

Backend:
- `holidays` -> UserRightHolidayGroup/Plan sync.
- DoorStatusHolidayGroup/Plan ve VerifyHolidayGroup/Plan helper'lari.

UI:
- Access rule icinde holiday davranisi.
- Door edit icinde tatil gunu kapi modu/dogrulama modu.

### Faz E - Bulk import ve diagnostics

Backend:
- async import task runner.
- AcsEventTotalNum + StorageCfg diagnostics.

UI:
- "Cihaz kapasite ve kuyruk sagligi" paneli.
- Bulk sync progress.

## Dikkat Edilecek Teknik Noktalar

- `any` kullanma. Unknown response parser'lari type guard ile yazilmali.
- Convex action'larda DB'ye dogrudan erisim yok; query/mutation ile bol.
- Gateway passthrough endpointleri firmware/model farklarinda farkli wrap key donduruyor; parser toleransli olmali.
- Capability olmadan UI aksiyonu sunma.
- LocalBridge ile Gateway operasyonlari ayrilmali; bugun bircok yeni action yalniz gateway guard'li.
- `filter(Boolean)` kullanma; Convex `Doc | null` array'lerinde typed predicate kullan.
- Yikici operasyonlar (clear/delete/reset) UI'da explicit confirmation ve audit log gerektirir.

## Hemen Yapilacak En Mantikli Ilk Is

Ilk implementasyon icin onerim:

1. Capability snapshot action + UI panel.
2. Event code katalogunu genisletip alarm/status event'lerini PDKS kart okumasindan ayirmak.
3. Reader config/verify plan tarafini capability'ye baglamak.

Bunlar tamamlanmadan anti-passback veya holiday planlarina gecmek riskli; cunku hangi modelin hangi endpointi destekledigini bilmeden policy yazmak sahada "badParameters" ve sessiz drift uretir.

