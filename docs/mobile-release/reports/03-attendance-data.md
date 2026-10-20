# 03 — Attendance veri katmanı teslimi

19 Ekim 2026. Bu worker yalnız kendisine ayrılan mobil model/repository/provider, ilgili testler ve bu raporu değiştirdi. Önceden mevcut web/Convex değişikliklerine dokunulmadı. Kaynak incelemesi ve `git diff --check` yapıldı; koordinatörün SDK kilidi nedeniyle Flutter/Dart analyze/test/format/pub-get/build veya codegen çalıştırılmadı. Aşağıdaki testler **yazıldı, bu worker tarafından çalıştırılmadı**; yayın onayı veya cihaz doğrulaması iddiası yoktur.

## Uygulanan davranış

- AttendanceProvider auth notifier'ını doğrudan dinler; `currentUser.id`, `sessionToken`, `sessionEpoch` ve provider bağlama kimliği değiştiğinde kayıtları, arşivi, cihaz seçeneklerini, özet cache'ini, hataları ve busy durumlarını anında temizler. Aynı kullanıcıyla yeni oturum da yeni bağlamdır. Dispose/auth değişimi eski sonuçları geçersiz kılar.
- İlk sayfa için generation, arşiv isteği için ayrı sıra ve her özet aralığı için ayrı sıra kullanılır. Veri, hata, auth-expiry ve `finally` yazımları sahiplik kontrolü yapar. Eski A isteğinin expiry sonucu B oturumunu kapatamaz. Polling kurulumu sürerken pause/dispose olursa sonradan gelen handle iptal edilir.
- `mobileAttendance:listPage` sorguları sabit 50 kayıt ister. `loadMore()` büyüyen limit yerine server cursor'unu kullanır; `isDone` sonlandırma kaynağıdır. Boş/eksik ara sayfa son anlamına gelmez. Tekrarlanan, ilerlemeyen cursor protokol hatasıdır. İlk arşiv sınırı canlı polling sırasında değiştirilmez; pencereden düşen önceki baş kayıtları arşive taşınır ve ID ile tekilleştirilir.
- `setFilters(startDate,endDate,deviceId)` server filtrelerini ve cursor'u sıfırlar. Tarihler kapsayıcı `YYYY-MM-DD`; backend bunları `[başlangıç, ertesi gün başlangıcı)` yapar. Aynı adlı cihazlar ID bazında ayrılır; keşfedilen cihaz seçenekleri filtre değişimlerinde korunur ve oturum değişiminde temizlenir.
- Manuel `loadAttendanceRecords()` başarılı yeni baş yanıtında eski arşiv snapshot'ını değiştirir. Böylece önceki snapshot dışında kalmış eski backfill kayıtları yeni sayfalama ile keşfedilir. `refreshLiveData()` canlı pencereyi arşivi koruyarak yeniler ve günlük özeti ayrıca ister. Polling arşiv prefix'ini tekrar indirmez.
- Günlük/haftalık/aylık özetler liste pagination'ından bağımsız, başlangıç/bitiş anahtarlı cache'dedir. Home'un günlük özeti history'nin ay/hafta istekleriyle ezilmez. Başarılı boş sonuç, yüklenmedi, yükleniyor, hata ve eski başarılı verinin yanında hata ayrılır. DTO, aralıktaki bütün günleri ve toplamların günlerle tutarlılığını doğrulamadan yüklenmiş sayılmaz.
- Yön `AttendanceDirection.entry/exit/unknown`; karar `AttendanceDecision.granted/denied/unknown`. Eksik/bilinmeyen yön giriş değildir; eksik karar ret değildir. Ret ham olay olarak kalır ve kabul edilmiş check-in zamanı üretmez. Günlük durum ve hareket toplamları server özetinden gelir. Son yön bilinmiyorsa `isTodayStatusKnown=false`; ilk veri öncesi “yok” kesin iş sonucu değildir.
- Modelde Türkçe cihaz/çalışan adı fallback'i kaldırıldı; eksik ad boş/null kalır, çeviri UI sahibindedir. `source` korunur. Kimlik, tarih, liste, satır veya karar şekli bozuksa boş/kısmi başarı üretilmez. Repository güvenli `ProtocolError` verir ve ham response'u hata metnine taşımaz.
- `AttendanceDate.calendarKey()` yalnız yıl/ay/gün bileşenlerini kullanır; TableCalendar'ın UTC seçimleri güne kaydırılmaz. `instantKey()` gerçek UTC instant'ı Türkiye iş gününe dönüştürür. Ortak gün/hafta/ay sınırları ve enjekte `clock` eklendi. Hesap telefonun yerel saat dilimine bağlı değildir.
- Fiziksel komutlar koordinatörce ayrı DoorOperationProvider sahibine ayrıldı. Legacy `AttendanceProvider.quickUnlock/recordAttendance` imzaları korunur, fakat yerelde `false` + `READER_REQUIRED` döner ve selfCheckIn çağrısı yapmaz. Eski backend'e bağlanıldığında bile sahte geçiş kaydı yazılmaz. Repository'nin legacy `selfCheckIn` bool decoder'ı uyumluluk için kaldı; bu bool yalnız server kararıdır, donanım veya geçiş kanıtı değildir.

## Audit kapsamı

| İş/bulgu | Bu worker'ın kodda giderdiği bölüm | Kalan doğrulama/başka sahip |
|---|---|---|
| MOB-03 / AH-F05, AH-F10 / HOME-F08 | Oturum/istek sahipliği, anlık izolasyon, eski sonuç/error/finally koruması, ayrı liste/legacy komut kanalları | Auth, yeni operation ve UI lifecycle kapsamı ilgili sahiplerde; regresyonların SDK'da yürütülmesi gerekli |
| MOB-10 / AH-F02, AH-F07 / HOME-F04 | Cursor repository/provider, sabit canlı pencere, server filtreleri, bağımsız tam aralık özeti | Olay zamanı indeksi, cursor snapshot ve tenant sorguları backend worker'da; gerçek payload/byte/süre ölçümü yapılmadı |
| MOB-11 / AH-F01, AH-F03, AH-F06 / HOME-F05 | Takvim/instant ayrımı, Türkiye günü, yarı açık sınırlar, enjekte saat; ilk giriş hesabının sadece eligible entry server sonucuna taşınması | Vardiya/gece eşlemesi ve bordro sonucu bu ham olay sözleşmesinin parçası değildir; cihaz/takvim widget kabulü UI sahibinde |
| MOB-12 / AH-F04, AH-F08, AH-F10 / HOME-F03, HOME-F06 | Granted/denied/unknown, entry/exit/unknown, tam özet state'i, ID facet'leri, protokol doğrulaması | Boş refresh, scroll/mounted ve gerçek görünüm history/home sahibinde |
| MOB-04 ve MOB-16'nın attendance bölümü | Bozuk DTO'nun sessiz başarıya dönüşmemesi, ham payload'ın hataya taşınmaması; yerelleştirilmiş model fallback'inin kaldırılması | Global hata/ARB çevirisi transport/localization sahiplerinde |

Bu tablo tüm MOB kartlarının uçtan uca kapandığı anlamına gelmez. Backend, UI ve fiziksel cihaz kabul kanıtı ayrı teslimlerle birleşmelidir.

## Kullanılacak arayüzler

`AttendanceProvider`:

- `setAuthProvider(AuthProvider)`; auth sınıfının `int sessionEpoch` getter'ına bağlıdır. Provider kendi dinleyicisini ekler ve dispose'da kaldırır.
- Liste: `attendanceRecords`, `listLoaded`, `isLoading`, `isLoadingMore`, `hasMore`, `isListFullyLoaded`, `listError`, `loadMoreError`, `isStale`, `deviceFacets: Map<String,String>`; eski `lastError/errorMessage` liste hata alias'larıdır. `clearError()` liste hatalarını temizler.
- `Future<void> setFilters({String? startDate,String? endDate,String? deviceId})`, `loadMore()`, `loadAttendanceRecords()`, `refreshLiveData()`.
- `Future<AttendanceSummary?> loadSummary({required String startDate,required String endDate})`; `summaryFor`, `hasSummaryFor`, `isSummaryLoadingFor`, `summaryErrorFor`, `isSummaryStaleFor` aynı named string aralıklarını kullanır.
- `loadDailySummary()`, `dailySummary`, `todaySummary`, `hasSummaryLoaded/todaySummaryLoaded/summaryLoaded`, `isSummaryLoading`, `summaryError`, `summaryUpdatedAt`, `isTodayStatusKnown`; `summary` alias'ı **günlük** özettir. History aralık getter'larını kullanır.
- Eski günlük getter'lar korunur: `firstEntryToday,lastEntryToday,lastExitToday,extraMovementsToday,extraEntryMovementsToday,extraExitMovementsToday,hasCheckedInToday,hasCheckedOutToday,attendanceStatus`. `AttendanceStatus.none/inside/out` enum'u değişmedi; kesinlik için `isTodayStatusKnown/hasSummaryLoaded` birlikte okunmalıdır.
- Legacy `todayAttendance` yalnız yüklü ham pencereden kayıt döndürür; tam günlük sonuç kaynağı değildir. `daysPresent` yalnız tam ay özeti cache'de varsa o server toplamıdır; `monthSummaryLoaded` okunmalıdır. Ham kayıttan sabit 09:00 eşiğiyle geç kalma üretilmez: `hasShiftSummary=false`; `daysLate/daysOnTime` deprecated uyumluluk getter'larıdır ve 0 sentinel döner, iş metriği gibi gösterilmemelidir.
- `commandError/commandErrorMessage`, `clearCommandError`, `isCommandLoading` legacy tüketiciler için kalır; legacy işlem yerelde engellendiği için busy başlatmaz. Gerçek kapı operasyonu yeni provider'dadır.

Backend sözleşmesi değişmedi:

- `mobileAttendance:listPage` employeeQuery args `{cursor:null|string,numItems:50,startDate?,endDate?,deviceId?}` → `{page,isDone,continueCursor}`. Çalışan/proje kimliği argümanı gönderilmez.
- `mobileAttendance:summary` employeeQuery args `{startDate,endDate}` → `{startDate,endDate,timeZone:'Europe/Istanbul',generatedAt,days,totals}`. Her `days` öğesi tarih, entry/exit/denied/unknown count, nullable ilk/son entry/exit ve lastDirection içerir.
- Backend sahibinin doğruladığı sınırlar: 93 kapsayıcı gün, en çok 10000 reading/8 MiB scan; aşım `SUMMARY_TOO_LARGE`, bozuk veri `SUMMARY_INVALID_DATA`. Bunlar boş başarıya çevrilmez. Tarih aralığı ve sayfa boyutu hataları ayrı typed error kalır.
- Backend sahibiyle son bilinmeyen hareketin `lastDirection=unknown` yapması ve bozuk stored timestamp'in özetten sessizce atılmaması koordine edildi; ilgili backend dosyalarını bu worker değiştirmedi.

`AttendanceDate` dosyası `mobile/lib/core/attendance_date.dart`: `businessTime`, `calendarKey`, `instantKey`, `parseDay`, `dayStart`, `nextDayStart`, `inDay`, `month`, `week`, `validateRange`. `businessTime` İstanbul bileşenlerini UTC işaretli bir taşıyıcı DateTime olarak verir; görüntü formatlamadan önce tekrar `.toLocal()` yapılmaz. Modern Türkiye UTC+03 sözleşmesi kullanılır; 2016 öncesi tarihî IANA timezone kuralları veya vardiya günü çözümlemesi uygulanmış gibi sunulmaz.

## Dosyalar ve testler

Değiştirilen mevcut dosyalar:

- `mobile/lib/models/attendance.dart`
- `mobile/lib/providers/attendance_provider.dart`
- `mobile/lib/repositories/attendance_repository.dart`
- `mobile/test/providers/attendance_provider_test.dart`
- `mobile/test/repositories/attendance_repository_test.dart`

Eklenen dosyalar:

- `mobile/lib/core/attendance_date.dart`
- `mobile/lib/models/attendance_page.dart`
- `mobile/lib/models/attendance_summary.dart`
- `mobile/test/core/attendance_date_test.dart`
- `mobile/test/models/attendance_test.dart`
- `mobile/test/models/attendance_summary_test.dart`
- `docs/mobile-release/reports/03-attendance-data.md`

Yeni dependency, pubspec, ARB, UI, auth, mainroot, config veya Convex değişikliği yoktur.

44 kaynak test vakası: provider 19, repository 10, tarih 6, model 6, summary 3. Kontrollü Completer'larla A→logout→B, aynı kullanıcı yeni session, ters refresh sırası, eski finally, eski summary expiry, arşiv/filtre yarışı, boş ara sayfa, cursor snapshot merge, manuel yeniden snapshot, dispose/pause; bağımsız 150 hareketli özet/pagination; bozuk envelope/satır/timestamp/karar; tam 50 kayıtla isDone; geçerli/bozuk tarih ve UTC+3 gece yarısı/hafta/ay/yıl/leap/DST fixture'ları yazıldı. Legacy yolların mutation çağırmadan reddetmesi de testlenir. Fiziksel işlem mutation yarışı yeni operation sahibinin test kapsamındadır.

Çalıştırılan kontrol: yalnız sahip olunan dosyalarda `git diff --check` — temiz. Kaynak ve arayüz sözleşmesi ilgili home/history/auth/backend sahipleriyle Orca mesajları üzerinden karşılaştırıldı. Koordinatörün `docs/mobile-release/evidence/flutter-analyze-integration.txt` merkezi analizinde bu worker dosyalarında tip hatası yok, dört info vardı (gereksiz foundation import, curly block, iki collection null-aware önerisi); dördü kaynakta düzeltildi, bu düzeltmeden sonra analiz bu worker tarafından tekrar çalıştırılmadı. Test/format çalıştırılmadığı için “44 test geçti” sonucu yoktur; koordinatöre dosya listesi ve SDK doğrulama isteği erken iletildi.

## Dürüst kalan sınırlar ve release kapıları

- SDK analiz/test/son format ve genel mobil entegrasyon koordinatörde çalıştırılmalıdır. Bu rapor yazıldığı anda gerçek Android/iOS build veya imzalama kanıtı yoktur.
- Yeni endpoint'ler deploy edilmeden mobil yeni veri katmanı çalışır diye ilan edilmemelidir; deploy/codegen/production mutation yapılmadı. Canlı employee session A/B izolasyonu, network expiry ve gerçek backend E2E ayrı release kapısıdır.
- Facet seçenekleri oturumda **keşfedilmiş** cihazlardır; bütün tarihçe için exhaustive server facet endpoint'i yoktur. Henüz yüklenmemiş eski sayfadaki cihaz ilk sayfa açılır açılmaz facet'te varmış gibi sunulmaz.
- Arşiv receive-time snapshot'tır. Snapshot sonrasındaki eski backfill'ler manuel refresh + yeni pagination ile gelir. Canlı 50 kaydın tamamından hızlı yeni olay akışında tarihçenin bütünlüğü yalnız bir head poll ile kanıtlanamaz; tam gün/dönem toplamı için bağımsız summary esas alınır. Kaynak kodda sabit polling sınırı doğrulandı; gerçek byte/süre ölçümü yapılmadı.
- Özet, ham/uygun erişim hareketlerinin Türkiye takvim günü hesabıdır; çalışma saati, bordro, vardiya/gece eşlemesi veya “geç kaldı” sonucu değildir. İş kuralı olmadan sahte aylık başarı metriği eklenmedi.
- Cihaz/panel onayı ve fiziksel geçiş bu worker'ın kodu veya mock testiyle kanıtlanmaz. Yeni operation/provider ve okuyucu tüketimi ayrı sahiplerde, donanım/E2E release matrisindedir.
