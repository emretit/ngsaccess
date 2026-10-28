# Hik raporları Faz 2 — Aylık Özet

Aylık Özet ve Kişi Devam Dökümü, mevcut matrix sorgusundan kişi başına aylık özet tablo üretir; ay seçimi ayın ilk/son gününü kullanır. Aylık Özet Excel'i departman grupları, kişi blokları, gün kolonları, toplamlar ve Lejant sayfası içerir. Convex dosyaları, hesaplanan günlük çalışma/fazla mesai değerleri ve Faz 1 mola davranışı değiştirilmedi.

## Uygulama

- `src/lib/reports/personMonth.ts:3`: PersonMonthTotals/PersonMonthReportRow; `:17`: toplamlar; `:45`: matrix satırlarından kişi satırları. `rows.ts:20`: ReportRow birliğine personMonth eklendi. Günlük süreler yeniden hesaplanmaz, mevcut hücre değerleri toplanır.
- Sayım kararı: future/noData/notEmployed ve noShift toplamlardan dışarıda. countAttendance gibi N çalışılan, DV devamsız, İZN izinli, yalnız hafta içi geç/erken sayılır; incomplete yalnız inceleme sayısına gider, diğer devam sayılarına girmez. İnceleme gününün mevcut ölçülmüş kısmi dakika değerleri süre/mola toplamında korunur; takvim türü sayıları birbirini dışlayan hafta içi/hafta sonu/tatil sayılarıdır (yarım gün tatil bir takvim günüdür).
- `src/lib/reports/registry.ts:16`, `:55`, `:102`: excelLayout/rowsMode alanları, 15 özet kolon ve iki yeni rapor; toplam rapor sayısı 18. Aylık Durum statusMatrix yoluna bağlandı. Süreler numeric minutesValue taşır; yeni özet CSV'sinde dakika eş kolonları eklenir.
- `src/components/reports/ReportScreen.tsx:39`: ay seçicisi artık filters.includes('month') ile çalışır. Önceden aylıkPayroll kullanan raporlar korunur, yeni pdksMatrix raporları mevcut dailyReportArgs ile sorgulanır; query.ts değişikliği gerekmedi.
- `src/components/reports/ReportResults.tsx:25`: personMonth satırları ve gün listesi; `ReportPage.tsx:43`: gün listesinin export metaya aktarılması; `:72`: özel Excel menü etiketleri. CSV/PDF özet tabloyu kullanır; blok önizlemesi eklenmedi.
- `src/lib/reports/export.ts:120`: üç düzenin dinamik import dağıtımı; `:133`: eski düz tablo çıktısı addTableSheet olarak ayrıldı. ExcelJS/jspdf runtime importları dinamik kaldı.
- `src/lib/reports/excel/common.ts:16`: güvenli hücre yazımı; `:25`: gün türü dolguları; `:29`: gg.aa + Türkçe kısa gün; `:41`: A4 yatay/fitToWidth/yinelenen başlıklar; başlık/izin etiketi/süre/Lejant yardımcıları.
- `src/lib/reports/excel/personBlocks.ts:41`: Aylık Özet sayfası. Departmana ve ada sıralama, departman birleşik satırı, iki katmanlı gün başlığı, kişi başına 1–6 çift satırı, son çiftte +k çift, A–C ve tüm toplam kolonlarında dikey birleştirme, izin türlerine göre değişken toplam kolonları, dondurulmuş ilk dört kolon/başlıklar, ince kenarlık ve gün türü dolguları. Tüm yeni metin hücreleri neutralizeSpreadsheetFormula yolundan geçer.
- `src/lib/reports/excel/personSheets.ts:5`, `statusMatrix.ts:5`: Faz 4/3 için bağımsız modüller; bu fazın istediği gibi addTableSheet + addLegendSheet gövdeleri. Bunlar henüz kişi başına sayfa/renkli matris üretmez; sonraki fazlar yalnız kendi modülünü doldurabilir.

## Testler

- `src/lib/reports/personMonth.test.ts:5`: çalışma/süre/fazla mesai/geç/erken/devamsız/izin türü/tatil çalışması/mola/inceleme, future/noData ve istihdam dışı günlerin dışlanması; `:27`: yarım gün tatil ve bilinmeyen izin türü.
- `src/lib/reports/personMonthExcel.test.ts:23`: mock kullanmadan gerçek ExcelJS ile oluşturma → xlsx yazma → yeniden açma. Sayfa adları, gün başlığı, departman satırı, blok etiketleri, iki çift, null uç, dikey birleşimler, toplam ve izin değerleri, hafta sonu dolgusu, kenarlık, donma, baskı ayarı ve '=' ile başlayan adın nötrleştirilmesi doğrulandı.
- Aynı test `:57`: 6 çift üst sınırı ve +2 çift; `:71`: Faz 3/4 düz tablo + Lejant yolları.
- `src/components/reports/ReportPage.test.tsx:164`: stale from/to yerine seçilen 2028-02 ayının 01–29 aralığı + includePunches matrix sorgusu; `:173`: tek kişi satırı ve üç Excel menü etiketi.
- `src/lib/reports/registry.test.ts:66`: yeni raporların veri/düzen/filtre/süre kolonları; query.test.ts yeni includePunches tanımlarını kapsar.
- `src/lib/reports/excel.test.ts` DEĞİŞMEDEN yeşil. Karakterizasyon veya Convex test beklentisi değiştirilmedi.

## Kapılar

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: geçti (0).
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: geçti (0).
- `node_modules/.bin/eslint` (bu fazda değişen TS/TSX dosyaları ve yeni excel klasörü): geçti (0).
- `node_modules/.bin/vitest run src/lib/reports src/components/reports`: 13 dosya, 83/83 test geçti.
- Tam `node_modules/.bin/vitest run`: 393 dosyadan 392'si, 4475 testten 4474'ü geçti; 54,05 saniye. Tek kırmızı: convex/shiftPlans.test.ts:38, 300 kişi × 20 tarihsel izin fixture'ı 5000 ms zaman sınırını aşıyor (8217 ms). Faz 1'de de tekrar eden kapsam dışı hata; web rapor kodunu çağırmaz, dokunulmadı.
- `git diff --check`: temiz. Convex değiştirilmediği için find-node-leak gerekmiyor.

## Hacim notu (2.5)

Spec'teki “pdksTableQuery.ts okumadan (yazmadan)” talimatına uyarak o dosya okunmadı/değiştirilmedi; kod içi kesin limitler ve canlı DB ölçümü doğrulanmadı. Aşağıdaki değerler kişisel veri kullanmayan sentetik JSON hücresi için Buffer.byteLength ile hesaplanan alt sınır tahminidir (tek vardiya, çift/boşluk/okutma listeleri dahil; satır özetleri, detailedLogs, vardiya segmentleri ve sorgunun dönem uzatmaları hariç).

| Günlük okutma | Hücre başı bayt | 31 gün × 150 kişi hücreleri | En az kaynak okutma |
| --- | ---: | ---: | ---: |
| 4 | 780 | 3.627.000 (~3,46 MiB) | 18.600 |
| 12 | 1.370 | 6.370.500 (~6,08 MiB) | 55.800 |
| 24 | 2.252 | 10.471.800 (~9,99 MiB) | 111.600 |

Genel formül hücre baytı × 31 × N; okutma okuması en az 31 × N × günlük okutma. Çalışan/izin/vardiya/politika okumaları ve dönem hesabının ek günleri bu sayılara eklenir; 24 okutma gösterim sınırı veritabanından okunacak gerçek kayıt sayısını sınırlamaz. Özellikle 150 kişide orta/yüksek okutma yoğunluğu çok MB cevap ve on binlerce okuma üretir; tek sorgunun güvenli kalacağı varsayılmamalı.

Öneri (UYGULANMADI): bu iki aylık okutmalı raporda departman seçili değilken “Büyük projelerde departman seçerek raporu daraltın.” bilgisi gösterilmesi ve departman başına indirme. Bu fazda yeni polling, sorgu, bölümleme, uyarı veya sunucu limiti eklenmedi.

## Bilinçli bırakılanlar ve kullanıcı farkı

Kullanıcı Aylık Özet'te kişi toplamlarını ve kişi blokları Excel'ini görür; Faz 3/4 tamamlanana kadar Kişi Devam Dökümü ve Aylık Durum özel Excel yolları düz tablo + Lejant üretir. Bloklar aynı çalışma sayfasında, çok kişi için birden fazla basılı sayfaya yayılır (tek basılı sayfaya küçültme yapılmaz). Mola, çalışma kesintisi ve fazla mesai kuralları aynı; biyometrik türev alan eklenmedi; paket/şema/DB/commit/deploy işlemi yapılmadı.
