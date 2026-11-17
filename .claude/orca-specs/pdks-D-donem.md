# PDKS Faz D — bordro dönem kapatma

## Hedef
Proje yöneticisi bir ayı kapatınca o ayın bordro/puantaj sonuçları sabitlenir; sonradan gelen okutma/düzeltme kapalı ayı değiştirmez, "Fark incelemesi" listesine düşer; yalnız super_admin dönemi yeniden açar.

## İstenen
1. Şema (yalnız genişletme, convex/_generated/ai/guidelines.md OKU): payrollPeriods { projectId, period "YYYY-MM", status "closed"|"reopened", closedAt, closedBy, reopenedAt?, reopenedBy? } + payrollPeriodRows { periodId, employeeId, hesaplanmış bordro alanları } + gerekli index'ler. 1 MB doküman sınırı nedeniyle satırlar ayrı tabloda.
2. closePayrollPeriod: proje admin yetkisi; ayın bordrosunu ortak motorla hesaplar, satırları yazar; büyük projede batch/scheduler. reopenPayrollPeriod: yalnız super_admin (requireSuperAdmin, convex/lib/auth.ts:87). İkisi de audit log'a yazar (convex/lib/audit.ts).
3. Okuma: convex/lib/pdksPayrollQuery.ts kapalı ay için snapshot'tan döner + "kapalı" bayrağı. listPayrollPeriodDiffs query: canlı hesap ile snapshot farkı, çalışan bazında (eski/yeni gün ve dakika).
4. Kapalı aya manuel PDKS düzeltmesi (convex/lib/pdksManualWrite.ts) "dönem kapalı" hatasıyla reddedilir.
5. UI: PDKS aylık/bordro görünümünde "Dönemi kapat" (admin), "Yeniden aç" (yalnız super_admin), kapalı rozeti, "Fark incelemesi" listesi. Mevcut kalıplar: FilterBar, Table framed, TableStateRow.

## Ownership
convex/schema.ts (yalnız yeni tablolar), yeni convex/payrollPeriods.ts (+ test), convex/lib/pdksPayrollQuery.ts, convex/lib/pdksManualWrite.ts, src/components/pdks/** içindeki bordro/aylık görünüm dosyaları + yeni bileşenler, ilgili testler.
Kapsam dışı: convex/lib/pdksDay.ts (Faz A), convex/dashboard.ts (Faz B), convex/dataMigrations.ts (Faz C).

## Zorunlu test
- kapat → sonradan okutma eklenir → bordro değişmez, fark listesinde görünür
- admin yeniden açamaz, super_admin açar
- kapalı aya manuel düzeltme reddedilir
- audit kaydı yazılır

Ortak kurallar: .claude/orca-specs/pdks-ortak-kurallar.md dosyasını OKU ve uygula.
