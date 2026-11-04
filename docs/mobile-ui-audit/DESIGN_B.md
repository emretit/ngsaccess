# NGS Plus mobil — Yön B uygulama sözleşmesi

**Karar:** Emre, 4 Kasım 2026: **B — Marka bandı**. Bu belge D1–D4 için otoriter tasarım sözleşmesidir; önceki audit ve HTML örnekleriyle çelişirse buradaki üretim ölçüleri geçerlidir. Mobil kod bu çalışma sırasında değiştirilmedi.

**İçerik:** 1 Renk ve tema · 2 Tipografi · 3 Ölçüler/kabuk · 4 Bileşen API’leri · 5 Ekranlar ve durumlar · 6 TR/EN metinleri · 7 Korunacak davranışlar/test anahtarları · 8 Dalgalar, dosya sahipliği ve kabul.

## Kararın sınırları

- Tek akılda kalan öğe Ana Sayfa’daki bordo bant ve banda 32dp binen Bugün kartıdır; açık temada kart beyaz, koyuda `surface` olur. Geri kalan yüzeyler nötrdür.
- Bordo bant yalnız **Ana Sayfa, Giriş, Açılış** ekranlarında kullanılır. Diğer başlıklar canvas üzerinde text rengindedir. Girişte ayrıca form kartı/gölgesi yoktur.
- Görünür sayfa veya modal katmanda en fazla bir dolu bordo birincil eylem vardır. Seçim ve odak accent metin/ikon + nötr zemin kullanır; marka pembesi container yoktur. Durum renk çiftleri yalnız anlam taşıyan rozet/uyarı içindir.
- Gölge yalnız banda binen Bugün kartı ve QR panelinde `0 3px 9px #25252308`; Flutter `BoxShadow(color: Color(0x08252523), offset: Offset(0,3), blurRadius:9, spreadRadius:0)`. Diğer içerikler elevation 0 + 1dp çizgi. Sheet/diyalog M3 varsayılan elevation/scrim; yüzey tint’i transparan.
- Sistem fontu, cümle düzeni, ünlemsiz başlık, emojisiz metin. Butona ok karakteri eklenmez. Üst başlık etiketlerinde tümü büyük harf kullanılmaz. Kullanıcıya sunucu/UTC/senkronizasyon/“yüklenen kayıtlardan” dili gösterilmez.
- Eylem adı sonuçta korunur: “İzin talebi gönder” → “İzin talebi gönderildi”. Belirsiz sonuç başarı olarak gösterilmez.
- Saatler Türkiye saatindedir. Tek biçimleyici: “Bugün 13:20”, “Dün 18:07”, “4 Kas Çar”, “9–11 Kas”, başlıkta “4 Kasım Çarşamba”. Saat dilimi açıklaması yalnız düzeltme formunun saat alanı yardımında görünür.
- Bantlı ekranlarda `SystemUiOverlayStyle.light`; nötr açık ekranlarda `.dark`, nötr **koyu** ekranlarda `.light` kullanılır. Koyu canvas üzerine koyu durum çubuğu ikonu konmaz; “diğerlerinde koyu” kuralının erişilebilir koyu tema karşılığı budur. Gerçek OS status/home indicator alanı çizilmez, platform inset’i kullanılır.

## 1. Renk token’ları ve Flutter tema eşlemesi

### 1.1 Semantik token tablosu

Oranlar sRGB luminance hesabıdır: `c≤0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`; `L=0.2126R+0.7152G+0.0722B`; `(Lmax+0.05)/(Lmin+0.05)`. Aşağıdaki oranlar yerel Python ile hesaplandı. Metin ≥4,5:1, gerekli kontrol sınırı ≥3:1; dekoratif line için 3:1 aranmaz. “Karşı” sütunu oranın diğer rengini belirtir; arka planın tek başına kontrastı yoktur.

| Token | Açık | Koyu | Karşı | Açık / koyu oran | Flutter kaynağı |
|---|---|---|---|---|---|
| canvas | `#f7f7f5` | `#181817` | text | 14.32 / 15.98 | Tokens.canvas → scaffoldBackgroundColor |
| surface | `#ffffff` | `#20201e` | text | 15.36 / 14.68 | ColorScheme.surface |
| subtle | `#f3f3f2` | `#2a2a27` | text | 13.83 / 12.95 | Tokens.subtle (ColorScheme’den bağımsız) |
| line | `#e2e2e0` | `#3c3c37` | surface | 1.30 / 1.47 | outlineVariant; dekoratif |
| control | `#858582` | `#9a9a93` | surface | 3.70 / 5.76 | outline; input/ikincil buton sınırı |
| text | `#252523` | `#f3f3f0` | canvas | 14.32 / 15.98 | onSurface |
| muted | `#646461` | `#b8b8b2` | surface | 5.94 / 8.19 | onSurfaceVariant |
| primary | `#7a1f1f` | `#7a1f1f` | onPrimary | 10.28 / 10.28 | primary; yalnız dolgu |
| onPrimary | `#ffffff` | `#ffffff` | primary | 10.28 / 10.28 | onPrimary |
| accent | `#7a1f1f` | `#e7b3ad` | surface | 10.28 / 8.90 | Tokens.accent; metin/ikon/seçim |
| selected-bg | `#f3f3f2` | `#2a2a27` | accent | 9.26 / 7.85 | Tokens.selectedBackground; nötr |
| band-bg | `#7a1f1f` | `#7a1f1f` | onBand | 10.28 / 10.28 | Tokens.bandBackground |
| onBand | `#ffffff` | `#ffffff` | band-bg | 10.28 / 10.28 | Tokens.onBand |
| onBandMuted | `#f1dcd8` | `#f1dcd8` | band-bg | 7.82 / 7.82 | Tokens.onBandMuted |
| avatarBg | `#551919` | `#551919` | onBand | 13.64 / 13.64 | Tokens.bandAvatarBackground |
| success fg / bg | `#356047 / #edf4ef` | `#bbdcc6 / #21362a` | bg #edf4ef / #21362a | 6.44 / 8.71 | Tokens.success.foreground/background |
| warning fg / bg | `#795619 / #faf3e5` | `#eacd97 / #3d321d` | bg #faf3e5 / #3d321d | 6.02 / 8.18 | Tokens.warning.foreground/background |
| danger fg / bg | `#963e36 / #faefed` | `#f0bbb5 / #422927` | bg #faefed / #422927 | 6.13 / 7.91 | Tokens.danger; error / errorContainer |
| info fg / bg | `#3b5c76 / #edf2f7` | `#b7d3e8 / #253440` | bg #edf2f7 / #253440 | 6.26 / 8.21 | Tokens.info.foreground/background |
| focus | `#7a1f1f` | `#e7b3ad` | canvas | 9.58 / 9.69 | Tokens.focus; 2dp + 3dp offset |
| focusOnBand | `#ffffff` | `#ffffff` | band-bg | 10.28 / 10.28 | Tokens.focusOnBand |
| disabled fg / bg | `#777774 / #eeeeeb` | `#a4a49f / #2a2a27` | bg #eeeeeb / #2a2a27 | 3.86 / 5.75 | Tokens.disabledForeground/disabledBackground; yalnız devre dışı |

Koyu primary dolgusunun surface ile sınırı yeterince görünür değildir; tüm primary butonlara koyuda 1dp accent kontur zorunludur. Primary metin rengi olarak kullanılmaz: koyu TextButton/sekme/link/focus `Tokens.accent` kullanır. Kontur ve seçili işaret, disabled dışında opaklığın rastgele düşürülmesiyle üretilmez.

### 1.2 ColorScheme — eksiksiz elle kurulum

`ColorScheme.fromSeed`, `ColorScheme.light/dark` varsayılanları ve seed sonrası kısmi `copyWith` **kullanılmaz**. `ColorScheme(brightness: ..., ...)` aşağıdaki bütün güncel alanları açıkça alır; aynı satırda birden çok alan varsa her biri ayrı named argümanla atanır. Yerel SDK constructor’ı ve `mobile/pubspec.yaml:7` alt sürüm sözleşmesi esas alınır. Hexler opak `Color(0xFF...)`; transparan yalnız açıkça belirtilen roldedir.

| ColorScheme rolü | Açık | Koyu |
|---|---|---|
| brightness | Brightness.light | Brightness.dark |
| primary / onPrimary | #7a1f1f / #ffffff | #7a1f1f / #ffffff |
| primaryContainer / onPrimaryContainer | #f3f3f2 / #7a1f1f | #2a2a27 / #e7b3ad |
| primaryFixed / primaryFixedDim | #f3f3f2 / #e2e2e0 | #f3f3f2 / #e2e2e0 |
| onPrimaryFixed / onPrimaryFixedVariant | #7a1f1f / #646461 | #7a1f1f / #646461 |
| secondary / onSecondary | #646461 / #ffffff | #b8b8b2 / #20201e |
| secondaryContainer / onSecondaryContainer | #f3f3f2 / #252523 | #2a2a27 / #f3f3f0 |
| secondaryFixed / secondaryFixedDim | #f3f3f2 / #e2e2e0 | #f3f3f2 / #e2e2e0 |
| onSecondaryFixed / onSecondaryFixedVariant | #252523 / #646461 | #252523 / #646461 |
| tertiary / onTertiary | #646461 / #ffffff | #b8b8b2 / #20201e |
| tertiaryContainer / onTertiaryContainer | #f3f3f2 / #252523 | #2a2a27 / #f3f3f0 |
| tertiaryFixed / tertiaryFixedDim | #f3f3f2 / #e2e2e0 | #f3f3f2 / #e2e2e0 |
| onTertiaryFixed / onTertiaryFixedVariant | #252523 / #646461 | #252523 / #646461 |
| error / onError | #963e36 / #ffffff | #f0bbb5 / #422927 |
| errorContainer / onErrorContainer | #faefed / #963e36 | #422927 / #f0bbb5 |
| surface / onSurface | #ffffff / #252523 | #20201e / #f3f3f0 |
| surfaceDim / surfaceBright | #e8e8e5 / #ffffff | #181817 / #353531 |
| surfaceContainerLowest | #ffffff | #141413 |
| surfaceContainerLow | #fafaf8 | #20201e |
| surfaceContainer | #f3f3f2 | #262624 |
| surfaceContainerHigh | #eeeeeb | #2d2d2a |
| surfaceContainerHighest | #e8e8e5 | #353531 |
| onSurfaceVariant | #646461 | #b8b8b2 |
| outline / outlineVariant | #858582 / #e2e2e0 | #9a9a93 / #3c3c37 |
| inverseSurface / onInverseSurface | #252523 / #f3f3f0 | #f3f3f0 / #252523 |
| inversePrimary | #e7b3ad | #7a1f1f |
| shadow / scrim | #000000 / #000000 | #000000 / #000000 |
| surfaceTint | transparent #00000000 | transparent #00000000 |

Deprecated `background`, `onBackground`, `surfaceVariant` constructor argümanları geçilmez; kod tüketimleri sırasıyla `Tokens.canvas`, `onSurface`, `surfaceContainerHighest` ile değiştirilir. Bütün **güncel** roller üstte tanımlıdır; fixed rolleri tema değişiminde sabit kalır. `subtle` koyu #2a2a27’dir; `surfaceContainer` koyu #262624’ten bilerek ayrıdır, koyu container ailesi nötr ara basamaklarıdır.

### 1.3 ThemeData sözleşmesi

- `useMaterial3:true`, fontFamily **verilmez**; 1.2 şeması, 2. bölümün tüm `TextTheme` stilleri ve `AppUiTokens` extension kaydedilir. `AppTheme.lightTheme/darkTheme` adları korunur. `AppStatusTone` ve `AppStatusColors` ui token dosyasına taşınır, `app_theme.dart` bunları yeniden export eder; mevcut importlar kırılmaz. `AppTheme.statusColors/statusColorsFor` token çiftlerine delegasyon yapar.
- `AppTheme` uyumluluk sabitleri: primaryBurgundy/primaryBurgundy2/primaryColor → #7a1f1f; tabBarBackground/surfaceVariantLight → #f3f3f2; inactiveGray → #646461; darkBackground → #181817; darkSurface → #20201e; surfaceVariantDark → #2a2a27. Statik success/warning/danger/info → açık fg çiftleri; koyu metinde kullanım yasak, D2/D3 token erişimine taşır.
- AppBar: canvas/text, elevation/scrolledUnderElevation 0, surfaceTint transparan, başlık 26/32 w600, `centerTitle:false`; sistem ikon stili parlaklığa göre. Bant kendi `AnnotatedRegion<SystemUiOverlayStyle>` alanını kapsar; tam ekran kabuğun brandedSystemBar modu status inset arkasını sabit bordo tutar.
- Card: surface, radius16, 1dp line, margin0, elevation0, tint transparan. Gölge yalnız `AppSurface`’ın iki özel varyantında BoxShadow ile; M3 elevation ile ikinci gölge eklenmez.
- Filled/Elevated: primary/onPrimary, min52, radius12, elevation0; koyu accent kontur. Outlined: surface/text/control. Text/IconButton: accent, min48; icon24. Disabled token’ları ortak. D1 eski ElevatedButton tüketimlerini de tema ile düzeltir.
- InputDecoration: surface dolgu, 1dp control, radius12, 16 yatay/14 dikey padding, label bodySmall; focus2dp focus, error1dp danger (focus+error2dp). Hint muted; error metni alan altında sarılır. OutlineInputBorder her durumda aynı radius.
- TabBar/SegmentedButton/Chip/Radio/Checkbox/Switch/NavigationBar seçimi: nötr selected-bg + accent ikon/yazı; seçilme yalnız renk değildir (çizgi/check/radio işareti). Varsayılan primary renkli dolguya bırakılmaz. Checkbox/radio işaretli sınır ve check accent, nötr dolgu; switch thumb accent, track subtle/control.
- DatePicker/DateRangePicker/TimePicker: surface/text; seçili gün/saat selected-bg+accent; range highlight subtle; today focus konturu; başlık nötr. Saatler daima 24 saat. Modal onay butonları TextButton accent, ikinci dolu primary yaratmaz.
- NavigationBar: surface, elevation0, tint transparan, 1dp üst line, 5 eşit hedef; ayrıntılı büyütme algoritması §4.21. BottomSheet/Dialog: surface/text, tint transparan, M3 modal elevation/scrim, sheet radius20 üst, dialog16; kullanıcı formunu örten arka plan etkileşimi kapalı.
- SnackBar: inverseSurface/onInverseSurface, eylem inversePrimary, floating; hata ham nesne değil yerel metin. Tooltip aynı inverse çift, metin13. Divider line/1dp. Progress accent/subtle; spinner normal/busy için en fazla tek anlamlı semantics düğümü. Selection handle accent; metin seçimi nötr selected-bg.
- Hover: nötr kontrol üzerinde text alpha0.04 state layer; pressed alpha0.08; focus çizgisi ayrı. Primary üstünde beyaz hover0.04/pressed0.08; bant üstünde onBand. Animasyon 120ms `easeOut`, `MediaQuery.disableAnimations` ise Duration.zero. Ripple dışında glow/blur/gradyan yok.

## 2. Tipografi

`TextTheme` bütün alanları açıkça tanımlar. Tablo satır yüksekliği **sp tabanlı line box**, Dart `height = satır / fontSize`; metin ölçeği Flutter tarafından uygulanır. Font ailesi null; harf aralığı 0, sayfa başlıklarında -0,5sp olabilir, metinlerde keyfi tracking yoktur.

| Stil | Boyut sp | Satır sp | FontWeight | Kullanım |
|---|---:|---:|---|---|
| displayLarge | 32 | 40 | w600 | Gerekirse tek büyük metrik; varsayılan ekranlarda yok |
| displayMedium | 30 | 38 | w600 | Rezerve |
| displaySmall | 28 | 36 | w600 | Rezerve |
| headlineLarge | 28 | 36 | w600 | Açılış kimliği |
| headlineMedium | 26 | 32 | w600 | Sayfa/bant başlığı |
| headlineSmall | 24 | 30 | w600 | Saat metrikleri |
| titleLarge | 20 | 26 | w600 | Sheet/diyalog başlığı |
| titleMedium | 18 | 24 | w600 | Bugün/bölüm başlığı |
| titleSmall | 16 | 22 | w600 | Liste başlığı |
| bodyLarge | 16 | 24 | w400 | Form girişi |
| bodyMedium | 15 | 22 | w400 | Açıklama/metin |
| bodySmall | 13 | 18 | w400 | Yardım/ikincil bilgi |
| labelLarge | 16 | 22 | w600 | Buton |
| labelMedium | 13 | 18 | w600 | Rozet/segment |
| labelSmall | 12 | 16 | w500 | Alt gezinme |

Saat/sayı stili: `headlineSmall.copyWith(fontFeatures: const [FontFeature.tabularFigures()])`; geçmiş saat sütunu `titleSmall` aynı font özelliğiyle. Ekran başına 3–4 **baskın** boyut (26 başlık, 18 bölüm, 15–16 içerik, 13 yardım); nav12 sistem katmanıdır. Form hata/yardım metni 13sp altına inmez. HTML’deki 25px home başlığı ve 48px kompakt kayıt satırı üretimde 26sp ve min64dp olarak normalize edilir; sekiz kaydın aynı ekrana sığması zorunlu değildir, kaydırma doğaldır.

## 3. Ölçüler ve kabuk

| Ölçü | Değer / kesin kural |
|---|---|
| AppSpacing | Mevcut xs4 / sm8 / md12 / lg16 / xl24 / xxl32 korunur; `pageInset=20` eklenir; formMaxWidth480/contentMaxWidth720 korunur (`lib/core/spacing.dart:8`) |
| Sayfa kenarı | 20dp; tablet içerik ortada max720, form480; bant zemini tam genişlik |
| Bölüm / ilişkili alan | 24dp / 12–16dp; label–alan8; ikon–metin12 |
| Radius | Rozet4, input/buton12, grup/kart16, QR16, sheet üst20, avatar daire |
| Dokunma | Her etkin hedef min48×48dp; `MaterialTapTargetSize.padded`, density standard |
| Buton | min52dp, yatay16/dikey14; metin sararsa büyür, sabit height yok |
| Input | min56dp, yardımcı/hata bu boyuta dahil değil; alanlar arası16 |
| Liste satırı | min64dp; dikey12/yatay16; tarih/saat sütunu56dp (ölçekte büyür) |
| Navigasyon | Taban64dp + üst1dp çizgi + yalnız bir kez sistem bottom inset; >1,3 ölçek için ölçülen etiket yüksekliğiyle büyür; maxWidth560 ve ortalı, yüzey/çizgi tam genişlik |
| Bant | OS top inset + 48dp marka satırı + 16dp boşluk + başlık32sp satır + 8dp + kurum18sp + 4dp + tarih18sp + 24dp alt nefes; boş kurum/tarih slotu kaldırılır |
| Banda binme | Home kartının ilk32dp’sinin arkası bordo; kart kenarı20, iç padding20; yükseklik içeriğe göre |
| QR | Beyaz panel, radius16, iç padding24; kod ideal224dp, mevcut alana göre min176/max256; kaydırma altında küçültme yerine tercih edilir, quiet zone korunur |
| Sheet/diyalog | Sheet maxWidth640, maxHeight kullanılabilir yüksekliğin0,90’ı; içerik kayar; başlık/eylem görünür; dialog maxWidth480, inset20 |
| Focus | 2dp opak focus + 3dp dış boşluk; clip ile kesilmez; bant üstünde beyaz |

**Inset sahibi:** `MainNavigationShell` dış Scaffold `extendBody:false`, `resizeToAvoidBottomInset:true`; body’de bottom SafeArea eklenmez, nav kendi bottom inset’ini tüketir. Klavye açıkken nav mevcut davranıştaki gibi gizlenir (`lib/screens/main_navigation_shell.dart:109`). BranchVisibility, indexedStack ve görünürlük/lifecycle callback’leri korunur. Sekme ekranı top inset’i kendi header’ında tüketir; normal `AppPageHeader` üst SafeArea, bant `AppBrandBand` üst SafeArea; ikisi aynı anda kullanılmaz.

Formlarda `AppScaffold` body’si `Column(Expanded(scrollableForm), AppFormActionBar)` biçimindedir; Scaffold klavyeyle body’yi küçültür, eylem çubuğu klavyenin **üstünde** kalır. Çubuğa ayrıca `viewInsets.bottom` eklenmez. Sheet’te tek keyboard inset sahibi `showAppSheet` wrapper’ıdır; iç form ve action bar tekrar inset eklemez. Form footer normalde SafeArea(bottom:true, top:false), klavye açıkken alt padding0; `viewPadding` ile ikinci kez34 eklenmez.

1,3 ve 2,0 ölçekte metin küçültülmez/ellipsis yapılmaz; yüksekliği büyür, Row yeterli değilse Column/Wrap olur. Ekran ana gövdesi kaydırılabilir kalır, footer hariç tüm bilgiye ulaşılır. Yeniden boyutlandırma domain state’i veya TextEditingController’ları sıfırlamaz.

## 4. Bileşen kiti — public Dart API

**26 public sözleşme**: 23 widget + `AppUiTokens` + `showAppSheet` + `AppDateFormat`; alt veri tipleri bu sayıya dahil değildir. Her ana sözleşme ayrı snake_case dosyasında `lib/widgets/ui/`; yalnız `AppDateFormat`, `lib/core/app_date_format.dart` içindedir. `showAppSheet` ve `AppSheet` ayrı dosyadır. Mevcut `lib/widgets/app_bottom_navigation.dart` yalnız yeni sınıfı export eder; iki ayrı AppBottomNavigation sınıfı olmaz. İmzalar public API bildirimi olup gövdelerin uygulama tarifi aşağıdadır. Tüm `Key? key` argümanları normal Widget key’idir.

### Ortak durum protokolü

- **N/P/D/B/F:** normal / pressed / disabled / busy / keyboard focus. **E** etkileşimli protokol: N token görünümü; P §1.3 state layer; D callback null, disabled renk + semantics enabled:false; B kendi busy durumunda tekrar callback yok, mevcut genişlik korunur, etiket+spinner, tek liveRegion; F 2+3dp focus. Buton/segment/picker eylem callback’i null veya busy → devre dışı; bir API’de busy parametresi yoksa B, sahibi tarafından `enabled:false`/eylem callback’i null ile sağlanır. AppTextField.onChanged isteğe bağlı bildirimdir; null olması alanı kapatmaz, alanı enabled yönetir.
- **S** statik protokol: N metin/yüzey; P/D/B/F etkileşimi yok, sahte button semantics yok. İçindeki gerçek eylem E’yi uygular. Veri yoksa disabled rengiyle boş bilgi taklidi yapılmaz; explicit empty/loading/error kullanılır.
- Dolu primary tek olma kuralını ekran sahibi uygular; kit global sayaç tutmaz. UI callback’i tek defa çağırır; domain idempotency repository/provider’da kalır. Kit ağ/Provider okuması yapmaz.
- ActionLabel/semanticLabel/errorText dışarıdan **yerelleştirilmiş güvenli String** alır. Hiçbir public API hata nesnesinin `.toString()` çıktısını otomatik çizmez. Metin/error state değişikliği liveRegion olabilir; her build veya her saniye yeniden anons yok.

### 4.1 AppUiTokens — app_ui_tokens.dart

Tema eşlemesindeki standart roller ColorScheme’den; aşağıdaki ürün alanları extension’dan okunur. `AppStatusTone { success, warning, danger, info }` ve immutable `AppStatusColors` burada tanımlanır; eski app_theme export’u korunur.

```dart
const AppStatusColors({required Color foreground, required Color background});
AppStatusColors copyWith({Color? foreground, Color? background});
static AppStatusColors lerp(AppStatusColors a, AppStatusColors b, double t);

const AppUiTokens({
  required Color canvas, required Color subtle, required Color accent,
  required Color selectedBackground, required Color bandBackground,
  required Color onBand, required Color onBandMuted,
  required Color bandAvatarBackground, required Color focus,
  required Color focusOnBand, required Color disabledForeground,
  required Color disabledBackground, required AppStatusColors success,
  required AppStatusColors warning, required AppStatusColors danger,
  required AppStatusColors info,
  double pageInset = 20, double badgeRadius = 4,
  double controlRadius = 12, double groupRadius = 16,
  double qrRadius = 16, double sheetRadius = 20,
  double minTapExtent = 48, double buttonMinHeight = 52,
  double rowMinHeight = 64, double navigationMinHeight = 64,
  double brandOverlap = 32,
});
static AppUiTokens of(BuildContext context);
AppStatusColors status(AppStatusTone tone);
@override AppUiTokens copyWith({
  Color? canvas, Color? subtle, Color? accent, Color? selectedBackground,
  Color? bandBackground, Color? onBand, Color? onBandMuted,
  Color? bandAvatarBackground, Color? focus, Color? focusOnBand,
  Color? disabledForeground, Color? disabledBackground,
  AppStatusColors? success, AppStatusColors? warning,
  AppStatusColors? danger, AppStatusColors? info,
  double? pageInset, double? badgeRadius, double? controlRadius,
  double? groupRadius, double? qrRadius, double? sheetRadius,
  double? minTapExtent, double? buttonMinHeight, double? rowMinHeight,
  double? navigationMinHeight, double? brandOverlap,
});
@override AppUiTokens lerp(covariant AppUiTokens? other, double t);
```

Sınıf `ThemeExtension<AppUiTokens>` extends eder; final alanlar constructor ile birebir eşleşir. copyWith null alanı korur; lerp null other → this, renkler `Color.lerp`, sayılar `lerpDouble`, dört durum çifti field-by-field interpolate edilir. `of` extension yoksa debug assert/StateError verir; sessiz light fallback yok. N/P/D/B/F ve semantics bu veri sınıfına uygulanmaz.

### 4.2 AppBrandBand — app_brand_band.dart

```dart
const AppBrandBand({
  Key? key, required String title, String? subtitle, String? dateLabel,
  String brandLabel = 'NGS Plus', Widget? trailing,
  Widget? overlapChild, bool consumeTopInset = true,
});
```

Yalnız üç izinli ekranın kimlik alanı. Title headlineMedium, subtitle/date bodySmall, marka titleMedium. `overlapChild` yalnız home Bugün panelidir. Ölçülen başlığın altına normal akışta bir Stack gelir: **yalnız arka plan** `Positioned(top:0,height:32,left:0,right:0)` bordo; ön planda yatay20 padding ile doğal yüksekliğinde overlapChild. Böylece karta negatif offset/sabit height gerekmez; metin büyürken kart yine ilk32dp bordo üstünde kalır. Bant child’ı tekrar SafeArea eklemez.

### 4.3 AppPageHeader — app_page_header.dart

```dart
const AppPageHeader({
  Key? key, required String title, String? subtitle,
  bool showBack = false, VoidCallback? onBack,
  List<Widget> actions = const <Widget>[], bool consumeTopInset = true,
});
```

Canvas üzerinde başlık. Geri48, action48; en fazla iki küçük eylem. onBack yok ve showBack true ise `Navigator.maybePop`; title semantic header. Büyük metinde actions başlığın altına ayrı satır; metin üzerinden absolute overlay yok.

### 4.4 AppStatusBadge — app_status_badge.dart

```dart
const AppStatusBadge({
  Key? key, required String label, required AppStatusTone tone,
  IconData? icon, String? semanticLabel,
});
```

Tone’dan fg/bg birlikte alınır; 4dp radius, padding8×4, labelMedium, ikon16. İkon verilmezse success check, warning schedule, danger error_outline, info info_outline. Rozet button değildir; seçilme/filtreleme işi bu bileşene yüklenmez.

### 4.5 AppListGroup — app_list_group.dart

```dart
const AppListGroup({
  Key? key, String? title, String? subtitle,
  required List<Widget> children, bool showDividers = true,
});
```

Tek surface/line/radius16 içinde ilişkili satırlar; title dışarıda titleMedium. `children` yalnız küçük gruplar içindir. Geçmiş/ziyaretçi gibi sınırsız listede bu widget’a bütün kayıtlar yığılmaz; ekran sliver/builder kullanır, aynı yüzey kurallarıyla günü parçalar.

### 4.6 AppListRow — app_list_row.dart

```dart
const AppListRow({
  Key? key, required String title, String? subtitle, String? leadingText,
  IconData? leadingIcon, Widget? trailing, VoidCallback? onTap,
  bool enabled = true, bool selected = false, bool showChevron = false,
  AppStatusTone? tone, String? semanticLabel,
});
```

Min64, `leadingText` tabular saat sütunu; saat ve ikon birlikte olabilir. `showChevron:true` yalnız onTap varsa. `trailing` pasif rozet/metindir; ikinci tıklanabilir kontrol gerekiyorsa ayrı satır/ayrı semantics kullanılır, row onTap ile iç buton çakıştırılmaz. `tone` yalnız başlık/ikon anlamını renklendirir, tüm satırı boyamaz. onTap:null olan bilgi satırı S protokolündedir, normal text/muted renklerini korur; bu satır sırf callback yok diye devre dışı renge boyanmaz. onTap verilmiş ve enabled:false ise E/disabled uygulanır.

### 4.7 AppEmptyState — app_empty_state.dart

```dart
const AppEmptyState({
  Key? key, required String title, required String message,
  IconData icon = Icons.inbox_outlined, String? actionLabel,
  VoidCallback? onAction, bool actionIsPrimary = false,
});
```

Başlık, sebep ve en fazla bir sonraki adım. Action label/callback birlikte verilir. Varsayılan secondary; sayfada zaten primary varsa ikinci dolu buton oluşturmaz. Min dikey dolgu24; ekran yüksekliğini sabit kaplamaz.

### 4.8 AppDataNotice — app_data_notice.dart

```dart
const AppDataNotice({
  Key? key, required String message,
  AppStatusTone tone = AppStatusTone.info, String? title,
  String? actionLabel, VoidCallback? onAction,
  bool busy = false, bool liveRegion = true,
});
```

Yerel hata/çevrimdışı/eski veri bilgisi. Tone yüzey çifti + ikon + mesaj; action secondary/text, min48. Busy mesajı saklamaz. Cache yokken “Önceki kayıtlar” denmez; caller iki gerçek durumu ayrı mesajlar.

### 4.9 AppSkeleton — app_skeleton.dart

```dart
enum AppSkeletonKind { list, attendance, form, qr, metrics }
const AppSkeleton({
  Key? key, required String semanticLabel,
  AppSkeletonKind kind = AppSkeletonKind.list, int itemCount = 3,
});
```

Statik subtle bloklar; shimmer yok. Boyutlar gerçek bileşenlere yakın, list satırı64, alan56, QR224, attendance min156. Tek liveRegion label, dekoratif bloklar ExcludeSemantics. İlk yükleme için; önceden veri varken tüm listeyi iskeletle değiştirmez.

### 4.10 AppPrimaryButton — app_primary_button.dart

```dart
const AppPrimaryButton({
  Key? key, required String label, required VoidCallback? onPressed,
  IconData? icon, bool busy = false, String? busyLabel,
  bool expanded = true, FocusNode? focusNode, String? semanticLabel,
});
```

FilledButton tabanı; min52, radius12. Busy label yoksa label korunur; spinner20+8 aralık. FocusNode caller-owned. Aynı kullanıcı eylemi tetiklenirken buton kaldırılmaz veya boş spinner’a dönüşmez.

### 4.11 AppSecondaryButton — app_secondary_button.dart

```dart
const AppSecondaryButton({
  Key? key, required String label, required VoidCallback? onPressed,
  IconData? icon, bool busy = false, String? busyLabel,
  bool expanded = false, bool destructive = false,
  FocusNode? focusNode, String? semanticLabel,
});
```

OutlinedButton surface/text/control; destructive ise danger metin+ikon ve control sınır, dolu kırmızı yok. Min52; expanded form/footer’da true. Busy/keyboard politikası primary ile aynı.

### 4.12 AppFormActionBar — app_form_action_bar.dart

```dart
const AppFormActionBar({
  Key? key, required Widget primaryAction,
  Widget? secondaryAction, String? supportingText,
});
```

Surface + üstline, padding20 yatay/12 dikey; action’lar AppPrimary/Secondary, en fazla birer adet. `AppScaffold.bottomBar` slotuna konur; viewInsets eklemez. 1,3’te sığarsa yan yana, 2,0 veya ölçülen toplam genişlik aşımında iki tam genişlik satır (primary altta). Supporting text bodySmall, hata için ayrıca AppDataNotice. Scroll alanı footer yüksekliğini gerçekten ayırır; Stack overlay/fab değil.

### 4.13 showAppSheet — show_app_sheet.dart

```dart
Future<T?> showAppSheet<T>({
  required BuildContext context, required WidgetBuilder builder,
  bool isDismissible = true, bool enableDrag = true,
  bool useRootNavigator = true, RouteSettings? routeSettings,
});
```

`showModalBottomSheet<T>(isScrollControlled:true,useSafeArea:true,...)`; maxWidth640, maxHeight0,90 × keyboard/topInset sonrası kullanılabilir alan. Wrapper alt keyboard padding’ini **bir kez** uygular. builder `AppSheet` döndürür; wrapper route focus scope’u kurar, açılış odağı başlık/ilk kontrole, kapanış odağı tetikleyiciye. Busy sırasında kapanması engellenen akış caller tarafından `isDismissible:false,enableDrag:false` ve `PopScope` ile açılır; sadece close düğmesini kapatmak yeterli değildir. Modal barrier label MaterialLocalizations’tan.

### 4.14 AppSheet — app_sheet.dart

```dart
const AppSheet({
  Key? key, required String title, required Widget body,
  Widget? actionBar, bool busy = false, VoidCallback? onClose,
  bool showClose = true, bool bodyOwnsScroll = false,
});
```

20 üst radius; drag handle32×4 dekoratif; title titleLarge +48 close; Flexible/SingleChildScrollView gövde + actionBar. Varsayılan bodyOwnsScroll:false iken scroll sahibi **AppSheet**’tir: caller Column verir, kit SingleChildScrollView ile sarar. Büyük liste/filtrede bodyOwnsScroll:true verilir; body bir lazy ListView/CustomScrollView olur, kit yalnız Flexible ile sınırlar ve ikinci scroll eklemez. Callback onClose null ise Navigator.maybePop kullanılır; busy ise çalışmaz. Busy close/back kapalı olduğunda sebep status olarak okunur; dış dismiss ayarı §4.13 ile eşleşir.

### 4.15 AppSegmentControl — app_segment_control.dart

```dart
const AppSegment<T extends Object>({required T value, required String label,
  IconData? icon, bool enabled = true, Key? key});
const AppSegmentControl<T extends Object>({
  Key? key, required List<AppSegment<T>> segments, required T selected,
  required ValueChanged<T>? onChanged, String? semanticLabel,
});
```

2–3 seçenek; nötr subtle rail, 4dp iç padding, radius12, seçili surface+accent; shadow0. Min48 segment; 1dp line. Selected liste içinde olmalı, value’lar unique. 1,3/2,0’da eşit genişliğe sığmayan metinde yatay kaydırılabilir min genişlikli segmentler; seçili öğe görünür alana getirilir. Metin kısaltılmaz. Geri/ileri klavye okları selection/focus taşır, Enter/Space seçer. Tek seçim; etiketi kopyalanan ikinci TabBar yok. Swipe gerekiyorsa ekran TabController ile iki yönlü bağlar.

### 4.16 AppTextField — app_text_field.dart

```dart
const AppTextField({
  Key? key, required String label, required TextEditingController controller,
  String? hintText, String? helperText, String? errorText,
  bool enabled = true, bool readOnly = false, bool obscureText = false,
  TextInputType keyboardType = TextInputType.text,
  TextInputAction textInputAction = TextInputAction.next,
  int minLines = 1, int? maxLines = 1, int? maxLength,
  FocusNode? focusNode, Iterable<String>? autofillHints,
  FormFieldValidator<String>? validator, ValueChanged<String>? onChanged,
  ValueChanged<String>? onFieldSubmitted, Widget? suffix,
  AutovalidateMode autovalidateMode = AutovalidateMode.onUserInteraction,
});
```

TextFormField tabanı. Password suffix gerçek48dp IconButton ve görünür/gizli local label; obscure ise min/maxLines1. Controller/focus owner ekran, kit dispose etmez. İlk submit geçersizse Form.validate ardından ilk invalid field’a focus+ensureVisible; server-safe field mapping errorText’e, genel hata notice’a. E-posta klavyesi/autofill, multiline nota newline, son alana done; klavye dismiss alan sonucu silmez.

### 4.17 AppDateField — app_date_field.dart

```dart
const AppDateField({
  Key? key, required String label, required DateTime? value,
  required DateTime firstDate, required DateTime lastDate,
  required ValueChanged<DateTime?>? onChanged,
  String? helperText, String? errorText, bool enabled = true,
  bool allowClear = false, FocusNode? focusNode,
});
```

**Calendar day** taşır; value UTC anı değildir. Görünüm AppTextField ile aynı read-only outlined yüzey; min56, calendar icon, label+yerel tarih, bütün alan tek button. Picker iptalinde onChanged çağrılmaz; clear varsa null. İlk tarih/min/max gün karşılaştırması; timezone dönüşümü uygulanmaz. Klavye açılmaz; native date picker locale app locale.

### 4.18 AppDateRangeField — app_date_range_field.dart

```dart
const AppDateRangeField({
  Key? key, required String label, required DateTimeRange? value,
  required DateTime firstDate, required DateTime lastDate,
  required ValueChanged<DateTimeRange?>? onChanged,
  String? helperText, String? errorText, bool enabled = true,
  bool allowClear = false, FocusNode? focusNode,
});
```

İki calendar day; UI metni AppDateFormat.dateRange. Min56, sarılabilir tek değer; showDateRangePicker yerel. `end≥start`; ek ürün limitleri kitte değil form validator’da. Tek tarih alanıyla aynı state ve focus restore.

### 4.19 AppTimeField — app_time_field.dart

```dart
const AppTimeField({
  Key? key, required String label, required TimeOfDay? value,
  required ValueChanged<TimeOfDay?>? onChanged,
  String? helperText, String? errorText, bool enabled = true,
  bool allowClear = false, FocusNode? focusNode,
});
```

24 saat `HH:mm`; showTimePicker içinde `alwaysUse24HourFormat:true`. TimeOfDay wall-clock bilgisi, kit UTC’ye çevirmez. Alan boşken kısa “Saat seçin” yerel placeholder; `HH:mm` kullanıcıdan metin olarak istenmez. Düzeltme formunda saat dilimi yardımı iki saat alanı için yalnız bir kez.

### 4.20 AppSelectField — app_select_field.dart

```dart
const AppSelectOption<T extends Object>({
  required T value, required String label, String? subtitle,
  bool enabled = true, Key? key,
});
const AppSelectField<T extends Object>({
  Key? key, required String label, required T? value,
  required List<AppSelectOption<T>> options,
  required ValueChanged<T?>? onChanged,
  String? helperText, String? errorText, bool enabled = true,
  bool allowClear = false, FocusNode? focusNode,
});
```

Görünüm diğer alanlarla aynı; açılış `showAppSheet` içinde min64 radio/list satırları. Seçim yalnız enabled option’da, kapanınca focus alanına döner. Value yoksa placeholder, sahte ilk seçenek atanmaz. Liste boşsa gerçek empty açıklaması; remote fetch kitin işi değildir. 10’dan fazla seçenek için ekran arama/lazy ayrı sheet sağlar, bu API kısa enum seçimleri içindir.

### 4.21 AppBottomNavigation — app_bottom_navigation.dart

```dart
const AppBottomNavigation({
  Key? key, required int selectedIndex,
  required ValueChanged<int> onDestinationSelected,
});
```

İndeks0..4: Ana Sayfa / Geçmiş / **QR** / Ziyaretçi / Profil; EN Home / History / QR / Visitor / Profile. İkonlar `home_outlined`, `history_outlined`, `qr_code_scanner_rounded`, `people_outline_rounded`, `person_outline_rounded`; selected dolu eşdeğer + accent. İkon24, arkasında48×28 radius8 nötr seçim, min hedef48.

**M3 + büyütme kesin uygulaması:** `NavigationBar` surface/SafeArea/eşit Expanded destination yerleşimini sağlar; destinations listesi beş özel `_AppNavigationDestination` widget’ıdır (SDK’nin izin verdiği `List<Widget>`), SDK dosyası fork edilmez. Her destination, görünür etiketten ayrı mevcut yerel erişilebilir label’ıyla (QR için qrTabTitle), kendi `Semantics(button:true,selected:...,label:...,onTap:...)` + `InkWell` + ikon/etiket Column’una sahiptir; görsel children ExcludeSemantics, tek tap düğümü. Böylece SDK `NavigationDestination` etiketinin 1,3 sınırı ve gizli font küçültmesi kullanılmaz. `labelBehavior:alwaysHide`, NavigationBar indicator transparan; görsel göstergeyi destination çizer. Callback doğrudan public onDestinationSelected’a bağlıdır, NavigationBar’a da aynı callback verilir.

Etiket TextPainter ile gerçek `textScaler`, w500/w600 ve `availableWidth/5 - 8` genişliğinde ölçülür; height = `max(64, 28 + 4 + maxLabelHeight + 16)`. Metin sınırsız satır, orta hizalı; 2,0’da Ana Sayfa iki satır, bütün hedefler **aynı** yükseklik. Yatay padding4, toplam nav maxWidth560. Genişlik320’de her hedef64dp; etiket 2,0’da kesilmez. NavigationBar default `height` 80’e bırakılmaz. Reduce motion süresi0; focus çevresi destination sınırında; FocusTraversalGroup/OrderedTraversalPolicy ile0..4 sırası korunur, Enter/Space tek callback tetikler. `ValueKey('app_nav_button_$index')` **InkWell’in tam hit alanında** kalır, 24dp ikon üstüne taşınmaz. §3 inset kuralı uygulanır.

### 4.22 AppMetricRow — app_metric_row.dart

```dart
const AppMetric({required String label, required String value,
  String? detail, String? semanticLabel});
const AppMetricRow({
  Key? key, required List<AppMetric> metrics,
  bool showDividers = true,
});
```

2–3 metrik; değer headlineSmall tabular, label/detail bodySmall. ≤1,3 ve yeterli genişlikte eşit sütun, arada1dp line/16padding; 2,0 veya ölçülen metin sığmazsa min64 dikey satırlar. Saat label’ları “İlk giriş / Son çıkış / Son giriş”; boş değer “—” semantics’te “Kayıt yok”. Kart oluşturmaz; home AppSurface içinde, geçmiş summary kartsız kullanılabilir.

### 4.23 AppDialog — app_dialog.dart

```dart
const AppDialog({
  Key? key, required String title, required Widget body,
  required String confirmLabel, required VoidCallback? onConfirm,
  String? cancelLabel, VoidCallback? onCancel,
  bool busy = false, bool destructive = false,
});
```

AlertDialog tabanı, scrollable body, en fazla iki eylem; primary confirm, secondary cancel. Destructive confirm dolu primary yerine danger metin/ikonlu secondary; metin tam eylemi söyler. Busy confirm spinner ve disabled cancel; caller showDialog barrierDismissible:false ve PopScope ile tutarlı davranışı kurar, bitince normal kapanış geri gelir. Dialog kit domain sonucuna göre kendiliğinden Navigator.pop yapmaz; ekran sonucu açıkça döndürür. Kullanıcı onayı ile server sonucu ayrıdır.

### 4.24 AppDateFormat — lib/core/app_date_format.dart

```dart
const AppDateFormat({required Locale locale, required DateTime now});
String clock(DateTime instant);
String timeOfDay(TimeOfDay time);
String relativeDateTime(DateTime instant);
String dateTime(DateTime instant, {bool includeYear = false});
String dayLabel(DateTime calendarDay, {bool includeYear = false});
String headingDate(DateTime instant);
String dateRange({required DateTime startDay, required DateTime endDay});
static DateTime calendarDayFromInstant(DateTime instant);
static DateTime instantFromTurkeyParts({
  required DateTime calendarDay, required TimeOfDay time,
});
```

Saf formatter; `now` caller tarafından enjekte edilir, her metotta DateTime.now çağrılmaz. `Locale.languageCode` tr/en, desteklenmeyen dil app’in çözdüğü locale ile normalize edilir. `intl` zaten vardır, yeni paket yok. `AttendanceDate` (`lib/core/attendance_date.dart:4`) değişmez: instant → `AttendanceDate.businessTime` tam **bir kez**, day key → `AttendanceDate.parseDay` takvim bileşenleri; businessTime’ın UTC işaretli wall-clock DateTime’ını tekrar clock/relativeDateTime’a vermek yasak (çift +3 olur).

- clock: tüm dillerde `HH:mm`; timeOfDay yalnız hour/minute pad2. relativeDateTime, Türkiye calendar key’lerini karşılaştırır: TR Bugün/Dün + saat; EN Today/Yesterday + saat; aksi `dateTime(instant)` ile kısa gün+ay+hafta günü+saat, yıl farklıysa yıl da görünür.
- dayLabel: TR `4 Kas Çar`, EN `4 Nov Wed`; `includeYear:true` → `4 Kas 2026 Çar` / `4 Nov 2026 Wed`. Kısa TR aylar Oca/Şub/Mar/Nis/May/Haz/Tem/Ağu/Eyl/Eki/Kas/Ara; günler Pzt/Sal/Çar/Per/Cum/Cmt/Paz. Noktalı locale varyantı yerine bu açık tablo kullanılır; EN Jan…Dec, Mon…Sun.
- headingDate: TR `4 Kasım Çarşamba`; EN `Wednesday, 4 November`; ay/gün tam adları locale’den. dateTime → dayLabel + clock; yıl farklıysa yıl otomatik görünür, includeYear zorlaması ayrıca vardır.
- dateRange: aynı gün `9 Kas`; aynı ay/yıl `9–11 Kas`; farklı ay `30 Kas–2 Ara`; farklı yıl `30 Ara 2026–2 Oca 2027`. EN `9–11 Nov`, `30 Nov–2 Dec`, `30 Dec 2026–2 Jan 2027`; now’un Türkiye yılından farklı yıldaki aynı-ay aralığında yıl eklenir. End<start validasyon hatasıdır, ters aralık gösterilmez.
- calendarDayFromInstant → businessTime bileşenlerinden `DateTime.utc(y,m,d)`. instantFromTurkeyParts → `DateTime.utc(y,m,d,h,m).subtract(AttendanceDate.offset)`; cihaz timezone’una bağımlı DateTime(y,m,d,h,m)/toLocal kullanılmaz.
- Picker return’u **gün** olarak alınır; `AttendanceDate.calendarKey` wire `YYYY-MM-DD` kalır. Düzeltme saat payload’ı `HH:mm` kalır. Ziyaretçi start/end gerçek UTC instant’lara dönüştürülür; form state’i de instant tutar, pickerde Turkey parts’e ayrılır. UI biçimiyle payload biçimi birbirinin yerine kullanılmaz.

### 4.25 AppScaffold — app_scaffold.dart

```dart
const AppScaffold({
  Key? key, required Widget body, Widget? header, Widget? bottomBar,
  bool consumeTopInset = false, bool consumeBottomInset = true,
  bool brandedSystemBar = false, bool resizeToAvoidBottomInset = true,
});
```

Nötr sayfa kabuğu. `header` zaten top inset tüketen AppPageHeader/AppBrandBand ise consumeTopInset false; header yoksa caller true verir. Body scroll sahibi **ekran**, AppScaffold sadece Expanded alana koyar. `bottomBar` form action slotudur, Scaffold.bottomNavigationBar değildir; body Column içinde klavyeyle küçülür. consumeBottomInset root formlarda true; main shell tab ekranlarında false. BottomBar varsa kendi SafeArea’sı tüketir ve body yeniden alt safe padding almaz. Full-bleed bant home’da scrollable body’nin ilk child’ıdır, ayrıca header slotu kullanılmaz. Ana Sayfa/Giriş/Açılış için brandedSystemBar:true, AppBrandBand.consumeTopInset:false: AppScaffold status inset yüksekliğinde sabit bandBackground şeridini scroll alanının dışında çizer ve light overlay uygular; böylece bant kaydırılsa da açık OS ikonlarının arkasında nötr açık canvas belirmez. Bu mod top inset’i zaten tükettiğinden consumeTopInset ayrıca açılmaz; gerçek durum çubuğu ikonlarını uygulama çizmez. Mevcut screen class adları korunur.

### 4.26 AppSurface — app_surface.dart

```dart
enum AppSurfaceKind { group, attendanceOverlap, qr }
const AppSurface({
  Key? key, required Widget child,
  AppSurfaceKind kind = AppSurfaceKind.group,
  EdgeInsetsGeometry padding = const EdgeInsets.all(20),
});
```

Group surface/line/radius16/elevation0; attendanceOverlap ve qr aynı kontur + tek tanımlı gölge. Koyu durumda gölge yine aynı düşük alpha ile kalabilir, yeni siyah gölge üretilmez. QR kind **her temada beyaz yüzey** ve siyah kod korur; etrafındaki etiketler QR dışındaki tema yüzeyindedir. Group scroll veya semantics eklemez. Kit dışındaki rastgele BoxShadow kullanımları kaldırılır.

### 4.27 Durum, semantics, ölçek ve mevcut widget eşleştirmesi

Aşağıdaki her satır §4 ortak protokolüyle birlikte uygulanır. “1,3/2,0” davranışı iki ölçekte de zorunludur; küçük ekranda dikey kaydırma serbest, yatay taşma yasaktır. Açık/koyu kaynağı belirtilen token çiftidir, sabit Colors.white yalnız QR kod yüzeyinde geçerlidir.

| Bileşen | N/P/D/B/F | Semantics ve 1,3 / 2,0 davranışı | Açık/koyu ve yerine geçtiği kaynak |
|---|---|---|---|
| AppUiTokens | Veri; beşi de yok | Semantics/metin yok; copyWith/lerp eksiksiz | §1; `lib/theme/app_theme.dart:15` |
| AppBrandBand | S; trailing varsa E | Title header, dekoratif logo dışlanır; başlık/kurum sarılır, kart doğal büyür | band/onBand; `lib/screens/home/home_screen.dart:124`, `lib/screens/auth/login_screen.dart:116`, `lib/screens/splash_screen.dart:24` |
| AppPageHeader | S + back/actions E | Header tek; geri/close tooltip yerel; büyüyünce actions alt satır | canvas/text; `lib/screens/history/history_screen.dart:173`, `lib/screens/qr_scan/qr_scan_screen.dart:261` |
| AppStatusBadge | S | Tek label; ikon dışlanır, satır yüksekliği büyür; uzun etiket Wrap | tone fg/bg; `lib/widgets/cards/attendance_status_card.dart:214`, `lib/widgets/visitor/visitor_cards.dart:8`, `lib/screens/requests/requests_screen.dart:194` |
| AppListGroup | S | Grup başlığı header, satırlar bağımsız; sabit yükseklik yok | surface/line; `lib/screens/profile/profile_screen.dart:232`, `lib/widgets/visitor/visitor_cards.dart:38` |
| AppListRow | E; busy caller disabled | Tek button yalnız onTap varsa; selected okunur; saat+text 2,0’da üst üste | text/muted/tone; `lib/widgets/history/history_record_tile.dart:62`, `lib/screens/settings/select_device_screen.dart:256` |
| AppEmptyState | S + action E | Başlık+sebep; istek dışı tekrar anons yok; action satıra geçer | canvas/text/muted; `lib/widgets/history/history_records_list.dart:86`, `lib/screens/requests/requests_screen.dart:168` |
| AppDataNotice | S + action E/B | liveRegion değişiklikte; mesaj asla tek satıra kesilmez, action aşağı geçer | tone; `lib/widgets/cards/attendance_status_card.dart:155`, `lib/screens/visitor/visitor_screen.dart:277` |
| AppSkeleton | S; sadece B görünümü | Tek loading label; bloklar okunmaz; gerçek layout kadar büyür, hareket yok | subtle; `lib/widgets/history/history_records_list.dart:75`, `lib/screens/settings/select_device_screen.dart:199` |
| AppPrimaryButton | E tümü | label/disabled/busy tek düğüm; 1,3/2,0 multiline + min52 | primary/onPrimary; `lib/screens/auth/login_screen.dart:230`, `lib/screens/requests/requests_screen.dart:470` |
| AppSecondaryButton | E tümü | label/disabled/busy; küçülen alan yerine çok satır | surface/text/control; `lib/screens/auth/forgot_password_screen.dart:69`, `lib/screens/qr_scan/qr_scan_screen.dart:378` |
| AppFormActionBar | S + children E | Görsel sırayla focus; supporting text ayrı; 2,0 iki satır eylem | surface/line; `lib/screens/requests/requests_screen.dart:470`, `lib/screens/visitor/visitor_form_screen.dart:418` |
| showAppSheet | Route; P/D yok, B caller | Focus trap/return, modal barrier label; klavye tek inset, body kayar | modal defaults/surface; `lib/screens/history/history_screen.dart:735`, `lib/widgets/visitor/visitor_detail.dart:11` |
| AppSheet | S + close E/B | title header/namesRoute; close48; body scroll, footer büyür | surface; `lib/widgets/history/history_filter_sheet.dart:41`, `lib/widgets/visitor/visitor_detail.dart:88` |
| AppSegmentControl | E; busy callback null | selected + label + ordinal, klavye; 1,3/2,0 doğal genişlik/kaydırma | subtle/surface/accent; `lib/screens/history/history_screen.dart:201`, `lib/screens/qr_scan/qr_scan_screen.dart:262` |
| AppTextField | E; busy enabled false | TextFormField yerel edit semantics, error bağlı; label/error sarılır; controller korunur | surface/control/focus/danger; `lib/screens/auth/login_screen.dart:230`, `lib/screens/visitor/visitor_form_screen.dart:521` |
| AppDateField | E; busy enabled false | button label+formatted value+error; picker focus restore; 2,0 yükseklik büyür | alan token’ları; `lib/screens/requests/requests_screen.dart:425`, `lib/screens/visitor/visitor_form_screen.dart:487` |
| AppDateRangeField | E; busy enabled false | Başlangıç/bitiş anlamı tek değer; multiline; iptal değişiklik yapmaz | alan token’ları; `lib/screens/requests/requests_screen.dart:425` iki ayrı tarih butonu |
| AppTimeField | E; busy enabled false | label+HH:mm; picker 24h; destek metni sarılır | alan token’ları; `lib/screens/requests/requests_screen.dart:439` |
| AppSelectField | E; busy enabled false | expanded/selected seçenek radio semantics; uzun değer sarılır; seçenek64+ | alan token’ları; `lib/screens/requests/requests_screen.dart:386`, `lib/screens/visitor/visitor_screen.dart:187` |
| AppBottomNavigation | E; global busy ile kilitlenmez | Tek seçili destination, key tam tap alanında; 1,3/2,0 ölçümlü eşit yükseklik | surface/accent/subtle; `lib/widgets/app_bottom_navigation.dart:9`, `lib/screens/main_navigation_shell.dart:100` |
| AppMetricRow | S | Her değer “label, value, detail”; renk dışı anlam; 2,0 dikey | text/muted/line; `lib/widgets/cards/attendance_status_card.dart:270`, `lib/screens/history/history_screen.dart:531` |
| AppDialog | S + actions E/B | Dialog route namesRoute, heading, focus trap; scrollable body; 2,0 actions dikey | surface; `lib/widgets/door_operation_recovery_dialog.dart:112`, `lib/screens/requests/requests_screen.dart:55`, `lib/widgets/visitor/visitor_detail.dart:152` |
| AppDateFormat | Veri; beşi yok | Semantics için okunabilir tarih üretir; fontla ilgisiz | Renksiz; `lib/widgets/visitor/visitor_labels.dart:21`, `lib/widgets/history/history_record_tile.dart:46` |
| AppScaffold | S | Focus traversal üstten alta; scroll/footer örtüşmez; iki ölçekte yeniden layout | canvas; `lib/screens/main_navigation_shell.dart:100` ve ekran Scaffold kabukları |
| AppSurface | S | Çocuk anlamını devralır, sahte group/button yok; içerikle büyür | surface/line; `lib/widgets/cards/attendance_status_card.dart:39`, `lib/screens/qr_scan/qr_scan_screen.dart:304` |

Kaynak satırları mevcut dosyaların 4 Kasım 2026 okunmasına aittir; bileşenler taşınınca geçmiş referans olarak kalır. Bazı satırlar fonksiyon içindeki mevcut görsel bloğun başlangıcıdır, yeni kodun sabit hedef satırı değildir.

## 5. Ekran düzenleri ve durumlar

Bu bölümde sıra yukarıdan aşağıdır. **Dolu** gerçek veri veya geçerli form girdisi; **boş** başarılı yanıtla veri yok; **yükleniyor** ilk okuma veya işlem sürüyor; **hata** yerel AppError eşlemesi anlamındadır. Ağ hatası geldiğinde çevrimdışı açıklama `errorNetwork` ile gösterilir; sadece boş listeye bakıp “çevrimdışı” kararı verilmez. Cache varsa korunur ve AppDataNotice ile güncellik belirtilir, yoksa önceki kayıt gösteriliyormuş gibi konuşulmaz. Refresh işlemi mevcut içeriği iskelete döndürmez.

### 5.1 Açılış

1. AppScaffold → scrollable gövde → AppBrandBand (NGS Plus, “Başlatılıyor”, marka görseli).
2. Nötr alanda tek status mesajı; yüklemede tek indeterminate progress (ilk startup, içerik biçimi bilinmediği için skeleton gereksiz).
3. Hata halinde AppDataNotice → yöneticiye başvuru açıklaması → AppPrimaryButton “Yeniden dene” → AppSecondaryButton “Giriş ekranına dön”.

**Dolu:** auth hazır olunca mevcut router yönlendirir, başarı bekleme ekranı eklenmez. **Boş:** uygulanmaz, startup sonucu olmayan durum yüklemedir. **Yükleniyor:** startup semantics ve progress; nav yok. **Hata/çevrimdışı:** mevcut retryableFailure/configuration mesajı yerel, mevcut callback’ler; auth guard geçilmez.

### 5.2 Giriş

1. AppBrandBand: NGS Plus, “Giriş yap”; nötr scroll alanı, form max480, kenar20.
2. AppTextField e-posta → AppTextField şifre + görünürlük düğmesi.
3. E-postamı hatırla checkbox + tam etiket alanı (48dp hedef) → “Şifre yardımı” TextButton.
4. Alan hataları/ortak AppDataNotice → AppPrimaryButton “Giriş yap”; kısa erişim yardımı gerekiyorsa bodySmall.

**Dolu:** geçerli girdiler, tek CTA. **Boş:** boş alanlar; submit sonrası zorunlu alan hatası/ilk hataya focus. **Yükleniyor:** form girdisi korunur, busy CTA “Giriş yapılıyor”, yinelenen submit ve hatırla/visibility dışındaki mutasyonlar kilitli; auth’un mevcut busy kararı esas. **Hata:** kimlik bilgisi hatası formu silmez; kapalı mobil erişimde “Kurum yöneticinize başvurun” gerçek sonraki adım. Klavye açıldığında bandı küçültmek için font küçültülmez; form kaydırılır, son alan+CTA erişilir.

### 5.3 Şifre yardımı

1. AppPageHeader “Şifre yardımı” + geri.
2. AppListGroup içinde “Yöneticinizle iletişime geçin” ve tek kısa süreç açıklaması.
3. Seçilebilir istek metni → AppPrimaryButton “Talebi kopyala” → AppSecondaryButton “Giriş ekranına dön”.

**Dolu:** metin ve iki eylem. **Boş:** uygulanmaz, yerel sabit içerik. **Yükleniyor:** clipboard işlemi kısa busy; e-posta gönderiliyor spinner’ı yok. **Hata:** kopyalama başarısızsa metin seçilebilir kalır ve güvenli açıklama görünür. Kopyalama gerçekten e-posta göndermiş gibi sunulmaz.

### 5.4 Ana Sayfa

1. AppBrandBand: marka satırı → selam+ad → kurum/proje → AppDateFormat.headingDate; gerçek auth bilgisi kullanılır.
2. overlapChild AppSurface(attendanceOverlap): “Bugün” + AppStatusBadge → AppMetricRow (ilk giriş / son çıkış / son giriş) → mevcutsa doğrulanmış kapı adları → güncelleme zamanı.
3. AppPrimaryButton “QR kod tara” → **Tara** modu; altında AppListRow/Secondary kapı eylemi “Kapıyı aç”, alt metin seçili kapı.
4. DoorCommandStatusCard’ın korunmuş durum modeli, AppDataNotice/Metric görünümüyle; yalnız aktif/belirsiz işlem varsa.
5. AppListGroup: Taleplerim (+ gerçek bekleyen sayısı) → Ziyaretçi davet et. Ana gezinme dış shell tarafından.

**Dolu:** attendanceSummary’den firstEntryToday/lastExitToday/lastEntryToday; “ilk giriş” için lastEntry kullanılmaz (`lib/providers/attendance_provider.dart:133`). Örnek08:52/12:31/13:14 sabit üretim verisi değildir. Kapı adı özet içinde yoksa ilgili doğrulanmış hareketten bulunur; bulunamazsa gizlenir, tercihli kapı geçmiş hareketmiş gibi yazılmaz. **Boş:** “Bugün kayıt yok”, saatler—, durum “İçeride” uydurulmaz; QR/kapı eylemleri bağımsız izinlerine göre kullanılabilir. **Yükleniyor:** kart iskeleti + tek loading label, başlık/eylemler kalır; durum hatası loading’i warning yapmaz. **Hata:** cache varsa badge güncellik notuyla korunur, yoksa “Durum alınamadı” ve retry. Kapı izni yoksa disabled buton + gerçek sebep; mevcut preference yoksa “Kapı seç” eylemi. Günün Sözü, gereksiz hızlı işlem başlığı ve yetim üçüncü kart yok.

### 5.5 QR — QR Kodum ve Tara

1. AppPageHeader “QR” → AppSegmentControl “QR Kodum / Tara”.
2. QR Kodum: kişi+kurum satırı → AppSurface(qr) içinde gerçek QrImageView → kalan süre metni/çubuğu → “Kodu okuyucuya gösterin” → AppSecondaryButton Yenile (key `qr-refresh`).
3. Tara: izin durumuna göre kamera/çerçeve → “QR kodu çerçeveye alın” → tooltip’li48dp kamera değiştir/flaş; sonuç mevcut modal akışı.
4. Nav yüksekliği ayrılmış body; kod, expiry ve Yenile gerektiğinde birlikte kayar; sabit bottom overlay yok.

**Dolu:** geçerli token süresi gerçek `expiresAt` temelli; demo44 veya60sn sabitlenmez. **Boş:** token yok/expired/consumed ayrı yerel mesaj ve Yenile; erişim sonucu üretilmez. **Yükleniyor:** ilk token AppSkeleton(qr); yenilemede geçerli kod varsa korunur, busy Yenile; kullanılmış/geçersiz kod silinir. **Hata:** refresh/status hata key’leri ve son geçerli kod politikası korunur; kamera reddi “Ayarları aç”, başlatma hatası “Yeniden dene”. İzin verilmeden kamera otomatik başlamaz. Timer her saniye ekran okuyucuyu konuşturmaz; anlamlı expired/consumed geçişi liveRegion.

**Tara rota sözleşmesi (D2a):** `QRScanScreen` constructor’ına `QrTab initialTab = QrTab.code` ve `int scanRequestRevision = 0` eklenebilir; mevcut inject edilen repository/controller/permission callback’leri korunur. İç navigasyon `GoRouterState.extra` içinde typed `QrOpenIntent.scan(revision)` taşır; `context.go(AppRoute.qr, extra: ...)` home CTA’dan çağrılır, router intent’i QR ekranına iletir. Route pathname `/qr` kalır; query/fragments allowlist gevşetilmez. Init ve didUpdateWidget’ta yeni revision Tara’yı seçer; zaten mounted QR branch’e tekrar CTA ile geliş de taramayı açar. Normal nav QR tıklaması mevcut saklı sekme davranışını korur; cold start code’dur. Root session değişince intent temizlenir. Kamera start/stop yine _activityChanged/_reconcileCamera üzerinden olur, direkt camera.start eklenmez.

### 5.6 Kapı seçimi

1. AppPageHeader “Kapı seç” + geri → AppTextField arama.
2. Sonucun kaynağı/uygunluk gerekirse AppDataNotice; lazy liste içinde AppListRow: ad, konum, erişim açıklaması, selected check/radio.
3. Uygun olmayan satır disabled + metinsel sebep; seçimi kaldır secondary; seçim mevcut tercih kaydetme akışını izler.

**Dolu:** seçili kapı rengi+check; türe göre değişen rastgele ikon kutusu yok. **Boş:** yetkili kapı yoksa yönetici açıklaması; arama boşsa “Eşleşen kapı yok” + aramayı temizle. **Yükleniyor:** ilk liste skeleton, eski veri varsa yerinde küçük progress. **Hata:** AppDataNotice + retry, kapı araması bir hata ekranına dönüşse de giriş korunur; boş ekran yalnız spinner değildir.

### 5.7 Kapı kurtarma diyaloğu

1. AppDialog “Kapı işlemini kontrol et” → mevcut request’e ait kapı adı.
2. AppDataNotice: kontrol ediliyor / cihaz onayladı / başarısız / sonuç belirsiz.
3. “Durumu kontrol et” secondary; yalnız domain izin verirse “Aynı isteği yeniden gönder” primary; kapatma secondary.

İkiden fazla eylem gerektiğinde status kontrolü dialog body’de tek secondary, footer cancel+confirm olarak ayrılır; aynı anda iki dolu CTA olmaz. **Dolu:** mevcut requestId/kapı/snapshot; komut onayı fiziksel geçiş kanıtı değildir. **Boş:** recoverable intent yoksa yeniden gönder butonu yok, güvenli kapatma. **Yükleniyor:** checkStatus busy, retry disabled. **Hata:** tekrar status kontrolü sunulur; otomatik resend veya yeni requestId yok. Mevcut DoorOperationRecoveryDialog class ve session guard’ları kalır, yalnız gövde AppDialog kitine dönüşür.

### 5.8 Geçmiş — Kayıtlar

1. AppPageHeader “Geçmiş” → AppSegmentControl Kayıtlar/Takvim/Özet.
2. Tarih/kapı kapsamı + tooltip’i korunan Filtrele48dp; developer açıklaması gösterilmez.
3. Gün başlıklı **gün başına tek** nötr grup, lazy AppListRow: solda tabular saat, yön ikonu, kapı adı, ret metni+ikon; her kayıt ayrı kart değildir.
4. Alt pagination/loading/error satırı; key `history-load-more`; pull-to-refresh korunur.

**Dolu:** üç örnek gün değil, gerçek filtreli sayfa; Türkiye gününe göre grup, timestamp’e göre azalan sıra. **Boş:** filtresiz “Henüz kayıt yok”; filtreli eşleşme yok + filtre temizle. **Yükleniyor:** ilk sayfa skeleton; pagination yalnız sonda progress. **Hata:** önceki sayfaları sakla, başarısız sayfada retry; summary hatası kayıt listesini yok etmez.

### 5.9 Geçmiş — Takvim

1. Ortak header/segment → ay seçimi (önceki/sonraki48dp).
2. HistoryCalendar aynı gün key’leriyle; today kontur, selected nötr dolgu+accent, kayıt var noktası + gün semantics sayısı.
3. “Kayıtlarını görmek için bir gün seçin” → seçili günün AppListGroup kayıtları.

**Dolu:** seçili gün kayıtları; doğrudan ordinal/label okunur. **Boş:** ayda/günde kayıt yok ayrı kısa empty; “devamsız” sonucu çıkarılmaz. **Yükleniyor:** takvim yerleşimi korunur, içerik skeleton; ay atlama state’i korunur. **Hata:** retry ve son başarılı ay veri bağlamı; selected gün yanlışlıkla değişmez. Gün hücreleri min48; kullanılabilir genişlik7×48’den azsa (örneğin320dp ekran/20dp kenar), 7 sütunu sıkıştırmak yerine aynı ayın günlerini selected/check ve kayıt sayısı taşıyan dikey AppListRow listesine geçir. 2,0’da sayı/label ölçümü hücreye sığmıyorsa aynı erişilebilir liste varyantını kullan; `history-day-<date>` key’leri ve gün seçme callback’i değişmez. Ay seçimi üstte kalır, açıklama gün listesinden sonra kayar; yatay sayfa taşması yoktur.

### 5.10 Geçmiş — Özet

1. Ortak header/segment → “Bu ay / Bu hafta” dönem seçimi.
2. AppMetricRow giriş/çıkış/kayıtlı gün; alt satır ret/belirsiz sayıları ve ikonları.
3. Kapı bazında nötr liste → açıklama için “Kayıtlar hakkında” secondary sheet.

**Dolu:** yalnız ilgili dönem summary sonucu; “resmi PDKS/mesai” hesaplaması sunmaz. **Boş:** “Bu dönemde kayıt yok” ve açıklama; sıfır değerler hata yerine konmaz. **Yükleniyor:** metrics skeleton, dönem seçimi korunur. **Hata:** yalnız ilgili summary AppDataNotice + retry; kayıt listesi bağımsız. Haftalık/aylık istek epoch/period koruması değiştirilmez.

### 5.11 Geçmiş — filtre sheet, gün ve kayıt ayrıntısı

**Filtre üstten alta:** showAppSheet → AppSheet Filtrele → AppDateField (mevcut tek gün filtresi) → arama/lazy kapı seçenekleri (mevcut facet kapsamı) → AppFormActionBar primary “Filtreleri uygula”, secondary “Filtreleri temizle”. Taslak seçim uygulamadan provider’a yazılmaz; kapatma iptaldir. **Dolu:** seçili gün/kapı; **boş:** tüm tarihler/tüm kapılar; seçenek yoksa açık empty, **yükleniyor:** seçenek iskeleti; **hata:** retry, taslak korunur. Filtre seçeneklerinin yalnız mevcut facet kapsamı olduğunu kısa kullanıcı diliyle açıkla; olmayan global kapı listesi varmış gibi sunma.

**Gün ayrıntısı üstten alta:** AppSheet tarih → kayıt sayısı → gün kayıtları → kapat. **Dolu:** gün listesi; **boş:** o gün kayıt yok; **yükleniyor:** list skeleton; **hata:** safe notice+retry. Aynı ekran modeli içinde gösterilebilir, yeni backend endpoint gerekmez.

**Kayıt ayrıntısı üstten alta:** AppSheet “Kayıt ayrıntısı” → durum rozeti → gün/saat/yön/kapı/konum etiket-değer satırları → kısa kayıt açıklaması. **Dolu:** tüm bilinen alanlar; **boş:** opsiyonel konum yoksa—, kayıt yoksa “Kayıt bulunamadı”; **yükleniyor:** yalnız gerçek fetch varsa skeleton, yerel seçili kaydı açarken sahte spinner yok; **hata:** yerel notice/kapama. Token/ham QR içeriği ayrıntı alanına eklenmez.

### 5.12 Talepler — liste

1. AppPageHeader “Taleplerim” → AppSegmentControl “İzin / Kayıt düzeltme”.
2. AppPrimaryButton “Yeni talep” → aktif türün formu; liste grupları lazy.
3. AppListRow/panel: talep türü, AppDateFormat.dateRange, AppStatusBadge, gerekçe/karar notu; uygun talepte secondary “Talebi geri çek”.

**Dolu:** durum+metin tek ortak badge, ISO tarih yok. **Boş:** “Henüz talebiniz yok” + aynı yeni talep CTA (ikinci dolu kopyası yok). **Yükleniyor:** ilk list skeleton, önceden veri varsa yenileme progress. **Hata:** cache ayrımıyla notice+retry; yükleme sırasında empty parlamaz.

### 5.13 İzin formu

1. AppPageHeader “İzin talebi” → AppSelectField izin türü.
2. AppDateRangeField başlangıç/bitiş → AppTextField isteğe bağlı not (500 karakter).
3. Alan altı hata veya AppDataNotice → yapışkan AppFormActionBar primary “İzin talebi gönder”.

**Dolu:** yerel tarih, tür, not; **boş:** geçerli varsayılan gün+isteğe bağlı boş not, zorunlu tür/aralık kontrollü; **yükleniyor:** gönderimde form kilitlenir, “İzin talebi gönderiliyor”, PopScope korunur; **hata:** limit/aralık/çakışma alanla ilişkilendirilir, ilk hata focus; belirsiz sonuçta mevcut listeye dönüş+uyarı, otomatik ikinci talep yok. Başarıda liste görünür olduktan sonra “İzin talebi gönderildi”; geri dönüşte yanlış route context’ine snackbar yazılmaz.

### 5.14 Kayıt düzeltme formu

1. AppPageHeader “Kayıt düzeltme talebi” → AppDateField (bugün/son30 gün) → AppSelectField giriş/çıkış/ikisi.
2. İlgili AppTimeField(lar) → tek yardım “Saatler Türkiye saatine göre girilir”.
3. AppTextField gerekçe (5–300) → alan hatası/notice → AppFormActionBar “Düzeltme talebi gönder”.

**Dolu:** yalnız türe uygun saatler payload’a girer; **boş:** saat seçilmemiş, gerekçe boş, submitte doğrulama; **yükleniyor:** busy/PopScope; **hata:** mismatch/time/reason/duplicate kendi yerel mesajıyla, inputlar korunur. Başarı “Düzeltme talebi gönderildi”; uncertain başarılı snackbar değildir.

### 5.15 Talebi geri çekme onayı

AppDialog → “Talebi geri çek” → talep türü+tarih ve sonuç açıklaması → secondary “Vazgeç” + destructive “Talebi geri çek”. **Dolu:** yalnız canWithdraw pending talep; **boş:** artık bulunmuyorsa notice+liste yenileme; **yükleniyor:** duplicate tap kapalı; **hata:** uncertain metni+liste kontrolü, “geri çekildi” denmez. Başarı “Talep geri çekildi”; server pending kontrolü korunur.

### 5.16 Ziyaretçiler — liste

1. AppPageHeader “Ziyaretçiler” → AppPrimaryButton “Ziyaretçi davet et” (key `visitor-add`).
2. AppMetricRow tüm davetlerin doğru summary’si; erişim durumu ile fiziksel bulunma ayrıdır.
3. AppTextField arama → AppSelectField durum filtresi → lazy AppListRow/grup: ad, ziyaret aralığı, access badge, ayrı presence metni.
4. Sonraki sayfa / retry / filtre temizle.

**Dolu:** ad/tarih/erişim; **boş:** filtresiz “Henüz davet yok”, filtreli “Eşleşen davet yok” ayrı; **yükleniyor:** summary ve list bağımsız skeleton, mevcut liste korunur; **hata:** cache yoksa “Davetler alınamadı”, cache varsa “Önceki davetler gösteriliyor”; summary lower bound varsa gerçek sınırlılık kullanıcı diliyle korunur. `visitor-add` aynı anda yalnız bir etkin hedefte bulunur.

### 5.17 Ziyaretçi formu

1. AppPageHeader “Ziyaretçi davet et” veya “Daveti düzenle”.
2. AppListGroup kişi bilgileri: ad, soyad, telefon → ziyaret bilgileri: amaç, notlar.
3. Başlangıç/bitiş için AppDateField + AppTimeField çiftleri; Turkey parts ↔ instant dönüşümü tek yerde.
4. Güncel aydınlatma metni ve checkbox; aktivasyon gerektiği kısa açıklama.
5. Alan hataları/notice → AppFormActionBar “Daveti kaydet”.

**Dolu:** server notice sürümü ve mevcut izinler korunur; **boş:** ad/soyad vb required hataları, tarih sınırları; **yükleniyor:** notice yüklenirken yalnız o bölüm skeleton; kaydetme/receipt kontrolünde busy ve mevcut kilitler; **hata:** form aynı kalır, genel hata ilk görünür alan/notice’a taşınır. Uncertain create’te taslak ve requestId kilitli; yeni kayıt oluşturulmaz, aynı isteği tekrar dene akışı kalır. Başarı listeye dönüldükten sonra “Davet kaydedildi. Yetkili onayı bekleniyor”; kayıt oluşturulması kapının aktif olduğu anlamına gelmez.

### 5.18 Ziyaretçi ayrıntı sheet ve iptal onayı

**Ayrıntı üstten alta:** AppSheet ad → erişim AppStatusBadge + ayrı fiziksel durum → ziyaret tarih/saatleri → kişi/amaç/not → cihaz durumu → uygun edit/cancel secondary eylemleri. **Dolu:** mevcut izinlere göre; **boş:** opsiyonel değer—, silinmiş kayıt empty; **yükleniyor:** mutasyon sonrası mevcut veri yanında progress; **hata:** yerel notice, sheet kapanıp sonuç kaybolmaz. Teknik “senkronizasyon” başlığı “Cihaz durumu” olur; applied erişim/physical inside’a çevrilmez.

**İptal üstten alta:** AppDialog “Daveti iptal et” → ad/aralık → vazgeç + destructive iptal. **Dolu:** uygun davet; **boş:** bulunamadı; **yükleniyor:** tap kilidi; **hata:** kayıt değiştiyse yeniden oku, aktif erişimde operatör gerektiren kural korunur. Başarı “Davet iptal edildi”.

### 5.19 Profil ve alt sayfalar

1. AppPageHeader “Profil” → küçük avatar + ad/e-posta/kurum-proje, yarım ekran kimlik kartı yok.
2. AppListGroup Hesap (bilgiler, şifre değiştir) → Tercihler (tema, dil, kapı seçimi) → Destek (bildirim bilgisi, yardım, teknik destek raporu, hakkında, gizlilik) → destructive Çıkış yap.
3. Alt bilgi sayfaları AppPageHeader+scrollable bodySmall/bodyMedium; uygulama sürümü gerçek metadata’dan.

**Dolu:** doğrulanmış kimlik/tercihler; **boş:** eksik e-posta/proje için yerel fallback, ham null yok; **yükleniyor:** metadata/tercih bölümünde lokal progress, bütün ekran spinner değil; **hata:** ilgili tercihin save failure mesajı, son kaydedilmiş değer korunur. Destek raporu hassas içeriği dışlama, kopyalama ve temizleme davranışları aynen kalır. Şifre formu AppTextField + AppFormActionBar ile çizilir; kurallar/tüm oturumların kapanması açıklaması korunur. Bildirim ekranında var olmayan izin anahtarı icat edilmez.

**Tema/dil seçici:** showAppSheet → AppSheet başlık → radio AppListRow seçenekleri (Sistem/Açık/Koyu; Sistem/Türkçe/English) → kapat. **Dolu:** current selected; **boş:** system fallback; **yükleniyor:** provider.isSaving boyunca seçim/close disabled ve PopScope, tek progress; **hata:** sheet açık, önceki değer seçili, retry mümkün. Dil cihazda saklanır açıklaması korunur. Tercih kaydı başarılı olunca sheet kapanır, focus tetikleyici satıra döner.

## 6. Metin değişiklikleri — TR/EN uygulama listesi

Aşağıdaki **73 mevcut anahtar** değişir; mevcut TR doğrudan app_tr.arb’den alınmıştır. **22 yeni anahtar** ve **9 silinecek Günün Sözü anahtarı** ayrıca listelenmiştir. Listede olmayan mevcut l10n metni bu işin gerekçesiyle yeniden yazılmaz. Kullanıcıya çıkmayan eski anahtarlar yeni ekrana bağlanmaz; dil aileleri D1 l10n sahibi tarafından birlikte üretilir.

| l10n anahtarı | Mevcut TR | Yeni TR | Yeni EN |
|---|---|---|---|
| `commonRetry` | Tekrar Dene | Yeniden dene | Try again |
| `loginWelcomeTitle` | Hoş geldiniz! | Giriş yap | Sign in |
| `loginTitle` | Giriş Yap | Giriş yap | Sign in |
| `loginPrompt` | PDKS sistemine giriş yapmak için bilgilerinizi giriniz | Hesap bilgilerinizle giriş yapın | Sign in with your account details |
| `loginForgotPassword` | Şifremi unuttum | Şifre yardımı | Password help |
| `homeGreetingLine` | {greeting}, {name}! | {greeting}, {name} | {greeting}, {name} |
| `homeAttendanceStatus` | Yoklama Durumu | Bugünkü durum | Today’s status |
| `homeStatusOut` | Çıktı | Dışarıda | Outside |
| `homeStatusNone` | Henüz Yok | Bugün kayıt yok | No records today |
| `homeAttendanceEntryRow` | Son Giriş | Son giriş | Last entry |
| `homeAttendanceExitRow` | Son Çıkış | Son çıkış | Last exit |
| `homeQuickActions` | Hızlı İşlemler | İşlemler | Actions |
| `homeUpdatedAt` | Son güncelleme: {time} | Son güncelleme {time} | Last updated {time} |
| `homeDataUnavailable` | Veriler alınamadı | Bugünkü durum alınamadı | Today’s status could not be loaded |
| `homeDoorUnavailable` | Seçilen kapı artık kullanılamıyor. Profil üzerinden yeni bir kapı seçin. | Seçilen kapı kullanılamıyor. Yeni bir kapı seçin. | The selected door is unavailable. Choose another door. |
| `selectDeviceTitle` | Kapı Seç | Kapı seç | Choose a door |
| `selectDeviceSearch` | Ara... | Kapılarda ara | Search doors |
| `passwordHelpAdminBody` | Mobil şifre kurulumunu kurum yöneticiniz yönetir. Kayıtlı e-posta adresinize yeni bir kurulum bağlantısı göndermesini isteyin. Bağlantıyı açıp yeni şifrenizi belirledikten sonra giriş ekranına dönün. | Kurum yöneticinizden kayıtlı e-postanıza şifre kurulum bağlantısı göndermesini isteyin. Şifrenizi belirledikten sonra giriş yapın. | Ask your organisation’s administrator to send a password setup link to your registered email. Set your password, then sign in. |
| `passwordHelpCopy` | Yöneticiye iletilecek talebi kopyala | Talebi kopyala | Copy request |
| `profilePreferredDoor` | Hızlı Erişim Kapısı | Hızlı erişim kapısı | Quick access door |
| `profileProject` | Firma / proje | Kurum ve proje | Organisation and project |
| `historyLoading` | Veriler yükleniyor... | Kayıtlar yükleniyor | Loading records |
| `historyErrorTitle` | Bir Hata Oluştu | Kayıtlar alınamadı | Records could not be loaded |
| `historyErrorBody` | Veriler yüklenirken hata oluştu: {error} | Kayıtlar alınamadı. Yeniden deneyin. | Records could not be loaded. Try again. |
| `historyEmptyHint` | Verileri yenilemek için aşağı çekin | Yeni geçişleriniz burada görünecek. | Your new access records will appear here. |
| `historyMonthSummary` | Bu Ay Özeti | Bu ayın özeti | This month’s summary |
| `historyTotalCheckIns` | Toplam Giriş | Toplam giriş | Total entries |
| `historyTotalCheckOuts` | Toplam Çıkış | Toplam çıkış | Total exits |
| `historyGeneralStats` | Genel İstatistikler | Genel istatistikler | Overall statistics |
| `historyThisWeek` | Bu Hafta | Bu hafta | This week |
| `historyWeeklySummary` | Haftalık Özet | Haftalık özet | Weekly summary |
| `historyDeviceStats` | Cihaz Bazlı İstatistikler | Kapılara göre kayıtlar | Records by door |
| `historyCheckInRecord` | Giriş Yapıldı | Giriş kaydı | Entry record |
| `historyCheckOutRecord` | Çıkış Yapıldı | Çıkış kaydı | Exit record |
| `historyBadgeIn` | GİRİŞ | Giriş | Entry |
| `historyBadgeOut` | ÇIKIŞ | Çıkış | Exit |
| `historyUnknownDevice` | Bilinmeyen Cihaz | Kapı bilgisi yok | Door unavailable |
| `historyUnknownLocation` | Bilinmeyen Konum | Konum bilgisi yok | Location unavailable |
| `historyDetailCheckIn` | Giriş Detayları | Giriş ayrıntısı | Entry details |
| `historyDetailCheckOut` | Çıkış Detayları | Çıkış ayrıntısı | Exit details |
| `historyDetailQrCode` | QR Kod | QR kod | QR code |
| `historyFilterClear` | Filtreleri Temizle | Filtreleri temizle | Clear filters |
| `historyFilterDeviceSelectTitle` | Cihaz Seç | Kapı seç | Choose a door |
| `historyFilterDevice` | Cihaz | Kapı | Door |
| `historyAllDevices` | Tüm cihazlar | Tüm kapılar | All doors |
| `historyDayRecordCount` | {count} Kayıt | {count} kayıt | {count} records |
| `historyRawEvents` | Ham erişim hareketleri; resmi PDKS sonucu değildir. | Geçiş kayıtları gösterilir. Resmi devam ve çalışma süresi sonuçları farklı olabilir. | These are access records. Official attendance and working time results may differ. |
| `historyNoActivityHint` | Kayıtlar oluştukça özet burada görünür. Bu bir devamsızlık hesabı değildir. | Yeni kayıtlar burada görünecek. Kayıt olmaması devamsızlık anlamına gelmez. | New records will appear here. No records does not mean an absence. |
| `historyLoadedDevices` | Cihaz seçenekleri yüklenen kayıtlardan alınır. | Bu listedeki kayıtlarda yer alan kapılar gösterilir. | Doors appearing in this list of records are shown. |
| `historyNoDeviceOptions` | Yüklenen kayıtlarda cihaz bulunmuyor. | Bu kayıtlar için kapı seçeneği yok. | No door options are available for these records. |
| `historyCalendarLegend` | Çerçeve: bugün · Dolgu: seçili gün · Nokta: kayıt var | Noktalı günlerde kayıt var. | Days with a dot have records. |
| `qrFrameHint` | QR kodu kare içine yerleştirin | QR kodu çerçeveye alın | Place the QR code inside the frame |
| `qrReaderHint` | Bu kodu desteklenen okuyucuya gösterin. Süre sunucunun bitiş zamanına göre gösterilir. İşlem kaydı kapının açıldığını veya fiziksel geçişi doğrulamaz. | Kodu okuyucuya gösterin | Show the code to the reader |
| `qrDeviceIdentityOnly` | Bu bir cihaz kimlik etiketidir; geçiş yetkisi veya fiziksel bulunma kanıtı sağlamaz. Desteklenen okuyucuda QR’ım sekmesini kullanın. | Bu kod cihazı tanıtır; kapıyı açmaz veya geçiş kaydı oluşturmaz. QR Kodum sekmesindeki kodu uygun okuyucuya gösterin. | This code identifies a device; it does not open a door or record access. Show the code in My QR to a compatible reader. |
| `qrChallengeUnsupported` | Bu okuyucunun güvenli işlem akışı henüz desteklenmiyor. Desteklenen okuyucuda QR’ım sekmesini kullanın. | Bu okuyucuyla tarama yapılamıyor. QR Kodum sekmesindeki kodu uygun okuyucuya gösterin. | Scanning is not available with this reader. Show the code in My QR to a compatible reader. |
| `qrProcessError` | QR kod işlenirken bir hata oluştu: {error} | QR kod işlenemedi. Yeniden deneyin. | The QR code could not be processed. Try again. |
| `visitorEmptyHint` | Yeni bir davet oluşturmak için sağ üstteki Ekle düğmesini kullanın. | Ziyaretçi davet et düğmesiyle yeni bir davet oluşturun. | Use Invite a visitor to create an invitation. |
| `visitorAddTitle` | Yeni Ziyaretçi | Ziyaretçi davet et | Invite a visitor |
| `visitorAddButton` | Ziyaretçi Ekle | Ziyaretçi davet et | Invite a visitor |
| `visitorSave` | Kaydet | Daveti kaydet | Save invitation |
| `visitorSaved` | Davet kaydı kaydedildi; yetkili aktivasyonu gerekiyor. | Davet kaydedildi. Yetkili onayı bekleniyor. | Invitation saved. Approval is required. |
| `visitorSyncTitle` | Cihaz senkronizasyonu | Cihaz durumu | Device status |
| `visitorSummaryLimited` | Bu toplamlar alt sınırdır; özet okuma sınırına ulaşıldı. | Bazı davetler özete dahil edilemedi; gerçek toplam daha yüksek olabilir. | Some invitations could not be included; the actual total may be higher. |
| `visitorStale` | Yenilenemedi; önceki kayıtlar gösteriliyor. | Davetler yenilenemedi. Önceki davetler gösteriliyor. | Invitations could not be refreshed. Previously loaded invitations are shown. |
| `errorTimeout` | Sunucu yanıt vermedi. Lütfen daha sonra tekrar deneyin. | İşlem zamanında tamamlanamadı. Yeniden deneyin. | The operation did not finish in time. Try again. |
| `errorServer` | Sunucu hatası ({code}). Lütfen biraz sonra tekrar deneyin. | İşlem tamamlanamadı. Biraz sonra yeniden deneyin. | The operation could not be completed. Try again shortly. |
| `errorEmploymentEnded` | İşten ayrıldınız. Mobil erişiminiz kapatıldı. | Mobil erişiminiz kapatıldı. Kurum yöneticinize başvurun. | Your mobile access is disabled. Contact your organisation’s administrator. |
| `errorProtocol` | Geçerli bir sunucu yanıtı alınamadı. Lütfen yeniden deneyin. | İşlem tamamlanamadı. Yeniden deneyin. | The operation could not be completed. Try again. |
| `errorRequestDateInvalid` | Geçerli bir tarih girin (YYYY-MM-DD) | Geçerli bir tarih seçin. | Choose a valid date. |
| `errorCorrectionTimeInvalid` | Geçerli bir saat girin (HH:mm). | Geçerli bir saat seçin. | Choose a valid time. |
| `requestsCorrection` | PDKS düzeltme | Kayıt düzeltme | Record correction |
| `requestsWithdraw` | Geri çek | Talebi geri çek | Withdraw request |
| `requestsSubmit` | Gönder | Talebi gönder | Send request |

### Yeni anahtarlar

| Anahtar | Mevcut TR | Yeni TR | Yeni EN |
|---|---|---|---|
| `navQr` | — (yeni) | QR | QR |
| `homeToday` | — (yeni) | Bugün | Today |
| `homeFirstEntry` | — (yeni) | İlk giriş | First entry |
| `homePendingRequests` | — (yeni) | {count} bekleyen | {count} pending |
| `loginSigningIn` | — (yeni) | Giriş yapılıyor | Signing in |
| `fieldSelectDate` | — (yeni) | Tarih seçin | Choose a date |
| `fieldSelectTime` | — (yeni) | Saat seçin | Choose a time |
| `fieldSelectOption` | — (yeni) | Seçin | Choose an option |
| `requestsLeaveFormTitle` | — (yeni) | İzin talebi | Leave request |
| `requestsCorrectionFormTitle` | — (yeni) | Kayıt düzeltme talebi | Record correction request |
| `requestsLeaveSubmit` | — (yeni) | İzin talebi gönder | Send leave request |
| `requestsLeaveSubmitting` | — (yeni) | İzin talebi gönderiliyor | Sending leave request |
| `requestsLeaveSubmitted` | — (yeni) | İzin talebi gönderildi | Leave request sent |
| `requestsCorrectionSubmit` | — (yeni) | Düzeltme talebi gönder | Send correction request |
| `requestsCorrectionSubmitting` | — (yeni) | Düzeltme talebi gönderiliyor | Sending correction request |
| `requestsCorrectionSubmitted` | — (yeni) | Düzeltme talebi gönderildi | Correction request sent |
| `requestsWithdrawnToast` | — (yeni) | Talep geri çekildi | Request withdrawn |
| `requestsTimeZoneHint` | — (yeni) | Saatler Türkiye saatine göre girilir. | Enter times in Turkey time. |
| `visitorSaving` | — (yeni) | Davet kaydediliyor | Saving invitation |
| `visitorLoadFailed` | — (yeni) | Davetler alınamadı. Yeniden deneyin. | Invitations could not be loaded. Try again. |
| `visitorNoMatchTitle` | — (yeni) | Eşleşen davet yok | No matching invitations |
| `commonLoading` | — (yeni) | Yükleniyor | Loading |

### Silinecekler ve çağrı uyumluluğu

- D2a home quote widget’ı kaldırıldıktan sonra sil: `homeQuoteOfTheDay`, `homeQuote1`, `homeQuote2`, `homeQuote3`, `homeQuote4`, `homeQuote5`, `homeQuote6`, `homeQuote7`, `homeQuote8` — toplam9. D1’de önce silmek mevcut home derlemesini kırar; l10n sahibi bu silmeyi D2a handoff’unda yapar.
- `homeGreetingLine` placeholder’ları greeting/name String, `homeUpdatedAt` time String, `historyDayRecordCount` count int korunur. Yeni homePendingRequests count int; sıfır olduğunda satır “0 bekleyen” rozeti çizmez. TR/EN ARB metadata aynı tiplerle güncellenir.
- `errorServer` artık code placeholder’ı almaz: D1 sahibi `lib/core/error_localizer.dart:12` switch kolunu `ServerError _ => l10n.errorServer` yapar (kullanılmayan statusCode binding bırakılmaz); ServerError modelinin statusCode alanı ve sınıflandırması korunur. Sayısal teknik kod kullanıcı metnine eklenmez. `historyErrorBody` ve `qrProcessError` içinden error placeholder metadata’sı da kaldırılır; mevcut üretim çağrısı yoktur, D1 yine rg ile tüm çağrı/üretim dosyalarını kontrol eder.
- requestsSubmit genel eski getter olarak kalır; D3a iki form CTA’sını yeni requestsLeaveSubmit/requestsCorrectionSubmit anahtarlarına taşır. Böylece aşamalı migration sırasında derleme kırılmaz; yeni başarı snackbar’ları açıkça karşılıklarıdır.
- `historyTimeZone` eski getter korunabilir ama geçmiş/QR/listelerde **kullanılmaz**; tek görünür saat dilimi yardım metni yeni requestsTimeZoneHint’tir. `historyCalendarLegend` kısaltılmış görsel açıklama, selected/today semantics’in yerini almaz.
- Login yalnız loginTitle’ı görünür ana başlıkta kullanır; loginWelcomeTitle ve loginPrompt’un üçünü birlikte tekrar etmez. Şifre yardımı passwordHelpNoEmail uyarısını büyük kutu halinde tekrarlamaz, gerçek davranış değişmez.
- Nav’ın görünen QR etiketi **navQr**; erişilebilir label mevcut **qrTabTitle** değerini korur (TR “QR İşlemleri”, EN “QR Actions”). Mevcut navVisitor EN “Visitor” kalır. Görsel kısa etiketten ötürü semantik isimleri kırmak yasaktır.
- Üretilmiş `app_localizations*.dart` dosyaları elle düzenlenmez; ARB değişiminden sonra `flutter gen-l10n`. Ekran worker’ları l10n dosyalarına yazmaz, yeni getter’lar D1’den önce hazırdır. Eylem adı/gövde yerleşimi değişen metin finder testleri ilgili ekran dalgasında güncellenir; anlam/başarı koşulları değişmez.

## 7. Değişmeyecek davranışlar ve korunacak test anahtarları

### 7.1 Davranış invariants

| Alan | Korunacak sözleşme | Mevcut kanıt |
|---|---|---|
| Kapı komutu | Intent kalıcı, requestId/target aynı; açılışta yalnız status query; explicit retry önce query sonra aynı request ile resend; otomatik retry/yeni kimlik yok | `lib/providers/door_operation_provider.dart:224`, `:304`, `:348`; `lib/widgets/door_operation_recovery_dialog.dart:35` |
| Oturum sınırı | Async sonuç yalnız aynı sessionEpoch/token sahibi ekrana uygulanır; logout/account değişimi eski QR/dialog/ziyaretçi sonucunu görünür yapmaz | `lib/providers/auth_provider.dart:59`, `:74`; `lib/widgets/door_operation_recovery_dialog.dart:38`; `lib/providers/visitor_provider.dart:87` |
| Yerel hata | localizeAppError allowlist; backend message/body/exception.toString kullanıcıya gösterilmez; yalnız errorServer’ın sunum imzası §6’ya göre değişir | `lib/core/error_localizer.dart:7` |
| Türkiye saati | AttendanceDate iş günü anahtarı/offset/range doğrulaması korunur; AppDateFormat yalnız sunum ve explicit wall-clock dönüşümü ekler | `lib/core/attendance_date.dart:4` |
| Ziyaretçi tarih açığı | Mevcut `toLocal()` cihaz saatine bağlıdır; “koru” bu satırları korumak değil ürünün Türkiye saati kuralını korumaktır; D3b yalnız form/label adapter’larını düzeltir, wire instant sözleşmesi değişmez | `lib/widgets/visitor/visitor_labels.dart:22`, `lib/screens/visitor/visitor_form_screen.dart:58`, `:159` |
| Rota koruması | normalizeAppLocation/safeReturnTarget allowlist, auth retryableFailure guard, protectedPaths ve branch indexleri korunur; QR intent extra ile taşınır, korumayı delen yeni query allowlist yok | `lib/router/route_paths.dart:31`, `lib/router/app_router.dart:45` |
| Branch lifecycle | IndexedStack, BranchVisibility, visitor foreground/visible, kamera hidden/background stop; duplicate observer/refresh döngüsü eklenmez | `lib/screens/main_navigation_shell.dart:49`, `:64`; `lib/screens/qr_scan/qr_scan_screen.dart:209` |
| QR güvenliği | Reader challenge/device identity/employee identity gerçek yetki veya fiziksel geçiş sayılmaz; consumed/expired/unknown state, QrScanGate ve controller ownership korunur | `lib/screens/qr_scan/qr_scan_screen.dart:64`, `:81`; `lib/models/qr_code_model.dart` |
| Ziyaretçi create recovery | Pending draft, requestId, notice version/review ve reconcile receipt korunur; belirsiz sonuçta input kilidi ve aynı isteği tekrar dene | `lib/providers/visitor_provider.dart:358`, `:420`; `lib/screens/visitor/visitor_form_screen.dart:65` |
| Talepler | RequestValidation limitleri, server yetki/pending kontrolü, uncertain listeye dönüş, busy PopScope korunur; UI başarı cümlesi yalnız kesin success’te | `lib/screens/requests/requests_screen.dart:320`, `:376` |
| Geçmiş | Gün/filtre/ay/hafta epoch’ları, cursor pagination, erişim reddi≠çıkış, bilinmeyen yön≠çıkış, resmi puantaj iddiası yok | `lib/screens/history/history_screen.dart:29`, `lib/widgets/history/history_record_tile.dart:28` |
| Tercihler/clipboard | Tema/dil cihazda kalır, preferred-device yeniden doğrulanır; şifre yardımı yalnız kopyalar; destek raporu redaction/clipboard açıklaması korunur | `lib/screens/profile/profile_screen.dart:274`, `:335`, `:525`; `lib/screens/auth/forgot_password_screen.dart:20` |

D1–D3 UI worker’ları `providers/**`, `repositories/**`, `services/**`, modeller ve backend’e yazmaz. UI sözleşmesi bu katmanlarda değişiklik gerektirirse ayrı davranış görevi açılır; görsel dalganın içinde sessiz refactor yapılmaz. QR intent yalnız ekran/router katmanındadır.

### 7.2 Semantics geriye uyumluluğu

- Mevcut anlamlı label’lar, selected/enabled/liveRegion rolleri ve tap sayısı korunur. Görsel duplicate text kaldırılırken semantic bağlam atılmaz. `QuickActionCard` public API/adı uyumluluk wrapper’ı olarak kalabilir: “Open door, North entrance” tek button; disabled “Command pending, North entrance” tap action taşımaz (`test/widgets/home_cards_test.dart:269`, `:303`).
- Geçmiş kaydı label’ında kapı + tam tarih/saat + yön/ret birlikte kalır. Takvim görsel tarihi kısalsa bile spoken full date ve count kalır; EN “October 12, 2026 … 3 records” testi bozulmaz (`test/widgets/history_widgets_test.dart:69`). Kısa AppDateFormat.dayLabel, mevcut tam tarih semantics’inin yerine geçirilmez.
- Nav spoken etiketler aynı: Home / History / **QR Actions** / **Visitor** / Profile; TR mevcut navHome/navHistory/qrTabTitle/navVisitor/navProfile. Görsel QR kısa kalır; tooltip/semantic QR Actions, testler korunur (`test/router/app_router_integration_test.dart:307`).
- Loading/door status/visitor summary liveRegion yerleri korunur; aynı mesajı badge, row ve parent olmak üzere üç kez okumaz. Erişilebilir adı testte literal olan metin değişecekse önce bu belgedeki açık metin değişikliğiyle eşleştirilir; sadece testi geçirmek için semantics gizlenmez.
- Var olan screen/widget public constructor’ları test fixture enjeksiyonlarını korur; yeni kit içeride kullanılabilir. Örneğin QR camera/repository callback parametreleri, VisitorFormScreen `now`, HistoryScreen clock, AppBottomNavigation seçili indeks sözleşmesi silinmez.

### 7.3 Anahtar envanteri

İstenen `grep -rn "Key('" mobile/test` çalıştırıldı; `rg` ve `\b(?:Key|ValueKey)` ile constructor eşleşmeleri ayrıştırıldı. **20 benzersiz literal/şablon ifadesi** vardır; `app_nav_button_$index` için test döngüsünü 0..4 açınca **21 ayrı somut widget key** korunur: **13 üretim hedefi + 8 test fixture hedefi**. `containsKey('clearValue')`, `containsKey('mobile_preferred_device_id')`, `containsKey('mobile_preferred_device_name')` widget Key değildir ve sayıma dahil edilmez; depolama anahtarları da davranış kapsamında değiştirilmez.

| Korunacak ifade | Tip/kapsam | Test kanıtı |
|---|---|---|
| `app_nav_button_$index` | Üretim hedefi | `test/widgets/app_bottom_navigation_test.dart:90` |
| `app_nav_button_0` | Üretim hedefi | `test/widgets/app_bottom_navigation_test.dart:144` |
| `app_nav_button_2` | Üretim hedefi | `test/router/app_router_integration_test.dart:341` |
| `app_nav_button_4` | Üretim hedefi | `test/widgets/app_bottom_navigation_test.dart:146` |
| `content` | Fixture; testte kalır | `test/widgets/responsive_container_test.dart:27` |
| `first` | Fixture; testte kalır | `test/integration/app_composition_test.dart:698` |
| `fixture_create` | Fixture; testte kalır | `test/router/app_router_integration_test.dart:55` |
| `fixture_last_action` | Fixture; testte kalır | `test/router/app_router_integration_test.dart:65` |
| `history-apply-filters` | Üretim hedefi | `test/widgets/history_period_lifecycle_test.dart:269` |
| `history-day-2026-10-12` | Üretim hedefi | `test/widgets/history_widgets_test.dart:72` |
| `history-day-2026-10-19` | Üretim hedefi | `test/widgets/history_screen_test.dart:228` |
| `history-device-door-a` | Üretim hedefi | `test/widgets/history_period_lifecycle_test.dart:259` |
| `history-device-door-b` | Üretim hedefi | `test/widgets/history_screen_test.dart:262` |
| `history-load-more` | Üretim hedefi | `test/widgets/history_widgets_test.dart:140` |
| `last_content_action` | Fixture; testte kalır | `test/widgets/app_bottom_navigation_test.dart:49` |
| `outer-navigation` | Fixture; testte kalır | `test/widgets/history_screen_test.dart:376` |
| `qr-refresh` | Üretim hedefi | `test/widgets/qr_scan_screen_test.dart:282` |
| `second` | Fixture; testte kalır | `test/integration/app_composition_test.dart:706` |
| `visitor-add` | Üretim hedefi | `test/visitor_recovery_widgets_test.dart:45` |
| `visitor-outer-nav` | Fixture; testte kalır | `test/visitor_widgets_test.dart:40` |

Üretimdeki dinamik aileler de korunur: `history-day-<YYYY-MM-DD>`, `history-device-<deviceId>`, `ValueKey(record.id)`; list sıralansa da kimlik değişmez. `qr-token-scroll`, `qr-refresh-error`, `qr-status-error`, `PageStorageKey('history-records-scroll')` ve screenshot `audit-capture` doğrudan bu test taramasının sayısına dahil değil ama yeniden tasarımda korunur. Key tek render hedefte bulunur; aynı sayfada parent/child’a kopyalanmaz.

Test adı “floating navigation” gibi eski görsel dili anıyorsa ad güncellenebilir; son eylemin görünür/tıklanabilir olması assertion’ı kaldırılmaz. M3’ye geçiş için find.byType(ElevatedButton) gibi uygulama detayı finder’ı semantic label/key’e çevrilebilir; busy, auth, retry, focus ve tap-count assertion’ları zayıflatılmaz.

## 8. Dalga planı, tek dosya sahibi ve kabul kapıları

B1 yalnız bu belgedir. Aşağıdaki yazma listeleri **gelecek uygulama dalgalarının** sahipliğidir; bu çalışma mobile/src/convex üzerinde değişiklik yetkisi kullanmaz. B2 diğer ekranların mockup’larını hazırlayabilir; D1 API/token kararını sessizce değiştirmez.

### 8.1 Çakışmasız sahiplik

Bir dosyanın **tek kalıcı sahibi** vardır. DS sahibi D1 bittikten sonra da tema/ui/core formatter/l10n dosyalarının tek yazarı kalır; ekran worker’ları bu dosyaya “küçük düzeltme” yapmaz, ihtiyacı bildirir. D4 sahibi harness’i her dalga kapısında günceller; ekran worker’ları finder/harness dosyasına dokunmaz. Bu iki ortak sahip işi seri handoff ile uygular; aynı dosyaya paralel yazı yoktur.

| Dalga/sahip | Tek sahibi olduğu üretim dosyaları | Tek sahibi olduğu test/kanıt dosyaları | Giriş/çıkış |
|---|---|---|---|
| D1 / DS | Aşağıdaki kesin D1 listesi; `lib/l10n/**`, `lib/core/error_localizer.dart` dahil | `test/theme/app_theme_test.dart`, `test/widgets/app_bottom_navigation_test.dart`, `test/router/app_router_integration_test.dart`, yeni `test/ui_redesign/d1/**` | API/tema tamam; nav/SafeArea/klavye/ölçek kapıları geçer |
| D2a / erişim | `lib/screens/home/home_screen.dart`, `lib/screens/qr_scan/qr_scan_screen.dart`, `lib/screens/settings/select_device_screen.dart`, `lib/widgets/cards/attendance_status_card.dart`, `quick_action_card.dart`, `door_command_status_card.dart`, `progress_hero_card.dart`, `stat_card.dart`, `section_header.dart`, `lib/widgets/door_operation_recovery_dialog.dart`, `lib/router/app_router.dart`, `lib/router/route_paths.dart`, yeni `lib/router/qr_open_intent.dart` | `test/widgets/home_cards_test.dart`, `home_screen_test.dart`, `qr_scan_screen_test.dart`, `select_device_screen_test.dart`, `door_command_status_card_test.dart`, `door_operation_recovery_test.dart`; yeni `test/ui_redesign/d2a/**` | D1 API + bu dalganın l10n metin grubu hazır; QR intent, door recovery aynı davranışla geçer |
| D2b / kimlik-profil | `lib/screens/auth/login_screen.dart`, `forgot_password_screen.dart`, `lib/screens/splash_screen.dart`, `lib/screens/profile/profile_screen.dart`, `lib/widgets/brand_mark.dart` | `test/widgets/login_screen_test.dart`, `forgot_password_screen_test.dart`, `profile_screen_test.dart`; yeni `test/ui_redesign/d2b/**` | D1 sonrası D2a ile paralel; startup/auth/clipboard/tema-dil kaydı kapıları geçer |
| D3a / kayıt-talep | `lib/screens/history/history_screen.dart`, `lib/widgets/history/history_calendar.dart`, `history_filter_sheet.dart`, `history_record_tile.dart`, `history_records_list.dart`, `lib/screens/requests/requests_screen.dart` | `test/widgets/history_widgets_test.dart`, `history_screen_test.dart`, `history_period_lifecycle_test.dart`, `requests_screen_test.dart`; yeni `test/ui_redesign/d3a/**` | D1 ve route/kabuk arayüzü sabit; filtre taslağı/cursor/tarih/submit/withdraw geçer |
| D3b / ziyaretçi | `lib/screens/visitor/visitor_screen.dart`, `visitor_form_screen.dart`, `lib/widgets/visitor/visitor_cards.dart`, `visitor_detail.dart`, `visitor_labels.dart` | `test/visitor_widgets_test.dart`, `visitor_form_time_test.dart`, `visitor_recovery_widgets_test.dart`, `visitor_lifecycle_test.dart`, `visitor_create_recovery_test.dart`; yeni `test/ui_redesign/d3b/**` | D1 sonrası D3a ile paralel; Türkiye saati, notice, idempotent create, cancel erişim kuralı geçer |
| D4 / kabul-harness | `mobile/screenshot_test/_harness.dart`, `screens_screenshot_test.dart`, `README.md` (bu satırdaki yollar repo köküne göredir) | Yeni `mobile/test/ui_redesign/acceptance/**`, `docs/mobile-ui-audit/after-b/**`, son kabul raporu | Her dalgaya finder/çekim hizmeti, final simülatör/cihaz kabulü; mevcut current/ PNG’leri değiştirmez |

Tablodaki kısaltılmış aynı satır dosya adları, ilk dosyanın klasöründe değerlendirilir: örneğin D2a `widgets/cards/quick_action_card.dart`, D3b `widgets/visitor/visitor_labels.dart`. Açıkça farklı klasör yazıldığında o klasör kullanılır. Üretim `providers/**`, `repositories/**`, `services/**`, modeller, `core/attendance_date.dart`, `main.dart`, `pubspec.*` ve backend bu dalgaların yazma listesinde **yoktur**. Var olan `test/providers/**`, `test/repositories/**`, `test/services/**` ve `test/integration/app_composition_test.dart` read-only regresyon kapısıdır.

### 8.2 D1 kesin üretim dosya listesi

```text
mobile/lib/theme/app_theme.dart
mobile/lib/core/spacing.dart
mobile/lib/core/app_date_format.dart                         (yeni)
mobile/lib/core/error_localizer.dart                         (yalnız §6 sunum çağrısı)
mobile/lib/widgets/ui/app_ui_tokens.dart                     (yeni)
mobile/lib/widgets/ui/app_brand_band.dart                    (yeni)
mobile/lib/widgets/ui/app_page_header.dart                   (yeni)
mobile/lib/widgets/ui/app_status_badge.dart                  (yeni)
mobile/lib/widgets/ui/app_list_group.dart                    (yeni)
mobile/lib/widgets/ui/app_list_row.dart                      (yeni)
mobile/lib/widgets/ui/app_empty_state.dart                   (yeni)
mobile/lib/widgets/ui/app_data_notice.dart                   (yeni)
mobile/lib/widgets/ui/app_skeleton.dart                      (yeni)
mobile/lib/widgets/ui/app_primary_button.dart                (yeni)
mobile/lib/widgets/ui/app_secondary_button.dart              (yeni)
mobile/lib/widgets/ui/app_form_action_bar.dart               (yeni)
mobile/lib/widgets/ui/show_app_sheet.dart                    (yeni)
mobile/lib/widgets/ui/app_sheet.dart                         (yeni)
mobile/lib/widgets/ui/app_segment_control.dart               (yeni)
mobile/lib/widgets/ui/app_text_field.dart                    (yeni)
mobile/lib/widgets/ui/app_date_field.dart                    (yeni)
mobile/lib/widgets/ui/app_date_range_field.dart              (yeni)
mobile/lib/widgets/ui/app_time_field.dart                    (yeni)
mobile/lib/widgets/ui/app_select_field.dart                  (yeni)
mobile/lib/widgets/ui/app_bottom_navigation.dart             (yeni)
mobile/lib/widgets/ui/app_metric_row.dart                    (yeni)
mobile/lib/widgets/ui/app_dialog.dart                        (yeni)
mobile/lib/widgets/ui/app_scaffold.dart                      (yeni)
mobile/lib/widgets/ui/app_surface.dart                       (yeni)
mobile/lib/widgets/app_bottom_navigation.dart                (compat export)
mobile/lib/screens/main_navigation_shell.dart
mobile/lib/l10n/app_tr.arb
mobile/lib/l10n/app_en.arb
mobile/lib/l10n/app_localizations.dart                       (gen-l10n çıktısı)
mobile/lib/l10n/app_localizations_tr.dart                    (gen-l10n çıktısı)
mobile/lib/l10n/app_localizations_en.dart                    (gen-l10n çıktısı)
```

`core/breakpoints.dart`, `responsive_container.dart`, `responsive_card_grid.dart` D1’de salt okunur; yeni sayfalar max-width/spacing kurallarını kit içinde uygular. Mevcut container sınıfları kaldırılmaz. `AppUiTokens` theme klasörüne ikinci kopya olarak eklenmez; tek kaynak ui/app_ui_tokens.dart’dır. Aynı dosyada yardımcı `AppSegment`, `AppMetric`, `AppSelectOption`, `AppStatusColors` tipleri bulunabilir; ana public bileşen başına bir dosya kuralını bozmaz.

### 8.3 Bağımlılık ve l10n yayın sırası

1. **D4 hazırlık (tek harness sahibi):** mevcut current/’ı referans tutar; çıktı klasörünü configurable yapar, yeni B sonrasını ayrı after-b’ye yazar. D1 UI başlamadan bu küçük altyapı hazırlanabilir; D4 sahibi aynı dosyalara sonraki kapılarda yine tek başına yazar.
2. **D1:** token/ColorScheme/TextTheme → temel yüzey/button/field → modal/formatter → nav/kabuk. 22 yeni l10n getter eklenir; eski73 metin değişiminin kullanılmakta olan kısmı ilgili ekran dalgasıyla seri handoff’ta etkinleştirilir. D1’de tüm copy’yi bir anda değiştirip D2/D3 eski literal testlerini kırmak yok.
3. **D2a || D2b:** API sabitken paralel. DS tek sahibi, her birinin hazır copy paketini ekran/test değişimleriyle birlikte uygular; D2a sonunda quote9 silinir. errorServer getter değişimi ve core/error_localizer tek sahibi DS tarafından aynı metin paketi penceresinde atomik uygulanır.
4. **D3a || D3b:** geçmiş/talepler ve ziyaretçi ayrı dosyalarda; DS yalnız kalan l10n paketlerini teslim eder. Çakışan l10n/harness işleri sıraya alınır. Uygulama worker’ı “başkasının dosyasını düzeltme” yapmaz.
5. **D4 final:** tüm durumları karşılaştırır; TR/EN, açık/koyu,1/1,3/2,0 ölçek,320/390/tablet; simulator ve fiziksel cihaz. D4 görsel hata bulursa dosya sahibine döndürür; üretim dosyasına kendi yaması girmez.

### 8.4 Screenshot harness kırılacak noktalar

| Dosya:satır | Mevcut finder/varsayım | Güncelleme / sahibi |
|---|---|---|
| `mobile/screenshot_test/screens_screenshot_test.dart:449`, `:453` | Login TextFormField.at(0/1) | AppTextField altında gerçek TextFormField korunur; sıralama değiştirilirse yeni stable form key’lerine geç; D4, D2b handoff |
| `:460` | Request tek `find.byType(TextField)` | AppTextField’in FormField içine geçmesiyle birden fazla iç alan olabilir; `request-notes` / `request-reason` yeni alan key’i + descendant editable finder; D3a key’i ekler, D4 finder’ı günceller |
| `:469` | `find.text('Giriş: HH:mm')` | `request-check-in-time` stable key; AppTimeField açılır, native picker Tamam kalır; D4 |
| `:475` | `find.text('Gönder')` | Yeni requestsLeaveSubmit/requestsCorrectionSubmit getter’ı ya da `request-submit` key; D4 |
| `:479` | `find.text('PDKS düzeltme')` | Yeni “Kayıt düzeltme”/yerel getter; D4 |
| `:482`, `:485`, `:488` | Özet/Takvim/Tara metinleri | Getter’lar korunur; yeni AppSegmentControl üzerinden seçili state doğrulanır, byType(Tab) beklentisi eklenmez; D4 |
| `:493` | HomeScreen bağlamında DoorOperationRecoveryDialog | Sınıf/constructor korunur, AppDialog iç görünümü değişir; D4 fixture aynı commands/auth sağlar |
| `:501` | History filter byTooltip(historyFilterTitle) | AppPageHeader/filter action tooltip aynen korunur; D4 yalnız yerleşim beklemesini günceller |
| `:509` | `find.text('İpek Şahin')` | Liste+sheet duplicate olursa yalnız liste satırına scoped finder; ad fixture değişmez; D4 |
| `:518` | Bütün Scrollable’larda en büyük maxScrollExtent | Segment yatay scroll’u dışlanmaya devam eder; long capture yalnız aktif ana dikey scroll’a bağlanır, sheet/arka branch extent’i seçilmez; D4 |
| `:427`–`:433` | Insets47/34, yalnız textscale130 | 200 varyantı ve EN ekle; nav SafeArea ikinci34 eklemediğini kontrol et; D4 |
| `mobile/screenshot_test/_harness.dart:31`, `:366` | audit-capture + mevcut current/ golden path | captureKey korunur; `AUDIT_OUTPUT_DIR` define ile çıktı seçimi; immutable before ile after-b ayrılır; D4 |
| `mobile/screenshot_test/_harness.dart:122` | Attendance fixture summary | firstEntry/lastEntry/lastExit doğru ayrı değerler; first08:52,last13:14; gerçek kaynak alanında veri yoksa fake door etiketi icat etmez; D4 |
| `mobile/screenshot_test/README.md:1` | current/’a yazan tek komut | before karşılaştırma ve after-b üretim komutlarını ayrı yaz; yeni keys/locale/textscale durumu dokümante et; D4 |

Yeni önerilen request form key’leri mevcut key’lerin yerini almaz, eklenir. `request-notes`, `request-reason`, `request-check-in-time`, `request-check-out-time`, `request-submit` sahibi D3a’dır. Aynı anda tek form açık olduğu için widget key çakışması yaratılmaz. Capture golden dosyası güncellendi diye hata çözülmüş sayılmaz; önce/sonra PNG’ler insan tarafından incelenir.

### 8.5 Her dalganın çalıştıracağı kapı komutları

Komutlar gelecek uygulama içindir; B1’de Flutter kodu değişmediğinden çalıştırılmadı. Repo kökünden `cd mobile` ile girilir; yeni paket kurulmaz. `--no-pub` mevcut lock/dependency kurulumunu kullanır.

```sh
cd mobile
flutter gen-l10n
flutter analyze --no-pub
flutter test --no-pub
```

D1’e özgü anlamlı kabul (dosyalar D1 tarafından eklenir):

```sh
flutter test --no-pub test/theme/app_theme_test.dart test/widgets/app_bottom_navigation_test.dart test/ui_redesign/d1/
TZ=UTC flutter test --no-pub test/ui_redesign/d1/app_date_format_test.dart
TZ=America/New_York flutter test --no-pub test/ui_redesign/d1/app_date_format_test.dart
```

Tarih testleri cihaz timezone’undan bağımsız aynı Türkiye gününü verir; 20:59Z/21:00Z gün sınırı, ay/yıl değişimi, kalender day double-shift olmaması, range tersliği, TR/EN ve visitor picker parts→instant round-trip kapsanır. Nav testleri320×568/390×844/1024×768, scale1/1,3/2,0, TR/EN, keyboard/safeArea, beş eşit hedef, selected semantics ve son eyleme ulaşmayı kapsar. Field+sheet testleri klavye açık son hata/CTA görünürlüğü, kapanınca focus restore, busy duplicate tap engeli, disableAnimations ve tüm tone çiftlerinin metin kontrastını doğrular. Salt implementation değerlerini tekrar eden test yerine bu davranışlar ölçülür.

D4 harness sahibi §8.4’teki yeni çıktı parametresini **uyguladıktan sonra** her dalganın ekran kanıtı:

```sh
flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/
flutter test --no-pub --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/
```

Bu define mevcut harness’te henüz desteklenmiyor; hazırlık tamamlanmadan komutu çalıştırmak mevcut `current/` görsellerini ezebilir, dolayısıyla o noktada çalıştırılmaz. D4 hazırlık tesliminin testi: define’ın resolve edilen dizinini açıkça doğrula, yanlış/boş hedefte current/’a sessiz fallback yapma. Golden path test dosyasına göre normalize edilir. Before `current/` bundan sonra salt okunur.

D2a ek kapısı: tarama CTA’sı cold ve retained QR branch’te Tara’yı açar; yalnız görünür/resumed/izinli olduğunda kamera başlar; recovery open yalnız query yapar, explicit retry aynı requestId/target kullanır. D2b: auth failure/clipboard/tercih save yerel mesajları. D3a: selected filters iptalde değişmez, uncertain başarı olmaz. D3b: timezone bağımsız ziyaret zamanı, pending create kilidi, eski session async sonucu etkisiz. Bunların mevcut testleri tam suite içinde ayrıca korunur.

**D4 insan kabulü:** iOS/Android simülatöründe status bar ikonları, keyboard/gesture inset, VoiceOver/TalkBack tek eylem sırası; fiziksel cihazda QR okuyucu ve gerçek kamera davranışı. UI mockup gerçek kapı komutu göndermek için yetki değildir; fiziksel kapı senaryosu ayrı test ortamı/izinle yürütülür. Başarısız veya henüz çalıştırılmamış cihaz kontrolü raporda açık kalır.

### 8.6 D1 bitti sayılma ölçütü

- Tüm güncel ColorScheme rolleri elle dolu; pembe neutral surface yok, ikinci bordo yok; tüm26 public sözleşme ve defaults mevcut.
- Tema, semantik çiftler ve field/datepicker/checkbox/radio/select/nav yüzeyleri açık/koyuda aynı kuralları uygular; focus görünür.
- Kabuk nav yüksekliğini ayırır, son eylem ve klavye üstü footer erişilebilir; 48dp hedef/64dp satır ve1,3/2,0 taşmasızlık sağlanır.
- Mevcut key ve semantics invariant’ları, tüm regresyon testleri geçer; UI worker test beklentisini davranışı zayıflatarak değiştirmez.
- Analyze0, tam test suite0 failure; B sonrası screenshot’lar ve durum listesi D4 sahibiyle alınır. Ekranların B kompozisyonuna geçişi D2/D3 işidir, D1 tamamlandı diye hepsi dönüştürülmüş sayılmaz.

**Açık ürün sorusu yok.** Koyu nötr ekranın status bar istisnası, kaynak verisi olmayan kapı adının gizlenmesi, QR intent’in extra ile taşınması ve göreli efor sahipliği bu belgede karara bağlanmıştır. B1 teslim kontrolü: yalnız DESIGN_B.md yazıldı; `git diff --stat -- mobile` boş, mevcut untracked `mobile/screenshot_test/` değişiklik kapsamına alınmadı.

## Ek — koordinatör kararları (D1 sonrası, 2026-11-04)

- **l10n ekleri (§6'ya ek):** `qrGrantCameraPermission`, `startupBandTitle`, `startupFailureTitle`, `historyRecordDetailTitle`, `profileAccountSection`, `profilePreferencesSection`, `profileSupportSection` (GAPS GB-01/02 + D2b) ve fix1: `fieldNoOptions`, `metricNoRecord`, `fieldClear`. EN `historyDayRecordCount` ICU plural korunur ("1 record").
- **l10n sahipliği (§8.3 yerine):** tüm metin değişiklikleri D1'de tek seferde uygulandı; ekran worker'ları ARB'ye yazmaz, yeni anahtar `ask` → koordinatör/DS ekler.
- **API ekleri (§4'e ek):** `AppTextField(autocorrect, enableSuggestions, floatingLabelBehavior, errorMaxLines)`, `AppBrandBand(brandMark)`.
- **Harness:** `mobile/screenshot_test/**` tek sahibi DS worker'ı; çıktı klasörü `--dart-define=AUDIT_OUTPUT_DIR=...`, `current/` önce görüntüleridir.
- **§5.9 Takvim (D3a denetimi sonrası, 2026-11-04):** gün dokunuşu mevcut callback'i korur (Kayıtlar sekmesine o güne filtreli geçer); Takvim sekmesinde seçili günün kayıt grubu gösterilmez (filtreli/sayfalı listeden türetilen grup yanlış "kayıt yok" diyordu). Izgara eşiği: hücre genişliği ≥ 44dp (yükseklik 48dp) → 360/375dp ızgara, 320dp ve %200 dikey liste. Özet bilinmiyorken (yükleniyor/hata) gün sayısı okunmaz.
- **§5.10 Özet:** backend kapı bazında toplam vermediği için kapı listesi yok (sayfalı kayıtlardan toplam üretilmez); "Giriş günü" = entryCount>0 günleri.
- **§5.16 Ziyaretçi özeti:** metrik etiketi `visitorMetricPending` "Onay bekliyor"/"Pending" (satır rozeti `visitorPendingShort` "Aktivasyon bekliyor" kalır). AppMetricRow etiketleri sarılmaz; sığmazsa dikey (D1 kuralı).
