# Raporlar D2 — düzeltme turu (BACKEND)
Kurallar: `.claude/orca-specs/rep1-common.md` + `rep2-api.md` (Ownership'teki convex dosyaları yine serbest). Denetim: `.claude/orca-specs/reports/review-rep2.md` (bulgu no'ları oradan).
Çalışma ağacında başka oturumun işi var (`convex/{invites,invites.test}.ts`, `convex/actions/sendEmail.ts`, `mobile/**`, `src/components/public/**`) — DOKUNMA.

**Hedef:** #1 (sunucu tarafı), #4, #5, #8 düzelir; regresyon testleri eklenir; mevcut çağıranlar değişmeden çalışır.

## Ownership
`convex/lib/{pdksTable,pdksCalc,reportAttendance}.ts` (+ test'leri) · `convex/cardReadings.ts` — YALNIZ `getPdksTableData` (yeni opsiyonel arg + `computePdksTableRow`'a geçirme) ve `listReportTransactions`.

## Düzeltmeler
1. **#1:** `listReportTransactions`'ta `sources` doluyken tarama penceresi büyür: `paginate({ ...paginationOpts, numItems: 1000, maximumRowsRead: 1000 })` (sources yokken 200 aynen).
   DİKKAT: Convex bir sorguda yalnız BİR `paginate` çağrısına izin verir — döngüyle ikinci sayfa ÇEKME. Enrich yalnız eşleşen satırlara (zaten öyle). Bilinen sınır: kalıcı çözüm `source` alanı + index (şema) — raporda yaz, yapma.
2. **#4:** `computeBreakViolation` süre hesabı dashboard ile birebir: ilk–son arası `Math.floor((lastMs - firstMs) / 60000)` (ISO zamanlardan); mola penceresi kontrolü dakika-of-day (`isoTimeToTRMinutes`) olarak kalır.
   İmzayı buna göre değiştir (ör. `{ punchTimes: readonly string[] /* ISO */; breakStart; breakEnd }`); test: 08:00:59 → 15:30:00 = 449 dk → false.
3. **#5:** manuel giriş/çıkışlı günde (`manualDay?.entryTime && manualDay?.exitTime` — alan adlarını koddan doğrula) `breakViolation: false`. Test ekle.
4. **#8:** `getPdksTableData` args'a `includePunches: v.optional(v.boolean())`; `computePdksTableRow`'a `includePunches` parametresi; false/undefined iken `punches: []`
   (diğer `detail` alanları — readingCount, breakViolation, plannedBreak* — her zaman dolu). Varsayılan false → PDKS Kayıtları payload'u D1 düzeyine döner. Test: iki mod.

## Kapılar
convex tsc 0 · app tsc 0 · eslint kendi dosyaların 0 · `node_modules/.bin/vitest run convex/lib/pdksCalc.test.ts convex/lib/pdksTable.test.ts convex/lib/reportAttendance.test.ts` · `git diff --check`.
YASAK: commit/push/deploy, `npx convex`, DB. Rapor: `.claude/orca-specs/reports/rep2-fix-api.md` + `worker_done` ≤10 satır.
