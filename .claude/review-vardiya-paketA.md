# Vardiya Paket A — denetim raporu (salt okuma)

**Özet:** Sözleşme (§5.1-5.3) birebir uygulanmış, plan yokken `resolve()` eski sonucu veriyor (eski testler değişmeden geçiyor), yetki/proje kapsamı sağlam. 1 Engel (silinen çalışanın `shiftPlanRefs` artığı vardiya silmeyi kalıcı kilitler), 1 Önemli (etki sorgusu sentinel yerine hata atıyor), birkaç Düşük bulgu var.

Koşumlar: `vitest run convex/lib convex/shifts.test.ts convex/shiftPlans.test.ts` → 110 dosya / 1394 test yeşil. `node scripts/find-node-leak.mjs` → exit 0. Mevcut test dosyalarında değişiklik YOK (`git diff --stat '*.test.ts'` boş; yalnız yeni test dosyaları). tsc/eslint/tam kapı koordinatörde.

## Engel

1. **Çalışan silinince `shiftPlanRefs` yetim kalıyor → vardiya tanımı kalıcı silinemez.**
   - [employees.ts:393](convex/employees.ts) (`employeeDependentTables` = `employeeUx.ts:11`) çalışanın `shiftAssignments` satırlarını doğrudan `db.delete` ile siler; `syncPlanRefs` çağrılmaz. Planlı atamanın `shiftPlanRefs` satırları ortada kalır.
   - [shifts.ts:575-579](convex/shifts.ts) (`remove`) ref'in kendisini (sahibi hayatta mı bakmadan) sayar → "Vardiya silinemez: plan veya departman ataması var" hatası, çözümü yok (atama zaten silinmiş, kullanıcı kaldıramaz).
   - Senaryo: çalışana 2 vardiyalı plan ata → çalışanı sil → ikinci vardiya (primary olmayan) artık hiç silinemez.
   - Düzeltme (ownership dışı: `employees.ts`/`employeeUx.ts` koordinatörde): çalışan silme döngüsünde `shiftAssignments` için önce `syncPlanRefs(ctx, { assignmentId }, projectId)` çağır. Savunma olarak `remove` içinde ref bulununca sahip satırı `db.get` ile doğrula, sahibi yoksa ref'i sil ve devam et (self-heal). Test ekle: planlı atamalı çalışanı sil → refs 0 → vardiya silinebilir.

## Önemli

1. **`definitionImpacts` sentinel yerine tüm sorguyu çökertiyor.**
   - [shifts.ts:~396-403](convex/shifts.ts) `definitionPlanLinks(ctx, shift._id, projectId, remaining)`; fonksiyon `refs.length + departments.length > limit` ise `ConvexError` atar. `remaining` 0'a düştüğünde (ya da küçükken) o vardiyada tek bir ref/departman ataması varsa bütün proje sorgusu hata verir; sözleşme "kesik sonuç + `truncated:true`" ister (`remaining === 0` dalındaki `countLabel: "Hesaplanamadı"` yolu ile tutarsız).
   - Düzeltme: `definitionPlanLinks` limit aşımında throw yerine `{ truncated: true }` dönsün; `definitionImpacts` bunu `truncated`/"En az" olarak işlesin (readDefinitionAssignments'ta throw kalabilir — tek vardiya sorgusu). Test: ASSIGNMENT_SCAN_LIMIT'i tüketen vardiya + sonrakinde 1 ref.

2. **Planlı atamayı "tek vardiyaya" geri çevirmek sezgisel değil.**
   - [shifts.ts updateAssignment](convex/shifts.ts) ve [shiftPlans.ts updateDepartmentAssignment](convex/shiftPlans.ts): `plan: args.plan ?? assignment.plan`. Saklı plan varken yalnız `shiftId` verilirse `shiftId` sessizce yok sayılır (normalize planın ilk vardiyasını yazar), hata da yok. Tek yol `plan: {kind:"weekly", shiftIds:[x]}` göndermek (testte doğrulanmış). C bunu bilmeli.
   - Düzeltme: `shiftId` verilip `plan` verilmezse ve saklı plan varsa ya `ConvexError("Planlı atamada vardiyayı plan üzerinden değiştirin")` ya da planı düşür; en azından C'ye sözleşme notu.

## Düşük

1. [employees.ts](convex/employees.ts) / [adminGuards.ts:48](convex/lib/adminGuards.ts): `projectDeletionBlockingTables` içinde `departmentShiftAssignments` / `shiftPlanRefs` yok. Pratikte `departments` ve `shifts` zaten proje silmeyi engelliyor, ama yetim ref/atama kalmaması için listeye eklenmesi iyi olur.
2. [shiftResolver.ts:readDepartmentPlans](convex/lib/shiftResolver.ts) `DEPARTMENT_READ_LIMIT=2000`: departman sayısı 2000'i aşan projede departman ataması hiç olmasa bile TÜM `resolve()` çağıranları "Departman vardiya okuma sınırı aşıldı" hatası verir (plan yokken eski davranış bozulur). Gerçekçi değil ama değişmezlik ihlali; departmanları yalnız atama varsa oku veya limit-aşımında departman katmanını atla.
3. [shiftPlan.ts:validateShiftPlan](convex/lib/shiftPlan.ts): döngüde slot i'nin gece taşan son vardiyası, slot i+1'in ilk vardiyasıyla çakışıyor mu kontrol edilmiyor (yalnız gün içi). Çakışan vardiyalar kaydedilebilir, motor (B) belirsiz sonuç üretebilir. Düzeltme: ardışık slotlar (son→ilk dahil, `% length`) için tail-vs-next-start ≥30 dk (veya en az çakışmama) kontrolü.
4. [shiftPlans.ts](convex/shiftPlans.ts): departman atama ekle/güncelle/sil `writeAudit` yazmıyor (kişi atamalarında `bulkAssignShift`/`clearAssignments` yazıyor). Departman ataması tüm alt çalışanların mesaisini değiştirir; audit önerilir.
5. [shifts.ts affectedEmployeeCount](convex/shifts.ts): proje çalışanı >5000 ise `definitionImpacts`/`assignmentDeleteImpact` hata atar (sentinel+hata kuralına uygun, ama departman ataması olan büyük projede sayfa açılmaz). Kabul edilebilir; bilinçli sınır olarak not.
6. [shiftUx.ts scheduleIntervals](convex/lib/shiftUx.ts) planlı aralıkta gün gün döner ve her gün `slotForDate` içinde regex+Date üretir; 365 gün × çok mevcut atama için maliyet yüksek ama `validateRange` ≤365 ve mevcut satırlar ±1 gün kırpıldığı için sınırlı. Aksiyon gerekmez.

## Kontrol edilenler (sorun yok)

- **Değişmezlik:** `createShiftResolver` eski sırayı korur (kişi `updatedAt` desc, stable sort → sonra `employees.shiftId`); silinmiş vardiya → satır atlanır; `rowPlan` plan yoksa `[row.shiftId]`. `shiftResolver.test.ts` "exactly equals the old resolver" eski implementasyonla karşılaştırıyor. `cardReadingProcess.directionShift` eski filtreleri (proje, vardiya projesi) koruyor, `resolveLast` kullanıyor. Hiçbir mevcut test değişmemiş/silinmemiş.
- **Sözleşme §5.1:** `MAX_SHIFTS_PER_DAY=8`, `MIN_SPLIT_GAP_MINUTES=30`, `MAX_DAY_CYCLE=31`, `MAX_WEEK_CYCLE=52`, `shiftPlanValidator`, `ShiftPlan`, `daySlotValidator`, `slotForDate` (null/[]), `validateDayShifts`, `validateShiftPlan`, `planShiftIds` hepsi var, isimler/tipler eşleşiyor (ek: `validatePlanStructure`, `shiftPlanFields`, `validPlanDate`).
- **§5.2:** `DayPlan` birebir (kind/source/calendar/ID alanları), `ShiftResolver` `resolve/resolveLast/resolvePlan/shifts`; memo `emp|date`; `calendar:"plan"` yalnız dayCycle/weekCycle; `build*Resolver` opsiyonel `range`.
- **§5.3:** `listAssignments.includePlans` yokken plan satırı dönmüyor (matches filtresi, test var); `previewBulkAssign`/`bulkAssignShift`/`updateAssignment` `plan?`; update'te plan verilmezse saklı plan korunuyor; `shiftPlans.ts`: `listDepartmentAssignments`, `previewDepartmentAssign` (`employeeCount, personalOverrideCount, sameDepartmentConflicts, leaveCount, holidayCount`), `assignDepartment`, `updateDepartmentAssignment`, `removeDepartmentAssignment`, `planCells` (≤50 benzersiz çalışan, <42 gün, alanlar sözleşmeyle aynı).
- **Yetki/IDOR:** `shiftPlans.ts` her fonksiyonda `resolveProjectScope(projectId)`; yazmalar `requirePermission(..., "schedule.manage")` (update/remove'da satırın kendi `projectId`'sinden); `prepare` departmanın ve vardiyanın `projectId === args.projectId` olduğunu, plan vardiyalarının aynı proje+aktif olduğunu doğruluyor; `planCells` her çalışanın `projectId`'sini kontrol ediyor; `updateDepartmentAssignment` proje değişimini reddediyor; `updateAssignment` önce izin + proje üyeliği, sonra normalize. Çapraz proje vardiya/departman/çalışan karışması bulunamadı.
- **Doğrulama:** ≤8, ≥30 dk, gece yalnız sonda, ilk başlangıç→son bitiş ≤1440, esnek tek başına, aynı vardiya iki kez yok, dayCycle 1..31, weekCycle 7..364 + `%7` + anchor Pazartesi, döngüde weekPattern boş + en az bir dolu slot, gerçek tarih, negatif mod. `shiftPlanRefs` silme+yazma aynı mutasyonda (`syncPlanRefs`, update/bulk/clear split/remove/department CRUD'da çağrılıyor; tavan 2912 sentinel'li). Vardiya silme (`remove`) ve `departments.remove` engeli var.
- **Okuma sınırları:** `readDepartmentPlans` `take(limit+1)` + Türkçe hata; departman zinciri ≤32 + ziyaret kümesi + farklı proje durur; `buildBoundedShiftResolver` plan/departman vardiya id'lerini `db.get` ile yüklüyor.
- **Ownership:** değişen convex dosyaları yalnız listedekiler; `_generated/api.d.ts` yalnız 2 satır (import + fullApi `shiftPlans`); `schema.ts` yalnız `shiftAssignments.plan` + 2 yeni tablo + import. `docs/mobile-release/PLAN-20261022.md` değişikliği Paket A'nın değil (oturum başında zaten kirliydi).
- **Tip/stil:** yeni dosyalarda `any`/`as any`/`!` yok (grep temiz); Node import yok (`find-node-leak` exit 0).

## Worker yanıtı

- **Engel-1 — düzeltildi:** `convex/employees.ts:397` tekli/toplu silmede atama referanslarını önce temizler; `convex/shifts.ts:587` referans sahibini doğrular ve yetim referansları aynı mutasyonda siler; çalışan silme, ikinci vardiya silme ve iki tür yetim referans testleri geçti.
- **Önemli-1 — düzeltildi:** `convex/shifts.ts:325` sınırlı referans/departman okumalarında `truncated` döner; `convex/shifts.ts:414` etki paneli `En az`/`Hesaplanamadı` yolunu korur; kalan bütçe 0/1/2 senaryoları test edildi.
- **Önemli-2 — düzeltildi:** `convex/shifts.ts:179` ve `convex/shiftPlans.ts:110` saklı plan varken plansız `shiftId` argümanını istenen Türkçe ConvexError ile reddeder; tarih/weekPattern güncellemesi ve açık tek-vardiya planına dönüş testleri geçti.
- **Düşük-1 — düzeltildi:** `convex/lib/adminGuards.ts:49` iki tabloyu proje silme engellerine ekler; `convex/schema.ts:1068` referanslar için `by_project` index'i eklendi; diğer kaynaklar silinmişken dahi iki tablo engel olarak test edildi.
- **Düşük-2 — düzeltildi:** `convex/lib/shiftResolver.ts:46` önce departman atamalarını okur, atama yoksa ağacı okumaz; 2001 departmanda her iki çözümleyicinin eski varsayılan sonucu verdiği ve `departments` sorgusunun yapılmadığı doğrulandı; departman önizlemesi ihtiyaç duyduğu ağacı `convex/shiftPlans.ts:47` üzerinden ayrıca yükler.
- **Düşük-3 — düzeltildi:** `convex/lib/shiftPlan.ts:97` gece kuyruğu ile sonraki slotun ilk vardiyası arasındaki 30 dakikayı doğrular; döngü son→ilk ve haftalık Pazar→Pazartesi dahil komşu seçili günler, boş slotlar ve 29/30 dakika sınırı test edildi.
- **Düşük-4 — düzeltildi:** `convex/shiftPlans.ts:94`, `:121`, `:134` oluştur/güncelle/sil audit kayıtlarını kullanıcı, proje, hedef ve önceki/yeni değerlerle yazar; `convex/lib/auditLogQuery.ts:6` Türkçe hedef etiketi eklendi; üç audit satırı test edildi.
- **Düşük-5 — değiştirilmedi:** 5000 çalışanlık etki okuma sınırı koordinatör kararı gereği korundu.
- **Düşük-6 — değiştirilmedi:** Planlı aralığın gün gün genişletilmesi koordinatör kararı gereği korundu.

Doğrulama: iki TypeScript kapısı geçti (0 hata), `eslint src convex` geçti (0 hata; mevcut `attendanceCorrections.test.ts:8` uyarısı), tam Vitest **367 dosya / 4064 test** geçti, `find-node-leak.mjs` ve `git diff --check` geçti.
Yeni regresyon testleri: `convex/shiftPlans.review.test.ts:1` (11 test) ve `convex/lib/shiftPlan.review.test.ts:1` (11 test).
Koordinatörün açık onayıyla yalnız iki mevcut test uyarlaması yapıldı: Paket A'nın `shiftResolver.test.ts` departman limit fixture'ına 1 departman ataması eklendi (assertion aynı); `auditLogQuery.test.ts:76` beklenen hedef listesine 1 anahtar eklendi (assertion aynı).
B/C dosyaları, Düşük-5/6 ve canlı veri değişmedi; staging, commit, codegen ve yayın yapılmadı.
