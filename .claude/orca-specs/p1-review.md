# P1 1-4 denetimi (Hik parity) — salt okuma

**Özet**
1. **2 Engel:** (a) kartsız kişinin boş kart numarası (`""`) okuma eşleştirmesinde ve PDKS'te bir *kimlik* gibi kullanılıyor, bu yüzden kimliksiz olaylar ve başka kartsız kişinin okumaları yanlış kişiye yazılıyor; (b) yüz kartının sorgusu projedeki bütün Hik iş kuyruğunu tarıyor, 1000 "done" işi geçince her yüz işlemi kilitleniyor.
2. **6 Düzeltilmeli:** Hik kapı filtresi bugünün canlı akışında boş kalıyor; okuyucu no türetme tutarsız; kartsız kişi için `employeeNo ""` ile cihaza yazılıyor; geçmiş employeeNo üzerinden başka kişinin yüzü silinebiliyor; 24 saat sonra başarısız yüz işleri "başarılı" görünüyor; yüz blob'u silinirken profil fotoğrafı kontrol edilmiyor.
3. **Talep eki (iş 4) temiz:** bilet tek kullanımlık, 60 sn ömürlü ve hash'li; ham `getUrl` dışarı çıkmıyor; `no-store` var; MIME/boyut `_storage` metadata'sı ve magic byte ile doğrulanıyor; cron günde 1. Hedefli testler 6 dosya / 80 test geçti, `find-node-leak` 0, `no-explicit-any` 0.

---

## ENGEL

### E1 — Boş kart numarası kimlik gibi eşleşiyor (kartsız kişi)
- **Yer:** `convex/cardReadings.ts:515-519` (`findDeviceCardEmployee`, `by_card eq(cardNo)` ve boş kontrolü yok), çağrıları `convex/cardReadings.ts:806,868` (`backfillHikEventRow`) ve `convex/lib/processCardReadingCore.ts:208,288,374`. PDKS/rapor tarafında `convex/lib/pdksWorkDay.ts:244-247` (`byCard.get(reading.cardNo)` fallback), `convex/lib/pdksAvailability.ts:87` ve `convex/lib/pdksPayrollQuery.ts:301` (`r.cardNo === employee.cardNumber`, `!r.employeeId` şartı yok), `convex/dashboard.ts:311-313`, `convex/lib/reportAttendance.ts:326`.
- **Senaryo 1:** gateway backfill'e kart ve employeeNo taşımayan bir erişim olayı gelir (ör. "Yüz doğrulama başarısız" / yabancı yüz, `HIK_SUB_EVENT_DENIED`). `cardNo = ""` olur ve `shouldCreateCardReading` true döner. `findDeviceCardEmployee("")` projedeki **ilk kartsız kişiyi** bulur. Okuma `employeeId`/`employeeName` ile o kişiye yazılır, geçiş geçmişinde ve raporlarda onun reddedilmiş denemesi olarak görünür.
- **Senaryo 2:** kartsız A mobil token ile geçer; `processCardReadingCore.ts:358` okumaya `cardNo: ""` yazar. Kartsız B'nin PDKS ve bordro hesabında `r.cardNo === employee.cardNumber` (`"" === ""`) doğru çıkar, A'nın girişleri B'ye sayılır. `pdksWorkDay` fallback'i de A listede değilse okumayı B'ye bağlar.
- **Neden yeni:** bu değişiklikten önce boş kartlı kişi formdan oluşturulamıyordu. Kartsız kişi açılınca `""` bir kimlik değeri oldu.
- **Düzeltme:** tek yardımcı yaz: `cardKey(card) => card.trim() || undefined`.
  1. `findDeviceCardEmployee` boş `cardNo` için `null` döner (iki kopyası da: `cardReadings.ts` ve core).
  2. `byCard` Map'leri boş kartları almaz.
  3. Bütün `cardNo === cardNumber` karşılaştırmaları boş olmayan kart ister, kartla eşleşme yalnız `!reading.employeeId` iken yapılır.
  4. Test: kartsız iki kişi + `cardNo ""` olay → `employeeId` yok, iki kişinin PDKS'i de boş.

### E2 — Yüz kartı sorgusu projedeki tüm Hik kuyruğunu tarıyor, 1000 "done" işten sonra kilitleniyor
- **Yer:** `convex/employeeFaces.ts:54-58` (`operations`), kullananlar: `listForEmployee` (:60), `queueDelivery` (:114), dolayısıyla `savePhoto`, `resend`, `remove`.
- **Senaryo:** orta büyüklükte bir projede 30 gün içinde 1000'den fazla `done` Hik işi birikir. `done` satırları `OPERATION_RETENTION_DAYS = 30` boyunca tutuluyor (`privacyRetention.ts:193`); 200 kişilik tek bir kural senkronu bile birkaç yüz `addPerson/updatePerson` üretir. Bu noktada `pages.some(len > 1000)` hata fırlatır: yüz kartı açılmaz, yüz ekleme/yeniden gönderme/silme hiç çalışmaz. Silmenin çalışmaması KVKK açısından da sorun. Sınırın altında bile reaktif sorgu her açılışta 4×1001 satır okur ve projedeki her kuyruk yazımında yeniden çalışır; bu, Convex kotasını yer.
- **Düzeltme:** yüz işlerini çalışan bazında indeksli oku. Ya `hikPendingOperations`'a üst seviye `employeeId` alanı + `by_employee_operation` indeksi ekle (widen → backfill), ya da ayrı bir `faceDeliveries` tablosu (employeeId, deviceId, op, status) kullan. Geçmiş için `take(50)` yeterli. Sınır aşımında hata fırlatma, en yeni N kaydı kullan.

## DÜZELTİLMELİ

### D1 — Hik kapı filtresi bugünün canlı akışında boş kalıyor
- **Yer:** `convex/lib/cardReadingAudit.ts:78-83` (canlı listede Hik okumasına kapı bağlanmıyor), istemci `src/components/live-monitoring/lib/readings.ts:18` (`r.door?._id === f.door`), `src/components/access-control/CardReadings.tsx:84-86`.
- **Senaryo:** tarih seçilmeden Hik kapısı seçilir. Geçmiş sorgusu dünü bitiş alır (`endDate: previousDay(feed.day)`). Bugünün okumaları yalnız `listLiveSince`'ten gelir ve orada `matchedHikDoor` verilmediği için `door: null` olur. İstemci filtresi hepsini atar; bugünkü Hik geçişleri listede görünmez. IDE'de sorun yok.
- **Düzeltme:** `enrichReadingsForList` Hik okumasında kapıyı çözsün: cihaz başına bir kez `readers.by_device` (+ okuyucusuz kapılar için `doors.by_device` + 2N-1/2N) ile `hikCardReaderNo → door` haritası. Alternatif: canlı akışta kapı filtresini sunucuya ver.

### D2 — Okuyucu kaydı var ama `hikReaderNo` boşsa kapı filtresi hiç sonuç vermiyor
- **Yer:** `convex/cardReadings.ts:212-222`.
- **Senaryo:** eski kapıda `readers` satırı var ama `hikReaderNo` undefined. `hikReaderNos` boş küme olur ve `readers.length === 0` olmadığı için 2N-1/2N yedeğine düşülmez; filtre sessizce boş liste döner. `doors.ts:722` (`getPlanReaders`) aynı durumda okuyucu başına `deriveHikReaderNoFromDoorNo(door.hikDoorNo, reader.direction)` kullanıyor; iki yol tutarsız.
- **Düzeltme:** `reader.hikReaderNo ?? deriveHikReaderNoFromDoorNo(door.hikDoorNo ?? 1, reader.direction)`. `both` yönü için iki numarayı da ekle. Mümkünse `getPlanReaders` ile ortak bir yardımcıya taşı.

### D3 — Kartsız kişi kapı-hedefi değişiminde cihaza `employeeNo ""` ile yazılıyor
- **Yer:** `convex/lib/doorTargetSync.ts:94-104` (her üyeye `rightsOnly updatePerson`, `cardNumber: employee.cardNumber`), `convex/lib/hikSyncEmployee.ts:640-685` (`syncEmployeeDoorRights`: boş kart kontrolü yok, `UserInfo/SetUp` / `upsertPersonToDevice` / `addCardToDevice` `employeeNo ""` ile çağrılıyor).
- **Senaryo:** kartsız kişinin üyesi olduğu kuralın kapısı başka cihaza ya da kapı numarasına taşınır. İş kuyruğa girer, `getEmployeeWithDevices` kontrolü `"" === ""` olduğu için geçer, gateway'e boş kimlikli kişi yazma isteği gider. Kişi silinmiyor (silme yolları korumalı), ama boş kimlikle cihaza yazılıyor ve grant durumları `pending → failed` gürültüsü üretiyor. Kuyruk yeniden denemesi `hikQueueWorker.ts:148` üzerinden aynı yola düşüyor.
- **Düzeltme:** `doorTargetSync` döngüsünde `canSyncEmployeeToDevices(employee)` false ise atla (grant yazma). `syncEmployeeDoorRights` başında `if (!args.cardNumber.trim()) return { ok: true }` ekle.

### D4 — Yüz silme, geçmiş employeeNo üzerinden başka kişinin yüzünü silebilir
- **Yer:** `convex/employeeFaces.ts:127` (silmede `identities` = güncel kart + geçmiş `addFace/deleteFace` payload'larındaki tüm `employeeNo`'lar).
- **Senaryo:** A'nın yüzü kart 123 ile gönderilir. A'nın kartı 456 olur, 123 B'ye verilir ve B yüz kaydeder. A'nın yüzü silinince cihazlara `deleteFace employeeNo=123` gider ve **B'nin cihazdaki yüzü silinir**.
- **Düzeltme:** geçmiş kimliği kuyruğa almadan önce `findDuplicateCard(ctx, employeeNo, employee._id)` ile bak; başka bir kişiye aitse atla (ya da yalnız güncel kartı sil, eski kart yüzünü kart değişim akışında temizle).

### D5 — Başarısız yüz işleri 24 saat sonra "başarılı" görünüyor
- **Yer:** `convex/hikvisionSync.ts:1094-1101` (10 dakikada bir koşan `cleanupStaleSyncIssues`: `attemptCount >= 5` ve 24 saatten eski failed işi `status: "done", dismissedAt` yapıyor; yüz işleri hata anında hep `attemptCount: 5` alıyor), `convex/employeeFaces.ts:74` (`current ? row.status`, `dismissedAt`'e bakmıyor) ve `:117`.
- **Senaryo:** cihaz kapalıyken `deleteFace` başarısız olur. 24 saat sonra iş "done" olur; yüz kartı o cihazı "tamamlandı" gösterir, ama biyometrik veri hâlâ cihazda. `:117`'deki "önce başarısız silmeyi yeniden dene" kilidi de sessizce açılır. Aynısı `addFace` için de geçerli: yüz cihaza hiç gitmediği halde başarılı görünür.
- **Düzeltme:** `cleanupStaleSyncIssues` kişi silmelerinde olduğu gibi `addFace/deleteFace`'i de atlasın, ya da `listForEmployee` `dismissedAt` varsa durumu "failed (kapatıldı)" göstersin; `:117` kilidi `dismissedAt`'li deleteFace'i "done" saymasın.

### D6 — Yüz blob'u silinirken profil fotoğrafı referansı kontrol edilmiyor
- **Yer:** `convex/employeeFaces.ts:149` (değiştirmede `ctx.storage.delete(old.pictureStorageId)`) ve `:174` (silmede). Karşılaştırma: `convex/biometricDestruction.ts:279` ve `convex/lib/employeeCascade.ts:154`, ikisi de önce `employees.by_photo_storage` ile kontrol ediyor.
- **Senaryo:** eski akışla oluşmuş bir yüz kaydının `pictureStorageId`'si kişinin `photoStorageId`'siyle aynıdır. Yüz değiştirilir ya da silinir, profil fotoğrafı dosyası da silinir ve `photoUrl` kırık kalır.
- **Düzeltme:** silmeden önce `by_photo_storage` ile `take(1)`; kullanılıyorsa blob'u bırak.

## NOT

- **N1** — `requestAttachments.ts:56-57`: tamamlanmamış yükleme slotları 24 saat boyunca 9'luk bekleyen sınırına sayılıyor. Mobil hata yolunda `discard` deneniyor; ağ kesilirse kişi 24 saat yeni belge yükleyemeyebilir. `uploadUrl`'si tüketilmiş ve 60 sn'yi geçmiş slotları sayımdan çıkarmak yeterli.
- **N2** — `requestAttachments.ts:261-275` cleanup her gece bütün tabloyu tarıyor (satır başına 3 `get`). Günde bir kez olduğu için kota açısından sorun değil. Onaylanmış/reddedilmiş taleplerin ekleri için saklama süresi yok (ürün kararı).
- **N3** — Senkron uyarı bandından `addFace` "yeniden dene" seçilince `hikQueueWorker.ts:250` "desteklemiyor" döner. Önceden de böyleydi; yüz işleri bandda gösterilmeyebilir ya da yüz kartına yönlendirilebilir.
- **N4** — `captureFaceFromDevice` `employeeId` olmadan çağrılırsa yalnız proje üyeliğini kontrol ediyor, `biometrics.manage` istemiyor (`gatewayCommand.ts:482-492`, önceden de böyle). Yeni UI hep `employeeId` gönderiyor.
- **N5** — `useEmployeeFormSchema.ts`: kart alanı her durumda isteğe bağlı. Kartı olan kişinin kartı silinince sunucu "Kart numarası zorunludur" diye reddediyor (doğru), ama istemci önceden uyarmıyor. Düzenlemede eski kart doluysa `min(1)` korunmalı.
- **N6** — Silinmiş ya da taşınmış bir cihazdaki başarısız `deleteFace` yüz eklemeyi en fazla 24 saat (orphan için 10 dk) kilitliyor; sonra D5'teki temizlik açıyor. D5 düzeltilince bu kilit kalıcı olur; düzeltmede `queueDelivery:117` artık hedef olmayan ya da var olmayan cihazları saymasın.

## Doğrulanan, sorun olmayan noktalar
- **Talep eki:**
  - IDOR (başkasına ait kayda kimlik numarasıyla erişme) yok: indirme hem bilet üretirken hem tüketirken `attendance.approve` + üyelik ya da sahip oturum + aynı proje + geri çekilmemiş talep şartı arıyor.
  - Bilet `crypto.randomUUID`, SHA-256 hash ile saklanıyor; tüketimde siliniyor, 60 sn ömürlü.
  - `storageId` istemciye hiç dönmüyor; `files.ts` guard'ı talep belgesini genel `getUrl` yollarından kapatıyor.
  - HTTP yanıtı `private, no-store`, `nosniff`, `no-referrer` ve `attachment` başlıklı.
  - Yükleme gövdesi akış halinde 5 MB / bildirilen boyutla sınırlı; magic byte ve `_storage` metadata ile eşleşme kontrol ediliyor.
- **Kartsız kişi:**
  - `deleteEmployeeFromDevicesInternal`, kuyruk silme/kart silme işleri ve IDE (`Number > 0`) boş kartta hiçbir şey yapmıyor; cihaz kişisi silinmiyor.
  - İlk kart atamasında purge ya da delete üretilmiyor.
  - Kartlı kişide kart değişimi akışı değişmedi.
- **Kapı filtresi:** IDE kapı yolu (`by_device_io_time` + `ideIoId`) değişmedi; `/card-reader` ve diğer http route'ları etkilenmedi (yalnız `/request-attachments` GET/POST eklendi).
- **Kontroller:** hedefli vitest 6 dosya / 80 test geçti; `scripts/find-node-leak.mjs` çıkış 0; değişen convex dosyalarında `no-explicit-any` 0.
