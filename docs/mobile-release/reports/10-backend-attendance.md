# 10 — Mobil attendance backend teslimi

19 Ekim 2026. Yeni gerçek sorgular uygulandı; yalnız öneri/audit teslimi değildir. Değişiklikler mevcut kirli ağacı korur ve bu worker yalnız aşağıdaki yeni dosyalara yazmıştır. Canlı backend deployment, Flutter/native build, panel testi veya üretim verisi değişikliği yapılmadı.

## Uygulanan davranış

- `mobileAttendance:listPage`: çalışan oturumuyla kendi ham erişim geçmişini olay zamanına göre getirir; tarih ve cihaz filtresi veritabanı indeksinde uygulanır. Artan limitli tekrar-fetch yerine sabit boyutlu cursor sayfaları vardır.
- `mobileAttendance:summary`: liste sayfasından bağımsız bütün istenen dönem üzerinde ham hareket özeti hesaplar. 150 kayıtlı sentetik ayda ilk 50 kayıt yüklüyken ve arşivin tamamı yüklendikten sonra aynı 75 giriş / 75 çıkış / 15 girişli gün sonucunu verir.
- Her iki endpoint gerçek `employeeAuthedQuery` kullanır. `employeeId` veya `projectId` yetki argümanı kabul etmez; çalışan ve proje oturumdan çözülür. A/B izolasyonu, geçersiz oturum, pasif çalışan ve istemciden kimlik ekleme denemesi gerçek wrapper ile test edilir.
- Çalışanın orphan/foreign cihaz ilişkili kendi geçmiş kaydı kaybolmaz. Zenginleştirilmiş `device` yalnız çalışanın mevcut projesindeki cihaz için döner; silinmiş/yabancı/projesiz ilişkide `null` olur. Yabancı/silinmiş cihazla filtre `DEVICE_NOT_FOUND` üretir.

## API sözleşmesi

Çalışan transport'u mevcut sözleşmedeki `sessionToken` alanını ekler. Aşağıdaki parametreler bunun dışındaki alanlardır; camelCase kayıt alanları korunur.

| Endpoint | Parametreler | Dönüş |
| --- | --- | --- |
| `mobileAttendance:listPage` | `cursor?: string \| null`, `numItems?: number`, `startDate?: YYYY-MM-DD`, `endDate?: YYYY-MM-DD`, `deviceId?: Id<"devices">` | `{page, isDone, continueCursor}`; `page` mevcut cardReading alanları + mevcut `source` etiketi + nullable minimal `device` DTO |
| `mobileAttendance:summary` | `startDate: YYYY-MM-DD`, `endDate: YYYY-MM-DD` | `{startDate,endDate,timeZone:"Europe/Istanbul",generatedAt,days,totals}` |

Tarih aralığı iki uç dahil Türkiye işletme takvim günüdür; sorgu sınırları UTC olarak `[startDate 00:00 +03:00, endDate sonrası gün 00:00 +03:00)` biçimindedir. Eksik başlangıç/bitiş liste sorgusunda tek taraflı sınıra izin verir. Gerçek takvim dışı gün, ters aralık veya 1–100 dışında/tamsayı olmayan sayfa boyutu `INVALID_ARGUMENT` döndürür. Varsayılan sayfa boyutu 50'dir.

Cursor employee/proje/başlangıç/bitiş/cihaz bağlamını içerir ve tekrar kullanımda aynı bağlam aranır; iç indeks anahtarının prefix, tür ve okuma kimliği de doğrulanır. Her sorgunun gerçek DB sınırı ayrıca `ctx.employee._id` kullanır; cursor bir yetki belgesi değildir. Sıralama `accessTime DESC`, `_creationTime DESC`, `_id DESC` ile kararlıdır; eşit zamanlı kayıtlar kaybolmaz/çoğalmaz. İlk sayfanın employee receive-time watermark'ı yeni backfill kayıtlarını mevcut arşiv gezintisine katmaz; yenileme yeni snapshot başlatır. Bu, tarihî doküman içeriklerini donduran kalıcı snapshot değildir; sonradan silinmiş/güncellenmiş kayıtlar hâlâ mevcut DB durumunu yansıtır.

`isDone` tek bitiş göstergesidir. Okuma/byte bütçesi yüzünden kısa veya **boş** sayfa `isDone:false` ile gelebilir; `continueCursor` ilerler ve istemci devam etmelidir. Terminal cursor tekrarlandığında boş bitmiş sayfa döner. Bağlam değişimi/bozuk cursor `INVALID_CURSOR` döndürür.

`days` aralıktaki **bütün günleri**, kayıtsız günlerde sıfırlarla içerir; bu sözleşme 03-attendance-data sahibine iletildi. Gün alanları: `date`, `entryCount`, `exitCount`, `deniedCount`, `unknownCount`, nullable `firstEntry`/`lastEntry`/`lastExit`, `lastDirection: entry|exit|unknown`. `totals` dört sayacın toplamı ve en az bir uygun giriş bulunan gün sayısı `presentDays` içerir. `generatedAt` sunucu ISO zamanıdır.

Uygun katılım: `accessStatus === izin_verildi`, bilinen `entry|exit`, çalışanın mevcut projesiyle aynı kayıt projesi ve ortak `isPdksEligibleReading` uygunluğu. Ret ayrı sayılır ve son yönü değiştirmez; eksik izin/yön, kanıtlanmamış/uygunsuz kaynak veya proje tutarsızlığı `unknownCount` olur. Sonraki belirsiz hareket `lastDirection:unknown` yapar; sonraki uygun hareket yeniden yön belirler. Çıkıştan ibaret gün `presentDays` artırmaz. Dönem içinde indeksle bulunan bozuk kayıt zamanı sessizce atılmaz: `SUMMARY_INVALID_DATA` üretir.

Bu **ham takvim hareket özeti**dir. `pdksWorkDay`, vardiya resolver ve `computePdksDay` incelendi; vardiya başlangıç gününe taşıma, gece eşleştirme, ücret, çalışma süresi, izin ve geç kalma sonucu bu DTO'nun anlamı değildir. Örneğin 23:00 giriş / ertesi gün 01:00 çıkış iki ayrı takvim gününde kalır. Keyfî 09:00/09:30 geç eşiği eklenmedi. `pdksSource` politikası ortak tutulur; mevcut legacy manual/mobile kaynakları bu ortak politika uygun sayıyorsa uygunluğunu korur. 11-backend-access sahibinin mobil/manual hareket üretimini kapatan yeni yazıcı davranışı bu worker tarafından değiştirilmedi; tarihî kayıt migrasyonu yapılmadı.

## Sınırlar ve indeks bağımlılıkları

| İşlem | Sınır |
| --- | --- |
| Liste | Yanıtta en fazla 100 okuma; bir sayfa taramasında en fazla 1000 kayıt veya 1 MiB byte eşiği; önce ulaşılana kadar |
| Liste ek okumaları | Auth wrapper okumaları, ilk sayfada 1 employee receive-time watermark kaydı, filtre varsa 1 cihaz ve en fazla sayfadaki benzersiz cihaz sayısı kadar enrichment okuması |
| Özet | En fazla 93 dahil takvim günü; en fazla 10.001 kaydı / 8 MiB byte eşiğini tarayarak 10.000 üst sınırını saptar |
| Özet taşması | 93 günden büyük aralık, 10.000 üstü kayıt veya byte bütçesinde bitmeyen aralık `ConvexError.data.code = SUMMARY_TOO_LARGE`; kesilmiş toplam başarı olarak dönmez |

Byte eşikleri veri tarama eşikleridir; son okunan tek doküman eşik üstüne taşıyabilir. Auth/watermark/device okumaları liste tarama bütçesine dahil değildir. Listede beklenen toplam ek belge sayısı sabittir veya sayfa boyutuyla sınırlıdır; arşiv sayısı arttıkça canlı pencere büyümez.

Yeni `cardReadings.by_employee_accessTime = [employeeId,accessTime]` ihtiyacı 09-backend-auth şema sahibine iletildi ve onun değişikliğinde mevcut. Cihaz filtresi için zaten bulunan `by_employee_device_time = [employeeId,deviceId,accessTime]` tekrar kullanıldı. Bu worker `schema.ts`, `cardReadings.ts`, generated API, paket manifesti veya kilit dosyasını değiştirmedi. Root codegen/deployment yeni endpoint'leri ve indeksi birlikte yayımlamalıdır.

## Test ve kontrol kanıtı

`convex/mobileAttendance.test.ts` içindeki 13 test `convex-test` + edge-runtime + gerçek schema/employee wrapper ile geçiyor; wrapper veya DB query davranışı mock'lanmadı. Bağımlılıklar koordinatörün yüklediği mevcut test altyapısından kullanıldı, yeni dependency eklenmedi.

Kapsam: A/B oturum ve metadata izolasyonu; employee argüman enjeksiyonu; eşit olay zamanı ve receive-time backfill; cursor tekrarı/terminal cursor/kimlik-proje-filtre değişimi/bozuk cursor; eski cihaz filtresi; tam Türkiye gece yarısı; 1001 yeni backfill sırasında boş ama devam eden sınırlı sayfa; byte bütçesinde devam eden kısa sayfalar; 150 kayıt/50 canlı pencere ve bağımsız özet; ret/eksik yön/eksik izin/biometrik/bilinmeyen kaynak; gece hareketi ve sıfır gün; son belirsiz hareket; bozuk in-range timestamp; artık gün/ters aralık/93 gün sınırı; **10.000 kabul, 10.001 açık taşma**.

Son çalıştırılan `node_modules/.bin/vitest run convex/mobileAttendance.test.ts --reporter verbose --silent=false`: **13/13 geçti**, toplam test süresi 526 ms, suite 836 ms. Aynı çalıştırmadaki 150 kayıtlı sentetik fixture: canlı baş sayfa arşiv öncesi/sonrası **50 kayıt / 22.805 JSON byte**; 31 günlük özet **6.156 JSON byte**, tek özet çağrısı **8,35 ms**. Bunlar yerel bellek içi fixture ölçümleridir; üretim ağı/backend performansı değildir ve kimlik uzunlukları/süreler çalıştırmaya göre değişebilir.

`node_modules/.bin/eslint convex/mobileAttendance.ts convex/lib/mobileAttendance.ts convex/mobileAttendance.test.ts`: geçti, çıktı yok. Scoped TypeScript komutu `tsc --ignoreConfig --noEmit --strict --skipLibCheck --target esnext --module esnext --moduleResolution bundler --types vite/client,node` bu üç dosya üzerinde çalıştırıldı: kendi dosyalarında hata yok; generated API üzerinden okunan başka sahibin `convex/lib/mobileAccess.ts` dosyasında devam eden geliştirme kaynaklı inference/schema alan hataları yüzünden bütün komut exit 2 verdi. İlgili sahibine bildirildi; root final TS kontrolü gerekir. İlk denemelerde CLI `--ignoreConfig` ve Node type seçenekleri düzeltilerek kendi range narrowing hatası giderildi; bu denemeler temiz proje kontrolü diye sunulmuyor.

## Audit kapanışı ve açık sınırlar

- **MOB-10 backend / AH-F02, AH-F07:** gerçek olay zamanı, server filtreleri, bounded cursor ve bağımsız tam dönem özeti uygulandı ve test edildi.
- **MOB-11 backend dönem sözleşmesi / AH-F03, AH-F06, HOME-F05 ilgili kısmı:** dahil Türkiye takvim günleri ve gece yarısı sınırı uygulandı; ham takvim ile vardiya günü ayrımı açık. Mobil takvim callback/rendering ve vardiya tabanlı resmî sonuç bu dosyaların işi değildir.
- **MOB-12 backend / AH-F04, HOME-F04, NET-F09 ilgili kısmı:** uygun giriş/çıkış, ret/bilinmeyen ayrımı, son belirsiz durum ve tamlık hataları uygulandı. UI yükleme/stale/error ve hesap nesli davranışının bütün modül kapanışı mobil sahiplerin testlerine bağlıdır.
- **MOB-05 dar metadata savunması:** yeni endpoint'lerde cihaz tenant koruması uygulandı; eski uyumluluk endpoint'i bu worker sahipliği dışında kaldı.

Yeni endpoint'ler read-only olduğundan üretim verisi geçişi gerekmez. Mobilin eski API'ye dönmesi geri alma seçeneğidir fakat eski audit kusurlarını geri getirir; yeni endpoint'leri devreden çıkarmak veri silmez.

Açık entegrasyon/release işleri: koordinatörün final codegen + bütünleşik TS/lint/Flutter kontrolleri; staging employee HTTP 560/typed-error ve mobil ekran uçtan uca testi; index + endpoint deployment; gerçek cihaz/panel ve üretim yük kanıtı. Signing/mağaza kimlikleri bu read-only backend kapsamının dışında ve bu worker tarafından doğrulanmadı. Geçmiş event zamanlarının mevcut yazıcılardaki canonical UTC ISO sözleşmesi indeks aralığının dayanağıdır; tarihî tüm bozuk/out-of-range timestamp verisini tarayan migration bu teslimde yoktur.

## Değişen dosyalar

1. `convex/mobileAttendance.ts`
2. `convex/lib/mobileAttendance.ts`
3. `convex/mobileAttendance.test.ts`
4. `docs/mobile-release/reports/10-backend-attendance.md`

API belirsizlikleri için kullanılan birincil belgeler: [Convex indeks sıralaması](https://docs.convex.dev/database/reading-data/indexes/), [Convex pagination sınırları](https://docs.convex.dev/api/interfaces/server.PaginationOptions), [convex-helpers stream API](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md). Gerçek davranış ayrıca kurulu `convex-helpers/server/stream.ts` ve gerçek wrapper testleriyle doğrulandı; güncel sürüm iddiası yapılmadı.
