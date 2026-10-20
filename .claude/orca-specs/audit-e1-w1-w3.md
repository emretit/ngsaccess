# Denetim — E1-W1 (orphan create + groupDoors kaskadı) ve E1-W3 (ücret görünürlüğü + ctx.user) (SALT-OKUMA; Codex yazdı, Claude denetler)

Repo: /Users/emreaydin/ngsaccess. Değişiklik commit'lenmemiş, çalışma ağacında; aynı ağaçta başka ekibin (Flutter) değişiklikleri var — YALNIZ şu dosyaların farkını incele:
- W1: `git diff -- convex/zones.ts convex/doors.ts convex/lib/deviceHelpers.ts convex/orphanGuards.test.ts` + yeni `convex/lib/deviceHelpers.test.ts` (rapor /tmp/e1-w1.md, spec .claude/orca-specs/e1-w1-authz.md)
- W3: `git diff -- convex/lib/auth.ts convex/lib/auth.test.ts src/components/settings/sections/ReportsSettings.tsx src/components/settings/auditFixes.test.tsx src/components/settings/sections/reports/exportReport.ts src/components/settings/sections/reports/exportReport.test.ts` (rapor /tmp/e1-w3.md, spec .claude/orca-specs/e1-w3-pay-auth.md)
Rapora değil koda ve kendi koştuğun teste dayan.

## Hedef — her bulgu: önem, file:line, somut senaryo, önerilen düzeltme; yoksa "temiz"
- W1: super_admin / project_admin / project_user için create'te yetkili projede çalışan akış bozuldu mu; kapı projesi bölge/cihazdan türetilirken başka projenin bölgesi/cihazıyla karışım (A projesinin kapısı B projesinin bölgesine) engelleniyor mu; groupDoors silme kaskadı doğru index'le, silinen kapının TÜM bağlarını siliyor mu; sync/erişim kuralı yan etkisi.
- W3: (a) `getProjectIdsForUser` ctx.user kısayolu yetki genişletiyor mu — ctx.user'ın doğrulanmamış/eski/sahte olabileceği bir çağrı yolu (ör. internal fonksiyon, optionalAuth ctx.user=null, test ctx) var mı; super_admin yolu aynı mı. (b) ücret göremeyen rol UI'da/Excel'de ücret görmüyor, gören rol için çıktı değişmedi mi; rol tespiti sunucu kuralıyla (convex/lib/payVisibility.ts canSeePay) aynı mı.
- CLAUDE.md kuralları (any yok, `!` yok, filter(Boolean) yok).

## Kapı (sen koş)
`node_modules/.bin/vitest run convex/orphanGuards.test.ts convex/lib/deviceHelpers.test.ts convex/lib/auth.test.ts src/components/settings/auditFixes.test.tsx src/components/settings/sections/reports/exportReport.test.ts src/components/settings/settings.test.tsx`

## Yasak
Repo dosyalarına YAZMA (rapor: /tmp/audit-e1-w1-w3.md tek yazılabilir yol). commit/push/deploy/`npx convex`/DB yazma/git index-checkout-stash YOK.

## Rapor
worker_done'da ≤10 satır: W1 ve W3 için ayrı bulgu sayısı + her biri tek satır. Dil Türkçe.
