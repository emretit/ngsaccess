# Mobil UI — D1 fix1: Claude denetim bulguları (review-d1.md)

## Hedef
`docs/mobile-ui-audit/review-d1.md` bulgularını DS sahibi olarak kapat: ENGEL RV1-01 + DÜZELT RV1-02..RV1-08 + NOT RV1-10, RV1-11, RV1-13, RV1-15, RV1-16, RV1-17.
Her bulgu için kodu düzelt + onu yakalayan test ekle (özellikle RV1-01: `getSize(FilledButton).height == 52`, expanded genişliği = satır genişliği; RV1-03 seçili ilk/son satır kırpma; RV1-17 nav selected + EN "QR Actions" etiketi + 46 rol hex snapshot).

## Kararlar (koordinatör)
- RV1-02: EN `historyDayRecordCount` ICU plural geri (`one{1 record} other{{count} records}`), `test/l10n/catalog_test.dart:54` → `'1 record'`. TR değişmez.
- RV1-04: yeni ARB anahtarları `fieldNoOptions` (Seçenek yok / No options available), `metricNoRecord` (Kayıt yok / No record), `fieldClear` (Temizle / Clear); kit içindeki `languageCode == 'tr'` dalları kalkar; temizle butonu semantik etiketi "<alan etiketi>, Temizle". `expected_keys.json` güncelle.
- RV1-07: tema düzeyinde odak halkası (Filled/Outlined/Text/Icon button `side` focused → 2dp focus) — kit dışındaki SDK butonları da görünür odak alsın. Reduce-motion'ı tek yerde çözmek main.dart gerektiriyorsa YAPMA, yalnız kit içinde kalsın ve raporda not et.
- RV1-08: `AppFormActionBar` — etiketleri ölç (TextPainter), sığıyorsa yan yana, değilse dikey.
- RV1-09 / RV1-14: koordinatörün eklediği 7 anahtar + `AppTextField.autocorrect/enableSuggestions/floatingLabelBehavior/errorMaxLines`, `AppBrandBand.brandMark` KASITLI; koru, silme.
- RV1-12 (sheet inset/odak/semantics): yalnız `Semantics(scopesRoute/namesRoute/label)` kısmını yap; inset ve autofocus değişmesin.

## Paralel çalışma uyarısı
AYNI ANDA D2a (home/qr/settings/cards/router) ve D2b (auth/splash/profile/brand_mark) worker'ları ekran dosyalarını değiştiriyor ve kit'i kullanıyor.
- Ekran dosyalarına ve onların testlerine DOKUNMA. Kit public API'sini kırma (yalnız ekleme); imza değişikliği gerekiyorsa `ask`.
- Kit dosyasını yarım bırakıp derlemeyi uzun süre kırmızı tutma: her bulguyu küçük, derlenir adımlarla uygula.
- `screenshot_test/**` çalıştırma/güncelleme bu turda YOK (D2 sürerken).

## Ownership
`mobile/lib/widgets/ui/**`, `mobile/lib/theme/**`, `mobile/lib/core/app_date_format.dart`, `mobile/lib/l10n/**`, `mobile/test/ui_redesign/d1/**`, `mobile/test/theme/**`,
`mobile/test/widgets/app_bottom_navigation_test.dart`, `mobile/test/l10n/**`, `mobile/lib/widgets/app_bottom_navigation.dart`.

## Kapılar
1. `cd mobile && flutter gen-l10n && flutter analyze --no-pub lib/widgets/ui lib/theme lib/core lib/l10n` → 0.
2. `cd mobile && flutter test --no-pub test/ui_redesign/d1 test/theme test/l10n test/widgets/app_bottom_navigation_test.dart` → yeşil.
3. Tam suite'i D2 worker'ları bitirince koordinatör koşacak; sen yalnız 1-2.

## YASAK
`git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy YOK.

## Rapor (worker_done ≤10 satır) + `mobile/test/ui_redesign/d1/REPORT.md` sonuna "fix1" bölümü
Kapatılan RV1 ID'leri · eklenen testler · kapı 1-2 sonucu · açık kalan (varsa) ve sebebi.
