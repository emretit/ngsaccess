# Denetim — Raporlar D2 (salt okuma, Claude)

**Özet:** KRİTİK 0 · YÜKSEK 1 · ORTA 2 · DÜŞÜK 5. Yetki, KVKK süzgeci ve D1 regresyonu temiz. En ciddi sorun: Mobil Okutmalar seyrek veride pratikte boş görünüyor.
Bir de erken çıkış/geç bayrakları hafta sonu ve arife günlerinde yanlış pozitif üretiyor.

## Kapılar (kendi koşumum, 2026-10-19 13:38)
- `tsc -p tsconfig.app.json` → 0 hata · `tsc -p convex/tsconfig.json` → 0 hata
- `eslint src/lib/reports src/components/reports src/pages/Reports.tsx convex/lib convex/cardReadings.ts` → 0
- `vitest run src/lib/reports src/components/reports convex/lib/{reportAttendance,pdksTable,pdksCalc}.test.ts` → 11 dosya / 125 test geçti
- `git diff --check` (kapsam) → temiz · yeni kodda `any`/`!`/`filter(Boolean)` yok (`as` yalnız testlerde Id/Doc fixture'ı)

## Bulgular (önem sırasıyla)

1. **[YÜKSEK] convex/cardReadings.ts:1792 (+ src/components/reports/ReportPage.tsx:54)** — Kaynak süzgeci 200 satırlık sayfa taramasından SONRA uygulanıyor. Mobil/QR okutmalar kart okutmalarının küçük bir kısmıysa sayfaların çoğu 0 satır döner.
   Senaryo: günde 2.000 kart + 5 QR okutması olan projede 31 gün ≈ 62.000 satır. Mobil Okutmalar ilk açılışta "Kayıt bulunamadı — Bu dönem ve filtrelerle eşleşen kayıt yok" gösterir (`isDone=false` olsa bile). Tüm QR'ları görmek için ~310 kez "Daha fazla yükle"ye basmak gerekir; her tıklama 200 satır okur.
   Düzeltme: sunucuda `sources` verildiğinde sınırlı bir döngüyle (ör. ≤5 sayfa / 1.000 satır) sayfa doldurulana kadar devam et. Kalıcı çözüm: insert sırasında `source` alanı + index. UI'da `!isDone && rows.length===0` iken EmptyState yerine "Bu sayfada eşleşme yok, daha fazla yükleyin" göster.

2. **[ORTA] convex/lib/pdksTable.ts:415 + convex/lib/pdksPayroll.ts:97 → src/lib/reports/rows.ts:30-31,52** — `isEarlyExit`/`isLate` gün türüne bakmadan, vardiya saatine göre hesaplanıyor. Yeni Erken Çıkanlar, İstisnalar ve Kişi/Departman "Erken çıkış (gün)" sayımı bunları filtresiz kullanıyor.
   Senaryo: arife (halfDayHoliday) günü 13:00'te çıkan herkes Erken Çıkanlar'da "Erken çıkış 300 dk" olarak listelenir. Cumartesi 10:00–14:00 fazla mesaiye gelen kişi İstisnalar'da "Geç 60 dk · Erken çıkış 240 dk" görünür ve aylık Erken çıkış/Geç sayısına eklenir. (Geç sayımı D1 Aylık Durum `totals.lateDays`'te de aynı; yeni olan erken çıkış sayımı ve İstisnalar raporu.)
   Düzeltme: predicate/sayımda `detail.dayType === 'workday'` (aylıkta `cell.classification === 'workday'`) şartı ekle ya da bayrakları yalnız iş gününde üret.

3. **[ORTA] src/lib/reports/rows.ts:50-56** — "Çalışılan gün" `totalMinutes > 0` ile sayılıyor, durum kodlarıyla uyuşmuyor.
   (a) Tek okutmalı iş günü (çıkış basılmamış) kodu `N` ama ne çalışılan ne devamsız sayılır; oranın paydasından düşer, satır toplamı ay gününü tutmaz.
   (b) İzinli gün + okutma (`İZN`, dakika>0) hem Çalışılan hem İzinli sayılır.
   (c) Hafta tatili/RT'de çalışma Çalışılan'a girer ve Devam oranını şişirir: 22 iş günü + 4 cumartesi, 2 devamsız → %92,9; olması gereken %91,7.
   Düzeltme: çalışılan = `payrollCode === 'N'` (iş günü katılımı). Hafta tatili/RT çalışması ayrı kolon olsun; oran = N / (N + DV).

4. **[DÜŞÜK] convex/lib/pdksCalc.ts:110-112** — Süre, saniyesi atılmış dakika-of-day farkıyla hesaplanıyor. Dashboard (`convex/dashboard.ts:565`) ise ms farkını `floor` ediyor; sınırda sonuçlar ayrışıyor.
   Senaryo: 08:00:59 → 15:30:00. Rapor 930−480=450 → ihlal. Dashboard 449 dk → ihlal yok.
   Düzeltme: `computeBreakViolation`'a ISO listesi verip `Math.floor(ms/60000)` kullan, ya da dashboard'u bu yardımcıya bağla.
   Diğer kurallar dashboard ile aynı: ≥2 okutma, ≥450, dahil sınırlar, vardiya/mola yoksa false. Tek fark: `start>end` olduğunda yeni kod false dönüyor, dashboard her zaman ihlal sayıyor (yeni davranış daha doğru).

5. **[DÜŞÜK] convex/lib/pdksTable.ts:467** — Manuel düzeltilmiş günde mola ihlali ham okutmalardan hesaplanıyor, Toplam süre ise manuelden geliyor.
   Senaryo: okutmalar 08:00 / 16:00, yönetici manuel 09:00–15:00 girmiş. Mola İhlalleri'nde "Toplam süre 6 sa 00 dk" satırı çıkar, açıklama ise "7,5 saatten uzun" der.
   Düzeltme: `manualDay?.entryTime && manualDay?.exitTime` ise `breakViolation: false` (veya manuel aralığa göre hesapla).

6. **[DÜŞÜK] convex/lib/pdksTable.ts:461 / src/lib/reports/rows.ts:106** — 24 sınırı en erken 24 okutmayı tutuyor ve kesildiği belirtilmiyor.
   Senaryo: 30 okutmalı günde Okutmalar kolonu 24'te biter, son çıkış okutması görünmez. Aynı satırda "Son çıkış" ve "Okutma sayısı 30" farklı bilgi verir.
   Düzeltme: `formatPunches`'a `readingCount > punches.length` ise "· +N okutma daha" ekle.

7. **[DÜŞÜK] src/components/reports/ReportResults.tsx:48** — Mobil Okutmalar'da "Yüklenen sayfalarda N biyometrik kayıt gizlendi" taranan TÜM satırları sayıyor. Biyometrik kayıtlar zaten mobil/QR değil, bu yüzden mesaj yanıltıcı.
   Düzeltme: `definition.transactionSources` varken bu sayacı gizle.

8. **[DÜŞÜK/OLASI] convex/lib/pdksTable.ts:461** — `punches` tüm matrix çağıranlara ekleniyor (PDKS Kayıtları, `usePdksTableData`); reaktif abonelik payload'u büyüyor.
   Tahmin: 300 kişi × 22 iş günü × ~4 okutma × ~40 B ≈ +1 MB/abonelik. Her yeni okutmada yeniden gönderilir. Kötü durum (24×31×300) ≈ 9 MB; mevcut sınırsız `detailedLogs` de üstüne eklenince 16 MB dönüş sınırına yaklaşabilir.
   Düzeltme: `punches`'ı opsiyonel arg'la (`includePunches`) yalnız Okutma Kartı/Mola raporlarında doldur.

## Temiz bulunanlar
- KVKK: `punches`/mola, `filterPdksReadings` sonrası `granted` (izin_verildi) okutmalardan geliyor (`cardReadings.ts:1506`, `pdksTable.ts:246,262`). `sources` validator'ında `biometric` yok; süzgeç biyometrik ayrımından sonra, enrich'ten önce.
- Mobil sınıflama: `employeeCheckIn.ts:80` (`qr_checkin…`) ve `selfCheckIn` (`{"source":"mobile_qr"}`) → `qr` (`pdksSource.test.ts:30,33` kapsıyor). `sources` reportQueryKey'e giriyor; kişi/departman key dışında.
- Regresyon: Aylık Durum `monthlyDays:'code'` ile aynı kolon sırası ve kod notunu koruyor. Aylık istemci filtreleri key dışında. PDF 2000 sınırı ve pinned kolonlar korunuyor (export.ts değişmedi). Kolon seçimi slug başına; `ScopedReport`/`ReportResults` slug+key ile yeniden mount ediliyor.
- Departman raporu: kişi araması gizli ve sorguya girmiyor (`ReportScreen.tsx:32-33`). Departmansız "-" ayrı satır. Payda 0 → "—".
