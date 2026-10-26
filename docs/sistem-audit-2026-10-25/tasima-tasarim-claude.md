# Kalıcı taşıma akışı — K-02 (kişi) + C-02 (IDE panel) — Claude tasarımı (2026-10-26)

**Özet:** İki taşıma tek bir ortak "erişim devri" kaydıyla yönetilsin: eski cihazlardan silme işleri tek tek izlensin; hepsinin ACK'i gelmeden yeni projede kart açılmasın. Kişi taşımada **kayıt taşınmasın**: eski kayıt "taşındı" diye kapansın, yeni projede yeni kayıt açılsın. Kart numarası, iptal onaylanınca yeni kayda geçsin. MVP'de çevrimdışı cihaz varsa taşıma başlamasın (bugünkü engel o durumda sürsün).

## 0. Koddan çıkan dayanaklar (tasarımı belirleyenler)
- Kart numarası, işten ayrılmış kişiler dahil **sistem genelinde tekil** (`convex/lib/cardIdentity.ts:12-27`). B'de aynı kartla kayıt, A kaydı kartı bırakmadan açılamaz. Bu kural bize hazır bir sıra kilidi sağlıyor.
- Proje + kişi bağı taşıyan 17 tablo var: pdksRecords, cardReadings, leaves, leaveBalances, attendanceCorrections, shiftAssignments, employeeFingerprints, employeeConsents, employeeSessions, accessGrantStatus, groupMembers… (`convex/schema.ts` 167-1297). Kaydı taşımak bunların hepsini taşımak demek. KVKK açısından A ve B ayrı "veri sorumlusu" sayılır; biyometri rızası ve PDKS geçmişi A'da kalmalı.
- Hik silmesi, kart cihazın projesinde **aktif** bir kişiye aitse sessizce iptal ediliyor (`supersede`, `convex/hikvisionSync.ts:1167-1180`, `:600`). Bu yüzden A kaydı silme kuyruğa girmeden ÖNCE pasif olmalı. Yoksa taşıma hiç bitmez.
- IDE silmesi 5 denemede kalıcı `failed` oluyor (`ideSync.ts:137`, `:575-583`). ACK bekleme süresi 90 sn, bekleme süresi en fazla 60 sn. Panel ~10 dk çevrimdışı kalırsa silme işi düşer. Şu an silme için koruma da yok.
- Kuyruk işleri `deviceId`'ye bağlı ve cihaz kaldırılınca işler de siliniyor (`lib/deviceHelpers.ts:65,70`). Bugünkü reassign akışı önce kaldırıp sonra yeniden açıyor (`lib/deviceAssignment.ts:159-190`). Yani eski roster'ı silecek işler kalmıyor.
- Paneldeki kişilerin kaydı (`idePanelUsers`, `schema.ts:914-922`) yalnız ACK alınan işlerle tutuluyor (`ideSync.ts:503-519`). Bu özellikten önce eklenen kişiler, LAN'dan eklenenler ve ACK'i kaybolanlar bu kayıtta görünmeyebilir.
- IDE dokümanı: `delete_all_data` yalnız log için örnekli (`docs/ide-smart/04-message-types-reference.md:177-183`). Kullanıcıları silip silmediği belgede yok. `factory_reset` seviye 5 ve NVS'yi sıfırlıyor (`:244`), yani broker/MQTT ayarı da gider; kullanılamaz. `get_data` kullanıcıları sayfalı listeliyor (`:141-150`) ama köprüde (`scripts/ide-mqtt-bridge.mjs:177`) bu işlem yok.
- Model alınacak yer: Hik kayıt anındaki roster temizliği. Cihazı tam okuyor, beklenen listeyle yeniden kontrol ediyor, 1/5/15/30/60 dk aralıklarla tekrar deniyor, olmazsa `hikRosterReconcilePending` bayrağını koyuyor (`convex/actions/hikRosterReconcile.ts:24-45,95-110`, `schema.ts:413`). Çevrimiçi durumu `deviceConnection()` veriyor (`lib/deviceConnection.ts:37`).

## 1. Durum makinesi + şema
Durumlar: `requested → revoking → revoked → provisioning → done`. Yan dallar: `stuck` (süre doldu, aksiyon bekliyor), `cancelled`, `forced` (zorla tamamlandı; arkada silme sürer).
- `requested`: hedef cihaz listesi donduruldu, ön kontroller geçti.
- `revoking`: A'da erişim kapatıldı, silme işleri kuyrukta, hedefler tek tek onaylanıyor.
- `revoked`: tüm hedefler onaylı. B'ye kart verilebilir, panel B'ye açılabilir.
- `provisioning`: B'de üyelik ve gönderim yapılıyor. `done`: B'ye gönderim kuyruğa girdi (B tarafının ACK'i normal grant durumuyla izlenir).

Yeni tablo `accessTransfers` (mevcut alanlara gömülmez; iki akış da aynı tabloyu kullanır):
```
kind: "employee" | "ide_panel"; status: <yukarıdaki union>
sourceProjectId, targetProjectId: v.id("projects")
employeeId?: v.id("employees") (A kaydı); targetEmployeeId?: v.id("employees") (B kaydı)
adminDeviceId?: v.id("adminDevices"); ideUuid?: string
cardNumber?: string; cardKey?: string   // dondurulmuş kimlik (normalizeIdeCard)
targetPlan?: { accessRuleIds: Id<"accessRules">[] }  // B'de uygulanacak üyelik
requestedBy, requestedAt, deadlineAt, completedAt?, forcedBy?, forcedReason?, lastError?
indexes: by_status_deadline[status,deadlineAt] · by_employee_status[employeeId,status]
         by_ide_uuid_status[ideUuid,status] · by_card_key_status[cardKey,status] · by_source_project[sourceProjectId,requestedAt]
```
Yeni tablo `accessTransferTargets` (her cihaz/kimlik için bir satır):
```
transferId, deviceId, brand: "hikvision"|"ide_smart", ideUuid?, identity: string (employeeNo / ideUserId)
opTable: "hik"|"ide"; opId?: string; state: "pending"|"confirmed"|"failed"|"superseded"
attempts: number; lastError?; confirmedAt?; updatedAt
indexes: by_transfer_state[transferId,state] · by_op[opId] · by_device_state[deviceId,state]
```
`devices` tablosuna eklenecek alan: `ideRosterClearingTransferId?: v.id("accessTransfers")`. Bu alan doluyken
`enqueueIdeOpInTransaction` (`ideSync.ts:251`) o panel için `upsertUser`/`upsertPermission`/`openDoor` işlerini reddetsin.

Onay nereden gelir:
- IDE: `markAck` success ve `not_found` dalı (`ideSync.ts:494`, `:557`). Burada `by_op` ile hedefe bakılır ve hedef `confirmed` yapılır.
- Hik: silme işi `done` olunca hedef `confirmed`; `supersede` olunca `superseded` (onay sayılmaz, yöneticiye görünür).
- Son hedef onaylanınca durum `revoked` olur ve `provision` işi planlanır. Geç gelen başarılı ACK her zaman kabul edilir (`failed`/`forced` → `confirmed`). Onay yalnız iyiye doğru ilerler.

## 2. Kişi taşıma (K-02)
Önerilen model: **taşıma sihirbazı = A'da "taşındı" kapanışı + B'de yeni kayıt**. Bugünkü hata mesajı (`employees.ts:302-304`) da aynı yolu söylüyor. `employees.update` içindeki proje değiştirme engeli kalıcı kalır.
1. `accessTransfers.startEmployee({employeeId, targetProjectId, accessRuleIds})`: iki projede `employees.manage` ister, ücret varsa `pay.view` ister (`employees.ts:310-318` mantığı). Bir kişinin aynı anda tek aktif devri olabilir.
2. Aynı transaction'da şunlar yapılır:
   - Hedef listesi dondurulur: `snapshotEmployeeHikDevices` (`peopleHikSnapshot.ts:37`), `resolveEmployeeIdeDeviceIds` (`accessGraph`), ayrıca o kartı tutan ve projesi A olan `idePanelUsers` satırları ile kaldırılmamış `accessGrantStatus` satırları.
   - A kaydı `isActive=false` olur, `terminationType:"transfer"` alır. `closeAccess` mantığı tekrar kullanılır (`employeeTermination.ts:26-39`).
   - A'daki `groupMembers` satırları silinir (`employees.ts:400` gibi), mobil oturumlar (`employeeSessions`) silinir.
   - B'de **kartsız** yeni kayıt açılır: profil kopyalanır, `transferredFromEmployeeId` alanı eklenir, kart boş kalır. Kartsız kişi hiçbir cihaza gitmez.
3. `revoked` olunca tek mutation çalışır: A kaydının kartı serbest bırakılır (`cardNumber` → arşiv alanı), kart B kaydına yazılır, `targetPlan` üyelikleri eklenir, normal gönderim planlanır (`employees.ts:375-380`). Bu adımdan önce kart tekilliği yine kontrol edilir.
- **ACK gelmeden açılır mı?** Hayır. Kart B'ye ancak `revoked` sonrası geçer; tekillik kuralı bunu zaten zorunlu kılıyor.
- **Çevrimdışı cihaz:**
  - MVP'de başlangıçta hedef cihazlardan biri bile `deviceConnection≠online` ise taşıma başlamaz; hata listesi hangi cihazın kapalı olduğunu gösterir.
  - Akış sırasında cihaz kapanırsa IDE silme işinin deneme sınırı yükseltilir (devir işlerinde `maxAttempts` 50). Watchdog cron'u başarısız hedefleri cihaz yeniden çevrimiçi olunca yeniden kuyruğa alır (Hik'teki `hikRosterReconcilePending` örneği gibi).
  - `deadlineAt` (24 sa) geçince durum `stuck` olur. Yönetici şu bilgiyi görür: "Kart A'daki şu cihazlardan silinemedi: X (son görülme …). Seçenekler: Bekle / İptal (A kaydı geri açılır) / Zorla tamamla."
- **Zorla tamamla:** yalnız proje admini veya super_admin, gerekçe yazarak ve audit kaydıyla kullanabilir. Risk açık: çevrimdışı panel açılana kadar kişi A'nın kapısını açabilir. Silme hedefleri kapanmaz; panel çevrimiçi olunca silme sürer. Ekranda "taşındı, eski cihazda kart duruyor olabilir" rozeti görünür.
- **Geçmiş kayıtlar:** PDKS, cardReadings, izinler, bakiyeler, vardiya atamaları, puantaj A kaydında kalır (A'nın bordrosu). B, işe giriş tarihinden başlar.
- **Biyometri:** A'da şablon silinir (`scheduleFingerprintPurge deleteTemplates`). B'de yeni rıza alınır ve parmak izi yeniden kaydedilir.
- **Mobil:** A oturumu düşer. B için yeni davet ya da şifre belirleme gerekir (`employeeAuth` kopyalanmaz).
- **Ziyaret ev sahipliği:** A kaydının aktif ziyaretçisi varsa MVP'de taşıma reddedilir (sayı gösterilir). Geçmiş ziyaretler A'da kalır. K-07'deki boşta kalan ev sahibi sorunu bu yolla doğmaz, çünkü A kaydı silinmiyor.

## 3. IDE panel taşıma (C-02)
1. super_admin `reassignDevice` (`deviceAssignment.ts:99`) çağırır. Bugünkü sökme + açma işlemi (`:159-190`) korunur ama B'deki cihaz **karantinada** açılır: `ideRosterClearingTransferId` alanı dolu olur, B kuralları panele yazılmaz, kapı açma reddedilir.
2. `idePanelUsers` içinde bu UUID'ye ait ve projesi B olmayan her satır için `deleteUser` hedefi açılır. Silme işi yeni `deviceId` üzerinde, `employeeId` olmadan kuyruğa girer (A'nın grant satırları zaten silindi). Böylece işler, cihazın kaldırılmasıyla silinmez.
3. ACK gelince `removePanelUser` (`ideSync.ts:183`) satırı siler. Satır kalmayınca durum `revoked` olur, karantina kalkar, B için `project_resync` başlar (`deviceSyncRuns`).
- **Tam temizlik komutu:** Belgelenmiş ve güvenli bir komut yok (bkz. §0). MVP'de kişiler tek tek silinir (kayıttaki yansımaya göre). Kanıt için Faz 2'de köprüye `readRoster` (get_data user, sayfalı) eklenir ve sayfa boş dönerse temiz sayılır. Kayıtta görünmeyen eski kişiler de bu okuma ile `seedPanelUsers` (`ideSync.ts:453`) üzerinden silme listesine girer. `delete_all_data user` yalnız yedek bir panelde canlı denendikten sonra kullanılabilir. Eski A permission kayıtları kalabilir. Kullanıcı olmadan zararsızlar ve B aynı id'ye yazınca üzerine yazılır; Faz 2'de bunlar da silinir.
- **Çevrimdışı panel:** MVP'de reassign reddedilir ("Panel çevrimdışı; çevrimiçi olunca taşıyın"). Faz 2'de panel karantinada bekler, havuz/cihaz satırında "Temizleniyor: 37/120 · panel çevrimdışı (son görülme …)" yazar.
- **`assertIdeRosterMovable` (`deviceProvision.ts:62`) ne zaman kalkar:** reassign yolunda yerini devir başlatma alır. `createCore`/`createIdePanelCore` (`:133`, `:212`) içinde ve claim'de (`deviceAssignment.ts:29`) invariant koruması olarak kalır. Bu yollarda kayıtta A satırı varsa hata "Havuzdan Taşı'yı kullanın" der. Devir tamamlanınca satır kalmaz ve engel kendiliğinden kalkar.

## 4. Yarışlar
- **Taşıma sürerken kart değişimi:** Kimlik `cardKey` olarak dondurulur. A kaydı pasif olduğu için kart güncellemesi devir aktifken reddedilir. B kartsız olduğundan B'ye farklı kart verilebilir; eski kartın silinmesi dondurulmuş kimlikle sürer.
- **Kişi silme:** Devir aktifken A ve B kayıtlarının silinmesi reddedilir (`TRANSFER_IN_PROGRESS`). Ya da önce iptal edilir.
- **Yeniden taşıma:** `by_employee_status` ve `by_ide_uuid_status` ile tek aktif devir. B'den C'ye taşıma ancak `done` sonrası yapılabilir.
- **Kart eski projede başka kişiye verilirse:** `revoked` öncesi kart A kaydında olduğu için tekillik bunu engeller. `forced` sonrası kart B'de olduğu için yine engellenir. Panel taşımasında B'de o kartla bir çalışan varsa karantina sırasında upsert yasak olduğu için önce silme, sonra yazma sırası garanti olur. Faz 2: IDE'ye de Hik'teki `protectCurrentCredential` benzeri bir kontrol eklenir. Teslim anında kart o panelde yetkiliyse ve devre ait değilse silme iptal edilir.
- **Gecikmiş ACK:** `markAck` yalnız `sent` durumundaki işi ve eşleşen msxId'yi kabul ediyor (`ideSync.ts:481-488`). Hedef yalnız `opId` eşleşince onaylanır. Yeniden kuyruğa alınan işte opId aynı kalır (dedupe `ideSync.ts:296-307`). Geç gelen başarı her zaman onay sayılır.
- **Hik supersede:** A kaydı silme kuyruğa girmeden önce pasif yapıldığı için koruma tetiklenmez. Yine de tetiklenirse hedef `superseded` olur ve devir `stuck` olur; sessizce `done` olmaz.

## 5. MVP (en küçük güvenli adım) ve sonrası
**MVP-1 (ortak altyapı + C-02, yalnız çevrimiçi panel):** tablolar, hedef onay kancaları (IDE `markAck`, Hik done), karantina kontrolü, reassign → devir. Panel çevrimdışıysa bugünkü engel sürer.
**MVP-2 (K-02, yalnız tüm hedefler çevrimiçiyken):** sihirbaz, A'da "taşındı" kapanışı + B'de kartsız kayıt, `revoked` sonrası kartın aktarımı. Zorla tamamlama yok; `stuck` olunca "Bekle/İptal" seçilir.
**Faz 2:** çevrimdışında bekleme (watchdog + online olunca yeniden kuyruk), "Zorla tamamla", köprüye `readRoster` ile kanıt ve hayalet temizliği, IDE protect kontrolü, eski permission silme.
**Faz 3:** `delete_all_data user` canlı testi (yedek panel), çoklu kişi toplu taşıma.

## 6. İş tahmini + dosyalar (MVP-1 + MVP-2 ≈ **L**, ~3 worker-günü)
- Yeni: `convex/accessTransfers.ts` (start/cancel/status query, internal confirm/provision), `convex/lib/accessTransfer.ts` (saf geçiş + hedef planlama).
- Değişecek dosyalar:
  - `convex/schema.ts`: 2 tablo + `devices.ideRosterClearingTransferId` + `employees.transferredFromEmployeeId` ve `terminationType:"transfer"`
  - `convex/ideSync.ts`: karantina kontrolü, markAck/requeue kancası, devir silmelerinde maxAttempts
  - `convex/hikvisionSync.ts`: done/supersede kancası
  - `convex/lib/deviceAssignment.ts`: reassign → devir
  - `convex/lib/deviceProvision.ts`: hata metni
  - `convex/employeeTermination.ts`: closeAccess'i dışa aç
  - `convex/employees.ts`: remove/update içinde devir kilidi
  - `convex/crons.ts`: deadline → stuck
  - UI: `src/components/admin/AdminDeviceDialog.tsx` (devir durumu) ve kişi detayına "Başka projeye taşı" dialogu (yeni bileşen)
- Testler: saf durum makinesi (her geçiş, geç ACK, yalnız iyiye ilerleme) · markAck → hedef confirmed → revoked · `not_found` = confirmed · Hik supersede → stuck · çevrimdışı hedefte başlangıç reddi · tek aktif devir · `revoked` öncesi B'ye kart verilemez · karantinada upsert/openDoor reddi · reassign'da kayıt boşsa doğrudan geçiş · karakterizasyon (`devicesMutations.characterization.test.ts`).
- Kapı: tam `vitest run` (src mock'ları convex modüllerini kullanıyor), tsc, eslint, `find-node-leak`.

## 7. Emre'ye karar soruları
1. **Kişi taşıma modeli:** (a) **yeni kayıt + eski kayıt "taşındı" diye kapanır, geçmiş A'da kalır (önerim)** (b) aynı kayıt taşınır, geçmiş de B'ye gider (L+, KVKK ve bordro riski) (c) taşıma olmaz, elle çıkarıp yeniden eklenir (bugünkü durum).
2. **Çevrimdışı cihazda ne olsun:** (a) **MVP'de engel; Faz 2'de 24 sa bekleme + gerekçeli "zorla tamamla" (önerim)** (b) hiç zorla tamamlama olmasın, cihaz açılana kadar beklensin (c) baştan zorla tamamlansın, eski kapı riski kabul edilsin.
3. **IDE panel tam temizlik kanıtı:** (a) **MVP'de kayıttaki yansımaya göre tek tek silme; Faz 2'de köprüye get_data ile boş roster kanıtı (önerim)** (b) önce `delete_all_data user`'ı yedek panelde canlı test etmek (c) kurulumcu sahada factory reset yapar (MQTT ayarı da gider, yeniden provizyon gerekir).
