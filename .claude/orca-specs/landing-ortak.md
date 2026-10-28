# LANDING MODERNİZASYON — ORTAK KURALLAR (her landing spec'i bunu içerir)

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main). Worktree AÇMA. Aynı ağaçta başka oturumlar/worker'lar da çalışıyor:
YALNIZ kendi Ownership listendeki dosyalara yaz. Listede olmayan dosyaya dokunman gerekirse DUR ve `ask` ile koordinatöre sor.
Plan: `docs/ui-scan/public/LANDING_PLAN_2026-10-23.md` (kararlar, tasarım sistemi, wireframe). Audit: `docs/ui-scan/public/LANDING_AUDIT_2026-10-23.md`.
Metinler `src/components/landing/marketingFacts.ts`'te HAZIR (koordinatör yazdı) — metin değiştirme/ekleme yapma; eksik anahtar gerekirse `ask`.

## YASAK
HİÇBİR git yazma komutu: `git add`, `git commit`, `git push`, `git stash/checkout/reset/restore` (başkalarının işi silinir) ·
deploy · `npx convex *` · DB okuma/yazma · Supabase MCP · `convex/**` · `mobile/**` · paket kurma (`npm i` YOK, package.json'a dokunma,
node_modules'a symlink YOK) · yeni bağımlılık (framer-motion vb.) · gerçek kişi/müşteri verisi.
Playwright ve sharp GEREKİRSE yalnız Pafta'dan oku: `/Users/emreaydin/pafta/node_modules/playwright`, `/Users/emreaydin/pafta/node_modules/sharp`
(repo'ya eklemeden, require/import yoluyla).

## Repo kuralları
TypeScript strict · `any`/`as any` yok · `!` non-null yok · repo stilinde çok satırlı JSX (minify/tek satır yok) · kullanıcı metinleri Türkçe ·
public sayfalar hep açık tema · yalnız `transform`/`opacity` animasyonu · `prefers-reduced-motion` her harekette.
Projede RTL/jsdom yok: bileşen testleri SSR (`renderToStaticMarkup`) + saf fonksiyon; DOM davranışını Playwright ile kanıtla.
Yerel dev sunucusu çalışıyor: `http://localhost:8081/` (ana sayfa oturumsuz açılır; HMR var).

## Kapılar (kendin koş, sonuçları rapora yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (yalnız `src/` hataları sayılır; `convex/` altındaki hata başka oturumun) ·
`node_modules/.bin/eslint <değiştirdiğin src dosyaları>` · `node_modules/.bin/vitest run src/components/public src/components/landing src/pages`.

## Rapor
Spec'teki rapor yoluna: 2-3 cümle sonuç · madde başına ne yapıldı (file:line) · kapı sonuçları · ekran görüntüsü yolları ·
bilinçli bırakılanlar · koordinatörün bakması gerekenler. `worker_done`'da ≤10 satır + `--files-modified` + `--report-path`.
