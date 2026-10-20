# 10 — Tema, ortak bileşenler ve erişilebilirlik

Tarih: 19 Ekim 2026. İnceleme mevcut çalışma ağacındaki kaynaklara dayanır. Bu modülde yalnız bu rapor yazılmıştır; uygulama, backend, platform ve test kodu değiştirilmemiş; Flutter komutu, formatlama, deploy, commit veya push çalıştırılmamıştır. Ekran görüntüsü, emülatör, fiziksel cihaz, TalkBack/VoiceOver ve canlı backend oturumu kullanılmamıştır.

Sonuç: **8 bulgu; P0: 0, P1: 2, P2: 6, P3: 0.** P1'ler özel alt gezinmenin erişilebilirlik sözleşmesi ve ana sayfanın bilinmeyen/hatalı veri durumunu normal katılım durumu gibi sunmasıdır. Kontrast ve yerleşim bulguları kaynak analizi ve renk hesabıdır; görsel QA veya cihazda ölçülmüş taşma sonucu değildir.

## 1. Kapsam, kanıt yöntemi ve mevcut yetenekler

### İncelenen dosyalar

Hedef dizinlerdeki dosyaların tamamı okundu:

| Dosya | İncelenen kapsam |
| --- | --- |
| `mobile/lib/theme/app_theme.dart:1` | Tamamı: açık/koyu ColorScheme, Poppins, AppBar, düğme, kart ve eski bottom navigation teması |
| `mobile/lib/widgets/responsive_container.dart:1` | Tamamı: Center + ConstrainedBox |
| `mobile/lib/widgets/cards/attendance_status_card.dart:1` | Tamamı: başlık, durum rozeti, saat satırı, QR eylemi |
| `mobile/lib/widgets/cards/quick_action_card.dart:1` | Tamamı: InkWell, ikon, etiket/alt etiket |
| `mobile/lib/widgets/cards/progress_hero_card.dart:1` | Tamamı: yüzde, segmentler, metrikler |
| `mobile/lib/widgets/cards/section_header.dart:1` | Tamamı: Expanded başlık ve isteğe bağlı TextButton |
| `mobile/lib/widgets/cards/stat_card.dart:1` | Tamamı: sayı, başlık, trend |
| `mobile/lib/core/breakpoints.dart:1` | Tamamı: 600/1024 eşikleri |
| `mobile/lib/core/spacing.dart:1` | Tamamı: boşluk ölçeği ve 480/720 max-width |

Kullanım ve veri bağlamı için ek okumalar:

- Tam ekran okumaları: `mobile/lib/screens/main_navigation_shell.dart:1`, `home/home_screen.dart:1`, `auth/login_screen.dart:1`, `auth/forgot_password_screen.dart:1`, `profile/profile_screen.dart:1`, `qr_scan/qr_scan_screen.dart:1`, `settings/select_device_screen.dart:1`, `visitor/visitor_screen.dart:1`, `splash_screen.dart:1`.
- Geçmiş ekranında seçili kullanım örnekleri: `mobile/lib/screens/history/history_screen.dart:1`–`465` (yükleme/hata, sekmeler ve takvim), `:938`–`1024` (liste/empty), `:1275`–`1527` (filtre ve gün detay diyalogları). İstatistiklerin tüm hesapları bu modülün kapsamı değildir.
- Tema/router bağlamı: `mobile/lib/main.dart:1`, `mobile/lib/providers/theme_provider.dart:1`, `mobile/lib/router/app_router.dart:1`.
- Veri bağlamı: `mobile/lib/providers/attendance_provider.dart:1`–`351`, `mobile/lib/repositories/attendance_repository.dart:1`–`54`, `mobile/lib/repositories/device_repository.dart:1`–`14`, `mobile/lib/config/convex_config.dart:118`–`148`; Türkçe/İngilizce ARB dosyalarında kullanılan durum ve eylem etiketleri.
- Backend okumalarından **önce** `convex/_generated/ai/guidelines.md` tamamı okundu. Sınırlı bağlam okumaları: `convex/lib/customFunctions.ts:113`–`134`, `convex/cardReadings.ts:1352`–`1450`, `convex/devices.ts:86`–`146`, `convex/employeeCheckIn.ts:1`–`90`. Bunlar backend'in tamamına yönelik güvenlik auditi değildir.
- Test kaynakları: `mobile/test/widgets/responsive_container_test.dart:1`–`62`, `mobile/test/widgets/login_screen_test.dart:1`–`132`. Koordinatör kanıtı: [yerel baz çizgi](../evidence/baseline.md).

`rg` ile bütün `mobile/lib` içinde ortak bileşen/breakpoint kullanımları ve ekranlarda Semantics, odak, tooltip, text scaling, sabit boyutlar tarandı. Özel Semantics sarmalayıcısının bulunmaması, standart Material bileşenlerinin erişilebilirliğinin yok olduğu anlamına gelmez. Bulgular somut kontrol veya akış üzerinden yazıldı.

Koordinatörün baz çizgisi `flutter analyze --no-pub` için hata bulunmadığını ve `flutter test --no-pub --reporter expanded` için **44 testin geçtiğini** bildirir. Bu worker bu komutları tekrar çalıştırmadı. Mevcut widget testleri genişlik sınırlaması ve login doğrulama/hata sunumunu kapsıyor; 720×1600 login test viewport'u (`login_screen_test.dart:42`) küçük ekran/koyu tema/semantics doğrulaması değildir. Test eksikliği tek başına işlevsel bulgu sayılmadı.

### Mevcut akış / capability tablosu

Buradaki “çalışıyor” kaynakta gerçek uygulama bağlantısı bulunduğunu ifade eder; cihazda geçti anlamına gelmez.

| Yetenek | Durum | Gerçek bağlantı / sınır |
| --- | --- | --- |
| Açık, koyu ve sistem teması seçimi | Çalışıyor; görsel tutarlılık kısmi | `profile_screen.dart:309` RadioGroup → `theme_provider.dart:18` tercih kaydı → `main.dart:87` MaterialApp.themeMode. Koyu tema içinde sabit renk kaçakları var (F01). |
| Form/genel içerik genişliğini sınırlama | Çalışıyor | ResponsiveContainer `:20`–`25`; 480 form / 720 genel sabitleri `spacing.dart:17`–`20`. Login, reset, home, profile ve geçmişin ay/istatistik gövdelerinde kullanılıyor. |
| Tablet/landscape uyarlaması | Kısmi | Yatay genişlik sınırlanıyor; `AppBreakpoints` için `mobile/lib` içinde çağıran yok. Home hızlı işlemler her genişlikte dört sütun; QR ve reset gövdeleri kaydırılmıyor. Büyük ekranda NavigationRail olmaması tek başına bug değildir. |
| Standart düğme/form/list tile temeli | Çalışıyor | TextFormField label/validator, ElevatedButton, TextButton, ListTile ve RadioListTile var. Özel navigation ile bazı etiketsiz ikon kontrolleri bu temelden ayrılıyor. |
| Katılım kartı | Gerçek veri bağlantılı; durum sunumu kısmi | `home_screen.dart:157` provider → repository `list` → `cardReadings:listForEmployee`. Backend `cardReadings.ts:1363` çalışan indeksinden okuyor; demo sayı değil. Loading/error ayrımı home kartına taşınmıyor (F07). |
| Hızlı işlem kartları | Kısmi | Kapı tercihiyle `quickUnlock` → `selfCheckIn`, geçmiş/profil route'u gerçek. Ziyaretçi eylemi placeholder ekrana gidiyor. Dar alanda metinler kesiliyor (F06). |
| “Kapıyı Aç” sonucunun fiziksel kapıya etkisi | Kanıtlanamadı | `attendance_provider.dart:310` → repository `:32` → `cardReadings.ts:1378` erişim kararı ve kart kaydı oluşturuyor. Bu incelenen handler'da fiziksel cihaz komutu yok; snackbar başarısı fiziksel kapı açılması kanıtı değildir. Entegrasyon/erişim modülleriyle ayrıca doğrulanmalı. |
| QR gösterimi ve tarama | Gerçek çağrı bağlantılı; uçtan uca kanıtlanamadı | `qr_scan_screen.dart:53` token mutation'ı; `employeeCheckIn.ts:10` çalışan adına token saklıyor. Tarama `qr_scan_screen.dart:525` provider'a gidiyor. Kamera/okuyucu/kapı denemesi yapılmadı; kısa gövdede yeniden yerleşim eksik (F05). |
| Geçmiş loading / error / liste / empty | Kısmi | `history_screen.dart:144`–`162` durum ayrımı; `:938` liste/empty. Empty yenileme jesti çalışacak Scrollable içermiyor (F08). |
| Tercih edilen cihaz seçimi | Gerçek veri bağlantılı; cihaz QA kanıtlanamadı | `select_device_screen.dart:29` repository → `devices:listForEmployee`; backend `devices.ts:96` üyelik → aktif kural → aktif cihaz zinciri. Loading/error/retry ve boş liste/arama eşleşmeme ayrı. |
| Ziyaretçi yönetimi | Placeholder | `visitor_screen.dart:32`–`44` “Çok yakında”; form veya backend çağrısı yok. Bu ekran gerçek ziyaretçi daveti gibi sayılmamalı. |
| Profil düzenleme / dil değiştirme | Placeholder | `profile_screen.dart:258`, `:358` yalnız bilgi diyalogları; ARB `app_tr.arb:98`, `:146` özelliğin geleceğini açıkça söylüyor. Tema seçimi bu iki placeholder'dan farklı olarak uygulanmış. |
| StatCard / ProgressHeroCard | Üretim ekran akışı kanıtlanamadı | `rg` sonucu yalnız sınıf/constructor tanımları var; History kendi `_buildStatCard` metodunu kullanıyor. Bunların renk/segment riskleri mevcut kullanıcı akışında hata diye sayılmadı. |
| Ekran okuyucu, harici klavye, büyük yazı ve gerçek kontrast QA | Kanıtlanamadı | Kaynak incelemesi yapıldı; platform semantics ağacı ve cihaz render çıktısı alınmadı. |

Kimlik bağlamı web yöneticisi değil mobil çalışandır: `convex_config.dart:119`/`:133` oturumu isteğe ekliyor; `customFunctions.ts:117`/`:128` çalışanı `ctx.employee` içine alıyor. Katılım query'si `employee._id` ile sınırlı (`cardReadings.ts:1365`). Bu raporda kullanıcıya görünen bilinmeyen veri durumu, backend yetki açığı olarak etiketlenmemiştir.

## 2. İyi çalışan temeller

- Material 3 ve seed tabanlı iki ColorScheme, ortak font, kart ve düğme şekilleri merkezileştirilmiş (`app_theme.dart:25`, `:78`). Tema tercihinin UI'dan kalıcı depoya kadar zinciri var.
- Genişlik sınırını uygulayan küçük bir ortak wrapper mevcut; login ayrıca SafeArea ve SingleChildScrollView kullanıyor (`login_screen.dart:97`–`100`). Home yenilemesinde AlwaysScrollableScrollPhysics var (`home_screen.dart:46`–`49`).
- Katılım durumu yalnız renkle gösterilmiyor: yazılı durum, giriş/çıkış etiketleri, saatler ve eylem metni var (`attendance_status_card.dart:114`, `:181`, `:239`). Bu, düşük kontrastı düzeltmez ama renk ayrımı güçlüğünde anlamı koruyan bir temeldir.
- `SectionHeader` başlığı Expanded içinde; eylem standart TextButton (`section_header.dart:21`, `:30`). QuickActionCard çıplak GestureDetector yerine Material + InkWell kullanıyor (`quick_action_card.dart:27`).
- Login alanlarının yerelleştirilmiş label ve metinsel validator'ları var (`login_screen.dart:149`–`194`). Reset gönderimi yükleme sırasında devre dışı bırakılıyor ve spinner gösteriliyor (`forgot_password_screen.dart:141`–`157`).
- Cihaz seçiminde loading, hata+retry, gerçekten boş liste ve aramaya eşleşmeme birbirinden ayrılmış (`select_device_screen.dart:98`–`131`). Geçmişte de hata için ayrı yeniden deneme eylemi var (`history_screen.dart:182`–`234`). Bunlar ortak durum bileşeni için kullanılabilir örneklerdir.
- Shell route'u sekme navigator durumunu koruyor (`app_router.dart:80`); erişilebilir navigation değişikliği yapılırken bu davranışı kaybetmek gerekmiyor.

## 3. Kanıtlı bulgular

### DA-F01 — Sabit metin/durum renkleri açık ve koyu temada yetersiz kontrast üretiyor

**P2 · Kesinlik: kaynak analizi; sRGB renk hesabı doğrulandı, render ölçülmedi.**

**Kanıt zinciri:** Tema koyu arka planı `#121212`, kartı `#1E1E1E` yapıyor (`app_theme.dart:10`, `:122`–`127`); login başlıkları bunu `Colors.black87` ile eziyor (`login_screen.dart:111`–`137`). QR açıklaması da koyu temada black87 (`qr_scan_screen.dart:430`–`438`). Home'da bordo selamlama ve alt başlık (`home_screen.dart:134`, `:305`), saat satırında grey700 (`attendance_status_card.dart:185`) tema parlaklığına göre değişmiyor. Shell seçili koyu tema rengi `#9E1B3B`, zemini `#1E1E1E` (`main_navigation_shell.dart:34`, `:98`). Aynı kartın içeride durumunda QR düğmesi beyaz yazı + `warning=#F59E0B` kullanıyor (`attendance_status_card.dart:228`, `:243`–`245`; `app_theme.dart:18`). Hızlı işlem sonucu beyaz metinli success/warning snackbar (`home_screen.dart:251`–`256`).

**Somut tetikleyici:** Koyu tema seçip login/QR/home açmak; açık temada içeride durumundaki çıkış düğmesini veya başarılı/reddedilen hızlı işlem mesajını okumak.

**Beklenen / mevcut:** Tema değişince metin okunabilir kalmalı; durum renginin üzerine uygun foreground seçilmeli. Mevcut sabit çiftlerin kaynak renk hesabı şöyledir:

| Çift | Yaklaşık oran | Bağlam |
| --- | --- | --- |
| black87 / `#121212` | 1,10:1 | Koyu login üst başlığı |
| black87 / `#1E1E1E` | 1,23:1 | Koyu login kart başlığı; kart tint'i hariç nominal değer |
| `#9E1B3B` / `#1E1E1E` | 2,12:1 | Koyu shell seçili etiket |
| white / `#F59E0B` | 2,15:1 | Çıkış düğmesi, warning snackbar |
| white / `#22C55E` | 2,28:1 | Başarı snackbar'ı |
| grey700 `#424242` / `#1E1E1E` | 1,66:1 | Katılım saat satırı etiketi, nominal kart zemini |

Hesap, sRGB bağıl parlaklık formülü ve black87 için alfa bileşimiyle yapıldı; antialiasing, cihaz parlaklığı, tema surface tint'i ve görüntü analizi dahil değil. Normal metin için 4,5:1, büyük metin için 3:1 karşılaştırma eşiği [W3C kontrast açıklamasından](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) alınmıştır; bu bir tüm uygulama uyumluluk sertifikası değildir.

**Etki:** Düşük görme/kontrast duyarlılığı olan kullanıcı başlık, seçili sekme ve işlem sonucunu okumakta zorlanır. Çıkış eylemi ve kapı erişim kararı gibi anlamlı bilgiler etkilenir.

**Kök neden / çözüm:** ColorScheme üretildikten sonra ekranların hardcoded marka/griler ve status renklerini metin rengi olarak kullanması. `onSurface`, `onSurfaceVariant`, `primary/onPrimary` ve durum için ayrı foreground/background çiftlerini ortak token'a taşı; durum dolgusunda beyazı otomatik varsayma. Kart tint'i dahil gerçek render üzerinde son ölçümü yap.

### DA-F02 — Alt gezinmenin QR kontrolü adsız; sekme rolü/seçili durum ve klavye etkileşimi tanımlanmamış

**P1 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Router'ın beş ana dalı bu shell'i kullanıyor (`app_router.dart:80`–`124`). Dört sekme GestureDetector → Container → Icon/Text (`main_navigation_shell.dart:102`–`124`); `selected` sadece renk/fontWeight'a dönüşüyor (`:98`, `:118`). QR dalının GestureDetector'ı sadece sabit boyutlu ikon taşıyor (`:128`–`150`); metin, semanticLabel, Tooltip veya Semantics yok. Bu iki builder içinde Focus/Actions/Shortcuts veya standart navigation kontrolü de yok.

**Somut tetikleyici:** Ana sekmeler arasında ekran okuyucuyla dolaşmak veya harici klavyede Tab/Enter/Space kullanmak.

**Beklenen / mevcut:** Her hedefin adı, gezinme rolü ve seçili durumu anlaşılmalı; odakla etkinleştirilebilmeli. Kaynak QR kontrolüne konuşulabilir bir ad vermiyor; diğerlerinin metni var ancak seçim yalnız görsel. GestureDetector erişilebilir tap eylemi üretebilir; bu nedenle “ekran okuyucu hiçbirine dokunamaz” iddiası yapılmıyor. Gesture tanıma tek başına klavye odak/aktivasyon sözleşmesi sağlamıyor. [Flutter GestureDetector API](https://api.flutter.dev/flutter/widgets/GestureDetector-class.html) semantics aktarımını açıklıyor; cihazdaki kesin anons ayrıca doğrulanmalı.

**Etki:** QR ana akışının ne işe yaradığı yardımlı kullanımda keşfedilemez; mevcut sekme anlaşılamaz, klavyeyle ana dallara geçiş engellenebilir.

**Kök neden / çözüm:** Standart navigation semantiği görsel bir Row ile yeniden kurulmuş. Tercihen NavigationBar/BottomNavigationBar veya eşdeğer odaklanabilir standart kontroller kullan; özel QR görünümünü korusan da adı, button/selected bilgisi, klavye aksiyonları ve görünür odak ekle. Mevcut `goBranch` ve sekme stack korumasını sürdür.

### DA-F03 — Bazı form ve ikon kontrollerinde erişilebilir ad/hedef sözleşmesi eksik

**P2 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Login şifre görünürlüğü IconButton'ı tooltip/label içermiyor (`login_screen.dart:175`–`184`); “Beni Hatırla” Checkbox ve ayrı Text aynı Row'da, Checkbox.semanticLabel/MergeSemantics yok ve Text tıklanmıyor (`:197`–`208`). “Şifremi unuttum” yalnız metni saran GestureDetector (`:227`–`239`); padding/minimumSize/focus kontrolü yok. Profil ayarlar IconButton (`profile_screen.dart:28`–`31`), geçmiş filtre IconButton (`history_screen.dart:127`–`130`) ve kamera değiştir/flaş FAB'ları (`qr_scan_screen.dart:260`–`271`) da uygulama tarafından adlandırılmıyor.

**Somut tetikleyici:** Ekran okuyucuda bu kontrole odaklanmak; “Beni Hatırla” yazısına dokunmak; şifre sıfırlama bağlantısına motor hassasiyeti düşük kullanıcıyla veya klavyeyle ulaşmak.

**Beklenen / mevcut:** İşlem adı ve toggle durumu anlaşılmalı; etiket de seçimi değiştirmeli. Kaynak checkbox ile etiketi tek semantic kontrol olarak bağlamıyor; görünür ikon isimleri uygulama tarafından sağlanmıyor. Şifre sıfırlama hit alanı metnin ölçüsüyle sınırlı. Gerçek hedef boyutu/anons cihazda ölçülmedi; standart IconButton/FAB'ların küçük olduğu iddia edilmiyor.

**Etki:** Görünürlük/flaş gibi kontrollerin amacı tahmine kalır; hatırlama seçeneğinin ilişkisi ve tıklama alanı belirsizdir; parola kurtarma zorlaşır.

**Kök neden / çözüm:** Görsel ikon/metin, kontrolün adı ve etkileşim yüzeyi yerine kullanılmış. Yerelleştirilmiş tooltip/semantic adlar ve görünürlüğe göre değişen eylem adı ekle; CheckboxListTile veya eşdeğer birleşik kontrol kullan; reset bağlantısını TextButton yap. [CheckboxListTile API](https://api.flutter.dev/flutter/material/CheckboxListTile-class.html) bütün tile'ı etkileşimli etiketli kontrol olarak tanımlar. Hedefler için ürün kabul ölçütünü en az 48×48 mantıksal piksel belirle ve gerçek hit alanını ölç.

### DA-F04 — Şifre sıfırlama formu klavye ve kısa ekran için kaydırılamıyor

**P2 · Kesinlik: kaynak analizi; cihazdaki sınır boyutları ölçülmedi.**

**Kanıt zinciri:** Scaffold → SafeArea → ResponsiveContainer → Padding → Form/Column (`forgot_password_screen.dart:59`–`83`); ScrollView yok. Formda sabit 32/24/48 boşluklar, 80 yükseklikte ikon, TextFormField ve iki eylem var (`:86`–`170`). Başarı görünümü de kaydırılmayan Column (`:180`–`222`). ResponsiveContainer yalnız maxWidth uygular (`responsive_container.dart:20`–`25`), düşey overflow'u çözmez.

**Somut tetikleyici:** Küçük telefon veya landscape'de e-posta alanına dokunup klavyeyi açmak; yazı boyutunu büyütmek; uzun doğrulama mesajı göstermek.

**Beklenen / mevcut:** Alan, hata ve gönder/geri eylemlerine kaydırarak erişilebilmeli. Sabit ikon+boşluklar bile yüksekliği tüketirken Column, daralan Scaffold gövdesi içinde kaydırma olanağı sunmuyor; içerik sığmadığında RenderFlex overflow/erişilemeyen alt eylem beklenir. Tam kesim eşiği font ve cihaz insets'ine bağlıdır.

**Etki:** Parola kurtarma formunun tamamlanması veya girişe dönüş küçük kullanılabilir yükseklikte zorlaşır.

**Kök neden / çözüm:** Yatay max-width, düşey responsive çözüm gibi kullanılmış. Klavye inset'leriyle uyumlu scrollable form/success gövdesi ve içerikle büyüyen minimum düğme yüksekliği kullan; hata ve odaklanan alanın görünür kalmasını doğrula.

### DA-F05 — QR gösterim gövdesi sabit yükseklikli içerikle kısa viewport'u aşıyor

**P2 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** QR ekranı AppBar+TabBar ve shell navigation içinde (`qr_scan_screen.dart:119`–`143`; `app_router.dart:100`–`105`). “QR'ım” gövdesi padding24 + kaydırılmayan Column (`qr_scan_screen.dart:378`–`385`); QR size250 + padding16 (`:287`, `:304`), ardından progress ve açıklama (`:410`–`440`). Token süresi dolunca 140×140 yenileme kontrolü QR üstüne geliyor (`:318`–`370`). Kamera çerçevesinin boyutu ise yalnız pencere genişliğinden hesaplanıyor (`:164`–`165`), yerel gövde yüksekliğinden değil.

**Somut tetikleyici:** Token görüntülenirken telefonu landscape'e çevirmek veya çoklu pencere/kısa tablet penceresi kullanmak; büyük yazıda açıklama satırlarını büyütmek.

**Beklenen / mevcut:** QR oranı ve kullanılabilir tarama boyutu korunarak açıklama/yenileme erişilebilir kalmalı. Mevcut Column düşeyde daralamıyor/kaydırılamıyor; QR+boşluklar+metin AppBar ve alt bar sonrası gövdeyi aşabilir. Kamera overlay'i de geniş ama kısa gövdede çerçevenin tamamını sığdıracak yükseklik hesabı yapmıyor. Kamera görüntüsünün gerçekten kırpıldığı cihazda gözlenmedi.

**Etki:** QR ve süre/yenileme yönergesi aynı anda kullanılamayabilir; kameraya hizalama alanı yanıltıcı olabilir.

**Kök neden / çözüm:** Kare boyutu ve aralıklar yerel constraints yerine sabit/pencere genişliğiyle hesaplanmış. LayoutBuilder ile yerel genişlik ve yüksekliği birlikte değerlendir; kısa durumda kontrollü kaydırma/iki sütun düzeni seç. QR kontrastını ve okuyucu için gerekli minimum boyutu fiziksel okuyucuyla doğrula; yalnız sığdırmak için kontrolsüz küçültme yapma.

### DA-F06 — Ortak katılım satırı ve hızlı eylemler büyük metinde yeniden yerleşmiyor

**P2 · Kesinlik: kaynak analizi; kesin overflow pikseli cihaz/font ölçümü gerektirir.**

**Kanıt zinciri:** Katılım saat satırında ikon, 12 boşluk, sabit 96 etiket, saat ve opsiyonel “+N hareket” metni aynı Row'da; saate/trailing'e Flexible/Expanded/Wrap verilmemiş (`attendance_status_card.dart:168`–`208`). Home gerçek ek hareket sayılarını geçiriyor (`home_screen.dart:160`–`165`); provider aynı gün birden çok giriş/çıkış için bu sayıyı üretiyor (`attendance_provider.dart:97`–`106`). Home'un dört QuickActionCard'ı her genişlikte tek Row/Expanded içinde (`home_screen.dart:179`–`218`); ortak kart etiket ve alt etiketi tek satır ellipsis'e kilitliyor (`quick_action_card.dart:58`–`76`). QR eylemi de sabit 56 yükseklik (`attendance_status_card.dart:233`–`241`).

**Somut tetikleyici:** 320–360 mantıksal piksel telefon, %200 yazı, aynı gün ek hareket veya uzun seçili kapı adı. Home kenar boşluğu ve kart padding'i kullanılabilir iç genişliği ayrıca azaltıyor (`home_screen.dart:54`; `attendance_status_card.dart:35`).

**Beklenen / mevcut:** Katılım zamanı, hareket adedi ve eylem adı anlam kaybetmeden alt satıra geçebilmeli. Mevcut Row içerikleri gerektiğinde genişliği aşar; dört sütun hızlı işlem etiketini ve seçili kapı adını keser. Ellipsis görsel bir kayıptır; metnin semantics'te mutlaka kesildiği iddia edilmiyor.

**Etki:** Kullanıcı hareket bağlamını veya hangi kapının seçili olduğunu görsel olarak ayırt etmekte zorlanır; büyük yazı tercihi temel işlem metnini azaltır.

**Kök neden / çözüm:** Ortak bileşende metin büyümesi ve yerel genişliğe göre alternatif düzen tanımlanmamış. Saat satırını dar durumda iki satır, hızlı işlemleri 2×2 veya dinamik minimum kart genişliğiyle düzenle; eylem yüksekliğini minimum olarak tanımla; kritik kapı adı için tam metne erişim sağla. Eşik seçimini yalnız ekran genişliği değil text scaling ile de doğrula.

### DA-F07 — Ana sayfa yüklenmeyen/hatalı katılım verisini normal durum olarak gösteriyor

**P1 · Kesinlik: kaynak analizi.**

**Kanıt zinciri:** Backend gerçek çalışan okumalarını döndürüyor (`cardReadings.ts:1357`–`1369`), repository listesi bunları modele dönüştürüyor (`attendance_repository.dart:13`–`17`). Provider başlangıçta boş kayıt listesine sahip (`attendance_provider.dart:26`), boş listede `attendanceStatus.none` dönüyor (`:122`–`125`); yükleme ve hatayı ayrı alanlarda tutuyor (`:256`–`279`, subscription hatası `:205`–`216`). Home `_loadData` çağırıyor (`home_screen.dart:30`–`37`) ama Consumer yalnız status, saat ve sayaçları karta veriyor (`:157`–`167`); `isLoading/errorMessage/lastError` okunmuyor. Kart none durumunda “Henüz Yok” ve giriş eylemi sunuyor (`attendance_status_card.dart:114`–`117`, `:226`–`241`; `app_tr.arb:60`, `:64`).

**Somut tetikleyici:** Yeni oturumda ilk katılım isteği gecikir veya AuthExpired dışındaki ağ/sunucu hatasıyla başarısız olur. Alternatif: kayıtlar gösterildikten sonra yenileme/subscription hata verir.

**Beklenen / mevcut:** Başarılı boş veri ile henüz bilinmeyen/hatalı veri ayrılmalı; eski veri varsa güncellik uyarısı ve tekrar dene sunulmalı. Mevcut home ilk durumda “Henüz Yok”, ikinci durumda eski normal durum kartını gösterir; kullanıcıya bu verinin yüklenemediğini söylemez. Geçmiş ekranının provider hatasını ayrı render etmesi (`history_screen.dart:148`–`152`) bu ayrımın mümkün olduğunu gösteriyor.

**Etki:** Çalışan, giriş kaydının olmadığına veya eski içeride/çıktı bilgisinin hâlâ güncel olduğuna güvenebilir; tekrar işlem ve destek yükü doğar. Bu bulgu backend kaydının kaybolduğunu iddia etmez; sunumun veri kesinliğini yanlış ifade etmesidir.

**Kök neden / çözüm:** Ortak katılım kartı yalnız iş durumu kabul ediyor; fetch durumu ve veri güncelliği arayüz sözleşmesinde yok. Loading/success-empty/success-data/error-without-data/stale-data durumlarını tanımla; uygun retry ve erişilebilir durum mesajı göster. Ağ hatasını gerçek erişim reddiyle birleştirmeden mevcut veriyi koru.

### DA-F08 — Geçmişin boş durumunda çekerek yenileme için Scrollable yok

**P2 · Kesinlik: kaynak analizi; framework sözleşmesiyle doğrulandı.**

**Kanıt zinciri:** Kayıt yokken `RefreshIndicator(child: _buildEmptyState(...))` dönüyor (`history_screen.dart:942`–`946`). `_buildEmptyState` yalnız Center → Column (`:986`–`1023`); kaydırılabilir çocuk yok. Dolu listenin RefreshIndicator'ı ListView içeriyor (`:954`–`966`). [Flutter RefreshIndicator API](https://api.flutter.dev/flutter/material/RefreshIndicator-class.html), yenilemeyi scrollable alt öğeden gelen overscroll üzerinden tetikler.

**Somut tetikleyici:** Sıfır kayıt veya filtre sonrası boş liste durumunda aşağı çekerek yenilemeye çalışmak.

**Beklenen / mevcut:** Boş liste de kullanıcı isteğiyle yenilenebilmeli. Kaynakta yenileme callback'i var ama bu ağaçta onu tetikleyecek overscroll kaynağı yok; boş ekranda ayrı bir yenile düğmesi de yok.

**Etki:** Kullanıcı yeni kaydı elle istemek için ekran/sekme değiştirmeye veya arka plandaki polling'e bağımlı kalır. Bu, backend'in otomatik güncelleme yapmadığı anlamına gelmez.

**Kök neden / çözüm:** Empty görseli scrollable yerine yerleştirilmiş. AlwaysScrollableScrollPhysics içeren liste/sliver gövdesine empty state ekle; ekran okuyucu/klavye için açık yenile eylemi sun. Filtre kaynaklı boşlukta filtreyi temizleme yolunu koru.

## 4. Ayrıntılı geliştirme iş paketleri

S/M/L göreli kapsam tahminidir; gün veya takvim taahhüdü değildir. Önce ortak sözleşmeleri, sonra ekran adaptasyonlarını uygulamak tekrar işi azaltır. Bu audit sırasında aşağıdaki değişiklikler uygulanmadı.

### DA-W01 — Tema ve durum renk çiftleri

**Kapsam:** F01; AppTheme, aktif ortak kartlar, shell, login, home, QR ve geçmişte görülen renk kaçakları. **Bağımlılık:** Tasarım/ürün tarafından marka ve status çiftlerinin onayı; canlı backend gerektirmez. **Tahmin: M** — merkezi token ve birden fazla ekran kullanımının birlikte değiştirilmesi, iki tema render kontrolü gerekir.

**Yapılacaklar:**

1. Surface/foreground ve success/warning/danger için açık/koyu eşleşen token sözleşmesi oluştur.
2. Aktif ekranlarda black87, sabit bordo ve grileri bağlama uygun ColorScheme/token ile değiştir; disabled/dekoratif renkleri ayrı değerlendir.
3. Çıkış düğmesi ve hızlı işlem snackbar'ında okunabilir foreground seç; koyu navigation selected/focus renklerini birlikte ele al.
4. Kullanılmayan StatCard/ProgressHeroCard için yalnız sözleşme uyumunu planla; yeniden kullanım ihtiyacı yoksa gereksiz ürün işi açma.

**Gözlemlenebilir kabul:** Normal metin çiftleri ≥4,5:1, büyük metin ≥3:1; seçili/odak kontrolü okunabilir; açık/koyu/sistem geçişinde yanlış temadan kalan metin yok. F01 tablosundaki her çiftin yeni hesap ve render kanıtı mevcut. İşlem anlamı metinle korunuyor.

**Anlamlı testler:** İki tema için token kontrast hesabı; login/home/QR/snackbar görsel kontrolü; sistem tema değişiminde yeniden render; içeride/çıktı/boş durumları. Tek tek sabitlerin değerini kopyalayan test yerine gerçekten kullanılan çiftleri sınayan kontrol kullan.

### DA-W02 — Erişilebilir ana gezinme

**Kapsam:** F02, shell ve router etkileşimi. **Bağımlılık:** W01 odak/seçili renkleri; mevcut `goBranch` sözleşmesi korunmalı. **Tahmin: M** — görünüm, semantics ve beş dalın navigasyon regresyonu birlikte ele alınır.

**Yapılacaklar:** Standart navigation bileşenini değerlendir; her hedefe yerelleştirilmiş ad, rol ve selected state ver; QR görünümünü erişilebilir kontrol üzerinde tut; Tab sırası, Enter/Space ve görünür focus uygula; aynı sekmeye yeniden basmanın köke dönüşünü koru.

**Gözlemlenebilir kabul:** Semantics ağacında beş ayrı adlandırılmış hedef ve tam bir seçili hedef var; QR açıkça QR işlemi olarak duyuruluyor. Harici klavyeyle beş dal açılıyor; aktif dal değişimi anlaşılıyor; sekme stack'i ve mevcut route guard'ları aynı davranıyor.

**Anlamlı testler:** SemanticsTester ile isim/rol/selected assertions; klavye ile odak ve aktivasyon; tab değiştirip eski tab'a dönünce sayfa durumu; Android TalkBack/iOS VoiceOver gerçek cihaz turu. Semantics snapshot'ı cihaz anonsunun yerine geçmez.

### DA-W03 — Form, ikon ve eylem yüzeyleri

**Kapsam:** F03; login, profil, geçmiş, kamera kontrolleri. **Bağımlılık:** TR/EN eylem metinleri; W01 odak rengi. **Tahmin: S** — sınırlı sayıda kontrol; kapsam ad/rol/hedef düzeltmesiyle sınırlı.

**Yapılacaklar:** Görünürlüğe göre “Şifreyi göster/gizle” adları; ayarlar/filtre/kamera değiştir/flaş adları ve gerekiyorsa toggle durumu; etiketli birleşik remember kontrolü; reset bağlantısı için TextButton ve en az 48×48 ürün hedefi; eylemlerden sonra odak geri dönüşünü doğrula.

**Gözlemlenebilir kabul:** İlgili kontrol adsız düğme olarak kalmıyor; remember etiketi ve kutusu tek kontrol olup her ikisine dokunmak aynı değeri değiştiriyor; reset linkine Tab ile ulaşılıp Enter ile açılabiliyor; gerçek hit alanı ürün minimumunu karşılıyor.

**Anlamlı testler:** Tooltip/semantics isim ve state kontrolleri; etikete tıklama; visibility sonrası parola içeriğinin korunması; klavye aktivasyonu; kamera switch/torch davranışı ve anonsu fiziksel cihazda. Testlerde gerçek kullanıcı verisi kullanma.

### DA-W04 — Küçük viewport ve büyük yazı için yeniden yerleşim

**Kapsam:** F04, F05, F06; reset, QR, AttendanceStatusCard, home QuickActionCard kullanım düzeni. **Bağımlılık:** W02/W03 kontrol sözleşmeleri; QR okunabilir minimum boyutu için gerçek okuyucu ölçümü. **Tahmin: L** — üç ayrı yerleşim türü, klavye, metin ölçeği ve kamera/okuyucu doğrulaması içerir.

**Yapılacaklar:**

1. Reset form/success görünümünü inset uyumlu kaydırılabilir yap; odaklanan alan ve validator görünürlüğünü koru.
2. QR gösterimi ve kamera overlay'ini yerel constraints'e göre düzenle; kısa viewport alternatifi oluştur; açıklama ve yenilemeye erişimi koru.
3. Katılım satırını dar durumda iki satıra geçir; ek hareket metnine alan ayır; QR eyleminde sabit height yerine yeterli minimum kullan.
4. Hızlı eylemleri minimum kart genişliği ve yazı ölçeğine göre 2×2/tek sıra düzenle; seçili kapı adına tam erişim sağla.
5. Eşikler için AppBreakpoints'i yalnız uygun yerde kullan; ekran genişliği ile içeriğe kalan genişliği aynı varsayma. Boşluk sabitlerini kademeli benimse; tüm uygulamayı formatlama/yeniden yazma işine dönüştürme.

**Gözlemlenebilir kabul:** 320/360/600/1024 mantıksal piksel genişliklerde ve kısa landscape gövdede %100/%130/%200 yazı ile ilgili alan/eylemler erişilebilir; debug layout exception yok; kritik saat, hareket sayısı ve eylem adı kesilmiyor. Reset klavyesi açıkken gönder/geri erişilebilir. QR oranı korunuyor ve desteklenen okuyucuda okunuyor.

**Anlamlı testler:** Parametreli viewport/text scaler widget testleri; klavye viewInsets + uzun hata; 0/1/çok ek hareket, uzun kapı adı ve TR/EN etiketleri; token loading/error/valid/expired görünümleri; gerçek cihaz dönüşü/split view; basılı/sabit cihaz QR'ı ve telefon QR'ının fiziksel okuyucu denemesi.

### DA-W05 — Ortak veri durumu ve güncellik sunumu

**Kapsam:** F07; home katılım sunumu ve ortak durum UI sözleşmesi. **Bağımlılık:** AttendanceProvider/katılım modülüyle load state ve başarılı veri zamanı sözleşmesi; W01 durum renkleri. **Tahmin: M** — UI değişikliğine ek olarak ilk yükleme/eski veri/hata ayrımını güvenilir temsil etmek gerekir.

**Yapılacaklar:** İlk yükleme, başarılı boş, başarılı dolu, verisiz hata ve eski veri+hata durumlarını modelle; home Consumer'a taşı; retry ekle; mevcut veriyi hata nedeniyle silmeden “güncellenemedi” bilgisini göster; durum değişimini erişilebilir biçimde duyur; sürekli polling anonsuyla kullanıcıyı rahatsız etme. Hızlı işlem hatası ile liste okuma hatasını aynı görünüme körlemesine bağlama.

**Gözlemlenebilir kabul:** Hiç başarılı veri gelmeden “Henüz Yok” kesin iş durumu gösterilmiyor. Hata metni+retry var; başarılı boş sonuçtan ayrılıyor. Eski veri varsa eski olduğu anlaşılır; başarılı yenileme uyarıyı kaldırır. Auth expiry mevcut login yönlendirmesini korur.

**Anlamlı testler:** Kontrol edilen repository Future'ı ile geciken ilk istek; ilk network error; dolu veri sonrası refresh/subscription error; başarılı boş yanıt; retry sonrası dolu veri; erişim reddi ile ağ hatasının ayrımı. Ekran okuyucu anonsunu iki platformda elle dinle.

### DA-W06 — Boş durumdan yenileme ve geri kazanım

**Kapsam:** F08; geçmiş liste/empty gövdesi. **Bağımlılık:** W05 ortak empty/error yapısı seçilirse onun arayüzü; bağımsız da uygulanabilir. **Tahmin: S** — tek gövde ve yenileme etkileşimi.

**Yapılacaklar:** Empty içeriğini scrollable gövdeye taşı; AlwaysScrollableScrollPhysics veya eşdeğer davranış kullan; görünür/erişilebilir yenile eylemi ekle; kayıt yok ile filtre eşleşmesi yok mesajını ayırmayı değerlendir.

**Gözlemlenebilir kabul:** Sıfır kayıt ve filtre sonucu boş ekranda çekerek yenilemek load çağrısını tetikler; açık yenile eylemi klavye/ekran okuyucuyla çalışır; spinner tamamlanır; yeni kayıt gelince listeye geçilir; filtre temizleme kaybolmaz.

**Anlamlı testler:** Empty üzerinde drag sonrası repository çağrısı; kısa tek kayıt listesi; filtreli boşluk; yenileme hatası ve retry; yeni kayıt sonucu geçiş. Polling'in kendiliğinden yenilemesini manuel yenilemenin başarısı sayma.

### DA-W07 — Bileşen kabul kataloğu ve cihaz kanıtı

**Kapsam:** Bütün hedef ortak bileşenler ve aşağıdaki matris; yeni işlev ekleme değildir. **Bağımlılık:** W01–W06 sonrası; koordinatörün ortak SDK/test zamanlaması. **Tahmin: M** — iki platform, tema, yazı ölçeği ve giriş yöntemlerinden örneklem gerektirir.

**Yapılacaklar:** Aktif ortak kartlar için loading/error/empty/dolu/uzun metin örnekleri oluştur; kullanılmayan StatCard/ProgressHeroCard'ı ürün ekranı gibi sunma. Yeniden kullanılacaksa progress total=0, segment toplamı>total, negatif veri ve uzun etiket sözleşmesini önce kararlaştır (`progress_hero_card.dart:52`–`53`, `:142`–`149` sınırlandırma yapmıyor; aktif çağıran bulunmadığı için mevcut işlevsel bug sayılmadı). SectionHeader'ın başlık semantiğini, QuickActionCard rolünü ve preference seçiminin anonsunu gerçek semantics ağacında incele. Kanıtları sürüm/cihaz/ayar/sonuçla kaydet.

**Gözlemlenebilir kabul:** Matris satırları geçti/kaldı/bloke ve kanıt kimliğiyle kapanmış; gerçek cihaz anonsu ve hit alanı ölçümü mevcut; kalan hipotezler ayrı listede. Uygulama genelinde “erişilebilir” ilanı yalnız test sayısına dayandırılmıyor.

**Anlamlı testler:** Görsel karşılaştırma + semantics assertions + kritik kullanıcı yolculuğu. Otomasyonun yakalayamadığı kamera ve fiziksel okuyucu davranışı manuel kayıtta kalır. Mevcut 44 testin yeni davranışla regresyonu koordinatörce yeniden çalıştırılır.

## 5. Manuel cihaz / E2E doğrulama matrisi

**Aşağıdaki bütün satırlar bu audit için çalıştırılmadı.** Test verileri sentetik ve yetkili test ortamına ait olmalı. Görev salt okunur olduğundan audit sırasında kayıt oluşturma/kapı komutu/tercih değiştirme dahil hiçbir canlı mutasyon yapılmadı; aşağıdaki işlemler sonraki geliştirme doğrulamasının planıdır.

| ID | Ortam / ayar | Senaryo | Gözlenecek kabul / kanıt |
| --- | --- | --- | --- |
| DA-M01 | Android telefon 320/360 dp; açık/koyu | Login ve validasyon, reset; klavye açık | Bütün alan/mesaj/eylemler erişilir; overflow yok; odak alanı görünür. Ekran görüntüsü+cihaz bilgisi. |
| DA-M02 | iPhone küçük ekran; VoiceOver; %200 metin | Login → şifre görünürlüğü → hatırlama → reset | Ad/rol/state anlaşılır; etikete dokunma çalışır; reset adımı klavyeyle örtülmez. Anons notları. |
| DA-M03 | Android TalkBack; açık/koyu | Beş ana sekme, QR seçimi | Beş ayrı ad, seçili durum; QR adı; anlamlı odak sırası. Semantics ağacı+anons. |
| DA-M04 | Android/iPad harici klavye | Tab, Shift+Tab, Enter/Space; profil tema diyaloğu aç/kapat | Görünür odak, bütün hedeflere erişim, diyalog kapanınca anlamlı odak dönüşü; odak tuzağı yok. |
| DA-M05 | Telefon, landscape; 600/1024 dp tablet/split view | Reset ve QR loading/error/valid/expired | Açıklama/yenileme görünür, içerik sığar veya kaydırılır; kamera çerçevesi yerel gövde içinde. |
| DA-M06 | Telefon+tablet; %100/%130/%200; TR/EN | Katılım none/inside/out, çok ek hareket, uzun kapı adı | Saat/hareket sayısı/eylem okunur; hızlı işlemler uygun sütuna geçer; kritik adın tamamına erişilir. |
| DA-M07 | Yetkili test hesabı; gecikmeli/kapalı ağ | Home ilk yükleme, hata, eski veri, retry | Bilinmeyen durum “Henüz Yok” gibi sunulmaz; stale uyarısı ve retry; başarıda toparlanma. Gerçek ağ ile mock ayrı kaydedilir. |
| DA-M08 | Sentetik boş/geçerli kayıtlar | Geçmiş sıfır kayıt, filtreli boşluk ve kısa liste üzerinde yenile | Drag ve açık eylem çağrıyı tetikler, biter, yeni kayıt görünür; filtre korunur/temizlenebilir. |
| DA-M09 | İki platform, iki tema | Başarı/warning snackbar, login başlık, shell seçili sekme | Render üzerindeki renk çiftleri eşiklere uyar; anlam metinle korunur. Kontrast ölçümü+render. |
| DA-M10 | Yetkili fiziksel okuyucu/kapı test düzeneği | QR üretim/yenileme/tarama, tercihli cihaz hızlı işlem | Token ve kayıt sonucu ile fiziksel okuyucu/kapı sonucu ayrı kaydedilir; “granted” fiziksel açıldı diye varsayılmaz. |
| DA-M11 | TalkBack/VoiceOver | Yükleme, hata, retry, süresi dolmuş QR, cihaz seçimi | Durum değişimi anlaşılır ve tekrarlı anons yağmuru yok; seçim yalnız renk/ikonla kalmaz. |
| DA-M12 | Sistem tema ayarı; uygulama yeniden açılışı; azaltılmış hareket | Kayıtlı tema, sistem tema değişimi, splash | Tercih davranışı ve olası açılış tema geçişi gözlenir; splash hareketinin platform azaltılmış hareket ayarıyla davranışı kaydedilir. Bu konuda kaynak taraması tek başına uyumsuzluk ilan etmedi. |

## 6. Açık sorular ve inceleme sınırı

1. Desteklenen en küçük mantıksal ekran, tablet/split view ve büyük yazı seviyesi ürünce nedir? %200 burada önerilen kabul hedefidir; mevcut cihaz desteği beyanı değildir.
2. Koyu tema marka renginin metin/odak kullanımında hangi alternatifler kabul edilir? Seed ColorScheme ile eski bordo sabitlerin hangi rolü koruması isteniyor?
3. QR için fiziksel okuyucularda kabul edilen minimum boyut ve tarama mesafesi nedir? QR küçültme kararı cihaz ölçümü gerektirir.
4. “Kapıyı Aç” yalnız self check-in/erişim kaydı mı, fiziksel açma mı vaat ediyor? İncelenen zincirde fiziksel komut yok; ürün ifadesi ve entegrasyon sahibi birlikte netleştirmeli. Bu modül yeni cihaz komutu geliştirme kararı vermez.
5. İlk yükleme/eski veri durumunda katılım ve hızlı işlem eylemleri etkin kalmalı mı? Kullanıcıya yanlış kesinlik vermeden ağ hata/erişim reddi ayrımı nasıl anlatılacak?
6. StatCard ve ProgressHeroCard için aktif ürün kullanım planı var mı? Yoksa bunlara yönelik genişletme işi düşük öncelikli tutulmalı; mevcut kullanıcı hatası gibi raporlanmamalı.
7. SectionHeader başlık hiyerarşisi, QuickActionCard rolü, standart diyalog odak geri dönüşü, cihaz seçiminin selected anonsu ve splash azaltılmış hareket davranışı gerçek platform semantics/render incelemesi bekliyor. Kaynakta özel sarmalayıcı yok diye bunların tamamı bozuk ilan edilmedi.

Kaynak bulgularının doğruluğu için dosya/satır zincirleri verilmiştir; üretimde kaç kullanıcının etkilendiği, fiziksel cihaz davranışı, tüm uygulamanın WCAG uyumu ve mağaza/release davranışı bu incelemeyle kanıtlanamaz. Flutter erişilebilirlik rehberi de manuel ekran okuyucu ve kullanıcı arayüzü doğrulaması için birincil başvuru kaynağıdır: [Flutter Accessibility](https://docs.flutter.dev/ui/accessibility).
