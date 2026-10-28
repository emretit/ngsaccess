# Backend B5 — dashboard.ts zaman çizelgesi

Hedef: `convex/dashboard.ts` içindeki `getTodayTimeline` (~252 satır) gövdesi lib'e taşınır; registered sorgu ince sarmalayıcı kalır; ana sayfa çıktısı birebir.

Ownership:
- convex/dashboard.ts (yalnız getTodayTimeline gövdesi + import satırları)
- YENİ: convex/lib/dashboardTimelineQuery.ts (ctx bağımlı toplama) — mevcut convex/lib/dashboardTimeline.ts saf modülünü DEĞİŞTİRME, yalnız import et; isteğe bağlı yeni test
- DOKUNMA: dashboard.ts'teki diğer handler'lar (getStats vb.)

Dikkat: okuma sayısı/sırası ve index kullanımı aynı (Convex kota geçmişi var); proje kapsamı (allowedProjectIds) kontrolü aynı sırada.

Vitest: `node_modules/.bin/vitest run convex/lib/dashboard convex/dashboard`
Rapor yolu: /tmp/backend-b5-rapor.md
