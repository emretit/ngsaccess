# Takvim audit dalgası — ortak kurallar (her worker okur)

Proje: NGS Plus Flutter uygulaması, `/Users/emreaydin/ngsaccess/mobile`. Audit: `docs/mobile-ui-audit/takvim-audit/AUDIT_TAKVIM.md` (T1-T8).
Tasarım sözleşmesi: `docs/mobile-ui-audit/DESIGN_B.md` §5.9 + sonundaki "Ek — koordinatör kararları". Kit: `lib/widgets/ui/**` (AppSheet, AppMetricRow, AppStatusBadge, AppListRow, AppListGroup, AppDataNotice, AppSecondaryButton, AppPrimaryButton, AppUiTokens). Yeni paket YOK.

## Kesin yasaklar
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, push, deploy, migration, Convex/DB yazma YASAK. Koordinatör `git reflog` ile kontrol eder.
- Worktree açma; ana dizinde çalış.
- Yalnız kendi ownership listendeki dosyalara yaz. Başka dosya gerekiyorsa `ask` ile koordinatöre sor ve dur.
- ARB / `lib/l10n/**` / `test/l10n/**` / `screenshot_test/**` / `lib/widgets/ui/**` / `lib/theme/**` dosyalarına YAZMA (koordinatörün). Yeni metin gerekirse `ask`.
- `any`, `dynamic` dönüşleri, `!` yerine erken return.

## Koordinatörün hazırladığı sözleşme (değiştirme)
- `HistoryCalendar` yeni opsiyonel parametre: `Map<String, AttendanceDaySummary>? days` (anahtar `YYYY-MM-DD`; null = bilinmiyor). Ekran bunu zaten geçiriyor (`history_screen.dart` `_buildMonth`). `dayCounts` geçici olarak duruyor.
- `AttendanceDaySummary` (`lib/models/attendance_summary.dart`): `date, entryCount, exitCount, deniedCount, unknownCount, firstEntry, lastEntry, lastExit (DateTime? UTC anlar), lastDirection`.
- Hazır l10n getter'ları (AppLocalizations): `historyDayFirstEntry` İlk giriş · `historyDayLastExit` Son çıkış · `historyDayViewRecords` Kayıtları gör · `historyDayNoRecords` Bu gün kayıt yok · `historyDayUnavailable` Bu günün özeti alınamadı. · `historyLegendRecords` Kayıt var · `historyLegendDenied` Ret var · `historyLegendMissingExit` Çıkış yok · `historyDayDenied(count)` "{count} reddedilen" · `historyDayMissingExit` çıkış kaydı yok · `historyBackToToday` Bugün · `historyUnknownCount` artık "Yönü belirsiz". Mevcut: `historyDayRecordCount(count)`, `historyEntryShort`, `historyExitShort`, `historyDeniedCount`, `historyNoActivity`, `historyNoActivityHint`, `historySummaryUnavailable`, `homeAttendanceTimeEmpty` ("—"), `commonRetry`, `historyInfoTitle`.

## Davranış değişmez
- Türkiye saati: anlık değer → `AttendanceDate.businessTime` tam BİR kez; saat biçimi için `AppDateFormat(...).clock(instant)` (örnek `lib/widgets/cards/attendance_status_card.dart:57`). Çift +3 yasak.
- `history-day-<YYYY-MM-DD>` key'leri, gün semantics'i (tam tarih + bilinen sayı; bilinmiyorsa sayı okunmaz), 44dp/48dp ızgara eşiği, 320dp ve %200'de liste varyantı.
- Gelecek günler seçilemez.

## Kapılar (kendin koş, çıktısını raporla)
1. `cd mobile && flutter analyze` → 0 sorun
2. Kendi hedefli testlerin + `flutter test test/widgets/history_screen_test.dart test/widgets/history_widgets_test.dart test/widgets/history_period_lifecycle_test.dart test/ui_redesign/d3a`
3. Tam `flutter test` → geçmeli. Diğer worker aynı anda çalışıyor; onun dosyalarından gelen geçici kırmızıyı raporda ayrı belirt, düzeltmeye çalışma.

## Rapor (`worker_done`, ≤10 satır)
Yapılan T maddeleri · değişen dosyalar (file:line) · kapı sonuçları (sayılarla) · açık soru/sapma.
