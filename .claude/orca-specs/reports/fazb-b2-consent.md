# Faz B — B2 KVKK rıza yetkisi
Sonuç: İstenen değişiklik ve ilgili testler tamamlandı; genel kapılar kapsam dışı hatalar nedeniyle tamamen yeşil değil.

## TAM değişen dosya listesi
- `convex/employeeConsents.ts`
- `convex/employeeConsents.test.ts` (yeni)
- `src/components/employees/EmployeeConsentsCard.tsx`
- `src/components/employees/EmployeeConsentsCard.test.tsx`
- `.claude/orca-specs/reports/fazb-b2-consent.md` (bu rapor)

## Değişiklik ve kanıt
- `convex/employeeConsents.ts:48,99`: grant/revoke gerçek adminMutation kullanır; project_user handler'a girmeden reddedilir.
- Mevcut requireEmployeeAccess, biyometri grant kapısı, revoke davranışı, dönüş şekilleri ve okumalar korundu.
- `EmployeeConsentsCard.tsx:63-65,170,200`: useAuth profile.role + capabilities.admin; yönetici dışına grant/revoke butonları, Dialog ve ConfirmDestructive render edilmez.
- `EmployeeConsentsCard.tsx:89,251`: işlem callback'lerinde ayrıca rol kontrolü var; başlık ve rıza listesi görünmeye devam eder.
- `convex/employeeConsents.test.ts:8,49`: yalnız oturum çözümlemesi mock; gerçek kayıtlı _handler üzerinden customMutation sarmalayıcısı çalışır (syncIssuesAuth kalıbı).
- Backend 15 test: dört rıza türünde project_user grant/revoke reddi ve sıfır insert/patch/audit; salt-okuma listeleme; iki yönetici pozitif ve audit kontrolü.
- Backend ayrıca project_admin başka proje/orphan/boş üyelik reddi, super_admin orphan izni, iki biyometri türünde kapalı modülde grant reddi/revoke izni ve açık modül grant iznini kapsar.
- `EmployeeConsentsCard.test.tsx:49,67`: project_user/bilinmeyen rol salt-okuma; önceden açık form/onay state'i dahi render edilmez; iki yönetici butonları korunur.
- UI mevcut dört test dahil 8 test geçti.

## Kapı sonuçları
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → exit 2; kapsam dışı `convex/cardReadings.ts:510` hourlyRate null / Doc tip uyumsuzluğu.
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → exit 2; aynı kapsam dışı TS2322.
- `node_modules/.bin/eslint convex/employeeConsents.ts convex/employeeConsents.test.ts src/components/employees/EmployeeConsentsCard.tsx src/components/employees/EmployeeConsentsCard.test.tsx` → exit 0, çıktı boş.
- `node_modules/.bin/vitest run convex/employeeConsents.test.ts src/components/employees/EmployeeConsentsCard.test.tsx` → exit 0, 2 dosya / 23 test geçti (son biçimlendirme sonrası yeniden doğrulandı).
- `node_modules/.bin/vitest run` → exit 1; 146 dosya geçti / 2 dosya başarısız, 1507 test geçti / 4 test başarısız (1511 toplam).
- Tam test hataları: `convex/lib/leaveValidation.test.ts` 2 test (çalışan proje erişimi reddi); `convex/lib/shiftAssign.test.ts` 2 test (auth mock'unda isProjectAllowed export eksik).
- `git diff --check` (üç izlenen kapsam dosyası) → exit 0.
- Ayrıntılı çıktılar: `/tmp/fazb-b2-tsc-{app,convex}.log`, `/tmp/fazb-b2-eslint-final.log`, `/tmp/fazb-b2-related-final.log`, `/tmp/fazb-b2-vitest-full.log`.

## Açık kalan / riskler
- B2 kapsamında açık iş yok; genel kapıların kapsam dışı hataları ilgili sahiplerce giderilmeli.
- Testler yerel mock DB kullanır; gerçek rol sarmalayıcısı, kapsam helper'ı, biyometri kapısı ve audit kodu çalışır; canlı API/veritabanına bağlanılmadı.
- EmployeeDetails, auth.ts, biyometri/imha dosyaları ve diğer oturum dosyalarına yazılmadı; deploy/commit yapılmadı.
