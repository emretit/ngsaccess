# W2 düzeltme turu 1 (denetim docs/ui-audit-ziyaretci/review.md)
Ortak kurallar aynen geçerli (.claude/orca-specs/ziy-ortak.md). Ownership: önceki W2 dosyaların.
1. R-4: `convex/visitors.ts:265` özet taramasında `maximumBytesRead` 2000 kayda yetecek şekilde 2 MB olsun (2 * 1024 * 1024). Taşma testi yeşil kalsın.
Kapılar: tsc convex, eslint convex/visitors.ts, `node_modules/.bin/vitest run convex/visitorsAudit2.test.ts src/components/visitors`. worker_done ≤3 satır.
