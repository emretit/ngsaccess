# FIX1 — Faz 5-C: idePanelUsers korunmalı + Yetki Durumu departman filtresi 1000 satır sınırı

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma). Rapor: `/tmp/fix-f5-c-fix1-rapor.md`.
Denetim raporu: `/tmp/fix-f5-c-tutarlilik-denetim.md` (ENGEL + DÜZELT ŞART; NOT'lar kapsam dışı, rapora yorum yaz). Önceki iş: `.claude/orca-specs/fix-f5-c-tutarlilik.md`.

## Ownership
`convex/lib/adminGuards.ts`, `convex/accessGrantStatus.ts`, `convex/lib/grantStatus.ts`, `convex/fixF5Consistency.test.ts`, `convex/accessGrantStatus.test.ts`. Başka dosya YOK (gerekirse `ask`). F5-A/F5-B fix'leri aynı anda başka dosyalarda çalışıyor.

## Değişiklikler
1. **ENGEL** — `adminGuards.ts:~82` `idePanelUsers` politikası `delete` DEĞİL `preserve` (fiziksel panel roster kopyası; silinirse `deviceProvision.ts:~61` taşıma koruması atlanır, kartlar panelde izsiz kalır). Matriste benzer "fiziksel cihaz durumunu yansıtan" başka tablo delete'te mi kontrol et (Hik/IDE operasyon/roster/enrollment) — varsa preserve/block'a al ve rapora yaz. Test: proje silmede idePanelUsers satırı kalır.
2. **DÜZELT** — `accessGrantStatus.ts:~63-66,106-110` departman filtresi proje genelindeki ilk 1000 grant satırını taramasın: önce `employees` `by_department` (veya mevcut uygun index; schema DEĞİŞMEZ) ile departmandaki kişiler, sonra kişi başı grant satırları (`by_project_employee` vb. mevcut index) — sayfalı/sınırlı; >1000 yetki satırlı projede filtre çalışır, sayaçlar doğru. Mevcut index yoksa `ask`. Test: 1500 grant satırlı projede departman filtresi doğru kişileri/sayıları döner.

## Kabul
- Kapılar (fix-ortak.md) + `vitest run convex/accessGrantStatus*.test.ts convex/lib/grantStatus*.test.ts convex/fixF5Consistency.test.ts convex/projects*.test.ts convex/lib/adminGuards*.test.ts` yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
