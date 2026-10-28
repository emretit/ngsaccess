# AKIŞ DÜZELTME — DENETİM ORTAK KURALLARI (SALT-OKUMA)

Çalışma dizini `/Users/emreaydin/ngsaccess` (main, commit'siz değişiklikler). Aynı ağaçta başka fazların commit'siz işi de var:
YALNIZ spec'te sayılan dosyaların farkını (`git diff -- <dosyalar>` + yeni dosyalar `git status --short`) denetle. Yazar Codex; yazar raporuna değil
DIFF'e ve KENDİ koştuğun kapıya güven.
## YASAK
Rapor dosyası dışında yazma · commit/push/deploy · `npx convex *` · DB · Supabase MCP · `git stash/checkout/reset/restore` · paket kurma.
## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint <faz dosyaları>` ·
`node_modules/.bin/vitest run <faz test dosyaları>`.
## Rapor
1-2 cümle sonuç · kapı sonuçları · **ENGEL** (yayını durdurur) / **DÜZELTİLMELİ** / **NOT** — her biri file:line + somut senaryo (girdi → yanlış sonuç) + öneri.
Spec hedefinin karşılanıp karşılanmadığını madde madde yaz. Sade Türkçe. `worker_done`'da ≤10 satır + rapor yolu.
