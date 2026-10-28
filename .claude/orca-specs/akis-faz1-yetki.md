# FAZ 1 — Sunucu tarafı rol ve proje (müşteri) ayrımı açıkları

ÖNCE oku ve uy: `/Users/emreaydin/ngsaccess/.claude/orca-specs/akis-ortak.md`. Kanıtlar: `docs/genel-akis-audit/A-kisi-erisim.md` (bulgu 2, 5), `B-pdks-rapor.md` (bulgu 2), `C-kurulum-cihaz-yonetim.md` (bulgu 1, 2).
Rapor: `/tmp/akis-faz1-rapor.md`.

## Hedef (test edilebilir)
project_user ve başka projenin yöneticisi, aşağıdaki yazma/okuma yollarını SUNUCUDA reddedilir; her yol için "reddedilir" testi var.

## İşler
1.1 `convex/accessRules.ts` create/update/remove/createWithGroups (ve aynı dosyadaki diğer kural YAZMA fonksiyonları): yalnız super_admin + kendi projesinde project_admin. Mevcut `adminMutation` (`convex/lib/customFunctions.ts`) + mevcut proje kapsamı kontrolleri. Okuma (list/get) davranışı DEĞİŞMEZ.
1.2 `convex/doors.ts`, `convex/zones.ts`, `convex/readers.ts` topoloji YAZMA fonksiyonları: aynı yönetici kuralı. `doors.update` (ve create) istemciden gelen `deviceId`'yi yükle; cihaz yoksa veya `device.projectId !== door.projectId` (hedef bölge değişiyorsa hedef bölgenin projesi) ise reddet. Kapı/okuyucu durum sorgusunda (audit C bulgu 1: ~`doors.ts:426/447/473`) kapı-cihaz-okuyucu projesi tutarsızsa son kart/kişi bilgisini DÖNDÜRME.
1.3 `convex/holidays.ts`: list projectId verilmezse yalnız global (projectId'siz) + kullanıcının izinli projeleri; super_admin hepsini. create/remove/seed: projectId varsa izinli proje şart; projectId'siz (global) tatil yazımı yalnız super_admin. listForRange vb. diğer okumalar aynı kapsam.
1.4 `convex/auditLog.ts` `getPdksAuditForEmployee`: önce `requireEmployeeAccess` (veya repo'daki eşdeğeri); global son-500 yerine mevcut `by_target` indeksiyle (`targetTable`,`targetId`) çalışana ait kayıtlar; projectId'si başka/boş `bulk-upsert` kayıtları dönmez. `convex/pdksRecords.ts` bulk-upsert audit yazımına (~:113) projectId ekle (yalnız audit satırı hunk'ı).
1.5 Kart olayı eşleştirme `convex/cardReadings.ts` (~:910, :1001, :1067 Hik/IDE yolları): kişi araması cihazın projesiyle sınırlı (cihaz projesizse mevcut davranış + not). Uygun indeks yoksa mevcut indeksle aday al + proje filtresi (kart başına aday sayısı küçük). `convex/employeeImport.ts` `assignCards`: kart tekilliği `employees.create` ile AYNI kural (global ise global).
1.6 Testler: her iş için en az bir "project_user reddedilir" + "başka projenin admin'i reddedilir" + "kendi projesinin admin'i başarır". Mevcut test yardımcılarını kullan (`convex/*.test.ts` convex-test kalıbı).

## Ownership
`convex/accessRules.ts`, `convex/doors.ts`, `convex/zones.ts`, `convex/readers.ts`, `convex/holidays.ts`, `convex/auditLog.ts`, `convex/pdksRecords.ts` (yalnız audit hunk'ı), `convex/cardReadings.ts` (yalnız 1.5 eşleştirme hunk'ları), `convex/employeeImport.ts`, `convex/lib/customFunctions.ts` (yalnız gerekirse yardımcı ekleme) + bu dosyaların test dosyaları (yeni `convex/*.authz.test.ts` açabilirsin). Frontend: yalnız bu değişiklik yüzünden kırılan çağrı varsa `src/**` içindeki o çağrı yeri — önce `ask`.
## Kapsam dışı
Kapı açma yetkisi (project_user web'den kapı açar — BİLİNÇLİ karar, dokunma) · Hik/IDE silme/senkron mantığı (Faz 2) · PDKS hesapları (Faz 3) · `schema.ts`.
