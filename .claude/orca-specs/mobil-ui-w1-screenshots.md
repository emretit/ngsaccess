# Mobil UI audit — W1: mevcut ekranların görüntü kaynağı (screenshot harness)

## Hedef (test edilebilir)
`cd mobile && flutter test --no-pub --update-goldens screenshot_test/` komutu, NGS Plus Flutter uygulamasının
tüm kullanıcı ekranlarının mevcut (DEĞİŞTİRİLMEMİŞ) görünümünü gerçek font + ikonlarla PNG olarak üretir ve
`docs/mobile-ui-audit/current/INDEX.md` her PNG'yi listeler.

Amaç: tasarım auditinde ve sonraki yeniden tasarımda önce/sonra kıyası. Uygulama koduna dokunulmaz.

## Bağlam
- Uygulama: `mobile/` (Flutter, provider + go_router, TR/EN l10n `lib/l10n/`, tema `lib/theme/app_theme.dart`).
- Ekranlar: `lib/screens/**` — splash, auth/login, auth/forgot_password, home, requests, history, qr_scan,
  visitor/visitor_screen, visitor/visitor_form_screen, profile, settings/select_device, main_navigation_shell
  (alt gezinme `lib/widgets/app_bottom_navigation.dart`). Diyaloglar/sheet'ler: `widgets/door_operation_recovery_dialog.dart`,
  `widgets/history/history_filter_sheet.dart`, ziyaretçi ayrıntısı `widgets/visitor/visitor_detail.dart`.
- Her ekranın widget testi zaten var: `mobile/test/widgets/*_test.dart`, `mobile/test/visitor_*_test.dart`,
  sahte nesneler `mobile/test/helpers/mocks.dart` (mocktail). Provider alt sınıflarıyla sahte durum verme kalıbı
  `test/widgets/home_screen_test.dart` içinde. Bu kalıpları kopyalayarak/import ederek kullan.
- Fontlar: flutter_test varsayılan olarak Ahem (kutu) fontu kullanır. Gerçek görünüm için test başında
  `FontLoader` ile yükle: Roboto (tüm ağırlıklar) ve MaterialIcons —
  `$(flutter sdk)/bin/cache/artifacts/material_fonts/` (makinede: `/opt/homebrew/bin/flutter` → readlink ile SDK kökü;
  dosyalar Roboto-*.ttf, MaterialIcons-Regular.otf). Yol sabit kodlanmasın: `FLUTTER_ROOT` env ya da
  `Platform.resolvedExecutable` üzerinden bul; bulunamazsa net hata ver. Uygulama `cupertino_icons` kullanıyorsa
  pub cache'teki CupertinoIcons fontunu da yükle. Türkçe karakterler (ğüşıöç İ) doğru görünmeli.
- Kamera (mobile_scanner) testte çalışmaz; QR ekranı mevcut widget testindeki gibi sahte/yer tutucu durumla çizilsin.

## Kapsam
1. `mobile/screenshot_test/` altında harness (ör. `screens_screenshot_test.dart` + `_harness.dart` yardımcıları).
   `test/` DIŞINDA olmalı ki varsayılan `flutter test` (tam suite kapısı) bunları çalıştırmasın / golden kıyaslamasın.
2. Cihaz: 390×844 mantıksal, devicePixelRatio 2 (çıktı 780×1688), iOS benzeri güvenli alan (üst 47, alt 34 padding)
   `MediaQuery` ile. Locale tr. Gerçekçi Türkçe sahte veri: kişi "Ayşe Yılmaz", proje "NGS Teknoloji — Merkez",
   kapılar "Ana Giriş", "Otopark Turnike"; saatler Türkiye saati; ziyaretçi adları, talepler (izin + PDKS düzeltme).
3. Her ekran için durumlar (uygulamada bu durum varsa):
   - `*_filled_light`, `*_filled_dark` (dolu veri)
   - `*_empty_light`, `*_loading_light`, `*_error_light`
   - Kaydırılan ekranlarda (home, history, requests, visitor, profile, visitor_form) ek `*_long_light`: yükseklik
     içerik boyu kadar (en fazla 2400 mantıksal) — tüm içerik görünsün.
   - Erişilebilirlik: home ve login için `*_textscale130_light` (TextScaler.linear(1.3)).
   - Diyalog/sheet: door recovery dialog, history filter sheet, visitor detail açık hali.
   - Ana kabuk: alt gezinme her sekme seçili hali bir kez görünsün (home görüntüsü yeterliyse tekrar etme).
4. PNG'ler: `docs/mobile-ui-audit/current/<ekran>_<durum>_<tema>.png`. `matchesGoldenFile` kullanıyorsan golden
   yolunu bu dizine yönlendir (göreli yol) ya da üretimden sonra kopyalayan küçük bir betik ekle
   (`mobile/screenshot_test/README.md` içinde tek komutla nasıl üretildiği yazsın).
5. `docs/mobile-ui-audit/current/INDEX.md`: tablo — dosya · ekran · durum · tema · kaynak dosya (lib/...:satır) ·
   route · not (ör. "kamera yer tutucu").

## Ownership (yalnız bunlara yaz)
- `mobile/screenshot_test/**` (yeni)
- `docs/mobile-ui-audit/current/**` (yeni)

## Kapsam dışı
- `mobile/lib/**`, `mobile/test/**`, `pubspec.yaml`, `pubspec.lock`, platform klasörleri DEĞİŞMEZ (yeni paket ekleme yok;
  golden_toolkit vb. yok — FontLoader ile kendin yükle).
- Tasarım yorumu/audit yazma — bu iş yalnız görüntü kaynağı. Görülen bariz render sorunlarını INDEX.md'de "not" sütununa yaz.
- Ağ, Convex, simülatör, gerçek cihaz yok.

## Kapılar (hepsini kendin koş, çıktısını raporla)
1. `cd mobile && flutter analyze --no-pub` → No issues found (screenshot_test dahil).
2. `cd mobile && flutter test --no-pub` → mevcut suite aynen geçer (screenshot_test çalışmaz).
3. `cd mobile && flutter test --no-pub --update-goldens screenshot_test/` → yeşil; PNG sayısı = INDEX satır sayısı.
4. En az 3 PNG'yi görüntü aracıyla (view_image) aç: font gerçek mi (kutu değil), ikonlar görünüyor mu, Türkçe karakter doğru mu.

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Çalışma ağacında başka oturumların değiştirdiği `convex/**`, `src/**` dosyaları var; onlara DOKUNMA.

## Rapor (worker_done, ≤10 satır)
PNG sayısı · üretim komutu · kapı 1-3 sonucu (test sayısı) · font/ikon doğrulaması · üretilemeyen ekran/durum ve sebebi · file:line.
