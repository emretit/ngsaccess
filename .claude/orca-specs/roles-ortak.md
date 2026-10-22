## ORTAK KURALLAR (roller dönüşüm worker'ları, 2026-10-22)

Önce oku: `docs/roles/PLAN.md` (5 rol, 13 yetki, varsayılan tablo, envanter kararları 1-11) ve `docs/roles/INVENTORY.md` (senin dosyalarının satırları: dosya:satır → önerilen anahtar). Çekirdek HAZIR, değiştirme: `convex/lib/roleCatalog.ts`, `convex/lib/permissions.ts`, `convex/roles.ts`, `convex/roles.test.ts`, `src/hooks/usePermissions.ts`, `convex/schema.ts`.

### Çalışma ortamı
- Dizin `/Users/emreaydin/ngsaccess` (main, worktree YOK). Aynı anda 4 başka worker + başka oturumlar aynı dizinde. YALNIZ "Ownership" listendeki dosyalara yaz. Listede olmayan dosyaya dokunma, formatlama, geri alma YOK. Başka dosyada değişiklik gerekiyorsa `ask` ile sor.
- SAHİPLİ (başka oturum, DOKUNMA): `convex/accessRules.ts`, `convex/cardReadings.ts`, `convex/lib/accessRuleRead.ts`, `src/components/employees/EmployeeDetails.tsx`, `src/components/employees/EmployeeForm.tsx`, `src/components/employees/EmployeeSyncConfirmDialog.tsx`, `src/components/employees/EmployeeSyncConfirmDialog.test.tsx`, `src/components/employees/hooks/useEmployeeFormData.ts`.
- `adminMutation`, `adminQuery`, `requireAdmin`, `isManager`, `capabilities` SİLİNMEZ/DEĞİŞTİRİLMEZ (başka worker'lar hâlâ kullanıyor); sen yalnız kendi dosyalarındaki KULLANIMLARI kaldırırsın.

### Backend dönüşüm deseni
- `adminMutation`/`adminQuery` → `authedMutation`/`authedQuery` + işlem projesini bulduktan hemen sonra `await requirePermission(ctx, ctx.user, projectId, "<anahtar>")` (`convex/lib/permissions.ts`). Kaydın projesi `doc.projectId` ise önce kaydı oku, sonra kontrol et; kayıt yoksa mevcut "bulunamadı" davranışı korunur.
- Mevcut proje kapsamı kontrolü (getProjectIdsForUser/isProjectAllowed) requirePermission üyeliği de denetlediği için gereksizleşir; ama hata METNİ testlerde aranıyorsa `requirePermission(..., message)` ile aynı metni ver.
- `isManager(user)` ile sır/alan gizleme → `await hasPermission(ctx, ctx.user, projectId, "<anahtar>")` (satırın projesiyle). Sır OKUMA kapısı YAZMA kapısıyla AYNI anahtar olmalı (yoksa "boş = temizle" wipe hatası: okuyamayan boş görür, kaydedince siler).
- Liste sorguları: `getProjectIdsForUser` + rol kontrolü yerine `getProjectIdsWithPermission(ctx, ctx.user, "<anahtar>")`. Yetki yoksa liste boş/alan null — bugünkü "project_user → null" davranışlarını aynı biçimde koru.
- `user.role === "super_admin"` platform kontrolleri (sistem yönetimi, projesiz kayıt, global kullanıcı) AYNEN kalır; bunun için `isSuperAdmin(user)` kullanabilirsin.
- `role === "project_admin"` / `"project_user"` okuması kalmaz (yetki kararı `users.role`'den verilmez). Kabul grep'i bunu ölçer.
- Action'larda (ctx.db yok): `const ok: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId, permission: "<anahtar>" }); if (!ok) throw new Error("Bu işlem için yetkiniz yok");`
- Yeni `userProjects` insert'i varsa `role` AÇIKÇA yazılır.
- `"use node"` tuzağı: Node-yalnız modül (crypto, ./hikGateway, ./gateway/*) içe aktaran dosyaya "use node" şart; V8 query/mutation dosyasına `lib/permissions.ts` import etmek serbest (saf V8). Kapı: `node /tmp/find-node-leak.mjs` çıktısız.

### Test
- Davranış DEĞİŞİMİ beklenen: eski `project_user` = `viewer` (employees.view, reports.view, doors.open). Bugün project_user'a açık olup artık kapanan yazmalar (ör. vardiya/departman) testlerde "yetkisiz" olarak güncellenir; bunu rapora yaz.
- KARIŞIK test dosyaları (birden fazla grubun modülünü test eden, ör. `convex/akisFaz1.authz.test.ts`, `convex/w5a*.test.ts`, `convex/orphanGuards.test.ts`): kırmızıya dönerse DÜZENLEMEDEN önce `ask` ile sor (iki worker aynı dosyaya yazmasın).
- Mevcut test fixture'ları `role: "project_admin"` + rolsüz üyelik kullanıyor → türetme ile `admin` (tüm yetkiler) — bu testler geçmeye devam etmeli. `vitest -u` YASAK; assertion'ı yalnız amaçlı davranış değişikliği için değiştir ve rapora yaz.
- Kendi grubun için YENİ test dosyası (spec'te adı var): her yetki anahtarından en az bir temsilci fonksiyon için tablo testi — (a) varsayılanda izinli rol geçer, (b) izinsiz rol `Bu işlem için yetkiniz yok` ile reddedilir ve DB değişmez, (c) Yönetici `roles.setRolePermissions` ile anahtarı izinli rolden kaldırınca aynı rol reddedilir. Fixture deseni: `convex/roles.test.ts` `setup()/member()` (rateLimiterTest.register dahil).

### Kapılar (hepsini kendin koş, sonuçları rapora yaz)
1. `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0 (başka worker'ın yarım dosyasından hata gelirse SENİN dosyalarında hata olmadığını göster, dış hatayı dosya:satır raporla)
2. `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0 (aynı not)
3. `node_modules/.bin/eslint <senin dosyaların>` → 0 error
4. Spec'teki vitest komutu → yeşil
5. Kabul grep'i (spec'te) → beklenen sonuç
6. `node /tmp/find-node-leak.mjs` → çıktı yok
- `npx convex ...` / codegen / deploy / DB yazma / commit / push YOK. `convex/_generated` değişmez (yeni registered modül ekleme; gerekirse `ask`).

### Rapor
`worker_done` ≤10 satır: değişen dosya sayısı, dönüştürülen kontrol sayısı, kapı sonuçları, davranış değişiklikleri (file:line), karar/şüphe listesi. Aynısını spec'teki rapor yoluna yaz.
