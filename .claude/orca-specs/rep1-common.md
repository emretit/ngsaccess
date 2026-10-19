# Raporlar Dalga 1 — ortak kurallar
Repo: /Users/emreaydin/ngsaccess, HEAD `77b25ea`. ÖNCE `CLAUDE.md` ve `convex/_generated/ai/guidelines.md` oku. Plan: `docs/RAPORLAR_PLAN_2026-10-19.md`.
Hik-Connect referansı (düzen/kolon fikri için): `docs/hikconnect-reports/README.md`.

## Bağlam
Sidebar'a "Raporlar" modülü ekleniyor: 4 grup (Kayıtlar · Günlük · Aylık · Resmi), ilk dalgada 6 rapor:
Ham Okutmalar (kayitlar) · Günlük Puantaj, Geç Kalanlar, Devamsızlar, Fazla Mesai (gunluk) · Aylık Durum (aylik). Resmi grubu yalnız link verir.

## Koordinatörün hazırladığı sözleşme (DEĞİŞTİRME; ihtiyaç = `ask`)
- `src/lib/reports/groups.ts`: `ReportGroupKey = "kayitlar"|"gunluk"|"aylik"|"resmi"`, `REPORT_GROUPS`, `REPORTS_BASE_PATH="/reports"`, `isReportGroupKey`, `reportGroupPath(group, slug?)`.
  Route şeması: `/reports` (hub) · `/reports/:group` · `/reports/:group/:slug`.
- `convex/lib/pdksTable.ts` gün hücresi (`PdksTableDayCell`) ZATEN `detail?: PdksDayDetail` taşıyor (matris modunda her zaman dolu):
  `{ dayType, shiftName, plannedStart, plannedEnd, isEarlyExit, earlyExitMinutes, readingCount, isManual }`. `lateMinutes` tolerans düşülmüş. Bu dosyaya YAZMA.
- Yeni backend sorgusu (Worker API yazıyor, aynı anda): `api.cardReadings.listReportTransactions` — imza `rep1-api.md` §Sözleşme'de. Frontend yalnız bu imzaya güvenir.
- Sidebar (`src/lib/routeMeta.ts`, `src/components/layout/AppSidebarNav.tsx`) koordinatörde.

## Paralel çalışma / dokunma listesi
Aynı çalışma ağacında 2 worker + koordinatör var. Çalışma ağacında senin olmayan değişiklikler: `mobile/**` (sahibi belirsiz — ASLA dokunma), `convex/lib/{pdksCalc,pdksTable,pdksTable.test}.ts`
(Raporlar adım 1 — okunur, yazılmaz), `.claude/**`, `docs/**`. Ownership listen dışındaki hiçbir dosyaya yazma, geri alma, format etme. Listede olmayan dosya gerekiyorsa `ask`.
ÖZELLİKLE yazma: `convex/schema.ts`, `convex/_generated/**`, `src/components/settings/**`, `src/components/shared/**` (yalnız import), `src/lib/capabilities.ts`, `src/index.css`, `src/main.tsx`.

## Kurallar
- `any`/`as any` YOK (eslint error). Convex sonucu `FunctionReturnType<typeof api.X.Y>` ile tiplenir. `!` yerine optional chaining + erken return. `filter(Boolean)` değil tip koruyucu.
- KVKK 2026/921: biyometrik kaynaklı okutmalar PDKS raporlarına GİRMEZ. Kaynak sınıflaması `convex/lib/pdksSource.ts` (`classifyReadingSource`, `isPdksEligibleReading`, `filterPdksReadings`) — bu dosyaya YAZMA.
  `getPdksTableData`/`getMonthlyPayrollSheet` zaten süzüyor (dokunma). Metinlerde hukuki iddia kurma ("KVKK'ya uygundur" deme).
- Saatler İstanbul (UTC+3); tarih anahtarı `YYYY-MM-DD` TR günü. Ham UTC string kullanıcıya gösterilmez.
- Kota: Convex Free kotası daha önce aşıldı. Sorgular sınırlı (`take`/`paginate`), `.filter` yok (index), gereksiz abonelik/poll yok; günlük raporlarda aralık ≤31 gün.
- Saf mantık için vitest testi yaz (convex: `convex/lib/*.test.ts`; UI: `src/**/*.test.ts(x)`).
- Kapılar (kendi koşumunla yeşil olmadan worker_done YOK):
  `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (0 hata) · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` (0 hata) ·
  `node_modules/.bin/eslint <kendi dosyaların>` (0 error) · `node_modules/.bin/vitest run <kendi test dosyaların>` · `git diff --check -- <kendi dosyaların>`.
  Öbür worker'ın yarım işi yüzünden kapı kırmızıysa: hatayı kendi dosyalarına süz, raporda yaz; kendi dosyan temizse ilerle.
- YASAK: commit/push/deploy; `npx convex` (codegen dahil) koşma; canlı DB okuma/yazma; paket kurma; `rm -rf`; `git checkout/restore/stash`.
- Rapor: `.claude/orca-specs/reports/rep1-<ad>.md` (değişen dosya:satır → ne; yeni/değişen export'ların TAM imzası; koordinatörün tarayıcıda bakması gereken akışlar;
  bilerek ertelenenler) + `worker_done` ≤10 satır, `--files-modified` ile.
