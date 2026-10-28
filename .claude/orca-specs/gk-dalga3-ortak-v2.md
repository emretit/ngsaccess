## Ortak kurallar (Geçiş Kontrol Dalga 3)
- Proje: /Users/emreaydin/ngsaccess (ana dizin, worktree YOK). Önce `CLAUDE.md` oku (any yasak, Convex camelCase, `!` yerine erken return). Convex dosyasına dokunursan önce `convex/_generated/ai/guidelines.md` oku.
- Bağlam: `docs/ui-audit-gk/00_OZET.md` + ilgili sekme raporu (bulgu ID'leri orada; "Kararlar (Emre)" bölümü bağlayıcı).
- Arayüz metni Türkçe, sade; teknik terim yok. Kullanıcıya görünen terim "cihaz" (panel değil).
- Yalnız "Ownership" listesindeki dosyalara yaz. Başka worker'lar aynı anda başka dosyalarda çalışıyor; listede olmayan dosya gerekiyorsa DUR, `ask` ile sor.
- YASAK: `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, push, deploy, `npx convex dev/deploy/run`, migration, canlı DB yazma, tarayıcıda Kaydet/Gönder. Supabase MCP kullanma.
- Kapılar (hepsi yeşil olmadan worker_done YOK):
  1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
  2. `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` (convex'e dokunduysan)
  3. `node_modules/.bin/eslint <değiştirdiğin dosyalar>` — `no-explicit-any` 0
  4. `node_modules/.bin/vitest run <ilgili test dosyaları>`; her davranış değişikliği için test ekle/güncelle.
- worker_done: ≤10 satır; bulgu ID → ne değişti (file:line) + koşulan kapılar ve sonuçları. `--files-modified` ile dosya listesi.
- Dalga 1 (bf97e90b) ve Dalga 2 (78557c85) commit'li: davranışlarını ve metinlerini bozma (Kaydet ve cihaza gönder, etki özeti, Cihaza tekrar gönder, rozet=filtre=sayaç + aria-pressed, ortak sekme başlıkları, TemplatePicker boş durumu, "cihaz" terimi). Mevcut testler yeşil kalmalı.
- Mobil hedef: 390px genişlikte dokunma hedefi en az 44px (`min-h-11`), yatay taşma yok. Masaüstü görünümü bozma.
- Dalga 4 işleri YAPILMAZ: dinamik departman, otomatik yeniden gönderim, kuralda gece bölme, taslak sakla/Kurala dön, hazır şablonlar, teşhis akışı (03-H1/03-O1).
