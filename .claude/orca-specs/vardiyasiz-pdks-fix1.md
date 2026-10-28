# Düzeltme 1 — Vardiyasız PDKS denetim bulguları (Codex, aynı worker) 2026-10-25

Önceki işin devamı: spec `.claude/orca-specs/vardiyasiz-pdks.md` (kurallar + ownership + YASAK listesi AYNEN geçerli),
denetim raporu `.claude/review-vardiyasiz-pdks.md` (bulgu numaraları oradan). Her bulguyu düzelt, rapora yanıt yaz.

## Yapılacaklar
1. **E-1 (Engel) bordro Excel kayması:** iki katman birden:
   (a) sunucu (`convex/lib/pdksPayrollQuery.ts` ~175) kısmi dönemde plansız gün için de hücre döndürsün:
   `noShift: true`, kod "—", hiçbir toplama/sayaca girmez (tamamen plansız kişi yine satır üretmez);
   (b) `src/utils/pdksExport.ts` ~290 hücreyi sıraya göre değil TARİHE göre yerleştirsin (`data.days.indexOf(cell.date)`; bulunamazsa atla).
   Test: 15'inde başlayan atama → Excel'de 15'i "15" sütununda, 1-14 "—"; ortası boş atama (1-10, 20-30) senaryosu.
   Bu cetvel hücrelerini sıraya göre okuyan başka tüketici var mı tara, raporla.
2. **Ö-1 performans:** (1) rapor adaptörünün (`convex/lib/reportAttendance.ts` ~400) kurduğu plan çözümleyicisini/`hasPlan`'ı dönüşte
   paylaş; `convex/sgkExport.ts` ve ana sayfa yeniden kurmasın. (2) `buildBoundedShiftResolver` aralık verildiğinde
   `shiftAssignments` için `by_employee_end` + `gte("endDate", range.start)` kullansın; `readDepartmentPlans`'e de aralık geçsin
   (mevcut indeksler; şema değişikliği YOK). (3) Ana sayfa yolunda mevcut `shiftResolver` adaptöre dışarıdan verilebilsin.
   Projedeki eski atama geçmişi 10.000'i aşınca ana sayfa/rapor düşmesin: aralık sınırlı okuma bunu çözmeli — testle göster.
3. **Ö-2 korumalar:** `convex/w53Integration.test.ts` D3 ve `convex/w5aFix1.test.ts` D1'de gevşetilen korumaları Ö-1 sonrası
   ÜST SINIR assertion'ı ile geri koy (ikinci kopya okuma yok; yabancı/legacy proje için gereksiz `employees` okuması yok;
   sorgu sayısı N kişi için ≤ 1 proje-bazlı + N kişi-bazlı). Test adlarını amacı anlatacak şekilde düzelt.
4. **Ö-3 SGK kısmi ay:** `convex/sgkExport.ts`: planlı gün sayısı istihdam günlerinden azsa isimli uyarı ekle:
   "<adSoyad>: <N> gün vardiya atanmamış; prim günü yalnız vardiyalı günlerden hesaplandı, bildirimden önce kontrol edin."
   Hesap kuralını DEĞİŞTİRME (Emre kararı bekleniyor).
5. **D-1:** `convex/reports.ts` ~71 `leaveDaysInMonth` plansız günleri saymasın (adaptörün `hasPlan`'ı ile süz). Test ekle.
6. **D-2:** `src/components/pdks/dashboard/PdksRowStatus.tsx` düz `<a href="?plan=1">` yerine `useShiftPlanOpen().setOpen(true)`
   çağıran `<button type="button">` (mevcut sorgu parametreleri korunur, sayfa yenilenmez); `usePermissions().can("schedule.manage")`
   yoksa yalnız etiket. Çalışanı ön seçmek mevcut hook ile kolaysa yap, değilse raporda "yapılmadı" yaz. Gri satırda hover rengi
   gri kalsın. Test güncelle.
7. **D-3:** `convex/lib/pdksChart.ts` ~116 `as Id<"employees">` dönüşümünü kaldır (tipli tut).
8. **D-4:** `convex/lib/shiftResolver.ts` ~79 legacy `employee.shiftId` `db.get`'i yalnız elle kayıt doğrulaması
   (`manualValidationShift`) gerektiğinde yapılsın; rapor/mobil çağrılarında okunmasın.
9. **D-5:** `convex/sgkExport.ts` ~75 ve `convex/dashboard.ts` ~274, ~331: `resolvePlan` sonucunu diğer yollar gibi
   `scopedPdksPlan(…, projectId)` ile kapsamla.

## Ownership
Önceki spec'teki izinli dosyalar + bu turda ek: `src/utils/pdksExport.ts` (+ testi), `convex/reports.ts` (+ testi),
`src/components/shifts/ShiftPlanSheet.tsx` (yalnız hook'u dışa açmak gerekirse). YASAK liste aynen; `src/pages/PDKSRecords.tsx`,
`CorrectionRequestsPanel*`, `convex/lib/reportScope.ts` hâlâ YASAK. Her yazmadan önce `git diff --stat -- <dosya>`: senin yapmadığın
değişiklik varsa `ask`.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
node scripts/find-node-leak.mjs
```

## YASAK
`git add/commit/stash/reset/checkout/switch/restore/clean` · `npx convex` (codegen dahil) · MCP · DB yazma · deploy · push · worktree.

## Rapor
`.claude/review-vardiyasiz-pdks.md` sonuna "## Düzeltme 1 yanıtları" bölümü: her bulgu için yapılan + file:line + test adı.
Ayrıca `.claude/reports/vardiyasiz-pdks-report.md` kapı tablosunu güncelle. `worker_done` ≤10 satır.
