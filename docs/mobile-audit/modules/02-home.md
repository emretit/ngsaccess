# 02-home — Ana sayfa ve dashboard denetimi

Tarih: 19 Ekim 2026. Kapsam: Flutter ana sayfası, ortak kartlar ve bunların kullandığı attendance okuma/işlem zinciri. Bu belge mevcut çalışma ağacının kaynak analizidir; üretim verisi, cihaz, ağ ve fiziksel kapı davranışı bu worker tarafından denenmedi. Bu worker Flutter test/analyze/pub get/build, formatlama, deploy ve veri mutasyonu çalıştırmadı. Uygulama/backend/platform/test dosyaları değiştirilmedi; mevcut değişiklikler korundu.

Koordinatörün [yerel baz doğrulama kaydı](../evidence/baseline.md), `flutter analyze --no-pub` için **No issues found**, `flutter test --no-pub --reporter expanded` için **44 test geçti** sonucunu bildiriyor. Bu sonuçlar bu modül worker'ının yürüttüğü testler değildir; cihaz, canlı backend, fiziksel kapı veya E2E başarısını kanıtlamaz. Aynı kanıt kaydındaki HTTP 560 characterization sonucu, oturum hatası eşlemesinin ayrıca geliştirilmesi gerektiğini gösteriyor; bu raporun auth yönlendirme kabul senaryoları o ortak ağ/auth düzeltmesine de bağımlıdır.

## 1. İnceleme kapsamı ve gerçek kabiliyetler

### Dosya envanteri

Hedef dizinlerdeki aşağıdaki altı dosyanın tamamı okundu:

| Dosya | İncelenen kapsam |
| --- | --- |
| `mobile/lib/screens/home/home_screen.dart:1–326` | İlk yükleme, yenileme, selamlama, durum kartı, dört hızlı işlem, günün sözü |
| `mobile/lib/widgets/cards/attendance_status_card.dart:1–275` | Durum, saatler, ek hareketler ve QR düğmesi |
| `mobile/lib/widgets/cards/quick_action_card.dart:1–85` | Hızlı işlem kartının etkileşim ve yerleşimi |
| `mobile/lib/widgets/cards/progress_hero_card.dart:1–210` | Bölümlü ilerleme ve metrik bileşeni; çağıran taraması |
| `mobile/lib/widgets/cards/section_header.dart:1–37` | Bölüm başlığı ve isteğe bağlı aksiyon |
| `mobile/lib/widgets/cards/stat_card.dart:1–78` | İstatistik bileşeni; çağıran taraması |

Bağlam için tamamen okunan dosyalar: `mobile/lib/providers/attendance_provider.dart`, `mobile/lib/repositories/attendance_repository.dart`, `mobile/lib/models/attendance.dart`, `mobile/lib/providers/preferred_device_provider.dart`, `mobile/lib/repositories/device_repository.dart`, `mobile/lib/main.dart`, `mobile/lib/router/app_router.dart`, `mobile/lib/screens/main_navigation_shell.dart`, `mobile/lib/screens/settings/select_device_screen.dart`, `mobile/lib/widgets/responsive_container.dart`, `mobile/test/providers/attendance_provider_test.dart`, `mobile/test/repositories/attendance_repository_test.dart`.

İlgili bölümleri okunan destek dosyaları:

| Dosya ve satırlar | Amaç |
| --- | --- |
| `mobile/lib/config/convex_config.dart:100–245` | Çalışan oturumu, HTTP çağrıları ve polling/backoff |
| `mobile/lib/providers/auth_provider.dart:108–160` | Çıkış, oturum süresi sonu ve yerel temizlik |
| `mobile/lib/screens/profile/profile_screen.dart:174–210,455–478` | Tercih edilen cihaz seçimine erişim ve çıkış |
| `mobile/lib/screens/qr_scan/qr_scan_screen.dart:460–558` | Ana sayfanın QR hedefi, tarama tekrarı koruması ve işlem sonucu |
| `mobile/lib/l10n/app_tr.arb:59–74,116–122` | Gerçek Türkçe durum/aksiyon metinleri |
| `convex/_generated/ai/guidelines.md` | Backend okunmadan önce tamamı okundu |
| `convex/cardReadings.ts:1–100,1352–1450,1476–1510` | Çalışanın kayıt listesi, self check-in ve PDKS bağlantısı |
| `convex/lib/customFunctions.ts:113–134` | Çalışanın sunucuda oturumdan türetilmesi |
| `convex/lib/employeeAuth.ts:1–37` | Oturum, süre ve aktif çalışan doğrulaması |
| `convex/lib/cardReadingProcess.ts:1–93` | Cihaz yönü ve çalışan/cihaz bazlı günlük toggle |
| `convex/lib/cardReadingAudit.ts:1–148` | Mobil yanıtta cihaz adının zenginleştirilmesi |
| `convex/lib/accessDecision.ts:1–26` | Aktif kural kesişiminin anlamı |
| `convex/lib/pdksSource.ts:1–88`, `convex/lib/trDate.ts:1–40` | PDKS kaynak uygunluğu ve Türkiye günü |
| `convex/schema.ts:460–509` | Yönün opsiyonelliği ve liste indeksleri |
| `convex/devices.ts:85–170` | Mobil cihaz listesinin aktif cihaz filtresi |
| `convex/actions/hikGatewayDevice.ts:364–403` | Ayrı fiziksel açma zincirinin varlığı; mobil akışa bağlı olmadığı |

`rg` ile `ProgressHeroCard`, `StatCard`, aylık attendance getter'ları, tercih temizliği ve hedef test dosyaları tarandı. Destek dosyalarının tamamı için genel bir audit iddiası yoktur.

### Mevcut gerçek akış/capability tablosu

Burada **çalışıyor**, kaynakta tamamlanmış bir bağ bulunduğu anlamındadır; cihazda test edildiği anlamına gelmez. **Kısmi**, somut eksik veya yanlış davranış bulunan akıştır. **Placeholder**, tanımlı fakat bu ekrana bağlanmamış kabiliyettir.

| Kabiliyet | Durum | Gerçek kaynak / sınır |
| --- | --- | --- |
| Çalışan adı, tarih, günün saatine göre selamlama | Çalışıyor | `home_screen.dart:75–154,315–323`; ad `AuthProvider.currentUser`, tarih/saat telefon saati |
| Son giriş/çıkış ve İçeride/Çıktı | Kısmi | `home_screen.dart:157–169` → provider → gerçek `cardReadings:listForEmployee`; hata, pencere ve gün sınırı sorunları aşağıda |
| Ek giriş/çıkış sayıları | Kısmi | `attendance_provider.dart:97–106`; yalnız yüklenmiş onaylı kayıtlardaki aynı yön sayısı eksi bir; tüm günün kesin toplamı değil |
| Elle aşağı çekerek yenileme | Kısmi | `home_screen.dart:35–49`; kısa içerikte de tetiklenebilir; hata görselleştirilmiyor |
| Otomatik yenileme | Çalışıyor | `attendance_repository.dart:40–52` → HTTP polling; varsayılan bir dakika, hatada en fazla beş dakika (`convex_config.dart:150–222`); WebSocket anlık abonelik değil |
| Arka plan / geri dönüş | Çalışıyor | `attendance_provider.dart:243–253`; polling durdurulup dönüşte tekrar kurulur |
| Ana sayfadan QR işlemine gitme | Çalışıyor | `home_screen.dart:166`, `app_router.dart:100–105`; kartın üç durumunda da aynı QR rotası |
| QR düğmesinin giriş/çıkış talimatı | Kısmi | Metin durumdan türetilir (`attendance_status_card.dart:225–230`); yön parametresi gönderilmez, sunucu cihaz ayarı/toggle ile belirler (`cardReadingProcess.ts:54–72`) |
| Kapıyı Aç — erişim kaydı | Kısmi | Gerçek mutation ve kalıcı kayıt var; fiziksel açma yok, sahte/dummy başarı verisi kullanılmıyor; HOME-F01/F02 |
| Kapıyı Aç — fiziksel röle/kapı açılması | Kanıtlanamadı | Bu çağrı zincirinde komut yok; ayrı `remoteOpenDoor` mobil çalışan çağrısına bağlı değil |
| Tercih edilen kapı | Kısmi | Profil → cihaz seçimi → yerel SharedPreferences; oturuma bağlı değil, eskime/aktiflik sorunları var |
| Ziyaretçi/geçmiş/profil kısayolları | Çalışıyor | `home_screen.dart:192–216` → router'daki gerçek branch'ler; hedef ekranların bütün işlevleri bu modülde denetlenmedi |
| Aylık ilerleme ve istatistik kartları | Placeholder / bağlı değil | `ProgressHeroCard` ve `StatCard` yalnız tanımlı; `home_screen.dart:58–64` bunları oluşturmuyor. Ürün ekranında aylık istatistik varmış gibi raporlanmamalı |
| Günün sözü | Çalışıyor, sabit metin | `home_screen.dart:263–278`; sekiz yerelleştirilmiş metinden ayın günü mod sekiz ile seçim; API/AI/personalizasyon değil |
| İlk yükleme / hata / gerçek boş sonuç ayrımı | Kısmi | Kart yalnız üç attendance durumu alır; yükleme/hata alanı almaz (`attendance_status_card.dart:9–24`) |

### Gösterilen sayıların anlamı

“Son Giriş” gün içindeki en geç onaylanmış giriş, “Son Çıkış” en geç onaylanmış çıkıştır; ikisi aynı geçiş çifti olmak zorunda değildir (`attendance_provider.dart:75–88`). Yeniden girişte son giriş saati son çıkıştan daha ileri olabilir; bu tek başına hata değildir. “+N hareket”, ilgili yöndeki diğer onaylı kayıtlardır; retler dahil değildir. Statü en son onaylı günlük hareketin yönüdür; fiziksel mevcudiyet sensörü değildir (`attendance_provider.dart:111–125`).

Kullanılmayan aylık getter'lar: `daysPresent`, yüklenen kayıtlar içinde ayın benzersiz onaylı hareket günlerini sayar; `_firstCheckInByDay` giriş yönünü filtrelemez. `daysLate`, vardiyadan bağımsız sabit 09:00 eşiği kullanır; `totalDaysThisMonth` işgünü değil takvim günü sayısıdır (`attendance_provider.dart:353–398`). Bunlar şu anda kullanıcıya gösterilmeyen teknik taslaklardır; mevcut ekranda yanlış aylık istatistik gösterimi bulgusu olarak sayılmadı. `ProgressHeroCard` toplam segment değerini toplam birime bölüyor ve segment genişliğini aynı oranla çiziyor; sınırlandırma yok (`progress_hero_card.dart:52–53,142–149`). Ürüne bağlanmadan önce sayı sözleşmesi tasarlanmalı.

## 2. İyi çalışan temeller

- Attendance verisi demo liste yerine repository üzerinden gerçek çalışan oturumuyla okunuyor. `employeeAuthedQuery/Mutation`, çalışanı istemci kimliğinden değil sunucudaki oturumdan türetiyor; oturum süresi ve aktif çalışan kontrolü var (`customFunctions.ts:117–133`, `employeeAuth.ts:11–22`).
- Liste sorgusu çalışanın kendi kimliğine indeksleniyor (`cardReadings.ts:1363–1367`); bu denetimde keyfi başka çalışan kimliğiyle sorgulama yolu saptanmadı.
- Retler günlük durumdan çıkarılıyor; son hareket açıkça zamanla sıralanıyor. Öğle çıkışı ve yeniden giriş gibi çoklu hareketler için temel model var (`attendance_provider.dart:47–125`).
- Polling'de hata geri çekilmesi, uygulama yaşam döngüsü ve abonelik nesli koruması var (`convex_config.dart:173–222`, `attendance_provider.dart:151–178,243–253`). Bu koruma tek seferlik sorgulara henüz yayılmamış; HOME-F08.
- Mutation'ların varsayılan otomatik yeniden denemesi kapalı (`convex_config.dart:133–146`). Ağ katmanının kendiliğinden ikinci check-in üretmemesi iyi bir temel; kullanıcı tekrar dokunması ayrıca çözülmeli.
- ResponsiveContainer, SafeArea, karanlık tema dalları, yerelleştirme ve sabit rota adları mevcut. Sekmeler `StatefulShellRoute.indexedStack` ile korunuyor (`app_router.dart:80–124`); salt sekme değişiminde tüm veri yeniden yaratılmıyor.
- Provider test kaynağında yaşam döngüsü, başarısız yükleme, auth expiry ve ret kaydını dışlama senaryoları; repository'de parse ve check-in argüman senaryoları var. Bu denetimde çalıştırılmadılar; testlerin mevcut olması fiziksel kapı/E2E kanıtı değildir.

## 3. Kanıtlı bulgular

Toplam **9 bulgu: P0 yok, 5 P1, 4 P2, P3 yok**. Tümünün kesinlik düzeyi **kaynak analizi**; cihazda veya üretimde doğrulanmış olarak sunulmaz. Eksik test tek başına bulgu sayılmadı. Backend bulguları yalnız bu ana sayfanın çağrı zincirine etkileri bakımından kapsam içindedir.

### HOME-F01 — P1 — Kapıyı Aç, fiziksel komut göndermeden yoklama kaydı oluşturuyor

- **Kanıt zinciri:** `home_screen.dart:183–188,245–255` → `attendance_provider.dart:308–328` → `attendance_repository.dart:32–37` → `convex/cardReadings.ts:1419–1448`. Handler yalnız aktif kural kesişimini değerlendiriyor, yön çözüyor ve `cardReadings` yazıyor; cihaz komutu/scheduler çağrısı yok. Ayrı fiziksel açma yolu `convex/actions/hikGatewayDevice.ts:367–402` içinde ve web kullanıcı auth'u kullanıyor; mobil kısayol burayı çağırmıyor.
- **Tetikleyici:** Seçili cihaza aktif kural üzerinden erişimi olan çalışanın ana sayfada “Kapıyı Aç”a basması; cihaz çevrimdışı olsa da bu handler cihazdan yanıt beklemiyor.
- **Beklenen / mevcut:** Etiket gerçek kapı açma beklentisi oluşturuyor; mevcut sonuç yalnız “Erişim Verildi” ve onaylı geçiş kaydı. Bu, demo kod değil; fiziksel açmayla bağlantısı eksik gerçek veri yazımıdır.
- **Etki:** Kullanıcı kapının açılmasını beklerken işlem tamamlandı sanabilir; geçiş gerçekleşmeden günlük durum ve PDKS girdisi oluşur. `rawData.source=mobile_qr` (`cardReadings.ts:1443`), PDKS sınıflamasında `qr` ve uygun kaynaktır (`pdksSource.ts:62–75`); PDKS detayı bu filtreden geçer (`cardReadings.ts:1496`). Her bordro sonucunun bozulduğu iddia edilmiyor; gerçek geçiş sanılan kaydın hesap girdisi olabildiği saptanıyor.
- **Kök neden / çözüm:** Kapı açma isteğiyle gerçekleşmiş geçiş aynı mutation/boolean sözleşmesinde birleştirilmiş. Ürün kararına göre kısayolu açıkça self check-in olarak adlandırmak veya çalışan yetkili gerçek cihaz komutuna bağlamak gerekir. Komut kabulü, cihaz onayı ve fiziksel geçiş kaydı ayrı sonuçlar olmalı; mevcut web action'ını kontrolsüz biçimde mobil kullanıcıya açmak çözüm değildir.

### HOME-F02 — P1 — Tek kullanıcı niyeti, tekrarlı dokunmada birden fazla giriş/çıkış üretir

- **Kanıt:** `quick_action_card.dart:18,29–30` her dokunmayı çalıştırır; `home_screen.dart:225–245` işlem kilidi kontrol etmez. `_performSelfCheckIn`, `_isLoading` değerini ayarlar fakat girişte kontrol etmez (`attendance_provider.dart:314–325`). Backend her çağrıda yeni kayıt yazar (`cardReadings.ts:1434–1448`); `both` yönü son onaylı kayda göre değiştirir (`cardReadingProcess.ts:58–72`).
- **Tetikleyici:** Erişim yetkili kullanıcı `accessDirection=both` cihazında ilk istek sürerken veya yanıtı takiben tekrar dokunur.
- **Beklenen / mevcut:** Aynı işlem niyeti bir kez işlenmeli; mevcut kod iki ayrı mutation yapabilir, ilk hareket giriş, ikinci çıkış olur. Yalnız butonu disable etmek, farklı istemci/yeniden gönderim için backend idempotency sağlamaz.
- **Etki:** Kullanıcı henüz geçmemişken “Çıktı” görebilir; ekstra hareket ve PDKS girdileri oluşur. Paylaşılan `_isLoading` ilk istek bitince diğer istek sürerken de false olabilir.
- **Kök neden / çözüm:** İşlem kimliği ve uçtan uca tekrar önleme yok. Ayrı komut busy durumu, aynı cihazda tek aktif istek ve sunucuda işlem kimliğiyle tekrarların aynı sonuca bağlanması eklenmeli; meşru ardışık geçişleri keyfi süreyle kaybetmemeli.

### HOME-F03 — P2 — Yükleniyor, hata ve gerçekten hareket yok durumları aynı görünüyor

- **Kanıt:** `home_screen.dart:157–167` yalnız statü/saat/sayıları okur. Provider yükleme/hata alanlarını üretir (`attendance_provider.dart:40–45,256–279`); kart bunları almaz (`attendance_status_card.dart:9–24,114–118`). Hızlı işlemde tüm false sonuçlar “Erişim Reddedildi” olur (`home_screen.dart:245–255`), ağ/timeout/iş hataları provider'da false'a çevrilir (`attendance_provider.dart:335–346`).
- **Tetikleyici:** İlk açılışta yavaş ağ; boş başlangıç listesinin sorgusunun hata vermesi; eski başarılı yükleme sonrası bağlantının kesilmesi; hızlı işlem timeout'u.
- **Beklenen / mevcut:** Henüz bilinmeyen durum, eski veri ve gerçek boş sonuç ayrılmalı; mevcut ekran ilk sorgu bitmeden “Henüz Yok” gösterir. Hata sonrası eski statü güncelmiş gibi kalır; yenileme göstergesi hata bilgisi vermeden kapanır. Teknik hata da yetki reddi diye sunulur.
- **Etki:** Çalışan hareketini yanlış yorumlar ve aynı işlemi tekrar deneyebilir; destek ekibi erişim kuralı ile ağ sorununu ayıramaz.
- **Kök neden / çözüm:** Attendance durumu ile veri/komut durumu ayrı modellenmemiş. İlk yükleme, başarılı boş, stale veri, yeniden deneme ve typed komut sonuçları eklenmeli; başarılı veri varken yenileme hatası kartı silmemeli.

### HOME-F04 — P1 — Dashboard özeti, son oluşturulan 50 kaydın eksik penceresinden hesaplanıyor

- **Kanıt:** Varsayılan limit 50 (`attendance_provider.dart:24,30`); mobil sorgu `by_employee` ile `order(desc).take(limit)` yapar (`cardReadings.ts:1363–1367`). İndeks yalnız `employeeId` içerir (`schema.ts:497`), `accessTime` içermez. Sağlanan Convex kılavuzuna göre bu eşitlik grubunda kalan sıralama oluşturulma sırasıdır. UI günlük sayaç/statüyü bu sınırlı listeyi süzerek üretir (`attendance_provider.dart:47–125`), ana sayfa `loadMore` çağırmaz (`home_screen.dart:35–38`).
- **Tetikleyici:** Bugünkü son gerçek hareketten sonra geçmiş tarihli en az 50 olayın içe alınması; veya onaylı günlük hareketlerin ardından çok sayıda ret kaydının yazılması. Gün içinde 50'den fazla hareket de sayıları eksiltir.
- **Beklenen / mevcut:** Günün son onaylı hareketi ve günlük toplamlar tüm ilgili olaylara göre doğru olmalı. Mevcut pencere en güncel `accessTime` olayını dışlayabilir; “Henüz Yok”/eski yön veya eksik “+N” gösterir. İstemcide sonradan sıralamak, dışarıda kalan kayıtları geri getirmez.
- **Etki:** Ana durum ve hareket sayısı yanlış; geçmiş ekranında daha fazla kayıt yüklenmesi aynı ortak provider limitini büyüttüğü için ana sayfa doğruluğu dolaylı kullanıcı davranışına bağlıdır (`attendance_provider.dart:189–198`).
- **Kök neden / çözüm:** Sayfalı ham hareket listesi, tam günlük özet yerine kullanılıyor. Gün/çalışan/yetki kapsamında backend özeti üretmek; son onaylı hareketi ve yön başına sayıları bağımsız hesaplamak; geçmiş listesinde olay zamanı indeksli cursor kullanmak gerekir. Sadece limiti artırmak kesin çözüm değildir.

### HOME-F05 — P2 — Gün sınırı ve saat politikası backend ile aynı değil

- **Kanıt:** Model zamanı telefon yereline çevirir (`attendance.dart:55`), provider telefon yerel gününü ve başlangıçta kesin `isAfter(start)` kullanır (`attendance_provider.dart:47–56`). Backend yön reseti Türkiye gününe göre yapılır (`cardReadingProcess.ts:30–33,61–72`; `trDate.ts:12–24`). Ana sayfa başlık tarihi ve selamlama yalnız build sırasında hesaplanır (`home_screen.dart:75–83,315–323`); HomeScreen içinde gün/saat değişimini izleyen timer/lifecycle yenilemesi yok (`home_screen.dart:26–38`).
- **Tetikleyici:** Tam 00:00:00.000'da onaylı hareket; Türkiye dışındaki telefon saat dilimi; ekranı gece yarısı boyunca açık tutma.
- **Beklenen / mevcut:** Onaylanmış iş günü politikasında `[başlangıç, sonraki gün)` aralığı kullanılmalı. Tam gece yarısı olayı mevcut filtrede dışlanır. Farklı saat dilimindeki telefon, backend toggle gününden farklı olay kümesini sayar. Polling attendance Consumer'ını güncellerken AuthProvider başlığı her polling bildiriminde yeniden hesaplanmaz; üst ağaç rebuild olmadığında eski tarih/selamlama kalabilir.
- **Etki:** Gün başında yanlış boş/durum göstergesi ve aynı ekranda tarih ile kart günü uyumsuzluğu. Gece vardiyasının fiziksel içeride olma anlamı ayrıca ürün kararıdır; dünün girişini bugün yok saymak tek başına vardiya bug'ı olarak ilan edilmedi.
- **Kök neden / çözüm:** Tek saat/gün kaynağı ve açık iş günü sözleşmesi yok. İş/proje saat dilimini ve iş gününü belirtmek, başlangıcı dahil etmek, saat bağımlı alanları ortak gün anahtarıyla ve dönüşte güncellemek gerekir.

### HOME-F06 — P2 — Bilinmeyen yön sessizce giriş ve İçeride kabul ediliyor

- **Kanıt:** Backend şeması `direction` alanını opsiyonel tutar (`schema.ts:470–472`); mobil parser null'u korur (`attendance.dart:57`). `isEntry => direction != 'exit'` (`attendance.dart:30`); provider son onaylı kayıtta `isExit` false ise inside döndürür (`attendance_provider.dart:122–125`).
- **Tetikleyici:** Bugün yönü boş, `izin_verildi` durumunda bir legacy/içe alınmış kayıt bulunması. Böyle bir üretim kaydının varlığı doğrulanmadı; şema bu girdiyi açıkça kabul ediyor.
- **Beklenen / mevcut:** Yönü bilinmeyen olaydan kesin içeride/giriş sonucu çıkarılmamalı. Mevcut kod bu olayı Son Giriş ve İçeride olarak gösterir; QR metni de “Çıkış Yap” olur (`attendance_status_card.dart:228`).
- **Etki:** Kullanıcıya kaynaktan kanıtlanamayan konum ve sonraki işlem talimatı verilir.
- **Kök neden / çözüm:** İkili bool varsayımı. `entry/exit/unknown` modelini açık tutmak, bilinmeyenleri yön sayaçlarına katmamak ve güvenilir geçmiş/cihaz kanıtıyla sunucuda çözmek gerekir; eksik yönleri topluca girişe çevirmek uygun değildir.

### HOME-F07 — P2 — Tercih edilen cihaz kullanıcıdan bağımsız saklanıyor

- **Kanıt:** Tercih anahtarları ortak ve kullanıcı kimliği içermez (`preferred_device_provider.dart:7–20`). Provider uygulama ömründe tek nesnedir ve auth proxy'sine bağlı değildir (`main.dart:49,76–84`). Çıkış yalnız auth bilgisini temizler (`auth_provider.dart:113–125,142–148`); `PreferredDeviceProvider.clear` için `mobile/lib` çağıran taramasında çağrı yok. Ana sayfa bu adı hemen gösterip ID'yi mutation'a yollar (`home_screen.dart:179–188,230–245`).
- **Tetikleyici:** Aynı kurulumda A çalışanı kapı seçer, çıkış yapar ve B çalışanı giriş yapar.
- **Beklenen / mevcut:** B'nin kendi tercihi/boş seçim görünmeli; A'nın cihaz adı ve tercihi B'ye taşınır. Backend yeni çalışanın kural kesişimini yeniden kontrol ettiği için bu bulgu tek başına yetkisiz kapı erişimi kanıtı değildir (`cardReadings.ts:1410–1425`).
- **Etki:** Başka kullanıcının kapı adı görünür; yanlış hedefe işlem veya anlaşılmaz ret oluşur. Adı değişen/silinen cihaz tercihi de yenilenmeden kalır.
- **Kök neden / çözüm:** Kullanıcı kapsamı ve tercih geçerlilik denetimi yok. Tercihi çalışan/proje kapsamına almak, auth değişiminde belleği ayırmak, aktif erişilebilir cihaz listesinde doğrulamak ve geçersiz seçimde cihaz seçimine yönlendirmek gerekir.

### HOME-F08 — P1 — Geciken tek seferlik sorgu, çıkıştan sonra eski çalışanın kayıtlarını yeniden yazabilir

- **Kanıt:** `loadAttendanceRecords` kullanıcıyı yalnız başlangıçta kontrol eder ve await sonucunu doğrudan ortak listeye atar (`attendance_provider.dart:256–267`). `_silentRefresh` aynı örüntüdedir (`attendance_provider.dart:231–237`). Çıkışta liste temizlenir ve abonelik nesli artırılır (`attendance_provider.dart:142–147,219–225`), fakat bu iki Future dönüşünde nesil/kullanıcı kontrolü yoktur. Ana uygulama aynı AttendanceProvider'ı auth değişimlerinde yeniden kullanır (`main.dart:79–84`). HTTP sorgusu başlatıldığı andaki oturumu args'a koyar (`convex_config.dart:119–128`).
- **Tetikleyici:** A için manuel yenileme/sessiz yenileme yanıtı geciktirilir; A çıkış yapar, B giriş yapar ve B'nin sorgusu tamamlanır; sonra A'nın bekleyen yanıtı döner.
- **Beklenen / mevcut:** A yanıtı artık dikkate alınmamalı; mevcut kod A kayıtlarını B'nin provider listesine koyup notify edebilir. Polling callback'lerinin nesil koruması bu doğrudan list çağrılarını kapsamaz (`attendance_provider.dart:162–175`).
- **Etki:** Aynı cihazda hesap değişiminde önceki çalışanın hareketleri geçici olarak diğer hesapta görünebilir; kart ve ortak geçmiş listesi etkilenebilir. Bu, sunucuda başka kullanıcının verisini sorgulama açığı değil, istemci state yarışı riskidir; sahada gerçekleşme gözlenmedi.
- **Kök neden / çözüm:** İstek sonucu auth bağlamına bağlanmıyor. Tüm async okuma/komut sonuçlarını oturum nesli + çalışan kimliğiyle doğrulamak, değişimde pending sonuçları geçersiz kılmak ve eski işlemin finally/hata güncellemesini de engellemek gerekir.

### HOME-F09 — P1 — Kaydedilmiş cihaz pasife alınsa da selfCheckIn onaylı kayıt üretebiliyor

- **Kanıt:** Mobil seçim listesi aktif olmayan cihazları dışlar (`devices.ts:131–132`). Önceden kaydedilen seçim ana sayfada yeniden listelenmeden kullanılır (`home_screen.dart:230–245`, `preferred_device_provider.dart:17–20`). `selfCheckIn` cihazın varlığını kontrol eder (`cardReadings.ts:1386–1399`) fakat `device.isActive` kontrolü yapmaz; ortak aktif kural varsa onay verir (`1419–1425`) ve onaylı kayıt yazar (`1434–1448`).
- **Tetikleyici:** Çalışan erişimi olan cihazı tercih olarak kaydeder; yönetici cihazı pasife alır, grup bağlantısı ve kural aktif kalır; çalışan kısayola basar.
- **Beklenen / mevcut:** Seçim listesinin aktif cihaz politikası işlem anında da uygulanmalı; mevcut handler pasif cihaza “izin_verildi” kaydı oluşturabilir.
- **Etki:** Devre dışı bırakma politikası mobil kayıt oluşturmayı durdurmaz; yanlış yoklama/erişim kaydı oluşur. HOME-F01 nedeniyle fiziksel kapının açılabildiği iddia edilmiyor.
- **Kök neden / çözüm:** Aktiflik yalnız listeleme filtresinde, mutation'ın karar önkoşullarında değil. Cihaz/proje/çalışan erişim önkoşullarını işlem anında sunucuda doğrulamak ve pasif hedefte onaylı hareket üretmemek gerekir; tercih UI kontrolü tek başına yeterli değildir.

## 4. Ayrıntılı geliştirme iş paketleri

Boyutlar takvim taahhüdü değildir: **S** dar yerel değişiklik, **M** birkaç katman ve anlamlı regresyon, **L** ürün sözleşmesi/cihaz entegrasyonu veya çoklu tüketici değişimi. Aşağıdaki işler öneridir; bu audit kapsamında uygulanmadı.

### HOME-W01 — Kapı komutu ve gerçekleşmiş hareket sözleşmesi

- **Kapsam:** HOME-F01; ana sayfa kısayolu, repository sonuç tipi, çalışan yetkili backend ve cihaz komut sonucu.
- **Bağımlılıklar:** Ürün ekibinin “uzaktan aç” / “self check-in” kararı; desteklenen Hikvision/IDE Smart taşıma yolları ve olay onayı. HOME-W02 ile ortak işlem kimliği tasarımı.
- **Yapılacaklar:** Etiket/başarı anlamını kesinleştir; erişim kararı, komut kuyruğu/kabulü, başarısızlık ve geçiş olayını ayır; gerekiyorsa çalışan yetkili dar komut endpoint'i kur; PDKS'ye hangi olayın girdi olacağını belirle; mevcut kayıtlarla uyum politikasını yaz.
- **Gözlemlenebilir kabul:** “Açıldı” ancak tanımlı cihaz onayıyla görünür; çevrimdışı/komut reddi açık sonuç verir; yalnız komut isteğiyle gerçekleşmiş giriş/çıkış kaydı artmaz. Self check-in ürünü seçilirse UI fiziksel açma vaadi vermez ve kayıt kaynağı açıkça ayrılır.
- **Anlamlı testler:** Yetkili/yetkisiz çalışan, çevrimdışı cihaz, komut kabul edilip onay gelmemesi, yinelenen cihaz olayı, komut başarılı fakat geçiş olmaması, her destekli taşıma türü.
- **Tahmin:** L — fiziksel cihazla sözleşme, auth ve PDKS anlamı birlikte değişir; yalnız etiket daraltma kararı seçilirse S/M alt kapsamına düşebilir.

### HOME-W02 — Tek aktif işlem ve idempotency

- **Kapsam:** HOME-F02; QuickActionCard'ın enabled/busy arayüzü ve backend tekrar işleme politikası.
- **Bağımlılıklar:** HOME-W01'in komut/olay ayrımı; HOME-W05 oturum nesli.
- **Yapılacaklar:** Liste yenilemesinden ayrı komut durumu ekle; istek boyunca aynı hedefe ikinci gönderimi engelle; işlem ID'sini sunucuya taşı ve tekrar çağrısını ilk sonuca bağla; gerçek ikinci kullanıcı niyetini ayırt et.
- **Gözlemlenebilir kabul:** İstek sürerken hızlı işlem kullanılamaz ve erişilebilir meşgul açıklaması vardır; aynı işlem ID'siyle iki istekte tek etki/tek sonuç oluşur; istek bitmeden busy false olmaz; sonradan yapılan meşru yeni geçiş engellenmez.
- **Anlamlı testler:** Beş hızlı dokunma, yavaş yanıt, aynı ID ile eşzamanlı çağrı, yanıt kaybı sonrası tekrar, farklı ID ile sonraki hareket, sekme değişimi sırasında istek.
- **Tahmin:** M — UI ve provider değişimine ek sunucu tarafında tekrar güvenliği gerekir.

### HOME-W03 — Günlük özet API'si ve veri semantiği

- **Kapsam:** HOME-F04/F06; günlük statü, yön sayaçları ve bilinmeyen yön; geçmiş liste sözleşmesiyle ayrım.
- **Bağımlılıklar:** HOME-W04 gün/saat politikası; HOME-W01 kaynak/gerçekleşme anlamı. Paylaşılan attendance tüketicileriyle koordinasyon gerekir.
- **Yapılacaklar:** Çalışan oturumundan türetilen, belirli iş günü için tam özet dönen query tasarla; olay zamanı indeksini kullan; son onaylı yönü, giriş/çıkış adetlerini ve belirsiz yön adedini ayrı döndür; ham geçmiş pagination'ını özetten ayır; kaynak filtrelerinin PDKS ile farkını belgelerken ham biyometrik/unknown kayıtlarını sessizce eşitleme.
- **Gözlemlenebilir kabul:** Aynı gün özeti 50/500 geçmiş kaydı yüklenmesinden bağımsızdır; geç gelen eski kayıt en son hareketi düşürmez; retler statüyü değiştirmez; bilinmeyen yön kesin İçeride sayılmaz; yanıt büyük geçmişte de sınırlı boyuttadır.
- **Anlamlı testler:** Son gerçek olaydan sonra 60 eski import; 60 ret; 80 onaylı günlük hareket; çıkış–giriş–çıkış–yeniden giriş; null yön; aynı zamanlı olaylar için kararlı seçim; iki çalışan/proje izolasyonu.
- **Tahmin:** L — yeni özet sözleşmesi, indeks/ölçek yaklaşımı ve ortak provider ayrımı gerektirir.

### HOME-W04 — Ortak iş günü ve saat güncellemesi

- **Kapsam:** HOME-F05; provider tarih aralığı, başlık, selamlama ve gelecekte aylık metrikler.
- **Bağımlılıklar:** Ürün kararı: Türkiye/proje günü mü, telefon günü mü; gece vardiyası günlük statüsü mü, fiziksel mevcudiyet mi.
- **Yapılacaklar:** Enjekte edilebilir saat/gün anahtarı kur; `[start,nextStart)` sınırını uygula; backend ve UI'ın iş günü bilgisini ortaklaştır; gün değişimi ve uygulamaya dönüşte başlık/kartı birlikte tazele; kullanıcıya saat dilimini gerektiğinde belirt.
- **Gözlemlenebilir kabul:** Tam gece yarısı hareketi doğru güne dahil; bir olay yalnız tek güne ait; telefon saat dilimi değişimi onaylı iş günü sonucunu sessizce değiştirmez; ekran açıkken ve arka plandan dönüşte tarih/selamlama/kart günleri tutarlı.
- **Anlamlı testler:** 23:59:59.999, 00:00:00.000, ay/yıl sonu, UTC ve Türkiye telefonu, destekleniyorsa DST günü, gece vardiyası, ağ yokken gün değişimi.
- **Tahmin:** M — ortak saat bağımlılığı ve yaşam döngüsü yenilemesi; vardiya tabanlı gün tanımı seçilirse kapsam büyür.

### HOME-W05 — Async sonuçları oturum kapsamına bağlama

- **Kapsam:** HOME-F08; provider'ın tüm tek seferlik ve abonelik sonuçları, hata ve finally güncellemeleri.
- **Bağımlılıklar:** AuthProvider oturum değişimi bildirimi; mevcut polling nesliyle uyum.
- **Yapılacaklar:** Her işlem başlangıcında kullanıcı/oturum neslini yakala; dönüşte eşleşmeyen sonucu at; auth değişiminde kayıt, hatalar ve busy durumunu uygun kapsamda sıfırla; eski sessiz yenilemenin yeni listeyi ezmesini engelle.
- **Gözlemlenebilir kabul:** A'nın gecikmiş sonucu B oturumundaki kayıt/hata/loading alanlarını değiştiremez; çıkış sonrası eski veri yeniden görünmez; yeni kullanıcının polling'i devam eder; dispose sonrası state bildirimi yapılmaz.
- **Anlamlı testler:** Kontrollü Future ile A-load → logout → B-load → A-response sırası; A-silentRefresh geç dönüşü; eski isteğin hata ve finally dönüşü; aynı kullanıcının yeni oturumu; arka plan/ön plan geçişi.
- **Tahmin:** M — mevcut generation desenini bütün async yollarına yaymak ve sıralama testleri gerekir.

### HOME-W06 — Ana sayfa veri ve komut durumlarının görünür olması

- **Kapsam:** HOME-F03; durum kartı, yenileme, typed komut sonucu ve hata yerelleştirme.
- **Bağımlılıklar:** HOME-W01/W03 sonuç sözleşmeleri; HOME-W02 busy durumu.
- **Yapılacaklar:** İlk yükleme görünümü, başarılı boş görünümü, stale etiketi/son başarılı güncelleme ve yeniden dene aksiyonu ekle; ağ/timeout/yetki reddini ayır; başarılı veri üstüne yenileme hatasında son veriyi koru fakat güncelliğini belirt; ekran okuyucu duyurularını tanımla.
- **Gözlemlenebilir kabul:** İlk veri gelmeden “Henüz Yok” iş gerçeği olarak sunulmaz; hata görülebilir ve yeniden denenebilir; teknik hata “Erişim Reddedildi” olmaz; yenileme başarı/başarısızlığı kullanıcıca anlaşılır; eski veri silinmeden stale olarak işaretlenir.
- **Anlamlı testler:** Soğuk açılışta gecikme, boş başarı, ilk yükleme hatası, dolu veri sonrası hata, timeout sonrası başarı, iş kuralı reddi, auth expiry yönlendirmesi.
- **Tahmin:** M — kart/provider durumu ve yerelleştirilmiş sonuçlar birlikte değişir.

### HOME-W07 — Tercih kapsamı ve işlem anında cihaz geçerliliği

- **Kapsam:** HOME-F07/F09; tercihin çalışan/proje kapsamı, seçimin eskimesi ve sunucu önkoşulları.
- **Bağımlılıklar:** Auth kapsamı, cihaz yönetiminde isActive anlamı; HOME-W01 yetkili komut tasarımı.
- **Yapılacaklar:** Tercihi oturumu olan çalışana/projeye göre ayır; eski ortak anahtarlar için güvenli geçiş tasarla; girişte veya işlemden önce seçimin erişilebilir aktif cihaz olup olmadığını doğrula; silinmiş/pasif/erişimi kaldırılmış cihazda seçim CTA'sı göster; backend handler'da aktiflik ve proje tutarlılığını işlem anında doğrula.
- **Gözlemlenebilir kabul:** A'nın tercihi B'ye görünmez; pasif/silinmiş cihaz onaylı hareket üretmez; yetki kaldırılması yerel önbelleğe rağmen sunucuda uygulanır; cihaz adı değiştiğinde yeni ad görünür; seçim yokken doğrudan seçim yoluna anlaşılır yönlendirme vardır.
- **Anlamlı testler:** A/B hesap değişimi, aynı hesap yeniden giriş, uygulama yeniden başlatma, cihaz pasife alma/silme/ad değiştirme, kural devre dışı bırakma, ağ yokken eski tercih, eski anahtarların geçişi.
- **Tahmin:** M — yerel saklama, auth bağlama ve backend önkoşulları birlikte ele alınır.

### HOME-W08 — Kart yerleşimi ve bağlı olmayan dashboard bileşenleri için ürün kararı

- **Kapsam:** Önleyici geliştirme; yeni işlevsel bug iddiası değildir. Dar ekran/erişilebilirlik doğrulaması ve `ProgressHeroCard`/`StatCard` geleceği.
- **Bağımlılıklar:** HOME-W03/W04 istatistik sözleşmesi; ürün ekibinin aylık özet gösterme kararı.
- **Yapılacaklar:** Dört sabit kolonlu hızlı işlemi (`home_screen.dart:179–218`) ve sabit 96 piksel etiket + esnemeyen saat/ek hareket satırını (`attendance_status_card.dart:179–205`) 320 dp ve büyük yazıda doğrula; gerekiyorsa grid/wrap/flexible kullan; uzun cihaz adının tam erişilebilir etiketini sağla. Aylık kartlar bağlanacaksa işgünü/izin/vardiya/kaynak kapsamı tanımlanmadan mevcut getter'ları kullanma; bağlanmayacaksa kullanım dışı parçaları ürün backlog'unda açıkça işaretle.
- **Gözlemlenebilir kabul:** Desteklenen en dar ekranda ve büyük sistem yazısında taşma yok; dört eylem ve son saatler okunur/erişilir; ekran okuyucu eylem, hedef ve busy durumunu duyurur. Aylık kartlar seçilirse sıfır toplam ve sınırı aşan segmentler için belirli davranış vardır; bütün ayın verisi kullanılmadan tam ay sonucu sunulmaz.
- **Anlamlı testler:** 320/360/430 dp, tablet, yatay, TR/EN, %200 yazı, uzun cihaz adı, üç haneli ek hareket, açık/koyu tema; ilerleme toplamı sıfır ve toplamı aşan segmentler.
- **Tahmin:** S yalnız doğrulama/yerleşim düzeltmesi; aylık veri bağlama seçilirse M/L ayrı kapsam — görünür olmayan bileşenin varlığı teslim edilmiş dashboard sayılmaz.

Önerilen sıra: HOME-W01 ürün sözleşmesi ve HOME-W04 gün politikası kararı; ardından HOME-W02/W05/W07 veri bütünlüğü; HOME-W03 özet; HOME-W06 görünür durumlar; HOME-W08 cihaz kabulü. Bazı tasarım işleri paralel yürütülebilir; bu bir takvim taahhüdü değildir.

## 5. Manuel cihaz / E2E doğrulama matrisi

**Bütün satırlar planlandı, çalıştırılmadı.** Gerçek kapı/çalışan verisini etkileyen senaryolar yalnız koordinatörün yönettiği izole test ortamında yapılmalıdır. Bu rapor test ortamına bağlantı veya mutation izni kullanmadı.

| ID | Ortam / kurulum | İşlem | Beklenen gözlem / kanıt |
| --- | --- | --- | --- |
| HOME-E01 | Android ve iOS, soğuk başlangıç, yavaş ağ | Giriş → ana sayfa | İlk yükleme ayrı; ad doğru; boş/gerçek veri durumu tamamlanınca belirir; backend yanıtı ile kart eşleşir |
| HOME-E02 | Onaylı giriş, çıkış, yeniden giriş ve ret içeren test çalışanı | Ana sayfa ve geçmişi karşılaştır | Son onaylı yön, son giriş/çıkış ve ek yön sayıları eşleşir; ret statüyü değiştirmez |
| HOME-E03 | Dolu veri sonrası offline, ardından online | Aşağı çek, bekle, yeniden bağlan | Eski veri stale görünür; hata/yeniden dene anlaşılır; toparlanma sonrası güncelleme ve son güncelleme bilgisi doğru |
| HOME-E04 | Ön planda farklı terminalden test olayı; sonra uygulama arka planda | Polling ve dönüşü izle | Ön planda beklenen polling aralığında değişim; arka planda yeni polling yok; dönüşte yenileme; anlık WebSocket iddiası yok |
| HOME-E05 | Her üç status, kamera izin verildi/reddedildi | QR CTA'ya bas; sekmeler arasında git | Doğru branch seçili; metin kullanıcıyı yanıltmıyor; izin reddi anlaşılır; tarayıcı hedefi açılır. Gerçek tarama başarısı ayrıca QR modülüyle doğrulanır |
| HOME-E06 | Tercih yok; sonra cihaz seçilmiş | Kapıyı Aç ve profil → cihaz seçimi | Boş tercihte seçim yolu; seçilen ad doğru; seçimden dönüşte ana sayfa hedefi güncel |
| HOME-E07 | Yetkili çalışan, gerçek destekli test kapısı | Bir kez Kapıyı Aç | Komut/cihaz onayı/fiziksel açılma/geçiş kaydı ayrı izlenir; mevcut kodun yalnız kayıt yazması HOME-F01 regresyon kabulünde yakalanmalı |
| HOME-E08 | Yavaş yanıt, both yönlü cihaz | Hızlı art arda dokun | Tek niyet tek etki; gereksiz giriş/çıkış toggle'ı yok; busy görünür |
| HOME-E09 | Önceden seçilmiş, sonra pasif/silinmiş/yetkisi kaldırılmış cihaz | Kısayolu çalıştır | Onaylı kayıt/başarı yok; neden ve yeni seçim yolu açık; backend önkoşul kanıtı |
| HOME-E10 | A/B çalışanı, geciktirilebilen test yanıtları | A yenile → çıkış → B giriş → A yanıtını serbest bırak | B hiçbir anda A'nın durum/saat/verisini görmez; tercih kapsamı da karışmaz |
| HOME-E11 | Türkiye ve farklı saat dilimi, saat kontrolü olan cihaz | Gece yarısı ve ay/yıl geçişini izle | Başlık ve kart aynı iş gününü kullanır; 00:00 olayı bir kez dahil; selamlama güncel |
| HOME-E12 | Çok sayıda ret, eski olay importu ve >50 günlük hareket | Ana sayfayı aç, sonra geçmişte ek sayfa yükle | Ana günlük özet değişmeden doğru kalır; liste pencere boyutu statüyü etkilemez |
| HOME-E13 | Yönü boş test kaydı | Durum kartını aç | Bilinmeyen yön kesin giriş/İçeride diye gösterilmez |
| HOME-E14 | 320 dp telefon, tablet/yatay, TR/EN, açık/koyu, %200 yazı, VoiceOver/TalkBack | Kartları ve kısayolları gez | Taşma/kaybolan CTA yok; tam hedef adı ve işlem durumu erişilebilir; kontrast ve odak elle incelenir |
| HOME-E15 | Oturum süresi sonu, ana sayfa açık | Polling/yenileme veya işlem | Login'e yönlendirme; eski data/komut sonucu yeni oturumda görünmez; yanlış erişim reddi bildirimi kalmaz |

## 6. Açık sorular ve kanıt sınırları

1. “Kapıyı Aç” ürün olarak uzaktan fiziksel komut mu, kendi yoklamasını kaydetme mi? İkinci anlam seçilecekse çalışanın fiziksel konumunun kanıtı ve PDKS kaynağı nasıl tanımlanacak?
2. “İçeride” gün içi son hareketi mi, önceki günden taşan gerçek mevcudiyeti mi temsil ediyor? Çoklu bina/cihaz ve gece vardiyası için bir global içeri/dışarı statüsü doğru mu? Backend `both` yönü çalışan+cihaz bazında toggle ediyor; UI tüm cihazları birleştiriyor (`cardReadingProcess.ts:58–72`, `attendance_provider.dart:111–125`). Bu ürün semantiği onaylanmadan tek başına yeni bug sayılmadı.
3. Cihaz `accessDirection=entry` iken kart “QR Kod Tara - Çıkış Yap” diyebilir; seçilen QR yönü sunucuca belirleniyor. Kullanıcı talimatı cihazdan bağımsız “QR Kod Tara” mı olmalı, yoksa hedef yön önceden bilinebilecek mi? Cihazda bu kombinasyon denenmedi.
4. İş günü için Türkiye sabit saat dilimi mi, proje saat dilimi mi esas? Telefon saat dilimi ve manuel saat değişimi nasıl ele alınacak?
5. `direction` boş legacy kayıtlar üretimde var mı; bunların güvenilir yönünü kuracak kaynak mevcut mu? Kaynak veri okunmadı.
6. Geçmişten içe alma ve ret hacimleri ne düzeyde? Özet query'si yüksek günlük hacimde hangi indeks/ön hesap yaklaşımını kullanacak? Mevcut koşullu hata zinciri saptandı, üretim yaygınlığı ölçülmedi.
7. Ana sayfa yoklama kartı tüm onaylı erişimleri mi, yalnız PDKS'ye uygun kaynakları mı göstermeli? Mobil model `source` alanını almıyor; PDKS biyometrik/unknown kaynakları dışlıyor (`attendance.dart:36–59`, `pdksSource.ts:72–81`). Ekranlar arası farkın ürün anlamı belirlenmeli.
8. Aylık metrikler bu sürümün hedefi mi? Mevcut taslaklar çalışma takvimi/izin/vardiya ve tam ay veri kapsamını sağlamıyor; sahte aylık başarı iddiası veya canlı gösterim bu denetimde yok.
9. Aktiflik/erişim kaldırıldıktan sonra önceden seçilmiş cihaz nasıl görünmeli? Her girişte tercih doğrulaması mı, işlem anında hata+seçim yönlendirmesi mi bekleniyor?
10. Dar ekran/büyük yazı/koyu tema/ekran okuyucu sonucu ve fiziksel cihaz komutları henüz doğrulanmadı. Sabit genişliklerden taşma olasılığı manuel matriste tutuldu; cihazda gerçekleşmiş hata gibi raporlanmadı.

Bu belgenin kapsamındaki tek üretilen dosya `docs/mobile-audit/modules/02-home.md` dosyasıdır. Bulguların çözümü ve test yürütmesi ayrı geliştirme işidir; bu rapor bunların tamamlandığını iddia etmez.
