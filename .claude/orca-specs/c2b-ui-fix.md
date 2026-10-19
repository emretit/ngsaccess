# C2b W-ui-fix — frontend denetim bulgularının düzeltmesi
Önce `.claude/orca-specs/c2b-common.md` (→ c2-common.md) oku. Denetim (Claude) bulguları aşağıda; dar ve davranış korumalı düzelt.

## Düzeltilecekler
1. **YÜKSEK — ziyaretçi ayrıntısı/form veri kaybı:** `src/components/visitors/VisitorSlideOverPanel.tsx:46` `getDetail({visitorId, refreshKey})`;
   `refreshKey` dakikada bir değişiyor (`VisitorManagement.tsx:30`). Ham `useQuery` arg değişince `undefined` döner → iskelet → düzenleme
   formu unmount, girilen veri kaybolur. Çözüm: arg değişiminde son veriyi koru (ör. önceki sonucu ref'te tut ve yeni sonuç gelene kadar onu
   göster; edit modunda refreshKey'i dondur). Aynı "dakikada iskelet yanıp sönme" liste (`VisitorTable`/liste ~66) ve `VisitorStats`'ta da var —
   aynı "son veriyi koru" yardımcısıyla düzelt (ortak küçük hook: `src/components/visitors/hooks/useStableQuery.ts` gibi). Test ekle.
2. **ORTA — `src/components/settings/SettingsTabs.tsx:20`** `<Link>` TabsList içinde → tablist semantiği/klavye bozuk. Link'i TabsList dışına
   (ör. altında kısa açıklama satırı: "Vardiya tanımları artık Vardiyalar sayfasında" + bağlantı) taşı.
3. **ORTA — `src/components/shifts/ShiftCalendarView.tsx:336`** `window.location.href='/employees'` → `useNavigate()`.
4. **ORTA — `src/components/shifts/BulkAssignShiftDialog.tsx`** ölü re-export, tüketicisi yok → grep ile doğrula ve sil.
5. **DÜŞÜK — `src/components/access-control/unified/SyncRuns.tsx`** "Ayrıntı" düğmesine bağlamlı `aria-label` (ör. "<tarih> gönderiminin ayrıntısı").

## Ownership
src/components/visitors/** · src/components/settings/SettingsTabs.tsx · src/components/shifts/ShiftCalendarView.tsx ·
src/components/shifts/BulkAssignShiftDialog.tsx (silme) · src/components/access-control/unified/SyncRuns.tsx

## Kapsam dışı
convex/** · diğer sayfalar · ui|shared|layout. `convex/shifts.ts` OVERLAP/CALENDAR hata kodu değişmez (eski frontend uyumu; deployment dev modunda mesaj redakte edilmiyor).

## Kapı + rapor
app tsc 0 · convex tsc 0 · `node_modules/.bin/eslint src convex` 0 · `npx vitest run` yeşil · `npx vite build`. worker_done ≤8 satır + `.claude/orca-specs/reports/c2b-ui-fix.md`.
commit/push/deploy/DB YOK, npx convex KOŞMA.
