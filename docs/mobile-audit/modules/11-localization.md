# 11 — Yerelleştirme ve kullanıcı metinleri

Tarih: 19 Ekim 2026. İnceleme mevcut çalışma ağacındaki kaynaklara dayanır; yalnız HEAD'e dayanmaz. **7 bulgu: P0 0, P1 0, P2 4, P3 3.** Yerelleştirme temeli mevcut ve TR/EN katalogları eşleşiyor; dil tercihi, hata yolları ve bazı kullanıcı metinleri tamamlanmamış.

Bu çalışma salt okunur kaynak auditidir. Yalnız bu rapor yazıldı; uygulama, backend, platform ve test kodu değiştirilmedi; formatlama, Flutter komutu, paket indirme, build, deploy, commit veya push yapılmadı. Canlı backend, cihaz, kamera ve fiziksel kapı denenmedi. Kesinlik alanındaki **kaynak analizi**, kod zincirinin gözlendiğini, davranışın cihazda çalıştırılmadığını belirtir. **Doğrulandı**, dosyalar üzerinde yapılan doğrudan karşılaştırmayı belirtir.

## İncelenen dosyalar ve yöntem

Hedef dizinlerdeki bütün dosyalar metin ve kullanım taramasına alındı: `mobile/lib/l10n/` altında 5 dosya, `mobile/lib/screens/` altında 10 ekran/shell dosyası ve `mobile/lib/widgets/` altında 6 dosya. String literal, `Text`, form doğrulaması, snackbar/dialog, `l10n.*`, locale, tarih/saat/sayı formatı, hata üreticisi ve hata tüketicisi birlikte izlendi.

| Alan | İncelenen dosyalar |
| --- | --- |
| Katalog ve üretim | `mobile/l10n.yaml`; `mobile/lib/l10n/app_tr.arb`, `app_en.arb`, `app_localizations.dart`, `app_localizations_tr.dart`, `app_localizations_en.dart`; `mobile/pubspec.yaml`, `mobile/.gitignore` |
| Uygulama bağlama ve gezinme | `mobile/lib/main.dart`, `mobile/lib/router/app_router.dart`, `mobile/lib/screens/main_navigation_shell.dart`, `mobile/lib/screens/splash_screen.dart` |
| Tüm ekranlar | `screens/auth/login_screen.dart`, `screens/auth/forgot_password_screen.dart`, `screens/home/home_screen.dart`, `screens/history/history_screen.dart`, `screens/profile/profile_screen.dart`, `screens/qr_scan/qr_scan_screen.dart`, `screens/settings/select_device_screen.dart`, `screens/visitor/visitor_screen.dart` (tümü `mobile/lib/` altında) |
| Paylaşılan metin sunumu | `mobile/lib/widgets/cards/attendance_status_card.dart`, `progress_hero_card.dart`, `quick_action_card.dart`, `section_header.dart`, `stat_card.dart`; `mobile/lib/widgets/responsive_container.dart` |
| Veri ve hata zinciri | `mobile/lib/core/error_localizer.dart`, `errors.dart`; `mobile/lib/models/attendance.dart`, `device.dart`, `qr_code_model.dart`; `mobile/lib/providers/auth_provider.dart`, `attendance_provider.dart`, `theme_provider.dart`, `preferred_device_provider.dart`; `mobile/lib/repositories/auth_repository.dart`, `attendance_repository.dart`, `device_repository.dart`; `mobile/lib/config/convex_config.dart` |
| Backend bağlamı | Önce `convex/_generated/ai/guidelines.md` tamamı; ardından `convex/employeeAuth.ts` giriş, `convex/employeeCheckIn.ts` token üretimi, `convex/cardReadings.ts` mobil liste/self-check-in, `convex/devices.ts` çalışan cihaz listesi, `convex/lib/employeeAuth.ts`, `convex/lib/cardReadingAudit.ts` ilgili yollar |
| Doğrulama bağlamı | `mobile/test/widgets/login_screen_test.dart`; test dizininin locale/l10n kullanım taraması; `mobile/README.md`; `docs/mobile-audit/evidence/baseline.md` |

Backend dosyalarının yukarıda adlandırılan yolları incelendi; bütün backend için güvenlik veya işlev doğrulaması iddia edilmiyor. `.env`, anahtar/token değerleri ve kişisel veri okunmadı veya rapora taşınmadı. Kullanıcı/cihaz adları iş verisidir; bunların Türkçe olması tek başına çeviri hatası sayılmadı.

### Mevcut gerçek akış ve capability tablosu

“Çalışıyor” bu tabloda kaynakta uygulanmış yolu ifade eder; cihaz/E2E testi anlamına gelmez.

| Akış / capability | Durum | Gerçek davranış ve kanıt |
| --- | --- | --- |
| TR/EN mesaj kataloğu | Çalışıyor | İki ARB'de de **229 mesaj** var; eksik anahtar, boş mesaj veya placeholder metaverisi farkı yok. Her dilin generated sınıfında aynı 229 üye var. `mobile/l10n.yaml:1–5`; `app_localizations.dart:87–99` |
| Generated kaynak yönetimi | Çalışıyor / süreç kanıtlanamadı | ARB ve üç generated Dart dosyası Git'te izleniyor; `pubspec.yaml:63` üretimi açıyor, uygulama generated dosyayı doğrudan import ediyor (`main.dart:6`). 229 TR ve 228 EN çıktısı salt okunur karşılaştırmada ARB ile eşleşti; ayraç içeren EN `qrTokenHint` ayrıca gözle karşılaştırıldı (`app_localizations_en.dart:596–597`). Üretim komutu çalıştırılmadı; otomatik drift kapısı kanıtlanamadı. |
| Sistem dilinden uygulama dili | Kısmi | Desteklenen `en`, `tr` ve Material/Cupertino/Widgets delegeleri bağlı (`main.dart:95–96`, `app_localizations.dart:87–99`). Uygulama `locale` veya özel çözümleme callback'i vermiyor. Gerçek işletim sistemi dil listesi/fallback davranışı cihazda doğrulanmadı. |
| Kullanıcı dil tercihi / kalıcılık | Placeholder | Profil mevcut dili okuyor; Dil satırı yalnız “yakında” dialog'u açıyor (`profile_screen.dart:139–178,358–372`). Dil seçen state/persistence ve `MaterialApp.locale` bağlantısı bulunmuyor. |
| Splash, giriş ve ana gezinme metinleri | Çalışıyor | Splash adı/sloganı, giriş alanları/validasyonları ve sekmeler l10n'den geliyor (`splash_screen.dart:127–138`, `login_screen.dart:149–193`, `main_navigation_shell.dart:49–79`). Giriş gerçek `employeeAuth:signIn` yoluna bağlı (`auth_repository.dart:63–65`); demo giriş olarak değerlendirilmedi. |
| Şifre sıfırlama | Placeholder / metinle çelişiyor | Form ve başarı görünümü çevrilmiş, fakat provider her çağrıda yöneticiye yönlendiren Türkçe metinle `false` döndürüyor; e-posta servisi çağrısı yok (`auth_provider.dart:106–110`). Başarı ekranı bugünkü provider ile ulaşılamayan dal. |
| Ana sayfa ve attendance kartı | Çalışıyor / kısmi | Selam, günün sözü, durum ve aksiyon etiketleri TR/EN; tarih locale ile üretiliyor (`home_screen.dart:75–83,263–278`, `attendance_status_card.dart:28–58`). Saat formatı sabit `HH:mm`; tek hareket EN çoğulu yanlış. |
| Geçmiş liste/takvim/istatistik/filtre | Kısmi | Gerçek çalışanın okumaları yükleniyor; metinler l10n, takvim/ay/hafta günü locale alıyor (`history_screen.dart:148–160,279,336–351,1190–1222`). Sayısal tarihler ve saatler sabit biçimli; cihazsız kayıtta model Türkçe fallback ekliyor. |
| QR Kodum / tarama | Kısmi | Gerçek token üretim mutation'ı çağrılıyor (`qr_scan_screen.dart:53–55`; `employeeCheckIn.ts:10–27`), bu statik demo QR değildir. Bazı hatalar çevrilmiyor; kullanıcı QR bilgi görünümü yalnız payload gösterir (`qr_scan_screen.dart:506–515`), bu dal attendance kaydı oluşturmaz. Tarama sonrası kayıt yolu `cardReadings:selfCheckIn`'e gider; fiziksel cihazın açılması doğrulanmadı. |
| Kapı seçimi / hızlı aksiyon | Kısmi | Liste gerçek çalışan yetkileriyle backend'den gelir (`device_repository.dart:10–12`, `devices.ts:91–145`), seçim yerel provider'a yazılır. Etiketler çevrilir; yükleme hatası doğrudan `error.toString()` gösterilir (`select_device_screen.dart:42–45,109`). Hızlı aksiyonun “Kapıyı Aç” metninin fiziksel karşılığı ayrı E2E sorusudur. |
| Profil yardım/güvenlik/bildirim/gizlilik | Placeholder | Çevrilmiş “yakında” dialog'ları var (`profile_screen.dart:258–306,375–450`). Tema seçimi gerçek state değiştirir (`309–343`); bütün profil seçenekleri sahte olarak sınıflanmadı. Sürüm metni gerçek paket sürümünden kopuk. |
| Ziyaretçi | Placeholder | Router gerçek ekranı açıyor (`app_router.dart:108–113`); ekran yalnız başlık + Türkçe “yakında” açıklaması içeriyor (`visitor_screen.dart:14–49`). ARB'deki ekle/giriş/çıkış/başarı mesajları çalışan uçtan uca ziyaretçi özelliğine kanıt değildir. |
| Pluralization ve sayı | Kısmi | Sayı placeholder'ları tipli; iki ARB'de ICU plural kullanılmıyor. Görünür EN tekil hataları var. `ProgressHeroCard` yüzdeyi `toStringAsFixed` ile üretir (`progress_hero_card.dart:52–75`), ancak `mobile/lib` içinde çağıranı yok: bunun virgül/nokta farkı mevcut ekran bug'u sayılmadı. |

## İyi çalışan temeller

- Türkçe template ve tek `AppLocalizations` yüzeyi kullanılıyor; TR/EN katalog, placeholder isim/tipleri ve generated API yüzeyi eşleşiyor. İncelenen kaynaklarda generated çeviri drift'i saptanmadı.
- `main.dart:95–96` yalnız uygulama metinlerini değil, Flutter'ın Material/Cupertino/Widgets çevirilerini de bağlıyor (`app_localizations.dart:87–93`). Tarih seçici `history_screen.dart:1302–1307` bağlamı miras alabilecek şekilde açılıyor.
- Ana sayfa tarihi, takvim ve uzun tarih/hafta günü görünümleri açıkça `Localizations.localeOf(context)` kullanıyor (`home_screen.dart:81–82`, `history_screen.dart:279,336,351,1191,1220,1394,1420–1424`). Attendance zamanı modelde `.toLocal()` ile çevriliyor (`models/attendance.dart:55`); bütün tarihlerin UTC gösterildiği iddia edilemez.
- Hata türleri veri katmanında ayrılmış, UI'da çeviri için `localizeAppError` mevcut. Login ve ana history hata durumu bunu kullanıyor (`login_screen.dart:78–84`, `history_screen.dart:148–152`). Ağ/timeout/server/oturum/unknown çevirileri hazır (`error_localizer.dart:15–21`).
- Gerçek giriş backend'i olmayan/aktif olmayan/şifresi kurulmamış kullanıcıları aynı kimlik bilgisi hatasında birleştiriyor (`convex/employeeAuth.ts:156–173`). ARB'de daha ayrıntılı mesajların bulunması bunların girişte gösterilmesi gerektiği anlamına gelmez; bu gizlilik davranışı korunmalı.

## Kanıtlı bulgular

### L10N-F01 — Profil dil tercihi uygulanmamış

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** `mobile/lib/screens/profile/profile_screen.dart:141` mevcut locale'i okur; `:173–178` Dil satırını `_showLanguageDialog`'a bağlar; `:358–372` yalnız metin ve Tamam düğmesi oluşturur. `mobile/lib/l10n/app_tr.arb:145–146` dil ayarını “yakında” diye tanımlar. `mobile/lib/main.dart:87–97` tema state'ini dinler, locale tercihi vermez. Provider/persistence taramasında dil state'i bulunmadı.
- **Tetikleyici:** Kullanıcı uygulama içinden TR ↔ EN değiştirmek için Profil → Dil'e basar.
- **Beklenen / mevcut:** İşlem seçilebilir dil ve kalıcı tercih sağlamalı ya da açıkça yalnız sistem dilini kullandığını belirtmeli; mevcut durumda ayar gibi görünen satır yalnız placeholder açar, dil değişmez.
- **Etki:** Cihaz dili ile işte kullanmak istediği dil farklı olan kullanıcı tercihini uygulayamaz; EN desteği uygulama içinden erişilebilir bir tercih değildir.
- **Kök neden ve çözüm:** Locale state/persistence ve kök uygulama bağlantısı eksik. Sistem/TR/EN seçenekli locale provider, başlatmada tercihi okuma ve `MaterialApp.locale` bağlantısı eklenmeli; desteklenmeyen tercih güvenli biçimde sistem seçeneğine dönmeli. Varsayılan/fallback ürün kararı ayrıca kayda alınmalı.

### L10N-F02 — Şifre sıfırlama metni mevcut capability'yi yanlış anlatıyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri:** `mobile/lib/l10n/app_tr.arb:36–37` ve `app_en.arb:36–37` bağlantı gönderme sözü verir; `forgot_password_screen.dart:110–111,143–157` bunu kullanıcıya gösterir. `:35` provider'ı çağırır. `mobile/lib/providers/auth_provider.dart:106–110` e-postayı kullanmadan Türkçe yönetici metni koyar ve her zaman `false` döner. Ekran `forgot_password_screen.dart:41–44` boş `lastError` durumunda bu ham Türkçe metni alır. Çevrilmiş `passwordResetAdminInfo` zaten vardır (`app_en.arb:335`), kullanılmıyor. Önceki başarısız girişten kalan `lastError` bu metnin önüne de geçebilir; reset metodu onu temizlemiyor.
- **Tetikleyici:** Temiz hata state'iyle EN veya TR şifre sıfırlama formuna geçip geçerli e-posta ile gönderme.
- **Beklenen / mevcut:** Kullanıcı doğru destek sürecini baştan, seçili dilde öğrenmeli; mevcut form gönderim vaat eder fakat gönderim yapmaz, EN'de Türkçe cevap çıkar. `:37–39,176–220` başarı görünümü bu provider ile ulaşılamaz.
- **Etki:** Kullanıcı boşuna e-posta bekler ve destek sürecine geç ulaşır; EN kullanıcıya süreç açıklaması çevrilmez.
- **Kök neden ve çözüm:** Eski reset UI/ARB mesajları, yönetici kurulumuna geçilen provider ile uyarlanmamış. Bugünkü capability için yönetici yönlendirmeli çevrilmiş bilgi görünümü ve doğru CTA kullanılmalı; gerçek reset istenirse backend/e-posta akışı ayrı ürün işi olarak tasarlanmalı. Yanlışlıkla “gönderildi” sonucu üretmek çözüm değildir.

### L10N-F03 — Bazı hata yolları çevrilebilir domain hatası yerine ham metin gösteriyor

**P2 · Kesinlik: kaynak analizi.**

| Tetikleyici | Üretici → taşıma → kullanıcıya gösterim kanıtı |
| --- | --- |
| EN'de ilk QR token yüklenirken ağ/timeout hatası | `convex_config.dart:287–292` → Türkçe `AppError.userMessage` (`core/errors.dart:41–54`) → `qr_scan_screen.dart:78–83` → `:391–399`. Aynı ekranda import edilen `localizeAppError` bu dalda kullanılmıyor. |
| EN'de kapı listesi yükleme hatası | `device_repository.dart:10–12` → `select_device_screen.dart:42–45` `error.toString()` → `:109`. `AppError.toString()` kullanıcı metni yerine debug metni döndürür (`core/errors.dart:17–18,55–57`); örneğin `TimeoutError: HTTP request timed out`. |
| Geçersiz/süresi dolmuş cihaz QR'ı | `models/qr_code_model.dart:85–86,101–103` Türkçe hata üretir → `qr_scan_screen.dart:490–491,520–522` → `:573` doğrudan içerik. |
| İlk self-check-in reddi | Backend `cardReadings:selfCheckIn` `{granted:false}` döner (`convex/cardReadings.ts:1449`); repo `attendance_repository.dart:32–37` bunu bool'a indirger → provider `attendance_provider.dart:329–330` Türkçe metin koyar → `qr_scan_screen.dart:532–535` `lastError` yokken ham metni gösterir. `accessDenied` ARB anahtarı kullanılmaz. |
| Backend'de cihaz bulunamaması | `convex/cardReadings.ts:1399–1400` → `convex_config.dart:325–331` `BusinessError` → `error_localizer.dart:25–35` yalnız üç metni eşler, bu metni ham döndürür → `attendance_provider.dart:338–340` → `qr_scan_screen.dart:532–535`. |

- **Beklenen / mevcut:** Seçili dilde, kullanıcıya yönelik ve anlamlı mesaj beklenir; bazı dallarda Türkçe, debug sınıf adı veya backend'in ham mesajı gösterilir. Login'deki bilinen kimlik bilgisi hatası bu bulgunun dışında başarılı şekilde çevrilir.
- **Etki:** EN akışında hata anında dil tutarsızlığı; kapı seçimi ekranında teknik terimlerle toparlanma güçlüğü. Kaynakta ham response metni taşıyan `BusinessError` üreticileri de vardır (`convex_config.dart:303–317`, `auth_repository.dart:99–107`); belirli bir hassas verinin üretimde sızdığı doğrulanmadı.
- **Kök neden ve çözüm:** Tipli hata ile erken çevrilmiş string iki ayrı kanal olarak yaşıyor; backend business eşlemesi metin parçalarına bağlı. Domain hata kodu ve güvenli parametreleri tutulmalı, bütün UI sınırları gösterim anında locale ile çevirmeli; bilinmeyen hata güvenli genel mesaja dönmeli. Backend kod sözleşmesi aşamalı kurulmalı; auth mesajlarının hesap varlığını gizleme davranışı korunmalı. `lastError` yeni işlem başlangıcında doğru sıfırlanmalı.

### L10N-F04 — Ziyaretçi placeholder'ı ve eksik cihaz fallback'i EN'de Türkçe kalıyor

**P2 · Kesinlik: kaynak analizi.**

- **Kanıt zinciri A:** `mobile/lib/screens/visitor/visitor_screen.dart:17` başlığı çevirir, fakat `:32–44` gövdeyi sabit Türkçe yazar. Bu ekran `router/app_router.dart:108–113` ile erişilebilirdir.
- **Kanıt zinciri B:** Mobil backend zenginleştirmesi cihaz bulunamadığında `device:null` üretir (`convex/lib/cardReadingAudit.ts:133–145`; çağıran `convex/cardReadings.ts:1370`). `mobile/lib/models/attendance.dart:29,38–47` bu kayda boş olmayan “Bilinmeyen Cihaz” verir. `history_screen.dart:1058` boşluk kontrolü yaptığı için `l10n.historyUnknownDevice`'a ulaşamaz; `:1128–1129` Türkçe fallback'i basar. Aynı değer filtre listesine de girer (`:89–93`).
- **Tetikleyici:** EN'de Ziyaretçi sekmesi; ayrı olarak cihaz referansı bulunmayan/silinmiş eski okumayı Geçmiş'te görüntüleme. Böyle bir üretim kaydının varlığı incelenmedi, fakat null backend dalı gerçektir.
- **Beklenen / mevcut:** Uygulamanın kendi açıklaması ve eksik veri etiketi EN olmalı; mevcut gövde/fallback Türkçe kalır. Gerçek cihaz adı çevrilmemelidir.
- **Etki:** Açıklama ve boş veri durumlarında anlama kaybı; ARB kapsamı tam görünmesine karşın görünür dil kapsamı eksik kalır.
- **Kök neden ve çözüm:** Placeholder metni widget'ta, sunum fallback'i domain modelinde tutuluyor. Ziyaretçi açıklaması ARB'ye taşınmalı; model nullable/boş gerçek adı korumalı, fallback UI'da locale ile seçilmeli. `models/device.dart:23` ve `qr_code_model.dart:93` benzer fallback'lerdir; sağlam backend yanıtında cihaz adı zorunlu olduğundan ayrıca gerçekleşmiş bug sayılmadılar, aynı temizlik paketinde ele alınabilirler.

### L10N-F05 — QR bilgi zamanları kullanıcı tarih/saat biçiminden geçmiyor

**P3 · Kesinlik: kaynak analizi.**

- **Kanıt:** `mobile/lib/screens/qr_scan/qr_scan_screen.dart:506–514` kullanıcı QR'ının timestamp'ini ham string olarak çeviri şablonuna koyar. Cihaz QR başarı dialog'u `:530,539–554` payload tarihini `DateTime.parse(...).toString()` ile gösterir; `toLocal()` ve kullanıcı biçimi yoktur. Buna karşılık geçmiş kayıtları `models/attendance.dart:55` ile yerelleştirilen zamandan, `history_screen.dart:1056–1057` ile biçimlenir.
- **Tetikleyici:** Geçerli kullanıcı QR bilgisi açılır; veya kabul edilen base64 cihaz QR'ı timestamp içerir ve self-check-in başarılı olur. UTC offset içeren timestamp ile görsel fark oluşabilir. Cihaz dalının tüm QR formatlarıyla başarıya ulaştığı iddia edilmiyor.
- **Beklenen / mevcut:** Tutarlı, anlaşılır ve saat dilimi kararı belli bir kullanıcı tarih/saat gösterimi; mevcut durumda ISO/Dart çıktısı, gereksiz kesir/saat dilimi gösterimi ve ekranlar arası biçim farkı mümkündür. Bu etiketin QR üretim zamanı mı işlem zamanı mı olduğu da açık değil; backend işlem zamanının yanlış kaydedildiği iddia edilmiyor.
- **Etki:** Kullanıcının gösterilen zamanı yorumlaması zorlaşır; ülke/saat dilimi değişiminde kafa karışıklığı.
- **Kök neden ve çözüm:** Payload metadata doğrudan UI metnine ekleniyor. Güvenli parse, açık zaman anlamı ve ortak locale/saat dilimi politikası gerekir. Geçmişte `dd.MM.yyyy`, kartta `HH:mm` kullanımı (`history_screen.dart:251,1056–1057,1222,1298`; `attendance_status_card.dart:30`) ürünün bilinçli sabit biçimi olabilir; EN için bunların hatalı olduğu tek başına iddia edilmedi.

### L10N-F06 — EN adet mesajları tekil sayıyı karşılamıyor

**P3 · Kesinlik: doğrulandı (katalog ve generated çıktı).**

- **Kanıt:** `mobile/lib/l10n/app_en.arb:67` → `app_localizations_en.dart:159–160` her sayı için `movements`; `app_en.arb:189` → `app_localizations_en.dart:486–487` her sayı için `records`; `app_en.arb:227` → `app_localizations_en.dart:561–562` `Record(s)` döndürür. Canlı tüketicileri `attendance_status_card.dart:46–57`, `history_screen.dart:739,1442`.
- **Tetikleyici:** Ek hareket sayısı 1; haftalık kayıt sayısı 1; tek kayıt içeren günün detayını açma.
- **Beklenen / mevcut:** `+1 movement`, `1 record this week`, `1 record` gibi tekil sonuç; mevcut çıktılar `+1 movements`, `1 records this week`, `1 Record(s)`.
- **Etki:** Anlamı tamamen bozmaz; dil kalitesi ve ürün tutarlılığı düşer.
- **Kök neden ve çözüm:** Tipli `count` var fakat ICU plural yok. EN için `one/other`, gerekiyorsa `=0`; TR'nin doğal sayı yapısı korunarak katalogda tanımlanmalı. `Check-ins: 1` gibi sayaç başlıkları ve kullanılmayan özet anahtarı ayrıca işlevsel bug sayılmadı.

### L10N-F07 — Profil sürüm bilgisi paket tanımıyla uyuşmuyor

**P3 · Kesinlik: doğrulandı (dosyalar arası karşılaştırma).**

- **Kanıt zinciri:** `mobile/pubspec.yaml:3` sürümü `1.0.4+1`; her iki ARB `:130,153` sürümü `1.0.0` olarak sabitler. `profile_screen.dart:230–232` ve `:402–404` bu değerleri gösterir.
- **Tetikleyici:** Profil veya Hakkında dialog'u açılır.
- **Beklenen / mevcut:** Çalışan uygulamanın paket sürümü; kaynak tanımına göre en azından 1.0.4 beklenirken 1.0.0 yazılıdır. Dağıtılmış binary'nin sürümü ölçülmedi, build-time override olasılığı ayrıca doğrulanmalı.
- **Etki:** Destek taleplerinde sürüm teşhisi ve sürüm bazlı sorun takibi zorlaşır.
- **Kök neden ve çözüm:** Çeviri kataloğu dinamik metadata'yı kopyalıyor. Sürüm/build paket bilgisinden okunmalı; ARB yalnız sürüm etiketini ve parametreli şablonu taşımalı.

## Ayrıntılı geliştirme iş paketleri

Tahminler takvim taahhüdü değil göreli efordur: **S** sınırlı dosya/mesaj düzeltmesi, **M** birkaç katmanda davranış ve test değişikliği, **L** ürün/backend/entegrasyon kapsamı. Aşağıdaki işler bu audit sırasında uygulanmadı.

| ID / bulgu | Kapsam ve bağımlılıklar | Yapılacaklar | Gözlemlenebilir kabul kriterleri ve anlamlı test | Efor / gerekçe |
| --- | --- | --- | --- | --- |
| **L10N-W01 / F01** | Locale provider, main ve profil; varsayılan dil ve tercihin cihaz/hesap kapsamı kararı | Sistem/TR/EN seçimi; tercihi saklama/başlatmada yükleme; kök locale bağlantısı; eski/geçersiz değerin geri dönüşü | TR cihazda EN seçince açık ana sayfa, sekmeler, tarih seçici ve sonradan açılan dialog EN olur; soğuk açılışta korunur. Sistem seçeneğinde işletim sistemi dil değişimi izlenir. Testler: hiç tercih yok, TR→EN→TR, geçersiz kayıt, desteklenmeyen sistem dili, yeniden başlatma; kullanıcı değişiminde kararlaştırılmış kapsam korunur. | **M:** UI + persistence + kök state/lifecycle |
| **L10N-W02 / F02** | Şifre sıfırlama ekranı/provider/ARB; kimlik doğrulama modülüyle yönetici kurulumunun ürün kararı | Mevcut capability'ye uygun açıklama/CTA; e-posta gönderme vaadini kaldırma; eski hata state'ini temizleme; `passwordResetAdminInfo` kullanma; erişilemeyen başarı metinlerini yeniden değerlendirme | Mevcut yönetici modeli seçilirse iki dilde e-posta gönderildiği söylenmez; kullanıcı doğru yönetici adımını görür. Test: temiz state ve önceki başarısız girişten sonra açma; aynı doğru mesaj; gerçek olmayan “başarı” görünümü yok. Gerçek reset istenirse ayrı backend iş paketi ve gönderim E2E kanıtı şarttır. | **S:** mevcut capability'yi doğru anlatma; gerçek reset eklenirse ayrıca **L** |
| **L10N-W03 / F03** | Hata modeli/localizer, QR ve kapı seçimi, auth/attendance provider, HTTP adaptörü; backend hata kodu sözleşmesiyle koordinasyon | String yerine hata kodu/türü tutma; bütün UI sınırlarında çeviri; bilinmeyende güvenli genel hata; debug metnini kullanıcı metninden ayırma; yeni işlemde hata state reset'i | TR/EN matrisinde ağ, timeout, backend business, bilinmeyen hata ve erişim reddi yerel metinle görünür; UI'da `TimeoutError:` veya response body yoktur. Test: EN token ilk yükleme timeout'u, EN cihaz listesi ağ hatası/yeniden dene, expired/bozuk QR, `granted:false`, bulunmayan cihaz; önce hata sonra ret durumunda eski hata görünmez. Mevcut login'in genel kimlik bilgisi cevabı korunur. | **M:** birkaç veri/UI dalı; backend kod dönüşümü genişletilirse ayrı kapsam gerekir |
| **L10N-W04 / F04** | Ziyaretçi placeholder, attendance model ve bütün fallback tüketicileri; domain nullability uyumu | Placeholder gövdesini ARB'ye taşıma; gerçek ad ile eksik veri etiketini ayırma; history liste/filtre/detayda UI fallback; benzer device/QR default'larını tarama | EN ziyaretçi gövdesi Türkçe içermez. Backend fixture `device:null` olduğunda EN listede, filtrede ve detayda “Unknown Device/Location” kararlaştırılmış karşılığı görünür; TR karşılığı doğrudur. Gerçek adı Türkçe olan cihazın adı değiştirilmez. Test: mevcut cihaz, silinmiş referans, null/boş ad, gerçek Unicode ad. | **M:** model değişikliği birden çok tüketiciyi etkiler |
| **L10N-W05 / F05** | QR tarih gösterimi ve ortak sunum formatter'ı; “QR üretim zamanı / işlem zamanı” ile işletme/cihaz saat dilimi kararı | Güvenli parse; ortak tarih/saat biçimi; etiketin doğru anlamı; gerekirse parametreli ARB tarih biçimi; sabit 24 saat tercihinin belgelenmesi | Aynı an QR ve geçmişte kararlaştırılan saat diliminde tutarlı görünür; geçersiz/eksik payload tarihi ekranı düşürmez; etiketten zamanın anlamı anlaşılır. Test: UTC ve +03:00 aynı an, gün sınırı, TR/EN, eksik/bozuk tarih ve kullanıcı QR bilgi dalı. Fiziksel kayıt zamanı kontrolü cihaz/E2E aşamasında yapılır. | **M:** zaman anlamı kararı ve birden çok görünüm |
| **L10N-W06 / F06** | Sayılı EN ARB mesajları ve generated kaynak; W08 üretim kuralıyla birlikte yapılabilir | İlgili üç mesajda ICU plural; teknik placeholder tiplerini koruma; çevirmen açıklaması; yetkili ortamda yeniden üretim | `0/1/2/1000` için doğal metin; EN 1'de tekil, diğerinde çoğul; TR doğal yapı ve sayılar korunur. Widget testi ek hareket kartı ve tek kayıt gün detayında gerçek tüketiciyi doğrular. Yalnız generated getter kopyasını sınayan test yeterli değildir. | **S:** sınırlı katalog + tüketici testleri |
| **L10N-W07 / F07** | Profil metadata ve ARB; paket bilgisi okuma yaklaşımı bağımlılığı | Sürüm/build runtime metadata'dan; ARB'de parametreli etiket; elle kopyalanmış sürümün temizlenmesi | Profil ve Hakkında aynı runtime sürüm/build gösterir. Test fixture'ında sürüm değişince TR/EN iki yüzey de otomatik güncellenir; release cihazında kurulu paket metadata'sıyla karşılaştırılır. | **S:** iki sunum noktası, tek metadata kaynağı |
| **L10N-W08 / kalite kapısı** | Bulgu olmayan sürdürülebilirlik işi; katalog üretim sahipliği, CI ve test düzeni | ARB kaynak-of-truth/üretilen dosya politikasını belgelemek; yetkili CI'da üretim sonrası drift kontrolü; TR/EN placeholder parity; canlı metinlerde hardcode taramasında allowlist (ürün adı/iş verisi/protokol kodları); anlamlı iki dilli ekran testleri | Aynı ARB'den üretim ikinci çalışmada diff vermez; eksik EN anahtarı veya placeholder değişikliği kontrollü örnekle kapıyı düşürür. CI snapshot'ı kaynakla eşleşir. Katalogda kullanılmayan visitor başarı mesajları çalışan feature olarak raporlanmaz. Test paketi W03 hata dallarını ve W01 seçimini kapsar; sırf test yokluğu ayrı bug sayılmaz. | **M:** mevcut test/CI sürecine bağlama ve yanlış pozitifleri ayıklama |

Önerilen sıra: W02/W03/W04 görünür metin doğruluğu; W01 ürün tercihiyle birlikte; W05 zaman politikası kararı sonrası; W06/W07 küçük işler. W08 bütün paketlerin sürdürülebilirliğini destekler. W02 gerçek reset inşasına, W04 gerçek ziyaretçi modülüne dönüşürse bu rapordaki küçük kapsamdan ayrılmalıdır.

### Metin ve biçim tutarlılığı için ek notlar

- EN'de `qrTryAgain` “Try again”, `commonRetry` “Try Again”; TR'de benzer tekrar dene/yenile etiketlerinin büyük harf tercihleri farklı. `historyEmptyHint` Türkçesinde “Veriler yenilemek…” yazım sorunu var (`app_tr.arb:171`). Bunlar W08 terminoloji/editoryal kontrolüne alınabilir; ek P2 bulgusu sayılmadı.
- ARB'de çok sayıda kullanılmayan visitor başarı/ekleme mesajı ve eski tema dialog'u metni var. Kullanım araması yalnız sözdizimsel ölçümdür; `AppLocalizations.of(context).qrInvalidResponse` gibi doğrudan çağrıları atlayabildiğinden kesin “ölü anahtar sayısı” verilmedi.
- Profil baş harfi `toUpperCase()` ile üretilir (`profile_screen.dart:89`), kapı araması `toLowerCase().contains` kullanır (`select_device_screen.dart:53–58`). Türkçe I/İ/ı, birleşik Unicode ve kullanıcı beklentisi cihaz/fixture testiyle doğrulanmalı; ölçülmemiş arama başarısızlığı bu raporda ayrı kanıtlı bug sayılmadı.
- Tarih locale desteği ile saat dilimi ayrı kararlardır. TR/EN dil seçimi, kaydın hangi işletme gününe ait olduğunu tek başına belirlememeli. Mevcut modelin yerel saat dönüşümü korunarak şirket/tesis saat dilimi gereksinimi netleştirilmeli.

## Manuel cihaz / E2E doğrulama matrisi

Aşağıdaki satırların **hiçbiri bu worker tarafından çalıştırılmadı**. Geliştirme sonrası doğrulama planıdır. Gerçek kişisel veri yerine test hesabı/fixture, fiziksel geçiş için kontrollü test cihazı kullanılmalı.

| ID | Ortam / önkoşul | Adım ve beklenen gözlem |
| --- | --- | --- |
| L10N-M01 | Android ve iOS; temiz kurulum; TR, EN, desteklenmeyen sistem dili | Splash→login→gezinti→profil; seçilen locale ve fallback'i kaydet. Material tarih seçici, ay/hafta günü ve bütün görünür metinlerin aynı politikayı izlemesini doğrula. |
| L10N-M02 | W01 sonrası; açık oturum ve kaydedilmiş tercih | Uygulama dili değiştir, sekmeler/dialog/takvim açıkken tekrar kontrol et; soğuk başlat, arka plan/ön plan ve hesap değiştir. Tercih kapsamı kararla uyumlu olmalı. |
| L10N-M03 | İki dil; temiz ve önceden başarısız giriş state'i | Şifremi unuttum akışını aç. Mevcut yönetici kurulum süreci doğru anlatılmalı; yapılmayan e-posta gönderimi vaat edilmemeli ve eski hata görünmemeli. |
| L10N-M04 | TR/EN; ağ kapalı, gecikmeli, kontrollü 5xx/bozuk yanıt fixture'ı | QR Kodum ilk yükleme, kapı seçimi, geçmiş yenileme ve login; mesajlar kullanıcı dilinde, güvenli ve yeniden deneme aksiyonu anlaşılır olmalı. Ham body/stack/class adı gösterilmemeli. |
| L10N-M05 | Kontrollü cihaz/hesap; izin verilen, reddedilen ve bulunmayan cihaz; bozuk/süresi geçmiş QR | Tarama ve hızlı aksiyonda doğru sonuç/hata metni; ret sebebi ile ağ hatası birbirine karışmamalı. Fiziksel kapı açılışı ayrı olarak gözlenmeli; yalnız `{granted:true}` UI sonucu fiziksel açılma kanıtı değildir. |
| L10N-M06 | `device:null` eski okuma fixture'ı; gerçek Unicode cihaz adı | History liste, filtre, detay, gün görünümü; fallback seçili dilde, gerçek cihaz adı aynen gösterilmeli. |
| L10N-M07 | Adet fixture'ları 0/1/2/1000; TR/EN | Ek hareket, haftalık özet ve gün detayında tekil/çoğul; sayı ve sözcükler okunaklı olmalı. Kullanılmayan yüzde kartı ayrı geliştirme olmadan canlı akış gibi doğrulanmamalı. |
| L10N-M08 | TR/EN; UTC, İstanbul ve başka cihaz saat dilimi; gece sınırında fixture | QR payload zamanı, history liste/detay ve ana kart karşılaştırması; aynı anın dönüşümü ve etiket anlamı tutarlı, gün sınırı ürün kararıyla uyumlu olmalı. 12/24 saat tercihi ayrıca kaydedilmeli. |
| L10N-M09 | Küçük ekran, yatay/dikey ve %100/%200 metin ölçeği; TR/EN | Login, profil, uzun hata, ana kart, takvim ve QR dialog'ları; kesilen kritik CTA/okunamayan hata/taşma bulunmamalı. Kaynakta sabit satır/kutu boyları görülmesi taşmanın cihazda kanıtlandığı anlamına gelmez. |
| L10N-M10 | Release paket; profil/Hakkında | Gösterilen sürüm/build'i kurulu paketle eşleştir. Kullanıcı dili değişince yalnız etiket çevrilmeli, sürüm aynı kalmalı. |
| L10N-M11 | TR/EN; ziyaretçi placeholder ve tüm profil placeholder'ları | Placeholder bütünlüğü ve çevirisi; ekle/başarı gibi uygulanmamış eylemler varmış izlenimi oluşmamalı. |

### Mevcut doğrulama ve sınırları

Koordinatörün [baz doğrulama raporu](../evidence/baseline.md) `flutter analyze --no-pub` için “No issues found”, `flutter test --no-pub --reporter expanded` için **44 geçen test** bildiriyor. Bunlar bu worker'ın çalıştırdığı komutlar değildir ve cihaz/canlı backend/E2E kanıtı değildir. Mevcut login widget testi locale'i TR'ye sabitler (`mobile/test/widgets/login_screen_test.dart:16`) ve doğrulama/hatalı giriş metinlerini sınar; bu başarı EN, runtime dil değişimi, tüm hata yolları veya fiziksel erişimi doğrulamaz.

Salt okunur katalog karşılaştırmasında TR/EN anahtar ve placeholder parity sağlandı; generated 229'ar üye eşleşti. Çeviri üretimi yeniden çalıştırılmadığı için rapor, üretim aracının güncel sürümde diff üretmeyeceğini garanti etmez. Yerelleştirme bulgularından bağımsız diğer worker bulguları bu raporda değiştirilmedi veya sahiplenilmedi.

## Açık sorular

1. Varsayılan ürün dili Türkçe mi, sistem dili mi? Desteklenmeyen dilde EN mi TR mi isteniyor? Şu an özel fallback politikası kodda yok; bu durum tek başına kusur sayılmadı.
2. Dil tercihi cihazda mı, çalışan hesabında mı tutulmalı; çıkışta korunmalı mı? İşletme ortak cihaz kullanımı var mı?
3. Şifre kurtarma yönetici kurulumuyla mı kalacak, gerçek self-service reset mi isteniyor? Bu karar metin ve iş kapsamını değiştirir.
4. QR dialog'undaki zaman QR üretim zamanı mı geçiş zamanı mı olmalı; işletme saat dilimi mi cihaz saat dilimi mi kullanılmalı? EN'de 24 saat ve `dd.MM.yyyy` bilinçli ürün standardı mı?
5. “Kapıyı Aç” / “Erişim Verildi” metinleri yetki/kayıt sonucunu mu fiziksel kapı komutunu mu anlatmalı? İncelenen mobil `selfCheckIn` yolu okuma kaydı ve `granted` döndürüyor; fiziksel aktüasyon için sistemin diğer parçaları ve cihaz E2E kanıtı gerekir.
6. ARB ve generated kaynakların birlikte commit edilmesi sürdürülecek mi; gen-l10n drift kontrolünün sahibi kim? Eksik anahtar politikası ve çevirmen açıklamaları hangi kapıda denetlenecek?
7. Store/native izin metinlerinin ve işletim sistemi uygulama dil ayarlarının ayrı platform auditinde TR/EN doğrulanması planlandı mı? Bu rapor platform metadata/izin dosyalarının kapsamlı auditini yapmaz.

Rapor sahibi: `11-localization` worker. Bu dosya dışındaki çalışma ağacı değişiklikleri bu görevin çıktısı değildir.
