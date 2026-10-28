# SİSTEM AUDIT DÜZELTMELERİ — ORTAK KURALLAR (her fix spec'i bunu içerir)

Çalışma dizini: `/Users/emreaydin/ngsaccess` (main). Worktree AÇMA, dal değiştirme. Başka worker'lar AYNI ANDA aynı ağaçta
farklı dosyalarda çalışıyor: yalnız spec'teki **Ownership** listesindeki dosyaları düzenle. Listede olmayan bir dosyaya dokunman
gerekirse DURMA ama düzenleme de yapma: koordinatöre `ask` ile sor.

## Önce oku
- `CLAUDE.md` (any/`as any` yasak, `!` yerine erken return, `filter((p): p is NonNullable<typeof p> => p !== null)`, camelCase).
- `convex/_generated/ai/guidelines.md` (Convex kuralları; validator'lar, index kullanımı, internal fonksiyonlar).
- Bulgu kaynağı: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` + ilgili modül raporu (spec'te yazıyor). Kanıt satırlarını kodda yeniden doğrula.

## YASAK (ihlal = iş geçersiz)
- `git add`, `git commit`, `git stash`, `git checkout`, `git reset`, `git restore`, `git switch`, `git push` — HİÇBİRİ. (Önceki bir
  Codex worker spec'e rağmen commit attı; atma. Koordinatör reflog'a bakıyor.)
- `npx convex *` / convex CLI (codegen dahil) · deploy · DB okuma/yazma · Supabase MCP (başka projenin canlı DB'si) · cihaz/ağ isteği ·
  paket kurma/güncelleme · `convex/_generated/**` elle düzenleme.
- Schema değişikliği (`convex/schema.ts`) yalnız spec açıkça izin veriyorsa; izin yoksa `ask`.

## Kalite
- Kullanıcıya görünen hata mesajları Türkçe ve eyleme dönük. Mevcut desende `ConvexError({ code, message })` varsa onu kullan.
- Davranışı değiştirdiğin her uç için test: başarılı yol + reddedilen yol (rol/proje). Mevcut test kalıplarını (`convex/*.test.ts`,
  `convex-test`) izle. Mevcut testleri silme; beklenti değişmesi gerekiyorsa gerekçeyi rapora yaz.
- Kapsam dışı iyileştirme yapma (refaktör, yeniden adlandırma, biçimlendirme turu yok).

## Kapılar (kendin koş, çıktıyı rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 hata (convex dahil değilse `-p convex/tsconfig.json` de koş).
2. `node_modules/.bin/eslint <değiştirdiğin dosyalar>` → 0 hata.
3. `node_modules/.bin/vitest run <değiştirdiğin modüllerin test dosyaları + yeni testler>` → yeşil. TAM suite'i koşma (paralel worker'lar var;
   tam suite'i koordinatör koşar).
4. `node scripts/find-node-leak.mjs` → temiz ("use node" sızıntısı yok).

## Rapor
`/tmp/<spec adı>-rapor.md` (≤ 80 satır, Türkçe): her bulgu ID'si için ne değişti (file:line), eklenen testler, kapı çıktıları,
açık kalan/TEYİT GEREK. `worker_done` ≤10 satır, `--files-modified` (gerçek liste) ve `--report-path` ile, `--outcome succeeded|failed`.
