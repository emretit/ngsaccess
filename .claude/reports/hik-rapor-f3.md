# Hik raporları Faz 3 — Aylık Durum renkli Excel

Aylık Durum Excel'i kişi başına tek satır, ayın günleri ve sağda toplamlar içeren renkli matris üretir; yanında Lejant sayfası bulunur. Departman başlıkları, iki satırlık gün başlıkları, hücre notları, dondurma ve A4 yatay baskı ayarları eklendi. Günlük kodlar ve mevcut toplam değerleri korunur; ekranda/CSV/PDF'de yalnız isteğe bağlı Erken çıkış (gün) kolonu eklenir.

## Yapılanlar

- `src/lib/reports/excel/statusMatrix.ts:5`: soluk DV/İZN/HT/RT/? dolguları, siyah metin ve turuncu kalın istisna rengi.
- `src/lib/reports/excel/statusMatrix.ts:9`: çalışılan, geç, erken çıkış, devamsız, izinli, hafta tatili, resmî tatil, inceleme, toplam süre ve fazla mesai kolonları; `row.attendance` ve `row.totals` doğrudan kullanılır, yeniden sayım yapılmaz. Süreler S:DD metnidir.
- `src/lib/reports/excel/statusMatrix.ts:21`: kod/renk anlamları, turuncu kalın, Manuel notu ve süre açıklamalarından oluşan özel Lejant.
- `src/lib/reports/excel/statusMatrix.ts:36`: aylık hücre `classification` alanını ortak `DAY_FILLS` renklerine bağlayan yerel başlık yardımcısı; ortak `dayFill` yalnız `DailyCell.detail` kabul ettiğinden ortak dosya değiştirilmedi. Tatil > yarım gün tatil > hafta tatili önceliği; veri yoksa takvim hafta sonu dolgusu.
- `src/lib/reports/excel/statusMatrix.ts:44`: Aylık Durum sayfası, güvenli proje/dönem/İstanbul saati üst bilgisi, gg.aa + Türkçe kısa gün, ilk üç kolon ve dört başlık satırı dondurma, yinelenen 1:4 başlıkları ve A4 yatay fitToWidth=1.
- `src/lib/reports/excel/statusMatrix.ts:78`: Türkçe departman/ad sırası, tüm genişlikte birleşik departman başlıkları, kişi başına tek satır, ince kenarlıklar. Tüm metin hücreleri ortak setCell/safeCell formül nötrleştirme yolundan geçer.
- `src/lib/reports/excel/statusMatrix.ts:90`: günlük bordro kodu korunur; future/noData/eksik tarih —, incomplete ?. Geç/erken N kodu değiştirilmez, turuncu kalın yazı ve Geç / Erken çıkış / Geç + erken çıkış notları; manuel günlere Manuel notu.
- `src/lib/reports/registry.ts:75`: yalnız MONTHLY_TOTALS dizisine varsayılan gizli `earlyExitDays` kolonu eklendi; `row.attendance.earlyExitDays` kullanılır. Aylık Durum ve aynı diziyi tam kullanan Aylık Çalışma Süresi etkilenir; diğer rapor girişleri değiştirilmedi.

## Testler

- `src/lib/reports/excel/statusMatrix.test.ts:50`: mock kullanmadan gerçek ExcelJS oluşturma → xlsx yazma → yeniden açma. İki sayfa adı, 31 gün/tam gün sırası ve Türkçe kısa günler, departman birleşimi/sırası, '=' ile başlayan ad/projenin nötrleşmesi, countAttendance ile aynı 8 toplam, kaynak dakika toplamı, donma, baskı ve başlık dolguları.
- `src/lib/reports/excel/statusMatrix.test.ts:77`: DV/İZN/HT/RT/? renkleri ve siyah yazı, geç/erken/birlikte notları, Manuel birleşik ve tek notu, dolgusuz N, future/noData/eksik tarih, Lejant kodları ve turuncu kalın örnek.
- `src/lib/reports/excel/statusMatrix.test.ts:101`: kaynak toplamın yeniden hesaplanmadan korunması; boş raporda da 31 gün başlıkları, meta.days olmadığında dönemden gün üretme.
- `src/lib/reports/excel/statusMatrix.test.ts:115`: başka raporda ortak eski düz tablo düzeninin, dakika eş kolonlarının ve değerlerinin korunması.
- `src/lib/reports/registry.test.ts:77`: iki aylık matriste erken çıkış kolonunun isteğe bağlı/gizli oluşu ve doğru sayımı; diğer raporlarda kolon yapısının korunması.

## Kapılar

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: geçti (0).
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: geçti (0).
- `node_modules/.bin/eslint src/lib/reports/excel/statusMatrix.ts src/lib/reports/excel/statusMatrix.test.ts src/lib/reports/registry.ts src/lib/reports/registry.test.ts`: geçti (0).
- `node_modules/.bin/vitest run src/lib/reports/excel/statusMatrix.test.ts src/lib/reports/registry.test.ts src/lib/reports/excel.test.ts`: 3 dosya, 11/11 geçti.
- Tam `node_modules/.bin/vitest run`: Son tekrar koşusunda 395 dosyadan 394 geçti; 4484 testten 4483 geçti (28,91 sn; paralel Faz 4 testleri de koşuya katıldı). Tek kırmızı `src/lib/reports/personMonthExcel.test.ts:75`: Faz 2'nin “creates isolated flat fallbacks plus a legend for subsequent phases” testi Faz 4 kişi sayfası için hâlâ Rapor bekliyor; yeni Faz 3/4 özel düzenlerini reddeden eski beklenti. Koordinatöre bildirildi, ownership dışında olduğundan değiştirilmedi; koordinatör bu testi güncelleyeceğini onayladı. ShiftPlans dahil diğer testler bu koşuda geçti.
- Sahip olunan dosyalarda `git diff --check`: temiz.
- Convex dosyası değiştirilmediği için find-node-leak gerekmedi.

## Bilinçli bırakılanlar ve kullanıcı farkı

Kullanıcı “Excel (renkli durum tablosu)” indirdiğinde Aylık Durum + Lejant sayfalarını, departman gruplarını, günlük renkli bordro kodlarını ve sağda erken çıkış dahil tüm toplamları görür. “Tek sayfa” tek matris çalışma sayfasıdır; çok kişi birden fazla basılı sayfaya yayılır, genişlik tek sayfaya sığdırılır. Ekran tablosu ve CSV/PDF düzeni korunur; Erken çıkış (gün) kolon seçicisinden açılabilir ve seçilen kolonlar mevcut export yoluna gider. Ortak yardımcılar, personSheets, Convex, paketler ve veri tabanı değiştirilmedi; commit/deploy yapılmadı. Eski Faz 2 fallback testi koordinatöre bırakıldı.
