# Denetim — Codex diff (input fix dalga 2b/3)
Dosyalar (Codex worker'lar yazdı, sen denetle):
src/components/access-control/CardReadingsFilters.tsx
src/components/access-control/DoorStatusPlanEditor.tsx
src/components/access-control/door-dialog/DoorVerifyPlanEditor.tsx
src/components/access-control/door-dialog/DoorVerifyPlanSection.tsx
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx
src/components/access-control/unified/templates/TemplatePicker.tsx
src/components/admin/ProjectMembersContent.tsx (+ .test.tsx)
src/components/admin/components/AdminListParts.tsx
src/components/admin/components/UserFormDialog.tsx
src/components/admin/projects/ProjectEditor.tsx
src/components/devices/ClaimDeviceDialog.tsx
src/components/devices/form-sections/DeviceLocationSection.tsx
src/components/employees/EmployeeConsentsCard.tsx (+ .test.tsx)
src/components/employees/EmployeeFingerprintCard.tsx
src/components/employees/EmployeeFormFields.tsx
src/components/employees/import/BatchCardAssignDialog.tsx
src/components/leaves/EmployeePicker.tsx
src/components/leaves/LeaveFilters.tsx
src/components/leaves/LeaveForm.tsx
src/components/pdks/dashboard/export/PDKSExportColumns.tsx
src/components/settings/SettingsSidebar.tsx
src/components/settings/sections/MailSettings.tsx
src/components/settings/sections/ReportsSettings.tsx
src/components/settings/sections/components/OvertimeSettingsForm.tsx (+ .test.tsx)
src/components/settings/sections/components/PdksRulesSettings.tsx (+ .test.tsx)
src/components/settings/sections/components/pdksRulesPunchFields.tsx
src/components/settings/sections/general/CompanyInfoForm.tsx
src/components/settings/sections/privacy/RetentionAssistantCard.tsx
src/components/settings/sections/reports/ReportReminderSettings.tsx
src/components/shifts/definitions/AddShiftDialog.tsx
src/components/sync/SyncIssuesBanner.tsx
src/pages/Alarms.tsx
## Kurallar
SALT OKUMA DENETİM. Hiçbir dosyaya YAZMA. `git add/commit/stash/reset/checkout/restore` ÇALIŞTIRMA. npm install/deploy/convex YOK. Worktree açma.
Bağlam: docs/ui-audit-inputs/00_OZET.md (input border audit). Primitive sözleşmesi: ui/input, textarea, select(Trigger), button outline, date-picker tetikleyicisi `aria-invalid="true"` olunca kırmızı border alır (Tailwind v4 `aria-invalid:` = `&[aria-invalid="true"]`). Yeni src/components/ui/native-select.tsx (NativeSelect + nativeSelectClass) ham <select> yerine kullanılır.
Diff: `git diff -- <dosya>` (native-select.tsx izlenmeyen yeni dosya: `cat` ile oku). Diff'te bu işle ilgisiz hunk görürsen rapora yaz.
Kontrol et:
1. Davranış korunmuş mu: select value/onChange/disabled/id/option/data-testid/aria-* kaybolmuş mu.
2. aria-invalid doğru koşula mı bağlı (hatayla eşleşiyor mu), aria-describedby var olan bir id'ye mi işaret ediyor.
3. Yerleşim sınıfları (genişlik, flex) kaybolmuş mu; görünüm sınıfı (bg-background, border, h-10 vb.) className ile geri eklenip primitive ezilmiş mi.
4. Testler zayıflatılmış mı.
5. TS `any` / non-null assertion eklenmiş mi.
Kendi kapın: `node_modules/.bin/vitest run <ilgili test dosyaları>` ve `node_modules/.bin/eslint <dosyalar>`.
Rapor: worker_done ≤10 satır: bulgu varsa file:line + tek cümle sorun + önerilen düzeltme; yoksa "temiz". Önem: Y (davranış bozulması) / O / D.
