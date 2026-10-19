# B2 — KVKK rıza alma/iptali yalnız yöneticide (Emre kararı)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/fazb-b2-consent.md`
Önce oku: `.claude/orca-specs/reports/audit-1019-risk.md` §3 ve `audit-1019-dash-kvkk.md` B bölümü.

Hedef (test edilebilir): `project_user` rıza ALAMAZ ve İPTAL EDEMEZ (doğrudan API çağrısı dahil); rızaları LİSTELEYEBİLİR (salt-okuma kart). Yöneticilerde davranış aynı.
1. `convex/employeeConsents.ts` `grant` ve `revoke`: `authedMutation` → `adminMutation` (`convex/lib/customFunctions.ts:61`). Mevcut `requireEmployeeAccess` (proje kapsamı + orphan yalnız super_admin) ve biyometri modül kapısı (`assertBiometricAllowed`) AYNEN kalır. `listForEmployee` ve diğer okumalar değişmez.
2. `src/components/employees/EmployeeConsentsCard.tsx`: yönetici değilse "Rıza Al" ve "İptal" butonları + grant/revoke diyalog/onay akışları RENDER EDİLMEZ (rol: mevcut auth hook'u + `capabilities(role).admin`, `src/lib/capabilities.ts`). Kart başlığı + rıza listesi project_user'a görünmeye devam eder.
Ownership: `convex/employeeConsents.ts`, `src/components/employees/EmployeeConsentsCard.tsx`, `src/components/employees/EmployeeConsentsCard.test.tsx`, YENİ `convex/employeeConsents.test.ts` (yoksa).
Kapsam DIŞI: `src/components/employees/EmployeeDetails.tsx` (başka değişiklik bekliyor), `convex/lib/auth.ts`, biyometri/imha dosyaları.
Testler: backend — project_user grant/revoke reddedilir ve hiçbir insert/patch/audit yapılmaz; project_admin kendi projesinde izinli, başka projede/orphan çalışanda red; modül kapalıyken biyometrik grant red, revoke yöneticide izinli
(yetki sarmalayıcısını gerçekten sınayan bir kalıp seç: `convex/syncIssuesAuth.test.ts` convex-test kalıbı ya da eşdeğeri). UI — project_user'da butonlar yok, liste var; admin'de butonlar var.
