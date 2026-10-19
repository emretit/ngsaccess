# Görev: X1 düzeltmesinin güvenlik denetimi (SALT OKUMA)

## Hedef
`git diff -- convex/employeeAuth.ts convex/actions/sendEmail.ts convex/actions/setPassword.ts` + yeni `convex/employeeAuth.test.ts` (Codex luna yazdı) X1'i kapatıyor mu, regresyon var mı — kanıtla raporla. Kod DEĞİŞTİRME.
Spec `.claude/orca-specs/pub-p5-x1.md`, worker raporu `/tmp/pub-p5/fix-x1.md`. Not: `sendEmail.ts` diff'inde yalnız :163 satırı X1'e ait; önceki R5-01 değişiklikleri zaten commit'li (HEAD) — `git diff HEAD` ile bak.

## Açık
`employeeAuth.getByEmployee` / `getByToken` kimliksiz public query'lerdi, `employeeAuth` belgesinin tamamını (passwordHash, setupToken) dönüyordu → employeeId bilen setupToken'ı okuyup `actions/setPassword.setEmployeePassword` ile çalışan mobil hesabını ele geçirir.

## Kontrol et
1. Gizli alan (passwordHash, setupToken, sessionToken, employeeSessions token'ları) döndüren BAŞKA public yol kaldı mı: `convex/**` tüm public query/mutation/action (employees.ts, employeeAuth.ts signIn/me/signOut, employeeCheckIn, http.ts, actions/*), hata metinleri.
2. Public `getByToken` DTO'su yalnız `{tokenExpiresAt, email}` mi; returns validator doğru mu; eski canlı web (`https://ngsplus.app` EmployeeSetup lazy chunk'ı — `curl` ile oku) bu DTO ile çalışır mı (hangi alanları okuyor?).
3. `setEmployeePassword` (public action, token-guard): internal `getByTokenInternal` ile davranış aynı mı (süre/token kontrolü, token tüketimi). Token tahmin/brute-force yüzeyi değişti mi.
4. `sendEmployeeSetupEmail` (authedAction) internal `getByEmployee` ile davranış aynı mı; yetki kontrolü önce mi.
5. Mobil (`mobile/lib/**`) bu fonksiyonlardan birini çağırıyor mu (`employeeAuth:` dizgeleri) — kırılma var mı.
6. Testler gerçek kayıtlı handler'ları mı koşuyor.

## Kapılar (kendin koş)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `-p convex/tsconfig.json` · `node_modules/.bin/eslint convex/employeeAuth.ts convex/employeeAuth.test.ts convex/actions/sendEmail.ts convex/actions/setPassword.ts` ·
`node_modules/.bin/vitest run convex/employeeAuth.test.ts`. Ağaçta başka oturumların işi var — kapsam dışı.

## YASAK
Dosya düzenleme (rapor hariç) · `npx convex …` · commit/push · canlı DB/Convex yazma · arka planda sunucu.

## Rapor
`/tmp/pub-p5/REVIEW-x1.md`: ilk satır `**commit'e engel: var|yok**`, kapılar, bulgular `ID | Ciddiyet | file:line | sorun | senaryo | öneri`. `worker_done` ≤10 satır.
