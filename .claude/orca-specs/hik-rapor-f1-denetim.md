# Hik raporları — Faz 1 (Mola) SALT-OKUMA denetimi

Sen denetçisin: HİÇBİR dosyaya yazma (rapor dosyası hariç). `git add/commit/stash/checkout/reset/restore` YOK, `npx convex` YOK, DB YOK.
Ağaçta başka oturumların commit'siz işi var; yalnız aşağıdaki diff'i denetle.

## Kapsam
Codex worker'ın Faz 1 diff'i: `git diff -- convex/lib/pdksPunchPairs.ts convex/lib/pdksPunchPairs.test.ts convex/lib/pdksDay.ts convex/lib/pdksTable.ts convex/lib/pdksTable.test.ts src/lib/reports src/components/reports src/pages/Reports.tsx`
Worker raporu: `.claude/reports/hik-rapor-f1.md` (rapora değil diff'e ve kendi koştuğun kapıya güven). Spec: `.claude/orca-specs/hik-rapor-f1-mola.md`.

## Neye bak (öncelik sırasıyla)
1. **Süre hesabı regresyonu:** `includePunches` açıkken/kapalıyken `totalMinutes`, `rawTotalMinutes`, mevcut mola kesintisi, fazla mesai, durum, `breakViolation` birebir aynı mı? `pdksDay.ts`'te `resolvedPairReadings` değişikliği `eachPunch` yolunu değiştiriyor mu?
2. **Mola doğruluğu:** yönsüz okutmalar, tekrar okutma aralığı, manuel giriş/çıkış ucu, gece vardiyası (gün ataması), esnek vardiya `flexibleConflict`, çok vardiyalı gün (parça arası boşluk mola sayılmamalı; `pdksTable.ts`'teki parça hesabının `dayKind`/`manualForSegment`/`manualExitNextDay` mantığı `convex/lib/pdksMultiShift.ts`'teki asıl hesapla tutarlı mı?).
3. **Convex maliyeti:** yeni import döngüsü (`pdksTable` ↔ `pdksDay`) var mı, includePunches açıkken çok vardiyalı günde ek hesap kabul edilebilir mi; `"use node"` sızıntısı (`node scripts/find-node-leak.mjs`).
4. **Web:** eski `/reports/gunluk/mola-ihlalleri` yönlendirmesi (parametre koruma, döngü yok, sabit yol yerine `reportGroupPath` gerekir mi), "Yalnız ihlaller" = eski predicate, filtre temizleme, Excel `minutesValue`, kaydedilmiş kolon seçimi (localStorage slug değişti — kabul edilebilir mi), boş durum metni.
5. Repo kuralları: `any`, `!`, `filter(Boolean)`, Türkçe metin.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ·
`node_modules/.bin/vitest run convex/lib/pdksPunchPairs.test.ts convex/lib/pdksTable.test.ts src/lib/reports src/components/reports` ·
`node_modules/.bin/vitest run convex/lib` (pdks karakterizasyon dahil).

## Rapor
`.claude/reports/hik-rapor-f1-denetim.md`: her bulgu ENGEL / ÖNEMLİ / DÜŞÜK + file:line + somut senaryo (girdi → yanlış çıktı) + önerilen düzeltme.
Bulgu yoksa açıkça "ENGEL 0". `worker_done`'da ≤10 satır özet + `--report-path`.
