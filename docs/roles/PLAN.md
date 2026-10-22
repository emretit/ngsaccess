# Sabit roller + proje bazlı yetki kutucukları (2026-10-22)

Emre onayı 2026-10-22: 5 sabit rol, 13 yetki; tablo = varsayılan, proje yöneticisi kutucukları değiştirebilir.

## Checklist
- [x] Pafta incelemesi + ngsplus mevcut durum (3 global rol, ~150 sabit kontrol)
- [x] Rol/yetki tablosu onayı (Emre)
- [x] Faz 0 — Envanter: 149 dosya / 399 satır → `docs/roles/INVENTORY.md` (2026-10-22 20:02)
- [x] Faz 1 — Çekirdek: şema + `lib/roleCatalog.ts` + `lib/permissions.ts` + `roles.ts` + davet akışı + test (2026-10-22 20:10; tsc 0/0, vitest 313/3543)
- [x] Faz 2 — Backend dönüşümü: W-A 20 dosya, W-B 46 dosya, W-C 19 dosya (2026-10-22 ~20:18)
- [x] Faz 3 — Frontend: W-F1 (Ayarlar › Roller, üye rol seçimi, davet 5 rol, sekme/menü) + W-F2 (69 dosya sayfa görünürlüğü)
- [x] Koordinatör kapısı: tsc 0/0, eslint 0, vitest 320/3618, node-leak temiz; eski rol grep'i yalnız SAHİPLİ dosyalar + validator
- [x] Faz 4a — Denetim: `docs/roles/AUDIT.md` 0K/1Y/2O/3D (2026-10-22 20:35)
- [x] Faz 4b — FIX-1 (Codex, ctx_7914fa0a160b): Y-1/O-1/O-2/D-1/D-2/D-3 kapandı, rapor `report-fix1.md` (2026-10-22 20:45)
- [x] Mini dalga — accessRules.ts, cardReadings.ts (canSeePayInProject), lib/accessRuleRead.ts, employees bileşenleri `can()`
- [x] Temizlik — adminMutation/adminQuery/requireAdmin/isManager/canSeePay/capabilities() + legacyMirrorRole silindi
- [x] Koordinatör kapısı (20:47): tsc 0/0, eslint 0 hata, vitest 322/323 dosya (tek düşen w5aFix2 yük timeout'u, tek başına geçti), node-leak temiz, 2 grep 0
- [x] Faz 4c — FIX-1 diff denetimi (Claude opus, ctx_4fafef1e3ea0): `docs/roles/AUDIT-FIX1.md` 0K/0Y/1O/3D (2026-10-22 20:53)
- [x] FIX-2 (koordinatör): F1-O1 super_admin hedefte son-yönetici kontrolü atlanır (`users.ts removesLastProjectAdmin`), F1-D2 `syncMembershipRoles` setRoleByEmail'de de, F1-D1 taşımada kaynak pay.view, F1-D3 ayırt edici kart + ücret testi; 5/5 geri alınınca kırmızı. Kapı 20:58: tsc 0/0, eslint 0, vitest 323/3639, leak temiz, grep 0
- [x] FIX-2 Codex salt-okuma denetimi (ctx_bb8cb59ce2c8): `docs/roles/REVIEW-FIX2.md` 1 Orta (F2-O1 terfi→düşürme zinciri) → koordinatör düzeltti: son müşteri yöneticisi super_admin'e terfi ettirilemez (`syncMembershipRoles`), test geri alınınca kırmızı. Kapı 21:05: tsc 0/0, eslint 0, vitest 3639/3640 (tek düşen w5aFix2 yük timeout'u — roller öncesi de flake, 14:44/16:37 loglarında var)
- [x] Commit `ce09baf0` (CEO ngsaccess-d6, 2026-10-22 ~21:10; 262 dosya; temiz kapı git archive: tsc 0/0, eslint 0, vitest 323/3637, build OK, leak temiz). Push/yayın YOK
- [x] Faz 5 — Yayın (CEO ngsaccess-41): CANLI = origin = `343037a1` (ce09baf0 dahil); Convex 21:17:26 → `roles:backfillMemberRoles` updated 4 (2. koşum 0) → web 21:17:58
- [x] Tarayıcı doğrulaması (canlı, salt okuma, 2026-10-22 ~21:25): Roller tablosu 13×5 = onaylı varsayılanlar birebir, Yönetici kilitli, admin.manage diğer rollerde kapalı; Kullanıcılar ve davetler: süper admin satırı kilitli, davet 5 rol + zorunlu proje (Vazgeç); Admin › Düzenle: yalnız Süper Admin/Normal (Vazgeç); 3 müşteri kullanıcısı Yönetici
- [ ] UX düzeltmesi (yayın bekliyor): 1231 px ekranda Görüntüleyici sütunu yatay kaydırmada kalıyordu, sağa kayınca yetki adı kayboluyordu → `RolesSettings.tsx` yetki sütunu sticky + buton metni sarılır; localhost'ta 5 sütun sığdı (702/702). Yalnız web.

## Roller (proje bazında, `userProjects.role`)
| Anahtar | Etiket | Not |
|---|---|---|
| `admin` | Yönetici | Kilitli: yetkileri değişmez, hep 13/13 |
| `hr` | İK/PDKS | |
| `security` | Güvenlik | |
| `technician` | Teknik | |
| `viewer` | Görüntüleyici | Eski `project_user` buraya düşer |

`super_admin` (NGS platform) `users.role`'de kalır; her projede her yetki. Proje rolü değildir.

## Yetkiler ve varsayılanlar
| Anahtar | Etiket | admin | hr | security | technician | viewer |
|---|---|---|---|---|---|---|
| `employees.view` | Personeli görüntüleme | ✓ | ✓ | ✓ | ✓ | ✓ |
| `employees.manage` | Personel ekleme/düzenleme (departman/pozisyon dahil) | ✓ | ✓ | | | |
| `biometrics.manage` | Biyometrik kayıt (yüz/parmak izi) | ✓ | ✓ | | | |
| `pay.view` | Ücret bilgisini görme | ✓ | ✓ | | | |
| `schedule.manage` | Vardiya, tatil ve PDKS kuralları | ✓ | ✓ | | | |
| `attendance.approve` | İzin onayı, PDKS düzeltme | ✓ | ✓ | | | |
| `reports.view` | Raporlar (dışa aktarım dahil) | ✓ | ✓ | ✓ | | ✓ |
| `visitors.manage` | Ziyaretçi yönetimi | ✓ | | ✓ | | |
| `doors.open` | Uzaktan kapı açma | ✓ | | ✓ | ✓ | ✓ |
| `alarms.ack` | Alarm onaylama | ✓ | | ✓ | ✓ | |
| `devices.manage` | Cihaz, kapı, okuyucu, bölge yönetimi (cihaz sırları dahil) | ✓ | | | ✓ | |
| `accessRules.manage` | Erişim kuralları + şablonlar | ✓ | | | ✓ | |
| `admin.manage` | Kullanıcılar, roller, ayarlar, denetim kaydı | ✓ | | | | |

Kurallar:
- `admin.manage` yalnız `admin`'de; başka role verilemez (kendini yükseltme açığı yok).
- `admin` rolü düzenlenemez. Diğer 4 rolün kutucukları proje yöneticisince değişir; varsayılana eşitse kayıt silinir.
- Listede olmayan görüntüleme (cihaz listesi, PDKS kayıtları, canlı izleme, vardiya/izin görüntüleme, alarm listesi) projenin her üyesine açık kalır (bugünkü davranış). Ücret alanları `pay.view` yoksa `null`.
- Projesiz (orphan) kayda yalnız `super_admin` erişir (değişmez).
- Her projede en az bir `admin` kalmalı (son yöneticiyi düşürme/silme engeli).

## Veri modeli
- `userProjects.role?: "admin"|"hr"|"security"|"technician"|"viewer"` — yoksa `users.role`'den türetilir: `project_admin`→`admin`, diğer→`viewer`.
- `projectRolePermissions { projectId, role (admin hariç), permissions: Permission[], updatedAt, updatedBy }` index `by_projectId_and_role`. Satır yoksa varsayılan.
- `invites.role` genişler: eski 2 literal + 5 yeni anahtar (eski davetler türetme ile çözülür).
- `users.role` yalnız `super_admin` için anlamlı. Non-super değerleri GÜNCELLENMEZ (rol değişimi/davet kabulünde dokunulmaz): ayna tutulursa B projesindeki terfi, A projesinde eski kontrolle yönetici yetkisi verirdi. Yeni kurulum hesabına yalnız davet rolünün eski karşılığı yazılır.
- Her `userProjects` insert'i `role`'ü AÇIKÇA yazar (türetme yalnız eski satırlar için).
- Davet: `invites.create` yetkisi `admin.manage` (proje sahipliği tek başına yetmez — eski owner bypass kalktı).

## Çekirdek API (`convex/lib/permissions.ts`)
- `PROJECT_ROLES`, `PERMISSIONS`, `ROLE_DEFAULTS`, `projectRoleValidator`, `permissionValidator`
- `isSuperAdmin(user)`
- `getProjectRole(ctx, user, projectId)` → rol | null (üye değil)
- `getEffectivePermissions(ctx, projectId, role)` → `ReadonlySet<Permission>`
- `hasPermission(ctx, user, projectId | undefined, perm)` → boolean (super_admin true; orphan false)
- `requirePermission(ctx, user, projectId | undefined, perm, message?)` → throw `"Bu işlem için yetkiniz yok"` (ya da mevcut mesaj)
- `getProjectIdsWithPermission(ctx, user, perm)` → liste sorguları için
- Action'lar: `await ctx.runQuery(internal.roles.checkPermission, { userId, projectId, permission })` → boolean; false ise action throw eder
- `countProjectAdmins(ctx, projectId, excludeUserId?)` — son yönetici engeli
- Public API (`convex/roles.ts`): `myPermissions`, `listProjectRoles`, `setRolePermissions`, `listProjectMembers`, `setMemberRole`; internal: `checkPermission`, `backfillMemberRoles`
- Paylaşılan katalog (frontend de içe aktarır): `convex/lib/roleCatalog.ts` — `ROLE_LABELS`, `PERMISSION_LABELS`, `ROLE_DEFAULTS`, `inviteRoleValidator`

## Geçiş (canlı 2026-10-22: 4 kullanıcı = 1 super_admin + 3 project_admin, 4 üyelik, çok projeli yok)
Türetme sayesinde backfill olmadan da doğru; `roles.backfillMemberRoles` 3 üyeliği `admin` yazar.

## Envanter kararları (koordinatör, 2026-10-22)
1. `users.updateRole/deleteUser` platform işlemi → `super_admin` kalır. Proje rolü/üyelik → `roles.setMemberRole` (`admin.manage`).
2. `projects.remove/getDeletionImpact` → `super_admin` VEYA `admin.manage`; owner ayrıcalığı kalkar (owner zaten admin).
3. İşten ayrılma nedeni / SGK çıkış kodu (liste/detay okuması) → `employees.manage` yoksa `null` (ücret gibi maskele).
4. Biyometrik rıza/şablon → `biometrics.manage`; fotoğraf rızası → `employees.manage`; gizlilik/modül ayarı → `admin.manage`.
5. Senkron uyarısı kapatma (`hikvisionSync/ideSync.dismiss*`) → `devices.manage`; çözümsüz personel silme istisnası → `super_admin`.
6. `accessGrantStatus` okuma + yeniden dağıtım → `accessRules.manage`; tüm proje cihaz senkronu (`deviceSyncRuns`) → `devices.manage`.
7. Alarm e-posta ayarı/testi, ziyaretçi KVKK metni → `admin.manage`.
8. Zamanlanmış rapor → `reports.view`; ücretli içerik gönderim anında güncel `pay.view` ile maskelenir; cron alıcının GÜNCEL yetkisini yeniden denetler.
9. `onboarding.ensureProjectForNewUser` bootstrap istisnası (`üye`); yeni projenin ilk üyeliği `role: "admin"` ile aynı mutation'da yazılır.
10. Ayarlar sekmeleri: genel/kullanıcılar/roller/gizlilik/bildirim → `admin.manage`; PDKS/çalışma-bordro → `schedule.manage`; entegrasyon → `devices.manage`; rapor ayarı → `reports.view`; platform posta → `super_admin`.
11. `files.generateUploadUrl/claimUpload` → `üye` (bağlama noktası amaç yetkisini ister); `pingHikGateway` → bugünkü kapı super_admin ise öyle kalır, değilse `devices.manage`.

## Dönüşüm dalgası (Faz 2-3, paralel; dosya sahipliği ayrık)
- W-A cihaz/erişim · W-B personel/PDKS · W-C yönetim · W-F frontend. Spec'ler `.claude/orca-specs/roles-*.md`.
- SAHİPLİ (başka oturum, commit'siz): `convex/accessRules.ts`, `convex/cardReadings.ts`, `convex/lib/accessRuleRead.ts`, `src/components/employees/{EmployeeDetails,EmployeeForm,EmployeeSyncConfirmDialog(.test),hooks/useEmployeeFormData}.tsx/ts` → sahip commit'leyince ayrı mini dalga.
- `adminMutation/adminQuery/requireAdmin/isManager` SİLİNMEZ (paralel worker'lar kullanıyor); hepsi bitince son temizlik adımında kaldırılır.
