# W1 — Hafta tatili vardiya planından: backend semantiği

## Hedef (test edilebilir)
Haftalık planda (plan yok ya da `plan.kind === "weekly"`) seçilmeyen gün `resolvePlan` sonucunda `kind: "rest"`
olur, rest günü bağlam vardiyasıyla (K2) hesaplanır, gün türü artık `workingDays`'ten değil yalnız tatil + plan
`dayKind`'ından gelir; plan "Kabul testleri" 1–5 convex vitest testleriyle geçer.

## Ownership (yalnız bunlar + bu dosyaların *.test.ts dosyaları)
- `convex/lib/shiftPlan.ts`, `convex/lib/shiftResolver.ts`, `convex/lib/pdksMultiShift.ts`, `convex/lib/pdksDay.ts`
- `convex/lib/pdksTable.ts`, `convex/lib/pdksDetail.ts`, `convex/lib/pdksPayroll.ts`
- `convex/lib/cardReadingProcess.ts`, `convex/shiftPlans.ts`, `convex/lib/shiftAssign.ts`
- Yeni test dosyası açabilirsin: `convex/lib/weeklyRestDays.test.ts`

## Yapılacaklar (plan "W1" bölümü; özet)
1. `slotForDate`: haftalık/eski satırda seçilmeyen gün `[]` (null değil). Boş/eksik `weekPattern` = 7 gün (eski satır uyumu).
   Haftalık yazım doğrulaması (`validatePlanStructure` / normalizasyon): boş `weekPattern` → ConvexError
   ("En az bir çalışma günü seçin"). Döngü planları değişmez.
2. `DayPlan` rest varyantına `shifts: Doc<"shifts">[]` (bağlam) ekle; `calendar: "project"` tipten ve üretimden kalkar
   (haftalık dolu gün `calendar: "plan"`). Bağlam: haftalık → planın vardiyaları (o tarihte geçerli sürümle, `shiftAt`);
   döngü → tüm dolu slotlar aynı vardiya setiyse o set, değilse `[]`.
   `resolve`/`resolveLast` rest'te bağlam vardiyasını (ilk/son) döner; `kind` rest kalır.
3. `computePdksPlannedDay`: rest + bağlam → shifts günüyle aynı tekli/çoklu yol, `dayKind: "rest"`, sonuçta
   `planKind: "rest"`; rest'te `attendanceDecision` olmaz (`mergePdksDays`).
4. `pdksDay.ts`: `workingDays` param kalkar; `classify` = (etkin tatil ? tatil sınıfı : dayKind rest → weekend, aksi workday).
   `nightShiftDayMode === "splitAtMidnight"` iken gece yarısı sonrası kısmın gün türü `nextDayKind` paramından
   (çağıran ertesi tarihin `resolvePlan`'ından verir: rest → weekend, shifts → workday, tatil önceliği aynen).
   `shiftStart` modunda bugünkü başlangıç gününe bağlı davranış aynen kalır.
   `pdksTable.ts`/`pdksDetail.ts`/`pdksPayroll.ts`: param tiplerinden `workingDays` kaldır, `nextDayKind` aktar.
   NOT: Bu dosyaları çağıran query dosyaları (pdksTableQuery, pdksPayrollQuery, cardReadings, mobileAttendance,
   reportAttendance, sgkExport) W2'nin; sen onlara DOKUNMA. Onlar hâlâ `workingDays` geçeceği için tsc kırılırsa
   param tipinde `workingDays?: string[]` ŞİMDİLİK opsiyonel ve kullanılmaz bırak (yorum: "W2 kaldıracak"), W2 temizler.
5. `cardReadingProcess.ts` `directionShift`: rest'te bağlam vardiyasının sonuncusunu döner.
6. `shiftAssign.ts`: aynı kişide tarih aralığı kesişen iki haftalık/döngü ataması → "üstünü örtme" uyarısı
   (forceConfirm gerektirir), yalnız saat kesişimi değil. `shiftPlans.ts` departman önizleme override sayacı rest'i sayar;
   planCells haftalık seçilmeyen günü rest hücresi olarak döner.

## Kabul testleri (yaz + geçir)
Plan "Kabul testleri" 1, 2, 3, 4, 5. Var olan testlerden davranışı değişenleri yeni semantiğe güncelle
(ör. `convex/lib/shiftPlan.test.ts:87`, `convex/lib/shiftResolver.test.ts:29,35`); her güncellemeyi raporda gerekçelendir.

## Kapılar (kendin koş, çıktıyı rapora koy)
- `node_modules/.bin/tsc --noEmit -p convex`
- `node_modules/.bin/vitest run convex/lib convex/shiftPlans.test.ts convex/shifts.test.ts convex/noShift.test.ts`
- `node_modules/.bin/eslint <değiştirdiğin dosyalar>`

## Rapor yolu
`/tmp/hafta-tatili-W1-rapor.md`
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
