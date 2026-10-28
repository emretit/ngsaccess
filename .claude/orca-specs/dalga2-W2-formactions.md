# Dalga 2 / W2 — FormActions'ı ortağa taşı + elle yazılmış form footer'ları (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga2-ortak.md
Rapor bölümleri: ortak-bilesen-B.md §B02 (FormActions), §B03 yalnız AssignLocationForm kısmı.

## Hedef (test edilebilir)
1. `src/components/employees/FormActions.tsx` → `src/components/shared/FormActions.tsx` (named export `FormActions`). Eski dosyayı sil (rm),
   EmployeeForm.tsx ve DeviceForm.tsx import'larını güncelle. Bugünkü görünüm/davranış bu iki formda BİREBİR aynı kalır.
2. API'yi geriye uyumlu genişlet (mevcut isLoading, busyLabel, onClose, cancelLabel, className korunur):
   `submitLabel?: string` (varsayılan "Kaydet"), `submitDisabled?: boolean`, `layout?: "sticky" | "dialog"` (varsayılan "sticky" = bugünkü görünüm;
   "dialog" = sticky/border/bg/padding yok, DialogFooter ile aynı hizalama), `extraActions?: ReactNode` (sola hizalı ek düğmeler).
   İptal her zaman `variant="outline"`; submit `type="submit"`. Formun dışından submit gerekiyorsa `form?: string` prop'u ekleyebilirsin.
3. Elle yazılmış footer'ları FormActions'a geçir: VisitorForm.tsx:~48, VisitorZoneDialog.tsx:~115, LeaveForm.tsx:~397, ManualPdksEditDialog.tsx:~205,
   ProjectEditor.tsx:~151, AddZoneDialog.tsx:~47, AddDepartmentDialog.tsx:~89, AssignLocationForm.tsx:~149.
   Her yerde mevcut buton metinleri, pending metni, disabled koşulları (ör. ziyaretçi etkinleştirme metni, izin çakışmasında submitDisabled) korunur.
   ManualPdksEditDialog'daki ghost iptal → outline (bilinçli birleştirme).
4. AssignLocationForm.tsx alanları (~105 bölge, ~127 kapı, manuel hatalar ~124/~146) → `FormFieldWrapper` (src/components/shared/FormFieldWrapper.tsx;
   Select için render-slot kullan). id/name/ref bağları korunur.
5. `src/components/shared/FormActions.test.tsx`: varsayılan etiketler, isLoading'de busyLabel + disabled, submitDisabled, layout="dialog" sınıfları.

## Ownership (yalnız bunlara yaz)
- src/components/shared/FormActions.tsx (yeni) + FormActions.test.tsx (yeni)
- src/components/employees/FormActions.tsx (sil)
- src/components/employees/EmployeeForm.tsx (yalnız import)
- src/components/devices/DeviceForm.tsx (yalnız import)
- src/components/visitors/VisitorForm.tsx, src/components/visitors/VisitorZoneDialog.tsx
- src/components/leaves/LeaveForm.tsx
- src/components/pdks/ManualPdksEditDialog.tsx
- src/components/admin/projects/ProjectEditor.tsx
- src/components/access-control/AddZoneDialog.tsx
- src/components/departments/AddDepartmentDialog.tsx
- src/components/devices/AssignLocationForm.tsx
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/components/employees src/components/devices src/components/visitors src/components/leaves src/components/pdks/ManualPdksEditDialog.tsx src/components/admin/projects src/components/access-control/AddZoneDialog.tsx src/components/departments`
- `node_modules/.bin/vitest run src/components/shared src/components/employees src/components/devices src/components/visitors src/components/leaves src/components/pdks src/components/admin src/components/access-control src/components/departments`
