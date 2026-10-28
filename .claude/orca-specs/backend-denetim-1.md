# Denetim — Backend refaktör dalga 1 (B1, B2a, B4; Codex yazdı)

Rol: SALT-OKUMA denetçi. Hiçbir dosyaya yazma (yalnız rapor). commit/push/deploy/DB/`npx convex` YOK.
Çalışma dizini /Users/emreaydin/ngsaccess (main). Başka oturumun commit'siz işleri var (convex/devices.ts, schema.ts, http.ts, deviceCenter.ts, deviceEvents.ts, adminDevices.ts, lib/deviceConnection.ts, employeeBiometrics.ts, _generated/api.d.ts) — bunları DENETLEME.

Eski hâl: `git show HEAD:<dosya>`; yeni hâl: çalışma kopyası + yeni untracked dosyalar.
- B1: convex/cardReadings.ts (1711→1271) + YENİ convex/lib/pdksTableQuery.ts, convex/lib/pdksPayrollQuery.ts. Rapor /tmp/backend-b1-rapor.md
- B2a: convex/accessRules.ts (1326→1176) + YENİ convex/lib/accessRuleRead.ts, convex/lib/accessRuleWrite.ts. Rapor /tmp/backend-b2a-rapor.md
- B4: convex/actions/hikvisionSync.ts (924→386, "use node") + YENİ convex/lib/hikSyncEmployee.ts. Rapor /tmp/backend-b4-rapor.md

Kontrol (her biri):
1. Registered fonksiyonlar: ad, args validator, returns, sarmalayıcı türü (authedQuery/adminMutation/internalAction…) eskiyle aynı; `internal.*`/`api.*` referansları kırılmamış (grep).
2. Taşınan gövde eskisiyle satır satır eşdeğer: ctx.db okuma/yazma sırası ve sayısı, index kullanımı, ctx.scheduler.runAfter sırası+argümanı, audit kayıtları, ConvexError metinleri, dönüş şekli.
3. Yetki (en kritik): B2a'da resolveProjectScope / admin kontrolü her yolda ve aynı sırada çalışıyor mu; lib fonksiyonu yetkisiz çağrılabilir bir yerden import ediliyor mu (grep importer'lar). B1'de proje kapsamı ve project_user ücret gizleme (ücret alanları null) korunmuş mu.
4. B4: Hik erişim geri alma (akış 2A, 9afded2e) dalları, retry/backoff, deviceSyncRuns sonuç yazımı, biyometrik yolları birebir; hikSyncEmployee.ts'i YALNIZ "use node" dosyası import ediyor mu (V8 query/mutation import ederse deploy kırılır).
5. R8: PDKS tablo=ham, bordro=net+haftalık ayrımı korunmuş; convex/__snapshots__/ değişmemiş.
6. `any`/`as any` yok; yeni `!` non-null eklenmemiş (eskiden olanlar korunabilir).

Kapılar (kendin koş):
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` ve `-p tsconfig.app.json`
- `node_modules/.bin/eslint convex/cardReadings.ts convex/accessRules.ts convex/actions/hikvisionSync.ts convex/lib/pdksTableQuery.ts convex/lib/pdksPayrollQuery.ts convex/lib/accessRuleRead.ts convex/lib/accessRuleWrite.ts convex/lib/hikSyncEmployee.ts`
- `node_modules/.bin/vitest run convex` (tüm convex testleri; başka oturumun yarım işinden gelen alakasız kırmızıyı dosya adıyla ayır)
- `git status --porcelain convex/__snapshots__` boş olmalı

Rapor: /tmp/backend-denetim-1.md — ENGEL/DÜZELT/NOT, file:line, eski vs yeni, öneri; worker başına SAF/SAF DEĞİL hükmü + kapı özetleri.
worker_done (≤10 satır): sayılar + hükümler + kapılar.
