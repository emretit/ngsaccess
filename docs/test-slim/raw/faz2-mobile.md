# Mobil test sadeleştirme — Faz 2 uygulama raporu

Sonuç: 0 dosya silindi; 64 yinelenen görsel matris case’i çıkarıldı; 0 davranış case’i taşındı veya silindi; 12 ortak helper dosyası oluşturuldu.

## A — yardımcı/import taşıma (yapıldı)

A tek başına tam koşu: 863 → 863 görünür testDone, her dosyanın sayısı aynı, 0 fail. Değişen tüm main gövdeleri bu aşamada HEAD ile byte-identical doğrulandı.

| Durum | Kaynak (yalnız helper/import) | Yeni yardımcı | Tüketiciler |
|---|---|---|---|
| Yapıldı | `test/visitor_provider_test.dart:9` | `test/helpers/visitor_fakes.dart:5` | `test/helpers/recording_visitors.dart:2`, `test/helpers/visitor_recovery_fakes.dart:7`, `test/ui_redesign/d3b/fix1_test.dart:15`, `test/ui_redesign/d3b/visitor_layout_test.dart:17`, `test/visitor_form_time_test.dart:13`, `test/visitor_lifecycle_test.dart:17`, `test/visitor_provider_test.dart:9`, `test/visitor_recovery_widgets_test.dart:19`, `test/visitor_widgets_test.dart:12` |
| Yapıldı | `test/models/door_operation_test.dart:4` | `test/helpers/door_operation_fixtures.dart:1` | `test/models/door_operation_test.dart:4`, `test/repositories/door_operation_repository_test.dart:17` |
| Yapıldı | `test/theme/app_theme_test.dart:5` | `test/helpers/contrast.dart:4` | `test/theme/app_theme_test.dart:5`, `test/theme/app_ui_tokens_test.dart:5`, `test/ui_redesign/d1/ui_kit_test.dart:11` |
| Yapıldı | `test/providers/request_provider_test.dart:7` | `test/helpers/request_fakes.dart:6` | `test/providers/request_provider_test.dart:7`, `test/ui_redesign/d3a/fix1_regression_test.dart:15`, `test/ui_redesign/d3a/layout_states_test.dart:17`, `test/widgets/requests_screen_test.dart:16` |
| Yapıldı | `test/ui_redesign/d3a/layout_states_test.dart:21` | `test/helpers/history_request_app.dart:5` | `test/ui_redesign/d3a/fix1_regression_test.dart:18`, `test/ui_redesign/d3a/layout_states_test.dart:21`, `test/widgets/requests_screen_test.dart:19` |
| Yapıldı | `test/widgets/login_screen_test.dart:10` | `test/helpers/login_app.dart:8` | `test/ui_redesign/d2b/presentation_test.dart:19`, `test/widgets/login_screen_test.dart:10` |
| Yapıldı | `test/visitor_widgets_test.dart:14` | `test/helpers/visitor_app.dart:8` | `test/ui_redesign/d3b/fix1_test.dart:17`, `test/visitor_widgets_test.dart:14` |
| Yapıldı | `test/widgets/qr_scan_screen_test.dart:14` | `test/helpers/camera_fakes.dart:4` | `test/ui_redesign/d2a/layout_states_test.dart:28`, `test/widgets/qr_scan_screen_test.dart:14` |
| Yapıldı | `test/widgets/history_screen_test.dart:14` | `test/helpers/history_fakes.dart:13` | `test/ui_redesign/d3a/fix1_regression_test.dart:16`, `test/ui_redesign/d3a/layout_states_test.dart:19`, `test/widgets/history_period_lifecycle_test.dart:14`, `test/widgets/history_screen_test.dart:14` |
| Yapıldı | `test/providers/door_operation_provider_test.dart:10` | `test/helpers/door_operation_fakes.dart:6` | `test/providers/door_operation_provider_test.dart:10`, `test/widgets/door_operation_recovery_test.dart:25` |
| Yapıldı | `test/visitor_create_recovery_test.dart:17` | `test/helpers/visitor_recovery_fakes.dart:9` | `test/visitor_create_recovery_test.dart:17`, `test/visitor_recovery_widgets_test.dart:12` |
| Yapıldı | `test/visitor_form_time_test.dart:14` | `test/helpers/recording_visitors.dart:4` | `test/ui_redesign/d3b/turkey_time_test.dart:13`, `test/visitor_form_time_test.dart:14` |

`history_fakes.dart` ayrıca dış tüketicinin kullandığı `screen` yardımcısını içerir. Kapsam dışındaki `screenshot_test/_harness.dart` kaynaklardan HistoryTestProvider/RequestFakeRepository/FakeVisitorRepository aldığı için üç kaynak yeni helper’ı export eder; screenshot_test dosyalarında değişiklik yapılmadı.

Koordinatör onayıyla ek kaynak/tüketicilerde yalnız helper/import taşındı. `turkey_time_test.dart:13` yalnız import yolu değişti; alt süreç mantığı ve dosya adı referansı aynen kaldı.

## B — görsel matrisler (yapıldı)

| Dosya:satır | Önce | Sonra | Fark | Kalan temsilciler |
|---|---:|---:|---:|---|
| `test/ui_redesign/d1/metric_row_layout_test.dart:30` | 9 | 7 | -2 | 308/200dp yalnız light; 900dp/200%, uzun etiket, dividers=false ve visitor summary grubu aynı |
| `test/ui_redesign/d1/ui_kit_test.dart:61` | 143 | 97 | -46 | light/100% + dark/200%; RV1/RV2 ve davranış grupları aynı |
| `test/ui_redesign/d2a/layout_states_test.dart:164` | 10 | 6 | -4 | Home long-name 2 case aynı; recovery/kamera light/390/100% + dark/320/200% |
| `test/ui_redesign/d2b/splash_screen_test.dart:9` | 4 | 2 | -2 | 320×568/200% TR-light + EN-dark; retry/login callback assertionları aynı |
| `test/ui_redesign/d3a/layout_states_test.dart:40` | 16 | 8 | -8 | light/390/100% + dark/320/200%; filtre kapatma ve withdraw iptali aynı |
| `test/ui_redesign/d3b/visitor_layout_test.dart:93` | 8 | 6 | -2 | list/form/detail light/390/100% + dark/320/200%; dört bağımsız davranış aynı |

UI kit toplamı 143→97 (92→46 smoke + değişmeyen 51 diğer case); metric toplamı 9→7 (4→2 geometri + değişmeyen 5 diğer case). Spec’teki ~101→55 ve ~7→5 tahminleri Faz 1’de taşınan grupları içermiyordu; net azalma yine tam −64.

Koordinatör açıklaması: sabit TR matrislerine EN eklenmedi; uç değer kuralı yalnız mevcut tema/genişlik/ölçek boyutlarına uygulandı. EN kapsamı mevcut splash/presentation/visitor testlerinde aynen korundu.

## Kapılar ve doğrulama

- ÖNCE `flutter test --reporter json`: success=true, 863 görünür testDone / 70 dosya / 0 fail, 27,366 sn (`mobile-before.jsonl`).
- A sonrası `flutter test --reporter json`: success=true, 863 / 70 / 0 fail, 29,031 sn (`mobile-after-helpers-fixed.jsonl`); dosya başına önce sayısıyla birebir aynı.
- `flutter analyze test`: No issues found (son çıktı: `mobile-analyze-final.txt`).
- SONRA `flutter test --reporter json`: success=true, 799 / 70 / 0 fail, 23,219 sn (`mobile-after.jsonl`); yalnız B’deki altı dosyada sayı azaldı.
- Göreli import/export ile başka *_test.dart bağlantısı: 0 (`import-check.txt`); package:flutter_test ve turkey_time alt süreç dosya adı string’i koordinatör onayıyla hariç.
- Capture doğrulama: `flutter test --reporter json --update-goldens --dart-define=AUDIT_OUTPUT_DIR=/tmp/test-slim/faz2/mobile-goldens --dart-define=D3B_CAPTURE=true test/ui_redesign/d2a/layout_states_test.dart test/ui_redesign/d3a/layout_states_test.dart test/ui_redesign/d3b/visitor_layout_test.dart`: success=true, 20 case / 0 fail, 36 PNG üretildi; dark/200% kamera ve recovery PNG’leri mevcut.
- `git diff --check -- mobile/test`: temiz; 22 matris dışı main gövdesi HEAD ile byte-identical, altı matris main gövdesi yalnız hedef döngüler ve capture guard kaldırılması açısından farklı (`body-verification.txt`).

İlk A tam koşusunda screenshot harness’ın taşınmış yardımcıları bulamaması nedeniyle 5 yükleme hatası görüldü; kapsam dışı harness’a dokunmadan üç kaynakta helper export edilerek düzeltildi ve tam koşu başarıyla tekrarlandı. Atlanan adım yok; üretim kodu, web/convex, screenshot_test, kapsam dışı davranış gövdeleri ve diğer oturumların dosyaları değiştirilmedi; yasak git yazma komutları çalıştırılmadı.

## Dosya başına görünür testDone sayıları

| Dosya | Önce | A sonrası | Sonra | Fark |
|---|---:|---:|---:|---:|
| `test/config/convex_config_test.dart` | 32 | 32 | 32 | 0 |
| `test/core/attendance_date_test.dart` | 6 | 6 | 6 | 0 |
| `test/core/error_localizer_test.dart` | 6 | 6 | 6 | 0 |
| `test/core/errors_test.dart` | 13 | 13 | 13 | 0 |
| `test/core/mobile_business_errors_test.dart` | 19 | 19 | 19 | 0 |
| `test/core/request_errors_test.dart` | 1 | 1 | 1 | 0 |
| `test/core/request_validation_test.dart` | 4 | 4 | 4 | 0 |
| `test/core/response_decoder_test.dart` | 54 | 54 | 54 | 0 |
| `test/core/safe_diagnostics_test.dart` | 8 | 8 | 8 | 0 |
| `test/integration/app_composition_test.dart` | 21 | 21 | 21 | 0 |
| `test/l10n/catalog_test.dart` | 2 | 2 | 2 | 0 |
| `test/models/attendance_summary_contract_test.dart` | 5 | 5 | 5 | 0 |
| `test/models/attendance_summary_test.dart` | 3 | 3 | 3 | 0 |
| `test/models/attendance_test.dart` | 6 | 6 | 6 | 0 |
| `test/models/device_test.dart` | 6 | 6 | 6 | 0 |
| `test/models/door_operation_test.dart` | 3 | 3 | 3 | 0 |
| `test/models/qr_code_model_test.dart` | 7 | 7 | 7 | 0 |
| `test/providers/attendance_provider_test.dart` | 19 | 19 | 19 | 0 |
| `test/providers/auth_provider_test.dart` | 26 | 26 | 26 | 0 |
| `test/providers/door_operation_provider_test.dart` | 15 | 15 | 15 | 0 |
| `test/providers/locale_provider_test.dart` | 6 | 6 | 6 | 0 |
| `test/providers/preferred_device_provider_test.dart` | 12 | 12 | 12 | 0 |
| `test/providers/qr_provider_test.dart` | 6 | 6 | 6 | 0 |
| `test/providers/request_provider_test.dart` | 26 | 26 | 26 | 0 |
| `test/providers/theme_provider_test.dart` | 6 | 6 | 6 | 0 |
| `test/repositories/attendance_repository_test.dart` | 10 | 10 | 10 | 0 |
| `test/repositories/auth_repository_test.dart` | 39 | 39 | 39 | 0 |
| `test/repositories/device_repository_test.dart` | 3 | 3 | 3 | 0 |
| `test/repositories/door_operation_repository_test.dart` | 3 | 3 | 3 | 0 |
| `test/repositories/qr_repository_test.dart` | 3 | 3 | 3 | 0 |
| `test/repositories/request_repository_test.dart` | 5 | 5 | 5 | 0 |
| `test/router/app_router_integration_test.dart` | 22 | 22 | 22 | 0 |
| `test/services/door_operation_store_test.dart` | 7 | 7 | 7 | 0 |
| `test/services/session_store_test.dart` | 8 | 8 | 8 | 0 |
| `test/theme/app_theme_test.dart` | 4 | 4 | 4 | 0 |
| `test/theme/app_ui_tokens_test.dart` | 4 | 4 | 4 | 0 |
| `test/ui_redesign/acceptance/kit_completion_test.dart` | 12 | 12 | 12 | 0 |
| `test/ui_redesign/d1/app_date_format_test.dart` | 7 | 7 | 7 | 0 |
| `test/ui_redesign/d1/metric_row_layout_test.dart` | 9 | 9 | 7 | -2 |
| `test/ui_redesign/d1/ui_kit_test.dart` | 143 | 143 | 97 | -46 |
| `test/ui_redesign/d2a/layout_states_test.dart` | 10 | 10 | 6 | -4 |
| `test/ui_redesign/d2a/qr_open_intent_test.dart` | 2 | 2 | 2 | 0 |
| `test/ui_redesign/d2b/presentation_test.dart` | 4 | 4 | 4 | 0 |
| `test/ui_redesign/d2b/splash_screen_test.dart` | 4 | 4 | 2 | -2 |
| `test/ui_redesign/d3a/fix1_regression_test.dart` | 14 | 14 | 14 | 0 |
| `test/ui_redesign/d3a/layout_states_test.dart` | 16 | 16 | 8 | -8 |
| `test/ui_redesign/d3b/fix1_test.dart` | 10 | 10 | 10 | 0 |
| `test/ui_redesign/d3b/turkey_time_test.dart` | 3 | 3 | 3 | 0 |
| `test/ui_redesign/d3b/visitor_layout_test.dart` | 8 | 8 | 6 | -2 |
| `test/visitor_create_recovery_test.dart` | 11 | 11 | 11 | 0 |
| `test/visitor_form_time_test.dart` | 7 | 7 | 7 | 0 |
| `test/visitor_lifecycle_test.dart` | 3 | 3 | 3 | 0 |
| `test/visitor_provider_test.dart` | 11 | 11 | 11 | 0 |
| `test/visitor_recovery_widgets_test.dart` | 6 | 6 | 6 | 0 |
| `test/visitor_widgets_test.dart` | 14 | 14 | 14 | 0 |
| `test/widgets/app_bottom_navigation_test.dart` | 9 | 9 | 9 | 0 |
| `test/widgets/door_command_status_card_test.dart` | 6 | 6 | 6 | 0 |
| `test/widgets/door_operation_recovery_test.dart` | 8 | 8 | 8 | 0 |
| `test/widgets/forgot_password_screen_test.dart` | 2 | 2 | 2 | 0 |
| `test/widgets/history_period_lifecycle_test.dart` | 7 | 7 | 7 | 0 |
| `test/widgets/history_screen_test.dart` | 14 | 14 | 14 | 0 |
| `test/widgets/history_widgets_test.dart` | 6 | 6 | 6 | 0 |
| `test/widgets/home_cards_test.dart` | 10 | 10 | 10 | 0 |
| `test/widgets/home_screen_test.dart` | 11 | 11 | 11 | 0 |
| `test/widgets/login_screen_test.dart` | 15 | 15 | 15 | 0 |
| `test/widgets/profile_screen_test.dart` | 23 | 23 | 23 | 0 |
| `test/widgets/qr_scan_screen_test.dart` | 11 | 11 | 11 | 0 |
| `test/widgets/requests_screen_test.dart` | 16 | 16 | 16 | 0 |
| `test/widgets/responsive_container_test.dart` | 2 | 2 | 2 | 0 |
| `test/widgets/select_device_screen_test.dart` | 9 | 9 | 9 | 0 |
| **TOPLAM** | **863** | **863** | **799** | **−64** |
