# Tekrar denetim — Vardiyasız PDKS Düzeltme 1 (Claude, salt okuma) 2026-10-26

Repo: /Users/emreaydin/ngsaccess. KOD DEĞİŞTİRME; tek yazacağın: `.claude/review-vardiyasiz-pdks.md` sonuna "## Tekrar denetim (Düzeltme 1)" bölümü.

## Bağlam
- İlk denetim: `.claude/review-vardiyasiz-pdks.md` (E-1, Ö-1..3, D-1..5) + aynı dosyada "## Düzeltme 1 yanıtları" (Codex'in iddiası).
- Kurallar: `.claude/orca-specs/vardiyasiz-pdks.md` + `.claude/orca-specs/vardiyasiz-pdks-denetim.md` (ek koordinatör kararları).
- Çalışma ağacında başka oturumun commit'siz değişiklikleri var; yalnız bu işin dosyalarına bak:
  convex/lib/{shiftResolver,reportAttendance,pdksPayrollQuery,pdksChart}.ts, convex/{dashboard,sgkExport,reports}.ts, src/utils/pdksExport.ts,
  src/components/pdks/dashboard/{PdksRowStatus,PDKSTableView}.tsx + testler (convex/noShift.test.ts, w53Integration, w5aFix1, snapshot,
  src/utils/pdksExport.test.ts, src/components/pdks/dashboard/noShift.test.tsx, convex/lib/shiftResolver.test.ts).

## Sorular
1. Her bulgu (E-1, Ö-1, Ö-2, Ö-3, D-1..D-5) gerçekten kapandı mı? Kodu ve testi oku; "kapandı / kısmen / açık" + file:line.
2. Düzeltmeler YENİ hata getirdi mi? Özellikle:
   - `buildBoundedShiftResolver` aralık okuması (`by_employee_end`, başlangıç −7 / bitiş +1): aralık dışına taşan uzun atama (endDate aralıkta,
     startDate çok eskide) ve açık uçlu/çok uzak endDate'li atama doğru yükleniyor mu? Eşit `updatedAt` önceliği korunuyor mu?
   - Bordro hücreleri artık plansız gün için de üretiliyor: hiçbir toplam/sayaç/fazla mesai/SGK bunları saymıyor mu? Web rapor ızgarası
     ve dışa aktarma "—" hücresini doğru gösteriyor mu?
   - Ana sayfa artık adaptöre hazır resolver veriyor: plan kapsamı (`scopedPdksPlan`) ile ham geçiş metrikleri karışmadı mı?
   - `PdksRowStatus` butonu: satır tıklamasını (onRowActivate, `src/lib/tableRowClick.ts`) tetiklemiyor mu, klavyeyle erişilebilir mi?
3. Test korumaları (w53 D3, w5aFix1 D1) anlamlı üst sınır mı, yoksa yine gevşek mi? Snapshot değişikliği yalnız sorgu izi mi?

## Kapılar (kendin koş)
```
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
node_modules/.bin/tsc --noEmit -p convex
node_modules/.bin/vitest run convex/noShift.test.ts convex/w53Integration.test.ts convex/w5aFix1.test.ts convex/w5aLegacyEquivalence.test.ts src/utils/pdksExport.test.ts src/components/pdks convex/lib/shiftResolver.test.ts convex/reports.attendance.test.ts
```

## YASAK
Kod düzenleme · `git add/commit/stash/reset/checkout/switch/restore/clean` · `npx convex` · DB/MCP · deploy · push.

## Rapor
Bölümün başında 1-2 cümle sonuç + yeni bulgu sayıları (Engel/Önemli/Düşük). Yeni bulgu: seviye, file:line, senaryo, öneri. `worker_done` ≤8 satır.
