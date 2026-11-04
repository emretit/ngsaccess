# D2b — Açılış, giriş, şifre yardımı ve profil

## Değişiklikler

- Üretim: `lib/screens/splash_screen.dart`, `lib/screens/auth/login_screen.dart`, `lib/screens/auth/forgot_password_screen.dart`, `lib/screens/profile/profile_screen.dart`, `lib/widgets/brand_mark.dart`.
- Açılış ve giriş `AppScaffold` + `AppBrandBand`; hata bandı gerçek durumu söyler. Form kartı, gradyan ve gölge kaldırıldı; logo için `BrandMark.band` eklendi.
- Giriş: kalıcı etiketli kit alanları, korunan autofill/next/done, ilk hataya focus, birleşik hatırla kontrolü, form içinde `AppDataNotice`, busy “Giriş yapılıyor”; remembered-email/session-epoch/duplicate-submit davranışları korundu.
- Şifre yardımı: kısa süreç grubu, seçilebilir ayrı talep yüzeyi, kit eylemleri; gerçek clipboard başarısı/başarısızlığı aynı mesajlarla bildirilir.
- Profil: 48dp avatar + kompakt kimlik, Hesap/Tercihler/Destek grupları, danger çıkış satırı; kurum/proje etiketi görsel ek satır yerine erişilebilir ad olarak korunur. Tema/dil kit sheet’inde seçili radio, busy kilidi, kaydetme hatasında açık kalma; alt sayfalar, şifre formu ve destek kopyalama/temizleme kit diliyle.

## Kapılar ve kanıt

- `flutter analyze --no-pub`: ilk tam ağaç turu 0; son tam ağaç turunda yalnız DS yeni `test/ui_redesign/d1/date_range_field_test.dart:2` ve `metric_row_layout_test.dart:2` unnecessary_import info kayıtları vardı (`/tmp/d2b-analyze-final.log`). Sahip olunan **9 analiz hedefi: No issues found** (`/tmp/d2b-analyze-owned.log`); bu worker ortak dosyalara yazmadı.
- `flutter test --no-pub`: son tüm-ağaç turu **746 geçti / 20 başarısız** (`/tmp/d2b-suite-final.log`): 19 profil fixture semantics-handle temizliği hatası bu worker tarafından düzeltildi; kalan DS `fix1_test.dart:683` ters tarih aralığı testi sahibinin sürmekte olan fix1 işidir. Koordinatör mesajı `msg_f118d21c9697` ile son tam suite kapısını DS bittikten sonra kendisi üstlendi; D2b teslimi, bu açık handoff kararıyla güncel sahip olunan analyze/testler ve çekimlere dayanır.
- İlk tüm screenshot harness turu **76/76** (`/tmp/d2b-shots.log`), çıktı `/tmp/mui-d2b`; `current/` değiştirilmedi. Son ekran kompozisyonu hedef çekimi **14/14** (`/tmp/d2b-shots-final.log`), son tam genişlikli secondary düzeltmesi sonrası startup/password-help çekimi **5/5** (`/tmp/d2b-secondary-shots.log`), ilave sheet/%130 hata çekimi **4/4** (`/tmp/d2b-extra-shots-final.log`) geçti; toplam **80 PNG** var.
- Son D2b hedef turu **42/42** (`/tmp/d2b-target-final.log`): `flutter test --no-pub test/widgets/login_screen_test.dart test/widgets/forgot_password_screen_test.dart test/widgets/profile_screen_test.dart test/ui_redesign/d2b`; kapsam: startup 320px/%200 TR/EN açık/koyu, erişim kapalı giriş %130 açık/koyu, tema seçili state açık/koyu, mevcut profil/clipboard davranışları ve yeni clipboard-rejection testi.
- İlave yeni testler: `test/ui_redesign/d2b/splash_screen_test.dart`, `presentation_test.dart`; tema busy/geri kilidi mevcut profil test dosyasında. Eski login testleri %200/320px/klavye, autofill, hatırla, visibility, gerçek sign-in ve yinelenen submit kontrollerini korur.

## Mevcut assertion/finder uyarlamaları

Yollar mobile/ altındadır; auth/provider/repository davranış assertion’ları kaldırılmadı.

- `test/widgets/login_screen_test.dart:88,99,165,170,182,185,208,232,291,292`: ElevatedButton → kitin FilledButton finder/tipi. `:167`: SnackBar görsel container’ı → AppDataNotice; aynı hata metni ve retry-enabled assertion’ı korunur. Fixture debug banner kapalı.
- `test/widgets/forgot_password_screen_test.dart:46,64,67`: kit ThemeData fixture + FilledButton finder; clipboard verisi/başarı mesajı ve sign-in call sayısı aynı.
- `test/widgets/profile_screen_test.dart:87`: AppTheme fixture; `:116,117` hesap eylemi “Security” → “Change password”; `:288` AlertDialog → AppSheet; `:395,415,465,533,568` kaldırılan üst yardım ikonu yerine aynı yardım satırına ensureVisible+tap; `:155,194` proje etiketi görünür Text yerine erişilebilir adla aranır. Proje değeri, department dışlama ve hesap değiştirme kontrolleri aynıdır; semantics handle ilgili iki test gövdesinde dispose edilir.
- Ownership dışı `test/integration/app_composition_test.dart:304,416` iki ElevatedButton → FilledButton finder’ı koordinatör tarafından değiştirildi; bu worker yazmadı.

## Görsel inceleme ve sınırlar

- `/tmp/mui-d2b` login açık/koyu/hata/%130, startup hata, password-help ve profil görüntüleri B `_shots` referanslarıyla `view_image` kullanılarak incelendi. %130 girişte taşma yok; %200 klavyeli TR/EN akışı mevcut widget testlerinde erişilebilir.
- HTML yerine DESIGN_B kit sözleşmesi esas: kalıcı alan etiketleri konturda floating-always; süreç açıklaması AppListGroup içinde; marka satırında logo; profil ve sheet başlık/seçenekleri mevcut yerelleştirme anahtarlarının tam metinlerini kullanır. Startup hata bandının “Başlatılıyor” yerine “Başlatılamadı” olması görevin açık düzeltmesidir.
- Ek tema sheet çekimleri bağımsız A Test fixture’ıdır (shell/nav içermez); ana profil açık/koyu çekimleri Ayşe Yılmaz + gerçek audit proje fixture’ı ve shell/nav ile alınmıştır.
- Fiziksel cihaz ve VoiceOver/TalkBack kontrolü bu widget/screenshot turunda yapılmadı; D4 insan kabulüne kalır.

## Koordinatöre istenen ortak değişiklikler

- `AppTextField`: autocorrect, enableSuggestions, floatingLabelBehavior, errorMaxLines; `AppBrandBand`: brandMark slotu; `startupFailureTitle` TR “Başlatılamadı” / EN “Unable to start”. Koordinatör DS adına uyguladı; ortak dosyalara bu worker yazmadı.
- Sonraki DS turunun AppSheet `scopesRoute` assertion’ı bildirildi; DS `explicitChildNodes:true` ile düzeltti. Geçici D2a getter/lint ve DS isLargeText derleme hataları sahiplerine ayrıldı; sahip olunan son kapılar güncel ağaçta yeşil; son tüm-ağaç kapısı koordinatördedir.

## fix1 — RV2-03 / 04 / 05 / 09 / 11

- `lib/screens/profile/profile_screen.dart:264,324`: mevcut `AppSheet(busy: provider.isSaving)` bağlantısı DS'nin busy drag kilidini kullanır; `showAppSheet` normal sürükleme davranışı korunur. `test/widgets/profile_screen_test.dart:277` tema/dil için bekleyen writeGate sırasında hem sheet gövdesine hem başlığına 500dp/1000 fling uygular; sheet açık kalır, kayıt tamamlanınca kapanır (2/2 özel drag testi).
- `lib/screens/auth/login_screen.dart:203,231`, `lib/screens/profile/profile_screen.dart:707`: CheckboxListTile gap8/minLeading0/contentPadding0/minHeight48; CheckboxTheme yatay density -4 yalnız kutunun iç boşluğunu azaltır, ListTile standard density ile gerçek 8dp boşluğu korur. Şifre yardımı TextButton yatay padding0/min48; `test/widgets/login_screen_test.dart:84` alan hizasını, gerçek boşluğu ve 48dp hedefleri ölçer, mevcut Android touch-target testi de korunur.
- `lib/screens/profile/profile_screen.dart:392`: çıkış onayı `AppDialog(destructive:true)`; pop → signOut sırası aynı. `test/widgets/profile_screen_test.dart:330` iptalde auth/call-count korunmasını, onayda tek signOut çağrısını doğrular.
- `lib/screens/auth/forgot_password_screen.dart:77`: dürüst “e-posta göndermez” açıklaması süreçten hemen sonra, alıntı ve eylemlerden önce info AppDataNotice. Mevcut clipboard testi notice konumunu da ölçer; kopyalama davranışı değişmez.
- `lib/screens/profile/profile_screen.dart:446,458,556`: bağımsız destek sayfasında gövde başlığı gizli; başlık yalnız Yardım içindeki destek bölümünde görünür. Şifre sayfası tek “Şifreyi değiştir” başlığı kullanır; formdaki tekrar kaldırıldı; `test/widgets/profile_screen_test.dart:371` başlık/eylem sayılarını doğrular.
- İlk hedef turunda yeni geometri testi ListTile'ın negatif density ile gap'i de azalttığını yakaladı; density CheckboxTheme'e taşındı ve düzeldi. Logout testinde başlık/confirm aynı yerelleştirilmiş metni kullandığı için finder OutlinedButton'a scope edildi; davranış assertion'ları zayıflatılmadı.
- Fix1 hedef testleri **39/39**, ayrıca başlıktan/gövdeden drag testleri **2/2** yeşil (`/tmp/d2b-fix1-target.log`, `/tmp/d2b-fix1-drag.log`). Tam `flutter analyze --no-pub` **No issues found**, 33,3 saniye (`/tmp/d2b-fix1-analyze.log`). Tam test turunda D3b `test/ui_redesign/d3b/visitor_layout_test.dart:148` dosyasındaki “Vazgeç” için OutlinedButton finder’ı dört light/dark × 390/%100 ve 320/%200 varyantında başarısız; bu dosyaya yazılmadı. **Tam test sonucu: 816 geçti / 4 başarısız**, 7 dakika 16 saniye; dört hata da yalnız bu D3b finder'ına ait, D2b kaynaklı başarısızlık yok (`/tmp/d2b-fix1-suite.log`).
- Bu turda ortak kit/tema/core/l10n/harness ve D3 dosyalarına yazılmadı; showAppSheet için ek bağlama gerekmiyor. Yeni l10n ya da kit isteği yok; DS AppSheet busy GestureDetector düzeltmesi tüketiliyor.
