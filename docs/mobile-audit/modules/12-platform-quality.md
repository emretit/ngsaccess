# 12 — Platform, test ve yayın hazırlığı

Tarih: 19 Ekim 2026. İnceleme, mevcut çalışma ağacının salt okunur kaynak analizidir. Uygulama, backend, platform veya test kodu değiştirilmedi; formatlama, bağımlılık yükleme, build, deploy, commit ve push yapılmadı. Bu worker Flutter komutu çalıştırmadı. Bu rapor dışında dosya yazılmadı.

**Sonuç:** Mobil uygulamada test edilebilir bir veri katmanı ve anlamlı 44 test var; bunlar mağazaya hazır paket veya canlı uçtan uca akış kanıtı değil. Android release'in debug anahtarına bağlanması ile yapılandırma eksikliğinde sabit deployment'a sessiz dönüş, öncelikli iki yayın riski. Ayrıca yerel bağımlılık grafikleri, tekrarlanabilir build/CI sözleşmesi, izinler, macOS kabiliyetleri, dokümantasyon ve üretim gözlemlenebilirliği için altı P2 bulgu var. P0 veya kanıtlanmış üretim kesintisi/veri sızıntısı bulunmadı.

## 1. Kapsam, yöntem ve kanıt sınırı

Koordinatörün [baz doğrulaması](../evidence/baseline.md), Flutter 3.47.2 / Dart 3.13.2 ortamında `flutter analyze --no-pub` için temiz sonuç ve `flutter test --no-pub --reporter expanded` için **44 başarılı test** bildiriyor (`baseline.md:7–11`, ham test çıktısı `flutter-test.txt:52`). Bu çalıştırmalar koordinatöre aittir. Test sayıları kaynakta ayrıca sayıldı; kod kapsam yüzdesi ölçülmedi. Cihaz, simülatör, canlı Convex, fiziksel kapı, release APK/AAB/IPA, mağaza ve masaüstü çalıştırması yapılmadı.

Depodaki mevcut web/Convex değişikliklerine dokunulmadı. Backend kaynakları bu modülde okunmadı; dolayısıyla backend yetkilendirmesi, kaydın kalıcılığı veya kapının gerçekten açılması hakkında sonuç çıkarılmadı. Kullanıcı bağlamı, mobilin çalışan oturumunu kullanması ve gönderdiği endpoint/argüman zinciri üzerinden incelendi. Diğer modüllerdeki backend bulgularıyla birleştirme gerekir.

İncelenen dosya grupları:

| Grup | Tarama ve ayrıntılı inceleme |
|---|---|
| Paket, yapılandırma, belge | `mobile/pubspec.yaml`, `pubspec.lock` tamamı, `analysis_options.yaml`, `README.md`, `.gitignore`, `.metadata`, `l10n.yaml`; kök `.gitignore`, `package.json`; SDK pin ve CI dosyaları için depo envanteri |
| Android | `android/app/build.gradle.kts`, `settings.gradle.kts`, kök `build.gradle.kts`, `gradle.properties`, `gradle/wrapper/gradle-wrapper.properties`, üç `AndroidManifest.xml` (main/debug/profile), `MainActivity.kt`, `.gitignore`; `res/` altındaki styles, colors, adaptive icon ve launch XML'leri |
| iOS | `Podfile`, `Podfile.lock`, `Flutter/{AppFrameworkInfo.plist,Debug.xcconfig,Release.xcconfig}`, `Runner/{Info.plist,AppDelegate.swift,Runner-Bridging-Header.h}`, iki storyboard, iki asset kataloğu JSON'u ve launch README; `Runner.xcodeproj/project.pbxproj` tamamı, paylaşılmış Runner scheme, proje/workspace XML/plist/xcsettings dosyaları, `RunnerTests/RunnerTests.swift`, `.gitignore` |
| macOS | `Podfile`, `Podfile.lock`, `.gitignore`, `Flutter/` xcconfig ve registrant; `Runner.xcodeproj/project.pbxproj` tamamı, Runner scheme, workspace/plist; `Runner/` Info, iki entitlement, AppDelegate, MainFlutterWindow, dört config, MainMenu.xib ve ikon kataloğu; `RunnerTests/RunnerTests.swift` |
| Windows | Üç `CMakeLists.txt`, `.gitignore`, generated registrant `.cc/.h` ve plugins CMake; `runner/` altındaki `main.cpp`, `flutter_window.cpp/.h`, `win32_window.cpp/.h`, `utils.cpp/.h`, `Runner.rc`, `resource.h`, `runner.exe.manifest` |
| Linux | Üç `CMakeLists.txt`, `.gitignore`, generated registrant `.cc/.h` ve plugins CMake; `runner/main.cc`, `my_application.cc/.h` |
| Web | `web/index.html`, `web/manifest.json`; favicon ve dört ikonun varlığı |
| Testler | `test/config/convex_config_test.dart`, `test/core/errors_test.dart`, `test/helpers/mocks.dart`, iki provider testi, iki repository testi, login ve responsive container widget testleri; toplam dokuz Dart dosyası, sekiz test dosyası |
| Akış bağlamı | `lib/main.dart`, `config/convex_config.dart`, `core/errors.dart`, üç repository, auth/attendance provider, router, QR ekranı, forgot-password ve visitor ekranları, `theme/app_theme.dart`; logging/permission/font kullanımı için `lib/` genelinde arama |
| Yerel/üretilmiş izler | Güncel `.flutter-plugins-dependencies` ile izlenen `... 2` ve `... 3` kopyalarında yalnız plugin adları/SDK metadata'sı; üretilmiş native registrant bağlantıları. Bunlar temiz checkout'un doğruluk kaynağı kabul edilmedi. |

İkon/görsellerde yalnız varlık ve katalog dosya referansları kontrol edildi; görsel kalite değerlendirilmedi. Android wrapper yürütücüleri/JAR, yerel SDK yolları, Pods/ephemeral/cache/build çıktıları ve Xcode kişisel UI durumu ürün kaynak incelemesine dahil edilmedi. İki Apple ikon kataloğunda eksik dosya referansı görülmedi. `.env` değeri okunabilir çıktıya alınmadı; yalnız anahtar yapısı ve Git takibi kontrol edildi. Mevcut dosyada yalnız `CONVEX_URL` anahtarı var; bu adres tek başına secret değildir. Hiçbir gerçek env, anahtar, token veya kişisel veri değeri bu rapora kopyalanmadı.

### Mevcut gerçek capability tablosu

Burada **çalışıyor**, yalnız belirtilen yerel test/derleme dışı kontrolün geçtiğini; **kısmi**, kaynakta gerçek uygulama bulunup platform/E2E doğrulamasının tamamlanmadığını ifade eder.

| Akış / kabiliyet | Durum | Gerçek uygulama ve sınır |
|---|---|---|
| Dart statik analiz ve mevcut test paketi | çalışıyor | Koordinatör: temiz analiz, 44 test. Native build veya canlı entegrasyon değildir. |
| Çalışan girişi / oturum / çıkış | kısmi | `AuthRepository.signIn` → `employeeAuth:signIn` (`auth_repository.dart:59–81`); çalışan token'ı `employeeQuery/Mutation` argümanına eklenir (`convex_config.dart:118–147`). Testlerde mock yanıtlar var; gerçek hesap ve backend çalıştırılmadı. |
| Liste ve self-check-in | kısmi | `cardReadings:listForEmployee` ve `cardReadings:selfCheckIn` çağrıları (`attendance_repository.dart:13–37`). Mutation otomatik retry edilmez; `granted` yanıtı okunur. Fiziksel kapı etkisi kanıtlanamadı. |
| Gerçek kamera ile QR okuma | kısmi | `MobileScanner` ve controller mevcut (`qr_scan_screen.dart:24–26,146–153,460–478`). README'deki yalnız demo tarama tanımı güncel değil. Cihaz izni, görüntü, torch ve lifecycle doğrulanmadı. |
| Çalışanın QR'ını cihazda okutması | kısmi | `employeeCheckIn:createMyCheckInToken` gerçek çağrı, süre alanı ve QR gösterimi var (`qr_scan_screen.dart:46–85,280–315`). Token'ın cihazda tüketilmesi bu incelemede kanıtlanamadı. |
| Ziyaretçi yönetimi | placeholder | Ekran yalnız “Çok yakında” metni gösteriyor; veri/işlem çağrısı yok (`visitor_screen.dart:20–50`). Demo veriyle çalışan CRUD da değil. |
| Self-servis kayıt / şifre sıfırlama | placeholder | Router'da kayıt yolu yok (`app_router.dart:28–40,63–125`); `resetPassword` yöneticiye yönlendirme mesajı verip daima false döner (`auth_provider.dart:106–110`). |
| Yerelleştirme ve tema altyapısı | kısmi | TR/EN delegate'leri ve tema provider'ı bağlanmış (`main.dart:48,87–96`, `l10n.yaml:1–5`); bütün ekranların dil/erişilebilirlik doğrulaması yapılmadı. |
| Android ağ / kamera bildirimleri | kısmi | Main manifest'te internet ve kamera var (`AndroidManifest.xml:3–9`); nihai merged manifest incelenmedi. Release imzası F01. |
| iOS native başlatma ve kamera açıklaması | kısmi | Engine plugin kaydı (`AppDelegate.swift:5–15`), kamera açıklaması (`Info.plist:44–45`) var. Native build, imza, gerçek izin ekranı kanıtlanamadı. |
| Android mağaza yayını | kısmi | Sürüm pubspec'ten alınır; release debug imzalı yapılandırılmış (`app/build.gradle.kts:29–37`). Mağaza yayını yapılmadı. |
| iOS mağaza yayını | kanıtlanamadı | Bundle ID ve team seçimi mevcut, sürüm Flutter alanlarından gelir (`project.pbxproj:691–709`, `Info.plist:21–22,38–39`); dağıtım profili, arşiv/export, mağaza kabulü doğrulanmadı. Team değerleri rapora alınmadı. |
| macOS / Windows / Linux / web ürün desteği | kısmi | Runner/manifest/CMake iskeletleri var; destek taahhüdü ve platform testleri yok. macOS'ta F06; Windows/Linux kamera desteği için platform ayrımı bulunmuyor. |
| CI, build artefaktı, release kontrol kapısı | kanıtlanamadı | Depoda ürün için izlenen CI workflow/release otomasyonu saptanmadı. Harici CI veya mağaza ayarlarının bulunmadığı anlamına gelmez. |
| Üretim hata toplama / performans izleme | kısmi | Tipli kullanıcı hataları ve debug log var; merkezi kayıt, crash hook ve release bağlamı saptanmadı (F08). |

### Test kapsam haritası

| Test dosyası | Sayı | Gerçekten doğruladığı | Doğrulamadığı |
|---|---:|---|---|
| `test/config/convex_config_test.dart:10–81` | 2 | Mock HTTP ile polling'in çakışmaması/iptali ve 401 sonrası durması | Canlı protokol, genel retry matrisi, timeout/5xx/403, platform ağ davranışı |
| `test/core/errors_test.dart:8–56` | 9 | İstisna sınıflama ve kullanıcı mesajları | Güvenli telemetry, UI'nin bütün hata yolları |
| `test/providers/auth_provider_test.dart:29–182` | 8 | Mock repo ile sign-in, hata, expiry, logout, hata temizleme | Soğuk açılış bootstrap, gerçek disk/keychain, başarılı login-router geçişi |
| `test/providers/attendance_provider_test.dart:74–220` | 8 | Mock repo ile lifecycle polling, liste/hata/expiry, geçersiz QR ve reddedilmiş kayıt filtresi | Geçerli QR'ın kamera→parser→mutation→yenileme zinciri, quick unlock, istatistik/sayfalama doğruluğu |
| `test/repositories/auth_repository_test.dart:21–127` | 6 | Sahte istemci yanıtının modele dönüşmesi, eksik yanıt, sign-out argümanı | Gerçek çalışan hesabı ve sunucu sözleşmesinin güncel hali |
| `test/repositories/attendance_repository_test.dart:21–97` | 5 | Sahte yanıtın parse edilmesi, ID/seri payload'ı, boş cihaz reddi | Backend yetki kararı, gerçek kayıt/cihaz etkisi |
| `test/widgets/login_screen_test.dart:49–130` | 4 | TR form doğrulama ve mock başarısız giriş snackbar'ı | Başarılı giriş, gerçek router, küçük ekran/klavye/screen reader; test viewport'u 720×1600 (`:42–46`) |
| `test/widgets/responsive_container_test.dart:15–60` | 2 | Container'ın 360 ve 1200 genişlikte clamp davranışı | Gerçek ekranlardaki taşmalar, büyük yazı, platform yönelimleri |
| **Toplam** | **44** | Koordinatör çalıştırmasında başarılı | E2E/cihaz/release kapsam oranı olarak yorumlanamaz |

`test/helpers/mocks.dart:7–13` repository ve HTTP mock sınırlarını açıkça gösteriyor. iOS ve macOS `RunnerTests.swift:7–9` içindeki `testExample` gövdeleri boş; gerçek native assertion yok. `integration_test/` dizini veya `integration_test` bağımlılığı saptanmadı (`pubspec.yaml:54–59` mevcut dev bağımlılıkların tamamı). Test eksikleri tek başlarına işlevsel bug olarak sayılmadı; WP09'da risk odaklı doğrulama kapsamı önerildi.

## 2. İyi çalışan temeller

- Repository/provider ayrımı ile HTTP istemcisine `http.Client` enjeksiyonu mevcut (`convex_config.dart:58–67`). Ağ ve domain sınırları gerçek backend'e yazmadan test edilebiliyor.
- Mutation retry varsayılanı false; query retry'ları timeout ve geçici hatalarla sınırlanmış (`convex_config.dart:98–107,225–260`). Belirsiz mutation yanıtında kör tekrar riskini azaltan temel var.
- Polling üst üste istek açmadan yeniden zamanlanıyor; auth expiry sonrası duruyor (`convex_config.dart:189–222`). Provider arka planda iptal, dönüşte yeniden başlatma ve eski abonelik yanıtlarını generation ile ayırma içeriyor (`attendance_provider.dart:151–178,243–253`); ilgili yerel testler geçti.
- Kullanıcıya ağ/timeout/sunucu/oturum hataları ayrı tiplerle aktarılıyor (`errors.dart:36–84`). Router auth değişimine bağlı redirect yapıyor (`app_router.dart:43–61`). Bunlar platform doğrulamasını kolaylaştırıyor.
- `pubspec.lock` hosted bağımlılıkları sürüm ve hash ile kaydediyor. Gradle/AGP/Kotlin sürümleri de kaynakta tanımlı (`gradle-wrapper.properties:5`, `settings.gradle.kts:19–22`). Tam araç zinciri sabitleme için başlangıç var.
- Android main manifest'te internet izni yalnız debug'a bırakılmamış; iOS'ta kamera kullanım gerekçesi var. Uygulama kaynaklarında geniş cleartext ağ izni, ATS bypass veya sertifika doğrulamasını kapatan özel kod saptanmadı. Bu, nihai paket güvenlik doğrulamasının yerini tutmaz.
- Android `.gitignore:10–14`, signing dosyaları için koruyucu ignore kuralları içeriyor. Mevcut secret yönetimi prosedürü veya uzaktaki kasanın varlığı buradan kanıtlanamaz.
- Android/iOS için ikon üretim tanımı (`pubspec.yaml:72–80`) ve referans verilen ikon varlıkları mevcut; Apple asset kataloglarındaki dosyalar varlık kontrolünden geçti.

## 3. Kanıtlı bulgular

Öncelikler: P0 kanıtlı acil veri/güvenlik/kritik kesinti; P1 ana akış, veri doğruluğu veya güçlü yetki/yayın riski; P2 dayanıklılık, UX ve bakım; P3 düşük etki. Aşağıdaki kaynak analizi sonuçları cihazda yeniden üretildi anlamına gelmez. Bu modülde **2 P1 + 6 P2** bulgu var.

### PLAT-F01 — Android release debug anahtarıyla imzalanıyor

- **Öncelik / kesinlik:** P1 / kaynak analizi; Gradle seçimi kesin, release build ve mağaza sonucu çalıştırılmadı.
- **Kanıt zinciri:** `mobile/android/app/build.gradle.kts:33–37`, release build type içinde `signingConfigs.getByName("debug")` seçiyor. Aynı dosyada release signing config veya dışarıdan upload key yükleme yolu yok. Keystore ignore kuralları `mobile/android/.gitignore:10–14` içinde mevcut olsa da yapılandırmaya bağlı değiller.
- **Tetikleyici:** Bu checkout'tan ayrıca Gradle override uygulanmadan release AAB/APK hazırlanması.
- **Beklenen / mevcut:** Onaylı upload/release kimliği seçilmeli, eksik signing bilgisi açık hata vermeli. Mevcut release seçimi geliştirici debug kimliği.
- **Etki:** Yayın kimliğinin ve paket güncelleme sürekliliğinin güvenilir biçimde kurulmasını engeller; release modunun seçilmesi doğru dağıtım imzasını sağlamıyor. Önceden mağazada yayın bulunduğu veya hangi anahtarın kullanıldığı bilinmiyor.
- **Kök neden / çözüm:** Şablon signing geçişi tamamlanmamış. Upload key'i güvenli CI/local secret kaynağından yükleyen ayrı release config, debug fallback'i reddeden kontrol ve üretilen paketin signer doğrulaması eklenmeli. [Flutter Android yayın belgesi](https://docs.flutter.dev/deployment/android#configure-signing-in-gradle), release için upload key yapılandırmasını tanımlar.
- **İş paketi:** PLAT-WP01.

### PLAT-F02 — Eksik env sessizce sabit deployment'a yöneliyor

- **Öncelik / kesinlik:** P1 / kaynak analizi; yanlış hedefe gerçek kullanıcı verisi gönderildiğine dair kanıt yok.
- **Kanıt zinciri:** `mobile/lib/config/convex_config.dart:13–14` anahtar yoksa kod içindeki sabit deployment adresini seçiyor; `:24–35` yükleme hatasını yalnız debug modunda loglayıp istemciyi yine kuruyor. `mobile/lib/main.dart:17–22` bunu uygulama açılışında çağırıyor. Giriş isteği email/password payload'ı (`auth_repository.dart:63–65`), çalışan sorguları token argümanı (`convex_config.dart:118–147`) ile seçilen URL'ye POST edilir (`:273–284`).
- **Tetikleyici:** Env dosyası yüklenememesi veya dosyada `CONVEX_URL` anahtarının unutulması. Boş/bozuk URL için de başlangıç doğrulaması yok; bu durumda otomatik fallback yerine daha sonra istek hatası oluşabilir.
- **Beklenen / mevcut:** Hedef açık seçilmeli; eksik/bozuk release konfigürasyonu kullanıcı kimlik bilgisi göndermeden durmalı. Mevcut kod sabit hedefle devam ediyor; release'te fallback uyarısı görünmüyor.
- **Etki:** Paket başka deployment için hazırlanırken kimlik bilgisi ve işlem isteğinin yanlış ortama gönderilmesi riski; yanlış/boş geçmiş ve destek sorunları. Sabit hedefin üretim/test veya yetkisiz bir hedef olduğu iddia edilmiyor.
- **Kök neden / çözüm:** Geliştirici kolaylığı yayın varsayılanı haline gelmiş. Build-time açık environment seçimi, URL şema/host doğrulaması ve release'te fail-fast uygulanmalı; yalnız kamuya açık config paketlenmeli. `pubspec.yaml:66–68` `.env` dosyasını asset yapıyor: dosya gizli kasa değildir. README `:120` dosyanın Git'e alınmadığını söylese de `git ls-files` bu dosyanın izlendiğini doğruladı; içerikte şu an yalnız URL anahtarı var, secret sızıntısı saptanmadı.
- **İş paketi:** PLAT-WP02; belge düzeltmesi WP07.

### PLAT-F03 — Apple native lock grafikleri mevcut plugin setini temsil etmiyor

- **Öncelik / kesinlik:** P2 / kaynak analizi; kesin bir build hatası iddiası değil.
- **Kanıt zinciri:** `mobile/pubspec.yaml:15–16,21–22` scanner ve preferences kullanıyor; `pubspec.lock:336–343,568–591` çözülmüş paketleri kaydediyor. iOS `Podfile:30–33` bütün plugin pod'larını dahil ederken `ios/Podfile.lock:1–14` yalnız Flutter ve permission handler içeriyor. macOS registrant `:8–13` scanner ve preferences kaydediyor, ancak `macos/Podfile.lock:1–19` scanner içermiyor ve Dart lock'ta bulunmayan eski app-links/url-launcher bağımlılıklarını taşıyor. Güncel yerel plugin metadata'sı SPM'yi kapalı gösteriyor; Xcode projesinde ayrıca üretilmiş SPM referansı var (`ios/.../project.pbxproj:748–758`).
- **Tetikleyici:** Yeni makinede native bağımlılıkların restore edilmesi veya lock'ların esas alınarak release hazırlığı.
- **Beklenen / mevcut:** Seçilen CocoaPods/SPM yöntemi ve kilitli native graph güncel Dart plugin graph'ıyla tutarlı olmalı. Mevcut lock'lar önceki bağımlılık setlerinden izler taşıyor.
- **Etki:** İlk native hazırlıkta beklenmeyen lock değişikliği, farklı çözümleme veya eksik plugin teşhisinde belirsizlik. `pod install`/Flutter tooling eksikleri otomatik yenileyebilir; bu nedenle “iOS çalışmaz” sonucu çıkarılamaz.
- **Kök neden / çözüm:** Dart güncellemesi ile native bağımlılık uzlaştırması ve temiz restore kanıtı birlikte tutulmamış. Tek entegrasyon yolu kararlaştırılmalı, uygun SDK ile lock/registrant üretimi yapılmalı ve temiz checkout native build'inde graph farkı kontrol edilmeli. İzlenen `.flutter-plugins-dependencies 2/3` kopyaları (`:1`) eski scanner/app-links setini içeriyor; canonical girdi sayılmayacak şekilde temizlenmeleri değerlendirilmelidir.
- **İş paketi:** PLAT-WP03.

### PLAT-F04 — Belgelenen SDK aralığı ile kilitli graph ve otomatik kalite kapısı arasında boşluk var

- **Öncelik / kesinlik:** P2 / kaynak analizi; süreç/tekrarlanabilirlik bulgusu, mevcut Dart testlerinin başarısızlığı değil.
- **Kanıt zinciri:** `mobile/pubspec.yaml:5–7` Dart `^3.8.0`, Flutter `>=3.5.0` beyan ediyor; `README.md:90–92` Flutter 3.5+ öneriyor. Mevcut `pubspec.lock:773–775` ise Dart `>=3.11.0-0`, Flutter `>=3.38.4` kaydediyor. Android `minSdk/targetSdk/compileSdk` Flutter kurulumundan türetiliyor (`app/build.gradle.kts:10–11,27–28`). `.metadata:6–8` bir revision kaydı taşıyor ama aktif SDK seçimini zorlayan komut/config değil. Repo envanterinde ürün CI workflow'u veya FVM/mise/tool-versions pin'i saptanmadı; kök `package.json:9–26` komutları mobil analiz/test/build çalıştırmıyor.
- **Tetikleyici:** README'nin izin verdiği daha düşük SDK ile aynı lock'ı restore etmek, iki geliştiricinin farklı Flutter kurulumlarıyla native paket üretmesi veya bir PR'ın yalnız kök check/test komutlarıyla değerlendirilmesi.
- **Beklenen / mevcut:** Desteklenen SDK ve kilitli çözümlemeyi üreten araç zinciri açık olmalı; mobil değişikliğin analiz/test ve hedef native build kapısı bulunmalı. Mevcut aralıklar aynı graph'ı geri getirecek ortak ortamı tarif etmiyor; depodan mobil CI kapısı kanıtlanamıyor.
- **Etki:** Farklı bağımlılık çözümü/API hedefi, tekrarlanan ortam sorunları ve native regresyonların yerel Dart testleri geçerken yayına taşınması riski. Harici CI veya organizasyon branch protection durumunun yokluğu kanıtlanmış değildir.
- **Kök neden / çözüm:** Araç zinciri ve mobil doğrulama kontratı repo seviyesinde tamamlanmamış. Desteklenen SDK pin'i, JDK/Xcode/CocoaPods beklentileri ve restore politikası belirlenmeli; mobile path filtreli analiz/test ve seçilen native build işleri sürüm kontrollü hale getirilmeli. Paketlerin “eski/güvensiz” olduğu veya mağaza hedef API koşullarını ihlal ettiği iddia edilmiyor.
- **İş paketi:** PLAT-WP04.

### PLAT-F05 — Kullanılmayan dosya/galeri izinleri dağıtım sözleşmesini genişletiyor

- **Öncelik / kesinlik:** P2 / kaynak analizi; iznin verildiği veya verinin okunduğu iddia edilmiyor.
- **Kanıt zinciri:** Android main manifest `:11–13` sınırsız READ/WRITE_EXTERNAL_STORAGE beyan ediyor; iOS `Runner/Info.plist:46–47` galeri kullanım açıklaması taşıyor. `pubspec.yaml:39–40` permission handler içeriyor ancak `lib/` taramasında import/istek kullanımı yok. Kamera doğrudan MobileScanner üzerinden kullanılıyor (`qr_scan_screen.dart:6,150–153`); mevcut visitor ekranı placeholder (`visitor_screen.dart:20–50`). Uygulama kaynaklarında galeri seçme/export dosya akışı saptanmadı.
- **Tetikleyici:** Bu manifestlerle paket inceleme, izin envanteri hazırlığı veya eski Android sürümlerinde storage izinlerinin değerlendirilmesi.
- **Beklenen / mevcut:** Yalnız yayımlanan özelliklerin gerektirdiği erişimler açıklanmalı; gelecekteki akışlar için gereksiz beyan taşınmamalı. Mevcut beyanlar uygulanan kullanıcı akışını aşıyor.
- **Etki:** Gereksiz erişim kapsamı, gizlilik beyanlarında belirsizlik ve bakım yükü. Güncel Android sürümünde bu izinlerin aynı şekilde çalışacağı veya mağaza reddi doğuracağına ilişkin hüküm verilmedi.
- **Kök neden / çözüm:** Şablon/gelecek özellik artıkları. Kullanılmayan izin/dependency'ler kaldırılmalı; planlanan dosya işi varsa platformun en az erişim isteyen seçici akışıyla ayrıca tanımlanmalı. Kamera hardware `required=true` (`AndroidManifest.xml:8`) de QR gösterme gibi kamerasız akışları olan cihaz desteği kararıyla birlikte gözden geçirilmeli; tek başına bug sayılmadı.
- **İş paketi:** PLAT-WP05.

### PLAT-F06 — macOS runner dış ağ ve kamera kabiliyetlerini tamamlamıyor

- **Öncelik / kesinlik:** P2 / kaynak analizi; masaüstü hedefinin destek taahhüdü bilinmediğinden mobil P1 olarak sayılmadı.
- **Kanıt zinciri:** `mobile/macos/Runner.xcodeproj/project.pbxproj:720–737` release için `Release.entitlements` seçiyor. Bu dosya `:4–7` yalnız App Sandbox içeriyor; debug/profile dosyası `:5–10` sandbox/JIT/network.server içeriyor, hiçbirinde `network.client` yok. Buna karşılık giriş ve tüm veri katmanı HTTP POST açıyor (`convex_config.dart:273–285`). Scanner macOS registrant'ta kayıtlı (`GeneratedPluginRegistrant.swift:8–13`); macOS Info.plist `:4–31` kamera açıklaması, entitlements kamera yetkisi içermiyor.
- **Tetikleyici:** Mevcut macOS runner'ın sandbox altında çalışan ürün olarak dağıtılması ve giriş/kamera ekranının açılması.
- **Beklenen / mevcut:** Desteklenen masaüstü hedefinde dış bağlantı ve kamera izinleri açıkça tamamlanmalı; desteklenmiyorsa bu hedef ürün desteği gibi sunulmamalı. Mevcut native kabiliyet seti ortak Dart akışının gereksinimlerini karşılamıyor.
- **Etki:** macOS paketinde çalışan girişi/veri ve tarama akışlarının başarısız olması beklenir; gerçek imzalı pakette doğrulanmadı. [Apple'ın entitlement tanımı](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client), dış bağlantıyı `network.client` ile ilişkilendirir.
- **Kök neden / çözüm:** Üretilmiş runner ürün ihtiyaçlarına göre uyarlanmamış. Önce destek matrisi kararı; destek varsa izinler, açıklamalar ve release smoke testi, destek yoksa belgede açık sınır. Windows/Linux için de scanner sunulmadan önce platform yetenek kontrolü gerekir; bu raporda o platformlarda runtime hata testi yapılmadı.
- **İş paketi:** PLAT-WP06.

### PLAT-F07 — README kurulumu ve özellik durumu gerçek uygulamayla çelişiyor

- **Öncelik / kesinlik:** P2 / doğrulandı (dosya ve kaynak karşılaştırması); kullanıcı kurulumu çalıştırılmadı.
- **Kanıt zinciri:** `mobile/README.md:109–112` bulunmayan `env.example` dosyasını kopyalatıyor; mobil ve kökte bu dosya yok. `:8–10,132–135` kayıt/e-posta doğrulama ve self-servis reset vaat ederken router'da kayıt yolu yok, reset yönetici mesajı döndürüyor (`auth_provider.dart:106–110`). `README.md:37–42` ziyaretçi CRUD var diyor; gerçek ekran placeholder. `:26,201` kamera yalnız demo/gelecek diyor; gerçek scanner mevcut. `:204` çoklu dili gelecek sayıyor; `main.dart:95–96` TR/EN delegate altyapısı bağlı. `:120` env Git'e alınmaz diyor; dosya izleniyor.
- **Tetikleyici:** Yeni geliştirici veya kabul testçisi yalnız README ile kuruluma/özellik kabulüne başlaması.
- **Beklenen / mevcut:** Çalışan kurulum adımları ve implemented/placeholder/planlanan ayrımı. Mevcut belge hem olmayan akışı tamamlanmış, hem mevcut altyapıyı gelecek olarak tanımlıyor.
- **Etki:** Kurulumda kopyalama adımı başarısız olur; yanlış test planı, satış/destek beklentisi ve gizli config algısı oluşur.
- **Kök neden / çözüm:** Mimari değişiklikler sonrası belge yenilenmemiş. Çalışan hesabının yönetici tarafından kurulması, gerçek backend endpoint kapsamı, kamuya açık config, destek platformları ve yayın adımları kodla eşleştirilerek yazılmalı. Eksik özelliğin yalnız belge düzeltmesiyle tamamlanmış sayılmaması gerekir.
- **İş paketi:** PLAT-WP07.

### PLAT-F08 — Release hatalarının bağlamı merkezi olarak korunmuyor

- **Öncelik / kesinlik:** P2 / kaynak analizi; crash yaşandığı veya tüm platform loglarının yok olduğu iddia edilmiyor.
- **Kanıt zinciri:** `main.dart:17–22` başlatma ve `:42–58` kurulumda özel Flutter/platform hata yakalama veya telemetry bağlantısı yok. `AppError.fromException(error, stack)` stack alıp saklamıyor (`errors.dart:21–32`). Bootstrap ve polling hataları yalnız kDebugMode log'una gidiyor (`auth_provider.dart:64–66`, `attendance_provider.dart:205–207`); `_silentRefresh` hatası tamamen yutuluyor (`attendance_provider.dart:231–239`). Pubspec ve `lib/` taramasında crash/metric servisi veya uygulamaya özgü merkezi logger bulunmadı.
- **Tetikleyici:** Release kullanıcısında başlangıç istisnası, sürekli sorgu hatası veya başarılı mutation sonrası sessiz yenileme hatası oluşması.
- **Beklenen / mevcut:** Release/platform/işlem türü ve temizlenmiş stack ile teşhis edilebilir, veri toplamayı sınırlayan hata olayı. Mevcut katman tipli hata gösterebiliyor ancak bu bağlamı kalıcı destek kanıtına dönüştürmüyor.
- **Etki:** Kullanıcı “geçmiş yenilenmiyor” dediğinde istemci/platform/sunucu ayrımının ve regresyon yaygınlığının saptanması zorlaşır. Hata yoksa uygulamanın normal işlevini bozmaz.
- **Kök neden / çözüm:** Hata modeli UX amaçlı kalmış; gözlemlenebilirlik sözleşmesi yok. Stack'i koruyan güvenli logger/hook ve oran sınırlı, PII'siz telemetri tasarlanmalı. `ServerError.debugMessage` gövde taşıyabildiği (`errors.dart:60–71`) ve `BusinessError` ham mesaj sakladığı (`:88–110`) için mevcut debug metinleri doğrudan uzaktaki sisteme gönderilmemeli.
- **İş paketi:** PLAT-WP08.

## 4. Ayrıntılı geliştirme iş paketleri

S/M/L göreli kapsam ve belirsizlik tahminidir; takvim veya gün taahhüdü değildir. Paketler gelecekteki uygulama çalışması içindir; bu audit sırasında hiçbiri uygulanmadı. Önce WP02/WP03/WP04 ile hedef ve araç zinciri, ardından yayın paketleri ve WP09 kanıtları tamamlanmalı. CI'daki signing/mağaza yayın adımları bu auditin yetkisinde değildir.

### PLAT-WP01 — Android dağıtım imzası ve yükseltme yolu

- **Kapsam / bulgu:** Android signing ve paket kimliği; F01.
- **Bağımlılıklar:** Yayın sahibinin upload key/Play App Signing ve önceki dağıtım kimliği kararı; WP04 araç zinciri. Gerçek anahtarlar rapora/repoya girmez.
- **Yapılacaklar:** Release config'i güvenli girdilere bağla; release'te debug fallback'i kaldır; eksik girdide açıklayıcı hata; sürüm/build-number artış kuralı; artefakt signer ve application ID doğrulaması; mağazaya yüklemeden yerel kurulum/yükseltme kontrolü.
- **Gözlemlenebilir kabul:** Üretilen release paketi onaylı signer ile eşleşir ve debug signer değildir; secret yokken release hazırlığı açıkça durur; aynı paket kimliğinde önceki onaylı sürümden yükseltme oturumu/veriyi belirlenen politikaya göre korur; anahtar değerleri hiçbir loga yazılmaz.
- **Anlamlı testler:** Signing girdisi eksik; yanlış parola; doğru imzalı temiz kurulum; önceki dağıtımdan yükseltme; debug ve release signer ayrımı.
- **Tahmin:** **M** — Gradle değişikliği sınırlı, mevcut dağıtım kimliği ve gerçek paket doğrulaması dış bağımlılık yaratır.

### PLAT-WP02 — Açık environment ve güvenli başlangıç

- **Kapsam / bulgu:** Config, bootstrap ve paketlenen kamuya açık ortam girdisi; F02.
- **Bağımlılıklar:** Test/üretim hedefleri ve flavor/build stratejisi; auth modülüyle oturumun environment'a bağlanması kararı.
- **Yapılacaklar:** Sabit deployment fallback'ini release'ten kaldır; gerekli config'i başlangıçta doğrula; https ve izin verilen hedef kuralını tanımla; kullanıcıya uygun başlangıç hata ekranı; env örneğini değer içermeyen allowlist ile oluştur; asset içine secret girmesini engelleyen kontrol; environment değişiminde eski oturum politikasını belirle.
- **Gözlemlenebilir kabul:** Eksik/bozuk/beklenmeyen hedefte hiçbir login veya token'lı istek çıkmaz; seçilen environment testte deterministiktir; paket envanterinde yalnız izinli kamu config anahtarları vardır; hata ekranı tekrar deneme veya destek yolunu sunar.
- **Anlamlı testler:** Dosya yok/anahtar yok/boş değer/bozuk URI/http URI; doğru iki test ortamının ayrımı; bir ortam token'ının diğerine taşınmaması; hata ekranından güvenli yeniden başlatma.
- **Tahmin:** **M** — Config değişikliği küçük, auth/bootstrap ve paketleme sınırları birlikte ele alınmalı.

### PLAT-WP03 — Native bağımlılık grafiğini uzlaştırma

- **Kapsam / bulgu:** iOS/macOS Podfile/lock, SPM seçimi ve üretilmiş plugin çıktıları; F03.
- **Bağımlılıklar:** WP04 SDK/Xcode/CocoaPods kararı; macOS için WP06 kapsam kararı.
- **Yapılacaklar:** CocoaPods/SPM entegrasyonunu açıkça seç; temiz ortamda izinli hazırlıkla plugin graph'ını üret; Apple lock'larını güncelle; gerekli privacy resource bundle'larının son pakette varlığını kontrol et; eski kopya metadata ve izlenen generated/symlink artıklarını ayıkla; graph değişikliğini review edilebilir kıl.
- **Gözlemlenebilir kabul:** Temiz checkout'ta native restore/build tamamlanır; ikinci restore beklenmeyen lock farkı üretmez; scanner/preferences/izin plugin'leri güncel graph'ta bulunur; kullanılmayan eski plugin'ler nihai pakete taşınmaz; iOS native başlatma ve scanner kaydı smoke testinde başarılıdır.
- **Anlamlı testler:** Pod cache bulunmayan makine; kilit korunarak restore; plugin ekleme/çıkarma sonrası graph farkı; iOS simülatör smoke ve gerçek cihaz kamera; macOS yalnız destekleniyorsa.
- **Tahmin:** **M** — Graph uzlaştırması bilinen iş, native araç ve signing ortamı doğrulaması gerekir. Paket sürümleri sırf güncel olsun diye topluca yükseltilmez.

### PLAT-WP04 — Araç zinciri, CI ve yayın kanıtı sözleşmesi

- **Kapsam / bulgu:** SDK pin, README gereksinimleri, repo CI, platform build doğrulaması; F04.
- **Bağımlılıklar:** CI sağlayıcısı/runner erişimi, WP02 config örneği, WP03 native graph; imzalı aşama için WP01 ve iOS yayın sahibi.
- **Yapılacaklar:** Flutter/Dart pin'i ve JDK/Xcode/CocoaPods sürüm beklentisini belge/otomasyonda eşleştir; lock restore politikasını tanımla; mobil dosya değişikliklerinde analiz ve test; Android/iOS compile smoke işleri; eşzamanlı Flutter süreçlerini izole runner/SDK ile yönet; release artefaktına commit/build/environment kimliği ve doğrulama sonucu ekle. Unsigned compile ile dağıtıma uygun imzalı paketi ayrı sonuçlar olarak kaydet.
- **Gözlemlenebilir kabul:** Boş runner üzerinde aynı girdi aynı dependency graph'ını üretir; PR'da bilerek eklenen Dart hata/test kırılması kapıyı durdurur; native manifest/Gradle hatası platform job'ında görülür; mobile kapsamı tetiklenir; cache anahtarı SDK ve lock değişimini içerir; hiçbir job config veya signing secret'ını çıktılamaz. Organizasyonun merge koşulları ayrıca doğrulanır.
- **Anlamlı testler:** Sıfır cache; eski cache; yalnız `mobile/` değişikliği; lock değişikliği; SDK pin değişikliği; başarısız analyze/test/native compile; manuel onay olmadan yayın adımının tetiklenmemesi.
- **Tahmin:** **L** — Çoklu işletim sistemi runner'ı ve yayın kimliği entegrasyonu gerekir; yalnız YAML eklemek yeterli değildir.

### PLAT-WP05 — İzin envanteri ve en az erişim

- **Kapsam / bulgu:** Android/iOS izin beyanları, kullanılmayan permission dependency'si ve cihaz hedefi; F05.
- **Bağımlılıklar:** Gerçek yayımlanacak dosya/galeri özellikleri; QR modülü izin UX'i; desteklenen Android alt sınırı.
- **Yapılacaklar:** Kullanılmayan storage/galeri beyanlarını kaldır; permission handler ihtiyacını değerlendir; kamera izin verilmedi/kalıcı reddedildi/ayar dönüşü akışını ürünleştir; kamerasız cihazlarda QR gösterme desteği kararını ver; merged manifest ve final Info.plist envanterini kaydet.
- **Gözlemlenebilir kabul:** Nihai pakette gereksiz storage beyanı yok; QR gösterme kullanıcıdan galeri/storage istemez; kamera reddedildiğinde uygulama kullanılabilir kalır ve açık toparlanma yolu sunar; iOS kamera gerekçesi doğru dilde görüntülenir; mevcut scanner davranışı bozulmaz.
- **Anlamlı testler:** İlk izin verme; ilk reddetme; kalıcı reddetme ve ayarlardan geri verme; kamera bulunmaması; kamera kullanılırken arka plana geçme; desteklenen alt Android/iOS sürümü.
- **Tahmin:** **M** — Manifest temizliği küçük, izinlerin gerçek cihaz lifecycle davranışı doğrulama gerektirir.

### PLAT-WP06 — Platform destek kararı ve native kabiliyetler

- **Kapsam / bulgu:** Öncelikle macOS network/kamera; web/Windows/Linux destek sınırı ve platforma göre özellik sunumu; F06.
- **Bağımlılıklar:** Ürün sahibinin destek matrisi; destek varsa WP03 ve WP04.
- **Yapılacaklar:** Mobil dışı hedefleri desteklenen/deneysel/desteksiz olarak açıkla; macOS desteklenecekse outgoing client ve kamera kabiliyetleri/açıklamasını tamamla; platforma göre scanner alternatifi veya erişilebilir devre dışı durum tasarla; web manifest ve desktop ürün metadata'sını yalnız destek verilen hedeflerde düzenle.
- **Gözlemlenebilir kabul:** Destek tablosu README ve UI ile uyumlu; desteklenmeyen native API çağrısı tetiklenmez. macOS desteklenirse imzalı sandbox release'te giriş, geçmiş, ilk kamera izni ve yeniden açılış başarılı; desteklenmeyecekse runner varlığı ürün taahhüdü gibi sunulmaz.
- **Anlamlı testler:** macOS debug/release ağ erişimi; kamera reddi; Windows/Linux'ta QR ekranı güvenli davranışı; destekleniyorsa web HTTPS kamera ve refresh/deep-link; her hedefte ilk kurulum smoke.
- **Tahmin:** **S** (yalnız destek sınırını belgeleme) / **L** (masaüstü/web'i ürünleştirme) — Karar kapsamı büyük ölçüde değiştirir.

### PLAT-WP07 — Çalıştırılabilir kurulum ve dürüst capability belgesi

- **Kapsam / bulgu:** `mobile/README.md`, örnek config ve release/test kılavuzu; F07, F02/F04 ile bağlantılı.
- **Bağımlılıklar:** WP02 config sözleşmesi, WP04 araç zinciri, diğer modüllerin kabul edilmiş gerçek özellik listesi.
- **Yapılacaklar:** Gerçek repo/mobile dizinini ve mevcut dosyaları kullanan kurulum; yönetici tarafından açılan çalışan hesabı; placeholder visitor/reset/kayıt ayrımı; gerçek iki QR yolunu anlatma; testin mock sınırı; destek tablosu; imza ve mağaza öncesi doğrulama bağlantıları. Kamera/dil/admin paneli gibi eski gelecek listelerini mevcut duruma göre düzelt.
- **Gözlemlenebilir kabul:** Yeni geliştirici yalnız belge ve değersiz örnek config ile temiz ortam hazırlığını tamamlayabilir; var olmayan dosya/route önerilmez; her özellik implemented/kısmi/planlanan ayrımına sahip; env asset gizli kasa gibi tarif edilmez; belge hiçbir secret içermez.
- **Anlamlı testler:** Ayrı temiz checkout'ta adım adım belge walkthrough; mevcut route/endpoint ve asset dosyalarıyla çapraz kontrol; ziyaretçi ve reset beklentisi kabul oturumunda doğru anlaşılır.
- **Tahmin:** **S** — Metin düzeltmesi sınırlı; doğruluğu ürün/modül sonuçlarına bağlı.

### PLAT-WP08 — PII'siz hata teşhisi ve release gözlemlenebilirliği

- **Kapsam / bulgu:** Error modeli, global hata hook'ları ve işlem metriği; F08.
- **Bağımlılıklar:** Saklama/onay/erişim politikası ve kullanılacak servis veya yerel destek dışa aktarma kararı; WP02 environment/build kimliği.
- **Yapılacaklar:** Stack'i koru; Flutter framework, platform async ve beklenen repository hatalarını ayrı işle; endpoint sınıfı, süre, deneme sayısı, platform/build ve hata kategorisini allowlist ile kaydet; token/QR içeriği/email/ham response body'yi redakte et; aynı hatada rate limit; servis arızasının UI'yi bozmamasını sağla; release sembol/dSYM saklama stratejisi belirle.
- **Gözlemlenebilir kabul:** Kontrollü release hata olayının stack ve build kimliği erişilebilir; bilinçli test token/QR/email işaretleri hiçbir kayıtta görünmez; sessiz yenileme hatası kullanıcı spam'i olmadan ölçülebilir; merkezi servis kapalıyken giriş ve QR akışı işlevini sürdürür.
- **Anlamlı testler:** Framework ve async istisna; 401/timeout/5xx; bozuk body; polling hata fırtınası; telemetry bağlantısı kesik; PII redaksiyon assertion'ları; simgelenmiş kontrollü release crash.
- **Tahmin:** **M** — Teknik entegrasyon yanında veri minimizasyonu ve native sembol doğrulaması gerekir.

### PLAT-WP09 — Risk odaklı sözleşme, widget ve cihaz/E2E doğrulaması

- **Kapsam:** Mevcut 44 testin dışındaki kritik birleşimler; ayrı fonksiyonel hata bulgusu değildir.
- **Bağımlılıklar:** Auth/QR/geçmiş modüllerinin kabul kriterleri, WP02 test hedefi, WP03/04 native hazırlık, test çalışanı/cihazı ve izole backend. Gerçek üretim verisine yazılmaz.
- **Yapılacaklar:** HTTP request envelope ve error/retry testleri; soğuk açılış/expiry/router testleri; geçerli cihaz QR'ı ve çalışan QR token yenileme testleri; quick unlock ve denied sonucu; sayfalama/filtre/istatistik sınırları; eski asenkron yanıtın kullanıcı değişiminde uygulanmaması; TR/EN, küçük ekran/klavye/büyük yazı; gerçek kamera ve imzalı paket E2E'leri. Boş native örnek testleri başarı kanıtı gibi sayma.
- **Gözlemlenebilir kabul:** İşlem sonrası backend kaydı ve UI yenilemesi izole ortamda gözlenir; reddedilen işlem başarı UI'sı üretmez; timeout sonrasında mutation kör tekrar edilmez; logout/hesap değişiminde eski kişinin verisi görünmez; cihaz kanıtı platform/OS/paket/build/environment ile ilişkilidir. Fiziksel kapı açma ile yalnız kayıt/granted cevabı ayrı doğrulanır.
- **Anlamlı testler:** Alttaki matris; ayrıca çevrimdışı bootstrap, istek sürerken logout, iki kez QR okuma, mutation işlendiği halde yanıt kaybı ve gün değişimi.
- **Tahmin:** **L** — Kamera/cihaz/backend/kapı ve release paketi birlikte gerekir; salt mock test eklemek hedefi karşılamaz.

### PLAT-WP10 — İlk açılışta font ve asset determinismi

- **Kapsam:** Düşük öncelikli dayanıklılık iyileştirmesi; ayrı bug olarak sayılmadı. `app_theme.dart:31–45,85–99` GoogleFonts kullanıyor; `pubspec.yaml:66–68` altında font dosyası yok. Paket [8.1.0 belgesi](https://pub.dev/packages/google_fonts/versions/8.1.0) HTTP indirme/cache ve asset bundle desteğini açıklıyor. Ağ kesildiğinde mevcut paketin kesin crash yaşadığı iddia edilmiyor.
- **Bağımlılıklar:** Tasarımda gereken font ağırlıkları ve lisans/asset boyutu kararı.
- **Yapılacaklar:** Gerekli Poppins ağırlıklarını paketle, runtime font indirmesini kapat veya açık fallback politikası belirle; font lisansını dahil et; TR karakterlerini doğrula.
- **Gözlemlenebilir kabul:** Boş font cache'i ve kesik font ağıyla ilk açılışta onaylanan tipografi/fallback kararlı; gizli bir harici font isteği yapılmaz; gereksiz ağırlıklar paket boyutunu büyütmez.
- **Anlamlı testler:** Yeni kurulum + çevrimdışı font erişimi; TR/EN karakterler; light/dark tema; büyük yazı ve farklı ağırlıklar.
- **Tahmin:** **S** — Asset ve tema değişimi sınırlı; gerçek ilk kurulum görünümü kontrol edilmeli.

## 5. Manuel cihaz / E2E doğrulama matrisi

**Aşağıdaki satırların hiçbiri bu worker tarafından çalıştırılmadı.** Hepsi planlanan doğrulamadır. Test kayıtları en az paket hash/build numarası, environment etiketi, OS/cihaz, önkoşul, beklenen-gerçek sonuç ve temizlenmiş kanıt içermeli. Kullanıcı/çalışan/cihaz kimlikleri rapora veya loga gerçek değerleriyle konulmamalı. Veri mutasyonu gerektiren testler yalnız ayrıca yetkilendirilmiş izole test backend'inde yapılmalı.

| ID | Platform / önkoşul | Senaryo | Gözlenebilir kabul |
|---|---|---|---|
| PQ-M01 | Temiz CI/yerel checkout | Pin'li SDK ve boş cache ile hazırlık | Dependency/native graph beklenen; ikinci restore beklenmeyen fark üretmiyor |
| PQ-M02 | Android release AAB/APK | Signer ve paket kimliği | Onaylı upload kimliği; debug signer yok; sürüm/build numarası doğru |
| PQ-M03 | Android mevcut onaylı sürüm | Yerinde yükseltme | İmza uyumlu yükseltme; hesap/veri politikası korunuyor |
| PQ-M04 | iOS gerçek cihaz + yetkili imza | Archive/export ve temiz kurulum | Doğru bundle/version/environment; plugin'ler açılışta kayıtlı; kurulum başarılı |
| PQ-M05 | Android/iOS temiz kurulum | Env eksik/boş/bozuk | Kullanıcı bilgisi taşıyan istek çıkmadan açık config hatası |
| PQ-M06 | Android/iOS test hesabı | Soğuk giriş ve yeniden açma | Doğru çalışan; gerçek oturum kalıcılığı; server-side me sonucu ile tutarlı UI |
| PQ-M07 | Android/iOS | Soğuk açılışta uçak modu, sonra ağ dönüşü | Yanıltıcı veri yok; oturum/tekrar deneme davranışı belirlenen politikayla uyumlu |
| PQ-M08 | Android/iOS | İlk kamera izni ver/reddet/kalıcı red | Kamera veya açıklayıcı toparlanma; diğer sekmeler kullanılabilir |
| PQ-M09 | Android/iOS | Ayarlardan izni kaldır/geri ver | Geri dönüşte doğru izin durumu; takılma/siyah ekran yok |
| PQ-M10 | Android/iOS fiziksel kamera | Geçerli cihaz QR'ı, tekrar okuma ve bozuk QR | Bir kullanıcı işlemi için beklenen mutation sayısı; yanlış başarı yok; anlaşılır hata |
| PQ-M11 | Android/iOS + test backend | Yetkili / yetkisiz cihazla self-check-in | Backend kararı, kayıt ve UI eşleşir; fiziksel kapı etkisi ayrıca ölçülür |
| PQ-M12 | Gerçek okuyucu + test backend | Çalışan QR token'ı süresi içinde/sonrasında tüketme | Süre/replay kuralı backend'de uygulanır; QR yenileme doğru token verir |
| PQ-M13 | Android/iOS | Scanner veya token ekranındayken sekme değiştir/arka plana al/dön | Kamera göstergesi ve kaynaklar beklenen lifecycle'da; yinelenen istek/çökme yok |
| PQ-M14 | Ağ hata enjeksiyonu | Timeout/5xx/401/403/bozuk yanıt | Query retry sınırı; mutation otomatik tekrar yok; oturum UX'i sözleşmeyle uyumlu |
| PQ-M15 | Gecikmeli sorgu + iki test hesabı | İstek sürerken logout ve diğer hesapla giriş | Eski hesabın kaydı/avatarı/tercihi yeni kişiye uygulanmıyor |
| PQ-M16 | Android/iOS | `ngsplus` linkleri soğuk/sıcak, auth var/yok, bilinmeyen rota | Yetkisiz ekrana geçiş yok; doğru yönlendirme veya güvenli hata. Custom scheme varlığı tek başına app-link doğrulaması değildir. |
| PQ-M17 | Android küçük telefon / iPhone / iPad | TR/EN, büyük yazı, ekran okuyucu, klavye, izinli yönelim | Ekranlar kullanılabilir; düğme/mesajlar erişilebilir; taşma yok |
| PQ-M18 | Yeni kurulum, font cache boş | Font ağı erişimsiz açılış | Onaylanmış fallback/yerel font; başlangıç hatası veya belirsiz görünüm yok |
| PQ-M19 | Release hata enjeksiyonu | Crash, sorgu ve sessiz yenileme hatası | WP08 uyarınca simgelenmiş, PII'siz ve build'e bağlı teşhis kaydı |
| PQ-M20 | macOS yalnız destek kararı varsa | Sandbox release giriş/geçmiş/kamera | Ağ ve kamera kabiliyetleri gerçek pakette çalışıyor |
| PQ-M21 | Web/Windows/Linux yalnız destek kararı varsa | QR sekmesi ve native API sınırı | Platforma uygun scanner/alternatif; destek dışı özellik güvenli açıklanıyor |
| PQ-M22 | Android/iOS son dağıtım paketi | Merged izin/ATS/cleartext/privacy asset envanteri | Gerekçesiz izin yok; TLS bypass yok; dependency privacy kaynakları pakette doğrulanmış |

## 6. Açık sorular ve yayın kararı için eksik kanıtlar

1. Resmî hedef yalnız Android/iOS mu; iPad, web ve masaüstü hangi destek seviyesinde? macOS'un P2 olarak ele alınması bu belirsizliğe dayanıyor.
2. Mevcut Android/iOS mağaza kayıtları ve daha önce dağıtılmış imzalar/build numaraları var mı? Koddan önceki imza, key ownership veya kullanılabilir signing profili kanıtlanamaz.
3. Harici CI ve branch protection var mı? Repo envanterindeki yokluk yalnız sürüm kontrollü CI kanıtının eksikliğidir.
4. Hangi Flutter/JDK/Xcode/CocoaPods seti resmen desteklenecek; SPM mi CocoaPods mu kullanılacak? Güncel kurulu SDK'nın test geçmesi, bütün native hedeflerin uyumu değildir.
5. Environment seçimi, test/üretim ayrımı ve hedef değişince oturum temizleme politikası nedir? Sabit fallback adresinin amacı koddan belli değil.
6. Çalışan hesabı ve mobil şifre kurulumu için yönetici akışı nerede belgeleniyor? README'nin kayıt/reset vaadi buna göre düzeltilmeli.
7. QR tarama ve telefonda QR gösterme için desteklenen fiziksel okuyucu/kapı modelleri hangileri? `granted` cevabı ile kapının fiziksel açılması aynı kanıt değildir.
8. Kamera gerekmeyen cihazlara QR gösterme/quick unlock desteklenecek mi? Android kamera `required=true` bilinçli bir dağıtım filtresi mi?
9. Telemetry için veri minimizasyonu, saklama, erişim ve kullanıcı bilgilendirme politikası nedir? Yeni servis seçimi bu auditin parçası olarak yapılmadı.
10. Privacy manifest, App Store privacy/Data Safety formları, şifreleme beyanı (`ios/Runner/Info.plist:40–41`) ve bağımlılıkların topladığı veriler için son paket üzerinden kimin doğrulaması gerekecek? Uygulamada özel manifest görünmemesi tek başına mağaza ihlali değildir; plugin'ler kaynak sağlayabilir. Mağaza formları veya nihai paket görülmediğinden yayın uygunluğu onaylanmıyor.

Bu rapordaki geliştirme paketleri ve matris, kod/ürün kabulü için gözlenebilir hedefleri tanımlar. Audit sırasında gerçek hesap, kamera, kapı, üretim verisi veya yayın sistemi üzerinde işlem yapılmadı.
