# Kişiler düzeltmeleri denetimi (salt okuma) — 2026-11-27

Özet 1/3 — 3 Engel, 10 Düzeltilmeli, 7 Not. F01/F03/F05/F06/F07/F10/F11 kapandı; F02/F04/F08/F09/F12 kısmen.
Özet 2/3 — En kritik: `hikEmployeeNo` (cihaz kişi no) kart tekilliğine, silme yoluna ve olay eşleştirmesine bağlanmadı → cihazda başka kişinin üzerine yazma, yanlış kişiyi silme, yüz/parmak geçişlerinin kişiye düşmemesi.
Özet 3/3 — Merkezi liste yazıcısını atlayan yol bulunmadı; ama departman/şirket/pozisyon ekle-yeniden adlandır ve desteklenmeyen harf (é, â, NBSP) projeyi kalıcı legacy (tam collect) moda düşürüyor; indexed modda arama/filtre sayfa sonrası uygulanıyor.

Doğrulama: statik inceleme + `vitest run convex/employees.wc.test.ts` (20/20) + `node scripts/find-node-leak.mjs` (temiz). Diff'te `any` yok, camelCase korunmuş. DB/cihaz/canlı test yok.

## F durumu

| F | Durum | Kanıt |
|---|---|---|
| F01 | Kapandı | `src/lib/employees/parseEmployeesXlsx.ts:10` alias + `:75` tanınmayan sütun hatası |
| F02 | Kısmen | Model ayrıldı (`convex/hikDeviceImport.ts:73`, `convex/lib/employeeCardChange.ts:24`); E1-E3, D5, D6, N3 açık |
| F03 | Kapandı | `convex/employees.ts:764` |
| F04 | Kısmen | Ret kalıcı sync issue (`convex/ideSync.ts:23`, kart değeri saklanmıyor ✔, kartsızda no-op `ideGatewayDevice.ts:130` ✔); cihaz kapsamına göre ön doğrulama yok (N1) |
| F05 | Kapandı | `convex/employees.ts:646-656` Hik + IDE |
| F06 | Kapandı (yeni yazım) | `convex/employees.ts:82,437,559`; eski boşluklu TC N2 |
| F07 | Kapandı | `convex/lib/employeeImportValidation.ts:29`, `convex/employeeImport.ts:110` |
| F08 | Kısmen | Ortak `convex/lib/cardNumberRules.ts` tüm yollarda ✔; form eski kayıtları kilitliyor (D8) |
| F09 | Kısmen | D1, D2, D3 |
| F10 | Kapandı | `src/components/employees/EmployeeDetails.tsx:56,114` |
| F11 | Kapandı | `convex/employeeBiometrics.ts` görünür ≤100 kişi |
| F12 | Kapandı (sayfalı, idempotent `by_project_hikEmployeeNo`) | `convex/actions/hikDeviceImport.ts:50`; maliyet D7 |
| P2 alt departman / erişim bitişi | Kapandı | `src/components/employees/lib/employeeList.ts:69`, `convex/employees.ts:65` |
| P2 teslim matrisi | Kısmen | IDOR yok, bounded ✔ (`convex/employeeDelivery.ts:14-16`); D9 |

## Engel

**E1 — Cihaz kişi no'su kart tekilliğine dahil değil → başka kişinin cihaz kaydının üzerine yazılır.**
`convex/lib/cardIdentity.ts:12` yalnız `by_card` arar; `hikEmployeeNo` bakılmaz. Kullanım: `convex/employees.ts:443,…` (create/update), `convex/employeeImport.ts:156` (toplu kart), `convex/visitors.ts`.
Senaryo: Cihazdan kartsız A aktarılır (`cardNumber=""`, `hikEmployeeNo="5"`). B'ye formdan kart "5" verilir → tekillik geçer → `hikPersonIdentity(B)="5"` → `upsertPersonToDevice(employeeNo:"5")` A'nın cihaz kaydını B'nin adı/yetkisiyle ezer, A'nın parmak/yüzü B'ye geçer. B'nin sonraki kart değişimi eski yolla `deletePerson("5")` → A cihazdan silinir. Aynısı F02 sonrası (A: `hikEmployeeNo=5`, kart=456) da geçerli.
Düzeltme: kart atama/oluşturmada `by_project_hikEmployeeNo` ile de çakışma ara (sayısal varyantlar dahil); tersine `hikEmployeeNo` yazarken `by_card` kontrolü zaten var (`hikDeviceImport.ts:31`).

**E2 — Silme/erişim kaldırma hâlâ `cardNumber`'ı cihaz employeeNo sayıyor.**
`convex/actions/hikvisionSync.ts:123` (`!cardNumber` erken dönüş), `:146` `removeScopedPerson(…, cardNumber)`; `convex/lib/hikSyncEmployee.ts:99-109`; snapshot yalnız `cardNumber` taşır `convex/lib/peopleHikSnapshot.ts:51`; ayrıca `convex/deviceSyncRuns.ts:716`, `convex/lib/accessTransfer.ts:110`.
Senaryo a: Yeni kartsız import (`cardNumber=""`) silinir/ayrılır/kuraldan çıkarılır → erken dönüş → kişi, kapı yetkisi ve biyometri cihazda kalır (yetim erişim). Eski kodda `cardNumber=employeeNo` olduğu için çalışıyordu → regresyon.
Senaryo b: F02 sonrası (`hikEmployeeNo=7`, kart=456) silme → `deletePerson("456")` → cihazda employeeNo'su 456 olan BAŞKA kişi silinir, asıl kişi kalır.
Düzeltme: snapshot'a `employeeNo: hikPersonIdentity(employee)` ekle; `removeScopedPerson`/`protectPersonDeletion`/`beginPersonDeletion`/local bridge payload'ında employeeNo ile cardNumber'ı ayır; erken dönüşü `hikPersonIdentity` ile yap.

**E3 — Yüz/parmak geçiş olayları `hikEmployeeNo` kişilerine bağlanmıyor.**
`convex/cardReadings.ts:798` `cardNo || employeeNoString` → `:506` `findDeviceCardEmployee` yalnız `by_card`.
Senaryo: Yeni kartsız import (kart "") veya F02 sonrası (kart≠employeeNo) kişi yüzle geçer → olay `employeeNoString="7"`, `cardNo=""` → kart "7" aranır → kişi bulunmaz (PDKS'e düşmez) ya da kartı "7" olan başka kişiye yazılır. Eski kodda eşleşiyordu → regresyon.
Düzeltme: `cardNo` boşsa önce `by_project_hikEmployeeNo` (cihaz projesi), sonra `by_card`; canlı köprü yolunu (`processCardReadingCore` / `cardReaderParse`) da aynı yardımcıya bağla. Test: yüz olayı + `hikEmployeeNo` kişi.

## Düzeltilmeli

**D1 — Organizasyon imzası her departman/şirket/pozisyon değişiminde tüm projeyi legacy moda düşürür.** `src/components/employees/lib/employeeListKeys.ts:39` (`rows.length` + isimler), `convex/lib/employeeListFields.ts:17,40`, `convex/employees.ts:281`. Yeni departman eklemek bile imzayı değiştirir → ilk/son prob eşleşmez → `legacyEmployeeList` (sınırsız collect + kişi başı join) geri gelir; `backfillListFields` (`employees.ts:45`) hiç otomatik çalışmaz. F09 pratikte kapanmıyor. Düzeltme: imzayı anahtara gömme; isim değişince etkilenen kişileri `by_department`/`by_company` üzerinden sayfalı yeniden anahtarla (otomatik zamanlama Emre onayı ister) ya da yalnız değişen org satırının kişilerini işaretle.

**D2 — Desteklenmeyen tek bir karakter projeyi kalıcı legacy yapar.** `employeeListKeys.ts:6-23` alfabede olmayan karakter (é, â, ä, ß, NBSP, ’) → `listKeys=undefined` → index başına sıralanır → prob legacy der. Ziyaretçiler aynı indekste (yabancı isimler) → sık tetiklenir. Düzeltme: `undefined` yerine yedek anahtar (NFD + aksan atma veya kod noktası ağırlığı).

**D3 — Indexed modda arama/filtre sayfalamadan SONRA uygulanıyor.** `convex/employees.ts:301-305` (`isVisitor`, `listSearch`, departman/şirket/durum ≤`size` satıra). 2000 kişide "Ahmet" araması size=10 ile ~200 "Devam" tıklaması; ziyaretçi yoğun projede isim sıralı sayfalar boş gelir. Legacy'ye göre UX regresyonu. Düzeltme: ziyaretçiyi anahtardan/indeksten ayır (ör. `listKeys` yalnız `isVisitor!==true` + ayrı kapsam alanı), arama için `searchIndex("listSearch", {filterFields:["projectId"]})`, filtreler için `projectId+departmentId/companyId/isActive` indeksleri ya da sayfa dolana kadar `maximumRowsRead` döngüsü.

**D4 — Local bridge cihazlarda eski kart silinmiyor.** `convex/actions/hikvisionSync.ts:31-34` gateway değilse yalnız hata kaydı → `hikEmployeeNo` kişide kart değişince eski kart DS-K2804 köprü cihazlarında AÇMAYA devam eder. Düzeltme: köprü kuyruğuna kart-only `deleteCard` op'u (yalnız cardNo) ekle; desteklenmiyorsa kart değişimini o cihaz kapsamında reddet.

**D5 — Eski kartsız importta IDE yer tutucu kartı.** `convex/actions/ideGatewayDevice.ts:130` `hikCardless` atlanmıyor → eski importlarda `cardNumber=employeeNo` IDE'ye KART olarak gider; kart atanınca `employeeCardChange.ts:30` (`wasCardless`) IDE'den silmez → yetim IDE kimliği. Düzeltme: IDE'de `hikCardless===true` → no-op; `wasCardless` + IDE cihazı varsa yer tutucu kullanıcıyı sil.

**D6 — Aynı yer tutucu kart tekrar gönderilince kartsız bayrağı düşüyor.** `convex/employees.ts:632`, `convex/employeeImport.ts:164`: `hikCardless` kişiye mevcut `cardNumber` (=employeeNo) gönderilirse → `hikCardless=false`, cihaza employeeNo değerinde fiziksel kart eklenir. Düzeltme: `hikCardless && yeni === önceki` → "gerçek kart numarası girin" reddi.

**D7 — Cihaz importunda her sayfa tüm kural üyelerini yeniden gönderiyor.** `convex/hikDeviceImport.ts:113-114` `syncWeekPlanToDevicesInternal` `targetEmployeeIds` olmadan → 10 kişilik her sayfada "mevcut kişiler" kuralının TÜM üyeleri cihaza yazılır (1000 kişi ≈ 100 sayfa × ≤1000 kişi). Eski kod kişi başı senkrondu. Düzeltme: `targetEmployeeIds: created employeeId'ler`.

**D8 — Form doğrulayıcı eski kayıtları düzenlenemez yapar.** `src/components/employees/hooks/useEmployeeFormSchema.ts` kart `superRefine` her zaman çalışır; boşluklu/Türkçe harfli/>20 haneli eski kart → kart değişmese de form kaydedilmez (backend yalnız değişince doğruluyor, `employees.ts:560`). Düzeltme: yalnız kart alanı değiştiyse doğrula.

**D9 — Teslim matrisi yanıltıcı.** `convex/employeeDelivery.ts:61` `changedAt=employee.updatedAt` → not/bordro/TC düzenlemesi tüm cihazları "eksik" gösterir; `:69,77` Hik op eşleşmesi `cardNumber` ile (`hikEmployeeNo` kişide kaçar); IDE `card_invalid` reddi (`ideSync.ts:32` idempotencyKey) okunmuyor → "başarısız" yerine "eksik". Düzeltme: cihaz-ilgili değişim zamanı, `hikPersonIdentity`, `${deviceId}:invalidCard:${employeeId}` sorgusu.

**D10 — 2000 sınırına ziyaretçiler de sayılıyor.** `convex/employees.ts:194` (`listSummary`), `:345` (`listLightForImport` hata atar). 1500 kişi + 600 ziyaretçi → Excel import eşleştirmesi çalışmaz, sayımlar gizlenir. Düzeltme: ziyaretçiyi indeks seviyesinde ayır veya sayımı yalnız kişilerde yap.

## Not

- **N1** F04: form/toplu kart IDE kapsamını önceden doğrulamıyor; ret yalnız asenkron banner.
- **N2** F06: DB'deki eski boşluklu TC'ler tekillik sorgusunda bulunmaz; tek seferlik kontrol gerekir.
- **N3** F02: eski importlar (`cardNumber`=yer tutucu) toplu kart listesine girmez (`BatchCardAssignDialog.tsx:19`), backfill yok. Yüz kartı UI `cardNumber`'a bakıyor → yeni kartsız importta yüz kaydı UI'da kapalı, backend izinli (`employeeFaces.ts`).
- **N4** `listPageWindow` iç içe `ctx.runQuery` + `paginate` (`employees.ts:327`): dev deployment'ta doğrula (guidelines önermiyor). Desc sayfa ≤200 index sorgusu.
- **N5** F12: önizleme ile aktarım arasında roster kayarsa seçili kişi sayfada olmayabilir, sessizce sayılmaz; `recordSources` tek hata ile sayfanın tüm parmak izlerini düşürür (tekrar idempotent).
- **N6** `hikSyncEmployee.ts:595` kural senkronu kartsız-kimlikli kişide grant rezervasyonu yapmaz → matris "eksik".
- **N7** `biometricDestruction.ts:159,287` hâlâ `cardNumber`; `enrolledEmployeeNo` yedeği çoğunu kurtarıyor, tutarlılık için `hikPersonIdentity`.

## Yazıcı kapsamı / kota

- `insert("employees")` yalnız `convex/lib/employeeListFields.ts:46`; employees'e ham `db.patch` kalmadı (grep: visitors, mobileVisitors, termination, transfer, cascade, departments, import, cardChange hepsi helper). Org rename/create yeniden anahtarlama yok → D1.
- `patchEmployee` her mutasyonda proje org'larını (≤3003 satır) okur, `ctx.db` başına önbellekli; org tablolarıyla OCC çakışma yüzeyi büyür (Not).
- Yeni poll yok. Abonelikler: Kişiler sayfası `departments.list` + `listSummary` (≤2001 satır) + tek pencere; drawer'daki tam liste aboneliği kalktı ✔. Import: sayfa başı 1 createPersons + 1 recordSources mutasyonu ✔ (D7 hariç).
