# DENETİM — Faz 0-A (K-01, K-02 engel, K-03, K-06)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f0-a-kisi.md`.
Worker raporu: `/tmp/fix-f0-a-kisi-rapor.md`. Rapor: `/tmp/fix-f0-a-denetim.md`.
Dosyalar: convex/employees.ts convex/visitors.ts convex/employeeImport.ts convex/fixF0People.test.ts convex/hikRevocation.test.ts
convex/payVisibility.handlers.test.ts src/components/employees/EmployeeFormFields.tsx src/components/employees/EmployeeFormFields.test.tsx
src/components/visitors/VisitorSlideOverPanel.tsx src/components/visitors/visitorAudit.test.tsx
Özel dikkat: removeEmployeeRecord çıkarımı davranışı birebir korudu mu (Hik snapshot, IDE silme, cascade, audit sırası); kural üyeliğine giden
başka yol (import, toplu departman, accessRules uçları) kaldı mı; ziyaretçi getById maskesi visitors.getDetail ile aynı mı; mevcut testlerdeki
beklenti değişikliklerinin (hikRevocation, payVisibility) gerekçesi geçerli mi, bir açığı gizliyor mu.
