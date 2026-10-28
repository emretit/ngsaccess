# Vardiya Paket A — denetim düzeltmesi 1 (aynı worker)

## Hedef
`.claude/review-vardiya-paketA.md` bulgularından Engel-1, Önemli-1, Önemli-2, Düşük-1..4 düzeltilir; Düşük-5/6 DOKUNULMAZ (bilinçli sınır). Mevcut testler değişmeden geçer.

## Düzeltmeler (rapordaki öneriler geçerli; kararlar)
1. **Engel-1** — çalışan silinince `shiftPlanRefs` yetimi: `convex/employees.ts` / `convex/lib/employeeUx.ts` çalışan silme döngüsünde `shiftAssignments` satırı silinmeden önce
   `syncPlanRefs` ile refs temizlenir. Ayrıca `shifts.ts` `remove`: ref bulununca sahibini `db.get` ile doğrula; sahibi yoksa ref'i sil ve devam et (self-heal).
   Test: planlı atamalı çalışanı sil → refs 0 → ikinci vardiya silinebilir; yetim ref varken `remove` başarılı + ref silinmiş.
2. **Önemli-1** — `definitionPlanLinks` limit aşımında throw ETMEZ, `{ truncated: true }` döner; `definitionImpacts` bunu mevcut `truncated`/"En az" yoluyla işler. Test rapordaki senaryo.
3. **Önemli-2** — saklı planı olan satırda `plan` verilmeden `shiftId` gelirse (kişi `updateAssignment` + `updateDepartmentAssignment`):
   `ConvexError("Planlı atamada vardiyayı plan üzerinden değiştirin")`. Tarih/weekPattern gibi diğer alanların plansız güncellemesi çalışmaya devam eder. Test.
4. **Düşük-1** — `convex/lib/adminGuards.ts` `projectDeletionBlockingTables`'a `departmentShiftAssignments` ve `shiftPlanRefs` (varsa test güncelle değil, ekle).
5. **Düşük-2** — değişmezlik: `readDepartmentPlans` önce projenin `departmentShiftAssignments`'ını okur; hiç yoksa `departments` OKUNMAZ ve departman katmanı atlanır
   (2000+ departmanlı ama atamasız projede `resolve()` hata vermez). Test.
6. **Düşük-3** — `validateShiftPlan`: döngüde ardışık slotlar (son→ilk dahil, `% length`) için önceki slotun gece taşan son vardiyasının bitişi ile sonraki slotun ilk
   vardiya başlangıcı arasında ≥30 dk (`MIN_SPLIT_GAP_MINUTES`). Haftalık planda da gece taşan son vardiya ile ertesi seçili günün ilk vardiyası için aynı kontrol. Test.
7. **Düşük-4** — `shiftPlans.ts` departman atama ekle/güncelle/sil `writeAudit` yazar (kişi atamalarındaki desenle aynı action isim stili). Test (audit satırı oluşur).

## Ownership (genişledi)
Önceki Paket A ownership'i + `convex/employees.ts`, `convex/lib/employeeUx.ts`, `convex/lib/adminGuards.ts` (yalnız yukarıdaki değişiklikler için) + testleri.
Paket B/C dosyalarına dokunma (`convex/lib/pdks*.ts`, `reportAttendance.ts`, `reportScope.ts`, `processCardReadingCore.ts`, `cardReadings.ts`, `pdksRecords.ts`,
`dashboard.ts`, `mobileAttendance.ts`, `src/**`).

## Kurallar
- **YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git switch`, `git restore`, `git worktree`; `npx convex` (codegen dahil)**. DB yazma YOK.
- TypeScript strict; `any` / `as any` / `!` YOK. Node import YOK.

## Kapılar
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/eslint src convex
node_modules/.bin/vitest run
node scripts/find-node-leak.mjs
```

## Rapor
Her bulguya 1 satır yanıtı `.claude/review-vardiya-paketA.md` sonuna "## Worker yanıtı" olarak ekle. `worker_done` ≤10 satır: file:line + kapı sonuçları.
