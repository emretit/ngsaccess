# Dalga 3 / W1 — CollapsibleFilters + FilterBar opsiyonel arama (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga3-ortak.md
Rapor bölümleri: ortak-bilesen-A.md §4 (CollapsibleFilters), §8 (FilterBar).

## Hedef (test edilebilir)
1. Yeni `src/components/shared/CollapsibleFilters.tsx`: mobilde "Filtreler" düğmesi (aria-expanded + aria-controls, useId) ile aç/kapa,
   masaüstünde içerik hep görünür. Props: `{ label?: string; activeCount?: number; forceOpen?: boolean; children: ReactNode;
   desktopDisplay?: "block" | "contents" }`. activeCount > 0 ise düğmede sayı gösterilir.
   Bilinçli birleştirme: kırılım noktası tek — Tailwind `md` (768px). Bugün PDKS/rapor `sm`, audit `md`, izin useIsMobile (768) kullanıyor.
   Uygula: PDKSFilterBar.tsx (~50/56), AuditFilters.tsx (~35/39; hata varken açık kalma = forceOpen; masaüstü `contents` davranışı korunur),
   LeaveFilters.tsx (~37/47; useIsMobile bağımlılığı kalkar), ReportScreen.tsx (~31/63).
2. `src/components/shared/FilterBar.tsx` geriye uyumlu genişlet: arama opsiyonel olsun — `search` + `onSearchChange` ikisi birlikte verilir
   ya da ikisi de verilmez (discriminated union ile tiple; mevcut 13 tüketici değişmeden derlenmeli). Arama yoksa input render edilmez.
   Temizle düğmesi bugünkü gibi `!hasFilters && !search` iken disabled.
   Uygula: ReportScreen.tsx DepartmentFilters (~26), LeaveFilters.tsx (~48, temizleme ~83), StatusFilters.tsx (~62, arama ~118).
   Bir yerde grid düzeni şartsa `layout?: "wrap" | "grid"` ekleyebilirsin (varsayılan "wrap" = bugünkü).
3. Testler: CollapsibleFilters.test.tsx (aria-controls eşleşmesi, activeCount, forceOpen), FilterBar.test.tsx (aramasız mod, mevcut mod değişmedi).

## Ownership (yalnız bunlara yaz)
- src/components/shared/CollapsibleFilters.tsx (+ test, yeni)
- src/components/shared/FilterBar.tsx (+ FilterBar.test.tsx, yoksa yeni)
- src/components/pdks/dashboard/PDKSFilterBar.tsx (+ PDKSFilterBar.test.tsx)
- src/components/audit/AuditFilters.tsx
- src/components/leaves/LeaveFilters.tsx
- src/components/reports/ReportScreen.tsx
- src/components/access-control/unified/status/StatusFilters.tsx
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapsam dışı
ShiftCalendarPlan (shifts), filtre alanlarının kendisi (select/date içerikleri), filtre state/URL yönetimi.

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/shared src/components/pdks/dashboard src/components/audit src/components/leaves src/components/reports src/components/access-control/unified/status`
- `node_modules/.bin/vitest run src/components/shared src/components/pdks src/components/audit src/components/leaves src/components/reports src/components/access-control src/pages`
