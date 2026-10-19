# B3-fix — Orphan kapılarındaki sarkan-bağ ve izin kilidi regresyonları
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/fazb-b3-fix.md`
Önce oku: `.claude/orca-specs/reports/review-fazb-b3.md` (Y1, Y2, O1, D1, D2) ve `.claude/orca-specs/reports/fazb-b3-orphan.md`. B3 değişiklikleri ana ağaçta commit'siz duruyor.
Repro testi: `/tmp/ceo-audit/rb3/dangling.test.ts` (denetçinin; gerçek handler ile 4/4 red) — kalıbını kendi testine taşı.
Hedef (test edilebilir):
1. Y1 `convex/accessRules.ts` `remove`, `removeGroupMember`, `removeGroupDevice`: silinmiş (null) kapı/cihaz → yetki kontrolünden muaf (atla); VAR olan kaydın projesi aynen doğrulanır. Sarkan bağ silmede temizlenir.
2. Y2 aynı fonksiyonlar: çalışan `null` → atla; varsa `canAccessEmployeeProject` (yoksa `requireEmployeeAccess`'in "bulunamadı" hatası super_admin'i de kilitliyor).
3. O1 `convex/leaves.ts` approve/reject (~257, ~282): `employee.projectId !== leave.projectId` eşitliği super_admin'i kilitlemesin; reject yolunda eşitlik şartı kaldırılsın (izin projesine erişim yeterli). project_admin için izin projesi + çalışan erişimi fail-closed kalır.
4. D1 `removeGroupMember`: `member.projectId === rule.projectId` eşitliği (remove'daki gibi).
5. D2 `convex/orphanGuards.test.ts`: super_admin + project_admin → silinmiş kapı/cihaz/çalışan bağı olan kural/üyelik/cihaz bağı silme BAŞARILI; proje değiştiren çalışanın eski izni super_admin'de onay/red başarılı; mevcut 273 test yeşil kalır.
Ownership: `convex/accessRules.ts`, `convex/leaves.ts`, `convex/orphanGuards.test.ts` (yalnız bu üçü).
Kapsam DIŞI: diğer B3 dosyaları (shifts/departments/positions/companies — denetim temiz), employees/visitors/cardReadings/reports (commit'li B1), doors/devices kaskadı (ayrı iş).
