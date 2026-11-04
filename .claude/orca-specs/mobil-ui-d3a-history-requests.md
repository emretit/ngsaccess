# Mobil UI — D3a: Geçmiş + Talepler ekranları (Yön B)

## Hedef (test edilebilir)
Geçmiş (Kayıtlar / Takvim / Özet + filtre sheet + gün/kayıt ayrıntısı) ve Talepler (liste + izin formu + kayıt düzeltme formu + geri çekme onayı)
DESIGN_B.md §5.8–§5.15 ve B mockup'larıyla aynı görünür; tüm davranışlar korunur. Kapılar: analyze 0, tam test yeşil.

## Kaynak
- `docs/mobile-ui-audit/DESIGN_B.md` §4 (kit API — `mobile/lib/widgets/ui/**` HAZIR, `ui.dart` barrel), §5.8–§5.15, §6 (metinler — l10n'da HAZIR), §7 (invariants, semantics, key envanteri),
  §8.4 (screenshot harness'in beklediği yeni key'ler) ve sondaki "Ek — koordinatör kararları".
- Mockup hedefleri: `docs/mobile-ui-audit/directions/B/` HTML + `directions/_shots/B-{history,history-empty,history-calendar,history-summary,history-filter,history-detail,
  requests-leave,requests-leave-dark,requests-correction,requests-correction-dark,requests-empty,requests-empty-dark,leave-filled,leave-filled-dark,leave-error,leave-error-dark,
  correction-filled,request-withdraw}.png`. GAPS.md "Çelişki olmayan kararlar" (filtre taslağı vs aktif filtre, takvim altı hafta).
- Kit kullanım örnekleri: `mobile/test/ui_redesign/d1/**`; uygulanmış ekran örneği: D2a/D2b (`lib/screens/home`, `lib/screens/profile`) ve raporları `mobile/test/ui_redesign/d2a|d2b/REPORT.md`.
- l10n: §6 + Ek'teki anahtarlar ARB'de hazır (`historyRecordDetailTitle`, `fieldNoOptions`, `metricNoRecord`, `fieldClear` dahil). Eksik metin → `ask`.

## Kapsam
1. Geçmiş Kayıtlar (§5.8): AppPageHeader "Geçmiş" + AppSegmentControl Kayıtlar/Takvim/Özet; tarih/kapı kapsamı + Filtrele (48dp, tooltip korunur);
   **gün başına tek** nötr AppListGroup, lazy AppListRow (tabular saat, yön ikonu, kapı adı, ret metni+ikon) — her kayıt ayrı kart DEĞİL;
   `history-load-more`, pull-to-refresh, `PageStorageKey('history-records-scroll')`, `ValueKey(record.id)` korunur. Boş/yükleniyor/hata §5.8'deki gibi (önceki sayfalar korunur).
2. Takvim (§5.9): ay seçimi 48dp; today kontur, selected nötr dolgu+accent, kayıt noktası; seçili gün AppListGroup. **`history_calendar.dart:95` geçici fix'i
   (`rowHeight: (scale > 1.3 ? 52.0 : 48.0) * ...`, D1'den kalma) senin sorumluluğunda**: §5.9'daki kalıcı çözümü uygula — genişlik < 7×48 (320dp) ya da 2.0 ölçekte
   sığmıyorsa aynı ayın günleri dikey AppListRow listesi; `history-day-<YYYY-MM-DD>` key'leri, gün seçme callback'i ve spoken full date + count semantics (§7.2) değişmez.
3. Özet (§5.10): Bu ay / Bu hafta seçimi, AppMetricRow, kapı bazında nötr liste, "Kayıtlar hakkında" secondary sheet; resmi PDKS/mesai iddiası yok; period epoch koruması aynen.
4. Filtre sheet + gün/kayıt ayrıntısı (§5.11): showAppSheet → AppSheet; AppDateField + lazy kapı seçenekleri (yalnız mevcut facet kapsamı) + AppFormActionBar
   ("Filtreleri uygula" `history-apply-filters` key'i korunur / "Filtreleri temizle"); taslak provider'a uygulanmadan yazılmaz, kapatma = iptal.
   Kayıt ayrıntısı nötr başlık `historyRecordDetailTitle`; token/ham QR içeriği gösterilmez; yerel kayıt açılırken sahte spinner yok.
5. Talepler liste (§5.12): AppPageHeader "Taleplerim" + AppSegmentControl İzin / Kayıt düzeltme; tek AppPrimaryButton "Yeni talep"; satırda tür, AppDateFormat.dateRange (ISO yok),
   AppStatusBadge, gerekçe/karar notu; uygunsa secondary "Talebi geri çek". Boş durumda ikinci dolu CTA yok.
6. İzin formu (§5.13) + Kayıt düzeltme formu (§5.14): AppSelectField / AppDateRangeField / AppDateField / AppTimeField / AppTextField + yapışkan AppFormActionBar;
   busy kilit + PopScope, ilk hata focus, uncertain → listeye dönüş+uyarı (başarı snackbar'ı YOK), yanlış route context'ine snackbar yazılmaz.
   §8.4 için stable key'ler ekle: `request-notes`, `request-reason`, `request-check-in-time`, `request-check-out-time`, `request-submit` (gerçek editable/tıklanabilir hedefte, tek yerde).
7. Geri çekme onayı (§5.15): AppDialog, secondary "Vazgeç" + destructive "Talebi geri çek"; duplicate tap kapalı; uncertain'da "geri çekildi" denmez; server pending kontrolü aynen.

## Ownership (yalnız bunlara yaz) — DESIGN_B §8.1 D3a satırı
- `mobile/lib/screens/history/history_screen.dart`, `mobile/lib/widgets/history/{history_calendar,history_filter_sheet,history_record_tile,history_records_list}.dart`,
  `mobile/lib/screens/requests/requests_screen.dart`
- Testler: `mobile/test/widgets/{history_widgets,history_screen,history_period_lifecycle,requests_screen}_test.dart`, yeni `mobile/test/ui_redesign/d3a/**`
- Yeni yardımcı widget gerekiyorsa yalnız `mobile/lib/widgets/history/` altında yeni dosya (ör. `history_day_list.dart`) ya da `requests_screen.dart` içinde private sınıf.

## Kapsam dışı / paralel çalışma
- AYNI ANDA D3b worker'ı `screens/visitor/**`, `widgets/visitor/**` ve `test/visitor_*` üzerinde; bir Claude denetçisi D2 dosyalarını okuyor — DOKUNMA.
- `lib/widgets/ui/**`, `lib/theme/**`, `lib/core/**`, `lib/l10n/**`, `lib/main.dart`, `lib/router/**`, `lib/screens/main_navigation_shell.dart`: YAZMA.
  Kit hatası/eksiği → `ask` (kendi ekranında kit'i kopyalayan geçici bileşen yazma). Yeni metin → `ask` ile anahtar adı + TR/EN öner; koordinatör ekler.
- `mobile/screenshot_test/**`: YAZMA. Görsel kontrol için çalıştırabilirsin:
  `cd mobile && flutter test --no-pub --update-goldens --dart-define=AUDIT_OUTPUT_DIR=/tmp/mui-d3a screenshot_test/` — finder kırılırsa (§8.4) raporla, düzeltme.
- `providers/**`, `repositories/**`, `services/**`, modeller, `core/attendance_date.dart`: DEĞİŞMEZ. Veri yoksa UI'da gösterme, uydurma.

## Korunacak davranış (§7.1 Geçmiş + Talepler satırları)
Gün/filtre/ay/hafta epoch'ları, cursor pagination, erişim reddi ≠ çıkış, bilinmeyen yön ≠ çıkış, Türkiye günü gruplaması, RequestValidation limitleri (not 500, gerekçe 5–300,
düzeltme bugün/son 30 gün), server yetki/pending kontrolü, uncertain listeye dönüş, busy PopScope, HistoryScreen clock ve diğer public constructor fixture parametreleri.
Davranış testleri DEĞİŞMEZ; yalnız görsel/finder değişen assert'leri güncelle ve raporda dosya:satır listele. Busy/auth/retry/focus/tap-count assert'i zayıflatma.

## Kapılar (kendin koş; diğer worker aynı ağaçta — geçici kırmızıyı kendi dosyana ait mi diye ayır)
1. `cd mobile && flutter analyze --no-pub` → No issues found.
2. `cd mobile && flutter test --no-pub` → hepsi yeşil (başlangıç 773).
3. Yeni `test/ui_redesign/d3a/` yerleşim testleri: açık/koyu, 390dp/%100 ve 320dp/%200 — Kayıtlar, Takvim (dikey liste varyantı dahil), Özet, filtre sheet, izin + düzeltme formu; taşma yok, 48dp hedef.
4. /tmp/mui-d3a çekimlerini view_image ile B mockup'larıyla yan yana kıyasla (history, history-calendar, history-summary, history-filter, requests-leave, leave-filled, correction-filled, request-withdraw).

## YASAK
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git restore` ÇALIŞTIRMA. Commit/push/deploy/migration/DB yazma YOK.
- Başka oturumların `convex/**`, `src/**` değişikliklerine DOKUNMA.

## Rapor (worker_done, ≤10 satır) + `mobile/test/ui_redesign/d3a/REPORT.md`
Değişen dosyalar · takvim dar ekran/2.0 çözümü · kapı 1-2 sonucu (test sayısı) · değişen mevcut assert'ler (dosya:satır) · eklenen key'ler · mockup'tan sapmalar ve sebebi · harness'te kırılan finder'lar.
