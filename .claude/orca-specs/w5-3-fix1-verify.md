# W5.3 DÜZELTME 1 DOĞRULAMA (SALT-OKUMA)

Çalışma dizini: `/Users/emreaydin/orca/workspaces/ngsaccess/w5-pdks-rules` (HEAD `c8d2d4e`; W5.3 yazımı STAGED, entegrasyon + fix1 UNSTAGED, yeni testler untracked). İlk iş `cd` oraya.
Denetim raporu (bulgular): `/tmp/w53-denetim.md` (probe'lar `/tmp/w53probe/`). Düzeltme spec'i: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w5-3-fix1.md`. Düzeltme raporu: `/tmp/w53-fix1.md`.
Koordinatör kararı (N2): open/tail ayrımı — gece yarısını geçen oturum D+1'deki ardışık girişsiz çıkışları maxSpan içinde tutar (son çıkış esas); D içinde kapanan oturum D+1 girişsiz çıkışı yutmaz.

## YASAK
Kod/dosya düzenleme (rapor hariç), `git add/stash/checkout/reset/commit`, push, deploy, `npx convex *`, DB yazma.

## Görev
1. E1, D1, D2, D3, D4, N1 (test), N2, N3 her biri gerçekten kapandı mı — kod + test + mümkünse denetimdeki probe senaryosunu yeniden koş. Testin gerçekten ilgili davranışı kanıtladığını kontrol et (boşuna geçen eşitlik, yanlış fixture yok).
2. Yeni regresyon: sabit vardiya birebirliği (`w5aLegacyEquivalence` snapshot'ları değişmedi mi, allowlist genişledi mi, D4 varyantı gerçekten başka projede esnek+atama içeriyor mu); mevcut test beklentilerinde değişiklik/silme (`git diff HEAD -- '*.test.ts' '*.test.tsx'` içinde `-` satırları); D2 kuralı yönlü okumalarda davranışı değiştirdi mi; E1 önceki gün okumaları dönem dışı satır/toplam üretiyor mu.
3. Kota: D3 keşfi (proje başı employees take(10001) + tanım başı by_shift) reaktif dashboard'da kabul edilebilir mi; E1'in esnek kapsamda eklediği `take(20001)` önceki gün parçası; sınır aşımında Türkçe hata.
4. `convex/shifts.ts` global create yetkisi: super_admin dışı reddediliyor; proje vardiyası akışı (`src/components/shifts/ShiftListSidebar.tsx:46`) etkilenmiyor.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` (sayılar).

## Rapor
`/tmp/w53-fix1-verify.md`: 1-2 cümle sonuç · madde başına KAPANDI / AÇIK (file:line + senaryo) · yeni ENGEL / DÜZELTİLMELİ / NOT. `worker_done`'da ≤10 satır.
