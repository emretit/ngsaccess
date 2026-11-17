## YASAKLAR
git add / commit / stash / checkout / reset / push YOK. Convex deploy, `npx convex run`, migration KOŞUMU, DB yazma YOK. Supabase MCP KULLANMA.
Çalışma ağacında başka worker'lar paralel çalışıyor: YALNIZ Ownership listesindeki dosyalara yaz, diğerlerine dokunma.

## Kapılar (hepsi exit 0)
- node_modules/.bin/tsc --noEmit -p tsconfig.app.json
- node_modules/.bin/eslint src convex (0 error)
- node_modules/.bin/vitest run (TAM koşu)
- node scripts/find-node-leak.mjs
Başka worker paralel değişiklik yapıyor olabilir; senin dosyana ait olmayan bir test kırılırsa raporda belirt, ona dokunma.

## Rapor
worker_done ≤10 satır: değişen dosyalar file:line, verdiğin yargı kararları, kapı sonuçları (test sayısı).
