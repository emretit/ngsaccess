# D5 — Emre geri bildirimi (2026-11-04)

- Giriş, HEAD düzenindeki ortalanmış marka/karşılama, açıklama, 28dp köşeli kart, ikonlu alanlar, hatırla satırı, ortalanmış şifre yardımı ve 56dp ana eyleme döndü; renkler yalnız AppUiTokens/colorScheme. Silinen üç eski metin anahtarı TR/EN olarak geri eklendi ve `flutter gen-l10n` çalıştırıldı.
- Alt gezinme kit bileşeninde yüzen 28dp köşeli yüzey, normal telefonda 76dp QR sütunu ve 64dp yuvarlak QR eylemine döndü; 320dp/büyük metinde eşit hücreler ve küçülen daire taşmayı önler. Compat export ve seçili indeks API'si aynı.
- Ana sayfada yalnız bandın `brandMark` slotuna `BrandMark.band()` eklendi; karşılama, proje, tarih, Bugün kartı ve D2a akışları aynı.
- Üretim dosyaları: `lib/screens/auth/login_screen.dart`, `lib/widgets/ui/app_bottom_navigation.dart`, `lib/widgets/brand_mark.dart`, `lib/screens/home/home_screen.dart`; metinler: `lib/l10n/app_{tr,en}.arb`, üç üretilmiş Dart dosyası, `test/l10n/expected_keys.json`. Shell/compat export/tema tokenları değiştirilmedi.
- Bilerek eski sürümden alınmayanlar: sabit pembe/bordo hex'ler ve eski fromSeed renkleri; hata SnackBar'ı yerine D2b AppDataNotice/liveRegion, ilk geçersiz alana odak ve busy metin/semantics korundu. Klavyede gizlenen barın alanını Scaffold ayırmaya devam eder (`extendBody:false`), bu nedenle son içerik eylemi örtülmez; eski `extendBody:true` geri alınmadı.
- Klavye odağı sırasında dış dekorasyonun widget ağacını değiştirmemesi için odak dekorasyonu her zaman vardır; bu, QR'ye Tab+Enter aktivasyonunu mevcut router testiyle korur.
- Test uyarlamaları: `test/widgets/login_screen_test.dart:85` görsel hizalama adı; `:88,97,98,100` CheckboxListTile, aynı kart sol sınırı, eski 56dp etiket girintisi ve ortalı yardım; `:220,310,311,314` checkbox görsel finder/tipi (disabled/value ve 48dp assert'leri korunur). `test/ui_redesign/d1/fix1_test.dart:644` 320dp hücre genişliği 64→54 (yüzen dış boşluklar); aynı dosyada selected semantics/48dp yüksekliği aynen. `screenshot_test/screens_screenshot_test.dart:622` aynı önbellek satırını kısa viewport'ta kaydırarak bulur; hata ve kayıt assert'leri silinmedi.
- Ek doğrulama: `test/widgets/home_screen_test.dart:255` 32dp logo; `test/ui_redesign/d5/feedback_test.dart` eski karşılama/logo, ilk hata+next odağı, açık/koyu yuvarlak QR, token rengi ve Tab+Enter selected semantics.

## Kapılar

1. `flutter analyze --no-pub` — **No issues found**, exit 0 (`/tmp/d5-analyze-final.log`).
2. `flutter test --no-pub` — **867/867 geçti**, exit 0: başlangıç 864 + yeni D5 3 test (`/tmp/d5-full-test-final.log`). Mevcut klavye/router, BranchVisibility/lifecycle, son içerik eylemi, auth ve D2a davranış assert'leri korunur.
3. `flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=../docs/mobile-ui-audit/after-b screenshot_test/` — **294/294 geçti**, exit 0 (`/tmp/d5-screenshots-final.log`); tüm `after-b/` PNG'leri ve INDEX yenilendi.
4. `git diff --check` — değiştirdiğim takipli dosyalarda temiz; commit/stage/push yapılmadı.

İlk keşif turları final değildir: yüzen barın odak dekorasyonu null→dolu geçerken InkWell state'i yenilendiği için Tab+Enter testi yakaladı; dekorasyonu sürekli tutarak düzeltildi. 64→54dp yalnız görsel genişlik beklentisi güncellendi; screenshot önbellek satırı daha kısa viewport'ta kaydırılarak bulunur. Giriş satırının son görsel düzenlemesi sürerken başlayan önceki tam tur eski uygulama derlemesi/yeni finder'larla çalıştı; nihai, değişiklik yapılmadan başlatılan tam tur 867/867 geçti.

## Görsel karşılaştırma

`view_image` ile yan yana karşılaştırılan current ↔ after-b çiftleri:

- `login_filled_light.png`, `login_filled_dark.png`: marka/karşılama, kart, alanlar, checkbox satırı ve ortalı eylemler eski düzeninde; yeni token renkleri ve mevcut “Giriş yap” / “Şifre yardımı” metinleri kullanılıyor.
- `home_filled_light.png`, `home_filled_dark.png`: yüzen yüzey, seçili arka plan ve yuvarlak QR yerleşimi eski görünümde; üstte mevcut Yön B bandı + 32dp NGS Plus logosu. Selam sistem saatinden gelir; çekimde akşam selamı normaldir.
- `login_matrix_{light,dark}_{tr,en}_w320_s200.png`, `home_matrix_{light,dark}_{tr,en}_w320_s200.png`: dört açık/koyu/dil kombinasyonu; yatay taşma veya kesilen nav etiketi yok, uzun etiketler çok satırlı. Giriş kaydırılabilir olduğu için %200 matrisinde alanlara odaklanmanın kaydırdığı viewport çekilir; klavye/son eylem erişimi ayrıca widget testlerinde doğrulandı.
- Ek `after-b` incelemesi: `login_empty_light.png`, `login_error_light.png`, `login_loading_light.png`, `login_textscale130_light_tr_w390_s130.png`, `visitor_cached_error_light.png`; erişim kapalı notice anlamı, busy metni ve önbellek hata+satır içeriği görülüyor.

Yan yana inceleme panoları yalnız `/tmp/d5-{login,home}-{light,dark}-comparison.png` ve `/tmp/d5-320-200-{tr,en}.png` içinde; proje referansları değiştirilmedi.
