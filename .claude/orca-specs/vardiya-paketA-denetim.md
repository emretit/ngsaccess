# Vardiya Paket A — denetim (salt okuma, Claude)

## Hedef
Paket A diff'ini (çalışma ağacı, `git diff` + yeni dosyalar) sözleşmeye ve değişmezliğe göre denetle; rapor `.claude/review-vardiya-paketA.md`.

## Oku
1. `.claude/design/vardiya-model.md` (OTORİTER; §5 sözleşme, §6 ownership), `.claude/orca-specs/vardiya-paketA-model.md` (spec).
2. Diff: `git diff -- convex` + `git status --short -- convex` (yeni dosyalar: `convex/lib/shiftPlan.ts`, `convex/shiftPlans.ts`, testler).
3. `convex/_generated/ai/guidelines.md`.

## Bak (öncelik sırası)
1. **Değişmezlik:** plan/departman verisi yokken `resolve()` ve tüm atama API'leri bugünkü sonucu veriyor mu? Mevcut test beklentisi değişmiş/silinmiş mi (`git diff` test dosyaları)?
2. **Sözleşme:** §5.1-5.3 isim/tip/arg birebir mi (B ve C buna göre yazılacak)? `listAssignments` `includePlans` yokken plan satırı dönmüyor mu?
3. **Güvenlik/yetki:** yeni `shiftPlans.ts` her fonksiyonda proje kapsamı + `schedule.manage`; başka projenin departman/vardiya/çalışanı karışabiliyor mu (IDOR)?
4. **Doğrulama:** ≤8, ≥30 dk, gece yalnız sonda, esnek tek başına, döngü sınırları, anchor Pazartesi, negatif mod; `shiftPlanRefs` aynı mutasyonda sil+yaz; vardiya/departman silme engeli.
5. **Okuma sınırları:** sentinel +1 + hata, kesik sonuç yok; departman zinciri ≤32 + döngü koruması; `buildBoundedShiftResolver` plan vardiyalarını yüklüyor mu.
6. Ownership dışı dosya değişmiş mi; `_generated/api.d.ts`'te yalnız 2 satır mı; `any`/`as any`/`!` var mı; Node import (find-node-leak).

## Koş
`node_modules/.bin/vitest run convex/lib convex/shifts.test.ts` (+ yeni test dosyaları) ve `node scripts/find-node-leak.mjs`. Tam kapıyı koordinatör koşar.

## Kurallar
Salt okuma: kod DEĞİŞTİRME. Yalnız `.claude/review-vardiya-paketA.md` yaz. git yazma komutu ve `npx convex` YASAK.

## Rapor biçimi (dosya)
Türkçe, sade. Başta 1-2 cümle özet. Bölümler: Engel / Önemli / Düşük (her madde `file:line` + sorun + somut düzeltme) / Kontrol edilenler (sorun yok).
`worker_done` ≤10 satır: bulgu sayıları + en kritik 3 madde.
