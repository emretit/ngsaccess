# Roller W-C — yönetim / hesap / proje / ayar / denetim kaydı dönüşümü (backend)

## Hedef
Aşağıdaki dosyalardaki rol kontrolleri INVENTORY.md + karar 1-2-9-10-11'e göre `admin.manage` / `super_admin` / `üye`'ye çevrilir. Bu dosyalarda (lib/auth.ts ve lib/customFunctions.ts HARİÇ) `adminMutation|adminQuery|requireAdmin|isManager|project_admin|project_user` okuması kalmaz.

## Ownership (yalnız bunlar + yeni test dosyası)
convex/accountAccess.ts · convex/actions/getChatData.ts · convex/actions/openaiChat.ts · convex/auditLog.ts · convex/auth.ts · convex/files.ts · convex/lib/adminGuards.ts · convex/lib/auditActors.ts · convex/lib/publicUser.ts · convex/onboarding.ts · convex/privacyRetention.ts · convex/projects.ts · convex/settings.ts · convex/userPreferences.ts · convex/userProjects.ts · convex/users.ts · bu dosyaların mevcut `*.test.ts` dosyaları (yalnız amaçlı davranış değişikliği için) · YENİ `convex/roles.admin.test.ts`

## Notlar
- `users.updateRole/deleteUser/initializeAdmin/setRoleByEmail` platform (super_admin) kalır; ama `users.role` değerleri artık yalnız super_admin için anlamlı. Kullanıcı listesi (`users.list/adminList`) proje yöneticisine kendi projelerindeki üyeleri, her üyenin O PROJEDEKİ rolüyle göstermeli (`roles.listProjectMembers` zaten var; `adminList`'in proje rolü filtresi `projectRoleValidator` ile).
- `lib/adminGuards.ts` `requireAccountAccessTarget`: "project_admin hedef project_user" kuralı → çağıran hedefin TÜM projelerinde `admin.manage` sahibi olmalı; hedef herhangi bir projede `admin` ise yalnız super_admin (yönetici yöneticiyi dondurmasın). Son etkin super_admin korumaları aynen kalır.
- `projects.remove/getDeletionImpact` → super_admin veya `admin.manage` (owner ayrıcalığı kalkar, karar 2). Proje oluşturma/`onboarding.ensureProjectForNewUser`: ilk üyelik `role: "admin"` ile aynı mutation'da (karar 9).
- `settings.ts`: genel/gizlilik/bildirim → `admin.manage`; çalışma-bordro ayarı → `schedule.manage`; rapor ayarı → `reports.view` (karar 10). `auditLog` okuma → `admin.manage`. `privacyRetention` → `admin.manage`.
- `files.generateUploadUrl/claimUpload` → üye (karar 11). Chat/AI action'ları envanterdeki öneriye göre.
- `lib/auth.ts` ve `lib/customFunctions.ts`: SİLME/DEĞİŞTİRME (başka worker'lar kullanıyor). Yalnız `lib/auth.ts`'teki `getProjectIdsForUser`'a dokunma.
- `convex/invites.ts`, `convex/actions/sendEmail.ts` çekirdekte bitti; dokunma.

## Kapı vitest
`node_modules/.bin/vitest run convex/roles.admin.test.ts convex/roles.test.ts convex/users*.test.ts convex/accountAccess*.test.ts convex/projectSetup.test.ts convex/projects*.test.ts convex/auditLog*.test.ts convex/settings*.test.ts convex/privacyRetention*.test.ts convex/files*.test.ts convex/onboarding*.test.ts convex/lib/accountAccess.test.ts` (eşleşmeyeni atla) + son olarak tam `node_modules/.bin/vitest run convex` (yalnız SENİN dosyalarına ait kırmızı olmamalı)

## Kabul grep'i
`grep -nE "adminMutation|adminQuery|requireAdmin|isManager\(|project_admin|project_user" <ownership dosyaları (test hariç)>` → yalnız platform/geri uyum satırları (her biri raporda gerekçeli)

Rapor yolu: `docs/roles/report-wc.md`
