# Vardiya birleşik denetim — convex düzeltmesi (aynı A/B worker)

## Hedef
`.claude/review-vardiya-birlesik.md` convex bulguları kapanır: Önemli 2, 3, 4, 5 + Düşük 3, 5. Plansız projede canlı sonuç birebir kalır.

## Kararlar (koordinatör)
1. **Önemli-2** `convex/lib/pdksMultiShift.ts:79` `mergePdksDays`: `dayKind` TANIMSIZ ve takvim sınıfı `weekend`/`holiday` olan çok vardiyalı günde `attendanceDecision` YAZILMAZ →
   `resolveDayStatus` tek vardiya yoluyla aynı çalışır (okutma varsa present/late, yoksa weekend/holiday; incomplete/absent YOK). Dakika = parça toplamı (değişmez).
   İş günü ve `dayKind` tanımlı (döngü) günlerde bugünkü karar mantığı aynen. Testler (`pdksMultiShift.test.ts`): Cumartesi (proje çalışma günü değil) haftalık 2 vardiya
   ikisi çalışıldı → durum tek vardiya ile aynı sınıf (present/late), dakika 450; aynı gün hiç okutma yok → weekend; iş gününde bir parça kaçırıldı → incomplete (regresyon).
2. **Önemli-3** vardiya filtresi (`pdksTableQuery.ts:122`, `dashboard.ts:248`) YENİ anlam KABUL (dönemde çözümlenen planda vardiya var mı). Kod değişmez; her iki yere 1 satır yorum +
   test: varsayılan vardiyası X, dönem boyunca kişisel atamayla Y → Y filtresinde çıkar, X filtresinde çıkmaz.
3. **Önemli-4** `dashboard.ts:349` `overtimeHours`: `ruleRows` toplamı YALNIZ plan günü olan kişi-günde (`usesPlanDayRules` / önceki fix1 Önemli-1 kapısıyla aynı küme) kullanılır;
   planı olmayan sürümlü/esnek/sabit kurallı projede `computePdksCoreInMemory`'nin HEAD (`git show 8f57a2d9:convex/dashboard.ts`) hesabı birebir. Test: sürümlü politika + plan yok →
   overtimeHours HEAD formülüyle aynı (eski fixture, `toBe`).
4. **Önemli-5** `convex/shiftPlans.ts:63` `prepare` (departman önizlemesi): izinleri tarih sınırlı oku (`leaves.by_employee_start`, `startDate <= args.endDate`, bitişi bellekte filtrele;
   `mobileAttendance.ts` deseni), atamaları da dönemle sınırla. Bütçe/sentinel davranışı (`take(limit+1)` + Türkçe ConvexError) korunur. Test: 300 çalışan × 20 eski izin (dönem dışı) → hata yok.
5. **Düşük-3** `processCardReadingCore.ts:468` `notifyLateReading`: `buildShiftResolver` çağrısına `{ start: date, end: date }` aralığı (directionShift deseni). Davranış aynı.
6. **Düşük-5** `dashboard.ts:395` `devamOrani`: çağıranlar yalnız tek gün aralığı veriyorsa 1 satır yorum ("tek gün; aralıkta gün başına sayılmalı"); çok günlü aralık mümkünse gün başına say + test.
7. Düşük-4 (pdksChart) ve Düşük-7 (mesaj metni) DOKUNMA.

## Ownership
`convex/**` (A+B dosyaları) + testleri. `src/**` (C worker paralel çalışıyor), `convex/_generated/**`, `convex/schema.ts` DOKUNMA (şema değişikliği gerekiyorsa DUR, sor).

## Kurallar
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`; `npx convex`**. DB yazma YOK.
- TypeScript strict; `any` / `as any` / `!` YOK. Node import YOK. Mevcut test beklentisini değiştirme/silme (değişmesi gerekiyorsa DUR, sor).
- src'den gelen geçici tsc/test hatasını DÜZELTME, raporda belirt.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
node scripts/find-node-leak.mjs
```

## Rapor
`.claude/review-vardiya-birlesik.md` sonuna "## Worker yanıtı (convex)" — her bulguya 1 satır (file:line). `worker_done` ≤10 satır: file:line + kapı sonuçları.
