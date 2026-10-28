# Hik raporları Faz 4 — Kişi Devam Dökümü

Kişi Devam Dökümü Excel'i artık filtrelenmiş her kişi için gerçek bir sayfa ve en sonda Lejant üretir. Her sayfada sarı bilgi bandı, gün türü özeti, izin türü özeti ve günlük okutma/süre/durum dökümü bulunur. Yalnız personSheets.ts ve yanındaki yeni test yazıldı; Convex, registry, ortak yardımcılar ve paralel Faz 3 dosyalarına dokunulmadı.

## Yapılanlar

- `src/lib/reports/excel/personSheets.ts:15`: sayfa adları yasak karakter/kontrol karakteri ve kenar apostroflarından temizlenir; 31 UTF-16 karaktere kısaltılır, büyük/küçük harf çakışmaları (2), (3) ile çözülür. Boş/History adları Kişi N olur, Lejant adı önceden ayrılır. Kesilen surrogate çifti bırakılmaz.
- `:45`: Hafta içi/Hafta sonu/Resmî tatil/Toplam özeti ve Geç/Erken/Devamsız/Mola/İnceleme yan bloğu. Genel süre ve sayaçlar PersonMonthTotals'tan, tür bazında değerler aynı personMonthTotals fonksiyonuna süzülmüş günler verilerek alınır; günlük çalışma/fazla mesai yeniden hesaplanmaz. “Çalışılan gün” genel özeti normal çalışılan gün + hafta sonu/tatilde çalışılan gün toplamıdır; böylece tür satırları genel toplama ulaşır.
- `:71`: günlük 17 kolon; üç çift, eksik uç —, üçüncü çıkış hücresinde +k çift, esnek plan etiketi, mevcut S:DD süreleri, izin ve durum etiketleri. Future/noData/istihdam dışı veya mevcut olmayan günler tarihle birlikte tek satır olarak korunur; veri kolonları — ve metin gri olur.
- `:86`: tam genişlik sarı bant, izin türü başına gün sayısı/İzin yok, ortak gün türü dolguları, altta beş süre toplamı. Gece çiftinin 22:00–06:00 uçları backend'in atadığı tek iş günü satırında kalır.
- `:122`: döküm başlığına kadar donma; A4 dikey, fitToWidth 1, fitToHeight 0; yalnız döküm kolon başlığı baskıda tekrar eder.
- `:126`: kişi başına sayfa üretimi ve son Lejant. Lejantta mola açıklaması ile bu düzene özgü üç çift üst sınırı bulunur. Metin hücreleri mevcut setCell/safeCell/neutralizeSpreadsheetFormula yolunu kullanır; ad bant içinde sabit “Ad Soyad:” önekiyle güvenli metin olarak yazılır.

## 300 kişi sınırı ve yerel yardımcılar

Builder kişi satırlarını süzdükten sonra, **hiç sayfa eklemeden önce** 300 sınırını kontrol eder. Aşıldığında `notify.info('En fazla 300 kişi; departman ya da kişi filtresi seçin.')` çağırıp `PersonSheetsLimitError` fırlatır; böylece mevcut exportReport akışı writeBuffer/download aşamasına ulaşmaz. Export.ts ve ReportPage.tsx değiştirilmedi: mevcut ReportPage catch'i ayrıca genel dışa aktarma hata bildirimi gösterebilir; hata açıklaması aynı anlamlı Türkçe mesajdır.

Ortak yardımcılar değiştirilmedi. Ad temizleme/çakışma çözümü, yatay tek satır birleştirme, kişi sayfası stil/özet/günlük değer yardımcıları kendi dosyasında yereldir; ortak setupPrint çağrısından sonra yalnız kişi/Lejant sayfasının orientation alanı portrait yapılır.

## Testler

`src/lib/reports/excel/personSheets.test.ts` gerçek ExcelJS kullanır, mock Workbook yoktur:

- `:38`: iki kişi → iki sayfa + son Lejant; xlsx yazılıp yeniden açılarak bant, birleşim, özet, izin türü, günlük kolonlar, null uç, +1 çift, gece tek satır, future/noData gri —, alt toplam, dolgu, donma ve baskı ayarları doğrulandı.
- `:85`: yasak karakterler, boş ad, 31 karakter, aynı uzun ad, büyük/küçük harf ve Lejant çakışması.
- `:90`: '=' ile başlayan ad güvenli string; hiçbir hücrede formül yok, esnek plan ve İzin yok.
- `:107`: 301 kişide notify.info + anlamlı hata; workbook boş kalır; gerçek exportReport çağrısı reject olur ve URL.createObjectURL/indirme başlamaz.

## Kapılar ve paralel çalışma

- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: geçti (0).
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: geçti (0).
- `node_modules/.bin/eslint src/lib/reports/excel/personSheets.ts src/lib/reports/excel/personSheets.test.ts`: geçti (0).
- `node_modules/.bin/vitest run src/lib/reports/excel/personSheets.test.ts src/lib/reports/excel.test.ts`: 2 dosya, 5/5 test geçti; eski excel.test.ts değişmedi.
- Tam `node_modules/.bin/vitest run`: 395 dosyanın 392'si, 4484 testin 4478'i geçti (32,18 saniye). Altı kırmızı: 1 adet personMonthExcel.test.ts:71 geçici “Rapor + Lejant” beklentisi, 4 ReportPage ve 1 auditFixes testinde paralel ReportResults useConvex değişikliğinin mock eksiği. Kendi kişi sayfası testleri ve tüm backend testleri geçti.
- Koordinatör soruya “personMonthExcel.test.ts'e dokunma; koordinatör güncelleyecek” yanıtı verdi; test değiştirilmedi. Sonraki koordinatör mesajı, useConvex mocklarının düzeltildiğini ve 28/28 testin geçtiğini bildirdi; geçici Excel beklentisini de koordinatör güncelleyecek. Bu rapordaki tam koşu sayıları kendi koşumun gözlenen sonucudur.
- `git diff --check`: temiz. Convex değiştirilmediği için find-node-leak çalıştırılmadı.

## Bilinçli bırakılanlar

Kişi detay çekmecesine indirme düğmesi, Convex, registry, aylık durum ve kişi blokları düzenleri kapsam dışında kaldı. Büyük veri uyarısının mevcut genel hata bildirimiyle birlikte görünmesi, verilen ownership içinde indirmeyi güvenilir biçimde durdurmak için korundu. Paket/DB/codegen/commit/deploy işlemi yapılmadı.
