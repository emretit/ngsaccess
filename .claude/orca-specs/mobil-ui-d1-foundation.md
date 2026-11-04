# Mobil UI — D1: Yön B temeli (token + tema + bileşen kiti + alt gezinme + l10n)

## Hedef (test edilebilir)
`docs/mobile-ui-audit/DESIGN_B.md` §1-4 ve §6 uygulanmış olur: uygulama yeni `AppTheme` (elle kurulmuş ColorScheme,
`fromSeed` yok) + `AppUiTokens` ThemeExtension + `mobile/lib/widgets/ui/**` bileşen kiti + `AppDateFormat` + yeni
`AppBottomNavigation` (M3 NavigationBar, 5 eşit hedef) ile derlenir; `flutter analyze` 0, tam `flutter test` yeşil,
screenshot harness yeniden üretilir ve alt gezinme/tema değişimi görüntülerde görünür.
Ekranların düzeni bu dalgada DEĞİŞMEZ (D2/D3 işi); yalnız tema değişiminin doğal etkisi görünür.

## Otoriter kaynak
- **Dosya listesi ve API için DESIGN_B.md §8.2 kesin listesi geçerlidir** (ör. `AppUiTokens` → `lib/widgets/ui/app_ui_tokens.dart`,
  theme/ altında ikinci kopya yok; `widgets/app_bottom_navigation.dart` compat export; `core/error_localizer.dart` yalnız §6 errorServer).
  Bu spec'teki dosya adları §8.2 ile çelişirse §8.2 kazanır.
- `docs/mobile-ui-audit/DESIGN_B.md` — token, tipografi, ölçü, bileşen imzaları, l10n tablosu, korunacak davranış/key listesi.
  Belgeyle çelişen bir şey gerekirse kodu belgeye uydur; belge yanlışsa `ask` ile koordinatöre sor, kendin sapma.
- Görsel referans: `docs/mobile-ui-audit/directions/B/*.html` ve `_shots/B-*.png`.

## Kapsam
1. `mobile/lib/theme/app_theme.dart` yeniden: açık/koyu ColorScheme tüm M3 rolleriyle elle; `AppUiTokens` extension
   (`mobile/lib/theme/app_ui_tokens.dart`); component theme'leri (Filled/Outlined/Text button, InputDecoration, NavigationBar,
   SegmentedButton, BottomSheet, Dialog, Card elevation 0, Divider, ListTile, SnackBar, ProgressIndicator) DESIGN_B'ye göre.
   Eski public sabitler (`AppTheme.primaryBurgundy`, `statusColors(...)` vb.) ekranlar hâlâ kullandığı için KALIR ama yeni
   token'lara yönlendirilir (`@Deprecated` ile işaretle); D4'te silinecek.
2. `mobile/lib/widgets/ui/**`: DESIGN_B §4'teki tüm bileşenler, her biri ayrı dosya + `ui.dart` barrel.
3. `mobile/lib/core/app_date_format.dart` (TR/EN) — DESIGN_B tarih kuralları; mevcut `core/attendance_date.dart` davranışını bozmadan.
4. `mobile/lib/widgets/app_bottom_navigation.dart` + `mobile/lib/screens/main_navigation_shell.dart`: yüzen hap + büyük QR dairesi
   kalkar; 5 eşit `NavigationDestination`; gövde nav yüksekliğini ayırır (`extendBody` false ya da eşdeğer); Semantics korunur.
   QR "Tara" intent'i (router/qr_open_intent) D2a'nın işidir; router dosyalarına dokunma.
5. l10n (KOORDİNATÖR KARARI — DESIGN_B §8.3'teki "dalga dalga copy paketi" yerine): §6'daki 73 değişen + 22 yeni anahtarın
   HEPSİNİ bu dalgada uygula, `flutter gen-l10n` ile üret. 9 Günün Sözü anahtarını SİLME (home hâlâ kullanıyor; D2a sonrası
   koordinatör siler). D2/D3 worker'ları l10n'a hiç yazmayacak. Değişen metin yüzünden kırılan mevcut testlerde (hangi klasörde olursa)
   YALNIZ string literal'i yeni l10n değerine güncellemen serbesttir — assert mantığı/akış değişmez; her birini raporda dosya:satır listele.
   `errorServer` değişimi ve `core/error_localizer.dart` §6'ya göre.
6. Testler: `mobile/test/widgets/app_bottom_navigation_test.dart`, `mobile/test/theme/**` güncelle/ekle; yeni bileşenler için
   `mobile/test/ui_redesign/d1/**` (her bileşen: render açık/koyu, Semantics, text scale 2.0'da overflow yok, disabled/busy).
   `mobile/screenshot_test/**`: yeni nav ile bozulan finder'ları düzelt; ek olarak `ui_kit_*` görüntüleri (bileşen kataloğu açık/koyu).

## Ownership (yalnız bunlara yaz)
- DESIGN_B §8.2 listesindeki 36 dosya + `mobile/lib/main.dart` (yalnız tema/SystemUiOverlay bağlama gerekiyorsa)
- `mobile/test/theme/**`, `mobile/test/widgets/app_bottom_navigation_test.dart`, `mobile/test/router/app_router_integration_test.dart` (yalnız nav değişimi kırarsa), yeni `mobile/test/ui_redesign/d1/**`,
  `mobile/screenshot_test/**` (finder'lar + `ui_kit_*` katalog çekimleri; çıktı klasörü parametreli: varsayılan `current/` korunur,
  yeni çekimler `docs/mobile-ui-audit/after-d1/`); diğer test dosyalarında yalnız l10n string literal güncellemesi (yukarıdaki madde 5)
- Rapor görüntüleri: `docs/mobile-ui-audit/after-d1/*.png` (harness çıktısını buraya da kopyala; `current/` ÖNCE görüntüleridir, ÜZERİNE YAZMA).

## Kapsam dışı
- `mobile/lib/screens/**` (shell hariç), `mobile/lib/widgets/cards/**`, `widgets/history/**`, `widgets/visitor/**`, providers/repositories/models: dokunma.
  Tema değişimi bir ekranda derleme hatası yaratırsa minimum düzeltmeyi `ask` ile önce sor.
- pubspec'e yeni paket yok (gerekirse `ask`).

## Kapılar (kendin koş, çıktıyı rapora yaz)
1. `cd mobile && flutter gen-l10n && flutter analyze --no-pub` → No issues found.
2. `cd mobile && flutter test --no-pub` → hepsi geçer (başlangıçta 600 test; yeni testlerle artar). Mevcut bir testi değiştirdiysen
   hangi assert'in neden değiştiğini rapora yaz — davranış testi (komut kurtarma, oturum, saat) DEĞİŞTİRİLMEZ.
3. `cd mobile && flutter test --no-pub --update-goldens screenshot_test/` → yeşil; `after-d1/` kopyası.
4. view_image ile en az: home_filled_light/dark, qr_filled_light, ui_kit katalog açık/koyu, home_textscale130 — nav içerik örtmüyor,
   etiketler tek satır, pembe zemin yok.

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Çalışma ağacında başka oturumların `convex/**`, `src/**` değişiklikleri var; DOKUNMA.

## Rapor (worker_done, ≤10 satır)
Değişen/yeni dosya sayısı · bileşen listesi · l10n eklenen/değişen anahtar sayısı · kapı 1-3 sonucu (test sayısı önce→sonra) ·
değiştirilen mevcut test assert'leri · DESIGN_B'den sapma (varsa) · file:line.
