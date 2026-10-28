# Hik raporları Faz 2 (Aylık Özet) — salt-okuma denetimi

**Sonuç: ENGEL 0 · ÖNEMLİ 2 · DÜŞÜK 4.** Toplam mantığı, ay filtresi, Excel yerleşimi ve paketleme doğru. Asıl risk hacim: aşağıdaki iki ÖNEMLİ madde.

## Kapılar (kendi koşumum)
- `tsc --noEmit -p tsconfig.app.json`: 0 hata. `eslint src/lib/reports src/components/reports`: temiz.
- `vitest run src/lib/reports src/components/reports`: 13 dosya, 83/83 geçti.
- `vite build`: ana `index-dEHCBMso.js` 338,49 kB (gzip 106,13); `exceljs.min-BEz_Ja81.js` 929,91 kB AYRI chunk; `personBlocks-B49Hr_ML.js` 3,45 kB AYRI chunk. exceljs ana pakete girmiyor.
- Ek ölçüm (geçici betik /tmp, repo'ya yazılmadı): `buildPersonBlocks` 150 kişi × 31 gün. 4 çift/gün: ~0,7 sn, 68 MB heap, xlsx ~0,3 MB. 12 çift/gün: build 264 ms + yazma 441 ms, 147 MB heap, 376 KB. Tarayıcı için kabul edilebilir.

## ÖNEMLİ

### 1. Sorgu, departman/kişi filtresinden ÖNCE tüm projenin okutmalarını okuyor — worker'ın "departman seçin" önerisi okuma sayısını düşürmez
- `convex/lib/pdksTableQuery.ts:61-91`: `cardReadings` `by_project_access_time` ile aralık boyunca `.collect()`, `employees` `by_project` ile `.collect()`. Departman/kişi/vardiya filtreleri bunlardan SONRA bellekte uygulanır (`:103-123`).
- Senaryo: proje günde ort. 600 okutma × 31 gün = ~18.600 belge okuma (filtre ne olursa olsun). Günde 1.800 okutma → ~55.800 → Convex sorgu belge-tarama sınırını (resmî sayfada ~32.000 belge / 16 MiB okuma; bu ortamda çevrimdışı, sayı doğrulanmadı — `guidelines.md` sayı vermiyor) aşar, sorgu hata verir. Worker'ın hacim tablosu "en az 31×N×okutma/gün" diyor; gerçekte N = TÜM proje çalışanı/okutması, filtrelenmiş küme değil.
- Yeni olan: `includePunches` ile yanıt boyutu. Departman seçimi yanıtı küçültür, okumayı küçültmez.
- Somut eşik önerisi: (a) okuma ≤ ~20.000 → proje toplam okutması/gün ≲ 640 (31 gün); (b) yanıt ≤ ~8 MiB → hücre ~1,4 KB (12 okutma) ile ≤ ~190 kişi, ~2,3 KB (24 okutma) ile ≤ ~120 kişi.
- Düzeltme: Aylık Özet/Kişi Devam Dökümü için sonuç `rows.length > 100` ise ekranda "Büyük proje: departman seçerek yanıtı küçültün" uyarısı (okuma sınırı için DEĞİL, yanıt için); okuma sınırı aşılınca `QuerySectionBoundary` zaten hata gösterir — mesajı "Dönemi kontrol edin" yerine "Bu rapor için proje çok büyük; kısa dönem seçin" yapın. Kalıcı çözüm sunucuda (filtreli çalışan kümesine göre okutma okuma / haftalık parçalama); bu fazın kapsamı dışı, ayrı iş olarak açın.

### 2. Rapor canlı (reaktif) `useQuery`; 31 günlük büyük yanıt her yeni okutmada yeniden gönderilir
- `ReportResults.tsx` `DailyResults`: `useQuery(api.cardReadings.getPdksTableData, …)`. Ayın aralığındaki HERHANGİ bir yeni turnike okutması sorguyu geçersiz kılar; Convex sonucu yeniden hesaplar ve tüm (MB'larca) yanıtı yeniden gönderir.
- Senaryo: rapor sekmesi açık bırakıldı, 150 kişilik proje, gün içinde yüzlerce okutma → her biri ~6-10 MiB yeniden hesap/aktarım. Projede daha önce function-call/bandwidth kotası yanmıştı (IDE poll, Hik roster poll).
- Düzeltme: `includePunches` + ay aralığı raporlarında `useQuery` yerine tek seferlik çağrı (`useConvex().query` + "Yeniden yükle" düğmesi zaten var) ya da en azından bu raporlar için `skip` ile arka planda sekme gizliyken durdurma. Karar ürün tarafında; en azından risk kabul notu düşün.

## DÜŞÜK
3. **Kolon seçimi Excel'de yok sayılır**: `buildPersonBlocks` `meta.columns` kullanmaz; kullanıcı ekranda kolon gizlese de blok Excel'i hep tüm toplamları basar. Kasıtlı olabilir; Lejant/ekran metnine not düşün.
4. **İzin türü kolonları veriye bağlı**: `personTotalColumns` (personBlocks.ts:9) izin türlerini görünen kişilerden türetir; departman filtresi değişince kolon sayısı/sırası değişir (ay içinde izin yoksa hiç kolon yok). Aylar arası karşılaştırmalı birleştiren kullanıcı için kayma; sabit sıra (leaveTypes anahtar sırası) tercih edilebilir.
5. **Test boşluğu**: 150×31 ölçek ve boş veri (0 kişi) için `personMonthExcel.test.ts` yok. 0 kişi kodu okuyunca hata yok (`printArea` `Math.max(4,…)`), ama test korumaz. 
6. **Kozmetik**: `ReportResults.tsx:1` `buildPersonMonthRows` import'u dosyanın en üstünde, react import'larından önce (Faz 1 ile aynı diff'te); işlev etkisi yok.

## Doğrulananlar (bulgu yok)
- **Toplamlar** `countAttendance` ile aynı kurallar: `payrollCodeForDay` (pdksHelpers.ts:200) hafta sonu/tatili HT/RT yaptığı için hafta sonu izin/çalışma `workedDays`/`leaveDays`e girmez — personMonth da aynı koda dayanıyor; `weekendDays`/`holidayDays` HT/RT sayımıyla eşit (yarım gün tatil = RT = 1 takvim günü). `incomplete` yalnız inceleme sayısı; `future/noData/notEmployed/noShift` dışarıda; fazla mesai günlük hücrelerin toplamı (dönem kuralı sunucuda, aralık = ay olduğundan tutarlı). Aynı gün iki hücre sorgudan gelmez (kişi başına gün başına tek hücre).
- **Ay filtresi**: `filters.includes('month')` yalnız Aylık/pdksMatrix-ay raporlarını etkiler; mevcut monthlyPayroll raporları aynı (hepsinin filtresinde zaten `month` var). `monthPeriod` regex+1000-9999 doğrulama, `to` = ayın son günü (28-31, 2028-02 → 29). `reportQueryKey` pdksMatrix için `from/to` içeren args'ı kullanır → ay değişince key değişir. Geçersiz ay: `from=''` → `rangeError`, sorgu çalışmaz.
- **Excel birleştirme**: A–C ve toplam kolonları kişi başına benzersiz aralık; departman satırı tam genişlik; başlık 1-2. satır ve 3-4. satır ayrı. Çakışma yok (gerçek exceljs'le yazıp açan test + benim 150×31 koşum hatasız).
- **Formül nötrleştirme**: kişi adı, departman, bordro kodu, vardiya adı, durum/izin türü, çift saatleri, başlık, proje adı ve Lejant hep `setCell`/`safeCell` üzerinden; sayısal hücreler sayı kalır.
- **Dağıtım**: `export.ts` yalnız `import type ExcelJS` + dinamik `import('./excel/…')`; `excel/*` → `export`/`registry` yalnız `import type` → çalışma zamanı döngüsü yok. Eski düz rapor çıktısı `addTableSheet` ile aynı satırlar; `excelReportColumns` CSV'de yalnız `rowsMode==='personMonth'` için (eski CSV'ler değişmedi). Not: Aylık Durum artık `statusMatrix` Excel yoluna bağlı (Faz 3 devam eden iş, bu denetimin dışı).
- **Repo kuralları**: yeni dosyalarda `any`/`as any`/`!`/`filter(Boolean)` yok; metinler Türkçe; ay seçici "Ay" etiketi `FormFieldWrapper htmlFor="report-period"` ile bağlı.
