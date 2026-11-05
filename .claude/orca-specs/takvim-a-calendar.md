# Worker A — Takvim bileşeni (T2, T4, T5-satır, T7, lejand)

Önce oku: `.claude/orca-specs/takvim-common.md` (yasaklar, sözleşme, kapılar).

## Hedef (test edilebilir)
`HistoryCalendar` hücrelerde gün durumunu (kayıt / ret / çıkış yok) gösterir, yalnız gereken hafta satırlarını çizer, bugün ile seçili günü ayırır, ızgara modunda kendi lejandını çizer, liste modunda en yeni gün üstte ve yalnız anlamlı günler listelenir.

## Ownership (yalnız bunlar)
- `mobile/lib/widgets/history/history_calendar.dart`
- `mobile/test/widgets/history_widgets_test.dart`
- `mobile/test/ui_redesign/d3a/fix1_regression_test.dart`
- yeni: `mobile/test/ui_redesign/takvim/calendar_test.dart`

`history_screen.dart` Worker B'nin — dokunma.

## İşler
1. **Gün durumu (T2).** `days` doluysa her geçmiş/bugün günü için durum:
   - `deniedCount > 0` → **ret**: dolu nokta, tehlike tonu (kitte AppStatusTone.danger ile aynı renk kaynağını kullan; renk sabiti yazma).
   - değilse `entryCount > 0` ve `lastDirection == entry` ve gün **bugünden önce** → **çıkış yok**: içi boş halka (accent kontur, 1.5dp).
   - değilse toplam (`entry+exit+denied+unknown`) > 0 → **kayıt var**: dolu accent nokta (mevcut görünüm).
   - Bugün için "çıkış yok" uygulanmaz (kişi hâlâ içeride olabilir).
   - `days == null` → işaret yok (mevcut "bilinmiyor" kuralı). `days` null değil ama gün yoksa = 0 kayıt.
   - İşaret boyutu 6dp; mevcut `history-day-marker-<date>` key'i korunur.
   - Semantics label'ı: tam tarih, kayıt sayısı, ret varsa `historyDayDenied(n)`, çıkış yoksa `historyDayMissingExit` (virgülle).
   - Sayılar `days`'ten türetilir; `dayCounts` yalnız `days == null` iken geri uyumluluk için okunur.
2. **Lejand (T2/T4).** Izgara modunda takvimin altında tek satırlık sarılabilir (Wrap) lejand: üç mini işaret + `historyLegendRecords` / `historyLegendDenied` / `historyLegendMissingExit`, `bodySmall`. Liste modunda lejand YOK. (Ekrandaki eski `historyCalendarLegend` metnini Worker B kaldıracak.)
3. **Satır sayısı (T5).** Sabit 6 hafta yerine `((first.weekday - 1) + length + 6) ~/ 7` satır.
4. **Bugün / seçili (T7).** Bugün: kontur YOK; rakam kalın (w700) ve accent renkli. Seçili gün: dolu accent zemin (yuvarlak köşe 8, mevcut) + accent üstünde okunur metin rengi (kitte/temada karşılığını kullan, ör. `colorScheme.onPrimary`; açık+koyu temada kontrast ≥4.5:1 kontrol et). Seçili+bugün = seçili görünümü. Seçili hücrede işaret rengi, dolgu üzerinde görünür kalmalı (açık ton).
5. **Liste modu (T4).** (320dp / %200)
   - Sıra: en yeni gün üstte (bugün → ayın 1'i).
   - `days` doluysa yalnız kaydı olan günler + bugün listelenir; satır subtitle'ı kayıt sayısı ve varsa ret/çıkış yok durumu (aynı semantics metinleri).
   - Hiç kayıtlı gün yoksa ve bugün bu ayda değilse: tek satırlık `historyNoActivity` metni (AppListGroup boş kalmasın).
   - `days == null` (bilinmiyor): bugüne kadarki tüm günler, en yeni üstte, sayı/durum yok.
   - Satırlar `AppListRow`, `history-day-<date>` key'i ve `onDaySelected` callback'i aynı.

## Testler
- `takvim/calendar_test.dart`: durum önceliği (ret > çıkış yok > kayıt var), bugün için çıkış yok yok, satır sayısı (5 satırlık ay: Ekim 2026 → 5; 6 satırlık: Kasım 2026 → 6; Şubat 2027 dahil uç), lejand ızgarada var listede yok, liste sırası ve filtresi, semantics metinleri TR+EN, koyu+açık temada seçili hücre kontrastı.
- Var olan testleri yeni davranışa göre güncelle (yalnız ownership'indeki test dosyaları). `test/ui_redesign/d3a/layout_states_test.dart` B'nin; liste modu `AppListRow` + key'leri koruduğu sürece kırılmamalı — kırılırsa `ask`.

Kapılar ve rapor: ortak dosyadaki gibi.
