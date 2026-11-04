# Mobil UI — D2b: Açılış + Giriş + Şifre yardımı + Profil (Yön B)

## Hedef (test edilebilir)
Açılış, Giriş, Şifre yardımı ve Profil (+ tema/dil seçici) DESIGN_B.md §5.1–§5.3, §5.19 ve B mockup'larıyla
(`docs/mobile-ui-audit/directions/B/` + `_shots/B-*.png`: startup*, login*, password-help*, profile*) aynı görünür; davranış korunur.
Kapılar: analyze 0, tam test yeşil.

## Kaynak
- `docs/mobile-ui-audit/DESIGN_B.md` §4 (kit API — D1'de `mobile/lib/widgets/ui/**` HAZIR, `ui.dart` barrel), §5.1–5.3, §5.19, §6, §7.
- GAPS.md koordinatör kararı GB-02: hazır anahtarlar `startupBandTitle`, `profileAccountSection`, `profilePreferencesSection`, `profileSupportSection`.
- D1 raporu `mobile/test/ui_redesign/d1/REPORT.md`; kit örnekleri `mobile/test/ui_redesign/d1/**`.

## Kapsam
1. Açılış (`screens/splash_screen.dart`): AppBrandBand; yükleniyor / hata (hata başlığı gerçek durumu söyler, "başlatılıyor" kalmaz) + Yeniden dene + Girişe dön.
2. Giriş (`screens/auth/login_screen.dart`): üstte bordo bant (marka + tek "Giriş yap" başlığı), altta nötr zeminde AppTextField'lar (kalıcı etiket, 3:1+ kontur),
   "E-postamı hatırla" tek birleşik kontrol, "Şifre yardımı" metin butonu, AppDataNotice hata (erişim kapatıldı → kurum yöneticisine başvurun), AppPrimaryButton
   "Giriş yap" busy = "Giriş yapılıyor". Gradyan/28dp kart/gölge kalkar. Autofill, next/done, klavye kaydırma, mevcut key'ler KORUNUR.
3. Şifre yardımı (`screens/auth/forgot_password_screen.dart`): §5.3 — kısa adımlar, ayrı alıntı alanı + "Talep metnini kopyala" (mevcut kopyalama davranışı), sahte başarı yok.
4. Profil (`screens/profile/profile_screen.dart`): kompakt kimlik satırı (avatar + ad + e-posta + proje) → AppListGroup bölümleri Hesap / Tercihler / Destek →
   Çıkış yap (danger tonu metin). Tema/dil seçici showAppSheet. Alt sayfalar (kişisel bilgiler, güvenlik, bildirimler, yardım, hakkında, gizlilik) aynı kit diliyle.
5. `widgets/brand_mark.dart`: bant içinde kullanım için gerekli varyant.

## Ownership (yalnız bunlara yaz) — DESIGN_B §8.1 D2b satırı
- `mobile/lib/screens/auth/login_screen.dart`, `mobile/lib/screens/auth/forgot_password_screen.dart`, `mobile/lib/screens/splash_screen.dart`,
  `mobile/lib/screens/profile/profile_screen.dart`, `mobile/lib/widgets/brand_mark.dart`
- Testler: `mobile/test/widgets/{login_screen,forgot_password_screen,profile_screen}_test.dart`, yeni `mobile/test/ui_redesign/d2b/**`

## Kapsam dışı / paralel çalışma
- AYNI ANDA D2a worker'ı home/qr/settings/cards/door dialog/router üzerinde çalışıyor — DOKUNMA.
- `lib/widgets/ui/**`, `lib/theme/**`, `lib/core/**`, `lib/l10n/**`, `lib/main.dart`: YAZMA. Kit eksiği/hatası → `ask`. Yeni metin → `ask` ile anahtar + TR/EN öner.
- `mobile/screenshot_test/**`: YAZMA. Görsel kontrol: `flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=/tmp/mui-d2b screenshot_test/` (finder kırılırsa raporla).
- providers/repositories/services: değişmez (oturum, startup, tema/dil kaydı, clipboard davranışı aynı).

## Kapılar (diğer worker aynı ağaçta; geçici kırmızının kime ait olduğunu ayır)
1. `cd mobile && flutter analyze --no-pub` → No issues found.
2. `cd mobile && flutter test --no-pub` → hepsi yeşil (başlangıç 709). Davranış testleri değişmez; yalnız görsel/finder assert'leri güncelle, raporda dosya:satır.
3. /tmp/mui-d2b çekimlerini view_image ile B mockup'larıyla kıyasla (login açık/koyu/hata, startup hata, password-help, profile açık/koyu, tema sheet). Login %130 yazıda taşma yok.

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Başka oturumların `convex/**`, `src/**` değişikliklerine DOKUNMA.

## Rapor (worker_done, ≤10 satır) + `mobile/test/ui_redesign/d2b/REPORT.md`
Değişen dosyalar · kapı 1-2 sonucu · değişen mevcut assert'ler · mockup'tan sapmalar · `ask` ile istenen kit/l10n değişiklikleri.
