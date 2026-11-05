# Worker B — Takvim ekranı (T1, T3, T5-ekran, T6, T8)

Önce oku: `.claude/orca-specs/takvim-common.md` (yasaklar, sözleşme, kapılar).

## Hedef (test edilebilir)
Takvim sekmesinde güne dokunmak alttan gün kartını açar (sekme değişmez). Takvim üzerinde yatay kaydırma ay değiştirir. Yükleme/hata ay başlığının hemen altında görünür. Özet paneli sadeleşir. Başka aydayken "Bugün" ile bu aya dönülür.

## Ownership (yalnız bunlar)
- `mobile/lib/screens/history/history_screen.dart`
- yeni: `mobile/lib/widgets/history/history_day_sheet.dart`
- `mobile/test/widgets/history_screen_test.dart`
- `mobile/test/widgets/history_period_lifecycle_test.dart`
- `mobile/test/ui_redesign/d3a/layout_states_test.dart`
- yeni: `mobile/test/ui_redesign/takvim/day_sheet_test.dart`

`history_calendar.dart` Worker A'nın — dokunma (A ızgara modunda kendi lejandını ekliyor).

## İşler
1. **Gün kartı (T1).** `onDaySelected(day)`:
   - `_calendarSelection = day` (seçili görünüm), `showAppSheet` ile `HistoryDaySheet` aç. Sekme DEĞİŞMEZ, filtre UYGULANMAZ.
   - `HistoryDaySheet` (yeni dosya, `AppSheet` tabanlı): başlık = tam tarih (`DateFormat.yMMMMEEEEd(locale)`); `AppMetricRow`: `historyDayFirstEntry` (`firstEntry` saati ya da `homeAttendanceTimeEmpty`), `historyDayLastExit` (`lastExit` saati ya da "—"); altında giriş/çıkış sayısı satırı (`historyEntryShort`/`historyExitShort`); `deniedCount > 0` ise danger `AppStatusBadge` (`historyDeniedCount: n`), `unknownCount > 0` ise info rozet (`historyUnknownCount: n`).
   - Kayıt yoksa (gün `summary.days`'te yok ya da toplam 0): `historyDayNoRecords` + `historyNoActivityHint`.
   - Özet bilinmiyorsa (summary null/hata): `historyDayUnavailable` (sayı gösterme).
   - Altta tek dolu düğme `historyDayViewRecords` → sheet'i kapat, mevcut davranış: `_applyFilter(date: day, deviceId: null)` + `_tabs.animateTo(0)`.
   - Saatler: `AppDateFormat(locale:, now:).clock(instant)` (instant → businessTime çevrimini clock yapar; kendin +3 ekleme). Bkz. `lib/widgets/cards/attendance_status_card.dart:57`.
   - Veri kaynağı: o ayın `provider.summaryFor(...)`.days (sayfalı kayıt listesi DEĞİL — D3a'daki yanlış "kayıt yok" hatası buradan gelmişti).
2. **Kaydırma (T3).** `TabBarView` → `physics: const NeverScrollableScrollPhysics()` (sekme yalnız segmentle değişir). Takvim alanını `GestureDetector(onHorizontalDragEnd:)` ile sar: hız < -300 → sonraki ay (bu aydaysa yok), > 300 → önceki ay. Mevcut `_changeMonth` kullanılır. Dikey kaydırma/pull-to-refresh bozulmamalı.
3. **Yükleme/hata ve yardım metni (T5).**
   - Gösterilen ayın özeti yükleniyorsa ay başlığının hemen altında 2dp `LinearProgressIndicator` (semanticsLabel `historyLoading`). Hata + özet yoksa başlığın altında tek satır `historySummaryUnavailable` + `commonRetry` (AppSecondaryButton ya da TextButton; 320dp/%200'de taşmasın).
   - `_buildMonth`'tan `historyCalendarLegend` ve `historySelectDayHint` metinlerini KALDIR (A lejandı takvimin içine taşıyor). Getter'ları başka yerde kullanma; koordinatör ARB'den silecek.
4. **Özet paneli (T6)** (`_summaryPanel`, artık yalnız takvimde):
   - Tarih aralığı satırını kaldır (ay başlığı zaten söylüyor).
   - Sıfır rozetleri gizle: `deniedCount == 0` ise ret rozeti yok, `unknownCount == 0` ise belirsiz rozeti yok; ikisi de yoksa Wrap hiç çizilmez.
   - "Kayıtlar hakkında" büyük düğmesi → başlık satırında sağda `IconButton(Icons.info_outline_rounded, tooltip: historyInfoTitle)` → mevcut `_showInfo`.
   - Panel içindeki skeleton/LinearProgress/AppDataNotice: üstteki göstergeyle çift olmasın — panelde yalnız özet yokken skeleton kalabilir, ikinci LinearProgress kalksın; hata bildirimi üstte varsa panelde tekrar etmesin.
5. **Bugün'e dön (T8).** Gösterilen ay bu ay değilse ay başlığının altında (ya da yanında, 320dp/%200'de taşmadan) `historyBackToToday` metinli küçük düğme → `_calendarMonth = null` (bu ay), özet yükle.

## Testler
- `takvim/day_sheet_test.dart`: güne dokununca sheet açılır ve sekme değişmez; ilk giriş/son çıkış saatleri Türkiye saatiyle (UTC 06:00 → 09:00; cihaz TZ'den bağımsız); kayıt yok / özet yok durumları; "Kayıtları gör" → Kayıtlar sekmesi + o gün filtresi (provider.filters son eleman); ret/belirsiz rozetleri yalnız >0.
- Kaydırma: sola fling → önceki/sonraki ay `provider.ranges` ile; bu ayda sağa (sonraki) fling hiçbir şey yapmaz; sekme swipe ile değişmez.
- "Bugün" yalnız başka aydayken görünür ve bu aya döner.
- Var olan testleri güncelle: gün dokunuşu artık filtre uygulamıyor (history_screen_test "calendar day opens server day filter..." → sheet + "Kayıtları gör" akışı), d3a layout testindeki takvim adımları, 320dp/%200 reflow testleri (taşma yok).

Kapılar ve rapor: ortak dosyadaki gibi.
