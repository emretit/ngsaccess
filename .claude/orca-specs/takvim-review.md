# Denetim — Takvim audit dalgası (Claude, salt okuma)

Sen denetçisin: kod YAZMA, dosya DÜZENLEME, git add/commit/stash/checkout/reset YASAK. Yalnız oku ve komut koş.

## Neyi denetliyorsun
Codex worker'ları `docs/mobile-ui-audit/takvim-audit/AUDIT_TAKVIM.md` T1-T8'i uyguladı. Specler:
`.claude/orca-specs/takvim-common.md`, `takvim-a-calendar.md`, `takvim-b-screen.md` (önce üçünü oku).
Değişiklik: `cd /Users/emreaydin/ngsaccess && git diff refs/takvim/baseline -- mobile/lib mobile/test` + yeni dosyalar
`mobile/lib/widgets/history/history_day_sheet.dart`, `mobile/test/ui_redesign/takvim/*.dart`.
(Baseline öncesi değişiklikler — Özet sekmesinin kaldırılması, ana sayfa proje adı — kapsam dışı.)

## Kontrol listesi
1. Spec uyumu: her T maddesi gerçekten yapıldı mı, sapma var mı (A: durum önceliği ret>çıkış yok>kayıt var, bugün için çıkış-yok yok, satır sayısı, lejand yalnız ızgarada, liste sırası/filtresi, bugün/seçili görünümü; B: gün kartı veri kaynağı summary.days, sekme değişmemesi, "Kayıtları gör" akışı, swipe, yükleme/hata başlık altında ve panelde çift değil, özet sadeleştirme, Bugün düğmesi).
2. Değişmezler: Türkiye saati (instant → businessTime tek kez; AppDateFormat.clock kullanımı; çift +3 yok), `history-day-<date>` key'leri, semantics (bilinmeyen sayı okunmaz), gelecek gün seçilemez, 320dp/%200'de taşma yok, sessionEpoch/route davranışı bozulmadı.
3. Doğruluk hataları: null/boş özet, ay değişirken eski ayın verisi gün kartında görünmesi, sheet açıkken veri gelmesi, swipe ile pull-to-refresh/dikey kaydırma çakışması, bu aydayken ileri swipe, seçili günün ay değişince taşınması, dispose/mounted.
4. UX/görsel: seçili hücre kontrastı (açık+koyu), işaret renklerinin anlamı, gün kartında tek dolu düğme kuralı (DESIGN_B), metinlerin Türkçe doğallığı.
5. Testler: yeni testler davranışı gerçekten doğruluyor mu, kırılgan mı (pump süreleri, sabit piksel), eksik kritik durum var mı.
6. Ölü kod: kullanılmayan l10n getter'ları (`historyCalendarLegend`, `historySelectDayHint`, `dayCounts` hâlâ gerekli mi) — koordinatöre not.

## Kapılar (kendin koş)
- `cd mobile && flutter analyze`
- `flutter test test/ui_redesign/takvim test/widgets/history_screen_test.dart test/widgets/history_widgets_test.dart test/widgets/history_period_lifecycle_test.dart test/ui_redesign/d3a`
- `TZ=America/New_York flutter test test/ui_redesign/takvim` ve `TZ=Asia/Tokyo` aynısı

## Rapor
`docs/mobile-ui-audit/takvim-audit/review-takvim.md` dosyasına yazmak İSTİSNA olarak serbest (tek yazabileceğin dosya). Biçim: ENGEL / DÜZELT / NOT, her bulgu: kimlik (RVT-01..), file:line, sorun, somut düzeltme önerisi, hangi worker'ın dosyası (A: history_calendar.dart + test'leri; B: history_screen.dart, history_day_sheet.dart + test'leri).
`worker_done`'da ≤10 satır: sayılar (ENGEL/DÜZELT/NOT), kapı sonuçları, en kritik 3 bulgu.
