# Mobil UI — D2a: Ana Sayfa + QR + kapı ekranları (Yön B)

## Hedef (test edilebilir)
Ana Sayfa, QR (QR Kodum + Tara), Kapı seçimi ve Kapı kurtarma diyaloğu DESIGN_B.md §5.4–§5.7 ve B mockup'larıyla
(`docs/mobile-ui-audit/directions/B/` + `_shots/B-*.png`: home, home-loading, home-empty, home-error, home-dark, qr*, door-*,
select-device*) aynı görünür; "QR kod tara" doğrudan **Tara** sekmesini açar; Günün Sözü kalkar. Tüm davranışlar korunur.
Kapılar: analyze 0, tam test yeşil.

## Kaynak
- `docs/mobile-ui-audit/DESIGN_B.md` §4 (kit API — D1'de `mobile/lib/widgets/ui/**` olarak HAZIR, `ui.dart` barrel), §5.4–5.7, §7 (korunacak davranış + test key'leri).
- `docs/mobile-ui-audit/directions/B/GAPS.md` "Koordinatör kararı": GB-01 kamera izni — henüz sorulmamış/yeniden sorulabilir → sistem izin isteği
  (`l10n.qrGrantCameraPermission`), kalıcı ret → mevcut "Ayarları aç".
- D1 raporu: `mobile/test/ui_redesign/d1/REPORT.md`. l10n hazır (D1 + koordinatör 6 anahtar). Kit kullanım örnekleri `mobile/test/ui_redesign/d1/**`.

## Kapsam
1. Ana Sayfa (`screens/home/home_screen.dart`): AppBrandBand (selam + proje + tam tarih, açık status bar) → banda binen "Bugün" kartı
   (durum rozeti, ilk giriş / çıkış / son giriş saatleri — mevcut provider verisiyle; olmayan veriyi uydurma) → tek AppPrimaryButton
   "QR kod tara" → Kapıyı aç satırı (AppListRow, seçili kapı) → AppListGroup: Taleplerim (bekleyen sayısı yalnız mevcut veride varsa; yoksa rozet yok),
   Ziyaretçi davet et. Günün Sözü widget'ı ve çağrıları silinir. Yükleniyor = AppSkeleton (sarı uyarı değil), hata = AppDataNotice, boş = "Bugün kayıt yok".
2. QR intent: yeni `lib/router/qr_open_intent.dart` + `route_paths.dart`/`app_router.dart` — `/qr?mode=scan` (ya da DESIGN_B'deki sözleşme) Tara sekmesini açar;
   parametresiz `/qr` eski davranış (QR Kodum). Deep link ve route guard testleri bozulmaz.
3. QR ekranı (`screens/qr_scan/qr_scan_screen.dart`): AppPageHeader + AppSegmentControl (QR Kodum / Tara); QR paneli (radius 16, izinli tek hafif gölge),
   kalan süre çubuğu + "{n} sn", tek satır talimat, Yenile görünür alanda (nav örtmez). Tara: kamera çerçevesi; izin durumları GB-01'e göre.
   Geliştirici dili (sunucu bitiş zamanı, fiziksel geçiş doğrulamaz) ekrandan kalkar (§6 metinleri).
4. Kapı seçimi (`screens/settings/select_device_screen.dart`): AppListGroup/AppListRow, seçim = nötr zemin + tik (şekil değişmez), boş durum AppEmptyState.
5. Kapı kurtarma diyaloğu (`widgets/door_operation_recovery_dialog.dart`): AppDialog; metin koşula uygun (kontrol edilebiliyorsa kapı adıyla "Durumu kontrol et").
6. `widgets/cards/**`: artık kullanılmayan kart widget'larını silme — kullanılmıyorsa `@Deprecated` işaretle (D4 temizler); kullanılanları kit'e geçir.

## Ownership (yalnız bunlara yaz) — DESIGN_B §8.1 D2a satırı
- `mobile/lib/screens/home/home_screen.dart`, `mobile/lib/screens/qr_scan/qr_scan_screen.dart`, `mobile/lib/screens/settings/select_device_screen.dart`,
  `mobile/lib/widgets/cards/{attendance_status_card,quick_action_card,door_command_status_card,progress_hero_card,stat_card,section_header}.dart`,
  `mobile/lib/widgets/door_operation_recovery_dialog.dart`, `mobile/lib/router/app_router.dart`, `mobile/lib/router/route_paths.dart`, yeni `mobile/lib/router/qr_open_intent.dart`
- Testler: `mobile/test/widgets/{home_cards,home_screen,qr_scan_screen,select_device_screen,door_command_status_card,door_operation_recovery}_test.dart`,
  `mobile/test/router/**`, yeni `mobile/test/ui_redesign/d2a/**`

## Kapsam dışı / paralel çalışma
- AYNI ANDA D2b worker'ı `screens/auth/**`, `splash_screen.dart`, `screens/profile/**`, `widgets/brand_mark.dart` üzerinde çalışıyor — DOKUNMA.
- `lib/widgets/ui/**`, `lib/theme/**`, `lib/core/**`, `lib/l10n/**`: YAZMA (DS sahibi). Kit'te hata/eksik bulursan `ask` ile sor; kendi ekranında geçici kopya bileşen yazma.
  Yeni metin gerekiyorsa `ask` ile anahtar adı + TR/EN öner; koordinatör ekler.
- `mobile/screenshot_test/**`: YAZMA. Görsel kontrol için çalıştırabilirsin:
  `flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=/tmp/mui-d2a screenshot_test/` — finder kırılırsa raporla, düzeltme.
- providers/repositories/services/models: değişmez (veri yoksa UI'da gösterme, uydurma).

## Kapılar (kendin koş; diğer worker aynı ağaçta çalıştığı için geçici kırmızı görürsen kendi dosyalarına ait mi diye ayır)
1. `cd mobile && flutter analyze --no-pub` → No issues found.
2. `cd mobile && flutter test --no-pub` → hepsi yeşil (başlangıç 709). Davranış testleri (kapı komutu kurtarma/idempotency, sessionEpoch, deep link, route guard) DEĞİŞMEZ;
   yalnız görsel/finder değişen assert'leri güncelle ve raporda dosya:satır listele.
3. Kendi ekranlarının /tmp/mui-d2a çekimlerini view_image ile B mockup'larıyla yan yana kıyasla (home açık/koyu, home-loading, qr, qr-scan, select-device, door-recovery).

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Başka oturumların `convex/**`, `src/**` değişikliklerine DOKUNMA.

## Rapor (worker_done, ≤10 satır) + `mobile/test/ui_redesign/d2a/REPORT.md`
Değişen dosyalar · QR intent sözleşmesi · kapı 1-2 sonucu (test sayısı) · değişen mevcut assert'ler · mockup'tan sapmalar ve sebebi · kullanılmayan (deprecated) widget listesi.
