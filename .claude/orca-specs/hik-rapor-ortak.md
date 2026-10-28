# HIK RAPORLARI — ORTAK KURALLAR (her faz spec'i bunu içerir)

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main). Worktree AÇMA. Aynı ağaçta başka oturumların commit'siz işi var
(ör. `convex/accessGrantStatus.ts`, `convex/lib/processCardReadingCore.ts`, `scripts/lib/ide-mqtt-routing.mjs` …):
YALNIZ kendi Ownership listendeki dosyalara yaz. Listede olmayan dosyaya dokunman gerekirse DUR ve `ask` ile koordinatöre sor.
Plan: `.claude/plan-hik-raporlar.md` (en üst "GÜNCEL PLAN"). Hik düzeni: `docs/hikconnect-reports/README.md` §4-5 + `docs/hikconnect-reports/shots/*.png`.

## YASAK
`git add` · `git commit` · `git stash` · `git checkout` · `git reset` · `git restore` ÇALIŞTIRMA (commit'i koordinatör atar; diğerleri başkalarının işini siler) ·
push · deploy · `npx convex *` / `convex` CLI (codegen DAHİL — bu projede codegen canlı deployment'a index kurar) ·
DB okuma/yazma · Supabase MCP (başka projenin canlı DB'si — DOKUNMA) · `mobile/**` · `convex/_generated/**` · `convex/schema.ts` · paket kurma ·
yeni Convex fonksiyonu/tablosu/cron · yeni polling/reaktif ağır sorgu (Convex Free kota) · kişi verisi loglama.

## Repo kuralları
`any`/`as any` yok · `!` non-null yok (optional chaining + erken return) · `filter(Boolean)` yerine tip korumalı filtre · camelCase alanlar ·
Convex dosyasına dokunacaksan önce `convex/_generated/ai/guidelines.md` oku · kullanıcı metinleri Türkçe · saat Europe/Istanbul (UTC+3) ·
Excel'e yazılan metin hücreleri `neutralizeSpreadsheetFormula` / mevcut `safeSpreadsheetValue` yolundan geçer · exceljs/jspdf yalnız dinamik `import()` ile (bundle).
KVKK: rapora biyometrik türev alan taşınmaz.

## Kapılar (kendin koş, sonuçları rapora yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/eslint <değiştirdiğin dosyalar>` · `node_modules/.bin/vitest run <ilgili test dosyaları>` + sonunda TAM `node_modules/.bin/vitest run`
(src testleri convex modüllerini vi.mock'luyor; yalnız `vitest run convex` yetmez).
Tam vitest'te başka oturumun commit'siz işinden kaynaklanan kırmızı olursa kendi dosyanla ilgisini yaz, onu düzeltmeye çalışma.
Convex dosyasına dokunduysan: `node scripts/find-node-leak.mjs` temiz olmalı.

## Rapor
Spec'teki rapor yoluna: 2-3 cümle sonuç · madde başına ne yapıldı (file:line) · eklenen testler · kapı sonuçları ·
bilinçli bırakılanlar · davranış değişikliği (kullanıcı ne fark eder). `worker_done`'da ≤10 satır + `--files-modified` + `--report-path`.
