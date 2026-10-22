# Roller FIX-1 denetimi (salt okuma)

## Hedef
`/tmp/roles-fix1-all.patch` (55 dosya, FIX-1 diff'i — Codex yazdı) yetkilendirme açısından denetlenir; her bulgu file:line + somut senaryo ile `docs/roles/AUDIT-FIX1.md`'ye yazılır.

## Bağlam (oku)
- `docs/roles/PLAN.md` (5 rol × 13 yetki, kurallar), `docs/roles/AUDIT.md` (önceki bulgular Y-1, O-1, O-2, D-1..D-3), `docs/roles/report-fix1.md` (worker'ın iddiaları).
- Patch tabanı: mini dalga dosyaları (accessRules.ts, cardReadings.ts, lib/accessRuleRead.ts, src/components/employees/{EmployeeDetails,EmployeeForm,EmployeeSyncConfirmDialog}.tsx, hooks/useEmployeeFormData.ts) için `git diff HEAD`; diğerleri `/tmp/rolesaudit/repo` kopyasına karşı. Gerektiğinde güncel dosyanın tamamını oku (`convex/`, `src/`).
- `convex/lib/permissions.ts` (requirePermission/hasPermission/hasOtherActiveAdmin), `convex/lib/roleCatalog.ts`, `convex/roles.ts`, `convex/users.ts`, `convex/invites.ts`.

## Sorular (her biri için: doğru / bulgu)
1. Y-1, O-1, O-2, D-1, D-2, D-3 gerçekten kapandı mı? Kanıt testleri (`convex/roles.fix1.test.ts`, `UserFormDialog.roles.test.tsx`, `useEmployeeFormSubmit.roles.test.tsx`, `EmployeeFormFields.test.tsx`) eski davranışta kırmızı olacak şeyi mi sınıyor?
2. Eski kapı silinirken (adminMutation/adminQuery/requireAdmin/isManager/canSeePay/capabilities) herhangi bir uç **gevşedi** mi? (ör. önce admin isteyen bir uç şimdi yalnız authed; yetki kaydın değil argümanın projesiyle kontrol ediliyor → IDOR (başka projenin kaydına erişim); projesiz kayıtta super_admin dışı erişim)
3. O-1: super_admin düşürmede üyelik yazımı + son-yönetici reddi tutarlı mı (kısmi yazım, yarış, kendi kendini düşürme)?
4. D-1: ücret alanı kapısı tüm yazma yollarında mı (create, update, proje taşıma, toplu içe aktarma, mobil/başka uçlar)? `null` gönderip ücreti silme yolu kapalı mı?
5. `hasOtherActiveAdmin` erken çıkışı + super_admin hariç sayım: dondurulmuş/pasif/süresi dolmuş kullanıcı "etkin yönetici" sayılıyor mu?
6. Test assertion değişiklikleri (report-fix1.md son madde) amaçlı mı, gevşetme var mı?

## Kapsam dışı
Patch dışındaki dosyalarda yeni bulgu avı yok (yalnız patch'in etkisini anlamak için oku). Stil/sadelik önerisi yok.

## Kısıtlar
Salt okuma: kaynak dosya DEĞİŞTİRME. Kanıt testi gerekiyorsa `/tmp/rolesaudit-fix1/` altına repo kopyası (`git archive HEAD` değil — çalışma ağacı lazım: `rsync -a --exclude node_modules /Users/emreaydin/ngsaccess/ /tmp/rolesaudit-fix1/repo/ && ln -s /Users/emreaydin/ngsaccess/node_modules /tmp/rolesaudit-fix1/repo/node_modules`) ve orada koş. `npx convex`/deploy/DB/commit/push YOK. Yalnız `docs/roles/AUDIT-FIX1.md` yazılır.

## Rapor
`docs/roles/AUDIT-FIX1.md`: önce 1-2 cümle sonuç, sonra Kritik/Yüksek/Orta/Düşük, her bulgu file:line + senaryo + önerilen düzeltme. 6 sorunun her birine tek satır cevap. worker_done ≤10 satır, Türkçe.
