# FIX1 — Faz 5-B: legacy tam tablo taramalarını kaldır + backfill çakışmasını global yap

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU (YASAK: git add/commit/stash/checkout/reset/restore; npx convex; DB; paket kurma). Rapor: `/tmp/fix-f5-b-fix1-rapor.md`.
Denetim raporu: `/tmp/fix-f5-b-kisi-denetim.md` (bulgu 1+2 ENGEL, 3 DÜZELT, 5 NOT — hepsi ŞART). Önceki iş: `.claude/orca-specs/fix-f5-b-kisi.md`, rapor `/tmp/fix-f5-b-kisi-rapor.md`.
NOT: koordinatör `normalizeEmployeeEmail`'i `convex/lib/employeeEmail.ts`'e taşıdı (employees.ts re-export ediyor) ve `convex/employeeImport.ts`'e normalize + ham iki index araması ekledi — bunları bozma, aynı deseni kullan.

## Ownership
`convex/employeeAuth.ts`, `convex/employees.ts` (yalnız `findDuplicateEmployee`), `convex/migrations.ts` (yalnız `normalizeEmployeeEmails`), `src/pages/CheckIn.tsx` (yalnız NOT 5 tone), `convex/fixF5People.test.ts`, `convex/employeeAuth.test.ts`. Başka dosya YOK (gerekirse `ask`).

## Değişiklikler (koordinatör kararı: geçiş penceresi tam tarama yok; backfill yayınla AYNI pencerede çalıştırılacak)
1. **Bulgu 1** — `employeeAuth.ts` (~270-277 signIn ve aynı deseni kullanan diğer auth/kurulum yolları): `ctx.db.query("employees")` tam taraması TAMAMEN kalksın. Yalnız iki index araması: normalize değer, sonra ham `trim()` değer (farklıysa). Bulunamazsa mevcut "e-posta/şifre hatalı" yanıtı.
2. **Bulgu 2** — `employees.ts` `findDuplicateEmployee("email")`: tam tarama kalksın; normalize + ham iki index araması (import ile aynı).
3. **Bulgu 3** — `migrations.ts` backfill: proje bazlı peers ön taraması (≤10001 okuma) kalksın. Her kayıt için hedef normalize değer `n`: `by_email` eq `n` ile self HARİÇ kayıt varsa → çakışma, kayıt DEĞİŞMEZ, `console.warn` yalnız id'lerle (PII yok). Global kapsam (proje fark etmez). İki ham-varyant kaydında ilk işlenen normalize olur, ikincisi çakışma olarak kalır (test et).
4. **NOT 5** — `CheckIn.tsx:~95` READER_REQUIRED ekranı nötr ton (mevcut tone seçeneklerinden "info"/nötr olanı).

## Kabul
- Testler: bilinmeyen e-postayla signIn tabloyu taramaz (sorgu yalnız by_email index'iyle — mock/izleme ile doğrula) ve hatalı-giriş yanıtı verir; ham büyük harfli kayıt TAM AYNI yazımla giriş yapabilir; findDuplicateEmployee tam tarama yapmaz; backfill farklı projelerdeki `Ali@x.com`/`ali@x.com` için birini normalize eder, diğerini çakışma olarak bırakır; 450 kayıt 3 parti + 20 parti sınırı korunur.
- Kapılar (fix-ortak.md) + `vitest run convex/employeeAuth*.test.ts convex/fixF5People.test.ts convex/fixF4People.test.ts convex/employees*.test.ts convex/employeeImport.test.ts convex/mobileVisitors.test.ts src/pages/CheckIn.test.tsx` yeşil.
commit/push/deploy/migration/DB yazma YOK. `git add`/`git commit` YASAK.
