# R-B3 — Orphan erişim kapıları denetimi (yazan Codex → denetleyen Claude; salt-okuma)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/review-fazb-b3.md`
Girdi: diff `/tmp/ceo-audit/b3.diff` (6 üretim dosyası) + yeni `convex/orphanGuards.test.ts` · spec `.claude/orca-specs/fazb-b3-orphan.md` · worker raporu `.claude/orca-specs/reports/fazb-b3-orphan.md` · harita `.claude/orca-specs/reports/audit-1019-risk.md` §2.
Kural: projectId'siz kaynakta işlem yalnız super_admin; projeli kaynakta mevcut kapsam aynen; kontrol tüm DB/scheduler etkisinden ÖNCE.
Canlı veri (worker sayımı): accessRules 2 satır / 1 projesiz; departments 3, shifts 1, shiftAssignments 1, groupMembers 6, groupDevices 1 — hepsi projeli.
Diff'i ve çağrıldığı kodu kendin oku. Sorular:
1. **Regresyon (EN ÖNEMLİ):** Meşru bir yönetici/kullanıcı işlemi artık reddediliyor mu? Özellikle `accessRules.remove` artık TÜM üye/cihaz/kapı bağlarının erişimini doğruluyor — tek bir tutarsız bağ (başka projede çalışan, silinmiş cihaz, projesiz kapı) kuralın silinmesini tamamen engelliyor mu? Bu kabul edilebilir mi yoksa yalnız kural projesine bakmak yeter mi?
   `leaves.approve/reject`: projeli izin + projesiz eski çalışan, ya da izin projesiz (eski veri) senaryoları; `getBalances` boş dönerken UI kırılıyor mu?
2. Açık kaldı mı: aynı fonksiyonlarda kontrolü atlayan dal, `undefined` projectId ile `isProjectAllowed` davranışı, super_admin istisnasının yanlışlıkla project_admin'e açılması.
3. Kontroller gerçekten yan etkiden önce mi (özellikle accessRules sync/scheduler çağrıları ve shifts.removeAssignment)?
4. Testler gerçek handler'ı mı sınıyor; mock'lar yetki kontrolünü atlıyor mu?
5. Koş (salt-okuma): `node_modules/.bin/vitest run convex/orphanGuards.test.ts convex/lib/shiftAssign.test.ts convex/lib/leaveValidation.test.ts` + `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`.
   (Ağaçta B1 ücret işi de commit'siz: employees/visitors/cardReadings/reports — kapsam dışı.)
Rapor ≤60 satır: bulgular tablosu (Önem · dosya:satır · senaryo · öneri) + "Yayına engel: VAR/YOK".
