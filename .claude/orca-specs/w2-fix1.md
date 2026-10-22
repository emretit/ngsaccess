# W2 düzeltme turu 1 — denetim bulguları (P2-1..P2-5, N2, P3-1)

Bağlam: W2 kodu çalışma ağacında COMMIT'SİZ (spec `.claude/orca-specs/w2-ayrilma.md`). Denetim raporu: `.claude/orca-specs/w2-denetim-rapor.md` — ÖNCE oku. Yalnız aşağıdaki maddeleri düzelt; başka refactor yok.

## Ortak kurallar
- TypeScript strict; `any`/`as any` YASAK; `unknown` + narrowing; `!` yerine erken return. Türkçe `ConvexError` mesajları. Tarih anahtarı `convex/lib/trDate.ts` (`trTodayKey`).
- YASAK: commit, push, deploy, `npx convex *`, DB yazma, `convex/_generated/**`, `mobile/**`, git stash/checkout/reset.

## Değişiklik
1. **P2-1 / N1 alt sınır** (`convex/employeeTermination.ts` terminate): `employmentEndDate` en erken `trTodayKey()`'den 62 gün önce; daha eskisi → `ConvexError("Son çalışma günü en fazla 62 gün geriye girilebilir.")`. `EmployeeTerminateDialog.tsx` tarih alanına aynı `min` ve `max` (+365) ver.
2. **P2-4 pasif kişi** (terminate): `employee.isActive !== true` → `ConvexError("Pasif kişi işten çıkarılamaz; önce aktif yapın.")`. UI: pasif (bitişsiz) kişide "İşten çıkar" butonu gösterilmez.
3. **P2-2 Şubat/ay sonu** (`convex/sgkExport.ts:98-100`): kısmi prim günü formülü YALNIZ `employmentEndDate < endDate` (ayın son gününden önce ayrılan) için; ayın son günü ya da sonrası → mevcut `result.primGunu` (tam ay). Test: 2026-02-28 ayrılış → 30 − eksik gün; 2026-02-14 → 14 − eksik gün.
4. **P2-3 eski pasif regresyonu** (`convex/sgkExport.ts:89`): `monthDays` filtresi yalnız `employee.employmentEndDate` doluyken; bitişsiz kişide eski davranış (tüm `monthDays`). Test: eski pasif + okuma → eksik gün eskisi gibi hesaplanır.
5. **P2-5 update koruması** (`convex/employees.ts` `update`, `activeChanged` hesabının hemen yanında, tek hunk): `emp.employmentEndDate` dolu ve `updates.isActive === true && emp.isActive !== true` → `throw new Error("İşten ayrılan kişiyi aktifleştirmek için 'Geri al' kullanın.")` (dosyadaki mevcut `throw new Error` desenine uy). Değişmeyen `isActive` (form her kayıtta gönderiyorsa) ENGELLENMEZ. Test ekle.
6. **N2 maskeleme** (`convex/employees.ts` `list` `:95` ve `getById` `:127`): yönetici olmayan (`isManager(ctx.user)` false — `convex/lib/auth.ts:90`; dosyadaki `canSeePay` deseni gibi) kullanıcıya `terminationReason`, `sgkExitCode`, `terminatedBy` → `undefined`. `employmentEndDate` ve `terminationType` herkese açık kalır. Test: project_user list/getById'de 3 alan yok, admin'de var.
7. **P3-1 sayım** (`src/pages/Employees.tsx:136-141` + `src/components/employees/lib/employeeList.ts` filtre): "Pasif" = `!isActive && !employmentEndDate`; "Ayrılanlar" = `!!employmentEndDate` (ileri tarihli, hâlâ aktif olanlar hem Aktif hem Ayrılanlar'da sayılır — bilinçli). `employeeList.test.ts` güncelle.

## Ownership (yalnız bunlara yaz)
convex/employeeTermination.ts (+test) · convex/sgkExport.ts (+ilgili test) · convex/employees.ts (YALNIZ madde 5 ve 6 hunk'ları; dosya başka ekiple ortak) · convex/employees.test.ts ya da yeni test dosyası · src/components/employees/EmployeeTerminateDialog.tsx · src/components/employees/EmployeeEmploymentActions.tsx · src/components/employees/lib/employeeList.ts (+test) · src/pages/Employees.tsx (yalnız sayım satırları)

## Kapsam dışı
P3-2, P3-3 (madde 1 dışında), P3-4 · başka refactor · mobile/**.

## Kapılar (kendin koş, sayıyla raporla)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 · `node_modules/.bin/eslint src convex` → 0 error · `node_modules/.bin/vitest run` → tamamı yeşil (başlangıç 2379)

## Rapor
`worker_done` ≤10 satır: madde → file:line, eklenen test sayısı, kapı sayıları.
