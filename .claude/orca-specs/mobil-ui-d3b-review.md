# Mobil UI — D3b denetimi (Claude, salt okuma)

## Hedef
Codex'in yazdığı D3b (Ziyaretçiler listesi, ziyaretçi formu davet/düzenle, ayrıntı sheet, iptal onayı) ekranlarını bağımsız denetle;
bulguları `docs/mobile-ui-audit/review-d3b.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kaynak
- Sözleşme: `docs/mobile-ui-audit/DESIGN_B.md` §4 (kit API), §5.16–5.18, §6, §7 (invariants: "Oturum sınırı", "Ziyaretçi tarih açığı", "Ziyaretçi create recovery", "Branch lifecycle"; semantics §7.2; key envanteri §7.3) ve sondaki "Ek — koordinatör kararları" (§5.16 metrik etiketi kararı dahil).
- Spec: `.claude/orca-specs/mobil-ui-d3b-visitor.md`. Codex raporu: `mobile/test/ui_redesign/d3b/REPORT.md` — raporu değil KODU ve diff'i denetle.
- Önceki denetim kalıbı: `docs/mobile-ui-audit/review-d3a.md` (format aynı; ID RV3B-NN).
- Diff: `cd /Users/emreaydin/ngsaccess && git diff -- <dosya>` + untracked `git status --short -- mobile`.
- D3b kapsamı (yalnız bunlar): `mobile/lib/screens/visitor/{visitor_screen,visitor_form_screen}.dart`, `mobile/lib/widgets/visitor/{visitor_cards,visitor_detail,visitor_labels}.dart` (+ widgets/visitor altında yeni dosya varsa);
  testler `mobile/test/{visitor_widgets,visitor_form_time,visitor_recovery_widgets,visitor_lifecycle,visitor_create_recovery}_test.dart`, `mobile/test/ui_redesign/d3b/**`.
  Kit'teki yeni `AppTextField.showCounter` ve `AppListRow.supporting` yalnız KULLANIM açısından (kit kodunu ayrıca Codex denetleyecek).
- AYNI ANDA D3a fix1 worker'ı history/requests dosyalarında çalışıyor — onları DENETLEME.
- Görseller: `/tmp/mui-d3b/*.png` (worker çekimleri) vs B mockup `docs/mobile-ui-audit/directions/_shots/B-{visitors-filled,visitors-empty,visitors-error,visitor-form-filled,visitor-form-keyboard,visitor-detail,visitor-cancel}.png` (+ -dark). Read ile aç, yan yana kıyasla.

## Denetim soruları
1. Türkiye saati (en önemli): `toLocal()` cihaz saatine bağlı kullanım kaldı mı (grep: lib/screens/visitor, lib/widgets/visitor); Turkey parts ↔ instant dönüşümü TEK yerde mi; wire instant sözleşmesi (provider'a giden DateTime) değişmedi mi;
   gün/ay geçişinde (23:30 TR, 31 Ara) ve cihaz TZ UTC / America/New_York / Asia/Tokyo'da doğru mu; `now` fixture parametresi korunmuş mu. `turkey_time_test.dart` gerçekten ayrı süreçte TZ değiştiriyor mu yoksa yalnız adı mı öyle?
2. Create recovery + oturum: pending draft, requestId, notice version/review, reconcile receipt; uncertain create'te taslak + requestId kilitli, yeni kayıt yok, "aynı isteği tekrar dene"; sessionEpoch (logout/hesap değişimi eski sonucu göstermez);
   visitor foreground/visible branch lifecycle; cancel'da aktif erişim → operatör kuralı; başarı metni yalnız listeye dönüşten sonra ve "kayıt = aktif erişim" iddiası yok. Diff'te mantık değişen satırı bul, gerekçesini sorgula.
3. Liste: `visitor-add` aynı anda tek etkin hedef; filtresiz/filtreli boş ayrımı; cache var/yok hata metinleri; summary lower bound (overflow '+') kullanıcı dilinde; summary ve liste bağımsız skeleton; erişim ≠ fiziksel bulunma ayrı.
4. Test kalitesi: REPORT'taki değişen assert tablosunu diff'le doğrula — davranış assert'i zayıflatılmış/silinmiş mi? Yeni testler anlamlı mı (yalnız render değil)?
5. Erişilebilirlik: 48dp, %200 + 320dp taşma, Semantics (badge+presence tek okunuş, liveRegion summary), form footer klavye üstünde, ilk hata focus, iptal diyaloğunda destructive buton.
6. Sözleşme/ölü kod: tek dolu primary; teknik "senkronizasyon" başlığı → "Cihaz durumu"; kit'i kopyalayan yerel stil; kullanılmayan visitor* ARB anahtarı.

## Kapılar (yalnız hedefli — D3a fix1 ağaçta çalışıyor, tam suite KOŞMA)
- `cd mobile && flutter analyze --no-pub lib/screens/visitor lib/widgets/visitor test/ui_redesign/d3b test/visitor_widgets_test.dart test/visitor_form_time_test.dart test/visitor_recovery_widgets_test.dart test/visitor_lifecycle_test.dart test/visitor_create_recovery_test.dart`
- `cd mobile && flutter test --no-pub test/ui_redesign/d3b test/visitor_widgets_test.dart test/visitor_form_time_test.dart test/visitor_recovery_widgets_test.dart test/visitor_lifecycle_test.dart test/visitor_create_recovery_test.dart test/visitor_provider_test.dart`
- TZ kanıtı: `cd mobile && TZ=America/New_York flutter test --no-pub test/ui_redesign/d3b/turkey_time_test.dart` ve `TZ=Asia/Tokyo` ile aynısı.

## Çıktı: `docs/mobile-ui-audit/review-d3b.md`
En üstte 3 satırlık özet + kapı sonuçları. Bulgu tablosu: ID (RV3B-NN) · seviye ENGEL (D4'ten önce mutlaka düzeltilmeli; davranış/veri/erişilebilirlik kırığı) /
DÜZELT (bu tur düzeltilmeli) / NOT · sahip (D3b / DS-kit / l10n) · dosya:satır · sorun · somut düzeltme önerisi.

## YASAK
- Kod/test/ARB DEĞİŞTİRME (salt okuma; tek yazacağın dosya review-d3b.md). `git add`, `git commit`, `git stash`, `git reset`, `git restore`, `git checkout` ÇALIŞTIRMA.

## Rapor (worker_done, ≤10 satır)
ENGEL/DÜZELT/NOT sayıları (sahip başına) · en önemli 3 bulgu (dosya:satır) · kapı sonuçları.
