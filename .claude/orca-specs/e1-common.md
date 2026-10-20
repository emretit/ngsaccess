## Ortak kurallar
- Repo: /Users/emreaydin/ngsaccess. Aynı çalışma ağacında başka ajanlar (Flutter/mobil) çalışıyor: YALNIZ Ownership listesindeki dosyalara yaz; başka dosya gerekiyorsa DUR ve coordinator'a sor (ask).
- Proje kuralları: CLAUDE.md (any/as any yasak, unknown+narrowing, `!` yerine erken return, Convex alanları camelCase). Convex kodu yazmadan önce `convex/_generated/ai/guidelines.md` oku.
- `convex/_generated/**` DOKUNMA, `npx convex *` (codegen/dev/deploy/run) YASAK. Yeni Convex modül dosyası gerekiyorsa yalnız `convex/lib/*.ts` saf yardımcı (+ test) aç ve rapora yaz (api.d.ts'i coordinator elle günceller).
- commit / push / deploy / migration / DB yazma YOK. git add/reset/stash/checkout YOK. `/tmp/ceo-headbuild` dizinine dokunma.
- Kapılar (sen koş, çıktıyı rapora yapıştır): kendi test dosyaların + ilgili mevcut testler `node_modules/.bin/vitest run <dosyalar>`; `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (yalnız SENİN dosyalarındaki hata önemli; başkalarınınkini raporla, düzeltme); `node_modules/.bin/eslint <senin dosyaların>` 0 hata.
- Rapor: worker_done'da ≤10 satır, file:line; ayrıntı rapor dosyasına. Dil Türkçe.
