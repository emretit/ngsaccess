# Görev: PDKS Kayıtları sayfası — UX-0 fonksiyonel hata düzeltmeleri (yalnız frontend)

Repo: /Users/emreaydin/ngsaccess (React + Vite + shadcn/ui, backend Convex). Bağlam: `docs/PDKS_KAYITLARI_UX_PLANI_2026-10-16.md` §2 (U1–U8) ve §4 UX-0. Kullanıcıya görünen metinler Türkçe.

## Hedef (test edilebilir)
`/pdks-records` sayfasında: (1) günlük modda geçmiş bir gün açılabiliyor ve URL'de kalıyor, (2) "Son 7 gün" gerçekten son 7 günü gösteriyor, (3) özet kartlar ve grafikler seçili dönemi gösteriyor, (4) manuel düzeltme hiçbir zaman yanlış güne yazmıyor, (5) sahte "Yenile" ve tam ekran spinner yok.

## Değişiklik
1. **Tarih çapası (U1):** `FilterValues`'a opsiyonel `anchorDate?: Date` ekle (`PDKSFilterBar.tsx`), URL'de `date=yyyy-MM-dd` (`usePdksFilterParams.ts`, `toLocalDateString` kullan; yoksa bugün). `usePdksTableData` iç `selectedDate` state'ini kaldırıp `filters.anchorDate ?? bugün` kullansın.
2. **Yeni `src/components/pdks/dashboard/PDKSDateNavigator.tsx`:** ◀ etiket ▶ + "Bugün" butonu; adım = günlük 1 gün, haftalık 1 hafta, aylık 1 ay; `custom` modda oklar gizli. Sayfa başlığında `dateRangeLabel` Badge'inin yerine konur. Etiket `date-fns` `tr` locale ile.
3. **Preset'ler (U2):** `PDKSQuickPresets.tsx` — "Bugün/Bu hafta/Bu ay" `anchorDate=bugün` + ilgili `reportType` + `dateRange` temiz; "Son 7 gün" ve "Son 30 gün" `custom` + aralık. Aktif vurgu yeni modele göre doğru olsun. `PDKSFilterBar` içindeki `QUICK_CHIPS` (4 chip) aynı modele uysun (weekly chip'ler `anchorDate=bugün`).
4. **Durum filtresi client-side (U3 ön koşulu):** `usePdksTableData` sunucuya `statusFilter` GÖNDERMESİN; tüm satırları `allRecords` olarak döndürsün, `tableRecords` = client-side süzülmüş (`convex/lib/pdksTable.ts#filterPdksTableRows` ile aynı semantik: `overtime` → `overtimeHours > 0`, diğerleri `status ===`). Frontend `convex/lib/*` saf modüllerini import edebilir (örn. `convex/lib/hikModels`), `filterPdksTableRows`'u doğrudan import et.
5. **KPI seçili dönemden (U3):** yeni saf `src/lib/pdksSummary.ts` + `src/lib/pdksSummary.test.ts`: `allRecords` (durum filtresi uygulanmamış) → `{ totalEmployees, present, late, absent, leave, overtimeHours, attendanceRate }`. Günlük modda satır `status`'undan; dönem modunda (`days[]` dolu) kişi-gün sayımı (`weekend`/`holiday` hariç). `PDKSSummaryCards` bu özeti göstersin. `usePdksStats` yalnız "İçeride" kartı ve trend/sparkline için, YALNIZ günlük mod + çapa = bugün iken kullanılsın; aksi halde bu kart/trendler gizli. Kart tıklaması durum filtresini ayarlamaya devam etsin.
6. **Grafikler (U3):** `PDKSChartView` + `usePdksChartData` `startDate`/`endDate` prop alsın: dönem modunda seçili dönem; günlük modda çapa gününde biten son 7 gün. (Backend `getPdksChartData` yalnız tarih alır — firma/departman filtresi bu fazda YOK, dokunma.)
7. **Düzeltme günü (U4):** `PDKSTableView` + `PDKSMobileCardList`'te manuel düzelt butonu yalnız günlük modda görünsün ve tarihi çapa gününden alsın; dönem modunda gizli. Prop'u sayfadan geçir (ör. `editDate?: string` — yoksa düzenleme kapalı).
8. **U5/U8/U7:** `PDKSRecords.tsx`'ten sahte "Yenile" butonu + `handleRefreshData` kaldır; `statsLoading` tam ekran spinner'ı kaldır (sayfa hep render olur, kartlar `Skeleton` ile). `PDKSSmartPresets` "Mola ihlali" çapa gününü sorgulasın, etiketi tarihi göstersin (bugünse "bugün").
9. Sayfa başlığı "PDKS Dashboard" → "PDKS Kayıtları".

## Ownership (YALNIZ bunlara yaz)
src/pages/PDKSRecords.tsx · src/hooks/usePdksTableData.ts · src/hooks/usePdksFilterParams.ts · src/hooks/usePdksChartData.ts · src/hooks/usePdksStats.ts · src/lib/pdksDateRanges.ts · src/lib/pdksSummary.ts (yeni) · src/lib/pdksSummary.test.ts (yeni) · src/components/pdks/dashboard/{PDKSDateNavigator.tsx (yeni), PDKSFilterBar.tsx, PDKSQuickPresets.tsx, PDKSSmartPresets.tsx, PDKSSummaryCards.tsx, PDKSChartView.tsx, PDKSTableView.tsx, PDKSMobileCardList.tsx, PDKSActiveFilterChips.tsx, PDKSMobileDrawer.tsx, PDKSSavedViews.tsx} · src/hooks/usePdksSavedViews.ts (yalnız `anchorDate` serileştirme gerekiyorsa).

## Kapsam dışı / DOKUNMA
`convex/**` (başka iş paralel olarak `convex/cardReadings.ts`'i değiştiriyor). Tasarım yenileme (UX-1/UX-2: filtre popover'ı, durum sekmeleri, export menüsü, puantaj matrisi, renk haritası) bu görevde YOK — mevcut görünümü koru, yalnız listelenen hataları düzelt. `mobile/`, `PDKSInlineQuery`, AI bileşenleri, `PDKSEnhancedExportPanel`.

## Proje kuralları
TypeScript strict; `any`/`as any` YASAK (eslint error) → `unknown` + narrowing; `!` yerine optional chaining + erken return. Convex sonuç tipleri için `FunctionReturnType<typeof api.X.Y>`. Mevcut stil, isimlendirme ve Türkçe yorum yoğunluğunu takip et; gereksiz yorum ekleme.

## YASAK
commit / push / deploy (`npx convex dev`, `npx convex deploy`) / migration / canlı DB'ye yazma (Convex/Supabase MCP dahil) YOK.

## Kapılar (hepsi yeşil olmalı)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex/tsconfig.json
node_modules/.bin/eslint src convex   (0 error)
npx vitest run   (başlangıç: 21 dosya / 289 test yeşil; yeni pdksSummary testleri eklenir)

## Rapor
worker_done özetinde ≤10 satır: değişen/yeni dosyalar file:line, U1–U8 her biri için ne yapıldı (1 satır), kapı sonuçları, bilinçli olarak yapılmayan/şüpheli kalan noktalar.
