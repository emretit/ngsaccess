# FAZ 0-A — Kişi ve ziyaretçi yetki tutarlılığı (K-01, K-02 geçici engel, K-03, K-06)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU; kurallar bağlayıcı. Rapor: `/tmp/fix-f0-a-kisi-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (K-01, K-02, K-03, K-06 satırları) + `M1-kisi-erisim.md`.

## Ownership (yalnız bunlar)
`convex/employees.ts`, `convex/visitors.ts`, `convex/employeeImport.ts`, `src/components/visitors/**`,
`src/components/employees/EmployeeFormFields.tsx` (+ yalnız proje/kural seçici için gereken küçük bileşen dosyaları `src/components/employees/form-sections/**` varsa),
yeni test `convex/fixF0People.test.ts`, mevcut ilgili testlerin beklenti güncellemesi.
DOKUNMA: `convex/lib/employeeCascade.ts`, `convex/actions/**`, `src/components/employees/hooks/useEmployeeFormSubmit.ts`,
`src/components/employees/EmployeePasswordResetDialog.tsx` (başka worker'ların).

## Değişiklikler
1. **K-01** — `employees.create/update` erişim kuralı üyeliği eklerken/değiştirirken (accessRuleId vb. → `upsertGroupMembership`)
   o projede `accessRules.manage` iste (`requirePermission`). Üyelik alanı gelmediyse yalnız `employees.manage` yeterli kalsın.
   Formda kural seçici `can("accessRules.manage")` yoksa gizli/pasif + kısa açıklama.
2. **K-02 (geçici engel)** — `employees.update`'te `projectId` mevcut kayıttan farklıysa reddet:
   `ConvexError({ code: "EMPLOYEE_PROJECT_MOVE_UNSUPPORTED", message: "Kişi başka projeye taşınamaz. Yeni projede yeni kayıt açın, eski kaydı işten çıkarın." })`.
   Formda düzenleme modunda proje seçici pasif + aynı açıklama. (Kalıcı taşıma akışı Faz 2'de.)
3. **K-03** — Genel kişi uçları ziyaretçiyi (`isVisitor === true`) işlemesin:
   - `employees.getById`: ziyaretçi kaydı için `visitors.manage` yoksa `null` dön; varsa da `visitors.getDetail` ile aynı maske (kart/TC) uygula.
     Önce `src`/`mobile` çağıranlarını kontrol et; ziyaretçi için getById kullanan ekran varsa `visitors.getDetail`'e taşı (ownership içindeyse).
   - `employees.update/remove/bulkDelete` ve `employeeImport` toplu kart atama: ziyaretçi kaydını reddet
     (`code: "VISITOR_USE_VISITOR_SCREEN"`, mesaj "Ziyaretçi kayıtları Ziyaretçiler ekranından yönetilir.").
4. **K-06** — `visitors.removeVisitor` (yeni public mutation): `visitors.manage` + kayıt gerçekten ziyaretçi + aynı proje; silme işi
   `employees.remove` ile AYNI zinciri kullansın (Hik snapshot, IDE silme, cascade). Bunun için `employees.ts` içinde ortak bir
   `removeEmployeeRecord(ctx, emp, actor)` yardımcısı çıkar; iki uç onu çağırsın (davranış birebir aynı kalmalı, mevcut testler yeşil).
   `VisitorSlideOverPanel.tsx` silme düğmesi bu yeni uca geçsin.

## Kabul
- Testler: (a) hr rolü (employees.manage var, accessRules.manage yok) kural üyeliği ekleyemez, diğer alanları güncelleyebilir;
  (b) proje değişimi reddedilir; (c) viewer `getById` ile ziyaretçinin kart/TC'sini göremez; (d) hr ziyaretçiyi update/remove edemez;
  (e) security `removeVisitor` ile ziyaretçiyi siler ve cihaz silme işleri planlanır; (f) `removeVisitor` çalışan kaydını reddeder.
- Mevcut `convex/roles.people.test.ts`, `convex/employees*.test.ts`, `convex/mobileVisitors.test.ts`, `convex/hikRevocation.test.ts` yeşil.
