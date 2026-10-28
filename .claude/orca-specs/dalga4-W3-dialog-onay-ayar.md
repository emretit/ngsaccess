# Dalga 4 / W3 — FormDialog + ConfirmAction + SettingsSection (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga4-ortak.md
Rapor bölümleri: ortak-bilesen-B.md §B04 (FormDialog), §B10 (ConfirmAction), §B12 (SettingsSection).

## Hedef (test edilebilir)
1. Yeni `src/components/shared/FormDialog.tsx`: `{ open; onRequestClose; pending; title: string; description?: ReactNode; size?: "sm" | "md" | "lg";
   onSubmit: FormEventHandler<HTMLFormElement>; children; footer: ReactNode; returnFocus?: RefObject<HTMLElement | null> }`.
   Dialog + başlık/açıklama + `<form>` + footer slot (FormActions layout="dialog" ile kullanılır); pending iken Escape/dış tıklama kapatmaz;
   yüksekliği uzun formda `max-h-[90dvh]` + gövde kaydırma (bilinçli birleştirme). Sorgu/validasyon/mutation çağıranda kalır; mevcut dirty guard akışı korunur.
   Uygula: access-control/AddZoneDialog.tsx (~38), departments/AddDepartmentDialog.tsx (~51), admin/projects/ProjectEditor.tsx (~76),
   visitors/VisitorZoneDialog.tsx (~87), pdks/ManualPdksEditDialog.tsx (~87), devices/AssignLocationForm.tsx (~97).
2. Yeni `src/components/shared/ConfirmAction.tsx`: yıkıcı OLMAYAN async onay — `{ open; onOpenChange; title; description: ReactNode; confirmLabel;
   pendingLabel?; errorTitle?; onConfirm: () => Promise<unknown> }`; ConfirmDestructive ile aynı sözleşme (useAsyncAction, pending kilidi,
   yalnız başarıda kapanır, odak geri döner) ama birincil (default) düğme. Mümkünse iç kabuğu ConfirmDestructive ile paylaş, ConfirmDestructive'in
   dış API'si ve görünümü DEĞİŞMEZ. Uygula: devices/DeviceCommandCenter.tsx (~115), admin/components/PasswordResetDialog.tsx (~12),
   access-control/unified/SyncRuns.tsx (~175). Çift mutation/çift toast üretme.
3. Yeni `src/components/shared/SettingsSection.tsx`: `{ id?; title: string; description?: ReactNode; children; actions?: ReactNode; divided?: boolean;
   density?: "compact" | "regular" }` — `section aria-labelledby` + h3 başlık. Uygula: settings/sections/MailSettings.tsx (~166),
   pdks/settings/WorkingDaysSettings.tsx (~28), employees/EmployeeConsentsCard.tsx (~118).
4. Testler: FormDialog.test.tsx, ConfirmAction.test.tsx, SettingsSection.test.tsx.

## Ownership (yalnız bunlara yaz)
- src/components/shared/FormDialog.tsx, ConfirmAction.tsx, SettingsSection.tsx (+ testleri, yeni)
- src/components/shared/ConfirmDestructive.tsx (YALNIZ iç kabuk paylaşımı için; dış API/görünüm aynı)
- src/components/access-control/AddZoneDialog.tsx, src/components/departments/AddDepartmentDialog.tsx, src/components/admin/projects/ProjectEditor.tsx
- src/components/visitors/VisitorZoneDialog.tsx, src/components/pdks/ManualPdksEditDialog.tsx, src/components/devices/AssignLocationForm.tsx
- src/components/devices/DeviceCommandCenter.tsx, src/components/admin/components/PasswordResetDialog.tsx, src/components/access-control/unified/SyncRuns.tsx
- src/components/settings/sections/MailSettings.tsx, src/components/pdks/settings/WorkingDaysSettings.tsx, src/components/employees/EmployeeConsentsCard.tsx
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapsam dışı
LeaveForm (W2), DetailSheet (W2), DateRangeFields (shifts işi bitince ayrı).

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/components/access-control src/components/departments src/components/admin src/components/visitors src/components/pdks src/components/devices src/components/settings src/components/employees`
- `node_modules/.bin/vitest run src/components/shared src/components/access-control src/components/departments src/components/admin src/components/visitors src/components/pdks src/components/devices src/components/settings src/components/employees src/pages`
