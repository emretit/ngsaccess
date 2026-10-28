## Ortak kurallar (Ziyaretçiler audit düzeltmesi, ngsaccess React+Vite+Convex, TypeScript strict)
- Çalışma dizini: /Users/emreaydin/ngsaccess (main, ortak ağaç, worktree YOK). Aynı anda 3 worker daha başka dosyalarda çalışıyor; başka oturumların değişiklikleri de var (src/components/access-control, mobile/). Yabancı değişikliklere DOKUNMA, geri alma.
- Önce `CLAUDE.md` oku. Convex dosyasına dokunacaksan önce `convex/_generated/ai/guidelines.md` oku.
- Bağlam: `docs/ui-audit-ziyaretci/00_RAPOR.md` (bulgu ID'leri ve kanıt satırları orada) + `.claude/plan-ziyaretci-audit.md` "Kararlar" bölümü. Kararlar bağlayıcıdır.
- Yalnız "Ownership" listesindeki dosyalara yaz. Listede olmayan bir dosya gerekirse DUR ve preamble'daki `ask` komutuyla sor. Listede olmayan dosyadaki test kırılırsa düzeltme, raporda yaz.
- YASAK: `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git push`, `npx convex dev`, `npx convex deploy`, `npx convex run`, `npx convex codegen`, Netlify, Supabase MCP, herhangi bir canlı DB yazma, tarayıcı. Yalnız dosya düzenle ve yerel test koş. Commit ve yayını koordinatör, Emre'nin onayıyla yapar.
- TypeScript: `any` / `as any` yasak, bilinmeyen veri için `unknown` + narrowing, `!` yerine erken return. Convex alanları camelCase, handler'lar schema alan adlarını olduğu gibi döner.
- Node modülü (crypto vb.) içe aktaran convex dosyası "use node" ister; yeni convex dosyasında Node API kullanma (`crypto.randomUUID` global olduğu için kullanılabilir).
- Arayüz metni Türkçe ve sade, teknik terim yok. Kullanıcıya görünen terim "cihaz" (panel değil). Zamanlar Türkiye saati.
- Mevcut davranışları bozma: 2026-10-19 düzeltmeleri (sunucu tarafı filtre, dört sayaç, `useVisitorClock` sınır yenilemesi, sentetik e-posta gizleme, "Erişim" bölümünün üstte olması), satır tıklama (`src/lib/tableRowClick.ts`), ortak bileşenler (PageHeader, FilterBar, StatInline, DetailSheet, ConfirmDestructive).
- Kapılar (hepsi yeşil olmadan worker_done YOK):
  1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` — taban 0 hata. Başka worker'ın yarım dosyasından gelen hata olursa düzeltme, raporda dosya:satır yaz; senin dosyalarında 0 olmalı.
  2. `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` (convex'e dokunduysan)
  3. `node_modules/.bin/eslint <değiştirdiğin dosyalar>` — error 0
  4. `node_modules/.bin/vitest run <ilgili test dosyaları>`; her davranış değişikliği için test ekle veya güncelle. Convex modülünü değiştirdiysen `grep -rn "vi.mock(.*convex/" src convex` ile o modülü mock'layan testleri bul ve onları da koş.
- worker_done: ≤10 satır; bulgu ID → ne değişti (dosya:satır) + kapılar ve sonuç sayıları (ör. "vitest 42/42"). `--files-modified` ile dosya listesini ver. worker_done'dan sonra git komutu ÇALIŞTIRMA.
