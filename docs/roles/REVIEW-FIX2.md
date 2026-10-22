# Roller FIX-2 denetimi — 2026-10-22

**Sonuç:** FIX-2, F1-O1, F1-D1, F1-D2 ve F1-D3'ün tarif edilen senaryolarını kapatıyor; ortak yardımcı ve ücret taşıma kontrolünde doğrudan bir gerileme görmedim. Ancak son müşteri yöneticisini önce platform yöneticisine terfi ettirip sonra düşürme/silme zinciri açık: bu nedenle PLAN'daki yönetici sürekliliğinin bütün yollarda korunduğu sonucuna varılamaz.

## Bulgular

### Orta — F2-O1: Terfi → düşürme/silme zinciri son müşteri yöneticisi korumasını aşıyor

- Konum: `convex/users.ts:123` (terfide süreklilik denetimi yok), `convex/users.ts:62` (super_admin hedef muaf), `convex/users.ts:72` (düşürmede üyelik viewer olur), `convex/lib/permissions.ts:134` (super_admin sayılmaz).
- Senaryo: P'nin tek etkin müşteri yöneticisi A, bağımsız etkin platform yöneticisi S olsun. S önce `updateRole({userId: A, role: "super_admin"})`, sonra `updateRole({userId: A, role: "project_user"})` çağırır. İlk çağrı üyeliği admin bırakır ama A'yı müşteri yöneticisi sayımından çıkarır; ikinci çağrı muafiyet sayesinde üyeliği viewer yapar. İkinci adım yerine `deleteUser(A)` veya `updateRole({userId: A, role: "super_admin", projectIds: []})` da geçer. S mevcut olduğundan son platform yöneticisi ve kendi hesabını değiştirme kontrolleri bu zinciri engellemez.
- Ayrım: İlk adımda müşteri yöneticisi sayısının sıfıra düşmesi FIX-2'den önce de mümkündü; FIX-2, bu durumdaki A'nın ardından silinmesini/viewer yapılmasını da mümkün kılıyor. Bu bir düşük yetkili kullanıcının yetki yükseltmesi değildir; yetkili platform işlemindeki süreklilik kuralının eksikliğidir. Kod yollarından doğrulandı; zincir için yeni test çalıştırılmadı.
- Öneri: Mevcut müşteri yöneticisini super_admin'e terfi ettiren public `updateRole` yolunda, her admin üyeliği için başka etkin müşteri yöneticisi isteyin; internal `setRoleByEmail` için aynı kuralı veya açık bootstrap istisnasını tanımlayın. Böylece baştan müşteri yöneticisi bulunmayan projelerde platform personelini çıkarma düzeltmesi korunur. Terfi → düşürme/silme zincirine regresyon testi ekleyin.

Kritik/Yüksek/Düşük seviyede ek bulgu yok.

## Dört soruya cevap

1. **super_admin muafiyeti:** Doğrudan non-super son yöneticiyi çıkarma/silme hâlâ reddedilir (`users.ts:113,244,327`); `roles.setMemberRole` da son yönetici kontrolünü korur ve super_admin hedefi reddeder (`roles.ts:192,198`). Ancak iki çağrılı terfi zinciri açıktır (F2-O1); mevcut kaynakta `roles.removeMember` veya başka `removeMember` export'u yoktur, üyelik çıkarma `users.updateRole(projectIds)` üzerinden yapılır.
2. **Üyelik senkronu:** Terfide her iki uç da yalnız rolsüz eski satırları eski etkin rolle sabitler; açık roller korunur. Düşürmede tutulan bütün eski satırlar, açık admin dahil, yeni rolün karşılığına yazılır; `projectIds` ile silinenler `users.ts:121` filtresiyle atlanır ve yeni eklenenler `users.ts:118` satırında doğru rolle oluşturulur. `setRoleByEmail` içindeki düşürme davranışı amaçlı olarak düzelmiştir.
3. **Ücret taşıma:** `employees.ts:268` kaynakta kayıtlı sıfır dahil her sayısal ücreti kapsar; null/undefined ücret taşımayı engellemez, ücret payload'u gönderilirse mevcut ayrı kapı devrededir. Aynı projeyi tekrar göndermek yeni ücret görünürlüğü yaratmadığından ek kontrolü atlaması doğrudur; orphan kayıtta önceki `employees.manage` kontrolü non-super kullanıcıyı reddeder, super_admin kaynak `pay.view` kontrolünü de geçer. Tarif edilen okuma yan yolu kapanmıştır.
4. **Test değişiklikleri:** Amaçlıdır; O-1 beklentisinin tersine çevrilmesi F1-O1 gereğidir ve ayrı son müşteri yöneticisi ret testi korunmuştur. `accountAccess` fixture'ının kaldırılması platform yöneticisi yarış testini güçlendirir; bayat kart önkoşulu dış izin kapısını iç güncellemeden ayırır (`cardReadings.ts:297,306`), ücret detay testi yetkili için 0/yetkisiz için null ayrımını doğrular. Gevşetme yok; F2-O1 zinciri kapsam dışı kalmıştır.

## Doğrulama ve kapsam

- `/tmp/roles-fix2.patch`, `PLAN.md`, `AUDIT-FIX1.md` ve çalışma ağacındaki ilgili handler'lar karşılaştırıldı.
- `vitest run convex/roles.fix1.test.ts convex/accountAccess.test.ts convex/roles.test.ts convex/users.test.ts convex/orphanGuards.test.ts`: **5 dosya / 224 test geçti**.
- `vitest run convex/roles.admin.test.ts convex/payVisibility.handlers.test.ts convex/users.settings.test.ts`: **3 dosya / 44 test geçti**.
- Toplam **8 dosya / 268 test geçti**. Ek senaryoların değerlendirmesi statik incelemedir; kaynak/test dosyası değiştirilmedi, yalnız bu rapor yazıldı. Codegen, deploy, canlı DB işlemi ve commit yapılmadı.
