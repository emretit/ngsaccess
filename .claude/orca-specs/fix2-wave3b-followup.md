# UI Audit 2 — Dalga 3b denetim takibi (R3B-E1 + R3B-D1/D2/D3/D5/D6/D7)

## Hedef
`docs/ui-audit-2/review-wave3b.md` denetim raporundaki şu bulguları düzelt: **R3B-E1 (Engel)**, R3B-D1, R3B-D2, R3B-D3, R3B-D5, R3B-D6, R3B-D7. Raporun "sorun" sütunu somut girdi→çıktı verir, "öneri" sütunu yol gösterir. R3B-D4 (haftalık/günlük fazla mesai) ürün kararı bekliyor — koordinatör ayrı mesajla iletecek; o gelene kadar `convex/cardReadings.ts:773` toplam mesai hesabına DOKUNMA. Bitti = yedi bulgu düzeltildi + her biri testle kanıtlandı + kapılar yeşil.
- R3B-E1: `classifyPdksDay` (`convex/lib/pdksTable.ts:60-61`) — `noData`/`notEmployed` yalnız devamsızlık üretecek durumu ezsin: `hasLeave` → `leave`; `classification` weekend/holiday(halfDayHoliday) → kendi durumu; `noData` yalnız `workday && !hasLeave && !hasAttendance`. Testler: izinli gün + firstRecordDate null / sonraki tarih → İZN; Pazar + availableDateKeys boş → HT; resmî tatil + veri yok → RT; leaveDays sayacı doğru; 08-H1 "Veri yok" davranışı iş gününde aynen kalır.
- R3B-D1: `availableDateKeys` proje başına BİR KEZ (Map projectId → Set), çözümleyici bir kez; manuel kayıtları kişiye göre önceden grupla; bordroda `employees.find` yerine Map. Tablo, bordro, rapor yükleyicisi (`convex/lib/reportAttendance.ts`). Test: hesap sayısı/çağrı sayısı kişi sayısından bağımsız (spy) ya da 300 kişilik sentetik veride süre sınırı.
- R3B-D2: `getEmployeeAttendanceDetail` tüm proje okumalarını çekmesin: veri-var bilgisi için gün başına ucuz kaynak (ör. dönem günleri için index'li `take(1)`) ve çözümleyici tablo ile aynı küme. Tablo ile çekmece aynı kişi-gün için aynı durumu vermeli (test).
- R3B-D3: Ham Okutmalar (`listReportTransactions`) yalnız `biometric` kaynağı gizlesin; `unknown` görünsün (Kaynak sütunu "Belirsiz"); sayaç metni "N biyometrik kayıt gizlendi" yalnız biyometriği saysın; `sources:['unknown']` süzgeci sonuç dönebilsin. PDKS hesabındaki 08-O3 kararı (unknown PDKS DIŞI) DEĞİŞMEZ. Test: unknown görünür, biometric gizli.
- R3B-D5: izin proje süzgeci tablo/bordro/detayda tek ortak yardımcı: `!l.projectId || l.projectId === projectId`. Test.
- R3B-D6: `bulkUpsertManual` vardiyaları bir kez yükle, kişi başına atama önbelleği (ya da yalnız atanmış vardiyayı `db.get`). Test: N satırda shifts okuması 1 kez.
- R3B-D7: CSV önizleme (`convex/actions/pdksImport.ts:124`): kişinin o gün atanmış vardiyası gece vardiyasıysa çıkış<giriş kabul (elle düzeltme kuralıyla aynı yardımcıyı kullan); değilse mevcut hata, metne "Gece vardiyası atanmamış" ipucu. Test.

## Bağlam
Repo: /Users/emreaydin/ngsaccess (React + Vite + TS strict, Convex). Arayüz metinleri Türkçe, sade, cümle düzeni.
Proje kuralları: `any`/`as any` YASAK (eslint error) → `unknown` + daraltma; `!` non-null yerine optional chaining + erken dönüş;
Convex alanları camelCase, snake_case yeniden mapleme yok; `db.get` sonuçlarında `filter((p): p is NonNullable<typeof p> => p !== null)`.
Convex kodu yazacaksan önce `convex/_generated/ai/guidelines.md` oku.
Ortak yardımcılar (Adım 0'da hazırlandı, KULLAN, değiştirme): `formatTrDateTime`/`formatTrDate` (`src/lib/date.ts`, Europe/Istanbul),
`todayInTurkey` (`src/lib/date.ts`), `deviceBrandLabel` (`src/lib/deviceBrand.ts`), `EmptyState` `live` prop'u, `ui/checkbox` (24px tıklama alanı),
`DeviceSyncStatusBanner`, `UnsavedChangesDialog` ("Düzenlemeye dön"/"Kaydetmeden çık"), `TimeSchedule` + `weekdays`.
Aynı çalışma ağacında başka worker'lar paralel çalışıyor: yalnız Ownership'teki dosyalara yaz.

## Ownership (yalnız bunlar + bunların test dosyaları)
`convex/lib/pdks*.ts`, `convex/lib/reportAttendance.ts`, `convex/cardReadings.ts` (PDKS fonksiyonları + `listReportTransactions`; Canlı İzleme sorgularına dokunma), `convex/pdksRecords.ts`, `convex/actions/pdksImport.ts`, `src/components/reports/ReportResults.tsx` (yalnız sayaç metni), `src/lib/reports/**` (yalnız "Belirsiz" kaynak etiketi gerekiyorsa), `src/components/pdks/**` (yalnız gerekiyorsa)

## Kapsam dışı
R3B-D4 (karar bekliyor). Canlı İzleme sorguları. Başka oturumun dosyaları: `convex/attendanceCorrections.ts`, `convex/leaveRequests.ts`, `convex/employeeImport.ts`, `convex/alarms.ts`, `src/lib/employees/**` — DOKUNMA; ama `attendanceCorrections.ts` senin `pdksManual`/`pdksHelpers` imzalarını kullanıyor: imza değiştirirsen o dosya kırılır → imzaları geriye uyumlu tut.
`convex/schema.ts` koordinatörde: yeni index gerekirse YAZMA, `ask` ile iste.

## Kapılar (hepsi yeşil; sayıları rapora yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (başka oturumun yarım dosyası yüzünden hata çıkarsa dosya adını raporla, onu düzeltme)
- `node_modules/.bin/eslint convex/lib convex/cardReadings.ts convex/pdksRecords.ts convex/actions/pdksImport.ts src/components/reports src/lib/reports src/components/pdks` → 0 error
- `node_modules/.bin/vitest run convex src/components/pdks src/lib/reports src/components/reports src/components/settings` → yeşil

## Yasak
commit / push / deploy / migration / Convex DB yazma YOK. `npx convex dev|deploy|run` YOK. Paket ekleme YOK. Tarayıcıda veri değiştiren işlem YOK.

## Rapor (worker_done, ≤10 satır)
Bulgu ID → yapılan + `file:line`; yapılamayanlar ve nedeni; kapı sonuçları. Tam dosya listesi `--files-modified` ile.
