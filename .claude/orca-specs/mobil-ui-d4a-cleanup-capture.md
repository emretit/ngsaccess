# Mobil UI — D4a: kit kalanları + ölü kod temizliği + harness + after-b çekimi (Yön B)

## Hedef (test edilebilir)
Denetimlerden D4'e devredilen kit eksikleri kapanır, eski tasarımdan kalan ölü kod/ARB silinir, screenshot harness yeni ekranlara göre güncellenir ve
`docs/mobile-ui-audit/after-b/` altında tüm ekranların son görüntüleri üretilir. Kapılar: analyze 0, tam test yeşil, harness tamamı yeşil.

## Kaynak
- `docs/mobile-ui-audit/DESIGN_B.md` (§4 kit, §7 invariants, §8.4 harness, §8.5 kapılar, sondaki "Ek — koordinatör kararları").
- Denetimler: `docs/mobile-ui-audit/review-d2.md` (RV2-04, RV2-12), `review-d3a.md` (RV3A-06, RV3A-13d), `review-d3b.md` (RV3B-09, RV3B-10).
- Raporlar: `mobile/test/ui_redesign/{d1,d2a,d2b,d3a,d3b}/REPORT.md` (harness'te kırılan finder'lar + eklenen key'ler, özellikle d3a: `request-notes`, `request-reason`, `request-check-in-time`, `request-check-out-time`, `request-submit`).

## Kapsam
1. **Kit (`mobile/lib/widgets/ui/**`):**
   a. `AppCheckboxRow` (yeni dosya + `ui.dart` export): kutu alan kenarına hizalı, kutu–etiket ~8dp, 48dp min yükseklik, `errorText` (satır içi hata), Semantics checked/label tek düğüm. Kullan: `screens/auth/login_screen.dart` ("E-postamı hatırla"), `screens/profile/profile_screen.dart` (şifre formu "Şifreyi göster"), `screens/visitor/visitor_form_screen.dart` (aydınlatma onayı; mevcut hata metni bağlantısı korunur). Davranış/key/autofill AYNI.
   b. `AppDateField`/`AppTimeField`/`AppDateRangeField`: isteğe bağlı `DateTime Function()? now` (verilmezse `DateTime.now`); ekranlardaki mevcut `now`/clock fixture'larını bu alanlara geçir (visitor form, requests formları).
   c. `AppSegmentControl` %200'de etiketler kesilmesin (RV3A-06): 2–3 segmentte büyük ölçekte dikey/iki satır düzen (yatay kaydırma yerine); seçili state ve semantics aynı.
   d. **Denetim (yazan Claude, sen Codex olarak denetle):** koordinatörün eklediği `AppTextField.showCounter`, `AppListRow.supporting` (+ `test/ui_redesign/d1/kit_d3_additions_test.dart`) ve `lib/widgets/door_operation_recovery_dialog.dart:186` yalnız-Kapat değişikliği — sorun bulursan düzelt ve raporda listele.
2. **Ölü kod (RV2-12, RV3A-13d)** — her silmeden önce `grep -rn` ile lib/test/screenshot_test'te kullanılmadığını kanıtla:
   a. `lib/widgets/cards/{quick_action_card,progress_hero_card,stat_card,section_header}.dart` + `lib/widgets/responsive_card_grid.dart` + yalnız bunları test eden testler (DoorCommandStatusCard ve AttendanceStatusCard KULLANILIYOR — silme; `AttendanceStatusCard.onScan` ölüyse kaldır). `@Deprecated` + `ignore_for_file: deprecated_member_use_from_same_package` bastırmaları kalkar.
   b. `BrandMark` kullanılmayan ctor parametreleri.
   c. Kullanılmayan ARB anahtarları (TR+EN+`test/l10n/expected_keys.json`): `homeQuoteOfTheDay`, `homeQuote1..8`, `homeQuickActions`, `loginWelcomeTitle`, `loginPrompt`, `pdksSubtitle`, `profileSecurity`, `profileSecuritySubtitle`, `profileLogoutSubtitle`, `forgotPasswordBackToLogin`, `quickActionVisitor`, `homePendingRequests` + `lib/` genelinde referansı olmayan diğer anahtarlar (script ile bul, listeyi rapora yaz). Sonra `cd mobile && flutter gen-l10n`.
   d. `pubspec.yaml`'dan `table_calendar` (lib/test/screenshot_test'te import yoksa) → `flutter pub get` (pubspec.lock değişir, normal).
3. **Harness (`mobile/screenshot_test/**`):** §8.4 finder'larını yeni key'lere taşı (request formları `request-*` key'leri; segment/sekme metinleri), kırık 4 çekimi düzelt; yeni durumları ekle: kapı komutu belirsiz durumu (Home notice), takvim 360dp ızgara + 320dp liste, ziyaretçi form hata durumu, ziyaretçi ayrıntı. TR/EN, açık/koyu, ölçek 1.0/1.3/2.0, 320/390dp kombinasyonları ana ekranlarda.
   Üret: `cd mobile && flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/` (`current/` ve `after-d1/after-d2/` DEĞİŞMEZ).
4. **Kabul raporu `docs/mobile-ui-audit/ACCEPTANCE_D4.md`:** ekran × durum matrisi (B mockup adı ↔ after-b PNG adı ↔ uyum: aynı / bilinçli sapma + sebep), view_image ile en az 20 çifti yan yana kıyasla; kalan açıklar.

## Ownership (yalnız bunlara yaz)
- `mobile/lib/widgets/ui/**`, `mobile/lib/widgets/cards/**`, `mobile/lib/widgets/responsive_card_grid.dart`, `mobile/lib/widgets/brand_mark.dart`, `mobile/lib/widgets/door_operation_recovery_dialog.dart` (yalnız 1d),
  `mobile/lib/l10n/**`, `mobile/pubspec.yaml`, `mobile/pubspec.lock`, `mobile/screenshot_test/**`, `mobile/test/l10n/expected_keys.json`, `mobile/test/ui_redesign/d1/**`, yeni `mobile/test/ui_redesign/acceptance/**`,
  `docs/mobile-ui-audit/after-b/**`, `docs/mobile-ui-audit/ACCEPTANCE_D4.md`
- Yalnız 1a/1b kullanımı için: `screens/auth/login_screen.dart`, `screens/profile/profile_screen.dart`, `screens/visitor/visitor_form_screen.dart`, `screens/requests/requests_screen.dart` ve bunların mevcut testleri (yalnız finder/fixture).
- Silinen widget'ların testleri: `test/widgets/home_cards_test.dart` vb. (yalnız silinen sınıfların test blokları).

## Kapsam dışı
- `providers/**`, `repositories/**`, `services/**`, modeller, `core/attendance_date.dart`, `main.dart`, router, backend: DEĞİŞMEZ.
- Ekran düzeni/davranış değişikliği yok (yalnız yukarıdaki kit kullanımı). Görsel hata bulursan düzeltme; ACCEPTANCE'a "sahip: D2a/D2b/D3a/D3b" ile yaz.

## Kapılar
1. `cd mobile && flutter analyze --no-pub` → No issues found.
2. `cd mobile && flutter test --no-pub` → hepsi yeşil (başlangıç ~850; silinen testler raporda sayıyla).
3. `cd mobile && flutter test --no-pub test/l10n` yeşil; harness tamamı yeşil (sayı raporda).
4. Davranış testleri (kapı komutu kurtarma/idempotency, sessionEpoch, deep link/route guard, ziyaretçi create recovery, Türkiye saati, talepler) DEĞİŞMEZ.

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Başka oturumların `convex/**`, `src/**` değişikliklerine DOKUNMA.

## Rapor (worker_done, ≤10 satır)
Kit değişiklikleri (imza) · silinen dosya/anahtar sayısı · 1d denetim bulguları · kapı 1-3 sonuçları (test + harness sayısı) · after-b PNG sayısı · ACCEPTANCE'taki açık sapmalar.
