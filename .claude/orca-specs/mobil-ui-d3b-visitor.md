# Mobil UI — D3b: Ziyaretçi ekranları (Yön B)

## Hedef (test edilebilir)
Ziyaretçiler listesi, ziyaretçi formu (davet / düzenle), ayrıntı sheet'i ve iptal onayı DESIGN_B.md §5.16–§5.18 ve B mockup'larıyla aynı görünür;
form/etiket tarih sunumu cihaz saat diliminden bağımsız **Türkiye saati** olur; tüm davranışlar korunur. Kapılar: analyze 0, tam test yeşil.

## Kaynak
- `docs/mobile-ui-audit/DESIGN_B.md` §4 (kit API — `mobile/lib/widgets/ui/**` HAZIR, `ui.dart` barrel; `AppDateFormat` = `lib/core/app_date_format.dart`), §5.16–§5.18,
  §6 (metinler — l10n'da HAZIR), §7 (invariants — özellikle "Ziyaretçi tarih açığı" ve "Ziyaretçi create recovery" satırları, semantics, key envanteri), sondaki "Ek — koordinatör kararları".
- Mockup hedefleri: `docs/mobile-ui-audit/directions/B/` HTML + `directions/_shots/B-{visitors-filled,visitors-filled-dark,visitors-empty,visitors-empty-dark,visitors-error,
  visitors-error-dark,visitor-form-filled,visitor-form-filled-dark,visitor-form-keyboard,visitor-form-keyboard-dark,visitor-detail,visitor-cancel}.png`.
- Kit kullanım örnekleri: `mobile/test/ui_redesign/d1/**`; uygulanmış ekran örneği: D2a/D2b (`lib/screens/home`, `lib/screens/profile`) ve raporları `mobile/test/ui_redesign/d2a|d2b/REPORT.md`.
- Eksik metin → `ask`.

## Kapsam
1. Liste (§5.16, `screens/visitor/visitor_screen.dart` + `widgets/visitor/visitor_cards.dart`): AppPageHeader "Ziyaretçiler" → tek AppPrimaryButton "Ziyaretçi davet et"
   (key `visitor-add`, aynı anda yalnız bir etkin hedefte) → AppMetricRow summary (erişim ≠ fiziksel bulunma; summary lower bound varsa kullanıcı diliyle) →
   AppTextField arama + AppSelectField durum filtresi → lazy AppListRow/grup (ad, ziyaret aralığı AppDateFormat ile, erişim AppStatusBadge, ayrı presence metni) → sonraki sayfa/retry/filtre temizle.
   Boş: filtresiz "Henüz davet yok" ≠ filtreli "Eşleşen davet yok". Hata: cache yoksa "Davetler alınamadı", varsa "Önceki davetler gösteriliyor". Summary ve liste bağımsız skeleton.
2. Form (§5.17, `screens/visitor/visitor_form_screen.dart`): AppPageHeader "Ziyaretçi davet et"/"Daveti düzenle"; AppListGroup kişi (ad, soyad, telefon) → ziyaret (amaç, notlar);
   başlangıç/bitiş AppDateField + AppTimeField çiftleri; aydınlatma metni + checkbox + kısa aktivasyon açıklaması; AppFormActionBar "Daveti kaydet" (klavye üstünde, ikinci safe inset yok).
   **Türkiye saati:** §7.1 "Ziyaretçi tarih açığı" — `visitor_form_screen.dart:58`, `:159` ve `visitor_labels.dart:22` civarındaki `toLocal()` cihaz saatine bağlı; Turkey parts ↔ instant
   dönüşümünü TEK yerde (form/label adapter) yap, `AppDateFormat`/`core/attendance_date.dart` yardımcılarını kullan (yazmadan). Wire instant sözleşmesi DEĞİŞMEZ.
   Test: cihaz saat dilimi UTC / America/New_York iken girilen 09:00 TR'nin aynı instant'a gittiğini ve etiketin TR saatini gösterdiğini doğrula (`now` fixture parametresi korunur).
3. Ayrıntı sheet + iptal (§5.18, `widgets/visitor/visitor_detail.dart`): AppSheet ad → erişim AppStatusBadge + ayrı fiziksel durum → tarih/saat → kişi/amaç/not → "Cihaz durumu"
   (teknik "senkronizasyon" başlığı değil; applied erişim physical inside'a çevrilmez) → uygun edit/cancel secondary. İptal: AppDialog, vazgeç + destructive; tap kilidi;
   aktif erişimde operatör gerektiren kural korunur.
4. `widgets/visitor/visitor_labels.dart`: durum/badge/presence etiketleri tek yerde; AppStatusBadge tonlarıyla eşle.

## Ownership (yalnız bunlara yaz) — DESIGN_B §8.1 D3b satırı
- `mobile/lib/screens/visitor/visitor_screen.dart`, `mobile/lib/screens/visitor/visitor_form_screen.dart`,
  `mobile/lib/widgets/visitor/{visitor_cards,visitor_detail,visitor_labels}.dart`
- Testler: `mobile/test/{visitor_widgets,visitor_form_time,visitor_recovery_widgets,visitor_lifecycle,visitor_create_recovery}_test.dart`, yeni `mobile/test/ui_redesign/d3b/**`
- Yeni yardımcı gerekiyorsa yalnız `mobile/lib/widgets/visitor/` altında yeni dosya.

## Kapsam dışı / paralel çalışma
- AYNI ANDA D3a worker'ı `screens/history/**`, `widgets/history/**`, `screens/requests/**` ve ilgili testler üzerinde; bir Claude denetçisi D2 dosyalarını okuyor — DOKUNMA.
- `lib/widgets/ui/**`, `lib/theme/**`, `lib/core/**`, `lib/l10n/**`, `lib/main.dart`, `lib/router/**`, `lib/screens/main_navigation_shell.dart`: YAZMA.
  Kit hatası/eksiği → `ask` (kendi ekranında kit'i kopyalayan geçici bileşen yazma). Yeni metin → `ask` ile anahtar adı + TR/EN öner; koordinatör ekler.
- `mobile/screenshot_test/**`: YAZMA. Görsel kontrol için çalıştırabilirsin:
  `cd mobile && flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=/tmp/mui-d3b screenshot_test/` — finder kırılırsa raporla, düzeltme.
- `providers/**` (özellikle `visitor_provider.dart`), `repositories/**`, `services/**`, modeller, `core/attendance_date.dart`: DEĞİŞMEZ. Veri yoksa UI'da gösterme, uydurma.

## Korunacak davranış (§7.1)
Pending draft + requestId + notice version/review + reconcile receipt; uncertain create'te taslak ve requestId kilitli, yeni kayıt oluşturulmaz, "aynı isteği tekrar dene" kalır;
sessionEpoch (logout/hesap değişimi eski ziyaretçi sonucunu göstermez); visitor foreground/visible branch lifecycle; cancel erişim kuralı; `visitor-add` ve `visitor-outer-nav` key'leri;
VisitorFormScreen `now` ve diğer public constructor fixture parametreleri. Başarı "Davet kaydedildi. Yetkili onayı bekleniyor" listeye dönüldükten sonra; kayıt = aktif erişim DEĞİL.
Davranış testleri DEĞİŞMEZ; yalnız görsel/finder değişen assert'leri güncelle ve raporda dosya:satır listele. Busy/auth/retry/focus/tap-count assert'i zayıflatma.

## Kapılar (kendin koş; diğer worker aynı ağaçta — geçici kırmızıyı kendi dosyana ait mi diye ayır)
1. `cd mobile && flutter analyze --no-pub` → No issues found.
2. `cd mobile && flutter test --no-pub` → hepsi yeşil (başlangıç 773).
3. Yeni `test/ui_redesign/d3b/` testleri: açık/koyu, 390dp/%100 ve 320dp/%200 liste + form + ayrıntı sheet (taşma yok, 48dp, footer klavye üstünde) + Türkiye saati (cihaz TZ'den bağımsız) testi.
4. /tmp/mui-d3b çekimlerini view_image ile B mockup'larıyla yan yana kıyasla (visitors-filled, visitors-empty, visitors-error, visitor-form-filled, visitor-form-keyboard, visitor-detail, visitor-cancel).

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Başka oturumların `convex/**`, `src/**` değişikliklerine DOKUNMA.

## Rapor (worker_done, ≤10 satır) + `mobile/test/ui_redesign/d3b/REPORT.md`
Değişen dosyalar · Türkiye saati adapter'ı (dosya:satır) · kapı 1-2 sonucu (test sayısı) · değişen mevcut assert'ler (dosya:satır) · mockup'tan sapmalar ve sebebi · harness'te kırılan finder'lar.
