# DENETİM — Faz 1 sunucu rol/proje ayrımı (GÜVENLİK)
ÖNCE oku: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-denetim-ortak.md`. Spec: `.claude/orca-specs/akis-faz1-yetki.md`. Yazar raporu: `/tmp/akis-faz1-rapor.md`.
Rapor: `/tmp/akis-faz1-denetim.md`.
Dosyalar: convex/accessRules.ts, convex/doors.ts, convex/zones.ts, convex/readers.ts, convex/holidays.ts, convex/auditLog.ts, convex/pdksRecords.ts, convex/cardReadings.ts, convex/employeeImport.ts, testler convex/employeeImport.test.ts, convex/orphanGuards.test.ts, convex/akisFaz1.authz.test.ts (yeni).
NOT: Aynı ağaçta Faz 2A worker'ı çalışıyor (hikvisionSync, hikQueueWorker, employeeCardChange, peopleHikSnapshot, deviceSyncRuns, employees.ts). Onların farkını denetleme.
## Odak
1. Kalan açık: bu dosyalarda (ve aynı sınıftan komşu modüllerde — örn. `groupDoors`, `groupDevices`, `accessGroups`, `accessScheduleTemplates`, `shifts` yazma uçları) hâlâ `authedMutation` ile yönetici işi yapan yazma var mı? Listele (file:line), Faz 1 kapsamı dışındaysa NOT olarak.
2. Proje kapsamı: her yazmada hedef kayıt + bağlanan kayıt (cihaz, bölge, okuyucu, kural, grup) aynı projede mi; super_admin projesiz kayıtlarda doğru mu; IDOR (başka projenin id'sini vererek) kalmadı mı.
3. Kart eşleştirme (`cardReadings.ts`): cihaz projesine daraltma Hik/IDE/ESP32/QR yollarının HEPSİNDE mi; projesiz cihazda davranış; aynı kart iki projede → doğru kişi; performans (kart başına aday okuma sınırlı mı); yanlış ret riski (meşru geçişin "bilinmeyen kart" olması) var mı.
4. Tatiller: global (projectId'siz) tatillerin PDKS hesabında okunması bozulmadı mı (okuma tarafı rapor/pdks motorlarında `eq("projectId", null)` kullanımı); seed davranışı.
5. auditLog `getPdksAuditForEmployee`: `by_target` ile doğru kayıtlar; eski projectId'siz bulk kayıtların görünmemesi kullanıcı için bilgi kaybı mı (NOT).
6. Frontend kırılması: rol değişen uçları çağıran `src/**` yerleri project_user için zaten gizli mi; gizli değilse kullanıcı ham hata görür mü. `mobile/` bu uçları çağırıyor mu (grep, salt-okuma).
7. Testler gerçekten reddi mi test ediyor (yanlış pozitif yok).
