# Denetim — Vardiyasız çalışanda PDKS yok (Claude, salt okuma) 2026-10-25

Repo: /Users/emreaydin/ngsaccess (ana dizin). Yazan: Codex worker. Sen denetçisin: KOD DEĞİŞTİRME.
Tek yazacağın dosya: `.claude/review-vardiyasiz-pdks.md`.

## Okunacaklar
- Spec (kurallar): `.claude/orca-specs/vardiyasiz-pdks.md` — özellikle "Kurallar" 1-11.
- Ek koordinatör kararları: SGK APHB'de tamamen plansız kişi XML'e girmez + kişi başı uyarı; ham geçiş yönü için legacy
  `employees.shiftId` fallback yalnız `convex/lib/cardReadingProcess.ts`'te; mobil `presentDays` ham geçiş günü anlamında kalır,
  yeni opsiyonel `totals.pdksPresentDays` eklenir (yayımlı Flutter parser'ı kırılmasın); test fixture'larına davranış-nötr tarihli atama izinli.
- Worker raporu: `.claude/reports/vardiyasiz-pdks-report.md` (iddia; doğrulamadan kabul etme).
- DİFF: `git diff -- <dosya>` ile aşağıdaki listeyi oku. Çalışma ağacında BAŞKA oturumun commit'siz değişiklikleri de var
  (employees/devices/leaves/reportScope.ts/PDKSRecords.tsx/CorrectionRequestsPanel/audit/mobile vb.) — onları denetleme.
  `convex/payVisibility.handlers.test.ts`'te yalnız fixture hunk'ı bu işe ait (K-03 `isVisitor` hunk'ı başka oturumun).

Bu işin dosyaları: convex/lib/{shiftResolver,pdksMultiShift,pdksTable,pdksPayroll,pdksDetail,pdksPayrollQuery,processCardReadingCore,
reportAttendance,pdksChart,mobileAttendance,cardReadingProcess,pdksManualWrite}.ts, convex/{dashboard,mobileAttendance,sgkExport,pdksRecords}.ts,
src/components/pdks/dashboard/{PdksRowStatus,PDKSTableView,PDKSMobileCardList,PDKSHeatmapView,PDKSEmployeeDetailDrawer}.tsx,
src/components/pdks/{statusMeta.ts,lib/presentation.ts,lib/analysis.ts,records/recordsView.ts}, src/components/shifts/{ShiftDayDetails,ShiftCalendarCell}.tsx
+ testler (convex/noShift.test.ts, src/components/pdks/dashboard/noShift.test.tsx ve raporda listelenen fixture değişiklikleri, snapshot).

## Denetim soruları (her birine kanıtlı cevap)
1. **Sızıntı:** plansız (`kind:"none"`) günde proje çalışma saatleriyle (workStartTime/EndTime, thresholdsForShift/settingsForShift(null…))
   hâlâ PDKS hesabı yapan üretim yolu kaldı mı? `computePdksDay`/gün hesabını guard'sız çağıran yer var mı? grep ile tara, file:line ver.
2. Plansız güne düşen elle kayıt / onaylı düzeltme / onaylı izin / resmi tatil PDKS gösterimine, toplamlara, bordroya, SGK'ya giriyor mu?
3. **Kısmi dönem:** ay ortasında başlayan/biten atama → yalnız atamalı günler; SGK prim günü (30 gün kuralı) ve bordro doğru mu?
   Departman zinciri ataması ve `rest` (döngüde boş gün) davranışı korunmuş mu?
4. **Geç kalma e-postası** plansızda tetiklenmiyor mu; planlıda eskisi gibi mi?
5. **Mobil geriye uyum:** `git show HEAD:mobile/lib/models/attendance_summary.dart` (+ attendance.dart, repository, provider) ile yanıt
   şeklini karşılaştır; yayımlı istemciyi kıracak alan/anlam/invariant değişikliği var mı?
6. **Geçiş verisi korunuyor mu:** ham geçiş listeleri, kapı raporları, dashboard ham metrikleri, cardReadingProcess yön fallback'i
   PDKS'ye sızmadan çalışıyor mu?
7. **Performans/kota (Convex Free, function call + okuma limitleri):** rapor adaptörüne eklenen çalışan başı bounded `shiftAssignments`
   okumaları büyük projede (ör. 500 çalışan, 31 gün) okuma/sorgu limitine takılır mı? w53 query-count assertion artışı makul mü?
8. **Test zayıflatma:** değişen testlerde assertion silinmiş/gevşetilmiş, beklenti eski davranışı gizleyecek şekilde değiştirilmiş mi?
   Snapshot (`convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap`) değişikliği yalnız sorgu izi mi? Fixture'lar davranış-nötr mü?
9. **UI:** tamamen plansız satır gri + "Vardiya atanmamış" + `?plan=1` kısayolu + sayılar "—"; kısmi dönemde "Vardiya yok" hücresi;
   durum filtreleri/üst sayaçlar/dışa aktarma plansızı dışlıyor mu? Erişilebilirlik (link metni, kontrast) sorunu var mı?
10. **Kod kuralları:** `any`/`as any` yok, `!` yok, camelCase, Türkçe metin; gereksiz tekrar/ölü kod.

## Koşacağın kapılar (kendi çıktına dayan)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/vitest run convex/noShift.test.ts src/components/pdks convex/lib/shiftResolver.test.ts convex/mobileAttendance.test.ts convex/processCardReading.characterization.test.ts convex/reports.attendance.test.ts
```
İstersen ek hedefli testler yaz-koş ama dosyayı BIRAKMA (geçici testi /tmp altında tut ya da sil).

## YASAK
Kod düzenleme (rapor dosyası hariç) · `git add/commit/stash/reset/checkout/switch/restore/clean` · `npx convex` · DB/MCP · deploy · push.

## Rapor
`.claude/review-vardiyasiz-pdks.md`: üstte 1-2 cümle sonuç + sayılar (Engel / Önemli / Düşük). Her bulgu: seviye, file:line,
senaryo (girdi → yanlış çıktı), önerilen düzeltme. Sonda 10 sorunun her birine kısa cevap. `worker_done` gövdesi ≤10 satır.
