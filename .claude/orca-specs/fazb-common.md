## Ortak kurallar (Faz B, koordinatör ngsaccess-cc)
- Repo `/Users/emreaydin/ngsaccess` (Convex `convex/` + React/Vite `src/`). Convex koduna dokunmadan önce `convex/_generated/ai/guidelines.md` oku. Proje kuralları `CLAUDE.md`:
  `any`/`as any` YASAK (eslint error), `!` non-null yerine erken return, Convex alanları camelCase, `db.get` null filtresi type-guard ile.
- **Yalnız Ownership listesindeki dosyalara yaz.** Listede olmayan bir dosyayı değiştirmen gerekirse DUR ve preamble'daki `ask` komutuyla koordinatöre sor.
- YASAK: git add/commit/push/stash/checkout/reset/clean · `convex dev|deploy|run|codegen|import|env set` · netlify · npm install · herhangi bir MCP aracı (Supabase dahil) · veritabanına yazma.
- Ağaç ortak: başka oturumların commit'siz dosyaları var (`mobile/**`, `src/components/auth/{AuthProvider,registrationFlow,registrationFlow.test}.ts(x)`, `src/components/employees/EmployeeDetails.tsx`, `.claude/**`). Dokunma.
  Başka Faz B worker'ları paralel çalışıyor; tam `vitest run`'da kendi dosyan dışındaki geçici kırmızıyı rapora yaz, düzeltmeye çalışma.
- Davranış sözleşmesi: dönüş ŞEKİLLERİ değişmez (alan kalır, değer `null` olur); yöneticilerin (super_admin, project_admin) gördüğü/yaptığı hiçbir şey değişmez. Fonksiyonda `returns` validator'ı varsa yeni null değerlere uydur.
- Kapılar (hepsini koş, çıktısını rapora yaz): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
  `node_modules/.bin/eslint <değişen dosyalar>` · `node_modules/.bin/vitest run <ilgili testler>` · `node_modules/.bin/vitest run` (tam).
- Rapor Türkçe ≤60 satır: TAM değişen dosya listesi · ne değişti (dosya:satır) · kapı sonuçları · açık kalan/riskler. `worker_done` ≤10 satır + `--files-modified` + `--report-path`.
