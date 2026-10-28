# AKIŞ DÜZELTME DALGASI — ORTAK KURALLAR (her faz spec'i bunu içerir)

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main). Worktree AÇMA. Aynı ağaçta başka worker'lar da çalışıyor: YALNIZ kendi
Ownership listendeki dosyalara yaz. Listede olmayan bir dosyaya dokunman gerekirse DUR ve `ask` ile koordinatöre sor.
Kaynak: `docs/genel-akis-audit/OZET.md` + ilgili rapor (A/B/C). Satır numaraları c53a7684 civarı; önce kodda yeniden bul.

## YASAK
commit · push · deploy · `npx convex *` / `convex` CLI (codegen DAHİL — bu projede codegen canlı deployment'a index kurar) ·
DB okuma/yazma · Supabase MCP (Pafta canlı DB'si — DOKUNMA) · `mobile/**` · `convex/_generated/**` · paket kurma ·
yeni polling/cron/reaktif ağır sorgu (Convex Free kota) · kişi verisi loglama · `git stash/checkout/reset/restore` (başkalarının işi silinir).
Yeni Convex fonksiyonunu YENİ top-level modüle koyma (api.d.ts codegen ister); mevcut modüle ekle. `convex/lib/` altında saf yardımcı dosya açabilirsin.
`convex/schema.ts` yalnız spec'in izin verdiği worker yazar.

## Repo kuralları
`any`/`as any` yok · `!` non-null yok (optional chaining + erken return) · `filter(Boolean)` yerine tip korumalı filtre · camelCase alanlar ·
Convex: önce `convex/_generated/ai/guidelines.md` oku · kullanıcı metinleri Türkçe · zaman Europe/Istanbul.

## Kapılar (kendin koş, sonuçları rapora yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/eslint <değiştirdiğin dosyalar>` · `node_modules/.bin/vitest run <ilgili test dosyaları>` + sonunda tam `node_modules/.bin/vitest run`.
Tam vitest'te başka worker'ın yarım işinden kaynaklanan kırmızı olursa kendi dosyanla ilgisini yaz, onu düzeltmeye çalışma.

## Rapor
Spec'teki rapor yoluna: 2-3 cümle sonuç · madde başına ne yapıldı (file:line) · eklenen testler · kapı sonuçları · bilinçli bırakılanlar ·
canlıda/cihazda doğrulanacaklar · davranış değişikliği (kullanıcı ne fark eder). `worker_done`'da ≤10 satır + `--files-modified` + `--report-path`.
