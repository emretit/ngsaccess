# Vardiya Paket B — hesap motoru: departman/döngü/çoklu vardiya (Codex K3)

## Hedef (test edilebilir)
PDKS tablo/detay/bordro/rapor/dashboard/mobil özet hesabı `resolvePlan`'ı kullanır: döngüde boş gün hafta tatili, dolu gün iş günü; günde 2+ vardiyada
okutmalar parçalara bölünür, her parça mevcut `computePdksDay` ile hesaplanır ve birleştirilir. **0-1 vardiyalı günlerde sonuç birebir aynı** (altın test).

## Önce oku (zorunlu)
1. `convex/_generated/ai/guidelines.md`
2. `.claude/design/vardiya-model.md` — OTORİTER sentez (§1 Emre kararları, §3 Codex'ten alınanlar, §4 ertelenenler, §5 sözleşme).
3. `.claude/design/vardiya-model-claude.md` §3 (hesap motoru: çağıran tablosu, `splitReadingsByShift`, `mergePdksDays`, değişmezlik) + §5 (mobil) + §7 "Hesap (B)".
4. Paket A'nın çıktısı (commit'li/çalışma ağacında): `convex/lib/shiftPlan.ts`, `convex/lib/shiftResolver.ts` (`DayPlan`, `resolvePlan`, `resolveLast`).

## Yapılacaklar
1. `convex/lib/pdksDay.ts`: opsiyonel `dayKind?: "rest" | "work"` → tatil yoksa `rest`→`weekend`, `work`→`workday`; undefined → bugünkü. Faz 1 `holidayWorkRequired` önceliği korunur.
2. `convex/lib/pdksMultiShift.ts` (YENİ, saf): `computePdksPlannedDay`, `splitReadingsByShift` (pencere → yön → orta nokta), `mergePdksDays` (Claude §3.4 tablosu;
   net süre = parça toplamı; `segments` yalnız ≥2 vardiyada; karar: hepsi present→present, hepsi absent→absent, karışık→incomplete), `manualForSegment` (giriş ilk, çıkış son parça).
3. Çağıranlar (Claude §3.1 tablosunun TAMAMI, kendi ownership'indeki dosyalarda): `pdksTable`, `pdksPayroll`, `pdksDetail`, `pdksWorkDay` (`resolveLast`),
   `pdksTableQuery` (vardiya filtresi: aralıkta `resolvePlan` içinde vardiya geçen kişi), `pdksPayrollQuery`, `pdksManualWrite` (`resolveLast` gece kontrolü),
   `reportAttendance` (`calendar === "plan"` günlerde takvim uyarısı yok; Faz 1 `usesShiftDayRules` kapısı plan/departman günlerini de kapsar), `reportScope`,
   `processCardReadingCore` (`notifyLateReading`: okutma anına en yakın parçanın vardiyası), `convex/cardReadings.ts` (gün detayı `dayPlan`), `pdksRecords.ts`,
   `dashboard.ts` (rest günü devamsız sayılmaz; geç sayımı parça bazlı), `mobileAttendance.ts` (summary `resolvePlan`; return validator DEĞİŞMEZ).
   `rg "\.resolve\("` ile her çağıranı gez; çoklu/rest gününü yanlış sayacak olanı taşı, kalanını bilerek bırak ve raporda listele.
4. `calculatePeriodOvertime` kişi/dönem başına BİR kez (parça segmentleri birleşir). Mola: her parça kendi vardiya molası; vardiyalar arası boşluk mola değil.
5. Gün sonucu ve `PdksDayDetail`'e opsiyonel `segments` (≥2 vardiyada): `{ shiftId, shiftName, plannedStart, plannedEnd, firstISO, lastISO, totalMinutes,
   lateMinutes, earlyExitMinutes, overtimeMinutes, decision }` + opsiyonel `planKind?: "rest"`. Validator'lı query dönüşlerinde opsiyonel alan olarak ekle;
   0-1 vardiyalı günde alan HİÇ eklenmez (DTO snapshot'ları değişmez).

## Kapsam dışı (DOKUNMA)
Paket A dosyaları (`convex/schema.ts`, `convex/lib/shiftPlan.ts`, `shiftResolver.ts`, `shiftAssign.ts`, `shiftUx.ts`, `convex/shifts.ts`, `convex/shiftPlans.ts`,
`convex/departments.ts`, `cardReadingProcess.ts`, `_generated/**`) — A'da hata/eksik bulursan DÜZELTME, `ask` ile koordinatöre sor.
`src/**` (Paket C paralel çalışıyor) · `mobile/**` · yayın. Ertelenenler (sentez §4) yapılmaz.

## Ownership
`convex/lib/pdksDay.ts`, `convex/lib/pdksMultiShift.ts` (yeni), `pdksWorkDay.ts`, `pdksTable.ts`, `pdksPayroll.ts`, `pdksDetail.ts`, `pdksTableQuery.ts`,
`pdksPayrollQuery.ts`, `pdksManualWrite.ts`, `reportAttendance.ts`, `reportScope.ts`, `processCardReadingCore.ts`, `convex/cardReadings.ts`,
`convex/pdksRecords.ts`, `convex/dashboard.ts`, `convex/mobileAttendance.ts`, bunların testleri (yeni test dosyaları serbest).

## Kurallar
- TypeScript strict; `any` / `as any` / `!` YOK. camelCase. Node modülü import eden convex dosyası YOK.
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`** — commit'i koordinatör atar.
- **YASAK: `npx convex` (dev/deploy/codegen/run dahil)**. DB yazma YOK. Worktree açma. Yayın YOK.

## Kapılar (hepsi yeşil olmadan worker_done gönderme)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
node scripts/find-node-leak.mjs
```
Yeni testler (en az): Claude §7 "Değişmezlik" (altın `toStrictEqual`: tek vardiya plan ≡ `computePdksDay`, `none` ≡ `shift: null`, `computePdksTableRow` resolvePlan'lı/
resolvePlan'sız aynı) + "Hesap (B)" listesinin tamamı + dashboard rest günü devamsız değil + mobil `summary` departman çalışanında `presentDays`.
Not: `src` testleri convex modüllerini `vi.mock`'luyor — TAM `vitest run` şart.

## Paralel çalışma notu
Paket C1 (arayüz, yalnız src/**) aynı anda başka bir worker'da çalışıyor (ownership ayrık). Kapılarda yalnız ONUN dosyalarından gelen geçici tsc/test hatası görürsen
DÜZELTME; kendi dosyalarının temiz olduğunu göster (ör. ilgili test dosyalarını ayrıca koş) ve `ask` ile koordinatöre bildir.
Paket A + düzeltmesi çalışma ağacında, COMMIT EDİLMEDİ (normal) — A dosyalarını değiştirme.

## Rapor
`worker_done` ≤10 satır: değişen/yeni dosyalar (file:line), kapı sonuçları (test sayısı), bilerek taşınmayan `.resolve(` çağıranları, açık sorular.
