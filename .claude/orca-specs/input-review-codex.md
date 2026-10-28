# Denetim — koordinatör diff (primitive + ring payı)
Dosyalar (Claude koordinatör yazdı, sen denetle):
src/components/ui/input.tsx
src/components/ui/textarea.tsx
src/components/ui/select.tsx
src/components/ui/button.tsx
src/components/ui/date-picker.tsx
src/components/ui/command.tsx
src/components/ui/native-select.tsx (yeni)
src/components/shared/FormDialog.tsx (+ .test.tsx)
src/pages/Settings.tsx
src/components/live-monitoring/ReadingDetailPanel.tsx
src/components/departments/MoveDepartmentDialog.tsx
Ek kontrol: FormDialog `-m-1 p-1`, Settings `-mx-1 p-1`, ReadingDetailPanel `-mx-1 px-1 pb-1` focus ring (ring-2 = 2px) kırpılmasını gerçekten önler mi, yerleşimi bozar mı; SelectTrigger `focus:` → `focus-visible:` geçişi Radix Select ile sorun çıkarır mı; tailwind-merge (cn) date-picker TRIGGER_CLASS ile buttonVariants çakışmalarını doğru çözer mi; textarea bg-background → bg-surface ve text-base md:text-sm değişikliği bir yerde görünümü bozar mı (className ile ezilen yerler).
