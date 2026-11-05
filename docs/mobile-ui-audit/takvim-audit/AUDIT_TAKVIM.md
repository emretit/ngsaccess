# Geçmiş → Takvim UX/UI audit — 2026-11-05

Kapsam: `lib/screens/history/history_screen.dart` (`_buildMonth`, `_summaryPanel`) + `lib/widgets/history/history_calendar.dart`.
Kanıt: bu klasördeki PNG'ler (koyu tema, %200, 320/360dp) + `after-b/history_calendar_light.png`, `after-b/history_overview_light.png`.

**Özet:** Takvim düzgün çalışıyor ama az şey söylüyor. Güne basınca kullanıcı takvimden atılıyor, hücreler yalnızca "kayıt var" diyor, özet ve yükleme göstergesi ekranın altında kalıyor.
En büyük kazanç: güne basınca alttan **gün kartı** açılması. Gerekli veri (`summary.days`: ilk giriş, son çıkış, sayılar) zaten geliyor, backend işi yok.

## Durum
- [ ] T1-T5 (önce)
- [ ] T6-T8 (sonra)
- [ ] T9-T10 (backend/ürün kararı)

## Önce — yüksek etki

| # | Sorun | Kanıt | Öneri | Süre |
|---|---|---|---|---|
| T1 | Güne basınca Kayıtlar sekmesine atıyor. Takvime dönmek için sekmeye basmak gerekiyor; gün filtresi Kayıtlar'da kalıyor. | `history_screen.dart` `onDaySelected` → `_applyFilter` + `_tabs.animateTo(0)` | Alttan **gün kartı**: tarih, ilk giriş, son çıkış, giriş/çıkış/ret sayısı (`AttendanceDaySummary.firstEntry/lastExit/...`) + "Kayıtları gör" (bugünkü filtreli geçiş). Sayfalı listeden türetilmediği için D3a'daki yanlış "kayıt yok" hatası geri gelmez. | ~1,5 sa |
| T2 | Hücrede tek 5px nokta var. Reddedilen geçiş ve çıkışı eksik gün ayırt edilmiyor. Koyu temada nokta zor seçiliyor. | `history_calendar.dart` marker; `history_calendar_dark.png` | Nokta durumu: normal gün = dolu nokta, ret varsa = kırmızı nokta, giriş var çıkış yok = boş halka. Veri `summary.days`'te var. Lejand buna göre güncellenir. | ~1 sa |
| T3 | Takvimde sola/sağa kaydırınca ay değil **sekme** değişiyor (TabBarView swipe). Takvim kullanıcısı ay değiştirmeyi bekler. | `TabBarView` physics varsayılan | Sekme swipe'ı kapat; takvim üzerinde yatay swipe = önceki/sonraki ay. | ~30 dk |
| T4 | Dar ekran (320dp) ve %200 yazıda liste görünümü: ayın 1'inden bugüne her gün bir satır ("0 kayıt" dahil), en eski üstte. Ay sonunda özete ulaşmak için ~30 satır kaydırılıyor. Listede nokta yokken "Noktalı günlerde kayıt var" yazıyor. | `history_calendar_light_tr_w320_s100.png`, `..._w390_s200.png` | En yeni gün üstte; kayıtsız günler kompakt ya da "kayıtsız günleri göster" ile gizli. Liste modunda nokta lejandı gizlenir. | ~1 sa |
| T5 | Özet ve yükleme göstergesi ekranın altında kalıyor. 390dp'de "Ay özeti" başlığı alt barın arkasında. Ay değişince sayılar gelene kadar takvimde hiçbir işaret yok; skeleton/hata aşağıdaki panelde, görünmüyor. Takvim her ay 6 satır çiziyor (5 satırlık aylarda boş 48dp). İki satır yardım metni de yer kaplıyor. | `for (week < 6)`; `history_calendar_light.png` | Yalnız gereken satır sayısını çiz. Ay başlığının altına ince ilerleme çubuğu, hata için kısa satır. İki yardım satırını tek satıra indir. | ~45 dk |

## Sonra — orta/düşük

| # | Sorun | Öneri | Süre |
|---|---|---|---|
| T6 | Özet panelinde tekrar ve gürültü: "1–30 Kas" başlıktaki "Kasım 2026" ile aynı · "Belirsiz: 0" gibi sıfır rozetler · "Belirsiz" çalışana anlamsız · "Son güncelleme" + büyük "Kayıtlar hakkında" düğmesi ikincil bilgiye çok yer veriyor | Aralığı kaldır; sıfır rozetleri gizle; "Belirsiz" → "Yönü belirsiz"; "Kayıtlar hakkında" → başlık yanında (i) ikonu | ~30 dk |
| T7 | Bugün bordo konturla gösteriliyor. Segmentte seçili sekme de bordo kontur + tik. "Bugün" ile "seçili" aynı görsel dili kullanıyor. | Bugün = kalın rakam + hafif zemin; seçili gün = dolu bordo daire | ~20 dk |
| T8 | Geçmiş aydan bugüne dönüş kısayolu yok (3 ay geri → 3 kez ok) | Başka aydayken başlık yanında "Bugün" düğmesi | ~20 dk |

## Backend / ürün kararı gerekenler

| # | Sorun | Not |
|---|---|---|
| T9 | Hafta tatili / vardiya tatili takvimde ayırt edilmiyor | Hafta tatili vardiyadan geliyor ama mobil özette yok → Convex `summary.days`'e `restDay` alanı |
| T10 | Çalışanın asıl merak ettiği çalışma süresi, geç kalma ve eksik çıkış günü sayısı özette yok | PDKS hesapları web'de var; mobil özete taşımak ürün kararı |

## Erişilebilirlik ve test
- Gün semantics'i sağlam: tam tarih + kayıt sayısı okunuyor; sayı bilinmiyorsa okunmuyor.
- Dokunma hedefi 48dp yükseklik, ≥44dp genişlik: uygun.
- Harness'te koyu tema takvim ve %200 takvim görüntüsü **yok**; bu audit için geçici üretildi. T-dalgasıyla birlikte kalıcı eklenmeli.

## Kapsam dışı (ayrı iş)
- %200 yazıda alt bar etiketleri kelime ortasından bölünüyor ("Geçmi ş", "Ziyare tçi", "QR İşleml eri") — `history_calendar_light_tr_w390_s200.png`.
