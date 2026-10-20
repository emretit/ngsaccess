# 03 — Yoklama verisi ve geçmiş audit raporu

Tarih: 19 Ekim 2026. İnceleme mevcut çalışma ağacına aittir; depodaki önceden mevcut web/Convex değişiklikleri korunmuştur. Bu çalışma yalnız kaynak okuma ve bu raporu yazma işlemidir; uygulama/backend/platform/test kodu değiştirilmemiş, formatlama, deploy, commit, push, veri mutasyonu veya Flutter komutu yapılmamıştır.

**Sonuç:** Geçmiş ekranı gerçek çalışan oturumu ve gerçek kart okuma sorgusuyla çalışacak şekilde bağlıdır; demo veri üretimi bulunmadı. Buna karşılık takvim eşlemesi, özetlerin veri kapsamı, dönem sınırları, reddedilen/bilinmeyen hareketlerin anlamı ve oturum değişimi sırasında bekleyen yanıtların kabulü için önemli düzeltmeler gerekir. **11 bulgu: P0: 0, P1: 5, P2: 6, P3: 0.** Bunlar kaynak analizi bulgularıdır; bu worker cihaz/canlı backend/E2E çalıştırmamıştır.

## 1. Kapsam, yöntem ve kanıt sınırı

Aşağıdaki hedef dosyaların tamamı satır satır tarandı:

| Dosya | İncelenen kapsam |
| --- | --- |
| `mobile/lib/screens/history/history_screen.dart:1–1527` | Dizindeki tek dosya; liste, filtre, takvim, istatistik, detay, yenileme, kaydırma |
| `mobile/lib/providers/attendance_provider.dart:1–415` | Oturum bağlama, polling, yaşam döngüsü, sayfalama, günlük/aylık hesaplar, QR sonrası yenileme |
| `mobile/lib/repositories/attendance_repository.dart:1–54` | Liste, self-check-in ve subscription sözleşmeleri |
| `mobile/lib/models/attendance.dart:1–95` | JSON dönüşümü, zaman, yön, izin ve cihaz alanları |
| `mobile/test/providers/attendance_provider_test.dart:1–223` | Yaşam döngüsü, yükleme, hata/oturum, geçersiz QR, günlük izin filtresi testleri |
| `mobile/test/repositories/attendance_repository_test.dart:1–99` | Liste parse ve self-check-in argüman testleri |
| `mobile/test/config/convex_config_test.dart:1–83` | Polling çakışmaması, iptal ve oturum hatası testleri |
| `mobile/test/helpers/mocks.dart:1–20` | Mock sınırları; repository/client gerçek backend kullanmıyor |

Bağlam için okunan bölümler: `mobile/lib/config/convex_config.dart:41–263`, `mobile/lib/main.dart:32–99`, `mobile/lib/providers/auth_provider.dart:71–162`, `mobile/lib/router/app_router.dart:42–127`, `mobile/lib/screens/home/home_screen.dart:157–168`; `convex/cardReadings.ts:1352–1449,1456–1525,1018–1059,1690–1739`, `convex/lib/customFunctions.ts:113–134`, `convex/lib/employeeAuth.ts:1–37`, `convex/lib/cardReadingAudit.ts:13–29,125–148`, `convex/lib/cardReadingProcess.ts:30–73`, `convex/schema.ts:460–509`, `convex/lib/trDate.ts:1–40`, `convex/lib/pdksSource.ts:1–88`, `convex/lib/liveReadings.ts:1–44`. Convex okumadan önce `convex/_generated/ai/guidelines.md` bütünü okundu; kök `AGENTS.md` izlendi. Hedef alt dizinlerde ek AGENTS dosyası bulunmadı.

Bağımlılık davranışı tahmin edilmedi: kilitli `table_calendar 3.2.0` (`mobile/pubspec.lock:669–676`) ve kurulu `provider 6.1.5+1` kaynakları okundu. Aşağıda `PUB/` kısaltması `/Users/emreaydin/.pub-cache/hosted/pub.dev/` dizinidir. Bu kanıtlar yerel kurulu sürüme aittir; dış dünyada en güncel sürüm iddiası yoktur.

Koordinatörün [baz doğrulamasında](../evidence/baseline.md) `flutter analyze --no-pub` temiz ve `flutter test --no-pub --reporter expanded` **44 test başarılı** bildirilmiştir. Worker bu komutları yeniden çalıştırmadı. Bu sonuç, test dosyalarındaki mock sınırlarının geçtiğini gösterir; aşağıdaki cihaz, gerçek sorgu ve E2E senaryolarını doğrulamaz. `mobile/test/` envanterinde history widget/model test dosyası ve `mobile/integration_test/` dizini bulunmadı; test yokluğu tek başına işlevsel bug sayılmadı.

## 2. Mevcut gerçek akış ve capability tablosu

| Akış / capability | Durum | Gerçek kaynak zinciri ve sınır |
| --- | --- | --- |
| Çalışanın kendi geçmişini getirme | Çalışıyor (kaynak bağlantısı) | Repository `list:13–17` → client `employeeQuery:119–129` → `employeeAuthedQuery:117–123` → `getCurrentEmployee:11–22` → `cardReadings.listForEmployee:1357–1369`. Canlı deployment sonucu kanıtlanamadı. |
| Backend kullanıcı izolasyonu | Çalışıyor (kaynak bağlantısı) | Çalışan kimliği sorgu argümanından alınmıyor; session ile çözülen `employee._id` indeks koşulu. Geçersiz/süresi dolmuş session ve pasif çalışan reddediliyor. İstemci yanıt yarışı ayrı: AH-F05. |
| Gerçek QR sonrası geçmiş yenileme | Kısmi | Provider `325–333` → gerçek mutation; backend `1434–1448` kayıt yazar. `_silentRefresh` ve polling kullanılıyor. Bu mutation sonucunun fiziksel kapı açtığını bu modül kanıtlamaz. |
| Otomatik güncelleme | Çalışıyor, polling | Repository `42–52` → client `150–223`: ilk istek hemen, normal aralık 1 dakika, hatada en fazla 5 dakika. WebSocket/canlı push değildir. |
| Arka plan/ön plan | Kısmi | Provider `244–253` polling'i durdurup başlatır; generation callback koruması vardır. Bağımsız HTTP yenilemelerinde aynı koruma yoktur. |
| Tüm kayıtlar, detay diyaloğu | Kısmi | İlk 50 uzaktan; ilk 20 yerel görüntüleme, ardından +20/+50. Yön ve izin ayrımı eksik; sonsuz geçmiş veya tam dönem garantisi yok. |
| Sayfalama | Kısmi | Cursor yok; artan limit ile tüm pencere tekrar çekiliyor. Filtreli/boş liste eski kayıtlara ilerleyemiyor (AH-F02). |
| Tarih/cihaz filtresi | Kısmi | Sadece eldeki listeye uygulanıyor (`1026–1048`). Tarih aralığı seçimi yok; tek gün seçimi var. Cihaz adı kimlik olarak kullanılıyor. |
| Bu ay takvimi, renk ve gün detayı | Kısmi | Veri ve callback mevcut; yerel/UTC map anahtarları uyuşmuyor (AH-F01). Sadece içinde bulunulan ay gezilebilir (`346–349`). |
| Aylık/haftalık/genel istatistik | Kısmi | Kaynak yerel yüklenmiş liste; tam dönem toplamı değil. Sınır, izin/yön sorunları AH-F02–F04. |
| Vardiya/gece vardiyası/işletme zaman dilimi | Kısmi | Yerel cihaz takvimi + sabit saat eşikleri var; çalışan vardiya planı/history içinde alınmıyor. Backend yön toggle'ı Türkiye gününde sıfırlanıyor. |
| Pull-to-refresh / hata sonrası tekrar | Kısmi | Dolu tüm kayıtlar listesinde refresh ve hata ekranında retry mevcut. Boş ekran scrollable değil; takvim/istatistikte refresh yok. |
| Sahte/demo veri | Placeholder yok | Hedef akışta üretilen demo yok. Test fixture'ları mock'tur; gerçek uçtan uca işleyiş kanıtı değildir. |
| Cihaz, fiziksel geçiş, üretim performansı | Kanıtlanamadı | Bu audit cihaz/emülatör, canlı veri veya yük testi yapmadı. |

## 3. İyi çalışan temeller

- Backend çalışan sorgusu istemci `employeeId` kabul etmiyor; session doğrulaması ve çalışan indeksiyle sınırlandırılıyor (`customFunctions.ts:117–123`, `employeeAuth.ts:11–22`, `cardReadings.ts:1363–1367`). Bu zincirde başka çalışanı seçmeye yarayan bir sorgu parametresi bulunmadı.
- Repository/UI ayrımı belirgin; JSON ve HTTP ayrıntıları history ekranına taşınmamış (`attendance_repository.dart:13–17,42–52`).
- Tek polling döngüsü önceki yanıt bitmeden yenisini zamanlamıyor; iptal sonrası sonuç callback'e aktarılmıyor, geçici hatada geri çekiliyor (`convex_config.dart:173–222`). Bu davranışa yönelik iki anlamlı mevcut test var (`convex_config_test.dart:10–82`).
- Subscription callback'lerinde generation ve aktiflik kontrolü var; önceki subscription iptal ediliyor (`attendance_provider.dart:151–178,219–226`). Bu iyi yaklaşım bağımsız refresh yoluna genişletilebilir.
- Ana sayfanın günlük durum hesabı izin verilmeyen kayıtları dışlıyor; son hareketi zamanla sıralıyor (`attendance_provider.dart:47–58,111–125`). İzin filtresinin mevcut bir provider testi var (`attendance_provider_test.dart:198–221`).
- Cihaz zenginleştirmesi benzersiz cihaz kimliklerini tek seferde topluyor (`cardReadingAudit.ts:13–29,128–146`); her okuma için aynı cihazı tekrar getirme yok.
- Liste `ListView.builder` ile tembel oluşturuluyor (`history_screen.dart:954–965`); locale tabanlı tarih metinleri ve hata lokalizasyonu mevcut (`147–152,278–279`).

## 4. Kanıtlı bulgular

Kesinlik etiketi **kaynak analizi**, belirtilen tetikleyicide kodun sonuç zincirinin görüldüğü fakat cihazda yeniden üretilmediği anlamına gelir. P0 gerektiren kanıt saptanmadı. Bulgular kalıcı veri kaybı veya üretim kesintisi yaşandığı iddiası değildir.

### AH-F01 — Takvim yerel günleri UTC anahtarlarıyla arıyor

**P1 · Kesinlik: kaynak analizi.** Kanıt: `history_screen.dart:289–295` yerel `DateTime(y,m,d)` anahtarı üretir; `352–354`, `407`, `451–454` gelen takvim gününü doğrudan map'te arar. Kilitli paket `PUB/table_calendar-3.2.0/lib/src/widgets/calendar_core.dart:262–266` görünen günleri `DateTime.utc` üretir; `table_calendar.dart:630–635,651–654` bu günü builder/eventLoader'a taşır; `shared/utils.dart:45–46` normalize işlemi de UTC'dir.

**Tetikleyici:** UTC+3 cihazda bu ayın önceki bir gününe ait gerçek kayıt yüklüyken “Bu Ay” sekmesini açıp o güne dokunmak. **Beklenen/mevcut:** Aynı takvim gününün kayıtları işaretlenmeli, renklenmeli ve açılmalıdır; yerel gece yarısı UTC gece yarısıyla aynı an/anahtar değildir, lookup boş döner ve `isNotEmpty` koşulu detay açılmasını engeller. **Etki:** Ana geçmiş takvimi veri varken boşmuş gibi görünür. **Kök neden/çözüm:** Takvim günü ile mutlak zamanı aynı map anahtarı sanmak; tüm map erişimlerini ortak `yyyy-MM-dd` gün anahtarına veya tutarlı UTC takvim normalizasyonuna çevirin. `toUtc()` kullanarak anı kaydırmak yerine yıl/ay/gün bileşenlerini normalize edin.

### AH-F02 — Eksik pencere tam dönem gibi sayılıyor; filtreli geçmiş ilerleyemiyor

**P1 · Kesinlik: kaynak analizi.** Kanıt: repository `13–17` yalnız limit yollar; provider `24,30,160–165,189–198` 50'lik artan pencere kullanır; backend `cardReadings.ts:1358–1367` yalnız `take(limit)` döndürür. History `573–603,653–661,678–694` bu pencereyi aylık/haftalık/genel toplam kabul eder. Filtre `1026–1048` sonradan uygulanır; yükleme `52–75` yalnız tüm kayıtlar scroll olayından ve `_displayLimit + 20 > provider.attendanceRecords.length` koşulundan tetiklenir. `938–946` filtre sonucu boşsa controller'ı olmayan boş widget'a geçer.

**Tetikleyici:** Ayda 80 kayıt olan çalışanda ilk 50 yüklüyken doğrudan istatistiği açmak; ardından ilk 50 içinde hiç olmayan veya 5 kaydı olan eski bir gün/cihazı filtrelemek. **Beklenen/mevcut:** Dönem toplamı ve arama tüm ilgili kayıtları kapsamalı veya eksik kapsam açıkça yazmalıdır; özetler sessizce düşük çıkar. Sıfır sonuçta ilerleme yolu yok; az sonuçta limit 20'de kalırken ham kayıt sayısı 50 olduğu için sonraki uzak sayfa koşulu gerçekleşmez. **Etki:** Kullanıcı gerçekte var olan geçmişi “yok” sanabilir; ekran kaydırıldıkça aylık sayıların değişmesi veri güvenini bozar. **Kök neden/çözüm:** Liste penceresi, filtre sorgusu ve aggregate kapsamı aynı tutulmuş. Çalışan oturumuyla korunan tarih/cihaz filtreli cursor API ve bağımsız tam dönem özeti tasarlayın; `hasMore/isDone` sunucudan gelsin. Her yeni sayfada genişleyen pencereyi bir dakikada bir yeniden çekmek yerine küçük canlı pencere ile eski sayfaları ayırın; sunucuda limit sınırı koyun. Bu performans riski kaynakta görülür, üretim gecikmesi ölçülmemiştir.

### AH-F03 — Ay/hafta/gün sınırları farklı ve hatalı

**P1 · Kesinlik: kaynak analizi.** Kanıt: `history_screen.dart:281–285,582–586` ay başlangıcından bir gün çıkararak karşılaştırır; `600–603` hafta başlangıcını `now` saatini koruyarak hesaplar; `1031–1040` gün başlangıcını dışlayan `isAfter` kullanır. Provider `47–56` aynı gece yarısı dışlamasını günlük statüye taşır.

**Tetikleyici:** Ayın önceki son günü 10:00 kaydı; çarşamba 15:00'te pazartesi 09:00 kaydı; seçilen gün tam 00:00 kaydı. **Beklenen/mevcut:** Aylık sayı önceki ayı dışlamalı, hafta pazartesi 00:00'dan başlamalı, gün başlangıcı dahil olmalıdır. Mevcut ay filtresi önceki ayın son gününün 00:00 sonrası kayıtlarını dahil eder; hafta pazartesi 15:00 öncesini dışlar; günlük filtre/durum tam gece yarısını kaybeder. **Etki:** Veri tam yüklense bile dönem sayıları yanlış; gece vardiyası hareketi filtrede kaybolabilir. **Kök neden/çözüm:** Ortak dönem yardımcıları yerine bağımsız karşılaştırmalar. Gün/hafta/ay için iş zaman diliminde `[başlangıç, sonraki başlangıç)` kullanın; `!isBefore(start) && isBefore(end)` ve sonraki takvim gününü bileşenlerden üretin. DST olan cihazlarda `Duration(days:1)` ile takvim günü üretiminin ayrıca doğrulanması gerekir.

### AH-F04 — Red ve bilinmeyen yön gerçek giriş/çıkış gibi sunuluyor

**P1 · Kesinlik: kaynak analizi.** Kanıt: model `attendance.dart:26–33,55–57` yön `exit` değilse giriş sayar. Backend şema `schema.ts:467–472` izin ve yönü opsiyonel tutar; gerçek backfill yazımı `cardReadings.ts:1718–1737` yön eklemez. Gerçek self-check-in `1440–1442` reddedilen kayıt da yazar. History kart/detay `1053–1058,1163–1177,1203–1226`, takvim `412–429`, istatistik `576–578,653–660,747–754` `granted` filtresi kullanmaz.

**Tetikleyici:** Reddedilen `entry` kaydı; yönü olmayan izinli Hik backfill kaydı; yalnız reddedilen denemesi olan gün. **Beklenen/mevcut:** Yön, erişim sonucu ve katılım birbirinden ayrılmalı; bilinmeyen yön açıkça belirsiz, red başarısız deneme görünmelidir. Şimdi red yeşil “giriş” olabilir ve aktif gün/giriş toplamına girer; yönsüz bütün hareketler giriş olur. **Etki:** Çalışan başarısız geçişi yoklama kabul edilmiş sanabilir; giriş/çıkış ve aktif gün sayıları şişer. **Kök neden/çözüm:** `direction != exit` varsayılanı ve tek bool sonucun UI'da kullanılmaması. Domain'de `entry/exit/unknown`, `granted/denied/unknown` ayrımını koruyun; ham denemeleri geçmişte gösterip katılım özetine yalnız uygun kayıtları alın. Backend zaten `source` ekler (`cardReadingAudit.ts:137`), mobil model bunu korumaz; PDKS ile aynı uygunluk politikasının gerekip gerekmediği açık karardır (bölüm 7).

### AH-F05 — Bekleyen refresh yanıtı logout/hesap değişimi sonrası eski veriyi geri yazabiliyor

**P1 · Kesinlik: kaynak analizi.** Kanıt: `attendance_provider.dart:231–237,256–279` kullanıcının varlığını yalnız istekten önce kontrol eder, `await` sonrası kimlik/generation kontrolü olmadan listeyi yazar. `128–148` logout'ta listeyi temizler, farklı non-null kullanıcıda temizlemez; generation koruması yalnız subscription callback'lerindedir (`163,170`). Client `convex_config.dart:119–127` isteğe başlangıçtaki session'ı koyar. Provider uygulama kökünde oturumlar arasında aynı instance olarak kullanılır (`main.dart:79–84`); logout kullanıcıyı temizler (`auth_provider.dart:113–125,142–147`).

**Tetikleyici:** A oturumunda manuel refresh veya QR sonrası sessiz refresh beklerken logout; ardından B girişi; A'ya ait önceden yetkilendirilmiş yanıtın gecikerek dönmesi. **Beklenen/mevcut:** Eski oturum yanıtı atılmalıdır; mevcut kod logout temizliğini geri alabilir veya B'nin listesini A'nın kayıtlarıyla değiştirebilir. **Etki:** Aynı cihazda oturumlar arasında geçici eski çalışan verisi görünme riski; backend'in başka kullanıcı verisi döndürmesi değildir. Gerçek sızıntı yaşandığı kanıtlanmamıştır. **Kök neden/çözüm:** Asenkron state yazımının sahiplik bağlamı eksik. Tüm liste/mutation sonrası refresh yollarına oturum epoch'u, istek sırası ve dispose kontrolü uygulayın; kullanıcı değişiminde liste/hata/yükleme durumunu anında sıfırlayın. Aynı kullanıcı refresh'leri de ters sırada tamamlanınca en eski snapshot yeniyi ezmemeli; küçük limitli yanıt büyük sayfayı daraltmamalıdır.

### AH-F06 — Zaman dilimi ve vardiya anlamı kaynaklar arasında ortak değil

**P2 · Kesinlik: kaynak analizi; iş beklentisi için açık karar.** Kanıt: model `55` zamanı cihazın yereline çevirir; provider `47–56,362–391` cihaz gününü ve sabit 09:00 geç eşiğini kullanır. History `418–429` 09:30 geç eşiği kullanır. Backend `cardReadingProcess.ts:54–72` iki yönlü cihazlarda Türkiye gününden önceki son hareketi yok sayıp `entry` üretir. Web detayı ise `cardReadings.ts:1477,1496,1505–1506` Türkiye aralığı, kaynak uygunluğu ve vardiya çözümleyicisi kullanır.

**Tetikleyici:** Aynı kayıtları UTC+3 ve başka timezone'da açmak; iki yönlü cihazda 23:00 girişinden sonra 01:00 çıkmak; 09:15 girişli günün farklı hesaplarını karşılaştırmak. **Beklenen/mevcut:** Ham olay saatinin hangi zaman diliminde sunulduğu ve “katılım/geç” ölçütünün ne olduğu açık olmalıdır. Şimdi gün cihaz ayarıyla değişir; iki yönlü gece hareketi yeni giriş olabilir; provider geç sayarken takvim normal renk verir. **Etki:** Gece vardiyası ve farklı saat dilimindeki kullanıcı yanlış yorumlayabilir. Provider'ın `daysPresent/daysLate/daysOnTime` getter'larına güncel mobil UI'da kullanım bulunmadı; bunlar bugün gösterilen kartlar gibi sunulmamıştır. Ayrıca “ilk giriş” helper'ı `366–378` yön filtresi yapmadığından salt çıkış günü de mevcut getter'a dahil olur. **Kök neden/çözüm:** Ham geçiş günlüğü ile vardiya özeti sınırı tanımsız. Önce işletme timezone'u/olay günü/vardiya günü sözleşmesini kararlaştırın; vardiya sonucu gerekiyorsa çalışan oturumuna özel server özeti kullanın. Yönü fiziksel okuyucu verisi veya vardiya boyunca süren açık hareketten çözün; sadece gece yarısı değişti diye giriş üretmeyin. Ham takvim olaylarını vardiya gününe taşımak otomatik doğru kabul edilmemelidir.

### AH-F07 — Geçmiş zaman yerine eklenme sırasına göre sınırlanıyor

**P2 · Kesinlik: kaynak analizi.** Kanıt: `cardReadings.ts:1363–1367`, `schema.ts:497` yalnız çalışan indeksi üzerinde azalan sıralama kullanır; indeks alanında `accessTime` yoktur. Convex'in depodaki rehberinde indeks sırası ve varsayılan `_creationTime` sırası açıklanmıştır. Gerçek offline IDE yazımı `cardReadings.ts:1028–1057` geçmiş olay zamanını yeni kayıtta saklar; Hik backfill `1724–1735` de geçmiş olay zamanı yazar. Mobil `_getFilteredRecords:1026–1050` ek zaman sıralaması yapmaz.

**Tetikleyici:** Bugünkü kayıtlardan sonra geçen aya ait 50'den fazla offline/backfill olayın içeri alınması. **Beklenen/mevcut:** Geçmiş son olay zamanına göre sıralanmalı ve ilk pencere en güncel olayları kapsamalıdır; yeni eklenen eski olaylar listenin başına geçip güncel olayları ilk 50'den çıkarabilir. **Etki:** Sıra şaşırtır; günlük durumun dayandığı kayıt penceresi de güncel hareketleri kaybedebilir. **Kök neden/çözüm:** Alma sırası geçmiş olay sırası yerine kullanılıyor. Çalışan+`accessTime` ve kararlı eşitlik sırası ile query/cursor tasarlayın. Sadece istemcide sıralamak ilk pencere dışında kalan doğru kaydı geri getirmez.

### AH-F08 — Cihaz filtresi/cihaz özeti ilk yükleme snapshot'ında kalıyor ve adları kimlik sayıyor

**P2 · Kesinlik: kaynak analizi.** Kanıt: `history_screen.dart:89–96` `_deviceList` yalnız `_loadData` bitiminde oluşturulur. Polling ve `loadMore` provider'ı değiştirir (`attendance_provider.dart:164–167`), cihaz listesini güncellemez. `history_screen.dart:776–777,1044–1047,1365–1375` filtre ve istatistik adı anahtar olarak kullanır; modelde gerçek `deviceId` var (`attendance.dart:6,52`).

**Tetikleyici:** İkinci sayfada veya yeni polling yanıtında ilk kez görülen cihaz; aynı isimli iki farklı cihaz. **Beklenen/mevcut:** Yeni cihaz filtrede/özetinde görünmeli; aynı isimliler ayrı kimliklerle seçilebilmelidir. Şimdi liste yenilenirken seçenekler eski kalır; aynı isimli cihazlar birleşir. **Etki:** Yüklü bazı hareketler için cihaz bazlı inceleme eksik/yanlış olur. **Kök neden/çözüm:** Türetilmiş veri ayrı mutable snapshot ve görünen ad domain anahtarı yapılmış. Seçenekleri güncel sorgu sonucundan/ayrı cihaz facet sözleşmesinden `deviceId` ile türetin; adı yalnız etiket yapın. Silinmiş cihazı bilinmeyen cihaz olarak koruyun.

### AH-F09 — Yükleme sırasında ekran kapanınca state güncellemesi korunmuyor; boş refresh yüzeyi yok

**P2 · Kesinlik: kaynak analizi.** Kanıt: `_loadData` `history_screen.dart:85–100` await sonrasında `mounted` kontrolünden önce `setState` çağırır; catch de yine `setState` yapar. Date picker `1301–1312` dönüşte state'in mounted olduğunu kontrol etmeden günceller. Boş liste `943–946` RefreshIndicator altına `Center/Column` (`986–1023`) koyar; dikey Scrollable yoktur. Takvim/istatistik `298,605` scroll view'larında refresh sarmalayıcısı yoktur.

**Tetikleyici:** Yavaş history isteği/date picker sürerken logout ile ekranın dispose olması; boş geçmişte aşağı çekmek. **Beklenen/mevcut:** Geç dönen UI işlemi sessizce bırakılmalı, boş listede kullanıcı yenileyebilmelidir. Şimdi dispose sonrası `setState` hatası yolu var ve boş görünüm pull-to-refresh üretemez. **Etki:** Hata gürültüsü ve boş/geçici eksik listeyi yenileyememe. **Kök neden/çözüm:** Await sonrası yaşam döngüsü guard'ı ve her durum için ortak scroll yüzeyi eksik. Her UI state yazımını mounted kontrolüyle koruyun; boş/dolu görünümde `AlwaysScrollableScrollPhysics` ile aynı refresh yüzeyini kullanın; sekmeler için görünür refresh eylemi ekleyin.

### AH-F10 — Polling düzelince eski hata nesnesi kalıyor ve başka işleme yanlış hata taşınabiliyor

**P2 · Kesinlik: kaynak analizi.** Kanıt: `attendance_provider.dart:214–216` hem `_lastError` hem mesajı yazar; başarılı subscription `164–167` yalnız mesajı siler. Yeni QR/quickUnlock işlemi `289–294,321–330` yine `_lastError` temizlemez; red/parse hatasında yalnız mesaj değişir. History `147–152` mesaj mevcutken varsa eski `lastError`ı lokalize etmeyi tercih eder. Logout `143–147` hata alanlarını temizlemez. Manuel liste yükleme `260–262` hataları temizler; dolayısıyla her girişte mutlaka hata görülür iddiası yoktur.

**Tetikleyici:** Polling network hatası → polling başarı → aynı provider'da quickUnlock reddi → history sekmesine dönmek. **Beklenen/mevcut:** Güncel red veya güncel yükleme durumu görünmelidir; UI eski network hatasını gösterebilir ve tüm tabları hata ekranıyla kapatır. **Etki:** Kullanıcı yanlış nedenle retry yapar; eski ama kullanılabilir geçmiş yerine tam sayfa hata gösterilir. **Kök neden/çözüm:** Birden çok operasyon ortak ve tutarsız temizlenen error state kullanıyor. Liste yenileme ve erişim eylemi sonuçlarını ayırın; başarıda hata nesnesini de temizleyin, auth değişiminde sıfırlayın; elde veri varsa güncellik uyarısıyla gösterin.

### AH-F11 — Sayfa sonu scroll callback'i dinleyen Provider okuması yapıyor

**P2 · Kesinlik: kaynak analizi; debug davranışı.** Kanıt: `history_screen.dart:52–60` scroll callback'inde `_getFilteredRecords()` çağırır; `1026–1028` içindeki `Provider.of<AttendanceProvider>(context)` varsayılan `listen:true` kullanır. Yerel `PUB/provider-6.1.5+1/lib/src/provider.dart:306–325` build dışı dinleyen okumayı assert ile reddeder.

**Tetikleyici:** Debug uygulamada “Tümü” listesini sayfa sonu eşiğine kaydırmak. **Beklenen/mevcut:** Sayfa artırımı normal çalışmalıdır; event callback'i build dışında olduğu için Provider assertion'ı oluşabilir ve o callback ilerlemez. **Etki:** Geliştirme/cihaz QA sırasında temel pagination akışı hata verir; release'te aynı assert çalışmadığından release çökmesi iddiası yoktur. **Kök neden/çözüm:** Hem build hem olay için kullanılan helper gizlice dinleyici kuruyor. Saf filtre fonksiyonuna listeyi argüman verin veya olay yolunda `context.read` kullanın; rebuild aboneliğini `Consumer` üzerinde tutun.

## 5. Geliştirme iş paketleri

S/M/L göreli mühendislik kapsamıdır; takvim/gün veya teslim sözü değildir. Çapraz modüllü backend değişiklikleri yalnız sonraki uygulama aşamasının önerisidir; bu audit bunları gerçekleştirmemiştir.

### AH-W01 — Takvim gün anahtarı ve dönem aralıklarını ortaklaştır

- **Bulgu/kapsam:** AH-F01, AH-F03; history, tarih yardımcıları, provider günlük penceresi.
- **Bağımlılık:** AH-W04'te işletme timezone kararının alınması; ilk düzeltme mevcut yerel takvim sözleşmesiyle de izole edilebilir.
- **Yapılacaklar:** Ortak gün anahtarı; `[start,end)` gün/hafta/ay yardımcıları; takvim map'inin bütün yazma/okuma yollarını aynı anahtara taşıma; saat kaynağını testte sabitleme.
- **Kabul:** UTC+3'te yüklü eski gün işaret, renk ve detayda aynı kayıtları gösterir; ayın önceki son günü dahil edilmez; pazartesi 00:00 dahildir; tam gece yarısı iki günden yalnız birinde görünür.
- **Anlamlı test:** Ay/yıl devri, şubat, pazartesi 09:00/15:00 karşılaştırması, 00:00 ve sonraki gün 00:00; takvim widget'ında güne dokunma; UTC+3/UTC ve DST günü cihaz matrisi.
- **Tahmin:** **M** — az dosya olsa da üç ayrı tüketicinin tarih anlamını ve widget callback'ini birlikte doğrulamak gerekir.

### AH-W02 — Filtreli cursor geçmiş ve bağımsız dönem özeti

- **Bulgu/kapsam:** AH-F02, AH-F07; çalışan oturumuna özel backend API, repository, provider, history listesi/istatistikleri.
- **Bağımlılık:** AH-W01 dönem sözleşmesi; AH-W03 hareket uygunluğu; AH-W05 istek sahipliği. Backend indeks/migrasyon gereksinimi uygulama planında ayrıca değerlendirilir.
- **Yapılacaklar:** Çalışan+olay zamanı sıralaması; kararlı cursor ve sınırlı sayfa büyüklüğü; server tarih/cihaz filtreleri; açık `isDone`; listeden bağımsız ay/hafta aggregate; küçük güncel pencerenin polling'i ve eski sayfa cache'i; loading/empty/exhausted/error ayrımı. Hiç eşleşmeyen ilk sayfada da arama devam edebilmeli.
- **Kabul:** 150 kayıtlı ayın toplamı ilk açılışta doğrudur ve kullanıcı scroll yaptığında değişmez; sadece eski sayfalarda bulunan tarih/cihaz sorgusu sonuç döndürür; backfill güncel olayları ilk sayfadan çıkarmaz; eşzamanlı yeni olayda ID tekrarı/kayıp olmaz; her network sayfası tanımlı üst sınırda kalır, eski sayfalar her polling'de yeniden indirilmez.
- **Anlamlı test:** 49/50/51/150 kayıt, tam 50'de tükenme, 0/5 filtre eşleşmesi, aynı zamanlı olaylar, arada yeni insert, eski offline batch, auth'suz/yanlış session, her istek için belge/byte sayısı ölçümü.
- **Tahmin:** **L** — API, indeks, canlı pencere ve aggregate tutarlılığı birlikte tasarlanır; kullanıcı başına gerçek hacim ölçülmeden gecikme hedefi uydurulmamalı.

### AH-W03 — Ham hareket, izin ve katılım durumunu ayır

- **Bulgu/kapsam:** AH-F04; Attendance modeli, kart/detay/takvim/istatistik; server özet sözleşmesi.
- **Bağımlılık:** PDKS uygunluk politikasının ürün/backend tarafından kararlaştırılması; AH-W02 özet API'si.
- **Yapılacaklar:** Nullable alanlarda bilinmeyeni koruyan tipler; reddedilen denemeler için ayrı görünüm; sadece uygun/izinli girişlerden katılım; kaynak bilgisini ihtiyaç ölçüsünde modelde koruma; parse hatasını boş başarıyla karıştırmama. `qrData` getter'ının gerçekte `cardNo` döndürdüğü (`attendance.dart:34`) dikkate alınarak detay etiketini doğru alanla eşleştirme.
- **Kabul:** Red kaydı görünür fakat kabul edilmiş giriş/aktif gün olmaz; yönsüz Hik kaydı kendiliğinden giriş olmaz; günlük durum ve history özeti aynı uygunluk sözleşmesini kullanır; “QR” etiketi altında sırf kart numarası gösterilmez.
- **Anlamlı test:** İzinli entry/exit, reddedilen entry/exit, eksik direction/status, yönsüz backfill, yalnız red olan gün, silinmiş cihaz, bozuk tek timestamp için belirlenen hata politikası; fixture testinin yanına kontrollü backend sorgu testi.
- **Tahmin:** **M** — alan değişikliği birkaç sunumu etkiler; eski kayıtların bilinmeyen durumunu geriye uyumlu tutmak gerekir.

### AH-W04 — İşletme timezone'u, vardiya ve gece yönü sözleşmesi

- **Bulgu/kapsam:** AH-F06; mobil tarih sunumu, kullanılmayan aylık getter'lar, backend yön resolver ve ileride çalışan özeti.
- **Bağımlılık:** Ürün kararı: ham olay günü mü, vardiya yoklaması mı; çalışan/proje timezone ve vardiya kaynağı; fiziksel okuyucu yön yetkinliği.
- **Yapılacaklar:** Ham olay saatini ve vardiya sonucunu ayrı tanımlama; sabit 09:00/09:30 eşiklerini kaldırma veya açık ürün kuralına bağlama; server vardiya sonuçlarını yetkili çalışan API'sine taşıma; gece yarısında toggle resetini inceleme; kullanılmayan hatalı getter'ları kaldırma veya uygun giriş filtresiyle düzeltme.
- **Kabul:** Onaylanmış iş kuralı dokümante edilir; aynı vardiya farklı cihaz timezone'unda aynı iş sonucunu verir; 23:00 entry/01:00 exit kapatılabilir; UI hangi timezone/gün türünü gösterdiğini belirtir; 09:15 için çelişen “normal/geç” sonucu kalmaz.
- **Anlamlı test:** Sabit entry/exit okuyucu, iki yönlü okuyucu, mola, eksik çıkış, iki güne/aya yayılan vardiya, vardiya değişimi, farklı timezone; PDKS ile karşılaştırmalı sentetik örnekler. Bütün bunlar henüz çalıştırılmadı.
- **Tahmin:** **L** — iş kuralı ve cihaz verisi bağımlılığı var; yalnız Flutter tarih formatı düzeltmesi değildir.

### AH-W05 — Oturum ve istek sahipliği, refresh/error state

- **Bulgu/kapsam:** AH-F05, AH-F10; provider'ın bütün async yazımları ve history hata sunumu.
- **Bağımlılık:** Auth modülünün session/epoch değişimi; AH-W02 istek/filter anahtarı.
- **Yapılacaklar:** Hesap/session değişimi ve dispose ile artan epoch; her istekte yakalanan epoch/filtre/limit ve istek sırası kontrolü; geç yanıtı bırakma; auth değişiminde state sıfırlama; liste ve mutation hata kanallarını ayırma; başarılı yanıtta `lastError`ı temizleme; eski listeyi güncellik uyarısıyla gösterme.
- **Kabul:** A yanıtı logout sonrası/B oturumunda görünmez; eski küçük-limit refresh yeni sayfayı ezmez; dispose sonrası notify yok; network hatası → başarı → erişim reddi sonrasında doğru hata görünür; çıkış/giriş eski kullanıcı hata/cihaz bilgisini taşımaz.
- **Anlamlı test:** Kontrollü Completer'larla A isteği → logout → B yanıtı → A yanıtı; iki refresh ters tamamlanma; loadMore ile manuel/sessiz refresh çakışması; subscription hazırlığı sırasında pause/dispose; auth süresi dolarken yükleme; hata iyileşme zinciri.
- **Tahmin:** **M** — backend yetki modelini değiştirmeden state makinesi ve yarış testleri gerekir.

### AH-W06 — Filtre/facet kimliği ve güvenilir ekran yaşam döngüsü

- **Bulgu/kapsam:** AH-F08, AH-F09, AH-F11; history ekranı ve türetilmiş filtre verisi.
- **Bağımlılık:** AH-W02 cihaz facet/kapsam kararı; AH-W05 yükleme state'i.
- **Yapılacaklar:** Cihazı `deviceId` ile seçme; güncel sonuçtan seçenek türetme; filtre helper'ını saf yapma; build dışı okumada dinlememe; await sonrası mounted kontrolü; boş/dolu scroll/refresh yüzeyi; her sekmede erişilebilir yenileme eylemi. Filtre değişiminde gösterim limitini ve scroll konumunu belirli biçimde sıfırlama.
- **Kabul:** Sonraki sayfadaki yeni cihaz seçilebilir, aynı adlı iki cihaz ayrıdır; debug scroll assertion üretmez; filtre sonucu boşken refresh çalışır; yavaş yükleme/picker sırasında logout herhangi bir dispose hatası üretmez; takvim ve özet güncellenebilir.
- **Anlamlı test:** Scroll ile gerçek threshold'a ulaşan history widget testi; 0/1/20 kayıt; cihaz eklenmesi/yeniden adlandırılması/silinmesi; picker açıkken rota kaldırma; yükleme sırasında logout; büyük yazı ve küçük cihazda refresh eylemi.
- **Tahmin:** **M** — bir ekranla sınırlı, fakat liste, dialog, filtre ve lifecycle etkileşimleri birlikte doğrulanmalı.

## 6. Manuel cihaz / E2E doğrulama matrisi

Tüm satırlar **planlandı, bu worker tarafından çalıştırılmadı**. Sentetik test hesapları ve kişisel veri içermeyen kontrollü fixture kullanın; üretime kayıt yazmadan önce ayrı test ortamı belirlenmelidir. Salt okuma auditinde aşağıdaki veri üretimi yapılmadı.

| Senaryo | Ortam / veri | Gözlemlenebilir kabul / kayıt |
| --- | --- | --- |
| Gerçek çalışan izolasyonu | İki test çalışanı, ayrı oturumlar, iOS + Android | Her sorgu kendi kayıtlarını döndürür; kullanıcı seçim argümanı yoktur; logout sonrası önceki liste görünmez. |
| Geç yanıt ve hesap değişimi | Kontrollü gecikmeli ağ; A → logout → B | Gecikmiş A yanıtı B state'ine yazılmaz; ağ zaman çizgisi ve maskelenmiş ID'lerle kanıt. |
| Takvim UTC eşlemesi | UTC+3 ve UTC; bu ay önceki gün | Liste/takvim işareti/gün detayı kayıt ID'leri eşleşir. |
| Gün/hafta/ay sınırı | 00:00, pazartesi sabahı, önceki ay sonu, yıl devri | Tam olarak tek döneme dahil olma; beklenen örnek sayılarıyla ekran sayıları eşleşir. |
| Dönem hacmi / filtre | 0/49/50/51/150 kayıt; eski sayfada tek cihaz/tarih | Uzak filtre bulunur, sonsuz spinner olmaz, aggregate scroll'dan bağımsızdır. |
| Offline/backfill | Güncel olaylardan sonra eski zamanlı batch | Olay zamanı sırası ve güncel ilk sayfa korunur. |
| İzin/yön | Granted/denied/unknown; entry/exit/unknown | Ham deneme görünür; katılım ve badge doğru; yönsüz veri uydurulmaz. |
| Gece vardiyası | 23:00 giriş, 01:00 çıkış, mola, iki yönlü cihaz | Onaylı vardiya sözleşmesine göre kapanış ve gün toplamı tutarlı; fiziksel okuyucu yönü ayrıca kontrol edilir. |
| Polling ve app yaşam döngüsü | Wi-Fi kesilmesi, uçak modu, arka plan/ön plan | Hata sonrası geri çekilme; dönüşte güncelleme; eski yanıt yok; eldeki veri erişilebilir. |
| QR sonrası tarihçe | Kontrollü backend test ortamı | Mutation sonucu ile yeni okuma ID'si/history aynı; denied başarılı katılım değildir. Fiziksel kapı hareketi ayrı kanıtlanır. |
| Refresh / ekran kapanışı | Boş liste, tüm sekmeler, yavaş istek/picker + logout | Pull/eylem çalışır; dispose/Provider assertion log'u oluşmaz. |
| Cihaz facet'i | Aynı isimli iki cihaz, ikinci sayfada yeni cihaz | Kimlikler ayrı; sayı ve filtre doğru; silinen cihaz hareketi kaybolmaz. |
| Ölçek / performans | Uzun geçmiş ve çok cihaz; ağ ölçümü | Sayfa başı kayıt/byte, sorgu süresi, polling toplamı ve rebuild ölçülür; kararlaştırılmış bütçe ile karşılaştırılır. Burada ölçülmüş SLA yoktur. |

## 7. Açık sorular ve kapsam dışında kalan doğrulamalar

1. “Geçmiş” ham erişim denemeleri mi, resmi yoklama/PDKS sonucu mu? `cardReadings` ham kaynak; web PDKS ayrıca uygunluk filtresi, izin/tatil, manuel kayıt ve vardiya verisi kullanıyor (`cardReadings.ts:1496,1505–1525`). Mobil özeti bordro doğruluğunda ilan etmek için bu fark kapatılmalı veya ürün dili sınırlandırılmalı.
2. İşletme zaman dilimi her projede Türkiye mi; çalışan seyahat ederken cihaz yereliyle gösterim isteniyor mu? Gösterim saati ile hesaplama günü ayrı karar olmalı.
3. 09:00/09:30 eşikleri gerçek iş kuralı mı, eski UI varsayımı mı? Gece vardiyasında gün ataması ve iki yönlü cihazın toggle reset politikası nedir?
4. Yön içermeyen geçmiş Hik olaylarından yönü güvenilir geri dolduracak okuyucu bilgisi var mı? Yoksa bilinmeyen olarak kalmalı; sırf sıraya bakarak kesin giriş denmemeli.
5. Kullanıcı başına beklenen en uzun geçmiş, günlük olay hacmi, sayfa üst sınırı ve aggregate gecikme bütçesi nedir? Mevcut koddaki büyüyen limit için ölçülmüş üretim sorunu iddiası yoktur.
6. “Tümü” bütün tarihçe mi yoksa son hareketler mi? Güncel ay takvimi dışındaki eski ayları gezme ve tarih aralığı seçimi bekleniyor mu? Bunların olmaması mevcut kaynakla kanıtlı capability sınırıdır; tek başına bug diye sayılmadı.
7. Aynı cihazı paylaşan çalışanlar, aynı kullanıcıda yeniden oturum açma ve session yenileme senaryoları auth ekibiyle nasıl modelleniyor? AH-F05 koruması salt kullanıcı ID'sine bağlı kalmamalı.

Bu raporun kabulü kaynak auditinin tamamlanmasıdır; yukarıdaki iş paketleri uygulanmış veya cihaz matrisi geçmiş kabul edilmemelidir. Yalnız bu rapor dosyası yazılmıştır.
