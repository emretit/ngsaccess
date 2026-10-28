# FIX1 — Faz 2 Dalga B-3: Hik seri sıfırlanınca meşru olay yutulmasın

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB). Rapor: `/tmp/fix-f2b-olay-fix1-rapor.md`.
Denetim raporu: `/tmp/fix-f2b-olay-denetim.md` (bulgu 1 + NOT 4 + NOT 5). Önceki iş: `.claude/orca-specs/fix-f2b-olay.md`.

## Ownership
`convex/lib/processCardReadingCore.ts`, `convex/fixF2bEvents.test.ts`, `convex/processCardReading.characterization.test.ts`. Başka dosya YOK (gerekirse `ask`).
Aynı ağaçta B-2 denetimi sürüyor (ideSync/ideGatewayDevice/visitors/grantStatus) — dokunma.

## Değişiklikler
1. **Bulgu 1** — `persistHikvisionReading` (~173-178): önce cihaz zamanı / `hikAccessTime` hesaplansın; mevcut satır (aynı cihaz + seri) ancak `existing.cardNo === args.cardNo` VE (`existing.hikDateTime` kanonik UTC'si == yeni cihaz zamanı YA DA `|existing.accessTime − hikAccessTime| ≤ 10 dk`) ise TEKRAR sayılsın (bugünkü gibi yan etkisiz dön).
   Seri eşleşip içerik farklıysa: `console.warn("[hik-serial-reset] device=<ad> serial=<n> ...")` + satır NORMAL yazılsın (yön, hikLastSerialNo patch dahil — yeni olay).
   `fixF2bEvents.test.ts:~63` aynı-seri-farklı-karar yutulmasını doğrulayan beklentiyi buna göre değiştir (gerekçeyi rapora yaz).
2. **NOT 5** — canlı Hik olayında `|cihaz zamanı − alış| > 10 dk` ise `console.warn("[hik-clock-skew] ...")` (davranış değişmez, yalnız görünürlük).
3. **NOT 4** — IDE kart olayında `ideTime` yok/çözülemiyorsa `console.warn("[ide-event-no-time] ...")` (davranış değişmez).

## Kabul
- Aynı seri + aynı kart + aynı zaman ×2 → 1 satır (değişmedi). Aynı seri + farklı kart → 2 satır + uyarı. Aynı seri + aynı kart + 2 sa farklı cihaz zamanı → 2 satır + uyarı. Aynı seri + aynı kart + 5 dk fark (cihaz zamanı yok, alış farkı) → 1 satır.
- Kapılar: tsc app + convex 0, eslint (3 dosya) 0, `vitest run convex/fixF2bEvents.test.ts convex/processCardReading.characterization.test.ts convex/lib/cardReadingProcess*.test.ts convex/fixF0Devices.test.ts convex/hikIsupStatus*.test.ts` yeşil, `node scripts/find-node-leak.mjs` temiz.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
