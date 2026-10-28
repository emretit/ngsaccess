# FIX1 — Faz 2 Dalga B-2: IDE güncel kimlik koruması yanlış pozitifi + küçük NOT'lar

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB). Rapor: `/tmp/fix-f2b-ide-fix1-rapor.md`.
Denetim raporu: `/tmp/fix-f2b-ide-denetim.md` (bulgu 1 ŞART; NOT 3, 5, 7, 8). Önceki iş: `.claude/orca-specs/fix-f2b-ide.md`.

## Ownership
`convex/ideSync.ts`, `convex/lib/grantStatus.ts`, `convex/visitors.ts`, `convex/fixF2bIde.test.ts` (+ gerekirse `convex/lib/grantStatus*.test.ts`). Başka dosya YOK (gerekirse `ask`).

## Değişiklikler
1. **Bulgu 1 (güvenlik)** — `ideSync.ts:~382-386` koruma: yeni sahip ancak bu paneldeki `ideRuleSegments(...).length > 0` olan HER kuralı io çözüyorsa koruma sağlasın
   (`enqueueIdeOpInTransaction` ~280-305 doorError fail-closed kuralıyla AYNI; mümkünse aynı yardımcıyı paylaş). Ek şart: sahibin bu panel için son `upsertUser` işi `failed` ise koruma YOK.
   Test: karışık kural (biri çözülür, biri `door_io_unresolved`) → eski sahibin deleteUser'ı panele GİDER; son upsert failed → GİDER; tüm kurallar çözülür + upsert başarılı/pending → superseded.
2. **NOT 3** — kişinin kendisini korumadan dışlama (`ideSync.ts:~377` `employee._id === payload.employeeId`) kaldırılsın (Hik `protectCurrentCredential` ile simetrik): A'nın eski silme işi A'nın GÜNCEL kartını silmesin. Test ekle.
3. **NOT 7** — `grantStatus.ts:~50` `door_io_unresolved` yalnız `segments > 0` kuralda (gönderici `ideGatewayDevice.ts:~176` ile aynı).
4. **NOT 5** — `visitors.ts:~38-39` checkedOut/expired ziyaretçide: aynı kart + panel için açık (pending/sent) ya da başarıyla ACK'lenmiş `deleteUser` işi YOKSA IDE silmesi yine planlansın (ilk silme `failed` olduysa ikinci şans). Test ekle.
5. **NOT 8** — `visitors.ts:~399` "accessExpiresAt değişimi cihaz sync gerektirmez" docstring'i güncelle.

## Kabul
- Kapılar: tsc app + convex 0, eslint (değişen dosyalar) 0, `vitest run convex/ideSync.test.ts convex/fixF2Ide.test.ts convex/fixF2bIde.test.ts convex/lib/grantStatus*.test.ts convex/accessGrantStatus*.test.ts convex/mobileVisitors.test.ts convex/fixF2Cards.test.ts convex/hikRevocation.test.ts` yeşil, `node scripts/find-node-leak.mjs` temiz.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
