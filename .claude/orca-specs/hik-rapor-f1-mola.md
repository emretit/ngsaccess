# Hik raporları — Faz 1: Mola raporu (Hik "Break Report" karşılığı)

Önce `.claude/orca-specs/hik-rapor-ortak.md` dosyasını oku; oradaki YASAK + kapı + rapor kuralları bu işin parçası.

## Hedef (test edilebilir)
`/reports/gunluk/mola` raporu, okutmalı her gün için gerçek mola aralıklarını (ör. "12:02–12:48 · 15:10–15:25") ve toplam mola
süresini gösterir; "Yalnız ihlaller" filtresi eski Mola İhlalleri sonucunu birebir verir; günlük çalışma süresi hesabı hiç değişmez.

## Tanımlar
- **Okutma çifti** = giriş→çıkış. Mevcut `pdksPairReadings` + `resolvePdksPunches` mantığı kullanılır (yönsüz okutmalar sırayla
  giriş/çıkış sayılır, tekrar okutma aralığı `policy.minPunchIntervalMinutes ?? 1` ile elenir, manuel giriş/çıkış ucu değiştirir).
- **Mola** = ardışık iki çift arasındaki boşluk: `çift[i].çıkış → çift[i+1].giriş`, dakika = floor((giriş-çıkış)/60000), 0 dk'lık boşluk yazılmaz.
- Eksik uçlu okutmalar: çift listesinde `{ in: null, out: "HH:MM" }` (girişsiz çıkış) / `{ in: "HH:MM", out: null }` (açık kalan giriş) olarak görünür;
  bunlar mola üretmez.

## Yapılacaklar
1. `convex/lib/pdksPunchPairs.ts` — saf fonksiyon ekle (adı serbest, ör. `pdksPunchSegments(readings, minIntervalMinutes)`):
   çiftleri eksik uçlarıyla birlikte sırayla döner + `breakGaps(...)` ya da aynı fonksiyondan `breaks: {startISO,endISO,minutes}[]`, `breakMinutes`.
   Mevcut `pairPdksPunches` / `pdksPairReadings` davranışı DEĞİŞMEZ (ortak iç yardımcıya refaktör serbest, çıktıları birebir aynı kalmalı).
2. Gün hesabının kullandığı okutma kümesiyle hesapla: `convex/lib/pdksDay.ts:150-154` civarında `eachPunch` modunda `pdksPairReadings(readings, manual…, minPunchInterval)`
   zaten kuruluyor. Aynı girdilerle (aynı readings, aynı manuel uçlar, aynı minInterval, `flexibleConflict` ise boş) her iki modda
   (`firstLast` dahil) gösterim amaçlı çift + mola listesi üret ve gün sonucuna yeni alan olarak ekle. `totalMinutes`, `rawTotalMinutes`,
   `breakMinutes` (mevcut kesinti), fazla mesai, durum — HİÇBİRİ değişmez. Karakterizasyon testleri (`convex/**/*.characterization.test.ts`,
   `pdksDay`/`pdksTable` testleri) değiştirilmeden geçmeli; yeni alan snapshot'a giriyorsa yalnız ekleme olarak güncelle ve raporda belirt.
   Daha temiz bir yol bulursan (ör. hesabı `pdksTable.ts` içinde aynı girdilerle yapmak) gerekçesini rapora yaz.
3. `convex/lib/pdksTable.ts` — `PdksDayDetail`'e yalnız `params.includePunches` iken dolan opsiyonel alanlar:
   `pairs?: Array<{ in: string | null; out: string | null }>` (HH:MM İstanbul), `breaks?: Array<{ start: string; end: string; minutes: number }>`,
   `breakMinutes?: number`. Çok vardiyalı günde (`dayPlan.shifts.length > 1`) mevcut `splitReadingsByShift` kovaları ile vardiya başına hesapla,
   vardiya parçaları arasındaki boşluk mola SAYILMAZ. Gece vardiyası gün ataması mevcut gruplamadan gelir (dokunma). `breakViolation` aynen kalır.
   `includePunches` yokken payload eskisiyle aynı olmalı.
4. Rapor (web):
   - `src/lib/reports/registry.ts`: `mola-ihlalleri` girişini yeni `mola` raporuyla değiştir (grup `gunluk`, başlık "Mola", açıklama Türkçe tek cümle,
     `includePunches: true`). Kolonlar: Tarih · Ad Soyad · Departman · Vardiya · Plan mola (mevcut) · Mola kayıtları ("12:02–12:48 · 15:10–15:25") ·
     Mola süresi (`formatMinutes` + Excel için `minutesValue`) · İhlal ("Plan molada okutma yok" / boş); gizli varsayılan: İlk giriş, Son çıkış, Toplam süre, Okutmalar.
     `FOCUSED_COLUMNS`'a ekle. Filtre birliğine `'breakViolation'` ekle.
   - `src/lib/reports/rows.ts`: predicate `mola` = gün mola kaydı içeriyor VEYA `breakViolation`; `dailyRowsForReport`'a ihlal-yalnız seçeneği.
   - `src/components/reports/ReportScreen.tsx` + `ReportResults.tsx`: filtrede `breakViolation` varsa "Mola" seçimi (Tüm molalar / Yalnız ihlaller),
     URL parametresi `ihlal=1`; "Filtreleri temizle" bunu da siler. Sunucu sorgusu değişmez (istemci filtresi).
   - `src/pages/Reports.tsx`: `/reports/gunluk/mola-ihlalleri` → mevcut arama parametreleri korunarak `/reports/gunluk/mola?ihlal=1` (replace).
   - `src/lib/reports/query.ts` gerekiyorsa (includePunches zaten tanımdan geliyor).
5. Testler (vitest):
   - `convex/lib/pdksPunchPairs.test.ts`: tek çift (mola yok) · 4 okutma = 1 mola · 6 okutma = 2 mola · yönsüz okutmalar · tekrar okutma aralığı içindeki
     çift okutma elenir · eksik giriş / açık çıkış uçları null · manuel giriş/çıkış ucu · gece yarısını aşan çift (22:00→06:00 içinde 02:00-02:30 mola).
   - `convex/lib/pdksTable.test.ts` (ya da mevcut uygun dosya): includePunches true/false payload farkı · çok vardiyalı günde parçalar arası boşluk mola değil ·
     süre alanları eski değerlerle aynı (regresyon).
   - `src/lib/reports/rows.test.ts`, `query.test.ts`, `registry.test.ts`, `src/components/reports/auditFixes.test.tsx`, `ReportPage.test.tsx`:
     `mola-ihlalleri` beklentilerini `mola` + ihlal filtresine taşı; ihlal-yalnız sonucu eski predicate ile aynı gün listesini verir; eski URL yönlenir.

## Ownership (yalnız bunlara yaz)
`convex/lib/pdksPunchPairs.ts` · `convex/lib/pdksPunchPairs.test.ts` · `convex/lib/pdksDay.ts` · `convex/lib/pdksTable.ts` · `convex/lib/pdksTable.test.ts` ·
yeni `convex/lib/pdksBreaks*.ts` (gerekirse) · `src/lib/reports/{registry,rows,query}.ts` + aynı klasördeki `*.test.ts` ·
`src/components/reports/{ReportScreen,ReportResults,ReportPage}.tsx` + `src/components/reports/*.test.tsx` · `src/pages/Reports.tsx`.
Karakterizasyon/pdksDay test dosyalarında yalnız EKLEME (mevcut beklentiyi değiştirme; değişmesi gerekiyorsa DUR, `ask`).

## Kapsam dışı
Aylık raporlar / Excel düzenleri (Faz 2-4) · çalışma süresinden mola düşme kuralı (öğle arası kararı açık, dokunma) · yeni Convex fonksiyonu/index/şema ·
PDKS ekranı (`/pdks-records`) görünümü.

## Rapor yolu
`.claude/reports/hik-rapor-f1.md`
