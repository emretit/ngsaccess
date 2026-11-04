# Mobil UI — D5: Emre geri bildirimi (giriş eski düzen, alt bar eski düzen, ana sayfada logo)

## Hedef (test edilebilir)
Emre 2026-11-04 yeni arayüzü inceledi: "diğer sayfalar güzel", yalnız üç değişiklik istiyor:
1. **Giriş ekranı önceki UI'daki gibi olsun, yalnız renk bizim renk olsun.** Düzen/görünüm = eski giriş ekranı (`git show HEAD:mobile/lib/screens/auth/login_screen.dart`,
   görsel `docs/mobile-ui-audit/current/login_{empty,filled,error,loading,textscale130}_light.png`, `login_filled_dark.png`). Renkler YALNIZ Yön B token'larından
   (`AppUiTokens`, `Theme.colorScheme` — `lib/theme/app_theme.dart`; bordo = yeni primary). Eski pembe/fromSeed/soluk bordo tonları ve sabit hex'ler GERİ GELMEZ.
2. **Alt bar öncesi gibi olsun.** Görünüm/yerleşim = eski alt gezinme (`git show HEAD:mobile/lib/widgets/app_bottom_navigation.dart`, `git show HEAD:mobile/lib/screens/main_navigation_shell.dart`,
   görsel `docs/mobile-ui-audit/current/home_filled_light.png` / `home_filled_dark.png`: yüzen bar + ortada yükseltilmiş yuvarlak QR butonu "QR İşlemleri"). Renkler yine Yön B token'larından.
3. **Ana sayfada NGS Plus logosu da görünsün.** Ana Sayfa bandındaki "NGS Plus" yazısının yanında logo (`BrandMark`, `assets/` içindeki mevcut logo — `git show HEAD:mobile/lib/widgets/brand_mark.dart`'a bak;
   girişteki/açılıştaki bant kullanımıyla aynı logo). Bandın geri kalanı (selam, proje, tarih, Bugün kartı) AYNI kalır.
Kapılar: analyze 0, tam test yeşil, after-b çekimleri yenilendi.

## Korunacaklar (davranış — değişmez)
- Giriş: autofill, next/done, klavye kaydırma, `_emailEdited`, çift gönderim engeli, `clearError`, ilk hataya odak, hata metinlerinin anlamı (erişim kapatıldı → kurum yöneticisine başvurun), busy "Giriş yapılıyor", "E-postamı hatırla", "Şifre yardımı" rotası, mevcut key'ler ve semantics. D2b'nin a11y iyileştirmeleri (hata AppDataNotice/liveRegion, odak) eski düzen içinde KALIR.
- Alt bar: spoken etiketler Home / History / **QR Actions** / **Visitor** / Profile (TR navHome/navHistory/qrTabTitle/navVisitor/navProfile), key'ler `app_nav_button_0..4`, seçili state semantics, 48dp hedef,
  `BranchVisibility`/IndexedStack lifecycle, son içerik eyleminin barın altında kalmaması (testler: `test/widgets/app_bottom_navigation_test.dart` `last_content_action`, `test/router/app_router_integration_test.dart:307,341`),
  %200 metin ve 320dp'de taşma yok, SafeArea/klavye. `lib/widgets/app_bottom_navigation.dart` compat export'u ve kit API'si (`AppBottomNavigation` seçili indeks sözleşmesi) bozulmaz — eski görünümü kit bileşeninin içinde uygula.
- Ana sayfa: tüm D2a davranışı (kapı komutu durumu, QR intent, sessionEpoch) aynen.

## Ownership (yalnız bunlara yaz)
- `mobile/lib/screens/auth/login_screen.dart`, `mobile/lib/widgets/ui/app_bottom_navigation.dart`, `mobile/lib/widgets/app_bottom_navigation.dart`, `mobile/lib/screens/main_navigation_shell.dart`,
  `mobile/lib/screens/home/home_screen.dart` (yalnız bant başlığındaki logo), `mobile/lib/widgets/brand_mark.dart`, `mobile/lib/widgets/ui/app_brand_band.dart` (gerekirse logo slotu için)
- Testler: `mobile/test/widgets/{login_screen,app_bottom_navigation,home_screen}_test.dart`, `mobile/test/router/app_router_integration_test.dart` (yalnız görsel finder), `mobile/test/ui_redesign/d1/**` (nav/band kit testleri), yeni `mobile/test/ui_redesign/d5/**`
- `mobile/screenshot_test/**` (yalnız finder uyarlaması) ve `docs/mobile-ui-audit/after-b/**` (yeniden üretim)
- Yeni metin gerekirse `lib/l10n/*.arb` + `test/l10n/expected_keys.json` + `flutter gen-l10n` (yalnız gerekiyorsa; eski metin anahtarları silindiyse eski düzenin metni için mevcut yeni anahtarları kullan).

## Kapsam dışı
- Diğer tüm ekranlar (Emre beğendi) — DOKUNMA. providers/repositories/services/models/router/core/backend DEĞİŞMEZ. Tema token değerleri DEĞİŞMEZ.

## Kapılar
1. `cd mobile && flutter analyze --no-pub` → No issues found.
2. `cd mobile && flutter test --no-pub` → hepsi yeşil (başlangıç 864). Davranış assert'leri zayıflatılmaz; yalnız görsel finder değişir, raporda dosya:satır.
3. `cd mobile && flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/` → hepsi yeşil (başlangıç 294).
4. view_image ile yan yana kıyasla: `current/login_filled_light.png` ↔ yeni `after-b/login_filled_light.png` (düzen aynı, renk yeni), `current/home_filled_light.png` ↔ `after-b/home_filled_light.png` (alt bar eski gibi, üst bant yeni + logo),
   koyu tema, `%200` ve 320dp çekimlerinde alt bar/giriş taşması yok.

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA (HEAD içeriğini `git show HEAD:<yol>` ile OKU). Commit/push/deploy/migration/DB yazma YOK.
- Başka oturumların `convex/**`, `src/**` değişikliklerine DOKUNMA.

## Rapor (worker_done, ≤10 satır) + `mobile/test/ui_redesign/d5/REPORT.md`
Değişen dosyalar · eski düzenden bilerek alınmayan şey (varsa, sebep) · kapı 1-3 sonuçları · değişen assert'ler (dosya:satır) · kıyaslanan PNG adları.
