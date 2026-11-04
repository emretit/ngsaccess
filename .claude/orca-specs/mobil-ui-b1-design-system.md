# Mobil UI — B1: Yön B (Marka bandı) tasarım sistemi + uygulama sözleşmesi

## Karar
Emre 2026-11-04: **Yön B — Marka bandı** seçildi (`docs/mobile-ui-audit/directions/B/*`, NOTES.md B sütunu).
Bu iş B'yi Flutter'a doğrudan uygulanabilir tek otoriter belgeye çevirir. Kod (mobile/**) DEĞİŞMEZ.

## Hedef (test edilebilir)
`docs/mobile-ui-audit/DESIGN_B.md` tek başına okunarak (başka belgeye bakmadan) bir Flutter geliştiricisinin
D1 dalgasını (token + tema + bileşen kiti + alt gezinme/kabuk) uygulayabileceği kadar kesin: her token hex/sp/dp
değeriyle, her bileşen Dart constructor imzasıyla, her ekran yukarıdan aşağı bölüm listesiyle.

## Tasarım ilkeleri (B'ye özgü, belgeye yaz)
- Tek akılda kalan öğe: Ana Sayfa'daki bordo bant + üstüne binen beyaz "Bugün" kartı. Gerisi sakin, nötr, disiplinli.
- Bordo bant YALNIZ: Ana Sayfa, Giriş, Açılış. Diğer ekran başlıkları nötr (canvas zemin, koyu metin).
- Dolu bordo buton ekranda en fazla 1 (birincil eylem). Seçim/odak bordo metin/ikon + nötr zemin; pembe zemin YOK.
- Gölge yalnız: banda binen durum kartı ve QR paneli (`0 3px 9px #25252308`); bottom sheet/diyalog Material varsayılanı. Diğer her şey 0 + 1px çizgi.
- Metin: cümle düzeni, ünlem yok ("Hoş geldiniz!" → "Giriş yap"), emoji yok, butona "→" eklenmez, BÜYÜK HARF etiket yok,
  geliştirici dili yok (sunucu, UTC, senkronizasyon, "yüklenen kayıtlardan"). Eylem adı akış boyunca aynı
  ("İzin talebi gönder" → snackbar "İzin talebi gönderildi").
- Tarih/saat: tek biçimleyici; "Bugün 13:20", "Dün 18:07", "4 Kas Çar", "9–11 Kas", "4 Kasım Çarşamba" (başlık). Hep Türkiye saati;
  arayüzde "UTC+3/Türkiye saati" yazısı yalnız gerçekten gerekli tek yerde (düzeltme formu saat alanı yardım metni).
- Durum bar'ı: bantlı ekranlarda açık ikonlar (`SystemUiOverlayStyle.light`), diğerlerinde koyu.

## DESIGN_B.md içeriği
1. **Token tablosu** (açık + koyu; hex + kontrast oranı): canvas, surface, subtle, line, control, text, muted,
   primary/onPrimary, accent (koyu temada bordo metin yerine), selected-bg, brand band (bg, onBand, onBandMuted,
   avatarBg), success/warning/danger/info fg+bg, focus. Koyu bant rengi + kontrastı.
   Flutter eşlemesi: hangisi `ColorScheme` rolü (`primary`, `surface`, `surfaceContainerLow`, `outline`, `outlineVariant`, `error`…),
   hangisi `ThemeExtension<AppUiTokens>` alanı. `ColorScheme.fromSeed` KULLANILMAZ — şema elle kurulur; tüm M3 rolleri
   (surfaceContainer*, inverse*, tertiary…) açıkça doldurulur ki Material varsayılanı pembe ton sızdırmasın.
2. **Tipografi**: sistem fontu (fontFamily verilmez); `TextTheme` her stil için sp / satır yüksekliği / ağırlık;
   sayısal saat stili `FontFeature.tabularFigures()`. 3–4 boyut kuralı.
3. **Ölçüler**: spacing (mevcut `AppSpacing` 4/8/12/16/24/32 korunur, eksikse ekle), sayfa kenarı 20, radius
   (rozet 4, input/buton 12, grup/kart 16, QR paneli 16, sheet üst 20), min dokunma 48, buton yüksekliği 52, liste satırı min 64,
   alt gezinme yüksekliği, banttaki içerik ölçüleri ve kartın banda binme miktarı.
4. **Bileşen kiti** (`mobile/lib/widgets/ui/` altında, her biri ayrı dosya): her biri için amaç, Dart imzası
   (named param'lar, tipler, varsayılanlar), durumlar (normal/pressed/disabled/busy/focus), Semantics sözleşmesi,
   metin ölçeği 1.3/2.0 davranışı, açık/koyu görünüm ve yerini aldığı mevcut widget(lar) (dosya:satır).
   Zorunlu liste: `AppUiTokens` (ThemeExtension, lerp/copyWith), `AppBrandBand`, `AppPageHeader`, `AppStatusBadge(tone)`,
   `AppListGroup` + `AppListRow`, `AppEmptyState`, `AppDataNotice`, `AppSkeleton`, `AppPrimaryButton` + `AppSecondaryButton`,
   `AppFormActionBar` (yapışkan, klavye + safe area), `showAppSheet` + `AppSheet`, `AppSegmentControl`,
   `AppTextField` / `AppDateField` / `AppDateRangeField` / `AppTimeField` / `AppSelectField`, `AppBottomNavigation`
   (M3 `NavigationBar`, 5 eşit hedef, kısa "QR" etiketi, gövde nav yüksekliğini ayırır), `AppMetricRow`, `AppDialog`,
   `AppDateFormat` (lib/core, TR/EN; mevcut `core/attendance_date.dart` ile ilişkisi).
5. **Ekran düzenleri** (her ekran yukarıdan aşağı, kullanılan bileşen adlarıyla; dolu/boş/yükleniyor/hata durumu ayrı):
   Açılış, Giriş, Şifre yardımı, Ana Sayfa, QR (QR Kodum + Tara; "QR kod tara" doğrudan Tara açar), Kapı seçimi,
   Kapı kurtarma diyaloğu, Geçmiş (Kayıtlar/Takvim/Özet + filtre sheet + gün/kayıt ayrıntısı), Talepler (liste + izin formu +
   düzeltme formu + geri çekme onayı), Ziyaretçiler (liste + form + ayrıntı sheet + iptal onayı), Profil (+ tema/dil seçici).
6. **Metin değişiklikleri**: tablo — l10n anahtarı · mevcut TR · yeni TR · yeni EN (yalnız değişenler; Günün Sözü anahtarları
   silinecekler listesi).
7. **Değişmeyecek davranışlar** (D dalgalarında korunacak): kapı komutu kurtarma/idempotency, oturum sınırı (sessionEpoch),
   yerel hata metinleri (sunucu metni gösterilmez), Türkiye saati, rota koruması, mevcut Semantics etiketleri, test anahtarları
   (`Key(...)`) — mevcut testlerin kullandığı key'leri `grep -rn "Key('" mobile/test` ile listele ve korunacaklarını yaz.
8. **Dalga planı + dosya sahipliği** (00_OZET.md planını B'ye göre kesinleştir): D1 / D2a / D2b / D3a / D3b / D4; her dalga için
   dosya listesi (iki worker aynı dosyaya yazmaz), kapı komutları, screenshot harness'te güncellenecek dosyalar
   (`mobile/screenshot_test/**` ekran değişince bozulacak finder'lar).

## Ownership (yalnız bunlara yaz)
- `docs/mobile-ui-audit/DESIGN_B.md` (yeni). İstersen `docs/mobile-ui-audit/directions/B/*.html` küçük düzeltme.

## Kapsam dışı
- `mobile/**` kod değişikliği yok. Diğer ekranların mockup'ları bu işte yok (sonraki iş B2).

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Çalışma ağacında başka oturumların `convex/**`, `src/**` değişiklikleri ve untracked `mobile/screenshot_test/` var; DOKUNMA.

## Rapor (worker_done, ≤10 satır)
DESIGN_B.md bölüm listesi · bileşen sayısı · değişen l10n anahtar sayısı · korunacak test key sayısı · D1 dosya listesi · açık sorular (varsa, en fazla 3).
