# Backend B4 — actions/hikvisionSync.ts ("use node" action dosyası)

Hedef: `convex/actions/hikvisionSync.ts` içindeki `syncEmployeeToDevicesInternal` (~303 satır) ve `syncWeekPlanToDevicesInternal` (~179 satır) gövdeleri lib'e taşınır; internalAction'lar aynı dosyada ince sarmalayıcı kalır (`internal.actions.hikvisionSync.*` referansları 9 yerde kullanılıyor — ad/args aynı kalmalı); davranış birebir.

Ownership:
- convex/actions/hikvisionSync.ts
- YENİ: convex/lib/hikSyncEmployee.ts, convex/lib/hikSyncWeekPlan.ts (isimler önerilir), isteğe bağlı *.test.ts
- DOKUNMA: convex/hikvisionSync.ts (registered query/mutation dosyası — V8 runtime), convex/lib/gateway/*, convex/lib/gatewayCommand.ts, peopleHikSnapshot.ts, employeeCardChange.ts, hikQueueWorker.ts (yalnız import et)

Dikkat:
- Yeni lib'ler node-yalnız modül (./gateway/*, ./hikGateway) import edecekse YALNIZ actions/hikvisionSync.ts'ten import edilmeli; grep ile doğrula (convex/hikvisionSync.ts gibi V8 dosyası import ETMEMELİ).
- Akış 2A (Hik erişim geri alma) yeni commit'lendi: silme/geri alma dalları, retry/backoff, deviceSyncRuns sonuç yazımı, biyometrik (yüz/parmak izi) yolları sıra + argüman dahil BİREBİR.

Vitest: `node_modules/.bin/vitest run convex/hikvisionSync.test.ts convex/hikRevocation.test.ts convex/actions convex/lib/deviceSyncRun.test.ts convex/lib/gateway`
Rapor yolu: /tmp/backend-b4-rapor.md
