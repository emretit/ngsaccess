# DENETİM — Faz 1-A (X-02 düzeltme talebi paneli, R-03 silinen kişinin bekleyen talepleri)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f1-a-talep.md`. Worker raporu: `/tmp/fix-f1-a-talep-rapor.md`.
Rapor: `/tmp/fix-f1-a-denetim.md`. Dosyalar: src/components/pdks/CorrectionRequestsPanel.tsx src/components/pdks/CorrectionRequestsPanel.test.tsx src/pages/PDKSRecords.tsx
src/components/pdks/auditPage.test.tsx convex/lib/employeeCascade.ts convex/fixF1Requests.test.ts
NOT: Ağaçta başka bir oturumun vardiya/PDKS WIP'i var (shiftResolver, pdks*, src/components/pdks/{dashboard,lib,records/recordsView.ts}); onlardan gelen tsc hataları kapsam dışı —
ama `convex/fixF1Requests.test.ts` tsc'de hata veriyorsa bu BİZİM hatamız, belirt. Özel dikkat: panelin yetki anahtarı backend `listPending/approve/reject` ile aynı mı; onay sonrası
pdksRecords yazımı ve hata gösterimi; cascade'de sınırlı okuma ve leaves silmenin yalnız source=employee+pending'e dokunması; employees.remove zinciri (F0-A'nın removeEmployeeRecord'u) bu cascade'i çağırıyor mu.
