# Dalga 3 / W3 — DetailFieldList + FormFeedback (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga3-ortak.md
Rapor bölümleri: ortak-bilesen-B.md §B06 (DetailFieldList), §B07 (FormFeedback).

## Hedef (test edilebilir)
1. Yeni `src/components/shared/DetailFieldList.tsx`:
   `type DetailField = { key: string; label: string; value: ReactNode; numeric?: boolean }`;
   `{ fields: readonly DetailField[]; columns?: 1 | 2; emptyValue?: ReactNode; className?: string }`.
   `dl > div > dt + dd`; dt `text-xs text-muted-foreground`, dd `mt-1 text-sm break-words` (numeric → tabular-nums), alanlar arası `space-y-4`
   (columns=2 → `grid gap-4 sm:grid-cols-2`). Boş = null/undefined/"" (0 ve false boş DEĞİL) → emptyValue, varsayılan "—".
   Bilinçli birleştirme: ziyaretçide "Belirtilmedi" → "—"; tüm ayrıntı panellerinde etiket/değer boyutu ve boşluk aynı olur.
   Uygula: EmployeeDetails.tsx (~97), VisitorSlideOverPanel.tsx (~71, ~76), LeaveDetails.tsx (~51), AuditDetailPanel.tsx (~13),
   PDKSEmployeeDetailDrawer.tsx (~147). Kart maskeleme, durum rozeti vb. value slotunda kalır.
2. Yeni `src/components/shared/FormFeedback.tsx`:
   `{ tone: "error" | "info"; title?: string; children: ReactNode; id?: string; variant?: "inline" | "panel"; action?: ReactNode }`.
   error → `role="alert"`, info → `role="status"`. inline = `text-sm` (error: `text-destructive`); panel = çerçeveli kutu (`rounded-md border p-3 text-sm`,
   error: destructive kenarlık/renk). Uygula: VisitorForm.tsx (~46), EmployeeForm.tsx (~220), DeviceForm.tsx (~296), ProjectEditor.tsx (~147),
   ManualPdksEditDialog.tsx (~195, hata listesi → panel), SettingsFormState.tsx (~36 DraftNotice: yalnız görünüm ortaklaşır, uzak kayıt değişikliği mantığı yerinde kalır).
   Mevcut mesaj metinlerini ve id/aria-describedby bağlarını koru; gerçekten korunmayan taslak için "korundu" mesajı ÜRETME.
3. Testler: DetailFieldList.test.tsx (boş değer kuralı, 0/false, columns), FormFeedback.test.tsx (role'ler, variant sınıfları).

## Ownership (yalnız bunlara yaz)
- src/components/shared/DetailFieldList.tsx (+ test, yeni), src/components/shared/FormFeedback.tsx (+ test, yeni)
- src/components/employees/EmployeeDetails.tsx, src/components/visitors/VisitorSlideOverPanel.tsx, src/components/leaves/LeaveDetails.tsx
- src/components/audit/AuditDetailPanel.tsx, src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx
- src/components/visitors/VisitorForm.tsx, src/components/employees/EmployeeForm.tsx, src/components/devices/DeviceForm.tsx
- src/components/admin/projects/ProjectEditor.tsx, src/components/pdks/ManualPdksEditDialog.tsx, src/components/settings/SettingsFormState.tsx
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapsam dışı
Sheet/Dialog kabukları (DetailSheet/FormDialog sonraki dalga), form footer'ları (FormActions zaten ortak), shared/ErrorState.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/components/employees src/components/visitors src/components/leaves src/components/audit src/components/pdks src/components/devices src/components/admin/projects src/components/settings`
- `node_modules/.bin/vitest run src/components/shared src/components/employees src/components/visitors src/components/leaves src/components/audit src/components/pdks src/components/devices src/components/admin src/components/settings`
