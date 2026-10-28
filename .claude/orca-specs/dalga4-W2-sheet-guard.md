# Dalga 4 / W2 — DetailSheet + useGuardedFormNavigation (K3)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga4-ortak.md
Rapor bölümleri: ortak-bilesen-B.md §B05 (DetailSheet), §B09 (useGuardedFormNavigation).

## Hedef (test edilebilir)
1. Yeni `src/components/shared/DetailSheet.tsx`:
   `{ open; onRequestClose; title: ReactNode; description: ReactNode; size?: "md" | "lg" | "wide"; pending?: boolean; headerExtra?: ReactNode;
   children; footer?: ReactNode; returnFocus?: RefObject<HTMLElement | null>; scroll?: "body" | "all" }`.
   Sheet + SheetHeader/Title/Description + gövde + opsiyonel footer; pending iken Escape/dış tıklama kapatmaz; returnFocus verilirse kapanışta oraya odak.
   Bilinçli birleştirme: başlık dolgusu tek (`px-5 py-3`), genişlikler adlandırılmış boyutlara eşlenir (bugünkü genişlikleri koruyacak şekilde seç).
   Uygula: employees/SlideOverPanel.tsx (~91), devices/DeviceDetailsPanel.tsx (~156), visitors/VisitorSlideOverPanel.tsx (~31), leaves/LeaveDetails.tsx (~37),
   audit/AuditDetailPanel.tsx (~9), pdks/dashboard/PDKSEmployeeDetailDrawer.tsx (~78). Sekmeler/sorgu/yetki içerikte kalır; form taslaklarının
   mount/unmount davranışı DEĞİŞMEZ.
2. Yeni `src/hooks/useGuardedFormNavigation.ts`: `{ active?: boolean; dirty: boolean; pending: boolean } → { requestClose(proceed): void; dialog: ReactNode }`.
   Mevcut UnsavedChangesDialog + beforeunload + browser-back + proje değişikliği korumasını tek yerde toplar.
   Uygula: admin/hooks/useAdminFormGuard.tsx (~13), settings/useSettingsFormsGuard.ts (~20; çoklu form toplama görevi kalır, yalnız koruma katmanı devredilir),
   employees/SlideOverPanel.tsx (~70), devices/DeviceDetailsPanel.tsx (~119), leaves/LeaveForm.tsx (~143).
   Her tüketicide bugünkü davranış tablosunu çıkar (kirli+kapat, kirli+geri, kirli+proje değiştir, pending sırasında kapat) ve birebir koru.
   Bir tüketici temiz oturmuyorsa geçirme, raporla.
3. Testler: DetailSheet.test.tsx, useGuardedFormNavigation.test.ts (saf karar mantığını export edip test et).

## Ownership (yalnız bunlara yaz)
- src/components/shared/DetailSheet.tsx, src/hooks/useGuardedFormNavigation.ts (+ testleri, yeni)
- src/components/employees/SlideOverPanel.tsx, src/components/devices/DeviceDetailsPanel.tsx, src/components/visitors/VisitorSlideOverPanel.tsx
- src/components/leaves/LeaveDetails.tsx, src/components/audit/AuditDetailPanel.tsx, src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx
- src/components/admin/hooks/useAdminFormGuard.tsx, src/components/settings/useSettingsFormsGuard.ts, src/components/leaves/LeaveForm.tsx
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapsam dışı
FormDialog (W3), UnsavedChangesDialog'un kendisi (değiştirme, kullan), sekme içerikleri, LeaveForm'un alanları/footer'ı.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/hooks src/components/employees src/components/devices src/components/visitors src/components/leaves src/components/audit src/components/pdks/dashboard src/components/admin/hooks src/components/settings`
- `node_modules/.bin/vitest run src/components/shared src/hooks src/components/employees src/components/devices src/components/visitors src/components/leaves src/components/audit src/components/pdks src/components/admin src/components/settings src/pages`
