# 07 — Cihaz seçimi ve tercihler

## Sonuç ve inceleme sınırı

19 Ekim 2026 tarihli mevcut çalışma ağacında cihaz seçimi gerçek çalışan oturumuyla Convex'e bağlıdır. Listeleme, arama, seçim ve yerel saklama uygulaması vardır; ancak tercih kullanıcı/proje kimliğine bağlı değildir ve geçerliliği yeniden doğrulanmaz. “Kapıyı Aç” işlemi fiziksel açma komutu üretmeden gerçek bir kart okuma kaydı oluşturur. Backend kararında pasif cihaz/saat kısıtı ve proje eşitliği eksikleri, kapı bazlı izinleri listelemede ise kapsam kaybı vardır.

**8 bulgu: P0: 0, P1: 4, P2: 4, P3: 0.** Bulguların kesinliği **kaynak analizi**dir; cihazda veya canlı backend'de yeniden üretildiği iddia edilmez. Güvenlik bulgularında aşağıda tanımlanan önkoşullar geçerlidir. Test yokluğu bağımsız işlevsel bug olarak sayılmamıştır.

Bu worker yalnız dosya okuma/arama ve bu raporun yazımını yaptı; Flutter test/analyze/pub get/build, formatlama, deploy, commit, push ve veri mutasyonu yapmadı. Önceden mevcut web/Convex değişiklikleri korunmuştur. Kaynak referansları HEAD'den ziyade incelenen çalışma ağacına aittir; eşzamanlı değişikliklerle satırlar kayabilir. Dış teknoloji iddiasına ihtiyaç duyulmadığından internet kaynağı kullanılmamıştır.

Koordinatörün [baz doğrulaması](../evidence/baseline.md), `flutter analyze --no-pub` için “No issues found” ve `flutter test --no-pub --reporter expanded` için 44 testin geçtiğini bildirir. Bu, modüldeki güvenlik/tercih zincirlerinin, kamera ve fiziksel kapının doğrulandığı anlamına gelmez. Aşağıdaki yeni kabul senaryoları henüz çalıştırılmamıştır.

## İncelenen dosyalar ve gerçek akış

Hedef kapsamın tamamı satır satır tarandı:

| Dosya | İncelenen kapsam / sorumluluk |
| --- | --- |
| `mobile/lib/screens/settings/select_device_screen.dart:1` | Tamamı, 182 satır; settings dizinindeki tek dosya. Yükleme, arama, hata/boş durum, seçim. |
| `mobile/lib/providers/preferred_device_provider.dart:1` | Tamamı, 41 satır; bootstrap, iki yerel anahtar, set/clear. |
| `mobile/lib/repositories/device_repository.dart:1` | Tamamı, 14 satır; çalışan sorgusu. |
| `mobile/lib/models/device.dart:1` | Tamamı, 49 satır; JSON ve altyazı. |

Bağlam için okunan dosyalar/bölümler:

| Dosya / satır | Neden |
| --- | --- |
| `AGENTS.md:1`, `convex/_generated/ai/guidelines.md:1` | Yerel kurallar; Convex yönergelerinin tamamı backend okunmadan önce okundu. |
| `mobile/lib/main.dart:32`, `mobile/lib/providers/auth_provider.dart:40`, `:71`, `:113`, `:132`, `:142` | Provider ömrü, oturum açma/kapatma, expiry ve tercih ayrılığı. |
| `mobile/lib/router/app_router.dart:43`, `:76`; `mobile/lib/screens/profile/profile_screen.dart:181` | Auth yönlendirmesi ve seçim ekranına giriş. |
| `mobile/lib/screens/home/home_screen.dart:172`, `:225`; `mobile/lib/l10n/app_tr.arb:113`, `mobile/lib/l10n/app_en.arb:113` | Tercihin tüketimi, hızlı açma ve kullanıcı metinleri. |
| `mobile/lib/config/convex_config.dart:118`, `:225`, `:266`; `mobile/lib/core/errors.dart:8`; `mobile/lib/core/error_localizer.dart:12` | Çalışan tokenının eklenmesi, transport, retry ve hata sunumu. `.env` okunmadı. |
| `mobile/lib/providers/attendance_provider.dart:61`, `:128`, `:283`; `mobile/lib/repositories/attendance_repository.dart:13`, `:22` | Hızlı açma ile QR'ın ortak mutation'a ulaşması, kayıtların UI etkisi. |
| `mobile/lib/models/attendance.dart:36` | Geçmiş API'sindeki cihaz metadata'sının mobil modelde korunması. |
| `mobile/lib/models/qr_code_model.dart:1`; `mobile/lib/screens/qr_scan/qr_scan_screen.dart:24`, `:46`, `:460`, `:481`, `:518` | QR biçimi, ayrı kişisel token akışı, cihaz QR doğrulaması; tarama tercihi değiştirmiyor. |
| `convex/devices.ts:87`, `:254`; `convex/lib/customFunctions.ts:113`; `convex/lib/employeeAuth.ts:7` | İzinli cihaz listesi, cihazı pasife alma yolu, gerçek çalışan kimliği. |
| `convex/cardReadings.ts:1352`; `convex/lib/cardReadingProcess.ts:37`; `convex/lib/cardReadingAudit.ts:13`, `:128` | Karar/kayıt, yön hesaplama ve cihaz verisinin geri okunması. |
| `convex/schema.ts:395`; `convex/accessRules.ts:861`; `convex/lib/accessGraph.ts:96`, `:117` | Cihaz/kapı erişim ilişkileri ve zaman kısıtı sözleşmesi. |
| `convex/lib/accessScopeRelations.ts:5`, `:52`; `convex/lib/accessScope.ts:2`; `convex/lib/auth.ts:117` | Mevcut ilişki yazma korumaları ve proje kapsamı karşılaştırması. |
| `convex/actions/ideGatewayDevice.ts:263`; `convex/lib/accessRuleUx.ts:1` | Kural saat/günlerinin fiziksel izin hattında kullanılması. |
| `src/components/devices/QRCodeDialog.tsx:13` | Web QR'ının geçiş yetkisi olmayan seri kimlik etiketi olması. |
| `mobile/test/repositories/attendance_repository_test.dart:10`, `:53`; `mobile/test/providers/attendance_provider_test.dart:14`, `:181`; `mobile/test/` dosya envanteri | Mevcut mock testlerinin sınırı; testler bu worker tarafından çalıştırılmadı. |
| `docs/mobile-audit/evidence/baseline.md` | Koordinatörün ortak doğrulama sonuçları. |

Tablodaki **çalışıyor** ifadesi yalnız kaynaktaki bağlı uygulamayı belirtir; canlı E2E başarısı değildir.

| Capability | Durum | Gerçek davranış ve sınır |
| --- | --- | --- |
| Profile → cihaz seçimi | çalışıyor | `profile_screen.dart:181` → `/select-device`; router auth şartı koyar (`app_router.dart:59`). |
| Çalışan kimliğiyle listeleme | çalışıyor | Repo `devices:listForEmployee` çağırır (`device_repository.dart:11`); token transportta eklenir; backend session süresi ve çalışan aktifliği doğrulanır. Demo liste yok. |
| İzinli aktif cihazlar | kısmi | Proje+çalışan üyeliği → aktif kural → `groupDevices` → aktif cihaz. `groupDoors` yolu dışarıda kalır; gün/saat uygunluğu döndürülmez (`devices.ts:96–145`). |
| Arama ve seçili işareti | çalışıyor | İsim/seri/bölge/kapı araması; ID eşitliğiyle seçim işareti (`select_device_screen.dart:51`, `:138`). |
| Yükleme / hata / boş liste | kısmi | Spinner, retry, yetki listesi boşluğu ve arama eşleşmemesi ayrılır (`:98–130`). Başarılı/boş durumda yenileme yok; teknik hata metni doğrudan gösterilir. |
| Tercihin kalıcı olması | kısmi | ID ve ad ayrı SharedPreferences anahtarlarıyla saklanır; hesap/proje bağlamı, kayıt durumu, geçerlilik kontrolü yok. |
| Eski tercihi temizleme | kısmi | Provider `clear()` sunar (`preferred_device_provider.dart:33`); mobil lib tüketicilerinde çağrısı ve kullanıcıya temizleme eylemi yok. |
| Hızlı açma | kısmi | Gerçek `cardReadings:selfCheckIn` çağrısı ve gerçek kayıt yazımı vardır; fiziksel komut/sonuç zinciri yok. Başarılı erişim kararı, fiziksel kapının açıldığı kanıtı değildir. |
| QR ile ilişki | kısmi | QR tarama ve tercih aynı `selfCheckIn` yolunda birleşir; QR taramak tercih seçmez. `QRCodeGenerator` base64/JSON cihaz yükü bekler; webdeki seri kimlik etiketi farklı sözleşmedir. |
| “Benim QR'ım” ile tercih ilişkisi | kanıtlanamadı | Ayrı `employeeCheckIn:createMyCheckInToken` çağrısı vardır (`qr_scan_screen.dart:53`); bu audit tokenın donanımda okunma zincirini incelemedi. Tercih bu çağrıya gönderilmez. |
| Fiziksel kapı, çevrimdışı cihaz ve üretim tenant izolasyonu | kanıtlanamadı | Cihaz/canlı backend denemesi yapılmadı. Kaynakta gösterilen eksikler aşağıdaki bulgulardır. |

## İyi çalışan temeller

- Liste API'sine frontend `employeeId`/`projectId` göndermez; çalışan backend session kaydından türetilir (`device_repository.dart:11`; `customFunctions.ts:117`; `employeeAuth.ts:11–22`). Bu, istemcide çalışan ID değiştirerek liste seçme yolunu kapatır.
- Üyelik ve cihaz bağlantıları proje bileşik indeksleriyle okunur; cihazlar ve kurallar benzersizleştirilir, null kayıtlar tip koruyan predicate ile atılır (`devices.ts:96–132`). Dönen DTO sır içeren cihaz belgesinin tamamını açmaz (`:138–145`).
- Geçerli backend DTO'sundaki camelCase alanlar mobil modele karşılık gelir. Modelde bölge/kapı yoksa seri altyazı olarak kullanılabilir (`device.dart:20–38`).
- Liste beklenirken ekran ayrılırsa `mounted` kontrolü geç gelen sonucun state'e yazılmasını önler (`select_device_screen.dart:37`, `:43`). Hata tekrar deneme düğmesi vardır; boş yetki listesiyle aramada sonuç bulunamaması ayrıdır.
- Yeni erişim ilişkilerini yazan yol aynı proje doğrulaması yapar (`accessRules.ts:878–880`; `accessScopeRelations.ts:14–28`). Bu nedenle yalnız listede son DTO proje kontrolü bulunmamasından “normal oluşturma akışıyla tenant aşılır” sonucu çıkarılmadı.
- Hızlı açma/QR frontend kararına güvenmek yerine backend'de grup kesişimini kontrol eder. Ancak bu kontrolün eksik kapıları F02/F03'te açıklanmıştır.

## Bulgular

### DEV-F01 — Tercih kullanıcı/proje kapsamında değil; eski tercihi kurtarma akışı yok

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** `preferred_device_provider.dart:7–8` sabit global anahtarlar; `:17–30` yalnız ID/ad yükler ve kaydeder. `main.dart:49`, `:76–78` providerı uygulama ömrünce tutar; AuthProvider'a bağlayan proxy yalnız AttendanceProvider içindir (`:79–84`). `auth_provider.dart:113–148` logout/expiry sırasında yalnız auth temizler. Profil adı doğrudan gösterir (`profile_screen.dart:186`), home yalnız `hasDevice` kontrol eder (`home_screen.dart:230–245`). Liste sonucu tercihle uzlaştırılmaz (`select_device_screen.dart:36–41`); `clear()` tüketilmez.
- **Tetikleyici:** A hesabı cihaz seçer → çıkış → B hesabı girer; veya seçili cihaz silinir/üyelik kaldırılır/cihaz yeniden adlandırılır → uygulama yeniden açılır.
- **Beklenen / mevcut:** B'nin kendi bağlamındaki geçerli tercihi veya “seçilmedi” görülmeli; mevcutta A'nın ID/adı kalır. Silinmiş/izni kalkmış cihaz seçili kalır; listedeki yokluk tercihi temizlemez. Kullanıcı tercihini açıkça kaldıramaz.
- **Etki:** Paylaşılan telefonda önceki hesaba ait cihaz adı görünür; kullanıcı yanlış/eski hedefe istek yollar, reddin nedenini anlayamaz. Bu bulgu tek başına fiziksel yetki aşımı değildir; backend ayrı karar verir.
- **Kök neden / çözüm:** Kimliksiz, doğrulanmayan kalıcı tercih. Kullanıcı+proje+backend bağlamlı kayıt, auth değişiminde bellek sıfırlama, eski global kaydın güvenli migrasyonu, listeyle uzlaştırma ve açık “seçimi kaldır” eylemi eklenmeli. Ağ hatasıyla gerçekten yetki kaldırılmasını birbirine karıştırmayan durum modeli kurulmalı.

### DEV-F02 — Karar anında pasif cihaz ve kuralın saat/gün kısıtları uygulanmıyor

**P1 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** Liste pasif cihazı atar (`devices.ts:131–132`); yönetim güncellemesi `isActive=false` yazabilir (`:337–342`). Eski tercih ise doğrudan `quickUnlock(deviceId)` ile gönderilir (`home_screen.dart:245`; `attendance_provider.dart:310`). `cardReadings.ts:1385–1425` cihazı alır, yalnız ortak kuralın `isActive` değerine bakar; `device.isActive`, kural `days/startTime/endTime` kontrolü yoktur. Ardından `hasAccess` ile onaylı okuma yazılır (`:1433–1447`). Saat/günler gerçek model alanlarıdır (`schema.ts:400–402`), oluşturulurken doğrulanır (`accessRules.ts:882`) ve panel izin paketine taşınır (`ideGatewayDevice.ts:303–306`). `resolveDirection` yalnız yön hesaplar (`cardReadingProcess.ts:37–72`).
- **Tetikleyici:** Tercih edilen cihaz pasife alınır, aktif grup bağı korunur ve hızlı açma kullanılır. Alternatif olarak yalnız hafta içi 09:00–18:00 kuralı olan çalışan kapsam dışı saatte aynı işlemi yapar.
- **Beklenen / mevcut:** Erişim kararı cihaz aktifliğini ve sunucu saatinde izin penceresini uygulamalı; mevcut kod aktif grup kesişimini yeterli sayıp `granted=true` ve `izin_verildi` kaydı üretir.
- **Etki:** Pasife alma/zaman kısıtı mobil kayıt yolunda etkisiz kalır; katılım ve denetim verisi yanlış onaylı hareket içerir. Fiziksel kapının bu işlemle açıldığı ileri sürülmez; F04'te komut eksikliği ayrıca ele alınır.
- **Kök neden / çözüm:** Liste uygunluğu ve işlem yetkilendirmesi farklı, eksik kurallarla yazılmış. İşlem anında ortak sunucu değerlendiricisiyle aktif cihaz, aktif kural ve gün/saat/zaman dilimi kapılarını uygulamak; listeyi anlık açılabilirlik iddiasından ayırmak gerekir.

### DEV-F03 — Yabancı proje cihazı reddedilse de kendi geçmişine bağlanıp metadata döndürülebiliyor

**P1 · Kesinlik: kaynak analizi; geçerli yabancı cihaz ID'sinin veya serisinin bilinmesi önkoşuldur.**

- **Kanıt zinciri:** Public çalışan mutation'ı `deviceId` veya seri alır (`cardReadings.ts:1377–1398`); cihaz ile çalışan projesini karşılaştırmaz. Cihaz gruplarını cihaz projesinde, üyelikleri çalışan projesinde okur (`:1401–1416`); eşleşme yoksa `hasAccess=false` kalır. Buna rağmen çalışan projesi altında yabancı `deviceId` ile kayıt ekler (`:1433–1444`). Çalışanın geçmişi `employeeId` ile çekilir (`:1356–1368`). Zenginleştirme bağlı cihazları proje filtresiz yükler (`cardReadingAudit.ts:13–28`) ve ad/açıklama/seri döndürür (`:128–145`). Mobil `AttendanceRepository.list` bu query'ye ulaşır (`attendance_repository.dart:13–17`); `attendance.dart:36–46` alanları cihaz bilgisine taşır.
- **Tetikleyici:** A projesindeki geçerli çalışan oturumuyla B projesinin bilinen cihaz ID'si/serisi için selfCheckIn çağrısı; ardından kendi geçmiş sorgusu. Sıradan seçici bu hedefi normalde sunmaz; doğrudan API çağrısı veya önceki hesap tercihi yolu önemlidir.
- **Beklenen / mevcut:** Proje eşitliği uyuşmuyorsa hedefe bağlı normal okuma oluşturmadan erişim reddedilmeli; geçmiş zenginleştirmesi de yabancı metadata'yı açmamalı. Mevcutta geçiş reddedilir fakat yabancı cihaz adı/açıklaması/serisi çağıranın geçmiş API yanıtına taşınabilir.
- **Etki:** Tenant metadata izolasyonu bozulur, kendi projede yabancı cihaz ilişkili reddedilmiş kayıt oluşur. Kapı yetkisi kazanıldığı veya cihaz sırlarının döndüğü iddia edilmez; kanıtlanan alanlar yukarıdaki DTO'dur.
- **Kök neden / çözüm:** İlişki indekslerinin scope'u son belge proje kontrolünün yerine kullanılmış; erişim reddi logu normal okuma ve DTO zincirine bağlanmış. Cihazı çalışan projesine doğrula; seri aramasını aynı scope'ta çöz; kural/bağlantı projelerini doğrula. Savunma olarak geçmiş zenginleştirmesinde de okuma/çalışan/cihaz proje uyumunu denetle. Güvenlik reddini hedef metadata'sını açmayan ayrı audit sözleşmesiyle kaydet.

### DEV-F04 — “Kapıyı Aç” fiziksel işlem olmadan katılım kaydı yazıyor

**P1 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** UI etiketi `app_tr.arb:116` “Kapıyı Aç”; `home_screen.dart:183–188` bunu hızlı eyleme bağlar. `:245–255` → `attendance_provider.dart:310–327` → `attendance_repository.dart:32–37` yalnız `cardReadings:selfCheckIn` çağırır ve `granted` booleanını okur. Mutation'ın tüm gövdesi (`cardReadings.ts:1382–1447`) grup kararı, yön hesabı ve `cardReadings` insert'inden oluşur; kapı komutu, action, scheduler, operasyon/ack kaydı yoktur. Çağırdığı `resolveDirection` da yalnız geçmişi okur (`cardReadingProcess.ts:37–72`). `attendance_provider.dart:331–332` onaylı sonuçtan sonra geçmişi yeniler; `:67–125` bu kayıtları giriş/çıkış durumuna katar.
- **Tetikleyici:** Yetkili cihaz seçili çalışan ana ekranda “Kapıyı Aç”a basar; fiziksel geçiş/cihaz onayı gerçekleşmez.
- **Beklenen / mevcut:** Ürün kapı açma sunuyorsa hedef kapı/aktüatör komutu ve gözlemlenebilir işlem sonucu gerekir. Mevcut kod backend onayını başarı gösterir ve gerçek katılım kaydı üretir. Kayıt/simulasyon niyeti varsa UI sözleşmesi bunu söylemelidir.
- **Etki:** Kullanıcı işlem başarılı sanabilir, gerçek kapı açılmadan giriş/çıkış durumu değişebilir. Bu bir demo liste değildir: donanım adımı eksik olsa da yazılan veri gerçektir. Hızlı tekrar basmada UI/method girişinde bekleyen işlem kontrolü yoktur (`home_screen.dart:225–245`; `attendance_provider.dart:314–325`); ayrı istekler yön toggle'ıyla ek hareket üretebilir.
- **Kök neden / çözüm:** Attendance check-in yolu, donanım komutu sözleşmesi olmadan “unlock” olarak yeniden kullanılmış. Ürün kararıyla ya ayrı kapı komutu/operasyon durumu/ack akışı kurmak ya da eylemi açıkça mobil check-in olarak sunmak gerekir. Komut isteği ile fiziksel geçiş kaydı ayrılmalı; tekrar dokunma ve belirsiz timeout için operasyon kimliği/idempotency tasarlanmalı.

### DEV-F05 — Yalnız kapı bağıyla verilen izin cihaz listesinde görünmüyor

**P1 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** `createWithGroups` `employeeIds`, `deviceIds`, `doorIds` değerlerini ayrı ve opsiyonel kabul eder (`accessRules.ts:873–875`). `doorIds` için `groupDoors` yazar (`:918–930`); bu bacakta `groupDevices` yazımı yoktur. Kanonik grafik cihaz VE kapı bacağını tanımlar (`accessGraph.ts:96–108`, `:126–148`), şema kapı granülerliğini destekler (`schema.ts:445–457`). Mobil liste ise yalnız `groupDevices` toplar ve sonuç yoksa boş döner (`devices.ts:114–129`). `selfCheckIn` de yalnız cihaz-grup bağlantısına bakar (`cardReadings.ts:1401–1416`). Mobil Device DTO'su yalnız tek cihaz ID'si ve bir kapı adı taşır (`device.dart:4–17`), kapı/IO kimliği taşımaz.
- **Tetikleyici:** Aktif çalışana aktif kuralda belirli bir panele bağlı kapı atanır; `deviceIds` boş, `doorIds` doludur. Kullanıcı cihaz seçimine girer.
- **Beklenen / mevcut:** Kullanıcının bu mobil capability için desteklenen izinli kapısı seçilebilir olmalı; mevcut sorgu bu bacağı görmez ve “erişiminiz olan kapı yok” gösterir. ID başka yoldan gönderilse bile selfCheckIn aynı bağlantıyı tanımaz. Bu, fiziksel panel provision zincirinin eksiksiz çalıştığı iddiası değildir.
- **Etki:** Backend'in temsil edebildiği kapı izni mobil tercih ve hızlı erişimde kullanılamaz. Çok kapılı panelde gelecekte yalnız panel ID'si kullanarak komut eklemek de doğru aktüatörü seçmeye yetmez.
- **Kök neden / çözüm:** Mobilde eski tek bacaklı cihaz modeli kalmış. İzinli hedef sözleşmesini cihaz mı kapı mı olarak netleştir; iki bacağı scope ve aktiflik guard'larıyla birleştir, kapı hedefi gerekiyorsa `doorId`/aktüatör kimliğini DTO/tercih/işlem zincirine taşı. Yalnız cihaz listesine panel eklemek bütün kapılara yetki vermemeli.

### DEV-F06 — Tercih kayıt hatası kullanıcı akışında yönetilmiyor; bellek ve disk ayrışabiliyor

**P2 · Kesinlik: kaynak analizi; yerel saklama hatası koşulunda.**

- **Kanıt zinciri:** `setDevice` belleği değiştirip dinleyicileri depoya yazmadan önce bilgilendirir (`preferred_device_provider.dart:24–30`); ID/ad iki ayrı async işlemdir. `clear` aynı sırayı kullanır (`:33–39`). Seçici `await setDevice` sonrasında pop yapar, hata yakalamaz ve saving durumu yoktur (`select_device_screen.dart:169–175`). Bootstrap hatası da yakalanmadan uygulama başlangıcında await edilmeden başlatılır (`main.dart:49`; provider `:17–21`).
- **Tetikleyici:** Saklama erişimi veya ilk/ikinci yazım exception üretir; ya da kayıt beklerken başka cihaza dokunulur.
- **Beklenen / mevcut:** Kullanıcı kaydetme durumunu ve başarısızlığı görmeli; doğrulanmış bellek ile kalıcı kayıt tutarlı kalmalı. Mevcutta UI yeni tercihi önceden yansıtır, işlem hatası yönetilmez ve iki alan kısmen yazılabilir; sonraki açılışta eski/eksik kayıt görülebilir. Art arda seçimlerin tamamlanma sırası yönetilmez.
- **Etki:** Tercih kaydedildi sanılırken kaybolması veya ad/ID uyumsuzluğu; açık kalan seçim ekranı ve açıklamasız hata.
- **Kök neden / çözüm:** Persistence bir işlem durumu olarak modellenmemiş. Kimlik kapsamlı tek sürümlü kayıt, sıralı/tek seçim yazımı, başarısızlıkta önceki değere dönüş veya açık başarısız durum, bootstrap hata yönetimi ve seçici saving/error UI'ı gerekir.

### DEV-F07 — Bozuk cihaz yanıtı boş yetki listesine veya seçilebilir sahte ID'ye dönüşebiliyor

**P2 · Kesinlik: kaynak analizi; sözleşme dışı yanıt/fixture koşulunda.**

- **Kanıt zinciri:** `device.dart:41–47` liste olmayan geçerli JSON'u boş listeye çevirir, map olmayan elemanları sessizce atar. `:22` `_id`/`id` yoksa `.toString()` ile `"null"` kimliği üretir; `:23–27` yanlış alan tiplerini cast ile hata haline getirir. Repo doğrudan bu parserı kullanır (`device_repository.dart:11–12`); seçici boşluğu “erişiminiz olan kapı yok” sunar (`select_device_screen.dart:117–123`) ve üretilmiş kimliği tercih olarak saklayabilir (`:169–173`). Mevcut backend normalde geçerli `_id` ve doğru DTO döndürür (`devices.ts:138–145`).
- **Tetikleyici:** API adaptörü sözleşme değişikliğiyle liste yerine obje döndürür; listedeki kayıtta ID eksilir veya yanlış tip oluşur.
- **Beklenen / mevcut:** Protokol hatası yetki boşluğundan ayrılmalı, geçerli/boş olmayan string kimliği olmayan cihaz seçilememeli. Mevcutta bazı bozuk yanıtlar “yetki yok”, bazıları `"null"` kimlikli cihaz, bazıları ham cast hatası olur.
- **Etki:** Yanlış destek teşhisi, işlevsiz kalıcı tercih ve tutarsız hata deneyimi. Üretimin bugün bu bozuk yanıtı gönderdiği gösterilmemiştir; bulgu dayanıklılık eksikliğidir.
- **Kök neden / çözüm:** DTO sınırında tip/kimlik doğrulaması ve tek hata sözleşmesi yok. Liste ve her eleman için alan doğrulama, açık protokol hatası ve geçersiz kimlikle tercih kaydını engelleme gerekir. Bilinen geçerli camelCase sözleşmesi korunmalı.

### DEV-F08 — Liste ham teknik hatayı gösteriyor; hızlı açma farklı hataları “erişim reddi”ne indiriyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** Seçici `error.toString()` saklar ve doğrudan gösterir (`select_device_screen.dart:42–46`, `:109`). `AppError.toString` debug mesajıdır (`errors.dart:17–18`); `ServerError.debugMessage` response body içerebilir (`:70–71`), transport buna response body koyar (`convex_config.dart:299–305`). Hızlı açma providerı ağ/sunucu gibi hataları saklayıp false döndürür (`attendance_provider.dart:335–345`), home ise her false için `unlockDenied` gösterir (`home_screen.dart:245–255`). Kullanıcıya uygun yerelleştirme helperı zaten vardır (`error_localizer.dart:12–22`).
- **Tetikleyici:** Liste yüklemede timeout/500/protokol hatası; hızlı açmada bağlantı kesilmesi veya silinmiş hedef için hata.
- **Beklenen / mevcut:** Timeout, ağ hatası, geçersiz hedef ve iş kuralı reddi anlaşılır şekilde ayrılmalı. Mevcutta liste teknik metin/yanıt gövdesi gösterebilir; hızlı açma ise erişim yetkisi reddedilmiş izlenimi verir.
- **Etki:** Kullanıcı yetki verilmesini isteyerek yanlış destek kanalına yönelir, bağlantı sorununu çözemez. Teknik yanıt içeriğinin UI'a taşınması vardır; somut gizli değer sızıntısı gösterilmemiştir.
- **Kök neden / çözüm:** Ekranlar ortak error sözleşmesini farklı kullanıyor. Liste AppError map/yerelleştirmesini kullanmalı; hızlı açma sonuç türü `denied`, `unavailable`, `invalidTarget`, `pending`, `confirmed` ayrımını korumalı. Retry yalnız güvenli işlem semantiğiyle sunulmalı.

## Geliştirme iş paketleri

S/M/L göreli kapsam ve belirsizlik tahminidir; takvim veya kesin gün taahhüdü değildir. Aşağıdaki maddeler uygulama önerisidir; bu audit kapsamında kod değişikliği yapılmamıştır. Ortak QR/attendance/backend bulguları koordinatör sentezinde aynı kök neden altında birleştirilmelidir.

### DEV-W01 — Kimlik kapsamlı tercih ve eski kayıt yaşam döngüsü

- **Kapsam:** DEV-F01; PreferredDeviceProvider, auth bağlama, profil/seçici/home. **Bağımlılık:** Hesap+proje+deployment kimliğinin kararlı şekilde sağlanması; kapı hedefi seçilecekse DEV-W04 DTO'su.
- **Yapılacaklar:** Tercihi bağlam/sürümle sakla; auth değişiminde bellek kapsamını değiştir; eski global tercihi yeni kullanıcıya otomatik bağlama; açılış/yenileme sonrası izinli hedefle uzlaştır; geçersiz hedefi kaldır/değiştir akışı ve açık temizleme eylemi ekle. Geçici ağ hatasında kaydı silmek yerine doğrulanamadı durumunu koru.
- **Kabul:** A→logout→B geçişinde A cihaz adı/ID'si B ekranında görünmez ve B isteğinde kullanılmaz. Silinen/izni kaldırılan hedef için hızlı işlem gönderilmez, yeniden seçim önerilir. Yeniden adlandırılmış cihazın adı yenilenir; uygulama yeniden açıldığında doğru bağlamın tercihi gelir. Ağ hatası tercihi sessizce yok etmez.
- **Anlamlı testler:** İki hesap/iki proje/iki backend namespace; eski anahtar migrasyonu; tekrar giriş ve expiry; kaldırılan üyelik; rename; başarı→offline→online uzlaştırması; temizleme sonrası restart. Fake repository ve preferences ile gözlemlenebilir durum geçişleri doğrulanmalı.
- **Tahmin:** **M** — auth ve UI tüketicileriyle state yaşam döngüsü değişir; donanım gerektirmez.

### DEV-W02 — İşlem anında güvenli yetki kararı ve tenant sınırı

- **Kapsam:** DEV-F02/DEV-F03; selfCheckIn, ortak yetki değerlendiricisi, geçmiş zenginleştirme. **Bağımlılık:** Saat dilimi, all-day ve legacy kural semantiği için ürün kararı; DEV-W04 ile ortak hedef modeli.
- **Yapılacaklar:** Cihaz/çalışan/ilişki/kural proje eşitliği ve cihaz/kural aktifliğini sunucuda uygula; seri aramasını scope'la; gün/saat penceresini sunucu saatiyle değerlendir; yetkisiz hedefin normal geçmişe yabancı referans oluşturmasını engelle; mevcut kirli kayıtlar için zenginleştirme koruması ve ayrı veri tarama planı hazırla. Audit reddi gerekirse yabancı metadata'sız tutulmalı.
- **Kabul:** Bilinen B cihaz ID/serisiyle A oturumu erişim/metadata alamaz; A geçmişine B cihaz referanslı normal okuma eklenmez. Eski hatalı kayıtlar cihaz metadata'sı açmaz. Pasif cihaz ve zaman dışı kural `granted=true` üretemez; geçerli aktif/zaman içi hedefte mevcut meşru akış sürer. Orphan/projesiz ilişkiler için açık red davranışı vardır.
- **Anlamlı testler:** Backend fixture ile aynı/başka proje, üyelik yok, sahte çapraz bağlantı, cihaz pasif, kural pasif, gün/saat sınırının hemen öncesi/sonrası, tüm gün, silinmiş cihaz, aynı seri farklı scope, mevcut yabancı referanslı geçmiş. Sonuçla birlikte DB yan etkileri ve DTO alanları assert edilmeli; yalnız boolean testi yetmez.
- **Tahmin:** **M** — birden fazla güvenlik kapısı ve veri geri okuma zinciri vardır; donanım komutu kapsam dışıdır.

### DEV-W03 — “Kapıyı Aç” eyleminin gerçek ürün/operasyon sözleşmesi

- **Kapsam:** DEV-F04; home, attendance repository/provider, backend işlem modeli. **Bağımlılık:** Önce DEV-W02; gerçek açma isteniyorsa DEV-W04 ve donanım entegrasyonu sahibiyle protokol/ack kararı.
- **Yapılacaklar:** Eylem mobil check-in mi uzaktan açma mı kararlaştırılsın. Check-in ise doğru ad/sonuç metni kullanılsın; açma ise ayrı yetkili kapı komutu, operasyon ID'si, pending/başarılı/hatalı/sonucu belirsiz durumları ve ack zinciri kurulsun. Komut isteği fiziksel geçiş kaydı gibi yazılmasın. Tek bekleyen işlem, tekrar dokunma ve güvenli yeniden deneme/idempotency uygulansın.
- **Kabul:** “Açıldı” yalnız tanımlanan cihaz onayıyla gösterilir; komut kuyruğa alındı sonucu farklıdır. Donanım kapalı/timeout durumunda başarı gösterilmez; fiziksel olay olmadan katılım durumu değişmez. Aynı operasyonu tekrar gönderme birden fazla komut veya yapay entry/exit oluşturmaz. Ürün check-in seçerse UI bu sözleşmeyi açıkça taşır.
- **Anlamlı testler:** Handler testiyle işlem kaydı/komut sayısı ve attendance yan etkisi; widget testinde çoklu dokunma; E2E'de ack, nack, timeout sonrası geç ack, offline cihaz ve ağ dönüşü. Gerçek fiziksel hareket doğrulaması cihaz matrisinde yapılmalı.
- **Tahmin:** **L** — fiziksel açma seçeneği yeni operasyon durumu ve donanım doğrulaması gerektirir; yalnız check-in yeniden adlandırması seçilirse ayrı küçük kapsam olarak planlanabilir.

### DEV-W04 — Kapı bazlı izinli hedefler ve doğru aktüatör seçimi

- **Kapsam:** DEV-F05; devices:listForEmployee, Device DTO, tercih ve işlem hedefi. **Bağımlılık:** Panel/kapı ürün modeli; DEV-W02 ile ortak scope guard'ları.
- **Yapılacaklar:** Cihaz ve canlı kapı bağlantılarının birleşimini izin semantiğine göre çöz; duplicate hedefleri gider; scope/aktiflik doğrula; kapı ID/IO ve gerekli açıklamaları DTO'ya taşı; panel değişimi/kapı taşınmasında snapshot yerine canlı ilişkiyi kullan. Çok kapılı panelde kullanıcıya izinli kapıyı ayırt ettir.
- **Kabul:** Yalnız groupDoors üyeliğiyle izinli hedef görünür; her iki bacaktan gelen hedef iki kere görünmez. Kapı taşındığında eski panel tercih olarak kullanılmaz. Bir kapıya izin verilmesi diğer kapılara yetki üretmez; çağrı seçilen aktüatörü sunucuda yeniden doğrular.
- **Anlamlı testler:** device-only, door-only, iki bacak, çok kapıdan yalnız biri, silinmiş/taşınmış kapı, farklı proje kapısı, aktifliği kalkmış kural, aynı isimli kapılar. Liste sonucu ve işlem kararı aynı fixture'larda birlikte sınanmalı.
- **Tahmin:** **M** — mevcut grafik var, fakat mobil DTO/tercih kontratı değişir; donanım komutu DEV-W03'e aittir.

### DEV-W05 — Dayanıklı ve sıralı tercih kaydı

- **Kapsam:** DEV-F06; provider + seçici. **Bağımlılık:** DEV-W01 kayıt anahtarı/sürüm modeli; DEV-W04 uygulanırsa hedef şeması.
- **Yapılacaklar:** Kaydı tek yapıda tut; bootstrap ve yazım başarısızlığını durum olarak taşı; eşzamanlı yazımları sırala veya seçim sırasında etkileşimi kilitle; hata halinde önceki doğrulanmış değeri koru/geri al; başarıdan sonra güvenli navigation yap.
- **Kabul:** Saklama erişimi/yazımı hatası uygulamada yönetilmemiş Future hatası üretmez; kullanıcı tekrar deneyebilir ve önceki tercih tutarlıdır. Çoklu dokunmada tek nihai hedef ve tek kontrollü geri dönüş olur. Restart'ta ad/kimlik eşleşmesi korunur.
- **Anlamlı testler:** Geciken bootstrap, ilk yazım hatası, kayıt ortasında hata, clear hatası, ters sırayla tamamlanan seçim istekleri, kaydederken ekranın kapatılması. Enjekte edilebilir store ile hata koşulları test edilmeli.
- **Tahmin:** **S** — sınırları belli provider/UI değişikliği; geniş entegrasyon riski DEV-W01'e aittir.

### DEV-W06 — DTO doğrulaması ve kullanıcıya anlamlı hata/yenileme

- **Kapsam:** DEV-F07/DEV-F08; model, repository, seçici ve home sonuç sunumu. **Bağımlılık:** DEV-W03 sonuç sözleşmesi; DEV-W04 DTO'su.
- **Yapılacaklar:** Liste ve alanları doğrula, geçersiz kimliği reddet; protokol hatasını boş yetkiden ayır; AppError/yerelleştirme uygula; teknik body'yi UI'dan çıkar; liste başarılı/boşken erişilebilir yenileme eylemi sun; ağ hatasıyla erişim reddini ayrı sonuçlar olarak göster.
- **Kabul:** Liste dışı JSON/eksik ID seçilebilir cihaz oluşturmaz; kullanıcı protokol hatası + retry görür. `[]` gerçek boş mesajını üretir. Ağ/timeout/sunucu/izin reddi ayrı ve Türkçe/İngilizce anlaşılırdır; ham response body gösterilmez. Sonradan verilen izin ekrandan çıkmadan yenilemeyle görünür.
- **Anlamlı testler:** Geçerli nullable camelCase DTO, `_id` eksik/boş/yanlış tip, yanlış optional alan tipi, map yerine scalar, liste yerine obje, bozuk JSON, gerçek boş liste, filtre sonucu yok; fake transport hata sınıfları ve widget retry. UI'ın ham teknik metin taşımadığı assert edilmeli.
- **Tahmin:** **M** — parser, hata sınıflandırması ve iki farklı UI tüketicisi birlikte değişir.

## Manuel cihaz / E2E doğrulama matrisi

**Bu matris planlanmış doğrulamadır; tüm satırlar çalıştırılmadı.** Sahte kullanıcı/cihaz fixture'larıyla izole test deployment'ı kullanılmalı; gerçek tenant verisi veya erişim anahtarları rapora yazılmamalı.

| Senaryo | Ortam / önkoşul | Gözlemlenebilir kabul | Durum / ilgili paket |
| --- | --- | --- | --- |
| Profil → liste → seçim → restart | Android ve iOS gerçek cihaz; izinli test hedefi | Doğru hedef işaretli, profil/home tutarlı, yeniden başlatmada aynı bağlam | Çalıştırılmadı; W01/W05 |
| Hesap ve tenant değişimi | Aynı telefonda A/B test hesabı, farklı projeler | A'nın hedef adı/ID'si B'ye taşınmaz; B isteği yalnız kendi hedefini kullanır | Çalıştırılmadı; W01 |
| Üyelik kaldırma / rename / cihaz silme | Seçili hedefin test yöneticisiyle değiştirilmesi | Geçersiz hedef bloke; rename güncel; tekrar seçim/temizleme kullanılabilir | Çalıştırılmadı; W01 |
| Pasif cihaz ve zaman sınırı | Aktif bağ, pasif cihaz; gün/saat kuralı | Pasif veya zaman dışı istekte onaylı hareket/komut yok | Çalıştırılmadı; W02 |
| Tenant metadata sınırı | A session + bilinen B test ID/serisi; API yanıt denetimi | Red sonrası A geçmişinde B metadata/ref yok; eski kirli kayıt da gizli | Çalıştırılmadı; W02 |
| Kapı bazlı izin | Aynı panelde iki kapı; çalışana yalnız biri | İzinli kapı listelenir; diğer kapı açılamaz; hedef/IO eşleşir | Çalıştırılmadı; W04 |
| Fiziksel hızlı açma | Desteklenen her marka/transport; kontrollü test kapısı | Komut/ack/fiziksel hareket tutarlı, gerçek geçiş öncesi attendance değişmez | Çalıştırılmadı; W03 |
| Offline cihaz / geç ack | Ağ kesme, donanım offline, gecikmiş sonuç | Pending/timeout/belirsiz sonuç doğru; tekrar deneme çift komut/hareket üretmez | Çalıştırılmadı; W03 |
| Çoklu dokunma / route kapatma | Yavaş test ağı ve kayıt deposu | Tek işlem/tek navigation; kapalı ekrana state yazılmaz | Çalıştırılmadı; W03/W05 |
| Boş liste / filtre / hata / yenileme | Gerçek boş yetki; eşleşmeyen arama; timeout/500 fixture | Farklı mesajlar; retry/refresh çalışır; teknik body yok | Çalıştırılmadı; W06 |
| Yerel kayıt bozulması/hatası | Enjekte edilmiş test deposu; cihazda restart | Eski geçerli değer korunur veya açık kurtarma; sahte ID yok | Çalıştırılmadı; W05/W06 |
| Aynı hedefte QR ve tercih karşılaştırması | Onaylı cihaz QR fixture'ı; kamera izinleri; aynı kapı | Her iki yol aynı sunucu yetki kararına ulaşır; QR tercihi kendiliğinden değiştirmez | Çalıştırılmadı; W02/W04 |
| QR kimlik biçimleri | JSON/base64 cihaz yükü; seri kimlik etiketi; farklı ID fixture'ları | Desteklenen biçimler açık; desteklenmeyen etiket anlaşılır reddedilir, yetki sayılmaz | Çalıştırılmadı; açık soru |
| Küçük ekran/büyük yazı/ekran okuyucu | Android/iOS; uzun ve aynı adlı kapılar; TR/EN | Hedefler ayırt edilebilir, seçili durum okunabilir, hata/yenileme erişilebilir | Çalıştırılmadı; W04/W06 |

## Açık sorular ve kanıt sınırları

1. **Ürün amacı:** “Kapıyı Aç” fiziksel komut mu, uzaktan katılım/check-in mi? İlk seçenekte hangi cihaz/transportlar ve hangi ack kanıtı desteklenecek? Kaynaktaki `granted` yalnız kural kararıdır.
2. **Tercih sahibi:** Tercih çalışan+proje+deployment bazlı mı, yoksa şirketin farklı çalışan kayıtları tek hesap altında mı? Mobil `AuthUser`/bootstrap sözleşmesi bu kimlikleri hangi alanla sağlayacak? Mevcut tercih bunların hiçbirini saklamıyor.
3. **İzinli hedef kavramı:** Liste her potansiyel hedefi mi, yalnız şu anda açılabileni mi sunmalı? Saat dışı hedefin listede durması tek başına bug sayılmadı; F02 işlem anındaki yanlış karardır.
4. **Legacy veri:** `isActive` alanı olmayan kurallar listede aktif sayılır (`devices.ts:110`), selfCheckIn yalnız truthy değer kabul eder (`cardReadings.ts:1422`). Böyle kayıtların üretimde varlığı kanıtlanmadı; veri sözleşmesi netleşmeden ayrı işlevsel bulgu sayılmadı.
5. **Scope savunması:** Liste son cihaz/kural/bölge/kapı belgelerinde proje eşitliğini yeniden kontrol etmez (`devices.ts:108–144`); yeni ilişki yazıcılarında koruma vardır. Eski/migrasyon kaynaklı çapraz bağlantıların varlığı doğrulanmadı. DEV-W02 testi bu kirli veri koşulunu kapsamalı; F03 ise kirli ilişki gerektirmeyen farklı zincirdir.
6. **QR sözleşmesi:** Web `QRCodeDialog.tsx:36–41` düz seri değerini açıkça geçiş yetkisi olmayan kimlik etiketi olarak sunar; mobil `qr_code_model.dart:78–103` `deviceId` içeren JSON/base64 bekler. Bu iki QR'ın aynı capability olduğu varsayılmadı. Cihaz geçiş QR'ının resmi üreticisi hangisi?
7. **QR ID ayrımı:** `attendance_provider.dart:300–303` yorumunda iki olası önekten söz ederken yalnız `startsWith('j')` kontrol edilir. Seçimden hızlı işlemde bu sezgi yoktur. Üretimde bu koşulla yanlış ayrılan geçerli ID örneği doğrulanmadı; bu nedenle ayrı kanıtlı bug sayılmadı. Yeni sözleşme ID/seri ayrımını açık türle taşımalı ve farklı fixture'larla sınanmalı.
8. **Ölçek ve yenileme:** Liste `.collect()` + bağlantı başına okumalar kullanır (`devices.ts:96–145`); ölçülmüş latency veya limit ihlali yok. Cihaz/üyelik ölçeği ve hedef yenileme SLA'sı nedir? Sayfalama gereği ölçümden sonra kararlaştırılmalı.
9. **Doğrulama kapsamı:** Mevcut repo testlerinde device model/repository/preference/seçici için doğrudan test dosyası bulunmadı; attendance mock testleri gerçek kapı/tenant/kural saatlerini doğrulamıyor. Koordinatörün 44 test sonucu yalnız mevcut kapsamın geçtiğini gösterir; yeni paketler için yukarıdaki senaryolar ayrıca gereklidir.

## Önerilen sıra

Önce DEV-W02 ile sunucu yetki/tenant kapıları kapatılmalı ve DEV-W03 ürün sözleşmesi karara bağlanmalı. DEV-W04 hedef modeli bu kararla netleşince DEV-W01/W05 tercih yaşam döngüsü ve DEV-W06 kullanıcı deneyimi uygulanabilir. Cihaz/E2E matrisi tamamlanmadan fiziksel açma veya üretim izolasyonunun doğrulandığı ilan edilmemelidir.
