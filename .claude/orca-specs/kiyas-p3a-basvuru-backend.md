# P3a — İzin / PDKS düzeltme başvuru-onay: BACKEND

## Hedef
Çalışanın kendi izin talebini ve PDKS düzeltme talebini oluşturup geri çekebildiği; yöneticinin düzeltme taleplerini onay/redle işleyebildiği Convex katmanı. UI YOK (P3b ayrı dalga; mobil uygulama bu fonksiyonları sonra tüketecek, argüman adları sabit ve açık olsun). (Hik-Connect: Review → Leave / Attendance Correction.)

## ÖNEMLİ — çakışma
`convex/leaves.ts` ve `src/components/leaves/**` şu an BAŞKA bir worker'ın elinde (UI audit 10-H1). Bu dosyalara YAZMA, yalnız oku. İzin onay/red için mevcut `leaves.approve` / `leaves.reject` (adminMutation) AYNEN kalır; sen yeniden yazma.

## Hazır olanlar (Faz 0, schema'ya DOKUNMA)
- `leaves`: yeni opsiyonel `source: "admin" | "employee"` (status birliği DEĞİŞMEDİ: pending/approved/rejected). Geri çekme = bekleyen talebi SİL.
- `attendanceCorrections` tablosu: employeeId, projectId, date (YYYY-MM-DD TR günü), correctionType (checkIn|checkOut|both), requestedCheckIn/requestedCheckOut (HH:mm), reason, status (pending|approved|rejected|withdrawn), decidedBy, decidedAt, decisionNote; index `by_employee`, `by_project_status`, `by_employee_date`.
- Boş stub: `convex/leaveRequests.ts`, `convex/attendanceCorrections.ts`.

## Ownership (yalnız bunlara yaz)
`convex/leaveRequests.ts`, `convex/attendanceCorrections.ts`, `convex/lib/requestRules.ts` (yeni, saf kurallar: tarih penceresi, çakışma yardımcıları), testler: `convex/leaveRequests.test.ts`, `convex/attendanceCorrections.test.ts`, `convex/lib/requestRules.test.ts`.
**YAZMA:** leaves.ts, pdksRecords.ts (yalnız oku), schema, App.tsx, mobile/**.

## Önce oku
`convex/leaves.ts` (özellikle `create`, `assertNoLeaveOverlap`, `leaveDecisionPatch`, `getBalances`), `convex/pdksRecords.ts` (`upsertManual` mantığı), `convex/employeeCheckIn.ts` + `convex/employeeAuth.ts` (`employeeAuthedMutation/Query` deseni, oturumdan employeeId), `convex/auditLog.ts` (nasıl kayıt düşülüyor), `convex/employeeCheckIn.test.ts` (çalışan oturumlu test deseni).

## leaveRequests.ts
- `submit` — employeeAuthedMutation: `leaveType` (mevcut 10 tür birliği), `startDate`, `endDate` (YYYY-MM-DD), `notes?` (≤500). employeeId ve projectId OTURUMDAN (argümandan asla). Doğrulama: bitiş ≥ başlangıç; geçmiş tarih sınırı (≥ bugün−30 gün); en çok 60 günlük aralık; kendi `leaves` kayıtlarıyla çakışma (aynı mantığı `convex/lib/requestRules.ts` içinde yeniden yaz; leaves.ts'e dokunma). Ekle: `status: "pending"`, `source: "employee"`, createdAt/updatedAt.
- `withdraw` — employeeAuthedMutation: `leaveId`; yalnız KENDİ + `pending` + `source === "employee"` kaydı; siler. Diğer durumlar Türkçe hata.
- `listMine` — employeeAuthedQuery: kendi izinleri (son 12 ay), en yeni önce, `take(100)`.
- Yönetici tarafı değişmez: bekleyen talepler `leaves` listesinde `pending` görünür; onay `leaves.approve`.

## attendanceCorrections.ts
- `submit` — employeeAuthedMutation: `date` (bugün ve geriye ≤ 30 gün), `correctionType`, `requestedCheckIn?/requestedCheckOut?` (HH:mm; tipe göre zorunlu), `reason` (5–300 karakter). Aynı gün için `pending` kayıt varsa reddet. employeeId/projectId oturumdan.
- `withdraw` — employeeAuthedMutation: yalnız kendi + pending → `status: "withdrawn"`.
- `listMine` — employeeAuthedQuery: son 90 gün, `take(100)`.
- `listPending` — adminQuery, proje kapsamlı (`getProjectIdsForUser`), `paginationOpts`, `by_project_status` index, çalışan adını ekle (null-daraltmalı).
- `approve` — adminMutation: `id`, `note?`. Proje/çalışan kapsam kontrolü (leaves.approve'daki gibi), yalnız `pending`. `pdksRecords.upsertManual`'in yaptığı yazımı (tek kaynak) aynı kurallarla uygula: önce mantığı oku; handler gövdesi yeniden kullanılabiliyorsa onu çağır, değilse minimal ve aynı alanlarla kopyala — **kopya yaptıysan raporda açıkça söyle** (sonradan tekilleştirilecek). Sonra status approved + decidedBy/At/Note + `auditLog` kaydı.
- `reject` — adminMutation: `id`, `note` (zorunlu ≥3). Status rejected, audit.
- Tüm mutation'larda `auditLog` kaydı (çalışan eylemleri dahil; aktör türü çalışan olarak ayrışsın, mevcut auditActors desenine bak).

## Testler (convex-test)
- Çalışan yalnız KENDİ talebini görür/geri çeker; başka çalışanın id'siyle çağrı reddedilir; projeler arası sızma yok.
- leaveRequests: çakışma, tarih penceresi, 60 gün sınırı, onaylanmış talep geri çekilemez.
- corrections: aynı gün çift pending reddi, 30 gün penceresi, approve → pdksRecords yazımı + audit, reject notu zorunlu, project_user onaylayamaz, başka proje yöneticisi onaylayamaz.
- `requestRules` saf fonksiyonları.

## Kapsam dışı
Web arayüzü (P3b), mobil ekran, ek dosya yükleme, e-posta/push bildirimi, departman yöneticisi (supervisor) rolü, izin türü yönetimi, schema değişikliği, `leaves.ts` içinde herhangi bir değişiklik.
