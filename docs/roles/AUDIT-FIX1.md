# Roller FIX-1 denetimi (2026-10-22, salt okuma)

**Sonuç:** FIX-1, önceki 6 bulgunun 6'sını da public uçlarda kapatıyor. Eski kapılar silinirken hiçbir uç gevşemedi. Yeni bir **Orta** bulgu var: O-2 düzeltmesi, müşteri yöneticisi olmayan projede super_admin'in platformdan çıkarılmasını kilitliyor. Tek açık yol "project_admin'e düşür", o da kişiyi her projede Yönetici bırakıyor (O-1'in aynısı). Bunun dışında 2 Düşük bulgu ve 1 test boşluğu var.

Denetçi: Claude (kodu Codex yazdı). Kaynak değiştirilmedi. Kanıt testleri `/tmp/rolesaudit-fix1/repo/convex/zzFix1Audit.test.ts` dosyasında: 4/4 geçti, yani bulgular kanıtlı. FIX-1'in kendi testleri de aynı kopyada koşuldu (`roles.fix1`, `roles`, `accountAccess`, `invites`, `UserFormDialog.roles`, `useEmployeeFormSubmit.roles`, `EmployeeFormFields`): 7 dosya / 129 test yeşil.

| Önem | Sayı |
|---|---|
| Kritik | 0 |
| Yüksek | 0 |
| Orta | 1 |
| Düşük | 3 (biri test boşluğu) |

## Bulgular

### Orta

**F1-O1: super_admin'i platformdan çıkarmak, müşteri yöneticisi olmayan projede kilitleniyor; tek açık yol O-1'i geri getiriyor**
- Kök neden: [convex/lib/permissions.ts:123](../../convex/lib/permissions.ts) `hasOtherActiveAdmin` artık super_admin üyeleri saymıyor. Buna rağmen [convex/users.ts:90](../../convex/users.ts), [:103](../../convex/users.ts), [:232](../../convex/users.ts) ve [:315](../../convex/users.ts) bu kontrolü super_admin olan hedefe de uyguluyor. Bunun yanında [convex/projects.ts:76](../../convex/projects.ts) (`projects.create`, yalnız super_admin çağırabilir) her yeni projede oluşturan kişiyi `admin` olarak ekliyor. Yani müşteri yöneticisi daveti kabul edene kadar her proje bu durumda.
- Senaryo (kanıtlı, AUDIT-A/A2): NGS çalışanı S (super_admin) projeyi P'yi açar. Müşterinin yöneticisi henüz daveti kabul etmemiştir, ya da hesabı dondurulmuş veya süresi dolmuştur. S işten ayrılır ve diğer super_admin S'yi platformdan çıkarmak ister:
  - `updateRole(S, "project_user")` → "Projenin son yöneticisi kaldırılamaz"
  - aynı çağrı `projectIds: []` ile (projeden çıkarma) → reddedilir
  - `deleteUser(S)` → reddedilir
  - Kalan tek yol `updateRole(S, "project_admin")`: başarılı olur, ama S'nin bütün üyelikleri `admin` olarak yazılır. `myPermissions(P)` → `admin`, 13/13 yetki.
- Bu bir gerilemedir. Önceki kodda düşürme kontrol edilmiyordu, çıkarma kontrolü de diğer super_admin'leri sayıyordu. Artık P'de iki super_admin olsa bile biri çıkarılamıyor.
- Önerilen düzeltme: super_admin üyeliği yönetici sayısına hiç girmediği için, onu kaldırmak müşteri tarafındaki yönetici sayısını azaltamaz. Bu yüzden `target.role === "super_admin"` olduğunda dört yerde de son-yönetici kontrolü atlanmalı. Kontrol yalnız super_admin olmayan hedefte kalmalı (`setMemberRole` super_admin hedefini zaten reddediyor). Ek olarak, `accountAccess.test.ts:303`'e eklenen "müşteri yöneticisi" fixture'ı bu kilidi gizliyor; yeni testte fixture olmadan da geçmeli.

### Düşük

**F1-D1: Proje taşıma, kaynak projede `pay.view` yetkisi olmayan kişiye ücreti gösteriyor**
- [convex/employees.ts:263-267](../../convex/employees.ts): taşıma isteğinde ücret alanı yoksa yalnız `employees.manage` kontrol ediliyor.
- Senaryo (kanıtlı, AUDIT-B): İK kullanıcısı A ve B projelerinin üyesidir. A'da `pay.view` yetkisi kaldırılmış, B'de varsayılan olarak durur. `getById` A'daki personelin maaşını `null` gösterir. İK `employees.update({employeeId, projectId: B})` çağırır, istek başarılı olur. Ardından `getById` → `monthlySalary: 50000` döner. Kişi isterse personeli geri de taşıyabilir.
- Önerilen düzeltme: `updates.projectId` geldiğinde ve kayıtta `hourlyRate` veya `monthlySalary` doluysa kaynak projede de `pay.view` iste. Alternatif: yetkisiz taşımada ücret alanlarını temizle.

**F1-D2: İç (internal) `users.setRoleByEmail` düşürme yolunda O-1 düzeltmesi yok**
- [convex/users.ts:246](../../convex/users.ts): super_admin düşürülürken yalnız rolü boş üyelikleri, eski rolden türetilen değerle (`admin`) yazıyor. Açıkça `admin` yazılmış üyelikler olduğu gibi kalıyor.
- Senaryo (kanıtlı, AUDIT-C): `npx convex run users:setRoleByEmail '{"email":"s@…","role":"project_user"}'` çalışır. Ardından `myPermissions(P)` → `admin`. Bu yol yalnız CLI/internal erişimle çağrılabildiği için önemi düşük.
- Önerilen düzeltme: `updateRole` içindeki düşürme döngüsünü ortak bir yardımcıya taşı ve burada da çağır. Ya da bu çağrıda super_admin düşürmeyi reddet.

**F1-D3 (test boşluğu): `assignCardFromReading` kanıt testi ayrım yapmıyor; `getEmployeeAttendanceDetail` ücret değişikliği testsiz**
- [convex/roles.fix1.test.ts:105](../../convex/roles.fix1.test.ts): yeni dış kontrol ([convex/cardReadings.ts:297](../../convex/cardReadings.ts)) kopyada silinince test yine yeşil kaldı. Sebep: içeride çağrılan `employees.update` zaten `employees.manage` istiyor. AUDIT.md'deki Y-1 iddiasının "kart atama" kısmı bu yüzden abartılıydı; dış kontrol sadece ikinci bir savunma katmanı.
- `cardReadings.ts:643` satırındaki `canSeePayInProject(employee.projectId)` doğru: proje, kayıttan okunuyor. Ama bu davranışı kilitleyen bir test yok.
- Önerilen düzeltme: kart atama testinde ret mesajını veya kodunu dış kontrole özgü yap (ya da iç çağrı başlamadan reddedildiğini ölç). Ayrıca `pay.view` olan ve olmayan iki kullanıcıyla `summary.overtimePayTRY` null / dolu durumunu sınayan bir test ekle.

## 6 sorunun cevabı

1. **Bulgular gerçekten kapandı mı?**
   - Evet: Y-1, O-2, D-2 ve D-3 kapandı. O-1 public uçta kapandı (internal yol F1-D2). D-1 yazma tarafında kapandı (okuma yan yolu F1-D1).
   - Kanıt testlerinin hepsi eski davranışta kırmızı olurdu. Tek istisna kart atama testi (F1-D3).
2. **Eski kapılar silinirken bir uç gevşedi mi?** Hayır.
   - Silinen kapılar yalnız mini dalga dosyalarında kullanılıyordu, başka dosya bunlara dayanmıyor.
   - 7 kural ucu ve kart atama, yetkiyi kaydın kendi projesiyle denetliyor. Kural projesi değiştirilemiyor (`assertAccessProjectUnchanged`).
   - Projesiz kayıtlara yalnız super_admin erişebiliyor.
   - `checkUserRole`'ü kullanan yer yok ve yetkisiz durumda reddediyor.
3. **O-1 düşürme tutarlı mı?**
   - Kısmi yazım yok: Convex mutation'ı hata alınca bütün değişiklikleri geri alıyor.
   - Yarış durumu güvenli: Convex işlemleri sıralı (serializable) çalıştırıyor.
   - Kişinin kendini düşürmesi `userProtectionError` ile engelli.
   - Bulgu: F1-O1 (son-yönetici kontrolü super_admin hedefine uygulanıyor).
4. **D-1 ücret kapısı tüm yazma yollarında mı?**
   - Ücreti yazan uçlar yalnız `employees.create` ve `employees.update`; `null` göndermek de kapıya takılıyor.
   - Proje taşımada hedef proje denetleniyor.
   - Toplu içe aktarma, ziyaretçi ve mobil kayıt uçları ücret alanı yazmıyor.
   - Bulgu: F1-D1 (taşıma ile okuma).
5. **Dondurulmuş/süresi dolmuş kullanıcı etkin yönetici sayılıyor mu?** Hayır.
   - Dondurulmuş (`disabledAt`) ve süresi dolmuş (`accessExpiresAt`) kullanıcılar ile super_admin'ler sayılmıyor.
   - Erken çıkış doğru çalışıyor.
   - `verified: false` ayrıca kontrol edilmiyor. Ama doğrulanmamış hesaba admin üyeliği yazan bir yol yok; risk teorik.
6. **Test assertion değişiklikleri amaçlı mı?** Evet, gevşetme yok.
   - `invites.test`, `capabilities.test` ve `payVisibility.test` değişiklikleri amaçlı.
   - Mock silmeleri yalnız artık var olmayan export'ları kaldırıyor.
   - `accessRuleDiff.test`'te kullanıcının super_admin yapılması bir işlem sözleşmesi testi; yetki testi değil.
   - Tek dikkat noktası: `accountAccess.test.ts:303` fixture'ı F1-O1'deki kilidi gizliyor.

## Notlar (bulgu sayılmadı)
- `hasOtherActiveAdmin` ve `backfillMemberRoles`, sınır koymadan tablo tarıyor (`for await`). Proje başına çok büyük üyelik sayısında Convex'in okuma limitine takılabilir; canlıda 4 üyelik var.
- `checkUserRole(super_admin, "project_admin")` önceden `true` dönüyordu, artık `false` dönüyor. Kullanan yer yok.
