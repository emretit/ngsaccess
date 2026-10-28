# DENETİM — Faz 1-B mobil (B-03 presentDays, 8 hata kodu allowlist)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU (tsc/vitest yerine mobil kapılar). Fix spec: `.claude/orca-specs/fix-f1-b-mobil.md`.
Worker raporu: `/tmp/fix-f1-b-mobil-rapor.md`. Rapor: `/tmp/fix-f1-b-denetim.md`.
Dosyalar: mobile/lib/models/attendance_summary.dart mobile/lib/core/errors.dart mobile/lib/core/error_localizer.dart mobile/lib/l10n/app_tr.arb
mobile/lib/l10n/app_en.arb mobile/lib/l10n/app_localizations*.dart mobile/test/l10n/expected_keys.json mobile/test/models/attendance_summary_contract_test.dart
mobile/test/core/mobile_business_errors_test.dart
Kapılar: `cd mobile && flutter analyze` ve `flutter test` (pub get/build YASAK). Özel dikkat: B-03 gevşetmesi gerçekten bozuk yanıtı da kabul edecek kadar gevşek mi;
8 kodun backend'de gerçekten döndüğü (grep convex) ve mesajların eyleme dönük olduğu; response_decoder allowlist'i değişmeden kodlar nasıl tanınıyor; TR metinlerin dili.
