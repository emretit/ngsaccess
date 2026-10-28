# Vardiya Paket A — plan modeli + çözümleyici + atama API'si (Codex K3)

## Hedef (test edilebilir)
Kişi ve departman atamaları haftalık çoklu vardiya / gün döngüsü / hafta döngüsü planı taşıyabilir; `resolvePlan(emp, date)` kişi > en yakın
departman > `employees.shiftId` > proje önceliğiyle `DayPlan` döner. **Plan/departman verisi yokken her mevcut sonuç birebir aynı** (tüm mevcut testler değişmeden geçer).

## Önce oku (zorunlu)
1. `convex/_generated/ai/guidelines.md`
2. `.claude/design/vardiya-model.md` — OTORİTER sentez; §5 sözleşmesini AYNEN uygula (tip/isim/arg değiştirme; B ve C buna göre yazılacak).
3. `.claude/design/vardiya-model-claude.md` §1 (veri modeli), §2 (çözümleme), §7 (A testleri) — ayrıntılar.

## Yapılacaklar
1. `convex/lib/shiftPlan.ts` (YENİ, saf): sabitler, `shiftPlanValidator`, `daySlotValidator`, `ShiftPlan`, `shiftPlanFields`, `slotForDate`,
   `validateDayShifts` (≤8, aynı vardiya iki kez yok, startTime sıralı, ardışık ≥30 dk boşluk, yalnız son vardiya gece taşabilir, ilk başlangıç→son bitiş ≤1440,
   esnek vardiya yalnız tek başına), `validateShiftPlan` (Claude §1.2 kuralları; dayCycle 1..31 slot; weekCycle anchor Pazartesi + slots.length%7===0, 1..52 hafta;
   döngüde weekPattern boş, en az bir dolu slot; birincil shiftId = sıralı ilk vardiya / döngüde ilk dolu slotun ilk vardiyası; tek vardiyalı haftalıkta `plan` YAZILMAZ),
   `planShiftIds`. Tarihler gerçek YYYY-MM-DD; negatif mod ile anchor öncesi.
2. `convex/schema.ts`: `shiftAssignments`'a `plan: v.optional(shiftPlanValidator)` + yeni `departmentShiftAssignments` ve `shiftPlanRefs` (Claude §1.2 index'leriyle).
   Yalnız ekleme; başka tabloya dokunma.
3. `convex/lib/shiftResolver.ts`: `DayPlan`, `resolvePlan` (memo), `resolveLast`; `resolve` = ilk vardiya, rest/none → null. Departman katmanı: proje başına
   `departments.by_project` + `departmentShiftAssignments.by_project_end` bounded (sentinel +1, aşınca Türkçe hata), zincir derinlik ≤32 + döngü koruması,
   farklı projede durur. `buildBoundedShiftResolver` plan/departman vardiya id'lerini de `db.get` ile yükler. Silinmiş vardiya → o satır atlanır (bugünkü davranış).
   Eşit `updatedAt` sırası bugünkü gibi (stable sort) — test.
4. `convex/lib/shiftUx.ts` / `shiftAssign.ts`: çakışma/önizleme (`scheduleIntervals`, `evaluateShiftAssignment`, `assignmentIntersectsRange`) plan-aware
   (çoklu vardiyanın her aralığı; döngüde yalnız dolu günler). Planı olmayan satırda sonuç aynen.
5. `convex/shifts.ts`: §5.3'teki değişiklikler (`includePlans`, `plan?` argümanları, update'te plan korunması, `shiftPlanRefs` aynı mutasyonda sil+yaz,
   vardiya silme/etki sorguları refs + departman atamalarını sayar). Esnek vardiyayı çoklu güne koymak → ConvexError.
6. `convex/shiftPlans.ts` (YENİ): §5.3 departman CRUD + önizleme + `planCells`. `convex/_generated/api.d.ts`'e ELLE yalnız 2 satır:
   `import type * as shiftPlans from "../shiftPlans.js";` ve fullApi içine `shiftPlans: typeof shiftPlans;` (alfabetik yere). Başka _generated dosyasına dokunma.
7. `convex/departments.ts`: `remove` departman ataması varsa engeller (Türkçe mesaj).
8. `convex/lib/cardReadingProcess.ts` `directionShift` (~44-60): kendi kopya çözümleyicisi yerine ortak çözümleme (bounded, departman dahil) → okutma
   yönü için `resolveLast` mantığı. Davranış plan yokken aynı.

## Kapsam dışı (DOKUNMA — Paket B/C'nin)
`convex/lib/pdks*.ts`, `reportAttendance.ts`, `reportScope.ts`, `processCardReadingCore.ts`, `convex/cardReadings.ts`, `pdksRecords.ts`, `dashboard.ts`,
`mobileAttendance.ts` (B) · `src/**` (C) · `mobile/**` · yayın. Hesap motoru `DayPlan`'ı henüz tüketmez; bu normal.
Mevcut `resolve()` çağıranları derlenmeye devam etmeli (imza değişmez).

## Ownership
`convex/schema.ts` (yalnız shiftAssignments + 2 yeni tablo), `convex/lib/shiftPlan.ts`, `convex/lib/shiftResolver.ts`, `convex/lib/shiftAssign.ts`,
`convex/lib/shiftUx.ts`, `convex/shifts.ts`, `convex/shiftPlans.ts`, `convex/departments.ts`, `convex/lib/cardReadingProcess.ts`,
`convex/_generated/api.d.ts` (yalnız 2 satır), bunların testleri (yeni test dosyaları serbest).

## Kurallar
- TypeScript strict; `any` / `as any` / `!` YOK; `Doc|null` filtre: `filter((p): p is NonNullable<typeof p> => p !== null)`. camelCase.
- Node modülü import eden convex dosyası YOK ("use node" gerektirecek import ekleme).
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
Yeni testler (en az): Claude §7 "Çözümleme (A)" listesinin tamamı + `validateDayShifts` sınırları (8/9 vardiya, 29/30 dk ara, gece yalnız sonda, esnek+sabit red)
+ `plan` yokken `resolve` ≡ eski (mevcut fixture'larla karşılaştırma) + `listAssignments` `includePlans` yokken plan satırı dönmez + refs atomik sil/yaz
+ `departments.remove` engeli + `planCells` kaynak alanları + `_generated/api.d.ts` ile `api.shiftPlans.*` tsc'den geçer.

## Rapor
`worker_done` ≤10 satır: değişen/yeni dosyalar (file:line), kapı sonuçları (test dosya/test sayısı), sözleşmeden sapma (olmamalı; olduysa neden), açık sorular.
