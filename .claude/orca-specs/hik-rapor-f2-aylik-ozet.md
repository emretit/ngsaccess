# Hik raporları — Faz 2: Aylık Özet (Hik "Attendance Summary") + Faz 3/4 dikişi

Önce `.claude/orca-specs/hik-rapor-ortak.md` dosyasını oku; oradaki YASAK + kapı + rapor kuralları bu işin parçası.
Faz 1 (Mola) bitti: `getPdksTableData` `includePunches: true` iken gün ayrıntısında `pairs` (giriş/çıkış çiftleri, eksik uç null),
`breaks`, `breakMinutes` dolu. Ayrıntı `.claude/reports/hik-rapor-f1.md`. Bu faz YALNIZ web (`src/**`); Convex'e dokunma.
Hik düzeni: `docs/hikconnect-reports/shots/attendance-summary.png` + README §5.

## Hedef (test edilebilir)
`/reports/aylik/aylik-ozet` ay seçilince kişi başına aylık toplam tablosu gösterir; "Excel (kişi blokları)" indirmesi her kişi için
ayın günlerini kolon, Vardiya/Durum/Giriş-Çıkış/Süre satırlarını blok olarak, sağda toplamları içeren tek sayfalık çalışma kitabı + "Lejant" sayfası üretir.

## Yapılacaklar
1. **Satır modeli** (`src/lib/reports/rows.ts` ya da yeni `src/lib/reports/personMonth.ts`):
   `PersonMonthReportRow = { kind: 'personMonth'; id; name; department; payrollCode; days: DailyCell[]; totals: PersonMonthTotals }`,
   `ReportRow` birliğine ekle. Kaynak: `getPdksTableData` matrix satırları (`DailySourceRow`). `future` / `noData` günler sayılmaz.
   Toplamlar: çalışılan gün · toplam süre · fazla mesai · geç (gün + dk) · erken çıkış (gün + dk) · devamsız gün · izinli gün + izin türüne göre gün
   (`cell.leaveType`) · hafta içi / hafta sonu / resmî tatil gün sayısı (`detail.dayType`) · hafta sonu/tatilde çalışılan gün · toplam mola (`breakMinutes`) ·
   inceleme gerektiren gün (`incomplete`). Sayım kuralları mevcut `countAttendance` / `STATUS_META` ile tutarlı olsun (aynı günü iki kez sayma).
2. **Ay filtresi pdksMatrix için:** `ReportScreen.tsx` bugün `dataSource === 'monthlyPayroll'` ise ay seçici gösteriyor. Bunu `definition.filters.includes('month')`
   olarak genelleştir; pdksMatrix + month raporunda `from/to` ayın ilk/son günü, sorgu `dailyReportArgs` (includePunches tanımdan). Mevcut aylık raporlar aynı kalır.
3. **Registry** (`src/lib/reports/registry.ts`):
   - `ReportDefinition`'a `excelLayout?: 'personBlocks' | 'personSheets' | 'statusMatrix'` ve `rowsMode?: 'personMonth'` (ya da eşdeğeri).
   - Yeni rapor `aylik-ozet` (grup `aylik`, başlık "Aylık Özet", dataSource `pdksMatrix`, includePunches, rowsMode personMonth, excelLayout `personBlocks`,
     filtreler month/department/person, formatlar excel/csv/pdf — CSV/PDF ekrandaki özet tabloyu verir).
   - Yeni rapor `kisi-devam-dokumu` (başlık "Kişi Devam Dökümü", aynı veri ve ekran tablosu, excelLayout `personSheets`). Açıklama: "Kişi başına aylık günlük döküm; her kişi ayrı sayfa."
   - `aylik-durum`'a `excelLayout: 'statusMatrix'`.
   - Ekran kolonları (personMonth): Ad Soyad · Departman · Bordro kodu · Çalışılan gün · Toplam süre · Fazla mesai · Geç (gün) · Geç (dk) · Erken çıkış (gün) ·
     Erken çıkış (dk) · Devamsız · İzinli · Mola · Hafta sonu/tatil çalışma · İnceleme (gün). Süre kolonlarında `minutesValue` (Excel/CSV dk eşi).
   - `ReportPage.tsx` dışa aktar menüsü: `excelLayout` varsa Excel etiketi "Excel (kişi blokları)" / "Excel (kişi başına sayfa)" / "Excel (renkli durum tablosu)".
4. **Excel dağıtımı** (`src/lib/reports/export.ts`): `format === 'excel' && def.excelLayout` ise ilgili modülü dinamik `import()` ile yükle:
   `./excel/personBlocks`, `./excel/personSheets`, `./excel/statusMatrix` (klasör adı serbest, tutarlı ol). Ortak imza:
   `(workbook: ExcelJS.Workbook, input: { def; rows; meta: ReportExportMeta & { days?: readonly string[] } }) => void`.
   Mevcut tablo sayfasını `addTableSheet(workbook, def, rows, meta)` olarak ayır (davranış birebir aynı, `excel.test.ts` değişmeden geçmeli).
   `personSheets` ve `statusMatrix` dosyalarını BU FAZDA oluştur ama gövdesi `addTableSheet` + `addLegendSheet` çağırsın (Faz 3/4 dolduracak;
   böylece iki paralel worker aynı dosyaya yazmaz). `ReportExportMeta`'ya opsiyonel `days` ekle, aylık raporda `ReportResults`'tan geçir.
   Ortak yardımcılar (`src/lib/reports/excel/common.ts`): başlık satırları, gün başlığı (gg.aa + Pzt…Paz), gün türü dolguları (hafta sonu açık gri,
   resmî tatil açık amber, yarım gün daha açık amber), `addLegendSheet(workbook, entries)`, A4 yatay + `fitToWidth: 1` + başlık satırlarını yazdırmada tekrar,
   güvenli hücre değeri (`neutralizeSpreadsheetFormula`), süre biçimi `S:DD` (`formatShortMinutes`).
5. **personBlocks Excel** (sayfa adı "Aylık Özet"):
   - Satır 1 başlık, satır 2 proje · dönem · "İstanbul saati (UTC+3)". İki satırlık başlık: A Ad Soyad · B Departman · C Bordro kodu · D Satır ·
     sonra her gün bir kolon (üst: gg.aa, alt: kısa gün adı) · sonra toplam kolonları (üst başlık "Toplam" birleşik).
   - Departmana göre grupla: her departmandan önce tüm genişlikte birleşik departman satırı (Hik "Department Name" satırı).
   - Kişi bloğu satırları: Vardiya · Durum (STATUS_META etiketi; izinde izin türü) · Giriş 1 · Çıkış 1 … Giriş N · Çıkış N
     (N = o kişinin ayda gördüğü en çok çift, en az 1, en fazla 6; 6'dan fazlası son satırda "+k çift") · Çalışma · Fazla mesai · Geç · Erken çıkış · Mola.
     A-C kolonları blok boyunca dikey birleşik. Boş değer "—". Toplam kolonları blok boyunca dikey birleşik, değerler `PersonMonthTotals`'tan;
     izin türü başına ayrı kolon (yalnız veride geçen türler).
   - Gün kolonları gün türü dolgusuyla, ilk 4 kolon + başlık satırları dondurulmuş, kenarlıklar ince.
   - "Lejant" sayfası: durum etiketleri ve anlamları, renk anlamları, notlar (süreler S:DD, mola = çiftler arası boşluk, fazla mesai dönem kuralıyla).
6. **Hacim notu (2.5):** `convex/lib/pdksTableQuery.ts` okumadan (yazmadan) 31 gün × N kişi `includePunches` sorgusunun okuma sınırlarını ve dönen
   veri boyutunu kaba hesapla (hücre başı bayt × gün × kişi); riskliyse ekranda departman seçme uyarısı öner (UYGULAMA, rapora yaz).
7. **Testler (vitest):** personMonth toplamları (geç/erken/devamsız/izin türü/hafta sonu çalışma/mola/inceleme/future-noData hariç) ·
   personBlocks: exceljs'i gerçek kullanarak (mock değil; mümkün değilse gerekçe) çalışma kitabı kur → sayfa adları, gün başlıkları, departman satırı,
   blok satır etiketleri, N çift satırı, dikey birleştirmeler, toplam değerleri, hafta sonu dolgusu, `=` ile başlayan ad nötrleşir ·
   ReportScreen: `aylik-ozet` ay seçici gösterir ve sorgu ayın 1'i–son günüyle gider · menü etiketi · `excel.test.ts` değişmeden yeşil.

## Ownership (yalnız bunlara yaz)
`src/lib/reports/{registry,rows,query,export}.ts` · yeni `src/lib/reports/personMonth*.ts` · yeni `src/lib/reports/excel/**` ·
`src/lib/reports/*.test.ts` · `src/lib/reports/testFixtures.ts` · `src/components/reports/{ReportScreen,ReportResults,ReportPage}.tsx` + `*.test.tsx`.

## Kapsam dışı
Convex (`convex/**`) · Aylık Durum renk/lejant içeriği (Faz 3) · kişi başına sayfa içeriği (Faz 4) · rapor zamanlama · blok önizleme ekranı.

## Rapor yolu
`.claude/reports/hik-rapor-f2.md`
