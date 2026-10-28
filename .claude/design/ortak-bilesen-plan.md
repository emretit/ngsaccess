# Ortak bileşen planı (2026-10-27)

Kaynak raporlar: [ortak-bilesen-A.md](ortak-bilesen-A.md) (liste/tablo, A1-A10) · [ortak-bilesen-B.md](ortak-bilesen-B.md) (form/dialog, B01-B12).
Önceki adım: `PageHeaderPrimaryButton` (PageHeader.tsx + DeviceAddMenu.tsx + test) — commit'siz, CEO'da.

## Dalga 1 — davranış hatası düzelten — BİTTİ 2026-10-27 (commit yok; tsc 0, vitest 4910/4910)
- [x] B01 useAsyncAction: LeaveRequestsPanel hata olunca da dialog'u kapatıyor (CorrectionRequestsPanel açık tutuyor) + 4 dosya daha
- [x] B08 ConfirmDestructive: PDKSSavedViews silme sonucu beklenmeden kapanıyor; MailSettings kaldırmada pending yok; pdksRules delete dalı

## Dalga 2 — var olan ortak bileşeni kullan — BİTTİ 2026-10-27 09:41 (commit yok; tsc 0, vitest 4922/4922, Orca turu OK)
- [x] A6 StatusBadge: 5 dosya (DoorPlansTab, TemplatesPage, StatusViews, Alarms, LiveFeed)
- [x] A7 EmptyState + A9 SectionSkeleton: 8 yer
- [x] B02 FormActions → shared'a taşı + 8 elle yazılmış footer
- [x] B03 FormFieldWrapper: 5 dosya
- [x] A2 MasterDetailListLayout: Kişiler/Cihazlar/PDKS (Kişiler mobil gap-6, diğerleri gap-4)

## Dalga 3 — yeni küçük bileşenler — BİTTİ 2026-10-27 10:25 (commit yok; tsc 0, vitest 4941/4941, Orca turu OK)
- [x] A5 SegmentedViewControl (5 yer, iki farklı variant çifti)
- [x] A4 CollapsibleFilters (4 yer, 3 farklı breakpoint)
- [x] A8 FilterBar opsiyonel arama (4 yer)
- [x] B06 DetailFieldList (5 yer) · B07 FormFeedback (6 yer) · A10 LoadMoreFooter (4 yer)

## Dalga 4 — büyük kabuklar — BİTTİ 2026-10-27 commit b35efe4c (tsc 0, vitest 434/4983, Orca turu OK)
- [x] A1 ResponsiveResults — md (768px)
- [x] A3 useListSelection · B04 FormDialog · B05 DetailSheet · B09 useGuardedFormNavigation
- [x] B10 ConfirmAction · B12 SettingsSection — [x] B11 DateRangeFields + shifts içi yerler (CalendarNavigation, ShiftCalendarPlan seçim; filtre satırı bilinçli dışarıda) · [x] LeaveForm guard (`release()`) — 08c7784f
