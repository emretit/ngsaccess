# C3 rules-fix yeniden denetim (salt-okuma)

Sonuç: #1/#3/#4/#6 doğru uygulanmış, eski istemci bozulmamış. Canlıya engel yok; 2 ORTA ölçek bulgusu var. Canlıya hazır: **evet** (çok üyeli kural uyarısıyla).

Kapılar (kendi koşum): tsc app 0 · tsc convex 0 · eslint 0 · vitest 107 dosya / 1121 test geçti.

## Bulgular
1. ORTA — `convex/deviceSyncRuns.ts:455-520` (executeRuleDiffTarget): kişi başına sıralı runQuery+runAction, cihaz başına tek action, batch/schedule yok. ~500 kişi eklenince (kapsam değişimi) tek action 10 dk `RUN_TIMEOUT_MS`'ye/action süresine takılır; kalan kişiler "Gönderim zaman sınırı aşıldı" ile failed görünür (sessiz değil, ama tamamlanmaz).
2. ORTA — `convex/deviceSyncRuns.ts:404-406`: kapsam/aktiflik değişiminde syncMembers = TÜM üyeler; >500 üyeli kuralda cihaz/kapı değişimi kaydı tümden reddedilir (rollback, açık hata). Eski tam-liste yolu bunu kabul ediyordu → büyük kurallarda kapsam düzenlenemez (davranış gerilemesi, güvenli yönde).
3. DÜŞÜK — `convex/deviceSyncRuns.ts:425-433`: kuralla ilgisiz proje cihazları için de action zamanlanıyor (≤200); ilgisizler doğrudan `skipped` yazılabilirdi (gereksiz çağrı).
4. DÜŞÜK — `convex/accessRules.ts` settingsChanged (`JSON.stringify` karşılaştırması): form `description:""` gönderir, kayıt `undefined` ise boş diff'te sahte run üretebilir (doğrulanmadı, canlı gözlem gerek).
5. DÜŞÜK — `convex/lib/accessRuleDiff.ts:46`: yalnız IDE hedefli kuralda `hikWeekPlanNo` hiç atanmaz (ensureWeekPlan yalnız Hik dalında) → her üye eklemede `syncRule=true`, kural izni gereksiz yeniden gönderilir.

## Doğrulananlar
- #1: run + hedefler + zamanlayıcı işleri `saveWithGroups` transaction'ında (`createRuleDiffRun`); limit/hata kural yazılarını geri alır. Hik/IDE işleri `runId`+`targetDeviceIds` taşır; hata `finishTarget failure` ile failed; durumlar C2b `finishTarget` (kanıtsız verified yok). Boş diff → `runId:null`, run/iş yok; UI "Cihazlara gönder" (`SyncRuns.tsx:214-218`) mevcut `startRuleSync`'e bağlı. `startRuleSync` dokunulmamış.
- #2: etkilenen yoksa `null` (boş run yok). Ölçek: bulgu 1-2.
- #3 `devicesTruncated`/`doorsTruncated` ayrı; #4 `retainedDiffDoorIds` + açık eklenen korunur (test var); #6 `missingWeekPlan && added.length>0`.
- #4 eski istemci: `updateWithGroups` aynı arg/dönüş (Id), relationDiff opsiyonel; legacy yolda `!relationDiff` ile eski zamanlayıcı akışı aynen; `updateWithGroupsTracked` diff yoksa reddeder.
