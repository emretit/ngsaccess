# FAZ 1-B — Mobil özet hatası (B-03) + hata kodu allowlist (M5 §4.2)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (git/convex yasakları aynen). Rapor: `/tmp/fix-f1-b-mobil-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (B-03), `M5-mobil.md` (B-03 + §4 madde 2).

## Ownership (yalnız bunlar)
`mobile/lib/models/attendance_summary.dart`, `mobile/lib/core/response_decoder.dart`, `mobile/lib/core/errors.dart`,
`mobile/lib/core/error_localizer.dart`, `mobile/lib/l10n/app_tr.arb`, `mobile/lib/l10n/app_en.arb`, üretilen `mobile/lib/l10n/app_localizations*.dart`
(yalnız `flutter gen-l10n` ile), `mobile/test/**` (ilgili testler + `mobile/test/l10n/expected_keys.json`).
DOKUNMA: `convex/**`, `src/**`. İzinli komutlar: `cd mobile && flutter analyze`, `flutter test`, `flutter gen-l10n`. `flutter pub get/upgrade`, build, pod YASAK.

## Değişiklikler
1. **B-03** — Sunucu `punchMode === "requirements"` (sabit kural / asgari süre) projelerde `presentDays`'i kurala göre sayıyor
   (`convex/lib/mobileAttendance.ts:163`); Dart modeli `presentDays == giriş olan gün sayısı` şartıyla yanıtı `FormatException` ile reddediyor
   (`attendance_summary.dart:179`) → çalışan ana sayfada hata görüyor. Eşitlik şartını kaldır; yerine güvenli sınır kontrolü
   (`0 <= presentDays <= günSayısı`). Manuel tamamlanan günde hareket 0 ama presentDays 1 olabilir — bunu da kabul et.
   Gerçek sunucu örneği (bkz. `convex/pdksFixedRules.integration.test.ts:38`, `convex/w5aFix1.test.ts:154`) ile Dart decoder testi ekle.
2. **Hata kodu allowlist** — Backend'in döndürdüğü ama mobilin `BUSINESS_ERROR`/"bilinmeyen hata"ya düşürdüğü kodlar:
   `SUMMARY_TOO_LARGE`, `INVALID_CURSOR`, `DEVICE_NOT_FOUND`, `SUMMARY_INVALID_DATA`, `VISITOR_INVALID`, `VISITOR_LOCKED`,
   `VISITOR_NOTICE_CHANGED`, `REQUEST_CONFLICT`. Önce `convex/**` içinde gerçekten döndürüldüklerini ve anlamlarını doğrula (grep). Her biri için
   decoder allowlist + tipli hata + TR/EN yerelleştirilmiş, eyleme dönük mesaj ("Tarih aralığını küçültün", "Davet bağlantısını yenileyin",
   "Operatöre başvurun" vb.). Sunucu metnini ekrana basma kuralını koru.

## Kabul
- `flutter analyze` 0 sorun; `flutter test` tamamı yeşil (yeni testler dahil); TR/EN anahtar sayısı eşit, `expected_keys.json` güncel.
