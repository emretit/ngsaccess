# Roller DENETİM — proje bazlı yetki dönüşümünün güvenlik denetimi (SALT OKUMA)

## Hedef
`docs/roles/AUDIT.md`: roller dönüşümündeki gerçek açıklar, kanıtla (dosya:satır + somut senaryo), önem sırasıyla. Kod DEĞİŞTİRME.

## Bağlam
- Tasarım: `docs/roles/PLAN.md` (5 rol, 13 yetki, kararlar 1-11). Envanter: `docs/roles/INVENTORY.md`. Worker raporları: `docs/roles/report-{wa,wb,wc,wf1,wf2}.md`.
- Çekirdek: `convex/lib/roleCatalog.ts`, `convex/lib/permissions.ts`, `convex/roles.ts`, `convex/invites.ts`, `src/hooks/usePermissions.ts`.
- Diff: `git diff -- convex src` + yeni dosyalar (`git status --short`). Kodu Codex yazdı; sen öbür ailesin.
- KAPSAM DIŞI (başka oturumun commit'siz işi, rollerle ilgisiz): `convex/accessRules.ts`, `convex/cardReadings.ts`, `convex/lib/accessRuleRead.ts`, `convex/lib/processCardReadingCore.ts`, `convex/accessRuleMemberships.test.ts`, `convex/processCardReading.characterization.test.ts`, `src/components/employees/{EmployeeDetails,EmployeeForm,EmployeeSyncConfirmDialog}.tsx`, `src/components/employees/hooks/useEmployeeFormData.ts`. Bunları raporda yalnız "henüz dönüştürülmedi" diye listele.

## Kontrol listesi (her madde için: TEMİZ ya da bulgu)
1. **Yetki yükseltme**: admin.manage'siz biri kendine/başkasına admin.manage ya da admin rolü verebilir mi? (`setRolePermissions`, `setMemberRole`, `invites.create/consume`, `users.*`, `onboarding`, `projects.*`). B projesinin yöneticisi A projesinde etki yaratabilir mi (çapraz proje)? `users.role` yazan her yol.
2. **IDOR / yanlış proje**: her public query/mutation/action'da yetki, İŞLENEN KAYDIN projesiyle mi denetleniyor (arg `projectId` ile `doc.projectId` uyuşmazlığı, toplu işlemde her satır)? Projesiz (orphan) kayıt yalnız super_admin mi?
3. **Kapı unutulan uç**: `authedQuery/authedMutation/authedAction` olup veri yazan ya da hassas veri okuyan ve hiçbir `requirePermission/hasPermission/checkPermission/getProjectIdsWithPermission` çağırmayan public fonksiyonları tara (`convex/*.ts`, `convex/actions/*.ts`). Envanterde `üye` dediği yerler dışında her biri bulgu.
4. **Sır kapısı**: cihaz sırları (şifre/token/idePassword/MQTT) okuma ve yazma AYNI anahtar mı (`devices.manage`)? Okuyamayan boş görüp kaydedince silebilir mi?
5. **Ücret ve hassas alan**: `pay.view` yoksa ücret her yerde null mu (liste, detay, PDKS tablo/bordro, dışa aktarım, raporlar, zamanlanmış rapor e-postası, dashboard)? İşten ayrılma nedeni/SGK kodu `employees.manage` yoksa gizli mi? Zamanlanmış rapor alıcının GÜNCEL yetkisini denetliyor mu?
6. **Son yönetici**: rol düşürme, kullanıcı silme/dondurma, projeden çıkarma yolları projede etkin admin bırakmadan tamamlanabiliyor mu?
7. **Action'lar**: `internal.roles.checkPermission` doğru userId/projectId ile mi çağrılıyor; false'ta throw var mı; projectId kullanıcı girdisinden mi kayıttan mı?
8. **Frontend**: `RolesSettings` kilitli sütun gerçekten gönderilmiyor mu; görünür düğme ↔ sunucu kapısı uyumsuzluğu (sunucunun reddedeceği düğme görünür / izin verdiği gizli) — örnekleme: kapı açma, cihaz CRUD, personel CRUD, ücret kolonu, Ayarlar sekmeleri, Raporlar/Kişiler rota kapısı.
9. **Davranış regresyonu**: bugün `project_admin` olan kullanıcı (rolsüz üyelik → türetilen admin) her şeyi yapmaya devam ediyor mu? Rolsüz üyelik + super_admin kullanıcı?

## Kurallar
- Bulgu = somut senaryo (kim, hangi fonksiyon, hangi argüman, ne olur). Teorik "iyileştirme" önerilerini ayrı "Not" bölümüne koy, bulgu sayma.
- Gerekirse kanıt için geçici test yazıp koşabilirsin ama `/tmp/` altında kopya ile; repo dosyası DEĞİŞMEZ. Mevcut testleri koşmak serbest (`node_modules/.bin/vitest run <dosya>`).
- `npx convex` / deploy / DB / commit / push YOK.

## Rapor
`docs/roles/AUDIT.md`: önce özet (bulgu sayısı önem başına), sonra bulgular (Kritik/Yüksek/Orta/Düşük; her biri dosya:satır, senaryo, önerilen düzeltme tek satır), sonra kontrol listesi 1-9 durum tablosu. worker_done ≤10 satır: önem başına sayı + en kritik 3 bulgu tek satır.
