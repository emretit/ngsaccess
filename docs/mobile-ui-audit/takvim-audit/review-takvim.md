# Takvim audit denetimi (Claude, salt okuma)

Kapılar: `flutter analyze` → 0 sorun · hedefli testler (takvim + history_* + d3a) 64/64 geçti · `TZ=America/New_York` ve `TZ=Asia/Tokyo` takvim testleri 15/15 geçti. Tam `flutter test` koşulmadı (worker raporunda).
Sonuç: T1-T8 büyük ölçüde spec'e uygun; ENGEL yok. Saat dönüşümü tek sefer (`AppDateFormat.clock`), key'ler/semantics/gelecek gün kilidi korunmuş.

## ENGEL
Yok.

## DÜZELT

**RVT-01 — Yüklenirken gün kartı "özet alınamadı" diyor** (B: history_screen.dart)
`history_screen.dart:~458-462` — `onDaySelected` → `_showDay(day, error == null ? summary : null)`. Özet henüz yüklenmemişken (`summary == null && isLoading`) veya ay değiştirilip hemen güne dokunulunca sheet `historyDayUnavailable` ("alınamadı") gösterir; oysa yükleniyor. Öneri: `HistoryDaySheet`'e `isLoading` ver (ya da summary null+loading iken `AppSkeleton`/`historyLoading` göster); "alınamadı" yalnız hata durumunda.

**RVT-02 — Sheet açıkken veri gelirse güncellenmiyor** (B: history_screen.dart:340-352)
`_showDay` özeti dokunma anında yakalıyor (parametre); sheet içeriği statik. Yükleme bitince/yenilemede sheet eski ("alınamadı" veya boş) kalır. Öneri: sheet builder'ında `Consumer<AttendanceProvider>` ile `summaryFor(...)`'ı canlı oku (day → ay aralığı `_calendarRange(day)`), `error` kontrolünü de orada yap.

**RVT-03 — Bayat veri uyarısı kayboldu** (B: history_screen.dart:~418-440, _summaryPanel)
Eski panel hata + eski özet varken `historyStaleData` uyarısı gösteriyordu; yeni hata satırı yalnız `summary == null && error != null`. Özet var ama yenileme hata verirse kullanıcı bayat veriyi fark etmez; bu durumda gün kartı ise `error != null` yüzünden eldeki özeti atıp "alınamadı" diyor (tutarsız). Öneri: summary != null && error != null için başlık altında tek satır `historyStaleData` + Yeniden dene; gün kartında bayat özeti göster (üstte aynı uyarı) ya da en azından üst yüzeyle tutarlı yap.

**RVT-04 — Seçili hücrede ret işareti anlamını kaybediyor** (A: history_calendar.dart:94-99)
`marker(onSelected: true)` her durumda `onAccent` rengi kullanıyor → seçili günde ret (dolu) ile kayıt var (dolu) aynı görünür; yalnız çıkış-yok (halka) ayrışır. DESIGN_B "işaret anlamı" için ret ayrımı kaybolur. Öneri: seçili hücrede ret için farklı biçim (ör. 8dp halkalı/çift kontur) ya da seçili göstergesini zeminle değil kontur+tint ile yap; en azından ret semantiği zaten Semantics'te var — hücrede de görsel ayrım bırak.

**RVT-05 — Renk tek ayırt edici (kayıt vs ret)** (A: history_calendar.dart:94-114)
Kayıt (accent dolu) ve ret (danger dolu) yalnız renkle ayrışıyor (aynı biçim, 6dp). Renk körlüğü / WCAG 1.4.1. Öneri: ret için farklı şekil (ör. küçük üçgen/kare ya da 7dp + kontur) ya da ret'te iki nokta.

## NOT

**RVT-06 — Yatay swipe kapsamı ve çakışma** (B: history_screen.dart:~447-454)
`GestureDetector(onHorizontalDragEnd)` yalnız takvim bloğunu sarıyor; dikey ListView/pull-to-refresh çakışmıyor (yatay dalga yarışı kazanır ama dikey-baskın hareketlerde tetiklenmez). Sorun yok; ama test yalnız `fling` ile doğruluyor, dikey kaydırma/pull-to-refresh regresyon testi yok. Ek test öneri: takvim üstünde dikey drag → ay değişmez, refresh çalışır.

**RVT-07 — Seçili gün ay değişince taşınmıyor** (B: history_screen.dart:327-333)
`_calendarSelection` ay değişince korunur (başka ayda görünmez, geri dönünce yine seçili). Kasıtlı olabilir; `_backToToday` de seçimi temizlemiyor. Sorun değil, davranışı testle sabitle ya da karar ver.

**RVT-08 — Testlerde eksik kritik durumlar** (A/B test dosyaları)
Eksik: (a) sheet açıkken veri gelişi (RVT-02), (b) yüklenirken gün dokunuşu (RVT-01), (c) bayat veri + hata (RVT-03), (d) dikey drag regresyonu, (e) bugün hücresinin accent metin kontrastı yalnız fontWeight ile test ediliyor (renk/kontrast yok), (f) seçili+ret işaret ayrımı. `calendar_test.dart:72` dayCounts-geri uyumluluk testi var, iyi. Süreler `pumpAndSettle`; sabit piksel yok (kırılgan değil). `takvim/day_sheet_test.dart` ilk testi `provider.filters.length == 1` ile "dokunuş filtre uygulamaz" sinyalini dolaylı doğruluyor (başlangıç filtresi 1 varsayımı — kırılgan olabilir).

**RVT-09 — Ölü kod (koordinatöre)**
- `historyCalendarLegend`, `historySelectDayHint`: `lib/` ve `test/` içinde kullanım yok (yalnız üretilmiş l10n dosyaları) → ARB'den silinebilir (expected_keys.json ile birlikte).
- `historyStaleData`: RVT-03 düzeltilirse tekrar kullanılır; düzeltilmezse o da ölü olur.
- `HistoryCalendar.dayCounts`: ekran `days` ile birlikte hâlâ geçiriyor (`history_screen.dart:~461`) ve `history_screen_test.dart:86` + 3 test onu okuyor. `days` her zaman doluyken `dayCounts` gereksiz; kaldırmak için ekran + 3 test dosyası (fix1_regression, history_widgets, history_screen) birlikte güncellenmeli (A+B koordinasyonu). Şimdilik ürün davranışını etkilemiyor.

**RVT-10 — "Bugün" düğmesi yerleşimi** (B: history_screen.dart:~443)
`TextButton` ListView çocuğu olarak tam genişlikte, sola yaslı değil (varsayılan stretch → ortalanmış metin). 320dp/%200'de taşma yok (test ediliyor). İstenirse `Align(centerLeft/Right)` ile ay başlığına yakınlaştır; görsel tercih.

## Spec uyumu özeti
- A: durum önceliği (ret > çıkış yok > kayıt), bugün için çıkış-yok yok, satır sayısı formülü, lejand yalnız ızgarada, liste sırası/filtresi, bugün (kontur yok, w700 accent) / seçili (accent zemin + onAccent) — uygun.
- B: gün kartı veri kaynağı `summary.days`, sekme değişmez, "Kayıtları gör" → filtre + sekme 0, swipe eşiği ±300 ve bu ayda ileri yok, `NeverScrollableScrollPhysics`, başlık altı LinearProgress (2dp) + hata satırı, panelde çift gösterge yok, sıfır rozet gizli, info IconButton, Bugün düğmesi — uygun; sapmalar RVT-01..03.
