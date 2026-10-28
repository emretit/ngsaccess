# Dropdown fix — W2 (Kişi/İzin + Vardiya + PDKS + Rapor tüketicileri)
Hedef: aşağıdaki bulgular kapanır; tsc 0, eslint 0 error, ilgili vitest yeşil.
Kaynak rapor: docs/ui-audit-dropdowns/W2-kisi-pdks-ayar.md
Ownership (yalnız bunlar + *.test.tsx eşleri):
- src/components/shifts/ShiftSelect.tsx
- src/components/employees/EmployeeBulkActions.tsx
- src/components/leaves/EmployeePicker.tsx
- src/components/pdks/dashboard/PDKSSavedViews.tsx
- src/components/pdks/dashboard/PDKSFilterBar.tsx
- src/components/pdks/dashboard/PDKSDateNavigator.tsx
- src/components/pdks/chat/AiChatMessage.tsx
- src/components/shifts/calendar/CalendarNavigation.tsx
- src/components/reports/ReportScreen.tsx
Bulgular:
- #1 ShiftSelect yüksekliği: GEREK YOK (min-h-11 mobil dokunma hedefi UI audit 2'de bilinçli eklendi, a3b60391). Dokunma.
- #2 ShiftSelect: options boşken "__empty" disabled öğe; metni opsiyonel `emptyLabel` prop'u ile (varsayılan "Kayıt yok"); DepartmentTargetPicker/DayShiftsPicker'a dokunmadan varsayılan yeterli. EmployeeBulkActions departman Select'i: departments boşsa "__empty" "Departman bulunamadı".
- #3 + #4 EmployeePicker: Button + `⌄` glifi → `ComboboxTrigger` ({...control} ve aria-controls korunur; placeholder={!value}); PopoverContent → `COMBOBOX_CONTENT_CLASS` (align="start" kalsın). Seçili CommandItem'a ortak Check + sr-only "Seçili" (aria-selected prop'unu kaldır, cmdk kendi yönetiyor).
- #5 PDKSSavedViews max-height: GEREK YOK (primitive yaptı) — yalnız doğrula.
- #6 PDKSSavedViews uzun ad: menü öğesinde ad `min-w-0 truncate` span + `title={v.name}`; kayıt adı Input'una `maxLength={60}`.
- #7 PDKSFilterBar: departments/companies/positions === undefined iken "Tümü" öğesine ek "__loading" disabled "… yükleniyor"; ReportScreen departman Select'inde de yükleme durumu görünür olsun (placeholder işe yaramıyor çünkü value "all" — "__loading" disabled öğe ekle).
- #8 PDKSFilterBar: seçili departmentId/companyId/positionId liste yüklendiği halde listede yoksa ortak fallback `<SelectItem value={id}>Kaldırılmış kayıt</SelectItem>`.
- #9 AiChatMessage Debug Bilgisi tetikleyicisi: `h-7` → standart `size="sm"` (h-9); başka görünüm değişikliği yok.
- #10 PDKSDateNavigator + CalendarNavigation özel DatePicker tetikleyicileri: etiketin yanına `CalendarIcon` (lucide, `h-4 w-4 opacity-50`, aria-hidden) ekle.
Vitest alanı: `node_modules/.bin/vitest run src/components/shifts src/components/employees src/components/leaves src/components/pdks src/components/reports`
