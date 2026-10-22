# Roller W-B — personel / biyometri / ücret / vardiya / izin / PDKS / rapor / ziyaretçi dönüşümü (backend)

## Hedef
Aşağıdaki dosyalardaki her rol kontrolü INVENTORY.md'deki anahtara (`employees.view`, `employees.manage`, `biometrics.manage`, `pay.view`, `schedule.manage`, `attendance.approve`, `reports.view`, `visitors.manage`; karar 3-4-8) çevrilir; rol kontrolü OLMAYAN yazmalar (ör. `shifts.ts`, `departments.ts` authedMutation) da anahtara bağlanır. Bu dosyalarda `adminMutation|adminQuery|requireAdmin|isManager|project_admin|project_user` kalmaz.

## Ownership (yalnız bunlar + yeni test dosyası)
convex/actions/hikFingerprint.ts · convex/attendanceCorrections.ts · convex/biometricDestruction.ts · convex/dashboard.ts · convex/departments.ts · convex/employeeBiometrics.ts · convex/employeeConsents.ts · convex/employeeImport.ts · convex/employeeTermination.ts · convex/employees.ts · convex/fingerprintEnrollment.ts · convex/holidays.ts · convex/leaveRequests.ts · convex/leaves.ts · convex/lib/leaveRules.ts · convex/lib/payVisibility.ts · convex/lib/pdksPayrollQuery.ts · convex/lib/pdksTableQuery.ts · convex/lib/reportScope.ts · convex/pdksRecords.ts · convex/pdksRules.ts · convex/positions.ts · convex/privacyBiometric.ts · convex/reports.ts · convex/sgkExport.ts · convex/shifts.ts · convex/visitors.ts · bu dosyaların mevcut `*.test.ts` dosyaları (yalnız amaçlı davranış değişikliği için) · YENİ `convex/roles.people.test.ts`

## Notlar
- Ücret gizleme (`lib/payVisibility.ts`, 8f38414: project_user → null) → `pay.view` yoksa null; projeye göre (satırın projesi).
- Personel listesi/detayı okuma → `employees.view` (yoksa boş liste / "yetkiniz yok"); işten ayrılma nedeni + SGK çıkış kodu `employees.manage` yoksa null (karar 3).
- Departman/pozisyon yazma → `employees.manage`. Vardiya/vardiya ataması/tatil/PDKS kuralı/mesai oranı → `schedule.manage`. İzin onayı/red + PDKS düzeltme onayı + manuel PDKS kaydı → `attendance.approve`. Rapor/dışa aktarım/SGK → `reports.view` (+ ücret kolonları `pay.view`). Zamanlanmış rapor gönderimi alıcının GÜNCEL yetkisini yeniden denetler (karar 8).
- Biyometrik kayıt/silme/rıza/imha → `biometrics.manage`; fotoğraf rızası → `employees.manage`; gizlilik/modül ayarı → `admin.manage` (karar 4).
- Mobil çalışan oturumu (`employeeAuthedQuery/Mutation`) bu işin DIŞI; dokunma.
- SAHİPLİ `convex/cardReadings.ts`'e DOKUNMA.

## Kapı vitest
`node_modules/.bin/vitest run convex/roles.people.test.ts convex/roles.test.ts convex/payVisibility*.test.ts convex/employee*.test.ts convex/shifts*.test.ts convex/leave*.test.ts convex/attendanceCorrections*.test.ts convex/pdks*.test.ts convex/reports*.test.ts convex/visitors*.test.ts convex/fingerprint*.test.ts convex/privacy*.test.ts` (eşleşmeyeni atla) + son olarak tam `node_modules/.bin/vitest run convex` (yalnız SENİN dosyalarına ait kırmızı olmamalı)

## Kabul grep'i
`grep -nE "adminMutation|adminQuery|requireAdmin|isManager\(|project_admin|project_user" <ownership dosyaları (test hariç)>` → 0 satır

Rapor yolu: `docs/roles/report-wb.md`
