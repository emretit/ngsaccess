Repo: /Users/emreaydin/ngsaccess (TypeScript strict, Convex backend, React). Önce oku: CLAUDE.md, convex/_generated/ai/guidelines.md, .claude/plan-kapi-planlari.md (Faz 1 adımları 1–7).

HEDEF (test edilebilir): Geçiş Kontrol sayfasında (`src/components/access-control/unified/UnifiedAccessControl.tsx`) 4. sekme "Kapı Planları" (`?tab=doors`, yalnız `can("accessRules.manage")`) projedeki Hikvision GATEWAY kapılarını listeler; kapıya tıklayınca açılan dialogda kapı durum planı + doğrulama modu planı düzenlenir, kaydedilir ve cihaza gönderilir (hata → "Tekrar gönder").

BAĞLAM: Bu plan UI'ı az önce Cihazlar → Kapıyı Düzenle'den kaldırıldı. Eski çalışan kod: `git show HEAD:src/components/access-control/EditDoorDialog.tsx` (plan state, normalizeDoorStatusPlan, doorPlanTimeSchema doğrulaması, applySelectedDoorPlans, DoorSaveResults, retry). Hazır parçalar: src/components/access-control/door-dialog/{DoorStatusPlanSection,DoorVerifyPlanSection,DoorSaveResults}.tsx, DoorStatusPlanEditor.tsx, doorPlanResult.ts. Eski test: `git show HEAD:src/components/access-control/DoorStatusPlanEditor.test.tsx` son describe ("EditDoorDialog haftalık kayıt").

YAPILACAK:
1. convex/doors.ts: `updatePlans` authedMutation (args: doorId, hikDoorStatusPlan?, hikVerifyPlan? — mevcut validator'ları kullan; normalizeDoorStatusPlan uygula; yetki `requirePermission(..., "accessRules.manage")`; kapının cihazı brand hikvision + hikTransport gateway değilse ConvexError). `listPlanTargets` authedQuery (args projectId; yetki accessRules.manage yoksa []; dönen: doorId, doorName, deviceName, zoneName|null, deviceOnline (convex/lib/deviceConnection.ts deviceConnection), hikDoorStatusPlan|null, hikVerifyPlan|null; yalnız gateway Hik kapıları; .take sınırlı). Yeni fonksiyonları doors.ts'e koy (api.d.ts değişmesin).
2. convex/lib/gatewayCommand.ts runApplyDoorStatusPlan (~543) ve runApplyVerifyPlan (~655): permission "devices.manage" → "accessRules.manage". Önce convex/lib/roleCatalog.ts ROLE_DEFAULTS'a bak; kim kazanır/kaybeder raporda yaz.
3. UI: src/components/access-control/door-plans/ altında DoorPlansTab.tsx (liste: kapı · cihaz · bölge · durum planı özeti örn "Kapalı" / "Pzt–Cum 08:00–18:00 sürekli açık" · doğrulama özeti · çevrimdışı rozeti; satır tıklama = src/lib/tableRowClick.ts onRowActivate + ROW_CLICK_CLASS) ve DoorPlanDialog.tsx (eski EditDoorDialog plan mantığı, kaydet → api.doors.updatePlans → api.actions.hikGatewayDevice.applyDoorStatusPlan/applyVerifyPlan). Aktif proje: useActiveProjectScope. Boş durum: "Plan kurulabilecek Hikvision kapısı yok" (EmptyState).
4. Testler: eski "haftalık kayıt" testini DoorPlanDialog'a uyarla (yeni dosya). convex testi convex/doorPlans.test.ts: updatePlans yetki (accessRules.manage var/yok), gateway olmayan kapı reddi, listPlanTargets proje izolasyonu. Desen: convex/roles.devices.test.ts.

KAPSAM DIŞI: Faz 2 (şablon, haftalık doğrulama, toplu, tatil, durum kolonu). Cihazlar sayfası dosyaları, sanal okuyucu dosyaları, başka oturumların değiştirdiği dosyalar (git status'ta M olan ve sana ait olmayan hiçbir dosyaya yazma).

OWNERSHIP (yalnız bunlara yaz): convex/doors.ts, convex/lib/gatewayCommand.ts, convex/doorPlans.test.ts (yeni), src/components/access-control/unified/UnifiedAccessControl.tsx, src/components/access-control/door-plans/** (yeni), src/components/access-control/door-dialog/** (gerekirse), src/components/access-control/doorPlanResult.ts.

KAPILAR (hepsi yeşil olmalı): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` (0 error, no-explicit-any 0) · `node_modules/.bin/vitest run` (TAM suite) · `node scripts/find-node-leak.mjs`.

YASAKLAR: git add / git commit / git stash / git checkout / git reset / git restore YASAK (yalnız `git show`/`git diff`/`git status` okuma). `npx convex dev|deploy|codegen|run` YASAK (canlı deployment). Canlı cihaza/Convex'e hiçbir çağrı, DB yazma, migration yok. `any`/`as any` yok. Supabase MCP kullanma.

RAPOR: worker_done'da ≤10 satır, file:line ile: ne eklendi, yetki değişiminin rol etkisi, kapı sonuçları (sayılarla), açık kalanlar.
