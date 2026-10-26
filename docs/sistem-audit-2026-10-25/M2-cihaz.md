# M2 — Cihaz, kapı/okuyucu, kart olayı ve köprü audit'i

## 1. Sonuç

Hik yetki geri alma, proje taşıma engeli, ISUP bağlantı durumu ve sanal okuyucu kontrollerinde önemli düzeltmeler var; buna karşılık IDE tarafında başka projedeki fiziksel paneli hedefleme, taşımada eski kartları bırakma ve hata mesajı dönüşümü nedeniyle yetki güncellemesini uygulayamama sorunları sürüyor. Olay teslimi, tekrar kayıt ve kuyruk ilerlemesi de ayrıca düzeltilmeli; geçen testler bu uçtan uca zincirleri kapsamıyor.

**Yeni bulgu sayımı: P0: 3 / P1: 6 / P2: 2 / P3: 0 — toplam 11.** Eski audit'te zaten bulunan açıklar bu sayıya tekrar eklenmedi; bölüm 5'te durumları var.

İnceleme: 25 Ekim 2026, yerel `main`, başlangıç HEAD `520ba5fc`; son 120 commit ve çalışma ağacı okundu. Son kontrolde başka oturumların `5de547a8` ve `77bce329` commitleriyle HEAD ilerledi; bu aralık M2 cihaz/köprü kodunu değiştirmiyor. Kaynak incelemesi ve hedefli yerel testler yapıldı; canlı yayın, ağ, cihaz, DB veya Supabase kullanılmadı. Başka oturumun mobil talepler WIP dosyaları değiştirilmedi; bulgular bunlara dayanmıyor. KESİN, kod zincirinin kanıtlı olduğunu belirtir; fiziksel kapıda gerçekleşmiş bir olay veya canlı müşteri etkisi iddiası değildir.

## 2. Modül haritası

| Alan | Dosyalar / girişler | Başlıca tablolar | Sayfa / tüketici |
|---|---|---|---|
| Cihaz ve havuz | `convex/devices.ts`, `adminDevices.ts`, `lib/deviceProvision.ts`, `deviceAssignment.ts`, `devicePool.ts` | `devices`, `adminDevices`, `zones`, `doors`, `readers` | Devices, sistem admin cihaz paneli, `useDevices`, ekleme/düzenleme/claim formları |
| Topoloji ve plan | `doors.ts`, `zones.ts`, `readers.ts`, `lib/doorStatusPlan.ts`, `lib/gatewayCommand.ts` | `groupDoors`, `groupDevices`, kapı/okuyucu planları, tatil slotları | LocationTree, Geçiş Kontrol kapı planları |
| Olay kabulü | `http.ts`, `cardReadings.ts`, `deviceEvents.ts`, `lib/processCardReadingCore.ts`, `cardReadingProcess.ts`, `cardReaderParse.ts` | `cardReadings`, `deviceEvents`, `employees` | LiveMonitoring, PDKS, alarm merkezi |
| Hik senkron | `hikvisionSync.ts`, `deviceSyncRuns.ts`, `actions/hikvisionSync.ts`, `hikQueueWorker.ts`, `hikRosterReconcile.ts`; `lib/hikSyncEmployee.ts`, `gateway/**` | `hikPendingOperations`, `accessGrantStatus`, `deviceSyncRuns`, `deviceSyncRunTargets` | SyncIssuesBanner, Yetki Durumu, cihaz komutları |
| IDE senkron | `ideSync.ts`, `actions/ideGatewayDevice.ts`, `ideDefaults.ts`, `debugIde.ts` | `idePendingOperations`, `idePanelUsers`, `ideSequences`, erişim kuralları | Cihaz/kapı komutları, admin provizyon |
| Köprüler | `infra/hik-event-bridge/bridge.mjs`, `infra/hik-relay/server.mjs`, `infra/mqtt/**`; `scripts/ide-mqtt-bridge.mjs`, `scripts/lib/ide-mqtt-routing.mjs`, `hikvision-bridge.mjs`, `ide-provision-agent.mjs`, `forward-card-reader-to-convex.mjs` | HTTP üzerinden yukarıdaki tablolar | ISUP event stream, MQTT broker, yerel hazırlama ajanı |
| Sanal okuyucu | `virtualReaders.ts`, `lib/virtualReader.ts`, `lib/processCardReadingCore.ts` | `devices`, `checkInTokens`, `employeeSessions`, `employeeAuth`, `cardReadings` | VirtualReaderKiosk, Devices sanal okuyucu menüsü |
| Sağlık / zamanlayıcı | `devices.applyIsupStatus`, `lib/deviceConnection.ts`, `crons.ts` | `devices`, `deviceEvents`, senkron kuyrukları | Durum rozeti, alarm, retry |

**Public yüzey kontrolü:** Cihaz liste/get/oluştur/güncelle/sil/token/claim/reassign/release, admin havuz, kapı/bölge/okuyucu yazımları, plan yazımı, cihaz action'ları, senkron başlat/listele/retry/dismiss ve kiosk girişleri tarandı. Genel yönetim yazımları `devices.manage`, planlar `accessRules.manage`, web kapı açma `doors.open`, biyometrik yakalama kişi yetkileriyle korunuyor; iç işçiler `internal*` olarak ayrılmış. Public uç bulunması tek başına hata sayılmadı; aşağıdaki sorunlar yetki kontrolünden sonra fiziksel hedefin çözülmesi veya veri tesliminde oluşuyor.

**HTTP sözleşmesi:** `/card-reader` cihaz Bearer/query token'ı, güvenilir relay secret'ı veya açıkça etkinleştirilen eski modla çalışıyor (`convex/lib/cardReaderAuth.ts:35`); cihaz token'lı istek gövde kimlikleriyle kontrol edilip cihaza sabitleniyor (`convex/http.ts:158`). `/hik-gateway/device-status` yalnız cihaz token'ı ve eşleşen devIndex kabul ediyor, zaman aralığı ve sıralama kontrolü var (`convex/http.ts:15`, `convex/devices.ts:993`). `/ide-bridge/{event,poll,sent,ack}` ortak bridge Bearer kullanıyor; broker topic sahipliği köprüde kontrol ediliyor (`scripts/lib/ide-mqtt-routing.mjs:41`, `infra/mqtt/config/acl:4`). `/hik-bridge/{poll,ack}` cihaz token'lı eski yol; roster yolları kaldırılmış. `/confirm-relay` yalnız sabit cevap veriyor, veri değiştirmiyor. Hik relay uyandırma kanalında HMAC, süre ve hız kontrolü var (`infra/hik-relay/server.mjs:119`, `:130`); bu koruma `/card-reader` için ortak bir koruma değil.

**Zamanlayıcı / kota:** Hik retry 3 dakika, eski hata temizliği 10 dakika, eski localBridge işi 3 dakika, Hik saat ve olay taraması günlük (`convex/crons.ts:14`). Bu üç kısa cron tek başına günde 1.104 üst seviye çağrı üretir; iç sorgu/işlem çağrıları buna dahil değildir. IDE poll'ün kapatılması ve boşta 30 saniyeye çıkan bekleme bilinçli karar; bunu bulgu saymadım. Açık bir daemon için 30 saniyelik boş poll yaklaşık 2.880 HTTP çağrı/gün ve bunların iç mutation'ları demektir (`scripts/ide-mqtt-bridge.mjs:47`, `:305`); fiilî kota aşımı ölçülmedi.

## 3. Yeni bulgular

| ID | Önem | Tür | Yer (file:line) | Ne oluyor (kullanıcı gözünden) | Kanıt (kısa) | Öneri | Emek | Güven |
|---|---|---|---|---|---|---|---|---|
| C-01 | P0 | YETKİ | `convex/devices.ts:182`, `:233`; `convex/lib/deviceProvision.ts:96`; `convex/ideSync.ts:312`; `scripts/ide-mqtt-bridge.mjs:170` | Bir projede cihaz yönetebilen kullanıcı, başka projenin IDE panel UUID'sini kendi cihazına yazıp o fiziksel panele kapı komutu gönderebilir. | `update` yalnız mevcut kaydın projesini doğrular, `ideUuid` için global tekillik/sahiplik aramaz; genel `create` de IDE markası+UUID kabul edip özel IDE oluşturma kontrolünü atlar. Kuyruk hedefi kayıttaki UUID; köprü kapı komutunda panel parolası istemez. | Fiziksel kimliği bütün create/update/claim yollarında tek ve doğrulanmış sahipliğe bağla; kimlik değişimini yeniden provizyon olarak ele al. | M | KESİN |
| C-02 | P0 | EKSİK | `convex/lib/deviceAssignment.ts:137`, `:163`; `convex/lib/devicePool.ts:41`; `convex/lib/accessGraph.ts:230` | IDE paneli başka projeye taşındığında önceki projenin kartları panelde kalabilir; yeni projede hiçbir erişim kuralı olmasa da eski fiziksel izinler otomatik kaldırılmaz. | Reassign eski DB topolojisini silip yeni cihazı açıyor; claim yalnız kayıt/kapı oluşturuyor. UUID bazlı eski kart temizleyici mevcut fakat bu iki yolda çağrılmıyor. Hik taşıma engeli IDE'yi kapsamıyor. | Taşıma/claim öncesi eski roster'ı temizle ve onayını bekle; tamamlanana kadar yeni kullanım kapalı olsun. | L | KESİN |
| C-03 | P0 | TUTARSIZ | `scripts/lib/ide-mqtt-routing.mjs:54`; `convex/ideSync.ts:459`, `:479`; `convex/actions/ideGatewayDevice.ts:348` | IDE'de mevcut kişi/izin güncellemesi başarısız kalabilir; daraltılan kapı/saat hakkı panelde eski geniş haliyle devam edebilir. | Köprü tüm ret mesajlarını `panel rejected command` yapıyor. Sunucu ancak `already exists` metniyle create→update'a geçiyor, `not found` metniyle silmeyi tamamlanmış sayıyor; gerçek neden sunucuya hiç ulaşmıyor. | Hassas veriyi maskeleyip yapılandırılmış hata kodunu koru; bridge→HTTP→markAck sözleşme testi ekle. | M | KESİN |
| C-04 | P1 | HATA | `convex/lib/deviceHelpers.ts:54`; `convex/ideSync.ts:302`, `:313`, `:341`; `scripts/ide-mqtt-bridge.mjs:250` | Silinmiş/bozuk birkaç IDE cihazı, sağlıklı diğer cihazların komutlarının da hiç gönderilmemesine yol açabilir. | Cascade yalnız Hik kuyruğunu siler. IDE global kuyruğunda önce `take(10)` yapılır, cihazı olmayan işler sonra atlanır ve pending kalır; aynı ilk 10 kayıt sürekli gelir. Login başarısızlığında da attempt/backoff yazılmaz. | Orphan/bozuk işleri kalıcı sonuca geçir; uygun cihaz bazlı adil seçim ve login için sınırlı deneme/backoff kullan. | M | KESİN |
| C-05 | P1 | HATA | `convex/lib/processCardReadingCore.ts:212`, `:258`; `convex/lib/cardReadingProcess.ts:91`; `infra/hik-event-bridge/bridge.mjs:156` | Aynı kart olayı tekrar taşındığında ikinci satır oluşur; çift yönlü cihazda girişten hemen sonra sahte çıkış oluşabilir. | Canlı Hik/IDE yolları tekrar anahtarı aramadan insert yapıyor. Hik bridge hata/cevap kaybında üç kez dener, MQTT QoS 1 de tekrar teslim edebilir; yön son başarılı satıra göre değişir. Tarihsel Hik yolundaki tekilleştirme canlı yolu korumaz. | Olay kimliğini kaydetme ve yön çözümünden önce tekilleştir; canlı/backfill aynı anahtarı kullansın, IDE için güvenilir olay anahtarı tanımla. | M | KESİN |
| C-06 | P1 | HATA | `scripts/lib/ide-mqtt-routing.mjs:46`, `:60`, `:74`; `scripts/ide-mqtt-bridge.mjs:196` | Convex'e kısa erişim kesintisinde IDE kart geçişleri kaybolabilir; panel onayı sunucuya ulaşmadığında iş asılı kalabilir. | Olay POST'u başarısızsa yalnız log var, kalıcı tampon/tekrar teslim yok. ACK gönderilmeden timer ve pending kaydı kaldırılıyor; ACK HTTP hatasında tekrar yok. MQTT `clean:true`, buluta teslim garantisi sağlamaz. | Kalıcı teslim kuyruğu ve onaylı tekrar; olay tekilleştirmesiyle birlikte uygula. | M | KESİN |
| C-07 | P1 | HATA | `convex/lib/gatewayBackfill.ts:75`, `:82`, `:192` | Yoğun Hik cihazında geçmiş olayların bir bölümü hiç içeri alınmayabilir; tarama buna rağmen başarılı görünür. | 50×30 olay sınırında devam varsa yalnız warn, ardından `hikLastBackfillAt=şimdi` ve `ok:true`; ertesi gün başlangıç bu saatten 5 dakika geri gider. Henüz okunmamış eski pencere için devam işi yok. | Son işlenen olay zamanı/sayfa üzerinden sürdür; sınırda işi kısmi göster, tüm pencere bitmeden tamamlandı zamanını ilerletme. | M | KESİN |
| C-08 | P1 | HATA | `convex/hikvisionSync.ts:797`, `:808`; `convex/actions/hikQueueWorker.ts:40`; `convex/hikvisionSync.ts:1008` | Hik'te eski erişim silme işi, daha yeni hatalar yüzünden tekrar hiç denenmeyebilir; manuel yeniden deneme de aynı genel taramaya düşer. | En yeni 60 failure alınır, sonra deneme/online filtresi yapılır. Öndeki 60 kayıt denemesi bitmiş silme veya sürekli offline ise eski uygun iş görünmez; silme işleri otomatik temizlikten korunuyor. | Retry zamanına göre indeksli adil tarama/cursor; manuel retry doğrudan seçili işi çalıştırsın. | M | KESİN |
| C-09 | P1 | EKSİK | `convex/actions/ideGatewayDevice.ts:405`; `convex/ideSync.ts:281`, `:302`, `:502`; `scripts/ide-mqtt-bridge.mjs:170` | Web'den verilen kapı açma komutu bağlantı döndüğünde çok geç çalışabilir veya onay kaybında yeniden gönderilebilir. | Web payload'unda son kullanma zamanı yok; pending seçiminde yaş sınırı yok. Genel op varsayılan retry alıyor. Mobil kapı komutunun tek deneme/teslim öncesi doğrulaması bu web payload'una uygulanmıyor. | Web komutlarına kısa teslim süresi, tek deneme ve belirsiz sonuç durumu ekle; kalıcı latch davranışını kullanıcıya açık göster. | M | KESİN |
| C-10 | P2 | TUTARSIZ | `convex/readers.ts:168`; `convex/lib/cardReadingProcess.ts:76`; `convex/lib/processCardReadingCore.ts:189` | Okuyucuda giriş/çıkış yönü değiştirilse de canlı kaydın yönü aynı mantıkla üretilir; ayar çalışmıyor gibi görünür. | IDE io=0/1 doğrudan giriş/çıkış, diğerleri cihaz yönü/toggle; Hik okuyucu numarası yön çözümüne verilmez. `readers.direction` okunmuyor. PDKS nokta tipi ayrıca yönü düzeltebilir; dolayısıyla her projede puantaj hatası olduğu söylenemez. | Olayın gerçek okuyucusunu çöz, tek yön politikası kullan; envanter yönü ile PDKS nokta tipinin farkını açıklaştır. | M | KESİN |
| C-11 | P2 | EKSİK | `convex/http.ts:93`, `:345`, `:400`; `convex/lib/cardReaderParse.ts:369` | Bozuk/büyük HTTP gövdeleri gereksiz işlenebilir; bazı hatalı bridge istekleri tutarlı 400 cevabı yerine sunucu hatası üretebilir. | `/card-reader` kimlik doğrulamadan önce tüm gövdeyi okur/parse eder; uygulama seviyesinde boyut/hız sınırı yok. Bridge JSON'u tür cast'iyle kabul edilir; `/sent` JSON/ID hatası ortak hata cevabına alınmamış. | Auth'u önce kontrol et, sınırlı gövde okuması ve çalışma zamanı şeması kullan; 400/413/429 cevabını ortaklaştır. | M | OLASI |

**C-01 sınırı ve kanıtı:** Önkoşul, saldırganın kendi projesinde `devices.manage` ve `doors.open` hakkı, hedefin geçerli IDE UUID'si ve çalışan köprü olmasıdır. Başka projenin Convex cihaz kimliğini okumaya gerek yok: kendi cihazı/kapısı yetki kontrolünden geçer, `pendingForBridge` fiziksel hedefi UUID'den üretir. Broker'ın cihaz başına ACL'si bunu kapatmaz; yayın yapan güvenilir bridge hesabı bütün panel komut kanallarına yazabilir. Gerçek panele komut gönderilmedi.

**C-03 sınırı:** Kaynak, panelin `create_data` mevcut kayıtta ret verdiğini ve bu nedenle `update_data`ya geçilmesi gerektiğini açıkça belgeliyor (`convex/ideSync.ts:454`). Mesaj kaybı kodda kesindir; bütün firmware sürümlerindeki ret biçimi ayrıca cihaz teyididir. Silmenin `not found` dalının kaybı çoğunlukla yanlış başarısızlık görünümü yaratır; erişimin geniş kalması mevcut izin/kişi güncelleme dalındadır.

**C-05 ve C-07:** Tekilleştirme eksikliği ile tarihsel tarama kesilmesi farklı sorunlardır. Hik canlı olayının gerçek cihaz zamanı yerine geliş saatiyle yazılması daha önce A raporunda belirtilmişti; yeni bulgu olarak tekrar sayılmadı (bölüm 5).

**C-11 sınırı:** Platformun veya canlı ters vekil sunucunun ayrıca sınır koymadığı iddia edilmiyor. Burada kanıtlanan uygulama katmanındaki eksik; fiilî kaynak tüketimi ve yanıt boyutu canlıya bakılmadan kesinleştirilemez.

## 4. Modüller arası ilişkiler

| Karşı modül | Bağ (tablo/fonksiyon) | Yön | Sorun var mı (file:line) |
|---|---|---|---|
| M1 — kişi / kart / kural | `employees`, `groupMembers`, `groupDevices`, `groupDoors` → `hikvisionSync.getEmployeeWithDevices`, `actions/ideGatewayDevice.syncEmployeeToIdePanels` | M1 → M2 | Hik eski kimlik snapshot'ı düzeltildi; IDE mevcut izin değişiklikleri C-03 nedeniyle uygulanamayabilir (`convex/lib/employeeCardChange.ts:27`, `scripts/lib/ide-mqtt-routing.mjs:58`). |
| M1 — yetki geri alma sonucu | `hikPendingOperations`, `idePendingOperations`, `accessGrantStatus`, `deviceSyncRuns` | M2 → M1 | Kuyruk beklemesi ve roster taşıma C-02/04/08; ziyaretçi silmesinde employeeId eksikliği eski açık (`convex/visitors.ts:513`, `convex/lib/grantStatus.ts:97`). |
| M3 — PDKS | `cardReadings` → `filterPdksReadings`, `effectiveDirection`, checkpoint politikası | M2 → M3 | C-05 tekrarları ve eski Hik zaman hatası tüketiciye taşınır. Biyometrik/belirsiz kaynak dışlama doğru ve kasıtlı (`convex/lib/pdksSource.ts:73`). Okuyucu envanter yönü ile PDKS noktası ayrı kaynaklar (C-10). |
| M4 — alarm / bağlantı | `applyIsupStatus`, `confirmIsupOffline`, `deviceEvents`, `alarmSettings` | M2 → M4 | Hik kesin offline sinyali 5 dk sonra alarm üretir; IDE/generic yalnız yeniden sinyal geldiğinde kapanmış kesinti alarmı üretir (`convex/devices.ts:1030`, `convex/lib/deviceConnection.ts:62`). Eski kapsam eksikliği kısmen sürüyor. |
| M4 — denetim / admin cihaz | `adminDevices`, `deviceEvents.recordOperationInternal`, `roles.checkPermission` | Çift yön | Komut kaydı var; havuz listesi hâlâ unassigned cihaz şifrelerini cihaz yönetebilenlere verir (`convex/adminDevices.ts:65`). Eski bulgu; yeni UUID açığı C-01 ayrıca var. |
| M5 — mobil QR / kiosk | `checkInTokens`, `employeeSessions`, `employeeAuth` → `consumeReaderTokenDetailed` | M5 → M2 → M3 | Tek kullanım, amaç, süre, oturum, parola sürümü ve proje kontrolü mevcut (`convex/lib/processCardReadingCore.ts:311`). QR kayıt kaynağı açıkça `qr`/`virtual_reader` yazılıyor (`:320`); belirgin yeni sözleşme kopukluğu bulunmadı. |
| M5 — mobil kapı | `mobileAccessGateway`, IDE/Hik kuyrukları, `mobileOperationId` | Çift yön | Mobil teslim öncesi korumalar ortak kuyruğa bağlı; IDE olay/ACK HTTP kaybı C-06 sonucu belirsiz bırakabilir. Web komutu aynı süre politikasında değil (C-09; `convex/ideSync.ts:352`, `:418`). |
| Köprü altyapısı | MQTT topic/UUID, msxId, HTTP ACK; ISUP devIndex/token/status | Çift yön | Topic/UUID ve ACK kimlik eşleşmesi mevcut; hata anlamı kayboluyor (C-03), teslim tekrarları eksik (C-06). Hik status route'unda zaman/sıra kontrolü var (`convex/devices.ts:995`). |

Sözleşme/zincir sorunları:

- DB kaydına sahip olmak, fiziksel IDE UUID'sine sahip olunduğunu kanıtlamıyor; C-01 yetki zincirinin bu son halkasında.
- IDE taşıma, kişi yetkilerinin devir işlemini başlatmıyor; M1'in sonraki kural değişikliğine güvenmek güvenli bir kurulum kapanışı değil (C-02).
- Köprü mesajı anonimleştirmesi, backend'in kullandığı hata sınıflarını siliyor; mesaj gizliliği ile makinenin okuyacağı hata kodu ayrılmalı (C-03).
- Olay tekilleştirme, gerçek olay zamanı ve kaynak/okuyucu yönü PDKS'e girmeden tutarlı olmalı; yalnız rapor katmanında çift kayıt süzmek yeterli değil.
- Haftalık açık/kilitli ve doğrulama planında kaydetme/gönderme revizyonu ve cihaz/kapı proje eşleşmesi korunuyor (`convex/doors.ts:650`, `convex/lib/gatewayCommand.ts:699`). Çok kapılı Hik ve tatil kapasitesi fiziksel teyit gerektiriyor; burada yeni bir kesin plan hatası çıkarılmadı.

## 5. Eski audit durumu

Referanslar: `docs/genel-akis-audit/C-kurulum-cihaz-yonetim.md`, `A-kisi-erisim.md`, `OZET.md`. Aşağıdaki satırlar M2 kapsamındaki eski bulguları/adımları birleştirir; aynı kök neden yalnız bir kez değerlendirilir. M1/M3/M4'ün saf kişi/hesap/puantaj maddeleri bu raporun sahipliğinde değildir.

| Eski madde | Durum | Güncel kanıt / kalan iş |
|---|---|---|
| C bulgu 1 / C5-6 / OZET 1.2: düşük rol topoloji yazımı, başka proje cihazına kapı bağlama | DÜZELDİ | `convex/doors.ts:276`, `:297`; `convex/zones.ts:46`; `convex/readers.ts:126`. Yetki ve hedef cihazın aynı proje kontrolü var; C-01 fiziksel IDE kimliği üzerinden farklı bir yol. |
| C bulgu 2: çalışan audit geçmişinde proje sızıntısı (M4 ortak bağ) | DÜZELDİ | `convex/auditLog.ts:31`, `:43`, `:46`: çalışan yetkisi + hedef indeksleri + proje süzmesi. |
| C2c havuz parolaları ve tahsis kodu eksikliği | AÇIK | `convex/adminDevices.ts:56`, `:65`: herhangi bir projesinde cihaz yönetebilen kullanıcı ortak boş havuzdaki parolaları alır; müşteri tahsisi yok. Yeni sayımda yok. |
| C bulgu 3 / C2b-3/4/5 / OZET 5.1: Windows roster kopukluğu | AÇIK | Ürünün ertelenmesi hata sayılmadı; aktif web hâlâ localBridge seçtiriyor (`src/components/devices/form-sections/DeviceHikvisionSection.tsx:52`) ve “tek anahtar” kurulum açıklıyor (`src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:65`), oysa `convex/http.ts:494` roster yok. Aktif yönlendirme kapatılmalı/ertelendi denmeli. |
| C1-4, C bulgu 5 / OZET 5.3: ilk kurulum kontrol listesi | DÜZELDİ | `src/pages/Index.tsx:24` SetupChecklist gösteriyor; dış cihaz hazırlığının otomatikleştiği anlamına gelmiyor. |
| C2a-1 / OZET 5.3: K1T804 katalog eksikliği | DÜZELDİ | `convex/lib/hikModels.ts:43` DS-K1T804 tanımlı. |
| C2a-2/5, C2c-1/2/3/5, C2d-1/2/3/5: teknik hazırlık ve ilk fiziksel geçiş | KISMEN | Hik gateway kayıt ve IDE MQTT/yerel provizyon zinciri mevcut; ISUP sunucu ayarı, IDE yerel ajanı ve ESP32 ağ ayarı hâlâ harici (`convex/lib/gatewayCommand.ts:87`, `scripts/ide-provision-agent.mjs:123`, `scripts/forward-card-reader-to-convex.mjs`). Fiziksel kabul teyit edilmedi. |
| C3-1: kart sessizliğinde Hik'i offline gösterme | DÜZELDİ | Taze ISUP durumunu esas alan `convex/lib/deviceConnection.ts:16`, `:37`; köprü saatlik snapshot (`infra/hik-event-bridge/bridge.mjs:321`). Köprü durursa eski sinyale dönüş ayrı canlı teyit konusu. |
| C3-2: kesinti geçmişi ekranı | KISMEN | Backend `convex/deviceEvents.ts:180` duruyor, aktif UI çağrısı bulunmadı; `1edb22ae` geçmiş görünümünü kaldırmış. Yeni eksiklik diye sayılmadı. |
| C3-3 / C bulgu 4 / OZET 5.2: offline alarm | KISMEN | Hik ISUP offline için gecikmeli alarm var (`convex/devices.ts:1030`, `:1047`); IDE/generic kesintisi hâlâ ancak yeniden sinyalde alarm (`convex/lib/deviceConnection.ts:62`). |
| C4-4/5 / OZET 5.2: e-posta hata görünürlüğü, eski olay bildirimi | DÜZELDİ | Ortak tazelik ve queued/failed alanları (`convex/lib/alarmNotify.ts:31`, `:49`), gönderim sonucu `convex/actions/sendAlarmEmail.ts`; M4 ayrıntı audit'ine devredilir. |
| C4-1/2 / C bulgu 4: IDE kart dışı alarm kapsamı | AÇIK | `/ide-bridge/event` kart yoksa heartbeat olarak bitirir (`convex/http.ts:359`); IDE özgü alarm üretim dalı yok. |
| C3-4/5: IDE sent timeout kurtarma ve kuyruk görünürlüğü | KISMEN | Timeout mutation mevcut (`convex/ideSync.ts:523`) fakat cron bilinçli kapalı (`convex/crons.ts:60`); banner yalnız failed okur (`convex/ideSync.ts:670`). Kapalı poll/cron tek başına yeni bulgu değil; yeniden açılış kontrolü gerekir. |
| C3-6/7: haftalık planın destek sınırı ve gönderim sonucu | KISMEN | Haftalık/tatil/toplu planlar ve revision koruması gelişmiş (`convex/doors.ts:547`, `:650`); uygulama hâlâ Hik gateway'e sınırlı (`convex/lib/gatewayCommand.ts:720`). Cihaz teyidi açık. |
| C3-8: heartbeat/liste aboneliği ve sınırsız koleksiyonlar | AÇIK | `convex/devices.ts:58`, `:76` tüm cihaz/topolojiyi okuyor; sağlık alanları aynı cihaz belgesinde güncelleniyor (`convex/devices.ts:1005`). Yeni yönergede ayrı hareketli durum tablosu ve sınırlı sorgu önerisine aykırı; gerçek maliyet ölçülmedi. |
| A1-8: Hik kişi başarılı/kart başarısızken başarı sayacı | KISMEN | RunId varsa kart hatası başarısız; doğrudan kişi senkronunda `ok:true, grantError` kalıyor ve synced artıyor (`convex/lib/hikSyncEmployee.ts:296`, `:303`, `:313`). |
| A2-4/6: çok kapı / taşıma yöntemi farkı | KISMEN | Gateway `doorPlans` yazar (`convex/lib/hikSyncEmployee.ts:269`); localBridge ürün olarak ertelendi, payload ve aktif seçim hâlâ var (`:255`). Windows geliştirilmeli diye yeni bulgu çıkarılmadı. |
| A2-5: IDE bozuk kapı seçiminin bütün panele genişlemesi | AÇIK | `convex/ideSync.ts:649` boş io kümesinden bütün kapılara fallback yapar (`:651`); açık seçim vardı ama sayısal io çözülemedi ayrımı yok. |
| A2-7/8, A4-8: kişi×cihaz durum ve eski yetki onayı | KISMEN | Run sonuçları sent/verified/unknown ayrımı taşıyor (`convex/lib/deviceSyncRun.ts:34`); eski kart/ziyaretçi IDE silme sonucunun kişiye bağlanmaması sürüyor (`convex/lib/grantStatus.ts:97`). |
| A3-2 / A6-4: genel fiziksel kartta başlangıç/bitiş ve pasif cihaz | DÜZELDİ | `convex/lib/processCardReadingCore.ts:355`: kişi aktifliği, erişim zamanı, cihaz varlığı/aktifliği birlikte reddeder. |
| A bulgu 5 / A3-3 / OZET 1.5: kartı başka proje kişisine bağlama | DÜZELDİ | Canlı ve tarihsel giriş `findDeviceCardEmployee` kullanıyor (`convex/cardReadings.ts:453`, `:820`), normal cihazda proje içi eşleşme. Projesiz legacy fallback ayrıca sınırlandırılmalı; yeni global eşleştirme açığı iddiası yapılmadı. |
| A3-4: canlı izleme Hik kapı filtresi | AÇIK | `convex/cardReadings.ts:156` kapı için `ioId` şartı arar; Hik kapısında yok. `:198` filtre IDE cihaz+io indeksidir. |
| A3-5: biyometri/belirsiz kaynak PDKS dışlama | DÜZELDİ | Mevcut doğru davranış korunuyor (`convex/lib/pdksSource.ts:44`, `:73`); biyometrinin dışarıda olması kasıtlı karar. |
| A bulgu 2'nin kapı açma kısmı / A3-6 | DÜZELDİ | `project_user` kapı açabilir kararı korunuyor, proje bazlı `doors.open` denetleniyor (`convex/actions/ideGatewayDevice.ts:391`, `convex/lib/gatewayCommand.ts` remote-open yolu). Rolü daraltma önerisi yapılmadı. |
| A4-2 / OZET 2.1: kart değişiminde eski Hik kartı silinmiyor | DÜZELDİ | `convex/lib/employeeCardChange.ts:27` eski kart+snapshot ile siler, sonra yeni kimliği senkronlar. |
| A4-6 / OZET 2.2: kural silmede eski Hik hedefi kayboluyor | DÜZELDİ | `convex/accessRules.ts:857` eski hedef/kişi snapshot'ı; `convex/lib/peopleHikSnapshot.ts:118` kaldırılan hedefleri temizler. |
| A5-4: yalnız groupDoors ile verilen erişim kişi silmede kaçıyor | DÜZELDİ | Ortak `resolveRuleDeviceTargets` yolu ve uygulanmış izin geçmişi (`convex/lib/peopleHikSnapshot.ts:30`, `:41`, `:134`). |
| A bulgu 3 / A5-5 / OZET 2.3: silinmiş kişi için Hik retry yapılamıyor, silme hatası gizleniyor | DÜZELDİ | Kuyruk payload'undaki eski kimlik kullanılıyor (`convex/actions/hikQueueWorker.ts:145`); silmeler temizlikten muaf (`convex/hikvisionSync.ts:1008`); tek silmeyi retry mümkün (`:1086`). Tarama adaleti C-08 ayrı yeni sorun. |
| A5-3: ayrılma tarihinin cihazda önceden bitişe çevrilmemesi | AÇIK | Hik sadece beginTime gönderiyor (`convex/lib/hikSyncEmployee.ts:270`), IDE userRecord yalnız start taşıyor (`convex/actions/ideGatewayDevice.ts:208`); offline panel bitişi cron+teslime bağlı. |
| A5-6: parmak silme/çevrimdışı takip | KISMEN | Eski cihaz kimliği ve silme snapshot'ı var (`convex/lib/employeeCardChange.ts:36`); günlük tekrar `convex/crons.ts:100`; fiziksel imha model bazlı teyit gerekir. |
| A5-7 / C6-7: kişi silmede ham olay verisi | AÇIK | `convex/lib/employeeCascade.ts:64` yalnız ad/kartı maskeler; rawData ve Hik metadata aynı işlemde temizlenmez. M1/M4 ile ortak veri saklama işi. |
| A bulgu 4 / A6-3 / OZET 2.4: ziyaretçi zaman aralığının cihaza yazılmaması | KISMEN | Gelecek başlangıç Hik/IDE'ye artık yazılıyor (`convex/lib/hikSyncEmployee.ts:270`, `convex/actions/ideGatewayDevice.ts:142`); bitiş yok, Hik varsayılan 2037 (`convex/lib/gateway/persons.ts:111`). |
| A6-5: kural kaldırıldıktan sonra ziyaretçi Hik temizliği | KISMEN | Geçmiş hedeflerden silme yolu mevcut (`convex/lib/hikSyncEmployee.ts:121`); ancak eski kartın iade yarışı aşağıdaki gibi açık. |
| A6-6: ziyaretçi çıkışı/kart iadesinde eski kimliğin kaybı | AÇIK | CheckOut Hik'e yalnız employeeId zamanlıyor (`convex/visitors.ts:506`), releaseCard numarayı değiştiriyor (`:532`). Action çalışmadan iade olursa snapshot eski kimliği korumuyor. |
| A6-7 / A4-3: IDE eski kart/ziyaretçi silmesi kişi durumunu güncellemiyor | AÇIK | `convex/visitors.ts:513`, `:572` employeeId taşımıyor; `convex/lib/grantStatus.ts:97` bu işleri atlıyor. |
| A teyit 10: gecikmiş Hik olayında cihaz zamanı yerine alış zamanı | AÇIK | `convex/lib/processCardReadingCore.ts:63`, `:220`: canlı accessTime=şimdi; cihaz zamanı sadece metadata. Backfill aynı serial'ı görünce düzeltmeden geçer (`convex/cardReadings.ts:808`). |
| OZET 2.5: eski kart/kural/offline/ziyaretçi saha kabulü | KISMEN | Kod testleri var ve aşağıda geçti; fiziksel cihaz deneyi bu görevde yasak olduğundan tamamlandı sayılamaz. |
| 7e131a49 / 47ae87d7: Hik taşıma / ehome tekilliği / online olunca cleanup | DÜZELDİ | `convex/lib/deviceAssignment.ts:113`, `convex/lib/deviceProvision.ts:16`, `convex/devices.ts:997`: engel, tekillik ve yeniden tetikleme mevcut; özel testler geçti. |

## 6. Test boşlukları ve yapılan doğrulama

Çalıştırılan tek hedefli komut:

```sh
node_modules/.bin/vitest run convex/ideSync.test.ts convex/processCardReading.characterization.test.ts convex/virtualReaders.test.ts convex/lib/deviceProvision.ehomeId.test.ts convex/lib/deviceAssignment.hik.test.ts convex/actions/hikQueueWorker.test.ts convex/lib/cardReadingProcess.direction.test.ts
```

**Sonuç: 7 dosya, 143 test geçti.** Tam suite, paket kurulumu, build, DB bağlantısı veya Convex CLI çalıştırılmadı. Tip/lint genel sağlığı için ayrıca tüm proje kontrolü çalıştırılmadı; bu rapor onun yerine geçmez.

Kritik boşluklar (en fazla 8):

1. İki projede aynı IDE UUID'sini genel create/update ile verme ve kendi kapısından farklı fiziksel panele komut çıkmasını engelleme (C-01).
2. IDE release/reassign/claim sonrası eski UUID roster'ı temizlenmeden yeni projeyi açmama (C-02).
3. Gerçek bridge hata dönüşümünü de içeren `already exists`→update ve `not found`→terminal başarı sözleşmesi (C-03); yalnız markAck birim testi yeterli değil.
4. İlk 10 orphan veya login'i başarısız IDE işi arkasındaki sağlıklı komutun ilerlemesi; önde 60 terminal/offline Hik işi varken eski silmenin ilerlemesi (C-04/08).
5. Aynı olayın iki teslimi, canlı/backfill yarışması, geliş sırası farklı geçmiş olaylar; bir olayın tek satır ve tek yön değişimi üretmesi (C-05, eski zaman hatası).
6. MQTT→Convex event/ACK HTTP başarısızlığı, bridge yeniden başlatma ve kalıcı teslim/tekilleştirme (C-06); web kapı açma komutunun süresi (C-09).
7. Hik 1.500 olay sınırı üzerinde devam, kısmi tarama ve tamamlanma zamanının doğru ilerlemesi (C-07).
8. Okuyucu yönünü değiştirme→canlı kayıt→PDKS nokta tipi uçtan uca eşliği ve HTTP bozuk/büyük payload cevapları (C-10/11).

## 7. TEYİT GEREK ve kapsam dışı

**TEYİT GEREK (canlı/cihaz):**

- IDE panel firmware'inin mevcut kayıt için hata kodu/metni, update_data davranışı ve web `keep:1` komutunun kalıcı açık konum etkisi; ayrı test panelinde doğrulanmalı.
- Aktif IDE bridge sürümü, poll açık/kapalı durumu, TLS ve UUID bazlı ACL'nin gerçek dağıtımı; kaynak yapılandırması canlı uygulandığı anlamına gelmez.
- UUID/seri tekrarları, projeler arasında taşınmış IDE roster'ları ve kuyruk başındaki orphan kayıtların mevcut sayısı; DB sorgulanmadı.
- Hik köprü saat dilimi, K1T807'nin fiziksel seri no/event alan eşleşmesi, K1T804/K1T807 ISUP online/offline sinyali ve snapshot davranışı; seri no gereksinimi yalnız UI'da doğrulanmış sayılmamalı.
- Hik çok kapı planı, tatil kapasitesi, başlangıç/bitiş tarihleri ve offline yetki geri alma; cihaz cevabı ile fiziksel geçiş ayrı kanıtlar.
- HTTP platform/ters vekil boyut ve hız sınırları; eski token'sız modun kapalı olması. Ortam değişkenleri okunmadı, varsayılan kapalı kodu incelendi.
- Sanal okuyucunun tablet kamera/HTTPS davranışı ve QR'nın fiziksel ekrandan okutulması; sunucu tek kullanım testleri fiziksel kiosk testi değildir.

**Kapsam dışı:**

- Windows ürününü yeniden geliştirme; yalnız aktif web/endpoint bağındaki kopukluk değerlendirildi.
- PDKS ücret/SGK/vardiya hesapları, rol kataloğunun tamamı, hesap yönetimi ve mobil ekranların tamamı: M3/M4/M5 sahipliğinde; M2 arayüzleri bölüm 4'te devredildi.
- Eski A1 yüz kayıt UI'si, dinamik departman üyeliği, A6 ziyaretçi PIN/QR ürün geliştirmesi ve C6 genel KVKK/ayar politikaları M1/M4 sahipliğinde. C4 alarm ekranı export/onay notu gibi saf UI maddeleri M4'e bırakıldı.
- Fiziksel cihaz, broker, canlı servis, ağ, tarayıcı, Netlify, Supabase ve DB işlemi yapılmadı; hiçbir kod dosyası veya git durumu değiştirilmedi. Yazılan tek dosya bu rapordur.
