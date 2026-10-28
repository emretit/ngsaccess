# FAZ 0-B — Yan kapı yetkileri (X-01 mobil hesap devralma, Y-02, P-02, R-01)

ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-ortak.md` OKU; kurallar bağlayıcı. Rapor: `/tmp/fix-f0-b-yankapi-rapor.md`.
Kaynak: `docs/sistem-audit-2026-10-25/DOGRULAMA.md` (X-01, Y-02, P-02 satırları) + `ILISKILER.md` (R-01).

## Ownership (yalnız bunlar)
`convex/actions/sendEmail.ts`, `convex/employeeAuth.ts`, `src/components/employees/EmployeePasswordResetDialog.tsx`,
`src/components/employees/hooks/useEmployeeFormSubmit.ts` (YALNIZ sendSetupEmail çağrı argümanları),
`convex/privacyRetention.ts`, `convex/files.ts`, `convex/leaves.ts`, `src/components/shifts/calendar/useShiftCalendarData.ts`
(+ `listForRange` dönüş tipini kullanan diğer `src` dosyaları gerekiyorsa — önce `ask`), `convex/lib/reportScope.ts`,
yeni test `convex/fixF0SideDoors.test.ts`, ilgili mevcut testlerin beklenti güncellemesi.
DOKUNMA: `convex/employees.ts`, `src/components/employees/EmployeeFormFields.tsx` (başka worker).

## Değişiklikler
1. **X-01 (P0)** — `sendEmployeeSetupEmail`:
   - Argümanlar yalnız `{ employeeId }`. E-posta, ad, soyad, projectId **çalışan kaydından** alınır (istemci verisi kullanılmaz).
   - Yetki: çalışanın projesinde `employees.manage` (yeni internal query ile, ör. `employeeAuth.getSetupEmailTarget({ employeeId, userId })`
     — `requirePermission` kullan). Ziyaretçi, e-postasız veya pasif/işten ayrılmış çalışan için anlaşılır Türkçe hata.
   - `employeeAuth.email` ve `projectId` her zaman çalışan kaydından yazılır.
   - Audit kaydı (mevcut `writeAudit` deseni): kim, hangi çalışan, hangi e-postaya (maskeli).
   - Basit kötüye kullanım sınırı: aynı çalışan için son 60 sn içinde token üretildiyse reddet (mevcut `convex/lib/rateLimit.ts` uygunsa onu kullan).
   - İki web çağıranı yalnız `{ employeeId }` göndersin.
2. **Y-02** — `privacyRetention.getAssistantContext`: projede `reports.view` iste; kişi adları için ayrıca `employees.view` yoksa adları maskele.
   `files.getUploadUrl` çalışan fotoğrafı yolunda `employees.manage` iste (yükleme bir yazmadır).
3. **P-02** — `leaves.listForRange`: dar DTO dön (id, employeeId, tarih aralığı, tür, durum, yarım gün bilgisi varsa) — `notes`/`decisionNote`
   yalnız `listPage`'deki aynı izin yönetme yetkisi varsa. Açık `returns` validator ekle. Çağıran takvimin tipini güncelle.
4. **R-01** — `lib/reportScope.ts` `resolveScheduleScope`/`selectScheduleProjectIds`: `accessBlockReason(user, Date.now()) !== null`
   (dondurulmuş/süresi bitmiş hesap) ise `null` dön → rapor maili gitmez.

## Kabul
- Testler: (a) viewer/security/technician `sendEmployeeSetupEmail` çağıramaz; (b) hr çağırır ve token **kayıttaki** e-postaya gider,
  `employeeAuth.email` kayıttaki e-posta olur; (c) 60 sn içinde ikinci istek reddedilir; (d) employees.view'siz üye asistan bağlamında ad göremez,
  reports.view'siz bağlam alamaz; (e) leaves.manage'siz üye `listForRange`'de not alanlarını görmez; (f) dondurulmuş ve süresi bitmiş hesap için
  `resolveScheduleScope` null.
- Mevcut `convex/employeeAuth*.test.ts`, `convex/users.settings.test.ts`, `convex/reports*.test.ts`, `convex/privacyRetention*.test.ts`,
  `convex/files.test.ts`, ilgili `src` testleri yeşil.
