## Ortak kurallar (ngsaccess, React+Vite+Convex, TypeScript strict)
- Çalışma dizini: /Users/emreaydin/ngsaccess (main, ortak ağaç; başka oturumlar başka dosyalarda çalışıyor olabilir — yabancı değişikliklere DOKUNMA, geri alma).
- YASAK: `git add`, `git commit`, `git stash`, `git reset`, `git checkout -- <dosya>`, `git push`, `npx convex dev`, `npx convex deploy`, `npx convex run`, Netlify, Supabase MCP / herhangi bir canlı DB yazma. Sadece dosya düzenle + yerel test koş.
- TypeScript: `any` / `as any` yasak (eslint error), bilinmeyen veri `unknown` + narrowing, `!` non-null yerine erken return. Convex alan adları camelCase.
- Kullanıcıya görünen metinler Türkçe.
- Yalnız "Ownership" listesindeki dosyaları düzenle. Listede olmayan bir dosyada test kırılırsa düzeltme; worker_done raporuna yaz.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` başka oturumların dosyalarında hata verebilir (ör. src/components/access-control/...): sahiplik dışındaki hataları düzeltme, raporda listele; senin dosyalarında 0 hata olmalı.
- worker_done raporu ≤10 satır: değişen dosya:satır, koşulan kapılar ve sonuç sayıları (ör. "vitest 87/87").
