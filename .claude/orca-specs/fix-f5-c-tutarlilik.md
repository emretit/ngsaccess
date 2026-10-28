# FAZ 5-C — Yetki Durumu departmanı (K-09) · İK kayıt sonrası cihaz mesajı (K-10) · proje silme matrisi (Y-09) · Windows köprüsü seçimi gizle (5.4)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma). Rapor: `/tmp/fix-f5-c-tutarlilik-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` + `M1-kisi-erisim.md` / `M4-hesap-yonetim.md` / `OZET.md` 5.4 (K-09, K-10, Y-09 — kanıtı yeniden doğrula).

## Hedef (test edilebilir)
(a) Departmanı değişen kişi Yetki Durumu'nda güncel departmanla görünür/filtrelenir; (b) İK rolü kişi kaydedince yanlış "cihaz gönderimi tamamlanamadı" hatası görmez, import sonunda yetkisiz resync çağrılmaz; (c) proje silme önizlemesi ve silme aynı tablo listesinden üretilir, alarmSettings / pdksRuleVersions / pdksCheckpointSelections / accessScheduleTemplates dahil; (d) ertelenen Windows köprüsü cihaz formunda yeni cihaz için seçilemez (mevcut kayıtlı cihazlar bozulmaz).

## Ownership
`convex/lib/grantStatus.ts`, `convex/accessGrantStatus.ts`, `src/components/employees/hooks/useEmployeeFormSubmit.ts`, `src/components/employees/import/EmployeeImportDialog.tsx`, `convex/lib/adminGuards.ts`, `convex/projects.ts`, `src/components/devices/hooks/useDeviceFormSchema.ts`, `src/components/devices/form-sections/DeviceHikLocalBridgeSection.tsx` (+ seçimin yapıldığı device form bileşeni — hangi dosya olduğunu rapora yaz), ilgili testler + yeni `convex/fixF5Consistency.test.ts`.
DOKUNMA: `convex/employees.ts`, `convex/employeeAuth.ts`, `convex/lib/employeeCascade.ts`, `convex/visitors.ts`, `src/pages/EmployeeSetup.tsx`, `src/pages/CheckIn.tsx` (F5-B) · `convex/invites.ts`, `convex/auth.ts`, `src/pages/UserSetup.tsx`, `src/pages/Login.tsx` (F5-A) · `convex/actions/sendEmail.ts`, `convex/actions/sendScheduledReports.ts`, `src/components/settings/**`, `src/lib/capabilities.ts`, `convex/lib/auditLogQuery.ts`, `package.json` (başka oturum WIP) · `convex/lib/pdks*`, `src/components/reports/**`, `src/lib/reports/**`. `convex/schema.ts` dokunma.

## Değişiklikler
1. **K-09** — `employees.ts`'e dokunmadan OKUMA tarafında düzelt: Yetki Durumu listesi/filtresi departmanı grant satırının kopyasından değil kişinin GÜNCEL `departmentId`'sinden türetsin (`accessGrantStatus.ts:~24,56`, `grantStatus.ts:~84`). Filtre performansı: kişi okumalarını sayfa başına toplu yap (N+1 yok, kör collect yok).
2. **K-10** — `useEmployeeFormSubmit.ts:~157` kayıttan sonra `syncEmployeeToDevices`'ı yalnız kullanıcının `accessRules.manage` yetkisi varsa çağırsın (yetki bilgisi mevcut capability/permission hook'undan); yoksa sessiz geç (backend create zaten internal gönderim planlıyor — doğrula). `EmployeeImportDialog.tsx:~103` proje resync düğmesi/çağrısı yalnız `devices.manage` varsa; yoksa "Kişiler cihazlara otomatik gönderilecek" bilgisi.
3. **Y-09** — `adminGuards.ts:~37,62` + `projects.ts:~120`: proje sahibi tüm tablolar için TEK matris (her tablo: engelle / sil / koru); önizleme ve silme bu listeden üretilsin; eksik dört tablo eklensin. Silme sayfalı/sınırlı (mevcut desen) — yeni kör collect yok. Matrise girmeyen projectId'li tablo kalmasın: schema.ts'teki `projectId` alanlı tabloları tarayan bir test yaz (liste dışı tablo → test kırmızı).
4. **5.4** — Windows (Hik yerel SDK) köprüsü seçeneği yeni cihaz formunda gizli/kapalı; mevcut bu tipte cihaz düzenlenirken alan salt-okunur görünür ve kayıt bozulmaz. Backend'e dokunma.

## Kabul (testler)
- Departman değişimi sonrası Yetki Durumu filtresi yeni departmanla eşleşir (test); İK rolünde form kayıt sonrası sync çağrılmaz, yönetici rolünde çağrılır (test); proje silme önizlemesi = silme listesi + projectId tablo kapsama testi; Windows seçeneği yeni formda yok (test).
- Kapılar (fix-ortak.md) + `vitest run convex/accessGrantStatus*.test.ts convex/lib/grantStatus*.test.ts convex/projects*.test.ts convex/lib/adminGuards*.test.ts convex/fixF5Consistency.test.ts src/components/employees src/components/devices` (var olanlar) yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
