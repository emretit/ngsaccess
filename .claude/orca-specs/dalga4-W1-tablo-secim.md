# Dalga 4 / W1 — ResponsiveResults + useListSelection (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga4-ortak.md
Rapor bölümleri: ortak-bilesen-A.md §1 (ResponsiveResults), §3 (useListSelection + ListSelectAll).

## Hedef (test edilebilir)
1. Yeni `src/components/shared/ResponsiveResults.tsx`: `{ label: string; desktop: ReactNode; mobile: ReactNode; footer?: ReactNode; className?: string }`.
   Masaüstü tablo kabuğu (`hidden min-w-0 max-w-full overflow-x-auto rounded-md border md:block`) + mobil liste kabuğu (`min-w-0 rounded-md border md:hidden`).
   Bilinçli birleştirme (Emre kararı): kırılım TEK — Tailwind `md` (768px). Bugün ziyaretçi/erişim/admin `min-[761px]`, izin/PDKS `md` kullanıyor.
   Satır içeriği/sütunlar çağıranda kalır; `onRowActivate`/ROW_CLICK_CLASS davranışı korunur.
   Uygula: VisitorTable.tsx (~15/22), CardReadingsTable.tsx (~15/21), LeaveList.tsx (~60/104), PDKSTableView.tsx (~67/75), UserTable.tsx (~90/118),
   ProjectsTable.tsx (~47/90), AdminDevicesPanel.tsx (~228/283).
2. Yeni `src/hooks/useListSelection.ts` (saf seçim: `toggle(id)`, `selectAll(value)`, `checked: boolean | "indeterminate"`) +
   `src/components/shared/ListSelectAll.tsx` (`{ label; checked; onChange; disabled? }`, kısmi durum TEK CSS ile çizilir).
   Görünür liste değişince temizleme/kesişim politikaları ÇAĞIRANDA kalır (useEmployeeTable temizler, useDeviceTable kesişimi korur).
   Uygula: DeviceList.tsx (~128) + useDeviceTable.tsx (~19/31), EmployeeSelectAll.tsx (~14) + useEmployeeTable.ts (~13/26/42),
   PDKSTableView.tsx (~53/83) + usePdksRecordsView.ts (~28; PDKS üst kutusu artık kısmi durumu da gösterir — bilinçli birleştirme).
   Toplu silme/gönderme handler'ları taşınmaz.
3. Testler: ResponsiveResults.test.tsx, useListSelection.test.ts (saf fonksiyonları export edip test et), ListSelectAll.test.tsx.

## Ownership (yalnız bunlara yaz)
- src/components/shared/ResponsiveResults.tsx, src/components/shared/ListSelectAll.tsx, src/hooks/useListSelection.ts (+ testleri, yeni)
- src/components/visitors/VisitorTable.tsx, src/components/access-control/CardReadingsTable.tsx, src/components/leaves/LeaveList.tsx
- src/components/pdks/dashboard/PDKSTableView.tsx, src/components/pdks/records/usePdksRecordsView.ts
- src/components/admin/components/UserTable.tsx, src/components/admin/projects/ProjectsTable.tsx, src/components/admin/AdminDevicesPanel.tsx
- src/components/devices/DeviceList.tsx, src/hooks/useDeviceTable.tsx
- src/components/employees/table/EmployeeSelectAll.tsx, src/hooks/useEmployeeTable.ts
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapsam dışı
ShiftCalendarPlan (shifts), tablo sütun şemaları, PaginationBar, BulkBar içerikleri.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/hooks src/components/visitors src/components/access-control src/components/leaves src/components/pdks src/components/admin src/components/devices src/components/employees`
- `node_modules/.bin/vitest run src/components/shared src/hooks src/components/visitors src/components/access-control src/components/leaves src/components/pdks src/components/admin src/components/devices src/components/employees src/pages`
