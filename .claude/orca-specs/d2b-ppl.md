# Dalga 2b — PPL: Kişiler proje kapsamı + departman diyaloğu + Hikvision silme + yükleme sahipliği

**Hedef:** Kişiler/departman/vardiya/izin ekranları yalnız aktif projenin kayıtlarını gösterir ve sunucu kayıtlar arası ilişkileri aynı projede doğrular; departman ekleme yalnız başarıda kapanır; silinen personel Hikvision cihazlarından gerçekten silinir; bağlanmamış yüklenen fotoğrafa yalnız yükleyen erişir.

(Ortak kurallar aşağıda; modül raporu: `docs/ux-audit/03_KISILER_VARDIYA_IZIN.md`.)

## Bulgular
1. **PPL-02 (🔴)** — `employees.list` aktif proje filtresini uygulamıyor; departman/şirket/vardiya/izin seçenekleri tüm projelerden geliyor; başka projedeki ebeveyn departmana alt departman eklenebiliyor.
   - `employees.list` args: `projectId: v.optional(v.id("projects"))` EKLE → `resolveProjectScope`. Eski `projectIds` ve `isSuperAdmin` arg'larını bu dalgada **opsiyonel + yok sayılan (deprecated yorumu)** olarak BIRAK (başka worker'ın dosyası `useVisitorFormData.ts` hâlâ çağırıyor; koordinatör dalga sonunda kaldıracak). Super admin dalı istemci bayrağına değil `ctx.user.role`'a dayansın; projectId yoksa tüm izinli projeler.
   - Kendi çağıranların aktif `projectId` göndersin: `useEmployees.ts`, `Shifts.tsx`, `Leaves.tsx`, `EngineeringDepartmentView.tsx`, `useEmployeeFormData.ts` (şirket/departman seçenekleri de aynı kapsam), `useDepartments.ts`, `DepartmentTree.tsx`.
   - `departments.list` / `companies.list` / `shifts.list` / `leaves.list` arg değişikliği gerekiyorsa GERİYE UYUMLU olsun (yeni arg opsiyonel): PDKS dosyaları (`src/components/pdks/**`, `src/hooks/usePdks*.ts`) senin değil ve aynı fonksiyonları çağırıyor.
   - Backend ilişki doğrulaması (create/update): personel↔departman/şirket, departman↔ebeveyn departman, vardiya ataması personel↔vardiya, izin personel↔proje aynı projede olmalı; değilse Türkçe hata. Kuralı saf fonksiyona (`convex/lib/peopleScope.ts` gibi) çıkar + vitest.
   - Proje değişince açık form/seçim/filtre bağlamı güvenle sıfırlansın (eski projenin seçili kaydı kalmasın).
2. **PPL-17 (🟠)** — `AddDepartmentDialog.tsx`: AlertDialog yerine normal Dialog + form; boş ad Türkçe satır içi hata; `useAsyncAction` pending; yalnız başarıda kapat/sıfırla; hata sonrası metin korunur.
3. **Hikvision silme riski** — `convex/employees.ts` `removeEmployeeWithDependencies` (≈ satır 338): `deleteEmployeeFromDevicesInternal` employeeId ile scheduler'a gidiyor; action çalıştığında personel DB'den silinmiş olduğundan `getEmployeeWithDevices` null döner ve cihazdan silme yapılmaz. IDE yolu gibi çöz: mutation içinde (commit öncesi) hedef Hikvision cihazlarını ve kişi kimliğini (employeeNo/kart no — action'ın cihaz silmede ne kullandığına bak) snapshot'la, yeni/uyarlanmış internalAction'a açıkça geçir. Toplu silme (`bulkDelete`) de aynı yolu kullanmalı. Çözümleme mantığı saf fonksiyonsa test yaz. `convex/hikvisionSync.ts` başka worker'ın; oradaki `getEmployeeWithDevices`'ı DEĞİŞTİRME (okuyup aynı mantığı kendi helper'ında kullanabilirsin).
4. **Yükleme sahipliği (`convex/files.ts`)** — `getUploadUrl` 1001 personeli tarıyor + "10 dk bağlanmamış dosya" istisnası var. Yeni sözleşme:
   - `employees.by_photo_storage` index'iyle bağlı personeli bul (tarama yok).
   - Yeni `claimUpload({ storageId })` authedMutation: `pendingUploads`'a {storageId, userId: ctx.user._id, createdAt} ekler; aynı storageId zaten başka kullanıcıdaysa hata, aynı kullanıcıdaysa idempotent.
   - `getUploadUrl`: bağlı personel varsa proje erişimi; yoksa yalnız `pendingUploads` sahibi erişir (10 dk istisnası KALKAR).
   - `saveEmployeePhoto`: storageId başka kullanıcının pending kaydıysa reddet; bağlayınca pending kaydı sil. Eski fotoğrafın storage temizliği mevcut davranışı korusun.
   - `usePhotoUpload.ts`: yükleme sonrası `claimUpload` çağır. Saf karar mantığını test et.

## Ownership (yalnız bunlara yaz)
convex/employees.ts · convex/departments.ts · convex/companies.ts · convex/shifts.ts · convex/leaves.ts · convex/files.ts · convex/actions/hikvisionSync.ts · convex/lib/peopleScope*.ts (yeni) · convex/lib/<yeni helper>*.ts
src/hooks/useEmployees.ts · src/hooks/useDepartments.ts · src/components/departments/** · src/pages/Shifts.tsx · src/pages/Leaves.tsx · src/components/employees/EngineeringDepartmentView.tsx · src/components/employees/hooks/useEmployeeFormData.ts · src/components/employees/hooks/usePhotoUpload.ts · src/components/shifts/** · src/components/leaves/**

## Kapsam dışı
Ziyaretçi/geçiş/kart okuma (ACC worker) · `convex/hikvisionSync.ts`, `convex/ideSync.ts`, `convex/syncStatus.ts` (DEV worker) · PDKS dosyaları · schema.ts (koordinatör) · tasarım sistemi göçü / renk / useToast taşıma (Dalga 3).
