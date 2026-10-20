# 04 — History UI uygulama teslimi

19 Ekim 2026. Kapsam: history ekranı, ekrana özel üç widget ve iki widget test dosyası. Mevcut web/Convex değişikliklerine ve başka worker sahipli dosyalara dokunulmadı. Bu teslim gerçek UI kodudur; backend/provider/çeviri değişiklikleri ilgili sahiplerce sağlanan API üzerinden entegre edilmiştir.

## Uygulanan davranış

- Takvim `AttendanceDate.calendarKey` ile yıl/ay/gün bileşenlerini kullanır; `TableCalendar` UTC callback gününü bir UTC anı olarak başka güne taşımaz. Aynı günün event loader, işareti, semantik sayısı ve seçim eylemi aynı anahtarı kullanır.
- Liste zamanları ve detaylar `AttendanceDate.businessTime` ile Europe/Istanbul gösterilir; timezone ekranda açıkça görünür. Ay/hafta aralıkları ortak `AttendanceDate.month/week` API'sinden gelir. API'nin inclusive gün stringleri sunucunun `[başlangıç, sonraki gün başlangıcı)` aralığına çevrilir; UI'da önceki aya gün ekleyen bağımsız hesap yoktur.
- Ay ve hafta sayıları `summaryFor(startDate,endDate)` aralık cache'inden gelir; ilk 50 veya yüklenmiş liste uzunluğu toplam olarak kullanılmaz. Son güncelleme zamanı görünür. Sabit 09:00/09:30 erken/geç renkleri ve resmi yoklama izlenimi veren yerel hesaplar kaldırılmıştır.
- Takvim günü seçimi sunucuya tek gün filtresi gönderip Tümü sekmesini açar; eksik sayfadan tüm gün detayı üretilmez. Takvimde yalnız izinli giriş/çıkış summary sayıları işaretlenir; sadece reddedilen olay bulunan günün seçimi de mümkündür.
- Ham hareket kartı yönü ve erişim kararını ayrı gösterir. Reddedilen giriş, kırmızı ret simgesi ve açık ret metniyle görünür; bilinmeyen yön çıkışa veya girişe dönüştürülmez. Bilinmeyen erişim kararı da korunur. Kart numarası yanlışlıkla QR kod etiketiyle sunulmaz.
- Filtreler cihaz adı yerine `deviceId` ve gün stringleriyle `setFilters` çağırır. Her değişiklik server cursor ve scroll konumunu sıfırlar. Cihaz seçimi `Consumer` ile güncel facet Map'ini izler; aynı adlı cihazlar ayrı ID'lerle seçilir ve ayırt edilir.
- Boş/dolu/filtreli listenin tamamı aynı `AlwaysScrollableScrollPhysics` yüzeyindedir. Cursor kaldığı sürece açık Daha fazla yükle düğmesi bulunur; boş ama bitmemiş sayfa kesin "kayıt yok" sonucu gibi gösterilmez. Scroll callback yalnız `context.read` kullanır.
- İlk yükleme, başarılı boş sonuç, ilk hata, önceki veri üzerinde yenileme hatası ve sonraki sayfa hatası ayrıdır. Yenileme hatası önceki kayıtları korur; sonraki sayfa hatası footer'da aynı cursor için yeniden deneme yolu sunar. Komut hata kanalı geçmişi kapatmaz.
- Tarih seçici ve seçim diyaloglarından sonra `mounted` kontrolü vardır. Yenileme await'inden sonra widget state yazılmaz. Tüm sekmelerde pull-to-refresh ve AppBar yenileme eylemi vardır.
- Kaydırılabilir sekme başlıkları, çok satırlı kart/detaylar, kaydırılabilir dialoglar, bounded cihaz listesi, metin ölçeğine göre takvim yüksekliği, tema colorScheme renkleri, ikon tooltip'leri ve semantik kayıt/gün etiketleri eklenmiştir. Takvim günü InkWell ile klavye odağı/aktivasyonu da sağlar.

## Audit eşlemesi

| Bulgu / MOB | Bu teslimdeki durum |
| --- | --- |
| AH-F01 / MOB-11 | UI UTC/local gün anahtarı sorunu giderildi; shared tarih helper'ına bağlandı. |
| AH-F02 / MOB-10 | UI bağımsız server range summary ve cursor API'sine bağlandı; tam dönem görüntüsü sayfalı listeden hesaplanmıyor. Backend sorgu doğruluğu/verimliliği backend ve 03 tesliminin doğrulama kapsamıdır. |
| AH-F03 / MOB-11 | UI'daki önceki gün dahil etme, gece yarısını dışlama ve pazartesinin saatini koruma hesapları kaldırıldı; shared dönem sözleşmesi kullanılıyor. |
| AH-F04 / MOB-12 | Ret/bilinmeyen yön/bilinmeyen karar kart ve detayda ayrıldı; katılım sayıları server'ın uygun olay özetinden gelir. |
| AH-F06 / MOB-11 | Europe/Istanbul ham olay günü ve zaman gösterimi açıklandı; vardiya/gece vardiyası veya bordro hesabı geliştirildi iddiası yoktur. |
| AH-F08 / MOB-12 | ID filtresi ve reaktif, oturum içinde keşfedilmiş facet seçenekleri uygulandı. Tüm tarihçedeki cihazların ayrı exhaustive facet servisi yoktur. |
| AH-F09 / MOB-12 | Await sonrası widget yaşam döngüsü korumaları, boş liste refresh ve tüm sekmelerde yenileme uygulandı. |
| AH-F10 / MOB-12 | UI liste/komut hata ayrımına ve stale gösterimine bağlandı; hata nesnesi lifecycle'ı 03 provider teslimine aittir. |
| AH-F11 / MOB-12 | Build dışı dinleyen Provider okuması kaldırıldı. |
| AH-F05, AH-F07 | Oturum epoch ve olay zamanı bounded sorgu/polling veri katmanı konularıdır; UI tarafından kapatılmış sayılmadı. |

## Değişen dosyalar

- `mobile/lib/screens/history/history_screen.dart`
- `mobile/lib/widgets/history/history_calendar.dart`
- `mobile/lib/widgets/history/history_record_tile.dart`
- `mobile/lib/widgets/history/history_records_list.dart`
- `mobile/test/widgets/history_screen_test.dart`
- `mobile/test/widgets/history_widgets_test.dart`
- `docs/mobile-release/reports/04-history-ui.md`

## Entegrasyon sözleşmesi ve bağımlılıklar

03 sahibinin `AttendanceDate`, `AttendanceDecision`, `AttendanceDirection`, `AttendanceSummary/AttendanceTotals` modelleri kullanılır. Provider: `setFilters`, `loadAttendanceRecords`, `loadMore`, `listLoaded`, `listError`, `loadMoreError`, `isStale`, `deviceFacets`, `loadSummary`, `summaryFor`, `isSummaryLoadingFor`, `summaryErrorFor`. Ay ve hafta cache'leri birbirini ezmez. Tüm kullanıcı kimliği/oturum izolasyonu provider/backend sorumluluğundadır; UI employee ID göndermez.

08 sahibinin sağladığı `historyLoadMore`, `historyUnknownDirection`, `historyUnknownAccess`, `historyStaleData`, `historySummaryUnavailable`, `historyRawEvents`, mevcut `accessDenied`, `qrRefresh` ve `homeUpdatedAt` çevirileri kullanılır. Bu worker ARB/generated dosyalarını değiştirmedi. Yeni paket veya pubspec değişikliği yoktur. `HistoryScreen` mevcut parametresiz kullanımını korur; isteğe bağlı `now` saat enjeksiyonu test içindir.

## Yazılmış regresyon testleri

İki dosyada 13 widget testi:

1. UTC takvim callback'i ve local bileşen günü aynı kayda erişir; günün seçimi ve semantik sayısı.
2. Reddedilen giriş ve bilinmeyen yönün doğru görünmesi.
3. Boş fakat devam cursor'ı olan sayfada explicit loadMore ve pull-to-refresh; sahte nihai boş sonuç yokluğu.
4. Yenileme hatasında önceki kaydın ve stale uyarısının korunması.
5. İlk hatanın başarılı boş sonuçtan ayrılması.
6. 320 px / %200 metinde kart yeniden akışı ve dokunma eylemi.
7. Tek yüklü kayda rağmen bağımsız ay/hafta özetlerinin server toplamlarını göstermesi ve pazartesi aralığının istenmesi.
8. Takvim gününün eksik yerel dialog yerine server gün filtresini açması.
9. Dialog açıkken yeni facet gelmesi ve aynı isimli cihazların doğru ID ile filtrelenmesi.
10. Gerçek scroll threshold'unda build dışı Provider assertion olmadan loadMore çağrısı.
11. Ekran kaldırıldıktan sonra refresh tamamlanmasının widget state yazmaması.
12. Tarih seçici açıkken ekranın kaldırılması.
13. 320 px / %200 metinde filtre ve yenileme eylemlerine erişim.

## Çalıştırılmış kontroller ve açık sınırlar

- `git diff --check` scoped dosyalarda başarılı.
- Provider/model/çeviri getter isimleri mevcut çalışma ağacından kaynak düzeyinde doğrulandı.
- Yerel kilitli `table_calendar 3.2.0` kaynakları okundu: UTC gün üretimi, kullanılan builder API'leri ve day-cell builder içindeki semantiğin dışlandığı doğrulandı; kayıt sayısı sibling marker semantiğine taşındı.
- **Flutter/Dart analyze, format, test, build, pub get ve gen-l10n bu worker tarafından çalıştırılmadı.** SDK kilidi koordinatördedir; iki test dosyası ve analiz/format ihtiyacı erken status mesajlarıyla iletildi. Testlerin geçmesi bu raporda iddia edilmez.
- Canlı backend/cihaz, TalkBack/VoiceOver, farklı cihaz timezone'u, gerçek 150 kayıtlı veri ve platform build doğrulaması yapılmadı. Yayına hazır nihai kararı için koordinatörün ortak check/build ve cihaz QA sonucu gereklidir.
- Facet seçenekleri aynı oturumda yüklenmiş/keşfedilmiş cihazlardır; daha önce hiç yüklenmemiş tarihsel bir cihaz ilk keşfine kadar filtre menüsünde yer almaz. Bu kapsam 03 sahibine ve koordinatöre iletildi; eksiksiz server facet capability'si olarak sunulmaz.
- Signing/mağaza kimlik bilgileri ve fiziksel panel testi bu ekran tesliminin dışında kalır. Commit, push, deploy veya üretim mutasyonu yapılmadı.
