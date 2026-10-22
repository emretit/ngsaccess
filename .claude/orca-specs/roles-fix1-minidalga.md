# Roller FIX-1 — denetim bulguları + mini dalga + eski kapı temizliği

## Hedef
`docs/roles/AUDIT.md` bulguları Y-1, O-1, O-2, D-1, D-2, D-3 kapanır; eski kapılar (`adminMutation`, `adminQuery`, `requireAdmin`, `isManager`, `canSeePay(user)`, `capabilities()`) kodda HİÇ çağrılmaz ve tanımları silinir. Bulgu başına en az bir test: eski kodda kırmızı / yenide yeşil.

## İş listesi
1. **Y-1 mini dalga** (dosyalar artık commit'li, sahibi bıraktı): `convex/accessRules.ts` 6 adminMutation → authedMutation + `requirePermission(..., "accessRules.manage")` (kaydın projesiyle); `convex/cardReadings.ts` `assignCardFromReading` → `employees.manage` (çalışanın projesi), `:641` civarı `canSeePay(ctx.user)` → `await canSeePayInProject(ctx, ctx.user, <çalışanın projectId>)`; `convex/lib/accessRuleRead.ts` envanter satırı; `src/components/employees/{EmployeeDetails,EmployeeForm,EmployeeSyncConfirmDialog}.tsx` + `hooks/useEmployeeFormData.ts` → `usePermissions().can(...)` (INVENTORY.md satırları).
2. **Y-1 kök**: `convex/invites.ts` `consume` yeni kurulum hesabına `users.role` olarak HER ZAMAN `"project_user"` yazar (proje rolü yalnız üyelikte). `legacyMirrorRole` çağıranı kalmazsa `roleCatalog.ts`'ten sil.
3. **O-1**: `users.updateRole` super_admin'i düşürürken kullanıcının tüm üyeliklerine `args.role` karşılığını yaz (`project_admin→admin`, `project_user→viewer`); son-yönetici korumasını ihlal ediyorsa reddet. Test.
4. **O-2**: `lib/permissions.ts countProjectAdmins` super_admin üyeleri saymaz. Ayrıca sayım ilk etkin yöneticide durabilir (`hasOtherActiveAdmin` benzeri; çağıranlar hep `=== 0` kullanıyor — `users.ts`, `roles.ts`). Test.
5. **D-1**: personel oluştur/güncelle (`employees.ts` + varsa toplu içe aktarma) `hourlyRate/monthlySalary` (ücret alanları) argümanı geldiyse `pay.view` ister; formda (`EmployeeForm`/ilgili alt bileşen) `can("pay.view")` yoksa ücret alanları gizli ve gönderilmez. Test: pay.view'siz İK ücret yazamaz, ücretsiz güncelleme geçer.
6. **D-2**: tam proje yeniden senkronu (AUDIT.md'deki fonksiyon) `devices.manage` ister; kural-kapsamlı senkron `accessRules.manage` kalır.
7. **D-3**: platform kullanıcı formu (`src/components/admin/components/UserFormDialog.tsx` + hook/types) yalnız "Süper Admin / Normal" seçimi; proje rolü ProjectMembersContent'te. `users.updateRole` girdisi buna göre (project_admin seçeneği UI'dan kalkar; backend eski değeri kabul etse de proje yetkisi vermez).
8. **Temizlik**: `lib/customFunctions.ts` adminQuery/adminMutation, `lib/auth.ts` requireAdmin/isManager, `lib/payVisibility.ts` eski `canSeePay(user)`, `src/lib/capabilities.ts` `capabilities()` (dosya boşalırsa sil, importları güncelle), `src/services/authService.ts`/`ProjectFilter.tsx` eski rol karşılaştırmaları → yetki tabanlı. Test mock'larındaki eski export'lar da güncellenir.
9. **Küçükler**: `roles.ts backfillMemberRoles` sayaç hatası (rolü dolu satırlar `scanned`'ı tüketip ilerlemeyi durdurmasın — sayfalı/cursor ya da yalnız rolsüzleri say); `roleCatalog.ts` validator ↔ sabit dizi eşitliği için derleme zamanı tip assertion'ı (`Infer<typeof projectRoleValidator>` ≡ `ProjectRole`, aynısı Permission).

## Ownership
Yukarıda adı geçen her dosya + bunların testleri + yeni test dosyası `convex/roles.fix1.test.ts`. Başka oturum şu an çalışmıyor; yine de `git status`'ta senin dokunmadığın yeni M dosya görürsen ona dokunma.

## Kısıtlar
- `convex/lib/processCardReadingCore.ts` internalMutation (V8) — "use node" EKLEME. `convex/processCardReading.characterization.test.ts` (75 test) kart kararını donduruyor: KIRMIZIYA DÖNERSE davranış değişmiştir → dur, `ask`.
- Snapshot `-u` yasak; assertion yalnız amaçlı değişiklikte (rapora file:line).
- `npx convex` / codegen / deploy / DB / commit / push YOK. `convex/_generated` değişmez.

## Kapılar (kendin koş)
1. `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` 0 · 2. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` 0 · 3. `node_modules/.bin/eslint src convex` 0 error · 4. `node_modules/.bin/vitest run` TAMAMI yeşil · 5. `node /tmp/find-node-leak.mjs` çıktısız
6. `grep -rnE "adminMutation|adminQuery|requireAdmin|isManager|canSeePay\(|capabilities\(" convex src | grep -v _generated` → 0 satır
7. `grep -rnE "role (===|!==) \"project_(admin|user)\"" convex src | grep -v _generated | grep -v "\.test\."` → 0 satır

## Rapor
`docs/roles/report-fix1.md` + worker_done ≤10 satır: bulgu başına kapandı/kanıt testi, temizlik sayısı, kapı sonuçları, davranış değişiklikleri.
