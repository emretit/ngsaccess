# W2 denetimi — İşten ayrılma (salt-okuma)

## Kapılar (kendi koşumum)
- tsc -p tsconfig.app.json: 0 hata
- tsc -p convex/tsconfig.json: 0 hata
- eslint src convex: 0 error / 0 warning (çıktı boş)
- vitest run: 233 dosya / 2379 test yeşil

## Özet
P1: 0 · P2: 5 · P3: 4. Erişim kapatma, yetki, cron ve rapor filtreleri spec'e uygun; aktif çalışanlar için rapor davranışı değişmiyor
(`employedOn` aktif+bitişsiz → eskisiyle aynı). Ziyaretçi yolu birebir: patch'ten ÖNCE `resolveEmployeeIdeDeviceIds`
(employeeTermination.ts:24), sonra patch, `syncEmployeeToDevicesInternal` + (panel varsa) `deleteIdeUserFromPanels`. Reinstate Hik + `syncEmployeeToIdePanels` ile geri ekliyor (:84-85).

## Doğrulananlar
1. Erişim: terminate (geçmiş tarih) ve cron aynı `closeAccess` yolunu kullanır (:21-33). Hik `isActive===false` → delete (hikvisionSync.ts:114).
2. Yetki: adminMutation + `getProjectIdsForUser` (:12-14), ziyaretçi reddi (:16). Başka proje → hata.
3. Tarih: `employedOn` bitiş günü dahil (`dateKey <= end`), ertesi hariç; eski pasif (bitiş yok) → false; ileri tarihli aktif kişi bitişten sonra false. Gün anahtarı `trTodayKey` (UTC kayması yok). Cron `5 21 * * *` = 00:05 TR (TR sabit UTC+3).
4. Cron: `by_active_employment_end` index + 50'lik paginate + `runAfter` devamı (:98-107); yeni sınırsız `.collect()` yok (cardReadings'teki `.collect()`'ler mevcut; DB `.filter(isActive)` zaten tam tarama yaptığı için okuma maliyeti artmadı). `returns` validator'ları var. api.d.ts 2 satır doğru (:50, :254).
5. Rapor sütun kayması yok: yalnız kuyruk günleri düşer (CEO notu doğru).

## P2 (kenar durum)
- **P2-1** `convex/employeeTermination.ts:41-49` — N1 (aşağıda).
- **P2-2** `convex/sgkExport.ts:98-100` — Şubat'ta (28/29) ay sonunda ayrılan kişi `min(30, 28)=28` prim günü alır; SGK'da ay sonunda ayrılan tam ay 30 sayılır. Senaryo: son çalışma günü 2026-02-28 → APHB 28 gün (olması gereken 30). Öneri: bitiş günü ayın son günüyse tam ay say (30 − eksik), yalnız ay içinde ayrılanlarda `min(30, gün)`.
- **P2-3** `convex/sgkExport.ts:76,89` — "okutması olan ama employedDuring olmayan" kişilerde (eski pasif, bitişsiz + okuma var) `monthDays.filter(employedOn)` boş döner → eksik gün 0, prim 30. Eskiden tüm günlerden eksik gün hesaplanıyordu (regresyon, yalnız eski pasifler). Öneri: filtreyi yalnız `employmentEndDate` varken uygula.
- **P2-4** `employeeTermination.ts:55-57` + `lib/employment.ts:11-13` — zaten pasif (bitişsiz) bir kişi ileri/geçmiş tarihle "işten çıkarılırsa" `employedOn` isActive'e bakmadığı için o kişi bütün geçmiş aylarda rapora girer; `reinstate` de onu `isActive:true` yapar (önceden pasifti). Öneri: terminate'te `isActive!==true` kişiyi reddet veya reinstate öncesi `isActive`'i sakla.
- **P2-5** `convex/employees.ts:285` (kapsam dışı dosya) — `employees.update` ile bitişi dolu kişiye `isActive:true` verilirse bitiş alanları kalır; cron ertesi gece tekrar kapatır, raporlar kesilmeye devam eder. Öneri: update'te `employmentEndDate` varken isActive:true engelle (reinstate'e yönlendir).

## P3 (stil/küçük)
- **P3-1** `EmployeeFilters.tsx:21-23`/`Employees.tsx:138` — "Pasif" sayımı ayrılmış (isActive=false) kişileri de içerir, "Ayrılanlar" ile çakışır (toplam > tümü). Öneri: pasif = `!isActive && !employmentEndDate`.
- **P3-2** `EmployeeEmploymentActions.tsx:12` — `reinstate` hatası/çift tık koruması ConfirmDestructive'e bırakılmış; açıkça pending kilidi görmedim (izlenmesi yeterli).
- **P3-3** `EmployeeTerminateDialog.tsx:30` — SGK kodu `pattern` yalnız tarayıcıda; sunucu zaten doğruluyor (OK), ama tarih alanında alt sınır `min` yok (N1).
- **P3-4** `employeeTermination.ts:55-58` — audit `newValue` içinde ham `updates` + hesaplanmış isActive; `terminationReason` serbest metin audit'e yazılıyor (KVKK açısından not).

## CEO ön notları
- **N1 GERÇEK — P2.** Geçmiş tarih için alt sınır yok; 2025 yazım hatası geçmiş ay raporlarından kişiyi düşürür ve erişimi anında kapatır. Öneri: `employmentEndDate >= trTodayKey() − 62 gün` (ya da önceki ayın 1'i); daha eskisi için ayrı onay/süper admin. UI'da `min` ver.
- **N2 GERÇEK — P2 (düşük-orta).** `employees.ts:95 ...emp` `terminationReason` (serbest metin, özel nitelikli bilgi olabilir), `sgkExitCode`, `terminatedBy`'ı her okuyana döndürür (list `authedQuery` benzeri; project_user dahil). Öneri: `maskPay` gibi yönetici dışına `terminationReason/sgkExitCode/terminatedBy` → undefined. (employees.ts bu işin sahipliğinde değil; CEO ayrı değişiklik olarak yapmalı.) Tür/tarih herkese açık kalabilir.
- **N3 DEĞİL (ek okuma yok).** EmployeeDetails.tsx:30 `api.employees.list` argümanı `{ projectId }`; `useEmployees.ts:9` da `{ projectId }` (aynı `useActiveProjectScope` kaynağı) → Convex aynı sorgu+argümanı tek abonelikte birleştirir. P3 bilgi.
- **N4 KISMEN.** Mantık (takvim günü, 30 tavan, eksik günü düş) genel olarak SGK ile uyumlu; `calculateSgkEksikGun` filtrelenmiş `monthDays` ile yalnız çalışılan günlerdeki iş günü devamsızlığını sayar, ayrılış sonrası günler eksik gün olmaz (doğru). Ancak Şubat ay-sonu ayrılış (P2-2) ve eski-pasif+okuma regresyonu (P2-3) var.
