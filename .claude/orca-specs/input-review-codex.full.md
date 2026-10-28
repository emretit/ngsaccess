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
