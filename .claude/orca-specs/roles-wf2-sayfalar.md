# Roller W-F2 — sayfa/bileşen düzeyinde yetki görünürlüğü (frontend)

## Hedef
Aşağıdaki dosyalarda `isAdmin`, `isSuperAdmin` (platform dışı kullanım), `capabilities(...)`, `profile?.role === ...` ile yapılan düğme/sekme/kolon görünürlüğü `usePermissions().can("<anahtar>")`'a çevrilir (INVENTORY.md'deki anahtar). Sunucu reddedeceği eylemi kullanıcıya göstermeyiz; görünür olup sunucunun izin verdiği eylemi gizlemeyiz.

## Ownership (yalnız bunlar)
src/components/access-control/** · src/components/dashboard/{LiveFeed,QuickLinksGrid,SetupChecklist}.tsx · src/components/devices/** · src/components/employees/{EmployeeConsentsCard,EmployeeFingerprintCard,EmployeeTable,SlideOverPanel}.tsx · src/components/employees/table/** · src/components/leaves/** · src/components/live-monitoring/ReadingDetailPanel.tsx · src/components/pdks/** · src/components/shifts/** · src/components/sync/SyncIssuesBanner.tsx · src/components/visitors/** · src/hooks/{useEmployees,useProjectFilteredDevices}.ts · src/lib/pdksExportColumns.ts · src/utils/pdksExport.ts · src/pages/{Alarms,Devices,Employees,Index,Leaves,PDKSRecords,Reports}.tsx · bu dosyaların mevcut testleri

## Notlar
- Hook: `src/hooks/usePermissions.ts` (hazır). Anahtarlar: kapı aç → doors.open; cihaz/kapı/okuyucu CRUD + cihaz sırları → devices.manage; kural/şablon/erişim durumu → accessRules.manage; personel ekle/düzenle/sil/içe aktar → employees.manage; biyometrik → biometrics.manage; ücret kolonları/dışa aktarım ücret alanları → pay.view; vardiya/tatil → schedule.manage; izin/düzeltme onayı → attendance.approve; dışa aktarım/raporlar → reports.view; ziyaretçi → visitors.manage; alarm onayı → alarms.ack; senkron uyarısı kapatma → devices.manage.
- `useActiveProject().isSuperAdmin` yalnız platform işlemleri (cihaz claim, sistem) için kalabilir.
- SAHİPLİ dosyalara DOKUNMA: src/components/employees/{EmployeeDetails,EmployeeForm,EmployeeSyncConfirmDialog}.tsx, EmployeeSyncConfirmDialog.test.tsx, hooks/useEmployeeFormData.ts.
- Ayarlar/admin/layout/ActiveProjectContext W-F1'in; dokunma.

## Kapılar
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` 0 · `node_modules/.bin/eslint <dosyaların>` 0 error · `node_modules/.bin/vitest run src` yeşil (yalnız SENİN dosyalarına ait kırmızı olmamalı). Test mock'ları: `usePermissions` için `vi.mock("@/hooks/usePermissions", ...)` ile `can` döndür; mevcut testlerde `isAdmin: true` veren mock'lar eşdeğer `can` mock'una çevrilir.
Kabul grep'i: `grep -nE "isAdmin|capabilities\(|project_admin|project_user" <ownership dosyaları (test hariç)>` → 0 satır (isSuperAdmin platform kullanımı serbest).
Tarayıcı doğrulaması YOK.

Rapor yolu: `docs/roles/report-wf2.md`
