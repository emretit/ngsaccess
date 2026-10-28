# Dalga 2 / W1 — StatusBadge + EmptyState + SectionSkeleton geçişi (K2)

Önce oku ve uy: /Users/emreaydin/ngsaccess/.claude/orca-specs/dalga2-ortak.md
Rapor bölümleri: ortak-bilesen-A.md §6 (StatusBadge), §7 (EmptyState), §9 (SectionSkeleton).

## Hedef (test edilebilir)
1. StatusBadge (src/components/shared/StatusBadge.tsx, tone: success|warning|danger|info|neutral):
   - DoorPlansTab.tsx:~176 çevrimdışı → cihaz listesinde çevrimdışı hangi tone ile gösteriliyorsa o (src/components/devices altında bul, aynısını kullan).
   - TemplatesPage.tsx:~105 arşivli → neutral.
   - StatusViews.tsx:~20 güncel değil → warning.
   - Alarms.tsx:~116 önem: bugünkü text-danger→danger, text-warning→warning, muted→neutral.
   - LiveFeed.tsx:~81 erişim sonucu → CardReadingsTable.tsx:10 hangi eşlemeyi kullanıyorsa aynısı. Dar satıra sığmalı (gerekirse className ile küçült).
   Kategorik rozetler (proje/marka/tip) kapsam dışı.
2. EmptyState (compact gerektiğinde `compact`): EngineeringDepartmentView.tsx:~35, TemplatesPage.tsx:~95, StatusResults.tsx:~88 ve ~138,
   ReadingsTimeline.tsx:~46, LocationTree.tsx:~220. Mevcut metinleri title/description olarak koru. StatusResults'ta cursor (daha fazla kayıt) varken
   metin "yüklenenlerde eşleşme yok" anlamını korumalı. Olmayan filtre-temizleme callback'i uydurma.
3. SectionSkeleton: EngineeringDepartmentView.tsx:~28 (spinner), PDKSAuditTimeline.tsx:~31 (yalın metin), LocationTree.tsx:~218 (yalın metin; rows 2-3).
   label = bugünkü yükleniyor metni.

## Ownership (yalnız bunlara yaz)
- src/components/access-control/door-plans/DoorPlansTab.tsx
- src/components/access-control/unified/templates/TemplatesPage.tsx
- src/components/access-control/unified/status/StatusViews.tsx
- src/components/access-control/unified/status/StatusResults.tsx
- src/pages/Alarms.tsx
- src/components/dashboard/LiveFeed.tsx
- src/components/dashboard/ReadingsTimeline.tsx
- src/components/employees/EngineeringDepartmentView.tsx
- src/components/devices/LocationTree.tsx
- src/components/pdks/dashboard/PDKSAuditTimeline.tsx
- + bu bileşenlerin adını taşıyan test dosyaları

## Kapılar
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`
- `node_modules/.bin/eslint src/components/access-control src/pages/Alarms.tsx src/components/dashboard src/components/employees/EngineeringDepartmentView.tsx src/components/devices/LocationTree.tsx src/components/pdks/dashboard`
- `node_modules/.bin/vitest run src/components/access-control src/pages src/components/dashboard src/components/employees src/components/devices src/components/pdks`
