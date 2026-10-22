# W2 — İşten ayrılma akışı (terminate / reinstate + dönem içi ayrılan raporlarda)

## Ortak kurallar (bu repo; CLAUDE.md'yi okumadığın için buraya gömüldü)
- TypeScript strict. `any` / `as any` YASAK (eslint error). Bilinmeyen veri `unknown` + narrowing. `!` non-null yerine erken return.
- Convex handler'ları schema alan adlarını olduğu gibi (camelCase) döner. Frontend'de Convex sonucu `any[]`'a açılmaz; `useQuery` sonucu ya da `FunctionReturnType<typeof api.X.Y>` kullan.
- `db.get` sonrası null süzme: `filter((p): p is NonNullable<typeof p> => p !== null)`.
- Convex kuralları: `convex/_generated/ai/guidelines.md` oku. Sınırsız `.collect()` ekleme; yeni sorgularda index + `take(N)`/`paginate`.
- UI metinleri Türkçe, sade. Mevcut bileşen/stil desenini taklit et (src/components/employees/**, src/components/ui/**, `ConfirmDestructive` kalıbı).
- Tarih: gün anahtarı `YYYY-MM-DD` Türkiye saatiyle → `convex/lib/trDate.ts` (`trTodayKey`, `trDateKey`). Kendi TZ hesabını yazma.
- YASAK: commit, push, deploy, `npx convex *` (dev/deploy/codegen), DB yazma, `convex/_generated/**` düzenleme (api.d.ts'e yeni modül gerekiyorsa ELLE ekle, mevcut desene uyarak), `mobile/**`, `convex/employees.ts`.

## Hedef (test edilebilir)
Yönetici bir çalışanı son çalışma günüyle "işten çıkarır": o gün bitince (geçmiş tarihse hemen) kişi pasifleşir ve Hik + IDE cihazlarından kartı silinir; "Geri al" ile eski haline döner. Ay içinde ayrılan kişi PDKS tablo / bordro / aylık devam raporu / SGK APHB'de ayrılış gününe kadar görünür, sonraki günler devamsız sayılmaz.

## Bağlam (kodda doğrulandı, main c23926d)
- employees'ta yalnız `isActive` var; ayrılış alanı yok. Ziyaretçi bitişinin hazır deseni: `convex/visitors.ts:537-577` `expireVisitorAccess` (index + 50'lik `paginate` + `runAfter(0)` devam; cron `convex/crons.ts:66-72`).
- **Cihaz erişimi kapatma — ziyaretçi yolunu kopyala, `employees.update` yolunu DEĞİL:** `visitors.ts:551-566`: patch'ten ÖNCE `resolveEmployeeIdeDeviceIds(ctx, id, projectId)` → patch `isActive:false` → `runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {employeeId})` + IDE paneli varsa `runAfter(0, internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, {cardNumber, deviceIds, projectId})`. (`employees.ts:301-307`'deki `syncEmployeeToIdePanels` status=0 upsert yapar, kart panelde kalır → kullanma.) Geri almada: patch `isActive:true` → `syncEmployeeToDevicesInternal` + `syncEmployeeToIdePanels`.
- `isActive===true` filtresi ayrılanı düşüren yerler (hepsi değişecek):
  - `convex/lib/reportAttendance.ts:75,77,84` (aylık devam raporu)
  - `convex/sgkExport.ts:74-76` (APHB; bugün "aktif VEYA okutması olan")
  - `convex/cardReadings.ts:413,433` `getPdksTableData` · `:638,656` `getMonthlyPayrollSheet` · `:1358,1375` PDKS detay. Bunlar DB `.filter(isActive)`; `by_project` sonrası JS filtresine çevir (global/super_admin dalında da aynı yardımcı).
- Yetki: `adminMutation` / `adminQuery` (`convex/lib/customFunctions.ts:47,61`), proje kapsamı `employees.ts:239-247`'deki kontrolle aynı (`getProjectIdsForUser(ctx)` + `emp.projectId` dahil mi; aynı import'u kullan). IDE panel çözücü: `resolveEmployeeIdeDeviceIds` (`convex/lib/accessGraph.ts:17`). Audit: `writeAudit` (`convex/lib/audit.ts:18`).

## Değişiklik
1. **Şema (`convex/schema.ts`, yalnız `employees` bloğu, eklemeli):** opsiyonel `employmentEndDate` (string `YYYY-MM-DD`, son çalışma günü), `terminationType` (union literal: `resignation` | `employerTermination` | `retirement` | `contractEnd` | `other`), `terminationReason` (string), `sgkExitCode` (string), `terminatedAt` (ISO), `terminatedBy` (`v.id("users")`). Index `by_active_employment_end: ["isActive", "employmentEndDate"]`. Başka tabloya dokunma.
2. **Yardımcı (YENİ `convex/lib/employment.ts` + test):** saf fonksiyonlar
   - `employedOn(emp, dateKey)`: `isActive===true` → true (bitiş tarihi ileri olsa da `dateKey <= employmentEndDate` ise true, sonrası false); `isActive!==true` ve `employmentEndDate` var → `dateKey <= employmentEndDate`; `isActive!==true` ve bitiş yok (eski pasifler) → false.
   - `employedDuring(emp, startKey, endKey)`: dönemde en az bir gün `employedOn` → true.
   - Ziyaretçi (`isVisitor===true`) her iki fonksiyonda bugünkü davranışını korur (çağıran yer zaten hariç tutuyorsa öyle kalsın).
3. **Backend (YENİ `convex/employeeTermination.ts` + test):**
   - `terminate` (adminMutation): `{ employeeId, employmentEndDate, terminationType, terminationReason?: string (≤500), sgkExitCode?: string (2 hane rakam) }`. Kontroller: proje erişimi; ziyaretçi değil; zaten `employmentEndDate` olan → `ConvexError("Bu kişi zaten işten çıkarılmış.")`; tarih formatı geçerli; ileri tarih en çok bugünden 365 gün sonra. Patch alanlar + `terminatedAt`, `terminatedBy`, `updatedAt`. `employmentEndDate < trTodayKey()` ise aynı mutasyonda erişimi kapat (Bağlam'daki ziyaretçi yolu); değilse kişi aktif kalır, cron kapatır. `writeAudit`.
   - `reinstate` (adminMutation): `{ employeeId }` → 6 alanı `undefined` yap, `isActive:true`, Hik+IDE sync (Bağlam), `writeAudit`. Ayrılmamış kişide hata.
   - `closeEndedEmployments` (internalMutation, `{ cursor?: string }`): `by_active_employment_end` ile `isActive=true` ∧ `employmentEndDate < trTodayKey()`; 50'lik `paginate`, her kişide erişimi kapat (ziyaretçi yolu), `!isDone` → `runAfter(0)` ile devam. Döner `{ closed: number }`.
   - `convex/crons.ts`: `crons.daily("close-ended-employments", { hourUTC: 21, minuteUTC: 5 }, internal.employeeTermination.closeEndedEmployments, {})` (00:05 TR).
   - Hata mesajları Türkçe `ConvexError`.
4. **Raporlar:** Bağlam'daki 5 yerde `isActive===true` yerine dönem için `employedDuring(emp, start, end)`; gün bazlı devamsızlık hesabında bitiş gününden SONRAKİ günler devamsız sayılmasın (`employedOn` ile atla). `sgkExport`: "aktif VEYA okutması olan" kuralını `employedDuring VEYA okutması olan` yap. Ziyaretçi hariç tutma aynen kalsın. cardReadings.ts'te yalnız bu 3 fonksiyonun ilgili satırlarına dokun (ortak dosya, başka ekip de yazıyor).
5. **UI (`src/components/employees/**`):**
   - `EmployeeDetails.tsx`: "İşten çıkar" butonu (yalnız yönetici; mevcut rol kontrol desenini kullan) → yeni `EmployeeTerminateDialog.tsx`: son çalışma günü (tarih), ayrılış türü (Select: İstifa / İşveren feshi / Emeklilik / Sözleşme sonu / Diğer), neden (opsiyonel, ≤500), SGK çıkış kodu (opsiyonel, 2 hane). Etki metni: "Bu tarihten sonra kartı tüm cihazlardan silinir; PDKS'te sonraki günler devamsız sayılmaz." Gönderim sırasında kapanma engelli, çift tık korumalı.
   - Ayrılmış kişide rozet: "Ayrıldı · 15.10.2026" (ileri tarihliyse "Ayrılacak · 31.10.2026") + bilgi satırı (tür, neden) + "Geri al" (ConfirmDestructive, kısa etki metni).
   - `EmployeeFilters.tsx` durum seçicisine "Ayrılanlar" (`employmentEndDate` dolu). `EmployeeTable` durum hücresinde rozet. Sayım (`statusCounts`) güncellenir.
6. **Testler:** `convex/lib/employment.test.ts` (sınır günleri, eski pasif, ileri tarih, ziyaretçi) · `convex/employeeTermination.test.ts` (yetkisiz proje, ziyaretçi, çift terminate, geçmiş tarih → hemen kapanır + scheduler çağrıları, ileri tarih → aktif kalır, cron kapatır, reinstate) · rapor tarafında en az 1 vaka: ay ortasında ayrılan kişi aylık devam raporunda var ve ayrılış sonrası gün devamsız değil · dialog/rozet için mevcut desende render testi.

## Ownership (yalnız bunlara yaz)
convex/schema.ts (yalnız employees bloğu) · convex/lib/employment.ts (+test) · convex/employeeTermination.ts (+test) · convex/crons.ts · convex/lib/reportAttendance.ts · convex/sgkExport.ts · convex/cardReadings.ts (yalnız getPdksTableData / getMonthlyPayrollSheet / PDKS detay filtre satırları) · convex/_generated/api.d.ts (yalnız yeni modül satırları, elle) · src/components/employees/** · ilgili mevcut test dosyaları

## Kapsam dışı
İşe giriş tarihi alanı · SGK işten ayrılış bildirgesi çıktısı · bekleyen izin/düzeltme taleplerini otomatik iptal · mobil uygulama · e-posta bildirimi · `convex/employees.ts` (update/remove mantığı) · toplu işten çıkarma.

## Kapılar (hepsini kendin koş, çıktıyı raporla)
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → 0
- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` → 0
- `node_modules/.bin/eslint src convex` → 0 error
- `node_modules/.bin/vitest run` → tamamı yeşil (sayıyı yaz; başlangıç ~2356)

## Rapor
`worker_done`'da ≤10 satır: değişen dosyalar, eklenen fonksiyonlar, kapı sonuçları (sayılarla), bilinçli kararlar (file:line).
