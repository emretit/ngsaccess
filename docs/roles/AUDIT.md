# Roller dönüşümü — güvenlik denetimi (2026-10-22, salt okuma)

Denetçi: Claude (öbür aile; kodu Codex yazdı). Kod değiştirilmedi. Kanıt testleri `/tmp/rolesaudit/repo/convex/zzAudit.test.ts`
(çalışma ağacının kopyası) → 6/6 geçti; mevcut `convex/roles*.test.ts` → 4 dosya / 57 test yeşil.

## Özet

| Önem | Sayı |
|---|---|
| Kritik | 0 |
| Yüksek | 1 |
| Orta | 2 |
| Düşük | 3 |

En önemli sonuç: yeni rol modeli kendi dosyalarında tutarlı, ama **eski `users.role` kapısı hâlâ canlı iki dosyada**
(`accessRules.ts`, `cardReadings.ts`) ve davet kabulü `users.role = project_admin` yazmaya devam ediyor. Bu yüzden rol düşürme
o uçlarda etkisiz ve bir projedeki Yönetici daveti başka projede eski yönetici kapılarını açıyor (Y-1). Roller, bu iki dosyanın
mini dalgası olmadan yayınlanmamalı.

## Bulgular

### Yüksek

**Y-1 — Eski `adminMutation` / `canSeePay` kapıları rol düşürmeyi ve proje sınırını aşıyor**
- Kök: [convex/invites.ts:234-238](../../convex/invites.ts) yeni hesaba `legacyMirrorRole([projectRole])` → `users.role = "project_admin"` yazar;
  [convex/roles.ts:202-203](../../convex/roles.ts) `setMemberRole` `users.role`'e dokunmaz (bilerek). Eski kapı
  [convex/lib/customFunctions.ts:61-66](../../convex/lib/customFunctions.ts) yalnız `users.role ∈ {super_admin, project_admin}` + üyelik bakar.
- Etkilenen canlı uçlar (dönüştürülmemiş, kapsam dışı dosyalar): `accessRules.create/update/remove/createWithGroups/updateWithGroups/updateWithGroupsTracked`
  ([convex/accessRules.ts:676](../../convex/accessRules.ts) vd.), `cardReadings.assignCardFromReading` ([convex/cardReadings.ts:279](../../convex/cardReadings.ts)),
  `cardReadings.getEmployeeAttendanceDetail` ücreti `canSeePay(ctx.user)` (= `isManager`) ile açar ([convex/cardReadings.ts:641](../../convex/cardReadings.ts)).
- Senaryo 1 (çapraz proje, kanıtlı): Ali B projesine **Yönetici** davetiyle yeni hesap açar → `users.role=project_admin`. Sonra A projesine
  **Görüntüleyici** davetiyle katılır. `roles.myPermissions(A)` → `viewer`, `accessRules.manage` yok; yine de `accessRules.create({projectId: A})` başarılı.
- Senaryo 2 (kanıtlı): A yöneticisi Veli'yi `setMemberRole(..., "viewer")` ile düşürür; Veli (`users.role=project_admin`) A'da erişim kuralı yaratmaya,
  silmeye, okunan kartı personele atamaya ve PDKS detayında saatlik ücreti görmeye devam eder.
- Ters yönde: `users.role=project_user` olan İK/Teknik kullanıcıları bu uçlarda reddedilir (izin verilmesi gereken iş gizli/çalışmaz).
- Düzeltme: mini dalga yayın önkoşulu (accessRules → `accessRules.manage`, assignCard → `employees.manage`, 641 → `canSeePayInProject`)
  + `invites.consume` içindeki `users.role` yazımını kaldır (artık yalnız eski kapıları besliyor).

### Orta

**O-1 — Platform rolü düşürülen super_admin, oluşturduğu/üye olduğu her projede Yönetici kalıyor**
- [convex/users.ts:98-102](../../convex/users.ts): düşürmede rolsüz üyelikler `membershipRole(target)` ile sabitlenir; `target.role` hâlâ `super_admin`
  olduğundan `legacyRoleToProjectRole("super_admin") = "admin"`. Ayrıca [convex/projects.ts:76](../../convex/projects.ts) super_admin'in yarattığı
  projeye kendisini açıkça `role: "admin"` ekler.
- Senaryo (kanıtlı): NGS personeli S (super_admin) müşteri projesi P'yi oluşturur. İşten ayrılınca başka super_admin `users.updateRole({userId: S, role: "project_user"})`
  yapar. `roles.myPermissions(P)` → `admin`, 13/13 yetki (kullanıcı/rol/davet dahil). Eski davranışta S, P'de `project_user` olurdu.
- Düzeltme: super_admin düşürülürken üyelik rolünü `args.role` karşılığına (`project_admin→admin`, `project_user→viewer`) yaz; ya da düşürmede üyelikleri listeleyip onay iste.

**O-2 — Son yönetici koruması super_admin üyeliğini Yönetici sayıyor**
- [convex/lib/permissions.ts:136](../../convex/lib/permissions.ts) `countProjectAdmins` super_admin üyeyi de sayar; `projects.create` super_admin'i her yeni projeye `admin` ekler.
- Senaryo (kanıtlı): super_admin P'yi oluşturur, müşterinin tek yöneticisi M'yi davet eder. M `setMemberRole(P, M, "viewer")` (ya da super_admin `updateRole` ile M'yi
  projeden çıkarır / `deleteUser`) → engel tetiklenmez; projede müşteri tarafında hiç Yönetici kalmaz (PLAN "her projede en az bir admin").
- Düzeltme: sayımda `!isSuperAdmin(member)` koşulu ekle (veya super_admin üyeliklerini hiç admin sayma).

### Düşük

**D-1 — `pay.view` yalnız okumayı kapatıyor; ücret yazımı kapısız**
- [convex/employees.ts:181/203](../../convex/employees.ts) (`create`), [:247/287](../../convex/employees.ts) (`update`) ücret alanlarını yalnız `employees.manage` ile yazar;
  form alanı her zaman görünür ([src/components/employees/EmployeeFormFields.tsx:241](../../src/components/employees/EmployeeFormFields.tsx)).
- Senaryo (kanıtlı): Yönetici İK rolünden `pay.view`'i kaldırır. İK kullanıcısı `getById` ile maaşı `null` görür, formda boş alana değer yazıp kaydeder →
  gerçek maaş (50000) sessizce 1 olur. Varsayılan tabloda tetiklenmez (`employees.manage` olan her rolde `pay.view` da var), yalnız özelleştirmede.
- Düzeltme: `hourlyRate/monthlySalary` argümanı geldiyse `requirePermission(..., "pay.view")`; formda `can("pay.view")` yoksa alanları gizle.

**D-2 — Tam proje yeniden senkronu `accessRules.manage` ile de başlatılabiliyor**
- [convex/accessGrantStatus.ts:201](../../convex/accessGrantStatus.ts) `redistribute({projectId})` (pairs/onlyFailed yok) `createRunInTransaction(..., "accessRules.manage")` çağırır;
  karar 6 tüm proje cihaz senkronunu `devices.manage`'e bağlar (`deviceSyncRuns.startProjectResync` öyle).
- Senaryo: `accessRules.manage` verilmiş ama `devices.manage`'i olmayan özel rol, tüm cihazlara tam gönderim başlatır. Etki düşük (idempotent), anahtar tutarsız.
- Düzeltme: pairs yoksa `devices.manage` iste ya da kararı bilinçli istisna olarak PLAN'a yaz.

**D-3 — Platform hesap formunda "Proje Yöneticisi" seçimi sessizce yok sayılıyor**
- [src/components/admin/components/UserFormDialog.tsx:176-178](../../src/components/admin/components/UserFormDialog.tsx) super_admin düzenlemesinde `project_admin/project_user` seçeneği sunar;
  [convex/users.ts:105](../../convex/users.ts) non-super hedefte rolü yazmaz, [:95](../../convex/users.ts) yeni üyeliği hep `viewer` ekler.
- Senaryo: super_admin bir kullanıcıyı formdan "Proje Yöneticisi" yapıp projelere ekler; "Kullanıcı güncellendi" toast'ı gelir ama kullanıcı her projede Görüntüleyici.
- Düzeltme: düzenlemede yalnız super_admin/normal seçimi bırak; proje rolünü `ProjectMembersContent` üzerinden yönlendir.

## Henüz dönüştürülmedi (kapsam dışı, başka oturum; 2026-10-22 itibarıyla bdb4e3a2/9a28fb69 commit'li)
- `convex/accessRules.ts` — 7 `adminMutation` kullanımı (Y-1).
- `convex/cardReadings.ts` — `assignCardFromReading` `adminMutation`, `getEmployeeAttendanceDetail` `canSeePay` (Y-1).
- `convex/lib/accessRuleRead.ts`, `convex/lib/processCardReadingCore.ts`, `convex/accessRuleMemberships.test.ts`, `convex/processCardReading.characterization.test.ts`.
- `src/components/employees/EmployeeDetails.tsx` — düzenleme `isAdmin` (= `admin.manage`) ile açılıyor; İK (`employees.manage`) detaydan düzenleyemez (sunucu izin veriyor, düğme gizli).
- `src/components/employees/{EmployeeForm,EmployeeSyncConfirmDialog}.tsx`, `src/components/employees/hooks/useEmployeeFormData.ts`.
- Mini dalga sonrası: `adminMutation/adminQuery/isManager/requireAdmin` ve `lib/payVisibility.ts` `canSeePay` re-export'u silinmeli.

## Kontrol listesi

| # | Konu | Durum | Not |
|---|---|---|---|
| 1 | Yetki yükseltme | **Bulgu** (Y-1, O-1) | `setRolePermissions` admin.manage'i normalize ile atıyor, admin rolü kilitli; `setMemberRole` super_admin hedefini reddediyor; `invites.create` admin.manage istiyor; `users.updateRole/setRoleByEmail` super/internal; `onboarding.ensureProjectForNewUser` yalnız üyeliksiz kullanıcıya kendi yeni projesini veriyor. Proje-içi yol TEMİZ; çapraz proje yalnız eski kapılardan (Y-1). |
| 2 | IDOR / yanlış proje | TEMİZ | Örneklenenler kaydın projesiyle denetliyor: employees get/update (hedef proje dahil), shifts bulk/assign, pdks bulkUpsertManual (satır başı), attendanceCorrections/leaveRequests karar, grant redistribute pairs, fingerprint hedefi (çalışan=cihaz projesi), IDE openDoor (kapı=panel), devices.update zone/door, sync uyarı toplu kapatma (satır başı). Projesiz kayıt `hasPermission(undefined)` → yalnız super_admin. |
| 3 | Kapı unutulan uç | TEMİZ (D-2 hariç) | 311 public uçtan 147'si doğrudan anahtar çağırmıyor; hepsi incelendi: yardımcıya delege (requireProject/authorize/getTargetInternal/createRunInTransaction/requireAccountAccessTarget), PLAN gereği üyelik düzeyi okuma, çalışan-auth (mobil) ya da token/kurulum akışı. |
| 4 | Sır kapısı | TEMİZ | `devices.list/getById` okuma ve `devices.update` yazma aynı `devices.manage` + aynı `DEVICE_SECRET_FIELDS`; okuyamayan yazamadığı için boş=silme yok. `hikBridge` token'ları `devices.manage`, `ideDefaults` super_admin, kuyruk sırları yalnız internal. |
| 5 | Ücret / hassas alan | **Bulgu** (D-1; Y-1 içinde cardReadings:641) | Okuma maskeleri: employees list/getById, PDKS tablo, bordro, raporlar (satır + toplam), SGK XML (ücret yok), zamanlanmış rapor e-postası (yalnız sayım). Ayrılma nedeni/SGK kodu/terminatedBy `employees.manage` yoksa gizli. Cron alıcının güncel `reports.view`'ini her gönderimde yeniden hesaplıyor. |
| 6 | Son yönetici | **Bulgu** (O-2) | `setMemberRole`, `updateRole` (projeden çıkarma), `deleteUser`, `adminDeleteByEmail` engelli; super_admin olmayan dondurma admin hedefini reddediyor. |
| 7 | Action'lar | TEMİZ | Tüm `internal.roles.checkPermission` çağrıları `ctx.user._id` + kayıttan okunan `projectId` (cihaz/okuyucu/çalışan) kullanıyor, false'ta throw. `pingHikGateway` üyelik projelerinde en az birinde `devices.manage`. |
| 8 | Frontend | **Bulgu** (D-1 formu, D-3; EmployeeDetails dönüştürülmedi) | `RolesSettings` kilitli sütun/admin.manage kutusu disabled, sunucu zaten atıyor. Kapı açma `doors.open`, cihaz CRUD `devices.manage`, ayar sekmeleri karar 10 ile, Raporlar/Kişiler rota kapısı uyumlu. |
| 9 | Davranış regresyonu | **Bulgu** (O-1, D-3) | Kanıtlı: rolsüz üyelik + `project_admin` → admin; + `project_user` → viewer; super_admin → 13/13. |

## Notlar (bulgu sayılmadı)
- `adminDevices.listForClaim`: herhangi bir projede `devices.manage` olan kullanıcı tüm platform havuzundaki atanmamış panellerin `idePassword`'ünü görür ve kendi projesine claim edebilir (koordinatör kararı). Varsayılan Teknik rolü de artık bu kapsamda.
- `invites.create` aynı e-postanın TÜM projelerdeki açık davetlerini iptal eder; B yöneticisi A'nın bekleyen davetini düşürebilir (önceden de böyle).
- Zamanlanmış rapor dondurulmuş / erişimi bitmiş kullanıcıya gitmeye devam eder (`resolveScheduleScope` `accessBlockReason` bakmıyor; önceden de yoktu, içerik yalnız sayım).
- `captureFaceFromDevice` çalışanın projesi ile cihazın projesini eşleştirmiyor (iki projede de üyelik + cihaz projesinde `biometrics.manage` gerekir; etki düşük).
- `employees.view` yalnız Kişiler liste/detay kapısı; ad/kart bilgisi PDKS, canlı izleme, kural üyeleri gibi üyelik düzeyi uçlarda açık (PLAN gereği). Kutucuğu kaldırmak gizlilik sağlamaz; UI'da bu söylenmeli.
- `roles.backfillMemberRoles` her çağrıda baştan tarar; toplam üyelik >2000 olursa ilerlemez (canlıda 4).
- `src/components/layout/navigationSearch.ts:9` `visibleRoutes(role)` `users.role`'den türetir; üretimde çağrılmıyor, silinebilir.
