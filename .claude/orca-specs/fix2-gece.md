# UI Audit 2 düzeltme — Dalga 4B — Gece vardiyası (08-H2) + gece çarpanı (13-H1) + süre çelişkisi (11-H2)

## Hedef
Üç bağlı PDKS hesap bulgusunu tek hesap yolunda düzelt. Kaynak raporlar ve bağlayıcı kararlar: `docs/ui-audit-2/08-pdks-kayitlari.md` (08-H2), `docs/ui-audit-2/13-ayarlar.md` (13-H1), `docs/ui-audit-2/11-raporlar.md` (11-H2), `docs/ui-audit-2/09-vardiyalar.md` (Kararlar). Bitti = üçü düzeltildi + testlerle kanıtlandı + kapılar yeşil.
- **08-H2 (karar)**: vardiyalar Vardiyalar sayfasında tanımlanır/atanır; PDKS hesabı kişinin ATANMIŞ vardiyasını (`convex/lib/shiftResolver.ts`) esas alır. Atanan vardiya gece yarısını geçiyorsa (`endTime <= startTime`) giriş–çıkış çifti VARDİYA BAŞLANGIÇ GÜNÜNE bağlanır (22:00 D girişi + 06:00 D+1 çıkışı = D gününün tek çalışması). Bugün okumalar takvim gününe göre gruplanıyor (`convex/lib/pdksTable.ts` ~265 `trDateKey(r.accessTime)`). Gruplama tek bir yardımcıda yapılsın (ör. `pdksWorkDay.ts`: okuma + kişinin o günkü/önceki günkü vardiyası → iş günü anahtarı) ve tablo, kişi detayı, aylık bordro, rapor yükleyicisi HEPSİ onu kullansın. Vardiyası olmayan kişi: mevcut takvim günü davranışı korunur.
- Manuel düzeltme (`convex/lib/pdksManual.ts:19`, `src/components/pdks/lib/presentation.ts:117-118` ve manuel form): kişinin o gün atanmış vardiyası gece vardiyasıysa çıkış < giriş kabul edilir ve ertesi güne yazılır (formda "ertesi gün" gösterimi). Sunucu doğrulaması aynı kurala uysun. Atanmış gece vardiyası YOKSA mevcut "çıkış > giriş" kuralı kalır.
- **13-H1 (karar)**: gece çarpanı hesaba katılır. Ayarlardaki `nightShiftStart`/`nightShiftEnd`/`nightShiftMultiplier` (`convex/lib/pdksHelpers.ts:31-33`) kullanılarak çalışmanın gece penceresine düşen dakikaları ayrı hesaplansın (`nightMinutes`), bordro/ücret hesabında bu dakikalar gece çarpanıyla ağırlıklandırılsın (gün türü çarpanıyla nasıl birleştiğini — büyük olanı mı, çarpım mı — mevcut ücret kodundan çıkar; belirsizse `ask` ile sor, uydurma). Gece penceresi gece yarısını geçer (22:00–06:00). Gece dakikası PDKS tablosunda/kişi detayında bir sütun ya da alt bilgi olarak görünsün; Raporlar dosyalarına dokunma.
- **11-O3 (backend kısmı)**: departmansız kişi sentinel'i `"-"` → `"Departmansız"` (`convex/cardReadings.ts:814` getMonthlyPayrollSheet, `convex/lib/reportAttendance.ts:97`); testleri güncelle.
- **11-H2**: aynı kişi-gün için günlük matris (`getPdksTableData` → `convex/lib/pdksTable.ts`) ile aylık sayfa (`getMonthlyPayrollSheet` → `convex/lib/pdksPayroll.ts`) ve kişi detayı (`convex/lib/pdksDetail.ts` ~97 `overtimeMinutes = max(0, net - 480)`) farklı toplam süre / fazla mesai üretiyor (örn. 8 dk çalışmada fazla mesai 42 dk, aylıkta 0). Kök nedeni bul (rapora yaz), toplam/net/fazla mesai hesabını TEK fonksiyona indir, üç yol da onu çağırsın. Fazla mesai > toplam süre olamaz; test: aynı veri üç yoldan aynı sayıları verir.

## Bağlam
Repo: /Users/emreaydin/ngsaccess (React + Vite + TS strict, Convex). Arayüz metinleri Türkçe, sade, cümle düzeni.
Proje kuralları: `any`/`as any` YASAK (eslint error) → `unknown` + daraltma; `!` non-null yerine optional chaining + erken dönüş;
Convex alanları camelCase, snake_case yeniden mapleme yok; `db.get` sonuçlarında `filter((p): p is NonNullable<typeof p> => p !== null)`.
Convex kodu yazacaksan önce `convex/_generated/ai/guidelines.md` oku.
Ortak yardımcılar (Adım 0'da hazırlandı, KULLAN, değiştirme): `formatTrDateTime`/`formatTrDate` (`src/lib/date.ts`, Europe/Istanbul),
`todayInTurkey` (`src/lib/date.ts`), `deviceBrandLabel` (`src/lib/deviceBrand.ts`), `EmptyState` `live` prop'u, `ui/checkbox` (24px tıklama alanı),
`DeviceSyncStatusBanner`, `UnsavedChangesDialog` ("Düzenlemeye dön"/"Kaydetmeden çık"), `TimeSchedule` + `weekdays`.
Aynı çalışma ağacında başka worker'lar paralel çalışıyor: yalnız Ownership'teki dosyalara yaz.
Dalga 3'te PDKS worker'ı `availableDateKeys`/`firstRecordDate`/"Veri yok" (08-H1/11-H1) düzeltmesini bu dosyalarda yaptı — o davranışı KORU, mevcut testleri kırma.

## Ownership (yalnız bunlar + bunların test dosyaları + yeni dosyalar bu dizinlerde)
`convex/lib/pdks*.ts`, `convex/lib/reportAttendance.ts` (hesap çağrısı + departman sentinel'i), `convex/cardReadings.ts` (YALNIZ PDKS sorgu/mutation'ları: `getPdksTableData`, `getMonthlyPayrollSheet`, `getEmployeeAttendanceDetail`, manuel PDKS kaydı; `listReportTransactions` Dalga 4A'da — DOKUNMA), `src/components/pdks/**`, `src/pages/PDKSRecords.tsx`

## Kapsam dışı
`convex/lib/shiftResolver.ts` mantığı (yalnız çağır), Vardiyalar sayfası (09-O4 "(+1 gün)" etiketi zaten yapıldı), `src/lib/reports/**` ve `src/components/reports/**` (paralel 4A worker'ında; sonuçlarını testte doğrula ama yazma), Ayarlar formu (13-H1 alanları zaten var).
`convex/schema.ts` koordinatörde: yeni alan/index gerekirse YAZMA, `ask` ile iste ve cevabı bekle.
`src/components/shared/**`, `src/components/ui/**`, `src/lib/date.ts` değiştirilmez (gerekirse `ask`).

## Kapılar (hepsi yeşil; sayıları rapora yaz)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (başka worker'ın yarım dosyası yüzünden hata çıkarsa dosya adını raporla, onu düzeltme)
- `node_modules/.bin/eslint convex/lib convex/cardReadings.ts src/components/pdks src/pages/PDKSRecords.tsx` → 0 error
- `node_modules/.bin/vitest run convex src/components/pdks src/lib/reports` → yeşil
- Yeni testler: (a) 22:00–06:00 gece vardiyası tek iş gününe bağlanır, süre 8 sa; (b) vardiyasız kişi takvim günü davranışı değişmez; (c) gece penceresi dakikası + çarpanlı ücret; (d) 11-H2 üç yol aynı sayı; (e) manuel kayıtta gece vardiyalı kişide çıkış < giriş kabul, vardiyasızda red.

## Yasak
commit / push / deploy / migration / Convex DB yazma YOK. `npx convex dev|deploy|run` YOK. Paket ekleme YOK. Tarayıcıda veri değiştiren işlem YOK.

## Rapor (worker_done, ≤10 satır)
Bulgu ID → yapılan + `file:line` (kısa); 11-H2 kök nedeni tek cümle; yapılamayanlar ve nedeni; kapı sonuçları. Tam dosya listesi `--files-modified` ile.
