# FAZ 2A — DÜZELTME 1
ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Önceki iş: `.claude/orca-specs/akis-faz2a-geri-alma.md` (commit'siz, main'de), yazar raporu `/tmp/akis-faz2a-rapor.md`, denetim `/tmp/akis-faz2a-denetim.md` (bulguların yer/senaryo/öneri ayrıntısı orada — önce onu oku).
Rapor: `/tmp/akis-faz2a-fix1-rapor.md`.

## Hedef (test edilebilir)
Bekleyen/yeniden denenen hiçbir eski silme işi, o anda aynı projede o `employeeNo` ile geçerli yetkisi olan kişiyi cihazdan silmez; kart+proje birlikte değişince eski kart eski projenin Hik cihazlarından silinir; büyük kuralda (500 üye) kural düzenleme/silme/pasifleştirme Convex sınırına takılmaz.

## İşler
E1 (ENGEL). Silme çalışmadan hemen önce canlı veriyi kontrol et — üç yolun hepsinde (cron işçisi `convex/actions/hikQueueWorker.ts`, manuel `retrySyncIssue` `convex/hikvisionSync.ts`, `executeGrantTarget` `convex/deviceSyncRuns.ts`): aynı projede `cardNumber === employeeNo` olan çalışanın bu cihazda geçerli hedefi varsa işi silmeden kapat ("yerine geçildi" açıklamasıyla, `done`). Ayrıca başarılı `addPerson/updatePerson` sonrası (`convex/actions/hikvisionSync.ts` ~:357) aynı (cihaz, employeeNo) için bekleyen `deletePerson/deleteCard` işlerini kapat. Testler: Senaryo A (yeniden yetki sonrası eski silme → kişi silinmez), Senaryo B (eski kart başka kişiye verildi → Y silinmez), `executeGrantTarget` güncel kartın silmesini çalıştırmaz.
D2. `convex/lib/employeeCardChange.ts` + çağıran `convex/employees.ts` güncelleme yolu (~:280/:302): Hik snapshot'ını patch'ten ÖNCE al (eski proje + eski üyelik); proje değişse de eski kart eski projenin cihazlarından silinsin ve yeni kart senkronu zamanlansın. Test: kart+proje aynı güncellemede değişir.
D1. `convex/accessRules.ts` (~:1054, :851, :741): yalnız gerçekten etkilenenleri snapshot'la (üye çıkarmada çıkan üyeler; cihaz/kapı çıkarmada yalnız etkilenen cihazlar). Kural silme/pasifleştirmede tüm üyeler gerekiyorsa planı parçala (kendini yeniden zamanlayan internalMutation, parça başına sabit üye sayısı; ilişkiler parçalar bitmeden silinmesin ya da hedefler önce sabitlensin — tasarım senin, raporda gerekçele). Offline cihaz çıkarılınca üye başına ayrı action yerine tek toplu action (`deviceSyncRuns.ts` ~:435). Test: 500 üyeli fixture'da üye çıkarma + kural silme + pasifleştirme hatasız, zamanlanan iş sayısı sınırlı.
D3. Çözülemez silme satırları (cihaz silinmiş ya da payload'da eski kimlik yok — eski `syncEmployeeDevices` kalıntısı): yalnız super_admin, gerekçe zorunlu, audit log'a yazılan açık kapatma (`convex/hikvisionSync.ts` ~:755 tekli kapatma). Sessiz otomatik kapatma YOK. Mevcut UI kapatma düğmesi bu uca gidiyorsa UI'a dokunma; UI değişikliği gerekirse DUR ve `ask`.

## Ownership
`convex/actions/hikQueueWorker.ts`, `convex/actions/hikvisionSync.ts`, `convex/hikvisionSync.ts`, `convex/deviceSyncRuns.ts`, `convex/lib/employeeCardChange.ts`, `convex/lib/peopleHikSnapshot.ts`, `convex/lib/accessGraph.ts`, `convex/accessRules.ts` (yalnız silme/snapshot hunk'ları; Faz 1 rol kontrolleri ve audit hunk'ları kalır), `convex/employees.ts` (yalnız güncelleme/silme yolundaki kart değişimi çağrısı), `convex/hikRevocation.test.ts`, `convex/orphanGuards.test.ts` (yalnız 2A beklentileri), yeni test dosyası açabilirsin (`convex/hikRevocation.*.test.ts`).
## Kapsam dışı
`convex/schema.ts` (yeni durum/alan gerekirse DUR, `ask`) · `convex/cardReadings.ts`, `convex/pdksRecords.ts`, `convex/akisFaz1.authz.test.ts` (Faz 1) · `shifts.ts`/`departments.ts` · parmak izi akışı · IDE akışı · UI · denetim raporundaki NOT maddeleri (yalnız E1'in doğal sonucu olanlar hariç).

commit/push/deploy/migration/DB yazma YOK. Rapor: `worker_done`'da ≤10 satır, file:line, `--files-modified` + `--report-path /tmp/akis-faz2a-fix1-rapor.md`.
