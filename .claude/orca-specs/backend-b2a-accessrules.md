# Backend B2a — accessRules.ts büyük handler'lar

Hedef: `convex/accessRules.ts` içindeki `list` (authedQuery, ~413 satır) ve `createWithGroups` (adminMutation, ~382 satır) gövdeleri lib'e taşınır; registered fonksiyonlar ince sarmalayıcı kalır; davranış birebir.

Ownership:
- convex/accessRules.ts (yalnız bu iki handler'ın gövdesi + import satırları; diğer handler'lar aynı kalabilir — ortak yardımcıyı paylaşıyorlarsa yalnız import yolu değişebilir)
- YENİ: convex/lib/accessRuleRead.ts (list gövdesi + yardımcıları), convex/lib/accessRuleWrite.ts (createWithGroups gövdesi + yardımcıları), isteğe bağlı *.test.ts
- DOKUNMA: convex/lib/accessRuleDiff.ts, accessRuleSummary.ts, accessRuleUx.ts, accessGraph*.ts, accessDecision.ts (yalnız import et)

Güvenlik-kritik (akış Faz 1 + 2A yeni commit'lendi, 9afded2e):
- `resolveProjectScope` / admin yetki kontrolü sarmalayıcıda mı lib'de mi olursa olsun AYNI sırada ve her yolda çalışır; lib fonksiyonu yetki kontrolü yapılmadan çağrılamayacak şekilde ya kontrolü kendisi içerir ya da yalnız sarmalayıcıdan çağrılır (rapora hangisi olduğunu yaz).
- createWithGroups içindeki Hik erişim geri alma / senkron zamanlamaları (`ctx.scheduler.runAfter`, deviceSyncRuns kuyruğu), audit kayıtları ve orphan korumaları sıra + argüman dahil BİREBİR.
- `list` N+1 okuma yapısı bilinçli olarak KORUNUR (hafifletme ayrı iş B2b) — sorgu sayısı/sırası değişmez.

Vitest: `node_modules/.bin/vitest run convex/orphanGuards.test.ts convex/akisFaz1.authz.test.ts convex/hikRevocation.test.ts convex/accessGrantStatus.test.ts convex/lib/accessRule convex/lib/accessScope.test.ts convex/accessScheduleTemplates.test.ts`
Rapor yolu: /tmp/backend-b2a-rapor.md
