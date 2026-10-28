## Ortak kurallar (HER worker)
- Repo: /Users/emreaydin/ngsaccess (React + Vite + Convex). Ana çalışma dizininde çalış, worktree AÇMA.
- Önce oku: docs/ui-audit-shifts/RAPOR.md (bulgu ID'leri V-xx), CLAUDE.md (any yasak, unknown + narrowing, `!` yok), convex işi varsa convex/_generated/ai/guidelines.md.
- Tasarım dili A2: nötr, gölgesiz, bordo ana düğme; mevcut bileşenleri kullan (src/components/ui/*, src/components/shared/*). Tüm metinler Türkçe.
- KESİNLİKLE YASAK: `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore`, push, `npx convex dev/deploy`, migration, DB'ye yazma, Supabase/Convex MCP yazma. Çalışma ağacında başka oturumların commit'lenmemiş değişiklikleri var; onlara dokunma, geri alma.
- Yalnız "Ownership" listesindeki dosyalara yaz. Başka bir dosyada değişiklik gerekiyorsa yazma, worker_done raporunda belirt.
- Paralel 2 worker daha aynı ağaçta çalışıyor (A: araç çubuğu, B: takvim ızgarası, C: tanımlar alt sayfası + renk). tsc/vitest'te SENİN dosyalarına ait olmayan hata çıkarsa düzeltme, raporda yaz.
- Kapılar: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (senin dosyalarında 0 hata) · `node_modules/.bin/eslint <değiştirdiğin dosyalar>` · `npx vitest run src/components/shifts` (+ kendi yeni testlerin). convex'e dokunduysan ayrıca `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `npx vitest run convex/shifts`.
- Rapor: worker_done'da ≤10 satır; değişen dosyalar file:line, kapı sonuçları (komut + sayı), açık kalanlar.
