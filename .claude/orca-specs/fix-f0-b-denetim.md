# DENETİM — Faz 0-B (X-01, Y-02, P-02, R-01)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f0-b-yankapi.md`.
Worker raporu: `/tmp/fix-f0-b-yankapi-rapor.md`. Rapor: `/tmp/fix-f0-b-denetim.md`.
Dosyalar: convex/actions/sendEmail.ts convex/employeeAuth.ts src/components/employees/EmployeePasswordResetDialog.tsx
src/components/employees/hooks/useEmployeeFormSubmit.ts convex/privacyRetention.ts convex/files.ts convex/leaves.ts
src/components/shifts/calendar/useShiftCalendarData.ts convex/lib/reportScope.ts convex/fixF0SideDoors.test.ts convex/lib/leaveValidation.test.ts
Özel dikkat: X-01'de token'ın gerçekten yalnız kayıttaki e-postaya gidip gitmediği; employeeAuth'a yazan başka public yol kaldı mı;
setEmployeePassword/consumeSetupToken zinciri; rate limit'in yarış durumu. useEmployeeFormSubmit.ts'te F0-A worker'ı başka satırlara dokunmuş olabilir — yalnız sendSetupEmail kısmını denetle.
