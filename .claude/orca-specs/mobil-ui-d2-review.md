# Mobil UI — D2 denetimi (Claude, salt okuma)

## Hedef
Codex'in yazdığı D2a (Ana Sayfa / QR / kapı seçimi / kapı kurtarma / QR intent router) ve D2b (Açılış / Giriş / Şifre yardımı / Profil / brand_mark)
ekranlarını bağımsız denetle; bulguları `docs/mobile-ui-audit/review-d2.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kaynak
- Sözleşme: `docs/mobile-ui-audit/DESIGN_B.md` §4 (kit API), §5.1–5.7, §5.19, §6, §7 (davranış invariants + korunacak key/semantics) ve sondaki "Ek — koordinatör kararları";
  `docs/mobile-ui-audit/directions/B/GAPS.md` "Koordinatör kararı" (GB-01 kamera izni, GB-02 anahtarlar).
- Codex raporları: `mobile/test/ui_redesign/d2a/REPORT.md`, `mobile/test/ui_redesign/d2b/REPORT.md` — raporu değil KODU ve diff'i denetle.
- Önceki denetim kalıbı ve D1 bulguları: `docs/mobile-ui-audit/review-d1.md` (tekrar etme; D2'de hâlâ geçerliyse "RV1-NN hâlâ açık" diye referans ver).
- Diff: `cd /Users/emreaydin/ngsaccess && git diff -- <dosya>` + untracked `git status --short -- mobile`.
- D2 kapsamı (yalnız bunlar):
  - D2a: `mobile/lib/screens/home/home_screen.dart`, `lib/screens/qr_scan/qr_scan_screen.dart`, `lib/screens/settings/select_device_screen.dart`,
    `lib/widgets/cards/{attendance_status_card,quick_action_card,door_command_status_card,progress_hero_card,stat_card,section_header}.dart`,
    `lib/widgets/door_operation_recovery_dialog.dart`, `lib/router/app_router.dart`, `lib/router/route_paths.dart`, `lib/router/qr_open_intent.dart` (yeni),
    testler `test/widgets/{home_cards,home_screen,qr_scan_screen,select_device_screen,door_command_status_card,door_operation_recovery}_test.dart`, `test/router/**`, `test/ui_redesign/d2a/**`
  - D2b: `lib/screens/auth/login_screen.dart`, `lib/screens/auth/forgot_password_screen.dart`, `lib/screens/splash_screen.dart`, `lib/screens/profile/profile_screen.dart`,
    `lib/widgets/brand_mark.dart`, testler `test/widgets/{login_screen,forgot_password_screen,profile_screen}_test.dart`, `test/ui_redesign/d2b/**`
- AYNI ANDA D3a (history/requests) ve D3b (visitor) worker'ları ağaçta çalışıyor — onların dosyalarını DENETLEME.
- Görseller: `docs/mobile-ui-audit/after-d2/*.png` vs B mockup `docs/mobile-ui-audit/directions/_shots/B-{home,home-loading,home-empty,home-error,home-dark,qr*,door-*,select-device*,startup*,login*,password-help*,profile*}.png`.
  Görselleri Read ile aç ve yan yana kıyasla.

## Denetim soruları
1. Davranış invariants (§7.1) — en önemli: kapı komutu kurtarma/idempotency (requestId tekrar kullanımı, resend yok), sessionEpoch (eski oturum intent/sonucu yeni oturuma sızmıyor),
   route guard + deep link allowlist, `/qr?mode=scan` dış URL'nin tarama yetkisi sayılmaması, kamera start/stop lifecycle, login autofill/next/done/klavye kaydırma,
   splash "Yeniden dene"/"Girişe dön", forgot-password kopyalama + sahte başarı yok, profil tema/dil kaydı (isSaving PopScope, hata → önceki değer). Diff'te mantık değişen satırı bul ve gerekçesini sorgula.
2. Test kalitesi: REPORT'taki "değişen mevcut assert" tablosunu diff'le doğrula — gerçekten yalnız finder/literal mi, yoksa davranış assert'i zayıflatılmış/silinmiş mi?
   Yeni testler anlamlı mı (yalnız "render oluyor" değil)? `ignore: deprecated_member_use` gibi dosya düzeyi bastırmalar gerçek sorunu gizliyor mu?
3. Sözleşme uyumu: bordo yalnız bantta + ekranda tek dolu primary; gölge yalnız durum kartı + QR paneli; Günün Sözü tamamen kalktı mı (widget + çağrı + ölü import/asset);
   veri uydurma yok (bekleyen talep rozeti, kapı adı yalnız gerçek veride).
4. Erişilebilirlik: 48dp hedef, text scale 2.0 + 320dp taşma, Semantics (header, selected, button label), focus görünürlüğü, AppDialog/AppSheet odak dönüşü.
5. Bilinen küçükler — doğrula ve seviye ver: (a) home "+1 hareket" metni (anlaşılır mı, l10n'dan mı geliyor, plural doğru mu),
   (b) login "E-postamı hatırla" checkbox–etiket boşluğu, (c) AppDialog yalnız-Kapat durumunda Kapat'ın primary slotunda olması (kit API'sine secondary-only varyant önerisi; kit D1/DS'nin).
6. Ölü kod / tekrar: `widgets/cards/**` deprecated olanlar gerçekten kullanılmıyor mu (grep), kullanılanlar kit'e geçmiş mi; ekranda kit'i kopyalayan yerel stil var mı.

## Kapılar (yalnız hedefli — diğer worker'lar ağaçta çalışıyor, tam suite KOŞMA)
- `cd mobile && flutter analyze --no-pub lib/screens/home lib/screens/qr_scan lib/screens/settings lib/screens/auth lib/screens/profile lib/screens/splash_screen.dart lib/widgets/cards lib/widgets/door_operation_recovery_dialog.dart lib/widgets/brand_mark.dart lib/router test/ui_redesign/d2a test/ui_redesign/d2b`
- `cd mobile && flutter test --no-pub test/ui_redesign/d2a test/ui_redesign/d2b test/router test/widgets/home_cards_test.dart test/widgets/home_screen_test.dart test/widgets/qr_scan_screen_test.dart test/widgets/select_device_screen_test.dart test/widgets/door_command_status_card_test.dart test/widgets/door_operation_recovery_test.dart test/widgets/login_screen_test.dart test/widgets/forgot_password_screen_test.dart test/widgets/profile_screen_test.dart`
  Kırmızı görürsen D3 worker'larının eşzamanlı değişikliğinden mi (ör. l10n/kit) yoksa D2 dosyasından mı ayır.

## Çıktı: `docs/mobile-ui-audit/review-d2.md`
En üstte 3 satırlık özet + kapı sonuçları. Bulgu tablosu: ID (RV2-NN) · seviye ENGEL (D4'ten önce mutlaka düzeltilmeli; davranış/veri/erişilebilirlik kırığı) /
DÜZELT (bu tur düzeltilmeli) / NOT · sahip (D2a / D2b / DS-kit) · dosya:satır · sorun · somut düzeltme önerisi.

## YASAK
- Kod/test/ARB DEĞİŞTİRME (salt okuma; tek yazacağın dosya review-d2.md). `git add`, `git commit`, `git stash`, `git reset`, `git restore`, `git checkout` ÇALIŞTIRMA.

## Rapor (worker_done, ≤10 satır)
ENGEL/DÜZELT/NOT sayıları (sahip başına) · en önemli 3 bulgu (dosya:satır) · kapı sonuçları.
