# Mobil UI — D3a denetimi (Claude, salt okuma)

## Hedef
Codex'in yazdığı D3a (Geçmiş: Kayıtlar / Takvim / Özet + filtre sheet + gün/kayıt ayrıntısı; Talepler: liste + izin formu + kayıt düzeltme formu + geri çekme onayı)
ekranlarını bağımsız denetle; bulguları `docs/mobile-ui-audit/review-d3a.md` dosyasına yaz. Kod DEĞİŞTİRME.

## Kaynak
- Sözleşme: `docs/mobile-ui-audit/DESIGN_B.md` §4 (kit API), §5.8–5.15, §6, §7 (davranış invariants: Geçmiş + Talepler satırları; semantics §7.2; key envanteri §7.3), §8.4 (request key'leri) ve sondaki "Ek — koordinatör kararları".
- Spec: `.claude/orca-specs/mobil-ui-d3a-history-requests.md`. Codex raporu: `mobile/test/ui_redesign/d3a/REPORT.md` — raporu değil KODU ve diff'i denetle.
- Önceki denetim kalıbı: `docs/mobile-ui-audit/review-d2.md` (format aynı; ID RV3A-NN).
- Koordinatör kararları (bulgu sayma, doğrula): (a) `historyActiveDays` = "Giriş günü"/"Entry days" çünkü `totals.presentDays` yalnız entryCount>0 günleri sayar (convex/lib/mobileAttendance.ts:164); (b) gün seviyesinde lazy + gün-içi eager AppListGroup kabul edildi.
- Diff: `cd /Users/emreaydin/ngsaccess && git diff -- <dosya>` + untracked `git status --short -- mobile`.
- D3a kapsamı (yalnız bunlar): `mobile/lib/screens/history/history_screen.dart`, `mobile/lib/widgets/history/{history_calendar,history_filter_sheet,history_record_tile,history_records_list}.dart` (+ widgets/history altında yeni dosya varsa),
  `mobile/lib/screens/requests/requests_screen.dart`; testler `mobile/test/widgets/{history_widgets,history_screen,history_period_lifecycle,requests_screen}_test.dart`, `mobile/test/ui_redesign/d3a/**`.
- AYNI ANDA D3b (visitor) worker'ı ağaçta çalışıyor — onun dosyalarını DENETLEME.
- Görseller: `/tmp/mui-d3a/*.png` (worker çekimleri) vs B mockup `docs/mobile-ui-audit/directions/_shots/B-{history,history-empty,history-calendar,history-summary,history-filter,history-detail,requests-leave,requests-correction,requests-empty,leave-filled,leave-error,correction-filled,request-withdraw}.png` (+ -dark). Read ile aç, yan yana kıyasla.

## Denetim soruları
1. Davranış invariants (§7.1) — en önemli: gün/filtre/ay/hafta epoch'ları, cursor pagination (`history-load-more`), erişim reddi ≠ çıkış, bilinmeyen yön ≠ çıkış, Türkiye günü gruplaması ve sırası,
   filtre taslağının uygulamadan provider'a yazılmaması (kapatma = iptal), RequestValidation limitleri (not 500, gerekçe 5–300, düzeltme bugün/son 30 gün), server pending/yetki kontrolü,
   uncertain → listeye dönüş + başarı snackbar'ı YOK, busy PopScope, geri çekmede duplicate tap kapalı ve uncertain'da "geri çekildi" denmemesi, yanlış route context'ine snackbar yazılmaması.
   Diff'te mantık değişen satırı bul ve gerekçesini sorgula. Kayıt ayrıntısında token/ham QR içeriği gösteriliyor mu?
2. Takvim: 320dp ya da %200'de dikey gün listesi varyantı; `history-day-<YYYY-MM-DD>` key'leri tek hedefte, gün seçme callback'i aynı, spoken full date + count semantics (§7.2; EN "October 12, 2026 … 3 records" testi) korunmuş mu; geçici `rowHeight` fix'i kalktı mı.
3. Test kalitesi: REPORT'taki "değişen mevcut assert" tablosunu diff'le doğrula — yalnız finder/literal mi, davranış assert'i zayıflatılmış/silinmiş mi? Yeni testler anlamlı mı?
4. Sözleşme uyumu: gün başına tek nötr grup (kayıt başına kart yok); ekranda tek dolu primary; ISO tarih yok (AppDateFormat); resmi PDKS/mesai iddiası yok; veri uydurma yok ("veri olmadığı için gizlenen kapı toplamları" kararını değerlendir).
5. Erişilebilirlik: 48dp hedef, %200 + 320dp taşma, Semantics (header, selected, segment), ilk hata focus, form footer klavye üstünde.
6. Ölü kod / tekrar: ekranda kit'i kopyalayan yerel stil, kullanılmayan eski widget/ARB.

## Kapılar (yalnız hedefli — D3b ağaçta çalışıyor, tam suite KOŞMA)
- `cd mobile && flutter analyze --no-pub lib/screens/history lib/screens/requests lib/widgets/history test/ui_redesign/d3a test/widgets/history_widgets_test.dart test/widgets/history_screen_test.dart test/widgets/history_period_lifecycle_test.dart test/widgets/requests_screen_test.dart`
- `cd mobile && flutter test --no-pub test/ui_redesign/d3a test/widgets/history_widgets_test.dart test/widgets/history_screen_test.dart test/widgets/history_period_lifecycle_test.dart test/widgets/requests_screen_test.dart`

## Çıktı: `docs/mobile-ui-audit/review-d3a.md`
En üstte 3 satırlık özet + kapı sonuçları. Bulgu tablosu: ID (RV3A-NN) · seviye ENGEL (D4'ten önce mutlaka düzeltilmeli; davranış/veri/erişilebilirlik kırığı) /
DÜZELT (bu tur düzeltilmeli) / NOT · sahip (D3a / DS-kit / l10n) · dosya:satır · sorun · somut düzeltme önerisi.

## YASAK
- Kod/test/ARB DEĞİŞTİRME (salt okuma; tek yazacağın dosya review-d3a.md). `git add`, `git commit`, `git stash`, `git reset`, `git restore`, `git checkout` ÇALIŞTIRMA.

## Rapor (worker_done, ≤10 satır)
ENGEL/DÜZELT/NOT sayıları (sahip başına) · en önemli 3 bulgu (dosya:satır) · kapı sonuçları.
