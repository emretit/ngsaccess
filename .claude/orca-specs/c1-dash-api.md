# C1 W-dash-api — Ana Sayfa sorgusunun ölçeklenmesi (backend)
Önce `.claude/orca-specs/c1-common.md` ve `convex/_generated/ai/guidelines.md` oku. Bağlam: `docs/ui-scan/pages/01-ana-sayfa/REPORT.md`
"Backend gereksinimi" (HOME-UI-12).

## Hedef (test edilebilir)
`dashboard.getStats` bugünkü okumaları `cardReadings.by_project_access_time` (proje) / `by_access_time` (super_admin tüm projeler) index
ARALIĞIYLA okur — tam proje taraması + `.filter` kalmaz; çalışan/cihaz/kural sayımları index'li ve sınırlı; dönüş tipi ve değerleri
aynı kalır (frontend sözleşmesi değişmez).

## İş
1. `convex/dashboard.ts` `getStats`: `.withIndex("by_project_access_time", q => q.eq("projectId", pid).gte("accessTime", todayISO).lte("accessTime", todayEndISO))`;
   super_admin dalında `by_access_time` aralığı. Aktif cihaz için `devices` uygun index'i varsa kullan (yoksa `ask`, schema koordinatörde).
   `accessRules` pasif sayımı için `by_project_active` index'i (yeni deploy edildi). Sayım için tüm belgeyi tutmak yerine yalnız sayı tut.
2. Aynı dosyadaki diğer sorgularda (aktivite özeti vb.) PDKS ortak dataset yükleyicisine DOKUNMA (PDKS regresyon riski); yalnız
   getStats ve aynı desende tam tarama + filter yapan küçük okuma varsa onu da aralığa çevir, raporda listele.
3. Rastgele `take()` ile toplamı kesme (doğruluk bozulur). Çok büyük tablolar için gelecekteki aggregate ihtiyacını raporda not et.
4. Saf yardımcı çıkarırsan vitest yaz; mevcut testler yeşil kalır. Dönüş tipini `FunctionReturnType<typeof api.dashboard.getStats>` ile
   tüketen frontend (src/hooks/useDashboard.ts — W-shell'in) etkilenmemeli: tip değişirse DUR, `ask`.

## Ownership
convex/dashboard.ts · convex/lib/dashboard*.ts (yeni/mevcut yardımcı + test)

## Kapsam dışı
Frontend (W-shell) · schema.ts · cardReadings.ts · PDKS yükleyicileri · aggregate bileşeni kurulumu.
