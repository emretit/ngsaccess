# R-A1 — Çıkış yarışı düzeltmesinin salt-okuma denetimi (yazan Claude → denetleyen Codex)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/review-1019-a1.md`
Diff: `/tmp/ceo-audit/a1.diff` (ana ağaçta commit'siz 4 dosya: src/components/auth/{AuthProvider.tsx,registrationFlow.ts,registrationFlow.test.ts}, src/components/employees/EmployeeDetails.tsx).
Bağlam: commit 1a0c112 AuthProvider'a "silinmiş oturum" dalı ekledi (isAuthenticated && currentUser===null → convexSignOut + "Oturumunuz sona erdi" + /login?next).
Bulgu (`.claude/orca-specs/reports/audit-1019-auth.md` #1/#2): kullanıcı "Çıkış yap" dediğinde auth:signOut action'ı sunucuda oturumu siler, currentUser null döner, istemci token'ı henüz silinmemiştir → orphan dalı da tetiklenir. verified=false blok dalında da aynı çift tetik.
Düzeltme: `signingOutRef` (signOut() ve blok dalı set eder; hata ya da !isAuthenticated sıfırlar) → `shouldSignOutOrphanedSession({..., signingOut})` false döner. Ayrıca EmployeeDetails'te rıza kartı sınırına `key={employee._id}`.
Sorular:
1. Düzeltme yarışı gerçekten kapatıyor mu? Ref'in true KALDIĞI ve gerçek silinmiş oturumu (başka cihazdan silinen) maskelediği bir akış var mı (ör. signOut başarılı ama isAuthenticated hiç false olmuyor; yeniden giriş; sekmeler arası)?
2. Effect bağımlılık listesi: ref değişimi effect'i tetiklemez — signingOut true iken atlanan orphan kontrolü, gerçekten gerekirse sonradan yeniden değerlendiriliyor mu?
3. `key={employee._id}` başka bir şeyi bozar mı (gereksiz remount, hata sınırı durumu)?
4. Testler: `node_modules/.bin/vitest run src/components/auth src/components/employees` + `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` (salt-okuma).
Rapor ≤40 satır: bulgular (Önem · dosya:satır · senaryo · öneri) + "Yayına engel: VAR/YOK".
