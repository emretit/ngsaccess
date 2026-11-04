# D1 teslim kanıtı — 4 Kasım 2026

## Kapsam ve sonuç

- 39 üretim dosyası; toplam 61 kod/test/harness dosyası + bu rapor (62); 76 PNG + harness INDEX çıktısı `docs/mobile-ui-audit/after-d1/` altında.
- 23 widget: AppBrandBand, AppPageHeader, AppStatusBadge, AppListGroup, AppListRow, AppEmptyState, AppDataNotice, AppSkeleton, AppPrimaryButton, AppSecondaryButton, AppFormActionBar, AppSheet, AppSegmentControl, AppTextField, AppDateField, AppDateRangeField, AppTimeField, AppSelectField, AppBottomNavigation, AppMetricRow, AppDialog, AppScaffold, AppSurface.
- Diğer üç sözleşme: AppUiTokens, showAppSheet, AppDateFormat; barrel `lib/widgets/ui/ui.dart`, eski nav dosyası yalnız compat export.
- ColorScheme 46 güncel rolü elle tanımlar; fromSeed yok. 15 TextTheme stili, component theme’leri ve eski public sabit/metotlar için deprecated uyumluluk katmanı var.
- §6’daki 73 mevcut anahtar TR/EN olarak uygulandı; gerçek değer değişimi TR73/EN72 (EN qrFrameHint zaten hedef metindi); her dilde 22 yeni anahtar, sıfır silme; dokuz quote anahtarı duruyor.
- Ekran düzeni dönüştürülmedi; shell/nav ve aşağıda onaylanan tek takvim satırı dışında screens/cards/history/visitor yapısı değiştirilmedi. Paket/router/provider/repository/backend değişikliği yok; commit/push yok.

## Kapılar

Son kapı logları: `/tmp/d1_gate1.log`, `/tmp/d1_gate2.log`, `/tmp/d1_gate3.log`.
- `flutter gen-l10n && flutter analyze --no-pub`: No issues found.
- `flutter test --no-pub`: başlangıç 600 → 709; 709/709 geçti (son tur 3 dakika 37 saniye).
- `flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-d1 screenshot_test/`: 76/76 geçti, 76 PNG üretildi; çıktı current/ üzerine yazılmaz.
- `TZ=UTC` ve `TZ=America/New_York flutter test --no-pub test/ui_redesign/d1/app_date_format_test.dart`: her biri 4/4 geçti; 20:59Z/21:00Z, yıl geçişi, calendar day, parts→instant round-trip, ters aralık, TR/EN kapsandı.
- Yeni kit testleri her widget için açık/koyu + scale1/2 render, gerçek erişilebilir etiket; disabled/busy, duplicate tap, sabit busy boyutu, reduce-motion, picker iptali, focus restore, segment ok tuşları ve disabled skip, keyboard sheet/footer/son hata erişimi; tema kontrastı ve token interpolasyonu.
- Mevcut nav testlerinde 5 hedefin eşit genişliği eklendi; 320/200% TR/EN light/dark, tablet, reduce-motion, keyboard ve son CTA erişim kontrolleri korundu.

## Görsel inceleme

`view_image` ile home_filled_light/dark, qr_filled_light, ui_kit_light/dark ve home_textscale130_light incelendi: nötr canvas/surface, koyuda primary accent konturu, beş eşit nav hedefi ve içerikten ayrılan nav alanı görünür; pembe zemin yok. Normal ölçekte etiketler tek satır; 390px/%130 çekimde Ana Sayfa §4.21’in ölçüm algoritmasına göre iki satıra geçer, metin küçültülmez/kesilmez. Ekranların eski kompozisyonu D2/D3 için kalır. Gerçek cihaz/VoiceOver/TalkBack/kamera kontrolü bu widget harness çalışmasının kapsamı değildir.

## Koordinatör onaylı dar kapsam genişletmeleri

- `lib/core/errors.dart:127`, `:146`: yalnız REQUEST_DATE_INVALID / CORRECTION_TIME_INVALID TR fallback literalleri §6’ya uyarlandı; sınıflandırma ve davranış aynı.
- `test/l10n/expected_keys.json:10,53,54,55,157,165,191,205,211,351,352,353,354,364,370,371,372,383,392,444,446,469`: yalnız 22 yeni anahtar eklendi; quote envanteri korundu.
- `test/visitor_lifecycle_test.dart:4,88`: yalnız AppTheme importu + MaterialApp.router theme; bütün polling/lifecycle assertleri aynı.
- **D3a’ya devredilen geçici düzeltme:** `lib/widgets/history/history_calendar.dart:95` rowHeight, yalnız scale>1.3 için 52×scale; yeni 15/22 tipografinin 320px/%200’deki 4–7px taşmasını giderir; normal/1.3 görünüm aynı. D3a’nın erişilebilir liste varyantı sonraki dalgadır.

## Değişen mevcut test assertion/finder literalleri

Aşağıdaki yollar mobile/ altındadır. Yalnız §6 metin değerleri değişti; assertion mantığı, koşullar, sayımlar ve akışlar korunmuştur.

| Dosya:satır | Neden / yeni değer |
|---|---|
| test/integration/app_composition_test.dart:286,287 | errorEmploymentEnded yeni TR/EN metni |
| test/integration/app_composition_test.dart:547 | Görünen navQr etiketi QR; QR Actions erişilebilir label’ı ayrı olarak korunur |
| test/l10n/catalog_test.dart:54 | §6 kesin EN historyDayRecordCount şablonu: `1 records` |
| test/visitor_form_time_test.dart:72,119 | Save invitation; Invitation saved. Approval is required. |
| test/visitor_recovery_widgets_test.dart:147,280,289 | Save invitation / Try again; recovery ve requestId assertleri aynı |
| test/visitor_widgets_test.dart:69,72,161,171,181,209,230,274,279 | Retry, Invite a visitor, Save invitation, saved ve summary-limited metinleri |
| test/widgets/history_period_lifecycle_test.dart:159 | This week |
| test/widgets/history_screen_test.dart:199,340,360 | This week / Clear filters / All doors |
| test/widgets/history_widgets_test.dart:108,181 | Entry record / Try again |
| test/widgets/profile_screen_test.dart:152,157,184 | Organisation and project / Kurum ve proje |
| test/widgets/requests_screen_test.dart:64,265,281,286,298,311 | Talebi gönder |
| test/widgets/requests_screen_test.dart:82,84,103,105,108,116,222,223,228,230,237,248,250 | Talebi geri çek |
| test/widgets/requests_screen_test.dart:234,246 | Kayıt düzeltme |
| test/widgets/select_device_screen_test.dart:167,184,231 | Choose a door / Door unavailable |

D1’in sahip olduğu nav test uyarlamaları:
- `test/router/app_router_integration_test.dart:16,112`: AppTheme fixture; `:387` görünür QR Actions text finder yerine korunmuş `app_nav_button_2`; `:400,423` eski floating adları güncellendi, keyboard/branch state/son eylem assertleri aynı.
- `test/widgets/app_bottom_navigation_test.dart:41`: fixture extendBody false; `:93` eşit hedef genişliği ek assertion; `:131` test adı güncellendi, son CTA görünürlük/tap assertion’ı korundu.
- `screenshot_test/_harness.dart:34,388`: explicit AUDIT_OUTPUT_DIR, boş değerde hata, absolute golden URI; `screens_screenshot_test.dart:190,191,476,480`: çıktı dizini ve iki yeni metin finder’ı.

## Ana kaynak konumları

`lib/widgets/ui/app_ui_tokens.dart:24`, `lib/theme/app_theme.dart:6`, `lib/core/app_date_format.dart:5`, `lib/widgets/ui/app_bottom_navigation.dart:6`, `lib/screens/main_navigation_shell.dart:100`, `lib/core/error_localizer.dart:12`.


## fix1 — Claude D1 denetim düzeltmeleri

- Kapatılanlar: RV1-01, RV1-02, RV1-03, RV1-04, RV1-05, RV1-06, RV1-07 (tema odağı), RV1-08, RV1-10, RV1-11, RV1-12(c), RV1-13, RV1-15, RV1-16, RV1-17.
- RV1-01/03/06/07: buton halkası layout dışına taşındı, gerçek kontrol 52dp ve expanded genişlik tam satır; seçili ilk/son satırlar kırpılır; destructive disabled rengi token’dan gelir; SDK Filled/Outlined/Text/Icon odakta 2dp halka alır (`lib/widgets/ui/app_primary_button.dart:90`, `app_surface.dart:21`, `app_secondary_button.dart:40`, `lib/theme/app_theme.dart:177`).
- RV1-02/04/05: EN ICU singular geri geldi; üç ARB anahtarı eklendi (fieldNoOptions, metricNoRecord, fieldClear), TR/EN toplam 497 anahtar; temizleme alan adını söyler, metric özel etiketi çocuk semantiğini dışlar (`lib/l10n/app_en.arb:239,649`, `lib/widgets/ui/app_metric_row.dart:31`, `app_date_field.dart:194`, `app_select_field.dart:70`). Mevcut tek assertion düzeltmesi: `test/l10n/catalog_test.dart:54` → `1 record`; çoğul döngüsü korunur. Envanter: `test/l10n/expected_keys.json:53,54,211`.
- RV1-08/10/11/15/16: footer TextPainter ile etiketleri ölçer; büyük metin satırı tabular font/rengini ve 4dp aralığı korur; segment aynı seçimi tekrar yaymaz, sonsuz ebeveynde sonlu genişlik kullanır ve kaldırılan FocusNode’u bırakır; ortak isLargeText; nav pill Ink, picker tek yüzey ve notice 12dp aralık (`lib/widgets/ui/app_form_action_bar.dart:44`, `app_list_row.dart:62`, `app_segment_control.dart:62,87,139`, `app_ui_tokens.dart:269`, `app_bottom_navigation.dart:158`, `app_data_notice.dart:62`).
- RV1-12(c)/13: sheet scopesRoute/namesRoute/title semantiği; picker Türkiye gününü açıkça alır ve sınırlar içinde tutar; eklenen tryDateRange ters taslağı göstermez, mevcut dateRange doğrulaması ve public API korunur; AppDateRangeField ters taslakla boş seçici açar (`lib/widgets/ui/app_sheet.dart:26`, `app_date_field.dart:50`, `app_date_range_field.dart:38,71`, `lib/core/app_date_format.dart:134,141`).
- Yeni 34 test: `test/ui_redesign/d1/fix1_test.dart:46` (31), `date_range_field_test.dart:37` (1), `test/theme/color_scheme_contract_test.dart:7,109` (2). Açık/koyu 52dp/genişlik, ilk/son satır piksel kırpma, disabled kontrast, dört SDK odak halkası, l10n/semantics, footer ölçümü, segment klavye/dispose, tarih taslağı/Türkiye günü ve nav selected + EN QR Actions + 48dp hedefler doğrulanır; 46 rol × 2 tema literal hex snapshot ile kilitlidir. Tarih aralığı seçici testi Ahem kaynaklı yapay taşmayı önlemek için SDK Roboto fontunu yükler, 390dp ekranı korur; hiçbir golden/screenshot üretilmedi.
- Kapı 1: `flutter gen-l10n && flutter analyze --no-pub lib/widgets/ui lib/theme lib/core lib/l10n` → No issues found (16,8s); kapı 2: `flutter test --no-pub test/ui_redesign/d1 test/theme test/l10n test/widgets/app_bottom_navigation_test.dart` → **155/155 geçti** (önce 121, +34; 10s). Koşum logları: `/tmp/d1f1_gate1.log`, `/tmp/d1f1_gate2.log`.
- Koordinatör kararıyla RV1-09/14’teki yedi anahtar ve ek AppTextField/AppBrandBand API’leri aynen korundu; RV1-12(a,b) inset/autofocus değiştirilmedi, RV1-07 global reduce-motion main.dart’a taşınmadı (kit içinde kalır; SDK tema animasyonu 120ms). Ekranlara/ekran testlerine dokunulmadı; tam suite ve screenshot doğrulaması D2 sonrası koordinatörde.


### fix1 ek — AppMetricRow yatay eşik

- `lib/widgets/ui/app_metric_row.dart:33`: sabit `metrics.length * 110` eşiği kaldırıldı; TextPainter gerçek değer/etiket stilini, tabular saat rakamlarını, locale/direction ve textScaler’ı kullanır. Eşit sütun sözleşmesi için en geniş değer/etiketin hücre genişliği (16dp iç padding dahil) sütun sayısıyla çarpılır, etkin ayırıcıların 32dp genişliği eklenir; sığıyorsa yatay, sığmıyorsa dikey. Detail metni gerektiğinde sarılır; >1,3 büyük yazı dalı aynen korunur.
- `test/ui_redesign/d1/metric_row_layout_test.dart:33`: 7 yeni test; Roboto ile 308dp / 200dp ve üç saat (`08:52`, `12:31`, `13:14`) açık/koyu yatay/dikey doğrulaması, eşit sütun aralığı, geniş ekranda scale2 dikey, uzun etiketin hesaba katılması ve showDividers:false boşluk hesabı. Hedef dosya 7/7 geçti.
- Ek kapı sonuçları: gen-l10n + aynı kapsam analyze → **0 sorun** (6,8s); D1/theme/l10n/nav test kapısı → **162/162 geçti** (155→162, 23s). Loglar: `/tmp/d1_metric_analyze.log`, `/tmp/d1_metric_gate2.log`; tam suite/screenshot çalıştırılmadı, ekran dosyaları değiştirilmedi.


## D2 fix1 — DS/kit denetimi

- RV2-03: `lib/widgets/ui/app_sheet.dart:25` PopScope yanında busy durumunda dikey drag’i yakalayan GestureDetector; sheet handle/title/body üzerinden sürükleme route’u kapatmaz, idle olduğunda drag tekrar SDK’ya gider. Barrier/back maybePop ve busy close kilidi korunur; showAppSheet imzası değişmedi.
- RV2-08: `lib/widgets/ui/app_dialog.dart:10` → `String? confirmLabel`, `VoidCallback? onConfirm` artık opsiyonel; confirmLabel verilmediğinde confirm eylemi oluşmaz, yalnız cancelLabel verilen varyant tek secondary gösterir. Önceki primary/destructive onay callback’leri aynı davranır.
- RV2-10: `lib/widgets/ui/app_list_row.dart:15` yeni opsiyonel `bool radio = false`; true olduğunda mutually-exclusive + checked:selected semantiği, varsayılan row davranışı ve görseli korunur.
- RV2-15: `lib/widgets/ui/app_metric_row.dart:64` metrik başına tek semantik düğüm: etiket → değer → varsa detay; “—” yerelleştirilmiş metricNoRecord olarak okunur, özel semanticLabel önceliği korunur. §4.22’deki tipografi/ölçüleri koruyarak B home mockup’ındaki etiket-üstte/değer-altta görsel sıra uygulandı.
- `test/ui_redesign/d1/d2_review_test.dart`: 11 yeni test; iki scroll sahipliğinde busy drag/barrier/back engeli ve idle drag, idle barrier, close-only secondary/dismiss/busy, eski confirm/destructive callback’leri, radio seçili/seçili-değil/normal rolü, scale1/2’de metrik tek düğüm/okuma ve görsel sıra. `fix1_test.dart:263` önce yalnız No record düğümünü arayan assertion yeni tek düğümün `Entry No record` etiketini doğrular (TR karşılığı da); semantik tekrar kontrolü korunur.
- Doğrulama: `flutter analyze --no-pub lib/widgets/ui test/ui_redesign/d1` → **0 sorun** (28,2s); `flutter test --no-pub test/ui_redesign/d1 test/theme test/widgets/app_bottom_navigation_test.dart` → **171/171 geçti** (160→171, 19s); tam suite `flutter test --no-pub` → **820/820 geçti** (6dk32sn); eşzamanlı worker kaynaklı kırmızı yok. Loglar `/tmp/d2kit_analyze.log`, `/tmp/d2kit_gate2.log`, `/tmp/d2kit_full.log`.
- Ownership: yalnız dört kit bileşeni, D1 testleri ve bu rapor; ekran/l10n dosyalarına yazılmadı.
