Repo: /Users/emreaydin/ngsaccess. SALT-OKUMA DENETİM — hiçbir dosyaya yazma (rapor dosyası hariç: .claude/orca-specs/kapi-planlari-denetim-rapor.md).

BAĞLAM: Codex işçileri "Kapı planlarını Geçiş Kontrol'e taşı" işini yaptı (plan: .claude/plan-kapi-planlari.md; specler: .claude/orca-specs/kapi-planlari-faz1.md, kapi-planlari-faz2.md). Yazan Codex → denetleyen sensin. Raporu değil DIFF'i oku ve kapıları KENDİN koş.

DOSYALAR (git diff HEAD ile oku): convex/doors.ts, convex/schema.ts (yalnız doors alanları; cardReadings by_device_access_time index'i başka oturumun, kapsam dışı), convex/lib/doorStatusPlan.ts, convex/lib/gatewayCommand.ts, convex/lib/gateway/{capabilities,plans}.ts, convex/actions/hikGatewayDevice.ts, convex/actions/hikQueueWorker.ts, convex/doorPlans.test.ts, convex/doorPlanModels.test.ts, convex/doorPlanGateway.test.ts, convex/doorStatusPlan.integration.test.ts, convex/deviceCenter.test.ts, src/components/access-control/unified/UnifiedAccessControl.tsx, src/components/access-control/door-plans/**, src/components/access-control/door-dialog/**, src/components/access-control/DoorStatusPlanEditor*.tsx, src/components/access-control/doorPlanResult*.ts.

DENETLE (öncelik sırası):
1. Doğruluk: canlı cihaza yanlış plan gidebilir mi? (gün/segment dönüşümü, gece yarısı bölme, ≤8 segment, şablon→plan çevrimi, revision/eski sonuç yarışları, direct vs queue yolu aynı mı)
2. ISAPI sözleşmesi: DoorStatusWeekPlanCfg, DoorStatusPlanTemplate, DoorStatusHolidayPlanCfg/GroupCfg, VerifyWeekPlanCfg, CardReaderPlan istek gövdeleri resmi belgeyle uyumlu mu? Kaynak: /tmp/isapi-pdf/fp.txt (yoksa `pdftotext -layout "/Users/emreaydin/ngsaccess/ISAPI_FingerPrint Terminals_Pro Series.pdf" /tmp/isapi-pdf/fp.txt`). Alan adı/tip/zorunluluk farklarını satır numarasıyla yaz. Capability kapısı (isSupport*) her yeni endpoint'te var mı?
3. Yetki/kiracı: updatePlans/listPlanTargets/toplu işlemler accessRules.manage + proje izolasyonu; başka projenin kapısına plan yazılabilir mi? Gönderim sonucu sunucu tarafında mı yazılıyor (istemciye güvenilmiyor mu)?
4. Geriye uyum: eski tek-pencere hikVerifyPlan ve eski hikDoorStatusPlan kayıtları okunup gönderilebiliyor mu? Kuyruk (hikQueueWorker) eski davranışı bozdu mu (doorNo+100 slotu)?
5. UI: sekme yetki kapısı, boş durum, hata/tekrar gönder, toplu (≤50) sonuç listesi; CLAUDE.md kuralları (any yok, camelCase, filter(Boolean) yerine type guard).

KAPILAR (kendin koş, çıktı sayılarını yaz): `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run` · `node scripts/find-node-leak.mjs`.

YASAKLAR: kod dosyasına yazma, git add/commit/stash/checkout/reset/restore, `npx convex dev|deploy|codegen|run`, canlı cihaz/Convex çağrısı YOK.

RAPOR: bulguları .claude/orca-specs/kapi-planlari-denetim-rapor.md'ye yaz (önem: Yüksek/Orta/Düşük, file:line, kanıt, önerilen düzeltme). worker_done'da ≤10 satır: bulgu sayıları + en kritik 3 bulgu + kapı sonuçları.
