# Mobil UI Yön B — D4 kabul raporu

4 Kasım 2026 · Codex D4a · Sonuç: **otomatik kapılar yeşil; cihaz kabulü ve ekran sahibi kararları ayrıca açık**.

## Kapılar ve kanıt

[Kalıcı doğrulama özeti](after-b/verification.txt).

| Kapı | Sonuç | Kanıt |
| --- | --- | --- |
| `flutter analyze --no-pub` | 0 issue · No issues found | `/tmp/d4-analyze-final.log` |
| `flutter test --no-pub` | 864/864 yeşil (856 − 4 ölü test + 12 yeni kabul testi) | `/tmp/d4-full-tests.log` |
| `flutter test --no-pub test/l10n` | 2/2 yeşil | `/tmp/d4-l10n-tests.log` |
| Yeni kit kabul testleri | 12/12 yeşil | `/tmp/d4-acceptance-tests.log` |
| Harness üretim | 294/294 yeşil | `/tmp/d4-harness-final.log` |
| Harness golden karşılaştırma | 294/294 yeşil | `/tmp/d4-harness-compare.log` |

After-b kökünde **294 PNG**; [tam durum/dil/tema/ölçü matrisi](after-b/INDEX.md). `current/`, `after-d1/`, `after-d2/` hedeflerine yazılmadı; harness bu hedefleri artık reddeder. UI katalogları iki PNG'dir. Karşılaştırma levhaları `after-b/comparisons/*.jpg` olup ekran PNG sayısına dahil değildir.

Ana ekranlar login/home/history/requests/visitor/profile/qr için 7×2 dil×2 tema×2 genişlik×3 ölçek = **168 çekim**. TR/EN, açık/koyu, 320/390dp ve 1.0/1.3/2.0 tam çarpımı vardır. Ek durumlar formlar/diyaloglar/sheet'ler, 360dp takvim ızgarası, 320dp takvim listesi, kapı sonucu belirsizliği, ziyaretçi alan/onay hatası, cache'li/cache'siz hata ve profil alt sayfalarıdır.

## Kit ve 1d bağımsız Codex denetimi

- Yeni `AppCheckboxRow({required String label, required bool value, required ValueChanged<bool?>? onChanged, String? errorText, FocusNode? focusNode})`; `ui.dart` export. Kutu alan kenarında, etiket aralığı 8dp, min48dp satır; tek checked/label/enabled semantics düğümü, hata aynı etikete bağlı ve liveRegion. Tam satır/tıklama ve klavyeden Space tek callback üretir; disabled tap action yoktur. Login hatırlama, profil şifre görünürlüğü ve ziyaretçi notice onayı aynı state/callback/focus/key ile bağlandı. Autofill alanları değiştirilmedi.
- `AppDateField`, `AppDateRangeField`, `AppTimeField` isteğe bağlı `DateTime Function()? now` alır, varsayılanı `DateTime.now`dır. Native date/range picker currentDate ve boş date initialDate Türkiye iş gününü fixture'dan alır; TimeField'in mevcut boş başlangıç 09:00 davranışı korunur. Visitor `_now` dört alana, request form `_now` bütün date/time alanlarına geçirilir. `RequestFormScreen({required bool isLeave, DateTime Function()? now})` mevcut constructor çağrılarını korur; varsayılan tarihler/validation aynı saat kaynağını kullanır.
- `AppSegmentControl`: 2–3 segment etiketleri ölçülür; büyük yazı veya yetersiz genişlikte tam genişlik dikey rail vardır. Yatay scroll yok; tam etiket/selected semantics, check ve klavye sağ/sol korunur, yukarı/aşağı da aynı seçimi taşır. %200 TR/EN iki/üç seçenek 320/390dp test edildi.
- **1d: AppTextField.showCounter** doğru: `buildCounter` yalnız sayaç satırını gizler; native maxLength formatter ve FormField validator kalır. Koordinatörün testleri default sayacı ve 5 karakter sınırını doğrular; kabul turunda yeniden yeşil. Bulgu/düzeltme yok.
- **1d: AppListRow.supporting** doğru: subtitle altında aynı x hizasında; 390/%100 ve 320/%200 taşmasız. Ek bağımsız test supporting metninin row semantics içinde kaldığını ve satır tıklamasını bir kez tetiklediğini doğrular. Bulgu/düzeltme yok.
- **1d: DoorOperationRecoveryDialog yalnız Kapat** doğru: `canRetry=false` iken confirmLabel/onConfirm null; tek secondary Kapat ve primary yok. Açılış bir status query yapar; resend eklenmez. 12 kabul testinden biri bunu doğrudan doğrular; gerçek idempotency/sessionEpoch regresyon testleri değişmedi. Bulgu/düzeltme yok; dialog üretim dosyasına ek yama gerekmedi.

## Temizlik kanıtı

Her silmeden önce `grep -rnE` / anahtar başına `grep -rnw` lib/test/screenshot_test üzerinde çalıştırıldı. Geçici kanıtlar: `/tmp/d4-dead-widget-references.txt`, `/tmp/d4-dead-parameter-references.txt`, `/tmp/d4-unused-arb-references.txt`, `/tmp/d4-table-calendar-references.txt`.

**5 dosya silindi:** `widgets/cards/quick_action_card.dart`, `progress_hero_card.dart`, `stat_card.dart`, `section_header.dart`, `widgets/responsive_card_grid.dart`. Üretim tüketimi yoktu; grid yalnız silinen hero ve testlerdeydi. **4 yalnız ölü widget testi** silindi: eski action grid reflow, busy QuickAction semantics, normal QuickAction tap ve ProgressHero sınır değerleri. Karma dört TR/EN×tema testi içindeki yaşayan AttendanceStatusCard saat/320dp/%200 kontrolleri korunup yalnız ölü kart kısmı çıkarıldı. DoorCommandStatusCard ve AttendanceStatusCard yaşar; kullanılmayan `AttendanceStatusCard.onScan` ve tek test helper argümanı kaldırıldı. Ölü kart `@Deprecated` işaretleri ve kalan dosya düzeyi deprecated suppression kalktı; kapsam dışı tema uyumluluk sabitleri değiştirilmedi.

`BrandMark` yalnız kullanılan `BrandMark.band({Key? key})` API'sine indi; kullanılmayan size/onDark ctor parametreleri ve ulaşılmayan çizim/tema seçimi kaldırıldı. `table_calendar` import taraması boştu; pubspec'ten kaldırıldı ve pub get lock'tan `table_calendar` + transitif `simple_gesture_detector` paketlerini çıkardı.

**115 kullanılmayan ARB anahtarı**, metadata'larıyla TR+EN ve expected_keys listesinden silindi; `flutter gen-l10n` çalıştırıldı. Lib'de referansı olmayan 118 adayın **3'ü test sözleşmesi nedeniyle korundu**: `historyWeeklyTotalRecords` (ICU plural testi), `unlockGranted` (kapı komutu başarı iddiasının negatif regresyon assertion'ları), `visitorPreRegistered` (eski aktivasyon metninin görünmediği assertion). Bunlar lib/test/screenshot_test birleşik taramasında kullanılır; davranış testleri sırf anahtar temizliği için değiştirilmedi.

Silinen anahtarlar:

- `appTagline`
- `pdksTitle`
- `pdksSubtitle`
- `commonError`
- `commonSuccess`
- `commonAdd`
- `comingSoon`
- `loginWelcomeTitle`
- `loginPrompt`
- `loginRememberMe`
- `forgotPasswordTitle`
- `forgotPasswordHeadline`
- `forgotPasswordPrompt`
- `forgotPasswordSendButton`
- `forgotPasswordBackToLogin`
- `forgotPasswordSuccessTitle`
- `forgotPasswordSuccessBody`
- `forgotPasswordSuccessButton`
- `homeAttendanceStatus`
- `homeScanCheckIn`
- `homeScanCheckOut`
- `homeScanCheckInAgain`
- `homeMonthSummary`
- `homeStatTotalDays`
- `homeStatDaysPresent`
- `homeStatTimesLate`
- `homeProgressLabel`
- `homeQuoteOfTheDay`
- `homeQuote1`
- `homeQuote2`
- `homeQuote3`
- `homeQuote4`
- `homeQuote5`
- `homeQuote6`
- `homeQuote7`
- `homeQuote8`
- `profileSecurity`
- `profileSecuritySubtitle`
- `profileThemeDark`
- `profileThemeLight`
- `profileThemeSystem`
- `homeQuickActions`
- `quickActionVisitor`
- `quickActionHistory`
- `profileAppVersion`
- `profileLogoutSubtitle`
- `profileSettings`
- `profileSettingsBody`
- `profileNotificationsDialogTitle`
- `profileSecurityDialogTitle`
- `profileThemeDialogTitle`
- `profileThemeDialogBody`
- `profileLanguageDialogTitle`
- `profileLanguageDialogBody`
- `profileAboutLine2`
- `profileAboutLine3`
- `historyErrorBody`
- `historyColorLegend`
- `historyLegendEarly`
- `historyLegendEarlyDesc`
- `historyLegendNormal`
- `historyLegendNormalDesc`
- `historyLegendLate`
- `historyLegendLateDesc`
- `historyLegendNone`
- `historyLegendNoneDesc`
- `historyCalendarHint`
- `historyTotalCheckIns`
- `historyTotalCheckOuts`
- `historyGeneralStats`
- `historyWeeklyCheckIn`
- `historyWeeklyCheckOut`
- `historyDeviceStats`
- `historyCheckInRecord`
- `historyCheckOutRecord`
- `historyBadgeIn`
- `historyBadgeOut`
- `historyUnknownLocation`
- `historyDetailCheckIn`
- `historyDetailCheckOut`
- `historyDetailQrCode`
- `historyFilterDateNone`
- `historyFilterDeviceNone`
- `historyFilterDeviceSelectTitle`
- `qrInvalidResponse`
- `qrTokenMissing`
- `qrTokenHint`
- `qrProcessError`
- `qrUserCodeTitle`
- `qrUserCodeBody`
- `qrAccessGranted`
- `qrUnknownError`
- `qrDeviceLine`
- `qrLocationLine`
- `qrTimeLine`
- `visitorStatInside`
- `visitorStatExpected`
- `visitorStatusExpected`
- `visitorStatusInside`
- `visitorStatusOut`
- `visitorContactPerson`
- `visitorCheckOut`
- `visitorCheckIn`
- `visitorCheckedInToast`
- `visitorCheckedOutToast`
- `visitorFilterBody`
- `visitorFieldName`
- `visitorFieldCompany`
- `visitorFieldContact`
- `visitorAddedToast`
- `historyAccessDenied`
- `homeSelfCheckIn`
- `homeSelfCheckInRecorded`
- `requestsSubmit`
- `homePendingRequests`

## Finder/fixture uyarlamaları

- Request editable'ları `request-notes` / `request-reason` descendant'ı; saat native picker `request-check-in-time`, submit `request-submit`. Dört eski kırık çekim (correction filled açık/koyu ve iki form hata yolu) düzeldi. Sekmeler getter + selected semantics ile doğrulanır.
- Login checkbox ve D3b notice-focus testindeki tip finder'ı yalnız `CheckboxListTile` → `AppCheckboxRow` oldu; değer/focus/hit-size/tap/call-count assertion'ları korunur.
- D3a request layout testinin %200 dikey segment sonrası scrollUntilVisible adımına `pumpAndSettle` + `hitTestable` kontrolü eklendi. İlk tam tur 861 yeşil/2 bu fixture hatasıydı; sonuç assertion'ı azaltılmadı.
- Tema/dil preference provider değerleri de çekimin açık/koyu ve TR/EN seçimine ayarlanır; profil satırı/radyo ile görünen tema aynı fixture durumudur. Attendance screenshot kayıtları gerçekçi ters kronolojik 08:52/12:31/13:14 ve önceki gün kayıtlarıyla, summary aynı saatlerle kurulur. Visitor ilk network error fixture'ında loaded=false; ayrı cached_error'da loaded=true ve önceki satırlar gerçekten vardır. Fixture'ın yanlış “önceki davetler” iddiası düzeltildi.
- Long capture yalnız aktif sayfanın dikey scroll alanından büyür. Tüm PNG'lerde exception kontrolü vardır; 360dp gün hücresi ≥44×48dp ve 320dp liste genişliği ayrıca ölçülür. Klavye fixture'ında footer 844−280 sınırındadır.
- Birebir golden turu QR süre çubuğunun gerçek saate bağlı ucunda 8–16px fark saptadı. Yalnız ölçülen determinate progress dikdörtgeninde ≤32 fiziksel piksel fark kabul edilir; QR kodu, countdown metni ve bütün diğer pikseller birebirdir. Ek kabul testi bölge dışındaki tek pikseli, geniş çubuk değişimini ve boyut farkını reddeder. Genel ekran toleransı yoktur; bu sınırlılık insan kabulü yerine geçmez.

## B referansı ↔ son görüntü matrisi

“Aynı”, aynı içerik hiyerarşisi/durum/eylem düzeni demektir; piksel eşitliği iddiası değildir. Ortak bilinçli farklar: HTML'nin sahte OS status/home indicator çizimleri üretilmez, 47/34dp inset kullanılır; sistem fontunun test karşılığı Roboto'dur; kit floating input label, check'li segment, min64dp satır ve doğal scroll ölçüleri DESIGN_B'ye göre HTML'ye üstün gelir. Fixture isim/saat/adetleri gerçek backend verisi değildir.

| B mockup | after-b PNG | Uyum / sebep |
| --- | --- | --- |
| [B-correction-filled.png](directions/_shots/B-correction-filled.png) | [request_correction_form_filled_light.png](after-b/request_correction_form_filled_light.png) | bilinçli sapma — fixture 4 Kas/09:00; native floating label ve karakter sayacı |
| [B-device-empty.png](directions/_shots/B-device-empty.png) | [select_device_empty_light.png](after-b/select_device_empty_light.png) | aynı — yetkili kapı yok, yönetici açıklaması |
| [B-device-filled.png](directions/_shots/B-device-filled.png) | [select_device_filled_light.png](after-b/select_device_filled_light.png) | bilinçli sapma — iki gerçek fixture kapısı; seçimi kaldır listenin üstünde (D4-G03) |
| [B-door-recovery.png](directions/_shots/B-door-recovery.png) | [door_recovery_open_light.png](after-b/door_recovery_open_light.png) | bilinçli sapma — bilinmeyen operation fixture; domain retry izni yok, yalnız durum kontrolü/Kapat |
| [B-history.png](directions/_shots/B-history.png) | [history_filled_light.png](after-b/history_filled_light.png) | bilinçli sapma — tarihli gün başlıkları ve fixture kayıtları; kurum verisi yoksa alt başlık gizli |
| [B-history-calendar.png](directions/_shots/B-history-calendar.png) | [history_calendar_light_tr_w360_s100.png](after-b/history_calendar_light_tr_w360_s100.png) | bilinçli sapma — koordinatör kararı: gün grubu/ay dışı tarihler yok; 44×48dp ızgara |
| [B-history-detail.png](directions/_shots/B-history-detail.png) | [history_detail_light.png](after-b/history_detail_light.png) | aynı — tam tarih/saat/kapı/yön ayrıntısı |
| [B-history-empty.png](directions/_shots/B-history-empty.png) | [history_empty_light.png](after-b/history_empty_light.png) | aynı — filtresiz boş durum; filtre denetimleri erişilebilir |
| [B-history-filter.png](directions/_shots/B-history-filter.png) | [history_filter_open_light.png](after-b/history_filter_open_light.png) | bilinçli sapma — başlangıç tüm tarihler; kit radyo semantics ve floating label |
| [B-history-summary.png](directions/_shots/B-history-summary.png) | [history_overview_light.png](after-b/history_overview_light.png) | bilinçli sapma — backend kapı toplamı vermiyor; uydurma kapı grubu yok (Ek kararı) |
| [B-home.png](directions/_shots/B-home.png) | [home_filled_light.png](after-b/home_filled_light.png) | bilinçli sapma — selam/saat fixture; doğrulanmamış kapı/bekleyen talep rozeti üretilmez |
| [B-home-dark.png](directions/_shots/B-home-dark.png) | [home_filled_dark.png](after-b/home_filled_dark.png) | bilinçli sapma — doğrulanmış kapı adı yoksa metrik altında gizli; kaynak bekleyen talep sayısı yok |
| [B-home-empty.png](directions/_shots/B-home-empty.png) | [home_empty_light.png](after-b/home_empty_light.png) | aynı — kayıt yok, boş saatler ve erişilebilir eylemler |
| [B-home-error.png](directions/_shots/B-home-error.png) | [home_error_light.png](after-b/home_error_light.png) | aynı — ilk yükleme hatası ve yeniden dene |
| [B-home-loading.png](directions/_shots/B-home-loading.png) | [home_loading_light.png](after-b/home_loading_light.png) | aynı — durum kartı skeleton; eylemler korunur |
| [B-leave-error.png](directions/_shots/B-leave-error.png) | [request_leave_form_error_light.png](after-b/request_leave_form_error_light.png) | aynı — form korunur, yerel hata ve tek submit |
| [B-leave-error-dark.png](directions/_shots/B-leave-error-dark.png) | [request_leave_form_error_dark.png](after-b/request_leave_form_error_dark.png) | aynı — form korunur, yerel hata ve tek submit |
| [B-leave-filled.png](directions/_shots/B-leave-filled.png) | [request_leave_form_filled_light.png](after-b/request_leave_form_filled_light.png) | bilinçli sapma — sabit fixture başlangıç 4 Kas; native label ve sayaç |
| [B-leave-filled-dark.png](directions/_shots/B-leave-filled-dark.png) | [request_leave_form_filled_dark.png](after-b/request_leave_form_filled_dark.png) | bilinçli sapma — sabit fixture başlangıç 4 Kas; native label ve sayaç |
| [B-login-empty.png](directions/_shots/B-login-empty.png) | [login_empty_light.png](after-b/login_empty_light.png) | bilinçli sapma — üretim kit floating label; checkbox gerçek alan kenarı/8dp |
| [B-login-empty-dark.png](directions/_shots/B-login-empty-dark.png) | [login_blank_dark.png](after-b/login_blank_dark.png) | bilinçli sapma — üretim kit floating label; BrandMark.band logosu |
| [B-login-error.png](directions/_shots/B-login-error.png) | [login_error_light.png](after-b/login_error_light.png) | aynı — yerel auth hatası, girdiler/tek CTA korunur |
| [B-login-error-dark.png](directions/_shots/B-login-error-dark.png) | [login_auth_error_dark.png](after-b/login_auth_error_dark.png) | aynı — yerel auth hatası, girdiler/tek CTA korunur |
| [B-login-loading.png](directions/_shots/B-login-loading.png) | [login_loading_light.png](after-b/login_loading_light.png) | aynı — alanlar kilitli, isimli busy CTA |
| [B-login-loading-dark.png](directions/_shots/B-login-loading-dark.png) | [login_loading_dark.png](after-b/login_loading_dark.png) | aynı — alanlar kilitli, isimli busy CTA |
| [B-password-help.png](directions/_shots/B-password-help.png) | [forgot_password_filled_light.png](after-b/forgot_password_filled_light.png) | bilinçli sapma — D2b fix1 info notice süreç ile alıntı arasında; D4-G01 |
| [B-profile-main.png](directions/_shots/B-profile-main.png) | [profile_filled_light.png](after-b/profile_filled_light.png) | bilinçli sapma — tek harf avatar, cihaz dil/tema fixture; küçük kimlik grubu |
| [B-profile-main-dark.png](directions/_shots/B-profile-main-dark.png) | [profile_filled_dark.png](after-b/profile_filled_dark.png) | bilinçli sapma — tek harf avatar, cihaz dil/tema fixture; küçük kimlik grubu |
| [B-profile-theme.png](directions/_shots/B-profile-theme.png) | [profile_theme_light.png](after-b/profile_theme_light.png) | aynı — radyo seçenekleri ve seçili semantics |
| [B-profile-theme-dark.png](directions/_shots/B-profile-theme-dark.png) | [profile_theme_dark.png](after-b/profile_theme_dark.png) | aynı — radyo seçenekleri ve seçili semantics |
| [B-qr.png](directions/_shots/B-qr.png) | [qr_filled_light.png](after-b/qr_filled_light.png) | bilinçli sapma — sentetik QR ve gerçek süre; HTML sahte OS barı çizilmez |
| [B-qr-expired.png](directions/_shots/B-qr-expired.png) | [qr_expired_light.png](after-b/qr_expired_light.png) | aynı — geçersiz kod çizilmez, süre doldu ve Yenile |
| [B-qr-permission.png](directions/_shots/B-qr-permission.png) | [qr_camera_placeholder_light.png](after-b/qr_camera_placeholder_light.png) | aynı — izin engeli ve Ayarları aç |
| [B-qr-scan.png](directions/_shots/B-qr-scan.png) | [qr_camera_placeholder_light.png](after-b/qr_camera_placeholder_light.png) | bilinçli sapma — native kamera yok; izin yer tutucusu, gerçek kamera insan kabulünde |
| [B-request-withdraw.png](directions/_shots/B-request-withdraw.png) | [requests_withdraw_light.png](after-b/requests_withdraw_light.png) | aynı — destructive secondary onay ve Vazgeç |
| [B-requests-correction.png](directions/_shots/B-requests-correction.png) | [requests_corrections_light.png](after-b/requests_corrections_light.png) | bilinçli sapma — tek pending fixture; izin verdiği için geri çek görünür |
| [B-requests-correction-dark.png](directions/_shots/B-requests-correction-dark.png) | [requests_corrections_dark.png](after-b/requests_corrections_dark.png) | bilinçli sapma — tek pending fixture; izin verdiği için geri çek görünür |
| [B-requests-empty.png](directions/_shots/B-requests-empty.png) | [requests_empty_light.png](after-b/requests_empty_light.png) | aynı — boş açıklama ve tek Yeni talep |
| [B-requests-empty-dark.png](directions/_shots/B-requests-empty-dark.png) | [requests_no_requests_dark.png](after-b/requests_no_requests_dark.png) | aynı — boş açıklama ve tek Yeni talep |
| [B-requests-leave.png](directions/_shots/B-requests-leave.png) | [requests_filled_light.png](after-b/requests_filled_light.png) | aynı — pending/approved gerçek fixture durumları, nötr gruplar |
| [B-requests-leave-dark.png](directions/_shots/B-requests-leave-dark.png) | [requests_filled_dark.png](after-b/requests_filled_dark.png) | aynı — pending/approved gerçek fixture durumları, nötr gruplar |
| [B-startup-error.png](directions/_shots/B-startup-error.png) | [splash_error_light.png](after-b/splash_error_light.png) | aynı — hata bandı, retry ve girişe dön |
| [B-startup-loading.png](directions/_shots/B-startup-loading.png) | [splash_loading_light.png](after-b/splash_loading_light.png) | aynı — marka bandı ve tek yükleme durumu |
| [B-visitor-cancel.png](directions/_shots/B-visitor-cancel.png) | [visitor_detail_cancel_light.png](after-b/visitor_detail_cancel_light.png) | bilinçli sapma — native M3 eylemleri sığdığında yatay |
| [B-visitor-detail.png](directions/_shots/B-visitor-detail.png) | [visitor_detail_open_light.png](after-b/visitor_detail_open_light.png) | bilinçli sapma — gerçek fixture/presence unknown; amaç/not tam genişlik blok |
| [B-visitor-form-filled.png](directions/_shots/B-visitor-form-filled.png) | [visitor_form_filled_light.png](after-b/visitor_form_filled_light.png) | bilinçli sapma — düzenleme fixture, gruplar ve alanlar doğal kayar |
| [B-visitor-form-filled-dark.png](directions/_shots/B-visitor-form-filled-dark.png) | [visitor_form_filled_dark.png](after-b/visitor_form_filled_dark.png) | bilinçli sapma — düzenleme fixture, gruplar ve alanlar doğal kayar |
| [B-visitor-form-keyboard.png](directions/_shots/B-visitor-form-keyboard.png) | [visitor_form_keyboard_light.png](after-b/visitor_form_keyboard_light.png) | bilinçli sapma — 280dp viewInsets, gerçek OS klavyesi çizilmez; CTA sınır üstünde |
| [B-visitor-form-keyboard-dark.png](directions/_shots/B-visitor-form-keyboard-dark.png) | [visitor_form_keyboard_dark.png](after-b/visitor_form_keyboard_dark.png) | bilinçli sapma — 280dp viewInsets, gerçek OS klavyesi çizilmez; CTA sınır üstünde |
| [B-visitors-empty.png](directions/_shots/B-visitors-empty.png) | [visitor_empty_light.png](after-b/visitor_empty_light.png) | bilinçli sapma — filtreleme denetimleri boş listede de korunur |
| [B-visitors-empty-dark.png](directions/_shots/B-visitors-empty-dark.png) | [visitor_no_visitors_dark.png](after-b/visitor_no_visitors_dark.png) | bilinçli sapma — filtreleme denetimleri boş listede de korunur |
| [B-visitors-error.png](directions/_shots/B-visitors-error.png) | [visitor_error_light.png](after-b/visitor_error_light.png) | bilinçli sapma — cache yok fixture, doğru hata metni; filtreler erişilebilir |
| [B-visitors-error-dark.png](directions/_shots/B-visitors-error-dark.png) | [visitor_network_error_dark.png](after-b/visitor_network_error_dark.png) | bilinçli sapma — cache yok fixture, doğru hata metni; filtreler erişilebilir |
| [B-visitors-filled.png](directions/_shots/B-visitors-filled.png) | [visitor_filled_light.png](after-b/visitor_filled_light.png) | bilinçli sapma — gerçek fixture sayıları; unknown presence listede gizli, ayrıntıda var |
| [B-visitors-filled-dark.png](directions/_shots/B-visitors-filled-dark.png) | [visitor_filled_dark.png](after-b/visitor_filled_dark.png) | bilinçli sapma — gerçek fixture sayıları; unknown presence listede gizli, ayrıntıda var |

## Yan yana görsel inceleme

`view_image` ile 5 levhada **20 çift** (40 ekran) yan yana incelendi; son fixture güncellemesinden sonra ilgili levhalar yeniden üretildi ve incelendi. Levhalar:

1. [Ana sayfa açık/koyu, giriş boş, şifre yardımı](after-b/comparisons/compare-01.jpg)
2. [Geçmiş kayıt/takvim/özet/filtre](after-b/comparisons/compare-02.jpg)
3. [Talep listeleri ve iki form](after-b/comparisons/compare-03.jpg)
4. [Ziyaretçi dolu açık/koyu, boş ve hata](after-b/comparisons/compare-04.jpg)
5. [Ziyaretçi form/ayrıntı, kapı seçimi, profil](after-b/comparisons/compare-05.jpg)

Renk ve yüzey dili B ile tutarlı; tek primary, nötr gruplar, kapı sonucu/physical passage ayrımı korunur. %200 segment kesilmesi kapandı; ana 168 kombinasyonda render overflow yok. Ayrı ek inceleme: takvim 320dp liste/360dp ızgara, notice onayı hatası, Home unknown, keyboard ve profil tema sheet'i. Cihaz davranışı bu PNG'lerden doğrulanmış sayılmaz.

## Kalan açıklar / bilinçli sapmaların sahipleri

| Kimlik | Sahip | Durum / kanıt |
| --- | --- | --- |
| D4-G01 | D2b | Şifre yardımında `passwordHelpNoEmail` info kutusu B HTML'nin alt açıklamasından daha baskın. D2b fix1 bunu açıkça seçti ve test etti; DESIGN_B §6 “büyük kutu halinde tekrarlamaz” ifadesiyle görsel kararın son kabulü gerekir. D4 bu ekran düzenine yazmadı. |
| D4-G02 / RV3B-09 kalan | D3b | Notice onayı kit ve inline hataya taşındı; URL+sürüm hâlâ ham SelectableText, bağlantı/sürüm etiketi/grup düzeni yapılmadı. Görev checkbox kullanımına izin veriyor; notice içerik yerleşimine izin vermiyor. Kanıt: `visitor_form_validation_notice_light.png`. |
| D4-G03 | D2a | Kapı seçimi Seçimi kaldır eylemi B referansından farklı olarak listenin üstünde; işlem kaydetme davranışı korunmuş. Üretim sırası D4 sahipliği dışında, son görsel karar D2a'da. |
| D4-G04 | D3b | Onay doğrulama hatasında mevcut genel Snackbar, kaydet footer'ını geçici olarak örter; inline hata ve odak doğru. Kanıt: `visitor_form_validation_notice_light.png`; body içindeki footer ile floating snackbar yerleşimi ekran sahibi tarafından gözden geçirilmeli. D4 düzen/davranış yaması yapmadı. |
| D4-H01 | D2a/D2b/D3a/D3b | iOS/Android gerçek sistem barı, keyboard/gesture inset ve VoiceOver/TalkBack insan kabulü çalıştırılmadı. Otomatik semantics/viewport kontrolleri var; cihaz doğrulaması açık. |
| D4-H02 | D2a | Fiziksel QR okuyucu ve gerçek kamera kabulü çalıştırılmadı; harness yalnız sentetik token ve izin placeholder kullanır. Gerçek kapı komutu gönderilmedi. |

Backend/provider/repository/service/model/router/core davranış dosyalarına yazılmadı. Kapı kurtarma/idempotency, sessionEpoch, deep link/route guard, visitor create recovery, Türkiye saati ve taleplerin mevcut davranış assertion'ları tam pakette korunur. Commit/stage/stash/reset/restore/push/deploy/migration/DB yazma yapılmadı.
