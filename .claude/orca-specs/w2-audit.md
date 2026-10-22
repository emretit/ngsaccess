# W2 denetimi — İşten ayrılma (SALT-OKUMA)

Sen denetçisin; kodu Codex yazdı. Hiçbir dosyaya YAZMA (rapor dosyası hariç: `/tmp/w2-denetim.md`). YASAK: commit, push, deploy, `npx convex *`, DB yazma, git stash/checkout/reset.

## Girdi
- Spec: `/Users/emreaydin/ngsaccess/.claude/orca-specs/w2-ayrilma.md` (hedef + kararlar; ek izinler: `src/pages/Employees.tsx` yalnız durum filtresi/sayım; `convex/cardReadings.ts` yalnız 3 fonksiyon içi dönem gün filtreleri)
- Değişiklik: `git -C /Users/emreaydin/ngsaccess diff -- convex src` + yeni dosyalar (`git status --short convex src`). `mobile/**` başka ekibin, denetleme.

## Bak (öncelik sırası)
1. **Erişim gerçekten kapanıyor mu:** terminate (geçmiş tarih) ve cron yolunda IDE için `resolveEmployeeIdeDeviceIds` patch'ten ÖNCE çağrılıyor ve `deleteIdeUserFromPanels` planlanıyor mu; Hik `syncEmployeeToDevicesInternal` planlanıyor mu. Reinstate yeniden ekliyor mu. Ziyaretçi yoluyla (`convex/visitors.ts:551-566`) birebir aynı mı.
2. **Yetki:** adminMutation + proje kontrolü (`getProjectIdsForUser`); başka projenin çalışanı terminate/reinstate edilemiyor; ziyaretçi terminate edilemiyor.
3. **Tarih mantığı:** `employedOn/employedDuring` sınır günleri (bitiş günü dahil, ertesi gün hariç), eski pasifler (bitiş yok) hariç, ileri tarihli aktif kişi bitişten sonra devamsız sayılmıyor; TR gün anahtarı (`trTodayKey`) — UTC kayması yok; cron 21:05 UTC.
4. **Raporlar:** reportAttendance, sgkExport, cardReadings (getPdksTableData, getMonthlyPayrollSheet, PDKS detay) — ay ortasında ayrılan dahil, ayrılış sonrası gün devamsız değil; ziyaretçi hariç tutma korunmuş; davranış değişikliği aktif çalışanlar için SIFIR (regresyon).
5. **Convex kuralları:** cron sorgusu index'li + paginate; yeni sınırsız `.collect()` yok; `returns` validator'ları; `api.d.ts` elle eklenen satırlar doğru.
6. **UI:** diyalog doğrulaması, rozet tarihi TR formatı, "Ayrılanlar" filtresi + sayım, yalnız yönetici görür, çift tık / kapanma koruması.

## Kapılar (kendin koş, sayıyla yaz)
`node_modules/.bin/tsc --noEmit -p tsconfig.app.json` · `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json` · `node_modules/.bin/eslint src convex` · `node_modules/.bin/vitest run`

## Rapor
`/tmp/w2-denetim.md`: bulgular P1 (yanlış davranış/güvenlik) / P2 (kenar durum) / P3 (stil) — her biri file:line + somut senaryo + öneri. `worker_done`'da ≤10 satır: P1/P2/P3 sayıları, en kritik 3 bulgu, kapı sonuçları.

## CEO ön notları (doğrula, karar ver: gerçek mi + öncelik)
- CEO kapısı (çalışma ağacı, 12:40): tsc 0/0, eslint 0, vitest 233 dosya / 2379 test yeşil.
- Sütun kayması YOK (CEO kontrol etti): ayrılış yalnız ay sonu günlerini düşürür; `src/utils/pdksExport.ts:370` indeks tabanlı ama ilk hücre hep ayın 1'i.
- N1 `convex/employeeTermination.ts` terminate: geçmiş tarih için ALT SINIR yok (ör. 2025 yazım hatası → geçmiş aylar raporlarından kişi düşer). Öneri sınırı?
- N2 `employees.list` (`convex/employees.ts:95` `...emp`) `terminationReason`/`sgkExitCode`/`terminatedBy`'ı project_user'a da döndürür — gizlenmeli mi (ücret maskesi deseni `maskPay`)?
- N3 `src/components/employees/EmployeeDetails.tsx:30` ek `api.employees.list` aboneliği — `src/hooks/useEmployees.ts:9` ile aynı argüman mı (tekilleşir mi), değilse ek okuma.
- N4 `convex/sgkExport.ts:98` ayrılan için prim günü = min(30, çalışılan takvim günü) − eksik gün; SGK kuralına ve `calculateSgkEksikGun`'un filtrelenmiş `monthDays` ile davranışına uygun mu.
