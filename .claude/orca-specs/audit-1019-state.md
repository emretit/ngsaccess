# W1 — Durum doğrulama (handoff iddiaları gerçek mi?)
Rapor: `/Users/emreaydin/ngsaccess/.claude/orca-specs/reports/audit-1019-state.md`

Hedef: Handoff'lardaki "canlı / canlı değil / commit'li" iddialarını komutla doğrula; her satır için DOĞRU / YANLIŞ / DOĞRULANAMADI + kanıt.

1. Git: `git log --oneline origin/main..HEAD` tam 3 commit mi (04023d3, 7059078, 1a0c112)? Her commit'in dosya listesi (`git show --stat`) aşağıdakiyle aynı mı:
   - 04023d3: convex/dashboard.ts, src/components/dashboard/TodayStrip.tsx, src/hooks/useDashboard.ts
   - 7059078: src/components/employees/{EmployeeConsentsCard.tsx,EmployeeDetails.tsx,EmployeeDetails.test.tsx}, src/components/settings/sections/privacy/RetentionAssistantCard.tsx
   - 1a0c112: 14 dosya (convex/auth.ts, convex/lib/authEmail{,.test}.ts, convex/employeeAuth{,.test}.ts, convex/actions/setPassword.ts, convex/projects.ts, convex/ideSync.ts, convex/hikvisionSync.ts, convex/syncIssuesAuth.test.ts, convex/_generated/api.d.ts, src/components/auth/{AuthProvider.tsx,registrationFlow.ts,registrationFlow.test.ts})
   `git status --short` içinde convex/ veya src/ altında commit'siz değişiklik var mı (varsa listele; yalnız yol).
2. Canlı Convex (salt-okuma): `.env.local` içinden YALNIZ `CONVEX_DEPLOYMENT` satırını göster (başka satır basma). Sonra `node_modules/.bin/convex function-spec > /tmp/ceo-audit/w1/spec.json` ve jq/node ile kontrol et:
   - `dashboard:getTodayTimeline` var mı (beklenen VAR → 61cd264 canlı)
   - `dashboard:getStats` args içinde `includeTodayReadings` var mı (beklenen YOK → 04023d3 canlı değil)
   - `employeeAuth:consumeSetupToken` var mı + visibility (beklenen YOK → 1a0c112 canlı değil)
   - `employeeAuth:getByEmployee`, `employeeAuth:getByToken` hâlâ public mi (f287b22 sonrası beklenen: yok ya da internal)
   - `users:currentUser` returns validator var mı (B1, 3ad9529/d5ad014)
   - `cardReadings:getPdksTableData` args `includePunches`, `cardReadings:listReportTransactions` args `sources` (D2 canlı)
   - `employeeConsents:listForEmployee|grant|revoke`, `privacyBiometric:getEmployeeBiometricModule` (KVKK Faz 1)
   - `invites:create` public DEĞİL mi (internal beklenir)
3. Canlı web: `curl -s https://ngsplus.app/` → index HTML'deki `assets/*.js` + o JS'in içinde referans verilen diğer `assets/*.js` parçalarını `/tmp/ceo-audit/w1/live/` altına indir. İşaretler (HEAD kaynakta `git grep` ile işaretin VAR olduğunu da doğrula):
   - `dashboard:getTodayTimeline` (61cd264 → canlıda VAR beklenir)
   - `includeTodayReadings` (04023d3 → YOK beklenir)
   - `employeeConsents:listForEmployee` ve "KVKK Rızalar" (7059078 → kart b253a55'te kopmuştu; canlıda YOK beklenir — VARSA hangi parçada olduğunu yaz)
   - 1a0c112'nin `src/` diff'inden eklenen benzersiz bir string literal seç (`git show 1a0c112 -- src`), canlıda YOK beklenir.
4. Canlı DB sayımı (salt-okuma, YALNIZ küçük tablolar: `employeeAuth`, `employees`, `accessRules`; `cardReadings` OKUMA — Convex Free kotası aşılmış):
   `node_modules/.bin/convex data <tablo> --limit 1000 --format jsonl` (bayrakları önce `--help` ile doğrula) çıktısını ASLA ekrana basma; doğrudan `jq`/`node`'a pipe et ve yalnız sayı üret:
   - employeeAuth satır sayısı · employees satır sayısı · employeeAuth.employeeId'si employees._id'de olmayan (yetim) satır sayısı · birden çok employeeId'ye bağlı e-posta SAYISI (e-postanın kendisi değil)
   - projectId alanı olmayan satır sayısı: employeeAuth, employees, accessRules
   Handoff iddiası: employeeAuth 11 / employees 7 / ~4 yetim / 1 e-posta 2 employeeId'de · projectId'siz employeeAuth 2, accessRules 1.
5. Rapor tablosu: İddia | Beklenen | Bulunan | Durum | Kanıt.
