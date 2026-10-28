# Vardiya Paket B — denetim düzeltmesi 1 (aynı worker)

## Hedef
`.claude/review-vardiya-paketB.md`: Önemli 1-4 + Düşük 1, 3, 5, 6 kapanır. Düşük 2 (okuma sayacı istisnası) koordinatör onaylı — DOKUNMA. Düşük 4 (ölü pdksChart) DOKUNMA.

## Kararlar
1. **Önemli-1** `convex/dashboard.ts:266` gün atfı kapısı: `ruleRows.size > 0` koşulu yerine yalnız gerçekten plan/departman/çoklu günü olan kişi-gün (B'nin `usesPlanDayRules`
   veya eşdeğeri) + eski `usesShiftDayRules`. 0-1 vardiyalı, planı olmayan, versiyonlu politikalı projede eski `buildPdksWorkDateResolver` yolu birebir. Test: gece vardiyası +
   versiyonlu politika + plan yok → çıkış önceki güne atfedilir (eski davranış).
2. **Önemli-2** `computePdksCoreInMemory` (`dashboard.ts:330-345`) `overtimeHours`: `ruleRows` günü olan çalışanlar için `day.overtimeMinutes` toplanır (aynı dosyada `:432` yıllık
   mesai deseni); plan günü olmayanlarda eski hesap birebir. Test: iki vardiyalı günde aradaki boşluk fazla mesaiye girmez; döngü dolu cumartesi hafta sonu primi almaz.
3. **Önemli-3** `devamOrani` paydası: bugün `resolvePlan().kind === "rest"` olan kişiler paydadan çıkar (izinliler mevcut kuralda nasılsa öyle kalır). Plan yokken oran birebir. Test: 2 kişi, biri rest.
4. **Önemli-4** `reportAttendance.ts:71-79` takvim uyarısı `DayPlan`'dan türetilir: departman (veya kişi) haftalık planı (`calendar === "project"`) seçili günleri proje `workingDays` ile
   uyuşmuyorsa mevcut uyarı çıkar; `calendar === "plan"` günlerinde uyarı yok (bugünkü gibi). Kişi satırı için eski davranış birebir. Test.
5. **Düşük-1** `reportScope.ts:107-115` tarihsiz `shiftPlanRefs` probu: kod yorumu ile bilinçli kabul ("yalnız performans; sonuç bounded resolver'da doğru"). Kod değişmez.
6. **Düşük-3** `pdksSegmentValidator`: `rg pdksSegmentValidator src convex` kullanılmıyorsa KALDIR (tip `PdksSegment` kalır; C2 paralel çalışıyor, onun import'unu bozma — src'de kullanım varsa bırak ve raporla).
7. **Düşük-5** `pdksDay.ts` `classify`: gece taşan vardiyanın ertesi gün yarısı vardiya başlangıç gününün `dayKind`'ını alır (bilinçli: vardiya günü esas). Kod yorumu + test ile sabitle.
8. **Düşük-6** `pdksTable.ts:~300` çoklu vardiyada `lateTolerance` ilk / `shiftEnd`+`earlyExit` son parçadan — kısa kod yorumu.

## Ownership
Paket B ownership'i (convex/lib/pdks*.ts, reportAttendance.ts, reportScope.ts, processCardReadingCore.ts, cardReadings.ts, pdksRecords.ts, dashboard.ts, mobileAttendance.ts) + testleri.
`src/**` (C2 paralel çalışıyor), Paket A dosyaları, `_generated/**` DOKUNMA.

## Kurallar
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`; `npx convex`**. DB yazma YOK.
- TypeScript strict; `any` / `as any` / `!` YOK. Node import YOK.
- C2'nin src dosyalarından gelen geçici tsc/test hatasını DÜZELTME, raporda belirt.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
node scripts/find-node-leak.mjs
```

## Rapor
Her bulguya 1 satır yanıtı `.claude/review-vardiya-paketB.md` sonuna "## Worker yanıtı" olarak ekle. `worker_done` ≤10 satır: file:line + kapı sonuçları.
