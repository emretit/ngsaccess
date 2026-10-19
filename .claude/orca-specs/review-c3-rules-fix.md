# Görev: C3 rules-fix yeniden denetimi (SALT-OKUMA, odaklı)
Repo: /Users/emreaydin/ngsaccess. Önceki denetim `.claude/orca-specs/reports/review-c3.md` (YÜKSEK #1, ORTA #3/#4, DÜŞÜK #6).
Düzeltme spec'i `.claude/orca-specs/c3-rules-fix.md`, rapor `.claude/orca-specs/reports/c3-rules-fix.md`. Codex yazdı; sen bağımsız denetçisin.
Okuma kapsamı: `git diff -- convex/accessRules.ts convex/lib/accessRuleDiff.ts convex/deviceSyncRuns.ts convex/lib/deviceSyncRun.ts convex/hikvisionSync.ts convex/actions/hikvisionSync.ts convex/actions/ideGatewayDevice.ts convex/ideSync.ts src/hooks/access-rules src/components/access-control/unified` + yeni dosyalar.

## Doğrula
1. #1: Diff kaydı bir `deviceSyncRuns` kaydı + hedefler üretiyor mu; eklenen/çıkarılan her kişi için Hik ve IDE işleri bu run'a bağlı mı (`runId`);
   hedef durumları C2b semantiğinde mi (kanıtsız "uygulandı"/"doğrulandı" yok); başarısız Hik işi run'da başarısız görünüyor mu; boş diff'te
   "Cihazlara gönder" sunuluyor mu; run ve diff aynı transaction'da (yarım kayıt yok); mevcut tam `startRuleSync` davranışı değişmemiş.
2. Hiç cihaz/kişi etkilenmiyorsa boş run üretilmiyor mu; çok sayıda kişi eklenince (ör. 500) mutation okuma/yazma limitine ya da tek action'da
   zaman aşımına giden bir yapı var mı (batch/schedule).
3. #3 bayraklar, #4 diff modunda stale groupDoors temizliği (eşzamanlı eklenen kapı korunuyor), #6 plansız kurala üye eklenince plan atanması.
4. Eski canlı istemci (tam liste `updateWithGroups`) davranışı bozulmamış; yeni opsiyonel arg'lar geriye uyumlu.

## Kapı (kendin koş)
node_modules/.bin/tsc --noEmit -p tsconfig.app.json · node_modules/.bin/tsc --noEmit -p convex/tsconfig.json · node_modules/.bin/eslint src convex · npx vitest run

## YASAK
Dosya düzenleme yok (rapor hariç). commit/push/deploy/DB YOK. `npx convex` koşma. Uygulamaya giriş yok.

## Rapor
`.claude/orca-specs/reports/review-c3-rules-fix.md` + `worker_done` ≤10 satır: bulgular önem sırasıyla, file:line + 1 cümle; kapı sonuçları; "Canlıya hazır mı: evet/hayır".
