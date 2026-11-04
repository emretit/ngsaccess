# Mobil UI — D1 denetimi (Claude, salt okuma)

## Hedef
Codex'in yazdığı D1 temelini (tema + `AppUiTokens` + `mobile/lib/widgets/ui/**` kit + `AppDateFormat` + alt gezinme/kabuk + l10n)
bağımsız denetle; bulguları `docs/mobile-ui-audit/review-d1.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kaynak
- Sözleşme: `docs/mobile-ui-audit/DESIGN_B.md` (§1-4, §6, §7, §8.2). Codex raporu: `mobile/test/ui_redesign/d1/REPORT.md` — raporu değil KODU ve diff'i denetle.
- Diff: `cd /Users/emreaydin/ngsaccess && git diff -- mobile/lib mobile/test` + untracked `git status --short -- mobile` (yeni dosyalar).
  NOT: Aynı anda D2a/D2b worker'ları `mobile/lib/screens/**`, `widgets/cards/**`, `router/**`, `brand_mark.dart` ve ilgili testleri değiştiriyor;
  bunlar D1 değil — DENETLEME. D1 kapsamı: `lib/theme/**`, `lib/widgets/ui/**`, `lib/widgets/app_bottom_navigation.dart`, `lib/screens/main_navigation_shell.dart`,
  `lib/core/{app_date_format,spacing,error_localizer,errors}.dart`, `lib/l10n/*.arb`, `lib/widgets/history/history_calendar.dart:95`, `test/ui_redesign/d1/**`,
  `test/theme/**`, `test/widgets/app_bottom_navigation_test.dart`, `screenshot_test/**` ve REPORT'taki literal değişiklikleri.
- Görseller: `docs/mobile-ui-audit/after-d1/*.png` (özellikle `ui_kit_light/dark`, home, qr, textscale130) vs B mockup `docs/mobile-ui-audit/directions/_shots/B-*.png`.

## Denetim soruları
1. Doğruluk: kit bileşenleri DESIGN_B §4 imzalarına uyuyor mu; busy/disabled/çift dokunma; `AppUiTokens.of` token yoksa StateError — üretimde
   tema dışında açılan bir route/overlay/dialog (ör. `showDialog(useRootNavigator)`, `Overlay`, `MaterialApp.builder` dışı) bunu tetikleyebilir mi? Grep ile kanıtla.
2. Tema sızıntısı: elle ColorScheme'de pembe/fromSeed tonu kalan rol var mı; eski `AppTheme.*` deprecated sabitleri yeni token'a mı gidiyor; koyu tema kontrastları
   (§1 tablosu) kodda aynı mı — hex'leri karşılaştır, 3 oranı kendin hesapla.
3. Erişilebilirlik: Semantics (nav label "QR İşlemleri" korunmuş mu, selected state), 48dp hedef, text scale 2.0, focus görünürlüğü, reduce-motion.
4. `AppDateFormat`: Türkiye saati kuralı — cihaz saat dilimine bağımlı `toLocal()`/`DateTime.now()` sunumu var mı; TR/EN ay kısaltmaları; aralık biçimi "9–11 Kas", ay/yıl geçişi.
5. l10n: 73+22+6 anahtar ARB'de TR/EN eşit mi; placeholder tipleri; `errorServer` değişimi kullanıcıya teknik kod göstermiyor mu.
6. Test kalitesi: değiştirilen mevcut assert'ler gerçekten yalnız literal mi (mantık zayıflatılmış mı); yeni kit testleri anlamlı mı (yalnız "render oluyor" mu).
7. Gereksiz karmaşıklık / ölü kod / tekrar eden stil.

## Kapılar (yalnız hedefli — diğer worker'lar ağaçta çalışıyor, tam suite KOŞMA)
- `cd mobile && flutter analyze --no-pub lib/widgets/ui lib/theme lib/core lib/widgets/app_bottom_navigation.dart lib/screens/main_navigation_shell.dart`
- `cd mobile && flutter test --no-pub test/ui_redesign/d1 test/theme test/widgets/app_bottom_navigation_test.dart`

## Çıktı: `docs/mobile-ui-audit/review-d1.md`
Bulgu tablosu: ID (RV1-NN) · seviye ENGEL (D2/D3'ten önce düzeltilmeli) / DÜZELT (bu tur düzeltilmeli) / NOT · dosya:satır · sorun · somut düzeltme önerisi.
En üstte 3 satırlık özet + kapı sonuçları.

## YASAK
- Kod/test/ARB DEĞİŞTİRME (salt okuma). `git add/commit/stash/reset/restore/checkout` YOK.

## Rapor (worker_done, ≤10 satır)
ENGEL/DÜZELT/NOT sayıları · en önemli 3 bulgu (dosya:satır) · kapı sonuçları.
