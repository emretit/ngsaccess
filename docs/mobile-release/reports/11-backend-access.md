# 11 — Mobil erişim backend teslimi

19 Ekim 2026. Kapsam: MOB-05/06/07/09 backend uygulaması. Yayın varsayılanında Hik gateway uzaktan açma desteklenir; IDE, doğrulanmış izolasyon dağıtımı açıkça onaylanana kadar kapalıdır; localBridge tüketici uyumsuzluğu nedeniyle kapalıdır. Önceden kirli web/Convex değişiklikleri korundu; commit, push, deployment, üretim mutation, fiziksel kapı komutu ve mağaza gönderimi yapılmadı. Flutter/Dart SDK komutları çalıştırılmadı.

## Uygulanan davranış

- `cardReadings:selfCheckIn` eski argümanlarını kabul eder fakat daima `{granted:false,code:"READER_REQUIRED",error}` döndürür; cihaz sorgulamaz, hareket/yön/yoklama yazmaz. Statik ID veya seri fiziksel bulunma kanıtı sayılmaz.
- `mobileAccess:listTargets` ve uyumlu `devices:listForEmployee` aynı ortak değerlendiriciyi kullanır. Employee/session kimliği sunucuda çözülür; proje mevcut ve aynı olmalıdır. Kural/üyelik/cihaz/kapı bağları proje açısından tekrar doğrulanır. Orphan ve bozuk kapı bağları kapalı karar verir. `groupDoors` tek başına keşfedilir; kapı kısıtı aynı panelin bütün aktüatörlerine genişlemez. Açık blanket `groupDevices` bağından yalnız tekil, geçerli aktüatör hedefleri üretilir. Yanlış/çift aktüatör, eksik çoklu kapı seçimi ve desteklenmeyen taşıma engellenir.
- Çalışan/cihaz/proje/pasif kapı, erişim başlangıç/bitiş epoch'u ve aktif kural gün/saat politikası uygulanır. Program `[start,end)` ve `Europe/Istanbul` kullanır. Mevcut yazma validator'ıyla tutarlı olarak bozuk veya geceyi aşan legacy program reddedilir; gece programı varsayımla genişletilmez.
- `requestOpen` aynı transaction içinde employee/requestId/cihaz/kapı bağını ve gerçek komut kuyruğunu oluşturur. Aynı employee/requestId tekrarında güncel önceki sonuç döner; hedef değiştirilirse `REQUEST_TARGET_MISMATCH`; hiçbir tekrar eski işi yeniden kuyruğa almaz. Ayrı yeni requestId ayrı kullanıcı niyetidir.
- IDE MQTT kod yolu: `openDoor {dstId,ioId,keep:1,mobileOperationId}` gerçek mevcut kuyruğa yazılır. Production poll sınırlı 50 kayıt üzerinden geçersiz mobil işleri kalıcı failed yapar, sonra döndürülen mobil işi transaction içinde rezerve eder. Eşzamanlı poll aynı mobil işi alamaz. Mevcut bridge'in publish öncesi `markSent` çağrısı aktüel yetkiyi yeniden denetler; yinelenen çağrı hata döndürerek publish'i engeller. ACK yalnız markSent ile kaydedilmiş exact msxId eşleşmesiyle kabul edilir; poll-only rezervasyonu veya eksik/yanlış korelasyon confirmed üretmez. Mobil işlerde timeout/manuel retry kapalıdır. `MOBILE_IDE_ISOLATION_VERIFIED` ortam bayrağı tam `"true"` olmadıkça discovery/dispatch unsupported olur; bayrak yalnız per-panel kimlik/ACL/TLS/firmware doğrulanmış dağıtım için operatör onayıdır, kendisi donanım doğrulaması yapmaz. Gerçek ortam değeri değiştirilmedi.
- Hik localBridge **mobilde desteklenmiyor**: repository Windows tüketicisi kaldırılmış roster/roster-ack uçlarını kullanıyor; mevcut poll protokolüne uyumlu tüketici kanıtlanamadı. `listTargets` canOpen=false/TRANSPORT_UNSUPPORTED döndürür; `requestOpen` komut kuyruğu yazmadan reddeder. Mevcut kuyruktaki mobil marker guard'ları (claim policy, stale/failed/manual retry ve provisioning revive engeli) savunma olarak uygulandı; bir localBridge teslimat başarısı iddia edilmez.
- Hik gateway: Node runtime'da yalnız private scheduled action çalışır. Önce atomic claim ve sahip/session/policy kontrolü commit edilir; sonra mevcut gateway transportuna bir gönderim yapılır. Aynı action tekrarında gönderim olmaz. JSON protokol ACK'i doğrulanır; belirsiz, negatif veya kayıp sonuç `unknown`, otomatik retry yoktur. Mevcut admin action yetkisi employee'ye açılmadı.
- Her komut 30 saniyelik gönderim ömrüne sahiptir. Dispatch sırasında exact originating sessionId, oturum bitişi, logout/silme, parola sürümü, aktif çalışan/proje/kapı/kural/saat/epoch ve aktüatör tekrar denetlenir. Scheduled `expireQueue`, hiç claim edilmemiş işleri köprü offline olsa da terminal failed yapar. Gönderimi başlanmış iş timeout sonrası `unknown` olur; aynı ID ile dirilmez.
- İşlem sorguları yalnız kendi employee/projesini açar. `getRequestOperation` ilk yanıt kaybolduğunda yeni komut göndermeden requestId ile uzlaşma sağlar.
- QR tokenları `purpose:"reader"`, originating sessionId, proje ve parola sürümü snapshot'ı ile 60 saniye için üretilir. `getMyCheckInTokenStatus` yalnız kendi tokenı için active/consumed/expired döndürür. Kullanılmamış token public `checkInWithToken` yolundan fiziksel kanıtsız grant/yoklama üretemez; tamamlanmış eski sonuç yalnız kayıtlı snapshot'tan replay edilir.
- Generic UUID tüketimi yalnız authenticated device kimliği (`authedDeviceId`) ile, generic transportta, geçerli issuing session (mevcut/owner/expiry/parola sürümü), proje/çalışan/cihaz/program/epoch/parola sürümü ve tek hedef politikasıyla mümkündür. Tüketim ve tek granted reading atomiktir. Ret tokenı tüketmez ve yeni grant yazmaz. IDE/Hik UUID'leri native kart numarasına yanlış eşlenmez. Telefon için mevcut olmayan challenge protokolü icat edilmedi.
- Mobil geçmiş enrichment'ı employee/reading/device proje tutarlılığını doğrular; bozuk foreign employee/reading ilişkisi dışarı çıkarılmaz ve yabancı cihaz metadata'sı döndürülmez.

## API sözleşmesi

Employee uçları `sessionToken:string` ister; caller employeeId gönderemez.

`mobileAccess:listTargets({sessionToken})` → array:

```ts
{
  _id: Id<"devices">, deviceId: Id<"devices">,
  doorId?: Id<"doors">, targetId: string,
  name: string, deviceSerial: string | null, deviceType: string | null,
  zoneName: string | null, doorName: string | null,
  transport: "ide_mqtt" | "hik_local_bridge" | "hik_gateway" | "unsupported",
  canOpen: boolean, reason: string | null,
  supportsReaderToken: boolean, actuator: number | null
}
```

`targetId` opaque tercih anahtarıdır (`deviceId:doorId` veya `deviceId:standalone`), Convex Id değildir. `supportsReaderToken` IDE/Hik için false; generic okuyucu için true. Unsupported transport mobil uzaktan açma sağlamaz; localBridge uyumlu tüketici eksikliği, IDE ise izolasyon onayı eksikliği halinde bu gruptadır. Aktüatör eksik/bozuksa null ve canOpen=false olur; IDE ilk kapı IO=0, Hik ilk kapı numarası=1'dir. Reason kodları: DEVICE_INACTIVE, DOOR_INACTIVE, ACCESS_EPOCH_DENIED, SCHEDULE_DENIED, TARGET_UNSUPPORTED, TRANSPORT_UNSUPPORTED. Yetkisi kaldırılan/yabancı hedef listeden çıkar. 500'ü aşan grafik güvenli `ACCESS_GRAPH_LIMIT` hatası verir.

`mobileAccess:requestOpen({sessionToken,requestId,deviceId,doorId?})`, `getOperation({sessionToken,operationId})`, `getRequestOperation({sessionToken,requestId})`:

```ts
{
  operationId: string,
  status: "pending" | "sent" | "confirmed" | "failed" | "unknown",
  deviceId: Id<"devices">, doorId?: Id<"doors">,
  deviceName: string, requestedAt: string, errorCode?: string
}
```

`requestedAt` canonical UTC ISO string'dir. `requestId` 16–128 karakter, A–Z/a–z/0–9/alt çizgi/tire; UUID uygundur. `getOperation` yoksa/yabancıysa `OPERATION_NOT_FOUND` structured hata verir; `getRequestOperation` bulunamadığında null döndürür. İşlem errorCode: COMMAND_OUTCOME_UNKNOWN, COMMAND_EXPIRED, COMMAND_FAILED, TARGET_NOT_ALLOWED. Diğer structured iş hataları: INVALID_REQUEST_ID, REQUEST_TARGET_MISMATCH, TARGET_NOT_ALLOWED, DOOR_REQUIRED, ACCESS_GRAPH_LIMIT ve target reason kodları; standart SESSION_* auth kodları korunur.

`confirmed` cihaz komut ACK'idir; fiziksel kapı sensörü veya gerçekleşmiş personel geçişi değildir. Mobil açma işlemi hiçbir aşamada cardReading üretmez. `sent` kuyruğun dispatch girişimini/rezerve edilmiş teslimini gösterir; ACK yoksa fiziksel açılma sonucu bilinmez.

`employeeCheckIn:createMyCheckInToken({sessionToken})` → `{token,expiresAt,serverTime,purpose:"reader"}`. `getMyCheckInTokenStatus({sessionToken,token})` → `{status:"active"|"consumed"|"expired",expiresAt,serverTime}`. Tarihler UTC ISO string'dir; TTL 60 saniyedir. Token değerleri rapora/loga taşınmaz.

## Şema ve sahiplik

09 sahibi tarafından eklenen `mobileAccessOperations` tablosu employee/requestId index'i, hedef/transport/aktüatör, operation state, originating sessionId/authVersion ve gerçek komut foreign key'lerini tutar. `checkInTokens` için optional purpose/projectId/authVersion/sessionId alanları widen uyumluluğu sağlar; eski kullanılmamış amaçsız tokenlar artık yeni grant üretemez, 60 saniyelik token yenilemesi gerekir. İlk şema09 sahibi tarafından eklendi; bağımsız inceleme sonrası coordinator dar yetkiyle bu workera yalnız checkInTokens.sessionId optional alanını ekleme sahipliği verdi ve bu tek alan eklendi. Auth sahibinin işi sonlandıktan sonra coordinator onayıyla `employeeAuth.mobile.test.ts` fixture'ına yalnız verified isolation ortam konfigürasyonu ve simetrik unstub eklendi; gerçek auth/session guard'ları korunur. Generated API dosyaları değiştirilmedi; coordinator codegen'i yürütür. Yeni dependency yoktur.

Değiştirilen kaynaklar:

- Yeni `convex/mobileAccess.ts`, `convex/mobileAccessGateway.ts`, `convex/lib/mobileAccess.ts`.
- `convex/cardReadings.ts`: yalnız generic UUID karar kolu, IDE/Hik UUID ayrımı ve employee selfCheckIn. Dosyadaki önceden mevcut diğer değişiklikler korundu.
- `convex/devices.ts`: yalnız employee list alias'ı.
- `convex/employeeCheckIn.ts`, `convex/lib/cardReadingAudit.ts`: yalnız mobile enrichment tenant savunması.
- Sonradan açık scope onayıyla `convex/ideSync.ts`, `convex/hikvisionSync.ts`: yalnız mobile marker queue güvenliği; `convex/http.ts`: yalnız IDE poll runQuery→runMutation satırı.
- `convex/employeeAuth.mobile.test.ts`: dar onayla yalnız fixture verified isolation env ve afterEach unstub.
- Testler: yeni `convex/mobileAccess.handlers.test.ts`, `convex/mobileAccessGateway.test.ts`; onayla güncellenen `convex/employeeCheckIn.test.ts`.
- `convex/schema.ts`: sonradan dar onayla yalnız checkInTokens.sessionId optional alanı.
- Bu rapor.

## Audit kapanış kapsamı

| İş / bulgu | Backend teslimi |
|---|---|
| MOB-05; DEV-F02/F03/F05; NET-F03/F04; QR-F10; HOME-F09 | Aynı proje + aktiflik + zaman/epoch + kapı grafiği + metadata savunması uygulandı ve gerçek wrapper testleriyle doğrulandı. |
| MOB-06; HOME-F01; DEV-F04; NET-F02; QR-F02/F06; PROFILE-F05 | Sahte yoklama yolu kapatıldı; gerçek IDE queue/Hik gateway komut yolu; localBridge güvenli unsupported kapısı ve ayrı operation DTO eklendi. Fiziksel panel sonucu açık QA kapısıdır. |
| MOB-07; QR-F03/F05; NET-F05 | Public kanıtsız tüketim kapandı; reader purpose/aktiflik/tenant/zaman/parola sürümü/tek tüketim ve own status uygulandı. Yeni telefon reader challenge capability'si teslim edilmedi. |
| MOB-09; HOME-F02; QR-F04 | Backend tek request/tek command, target binding, own result reconciliation, TTL, no-resurrection uygulandı. Mobil busy/persistence/scanner kilitleri ilgili mobil sahiplerinin kapsamıdır. |

Bunlar backend alt işi kapanışlarıdır; tüm ekran/hardware kabul matrisi bu raporla tamamlandı sayılmaz.

## Kontroller ve kanıt

- Yeni/değişen regression senaryoları gerçek `convex-test`, employee auth helper/wrapper'ları ve in-memory transaction DB üzerinden çalışır; auth guard mock'lanmaz. Gateway dış I/O yalnız sentetik ACK/negatif/timeout boundary'sinde mock'lanır, gerçek panel komutu gönderilmez.
- Son scoped komut: `node_modules/.bin/vitest run convex/mobileAccess.handlers.test.ts convex/mobileAccessGateway.test.ts convex/employeeCheckIn.test.ts convex/ideSync.test.ts convex/lib/cardReadingProcess.test.ts` → **5 dosya, 79 test geçti**. Yeni access/token/gateway vakaları 54; mevcut fiziksel helper golden testleri 25.
- Son ek entegrasyon koşusu yukarıdaki 5 dosyaya `convex/employeeAuth.mobile.test.ts` eklenerek çalıştırıldı: **6 dosya, 110 test geçti**; actual parola değişimi/setup/logout→eski kuyruk iptali→re-login→yeni izinli komut akışı korunur.
- Kapsam: A/B metadata yokluğu, orphan/bozuk ilişki, groupDoors-only ve kapı daraltma, pasif/saat dışı/legacy gece programı, `[start,end)` Istanbul, aynı ID ile on eşzamanlı istek/tek kuyruk/no readings, farklı hedef reuse reddi, IDOR, logout/parola değişimi sonrası dispatch reddi, generic public tüketim reddi, pasifleştirme sonrası ilk okuyucu tüketimi, tek tüketim, own status ve legacy completed snapshot replay.
- Queue/gateway vakaları: ACK fiziksel reading üretmez, timeout unknown, same-ID replay no requeue, localBridge unsupported/no queue, bounded revoked window cleanup, concurrent poll tek rezervasyon, exact ACK correlation, IDE varsayılan kapalı/yanlış flag değerleri/dispatch öncesi flag iptali, mixed valid/null actuator DTO, real logout reader token revocation, scheduled unclaimed expiry, gateway bir dispatch/ACK/negatif/timeout/logout/duplicate claim.
- Scoped TypeScript config yalnız bu worker kaynak/test girişlerini kapsar ve gerçek generated dependency graph'ını okur: `tsc --noEmit -p /tmp/ngs-mobile-access-tsconfig.json` **geçti, hata 0**. Scoped ESLint değişen kaynak/test/schema dosyalarında **geçti, error/warning 0**. Geniş uygulama TS/lint/backend suite ile Flutter/native kontrolleri koordinatörde kalır.
- Gateway ACK ayrımında mevcut checked transport parser'ı kullanıldı. [Hikvision resmi DEVICE_RESPONSE_STATUS referansı](https://open.hikvision.com/hardware/XMLs/DEVICE_RESPONSE_STATUS.html) komut sonucunun ayrı statusCode/statusString taşıdığını doğrular; HTTP 200 tek başına fiziksel geçiş kanıtı sayılmaz.

## Açık yayın engelleri / sınırlar

1. Gerçek IDE MQTT bridge/panel ve Hik gateway firmware/model matrisi, offline/ACK loss/fiziksel sensör ve Android/iOS kapı E2E testi yapılmadı. Backend transaction düzeyinde tek command garanti edilir; MQTT QoS1/firmware seviyesinde fiziksel exactly-once varsayımı yapılmaz.
2. Repository MQTT ACL paylaşılan device kullanıcısına bütün subscribe/publish konularını açıyor; başka panel komut korelasyonunu okuyup response topic'ini taklit edebilir. Exact msx korelasyonu bu altyapı kimlik sorununun yerine geçmez. Canlı broker görülmedi; per-panel topic/credential izolasyonu coordinator/infrastructure sahibinin release engelidir. Backend IDE capability bu nedenle varsayılan kapalıdır; flag'i açmak canlı broker/TLS/firmware rollout kanıtından sonra mümkündür. localBridge uyumlu consumer teslim edilene kadar mobil capability kapalıdır.
3. Generic reader'ın gerçek UUID taşıması ve authenticated cihaz endpoint'i sahada doğrulanmalı; IDE/Hik dinamik reader UUID desteği bilinçli olarak false. Yeni telefon challenge protokolü veya yeni firmware desteği eklenmedi.
4. Eski yanlış mobile/manual attendance kayıtları migrate/silinmedi. Var olan geçmişi kaynak/ücret politikasına göre düzeltme ayrı yetkilendirme ve veri işi gerektirir.
5. Çok geniş (>500) erişim grafiği, bozuk/orphan topoloji, desteklenmeyen generic remote unlock ve legacy gece programı fail closed olur; UI nedeni göstermeli, yönetici veriyi düzeltmelidir.
6. Signing, deployment credentials, mağaza kimliği ve canlı backend/gerçek panel doğrulaması bu worker kapsamı değildir. Mobil operation repository/provider/UI, QR lifecycle ve tercih akışları kendi sahiplerinin entegrasyon testleriyle birleştirilmelidir.
7. Güvenli geri alma: mobil açma özelliğini devre dışı bırakmak mümkündür; eski fiziksel kanıtsız selfCheckIn yazıcısını yeniden açmak güvenli rollback değildir. Şema additive alanları korunabilir; aktif reader tokenlar kısa TTL ile yenilenir.
