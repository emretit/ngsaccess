# C3-ui: Ertelenen küçük UI/hata düzeltmeleri (Kişiler, Cihazlar, Vardiyalar, Canlı İzleme, İzinler, Denetim)
ÖNCE `.claude/orca-specs/c3-common.md` oku.

## Yapılacaklar (her biri ayrı test edilebilir)
1. **Proje değişimi koruması taşıması:** `src/components/employees/SlideOverPanel.tsx:30-59` ve `src/components/devices/DeviceDetailsPanel.tsx:20-54`
   eski "projeyi geri al + sor" kalıbını kullanıyor (`setActiveProjectId(previous)`). İkisini `useProjectChangeGuard(dirty || pending, pending ? () => {} : guard.requestClose)`
   kalıbına taşı (`src/components/leaves/LeaveForm.tsx` örnek). Onaylanınca proje değişir, Vazgeç'te taslak kalır; proje hiç geri alınmaz.
2. **Vardiya hata kodları:** `convex/shifts.ts:80` `CALENDAR:` ve `:278` `OVERLAP:` düz `Error` → `ConvexError({ code: "SHIFT_CALENDAR_CONFLICT" | "SHIFT_OVERLAP", message, ... })`.
   ESKİ istemci mesaj ön ekine (`OVERLAP:` / `CALENDAR:`) bakıyorsa geriye uyum için `message` aynı ön eki korusun; yeni istemci `code` okusun.
   `src/components/shifts/**` tüketicilerini güncelle (grep `OVERLAP`/`CALENDAR`).
3. **Vardiyalar görsel (C2b notu):** başlıktaki 'Çalışan ara' etiketi sayaçların altında yüzüyor → FilterBar düzeni; masaüstünde gereksiz
   'takvimi yatay kaydırın' metni yalnız taşma olduğunda/mobilde görünsün.
4. **Canlı İzleme:** Canlı/Geçmiş seçili durumu görsel olarak ayırt edilmiyor → seçili sekmede A2 seçili stili + `aria-selected`/`aria-pressed`.
5. **İzinler formu:** 'Kişi' + 'Kişi ara' çift etiket (`src/components/leaves/LeaveForm.tsx` / `EmployeePicker.tsx`) → tek görünür etiket,
   arama alanı `aria-label` ile.
6. **Denetim:** `src/components/audit/useAuditUrlState.ts:8` modül düzeyi mutable `lastAuditScope` → sayfa ömrüne bağlı (ref/context) ya da
   sessionStorage; derin bağlantıdaki `user` filtresi eski ziyaretin scope'u yüzünden silinmesin (test).
7. **Düşük:** `DeviceListErrorBoundary` retry tam sayfa reload yerine bölüm yeniden kurulumu; `MoveReaderDialog` hedef kapasiteyi istemcide de
   gösterip dolu hedefi seçilemez yapsın (sunucu kontrolü zaten var).

## Ownership
`src/components/employees/SlideOverPanel.tsx` · `src/components/devices/**` · `convex/shifts.ts` (yalnız hata atımları) · `convex/lib/shiftAssign.ts` (+test, gerekirse) ·
`src/components/shifts/**` · `src/pages/Shifts.tsx` · `src/pages/LiveMonitoring.tsx` · `src/components/live-monitoring/**` ·
`src/components/access-control/CardReadings*.tsx` (yalnız Canlı/Geçmiş geçişi oradaysa) · `src/components/leaves/LeaveForm.tsx` · `src/components/leaves/EmployeePicker.tsx` ·
`src/components/audit/useAuditUrlState.ts` (+ `auditState*.ts`).

## Kapsam dışı
`src/hooks/useDevices.ts` (sweep worker'ında) · access-control/unified ve hooks/access-rules (rules worker'ında) · yeni özellik.

## Rapor
`.claude/orca-specs/reports/c3-ui.md` + koordinatör akışları (Kişi/Cihaz panelinde taslakla proje değiştir → sor; vardiya çakışma mesajı; Canlı/Geçmiş seçili görünüm; 390px).
