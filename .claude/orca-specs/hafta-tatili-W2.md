# W2 — Hafta tatili vardiya planından: SGK + raporlar + parametre temizliği + migration

## Hedef (test edilebilir)
`workingDays` hiçbir hesap yolunda okunmaz; SGK eksik gün plan rest gününü eksik saymaz; raporlardaki
"Vardiya haftalık gün düzeni…" uyarısı kalkar ve düz haftalık atamalı projeler yönetilen motora girer;
`migrations:backfillWeeklyWorkingDays` dry-run/gerçek/idempotent testleri geçer; plan "Kabul testleri" 6–8 geçer.

## Ön koşul
W1 bitti; W1 raporu `/tmp/hafta-tatili-W1-rapor.md` — DayPlan rest bağlamı, `nextDayKind`, kalan opsiyonel
`workingDays?` paramlarını oradan oku. W1'in dosyalarında yalnız raporda "W2 kaldıracak" diye işaretlenen
opsiyonel `workingDays?` param satırlarını silebilirsin; başka W1 dosyası değişikliği gerekirse `ask` ile sor.

## Ownership (yalnız bunlar + bunların *.test.ts dosyaları)
- `convex/lib/sgkEksikGun.ts`, `convex/sgkExport.ts`
- `convex/lib/reportAttendance.ts`, `convex/lib/reportScope.ts`, `convex/dashboard.ts`, `convex/reports.ts`
- `convex/mobileAttendance.ts`, `convex/cardReadings.ts`, `convex/lib/pdksTableQuery.ts`, `convex/lib/pdksPayrollQuery.ts`
- `convex/settings.ts`, `convex/schema.ts` (YALNIZ yeni index satırı), `convex/migrations.ts`
- `workingDays` fixture'ı taşıyan diğer testler (ör. `convex/w5aFix1.test.ts`, `convex/pdksCheckpointTypes.test.ts`,
  `convex/dashboardPlans.review.test.ts`, `src/components/pdks/lib/overtimeSettlement.test.ts`) — yalnız fixture temizliği.
- W1'in işaretlediği opsiyonel `workingDays?` param satırları (bkz. Ön koşul).

## Yapılacaklar (plan "W2" bölümü)
1. SGK: `calculateSgkEksikGun` `workingDays` yerine `restDays: ReadonlySet<string>` alır; rest günü, tatil ve çalışılan
   gün eksik sayılmaz. `sgkExport.ts` rest günlerini kişi bazında `ruleReport.planResolvers` / `resolvePlan` ile üretir.
   Vardiyasız gün mevcut kuralla çalışılmış sayılır (`sgkExport.ts:104-110` korunur).
2. Raporlar: `hasUnsupportedShiftCalendar` + uyarı metni silinir. `flexibleReportProjects` keşfi: projede
   `[startDate-1, endDate]` ile kesişen herhangi bir `shiftAssignments` satırı varsa proje yönetilen motora girer.
   Yeni index `shiftAssignments.by_project_end: ["projectId", "endDate"]` (yalnız bu satır `schema.ts`'e).
3. `dashboard.ts:363-381`: sabit Pzt–Cum `classifyDay` kalkar; planlı günler yönetilen satırlardan gelir,
   kalan (plansız) günler FM'e katılmaz ("Vardiyasız = PDKS yok" kuralı).
4. `nextDayKind`: W1 `pdksDetail`/`pdksPayroll`/`pdksTable` paramına ekledi; query dosyaları (`pdksTableQuery`, `pdksPayrollQuery`, `cardReadings`, `mobileAttendance`, `reportAttendance`, `sgkExport`) her gün için `resolver.resolvePlan(id, date+1).kind === "rest" ? "rest" : "work"` geçirir (W1 raporundaki imzaya uy). `convex/lib/reportAttendance.test.ts` güncellemesi de W2'de.
4b. W1'in bildirdiği rest bağlamı tüketicileri: `mobileAttendance.ts:143-145` `resolveLast` rest bağlamının son vardiyasını da
   döner; `pdksTableQuery.ts:112` vardiya filtresi rest bağlamındaki vardiyaları da kapsar. Beklemede kalan testler:
   `convex/lib/reportAttendance.review.test.ts` (2) ve `convex/lib/reportAttendance.test.ts` (1) — uyarı kaldırımıyla güncelle.
5. `workingDays` parametre zinciri kalkar: `pdksTableQuery.ts`, `pdksPayrollQuery.ts`, `cardReadings.ts`,
   `mobileAttendance.ts`, `reportAttendance.ts`, `sgkExport.ts` (+ W1'in opsiyonel paramları).
6. `settings.ts`: `getWorkingDays`/`saveWorkingDays` silinir; genel ayar mutation'ı `workingDays` argümanını kabul etmez.
   Şema alanı `generalSettings.workingDays` optional KALIR. `convex/lib/workingDays.ts` migration için kalır.
7. Migration `backfillWeeklyWorkingDays = internalMutation({ args: { dryRun: v.boolean() } })` (`convex/migrations.ts`,
   `clearShiftColors` kalıbı): `shiftAssignments` + `departmentShiftAssignments` içinde plan yok ya da `weekly` olan ve
   `weekPattern` boş/eksik satırlara proje `workingDays`'ini kod formatında yazar (`storedWorkingDays` + Pazartesi→MON …;
   projectId yoksa ya da ayar boşsa MON..FRI). `updatedAt` DEĞİŞMEZ. İdempotent. Dönüş `{ scanned, wouldUpdate, updated, rows }`
   (rows: `{ table, id, projectId, weekPattern }`).

## Kabul testleri
Plan 6 (SGK), 7 (rapor keşfi + uyarı yok), 8 (migration dry-run/gerçek/ikinci koşum 0, updatedAt aynı).

## Kapılar
- `node_modules/.bin/tsc --noEmit -p convex` ve `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/vitest run` (TAM — src testleri convex modüllerini mock'luyor)
- `node_modules/.bin/eslint src convex`
- `grep -rn "workingDays" convex src | grep -v _generated` çıktısı rapora (kalanlar yalnız schema alanı,
  `convex/lib/workingDays.ts`, migration, auditLabels olmalı)

## Rapor yolu
`/tmp/hafta-tatili-W2-rapor.md`
## Bağlam (önce oku)
- Onaylı plan: `.claude/plan-calisma-gunleri-vardiya.md` ("Tasarım" + kendi W bölümün + "Kabul testleri"). Plan otoritedir.
- Audit raporları: `/tmp/calisma-gunleri-audit-codex.md`, `/tmp/calisma-gunleri-audit-claude.md`.
- Kararlar (Emre): K1 haftalık planda seçilmeyen gün HER ZAMAN hafta tatili (rest), alt atamaya/departmana düşmez.
  K2 tatil gününde okutma varsa hesap atanmış vardiyanın kurallarıyla (mola, FM açık/kapalı, gece, holidayWorkRequired) yapılır.
- Proje kuralları: `CLAUDE.md` (any/as any yasak, `!` yerine erken return, Convex alanları camelCase,
  `filter((p): p is NonNullable<typeof p> => p !== null)`), Convex kodu için önce `convex/_generated/ai/guidelines.md`.
- Aynı çalışma dizininde başka worker'lar paralel çalışıyor: YALNIZ kendi ownership listendeki dosyalara yaz.
  Ownership dışı bir dosyada değişiklik gerekiyorsa yazma, `ask` ile koordinatöre sor.

## Yasaklar
- `git add`, `git commit`, `git stash`, `git reset`, `git checkout`, `git restore` ÇALIŞTIRMA.
- `npx convex dev|deploy|run|import|codegen` ÇALIŞTIRMA; DB yazma yok; Supabase/MCP araçlarını KULLANMA.
- Yeni npm paketi ekleme.

## Rapor
- Ayrıntılı rapor dosyası (yol aşağıda): değişen dosyalar, her davranış değişikliği file:line, eklenen testler,
  kapı çıktılarının son satırları, açık kalan sorular.
- `worker_done` özeti ≤10 satır, file:line ile; `--report-path` ver.
