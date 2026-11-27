# Kişiler düzeltmeleri — 4. tur odaklı denetim (salt okuma) — 2026-11-27

Özet: Engel yok. (A) performans değişikliği yarış güvenliğini korumuş: eski generation yeni grant'ı ezemiyor, revoke kaybolmuyor. (B) tek kaynak doğru kurulmuş: frontend ve Convex aynı fonksiyonu kullanıyor, `convex/` üretim kodunda `src`/`@/` import'u kalmadı. 1 Düzeltilmeli (toplu cleanup'ın okuma bütçesi), 4 Not var.

Doğrulama: `git diff` (statik) + 9 test dosyası tek koşuda `vitest run` → **144/144 geçti** (grantReservationReads, hikRevocation, hikvisionSync, hikvisionSync.attempt, hikvisionSync.facesCleanup, lib/employeeListShared, lib/hikSyncEmployee.identity, src/.../employeeList, src/.../employeeListKeys). Tam vitest/tsc koşulmadı (talimat gereği). DB/cihaz testi yapılmadı.

## (A) Performans: rezervasyon/generation, cihaz önbelleği, toplu cleanup

| Soru | Sonuç | Kanıt |
|---|---|---|
| Eski generation yeni grant'ı ezer mi | **Hayır** | `grantStatus.ts:142` `expectedGeneration` hâlâ satırın güncel `syncGeneration`'ıyla karşılaştırılıyor. `expectedGrantId` yalnızca okumayı (`:113` `db.get`) aynı satıra bağlıyor, karşılaştırmayı gevşetmiyor. Hedef uyuşmazsa throw (`:115`). Grant satırı hiç silinmiyor (`adminGuards.ts:88` policy `preserve`, başka `delete` yok), yani id kararlı. Satır yoksa `current=null` → beklenen ≥1 ≠ 0 → yazım yok |
| Eşzamanlı iki mutation | **Güvenli** | Rezervasyon ve bitiş tek mutation içinde oku-yaz yapıyor; Convex OCC (iyimser kilitleme) çakışan ikinciyi yeniden koşturuyor. Aynı çift için ilk insert'te de index aralığı okunduğu için çift satır oluşmuyor (eskisiyle aynı) |
| `existing = current` (yeniden okuma kaldırıldı) | **Güvenli** | `:113`'teki okuma ile `:163` arasında grant satırına yazan tek yollar `return` ile çıkıyor: generation uyuşmazlığı `:145-146`, transfer dalı `:121-139`. `removed` dalı yazmıyor |
| Çift gönderim | Yeni risk yok | Aynı kural için iki eşzamanlı haftalık plan koşusu HTTP'yi iki kez gönderebilir; bu önceden de böyleydi (cihaz upsert'i idempotent). Geç kalan bitiş yazımı generation ile düşüyor |
| Kayıp revoke | **Yok** | Revoke yazımları (`grantStatusForOperation`, `expectedGeneration` yok) generation'ı artırıyor. Haftalık planın bayat `effective` sonucu düşüyor; satır `removed/failed` ise tek düzeltme turu planlanıyor (`:144-146`). Sonradan çalışan toplu cleanup durumu yeniden kontrol ediyor, pasif/yetkisiz kişide silmeyi bastırmıyor (test `hikRevocation.test.ts:666`) |
| Cihaz önbelleği bayatlar mı | **Hayır** | `hikvisionSync.ts:1340` haritası tek mutation içinde ve rezervasyon (`pending`) yolu `devices` tablosuna yazmıyor. `getEmployeesWithDevices` (`:93-98`) bir query, yani salt okuma; `ruleTargets` önbelleği (`peopleHikSnapshot.ts:36-46`) önbelleksiz yolla aynı hesabı yapıyor (`resolveRuleDeviceTargets(ctx, rule, false)`, `:53` ile eşdeğer) |
| `skipUnusedSnapshot` | **Davranış aynı** | `hikvisionSync.ts:166` yalnız `aktif && deviceRules>0` ise snapshot'ı boş veriyor. `previousDevices` `syncEmployeeDevices` içinde yalnız `deviceRules.length === 0` iken okunuyor (`hikSyncEmployee.ts:144`). Pasif kişi silme yolu kendi query'siyle taze okuyor (`actions/hikvisionSync.ts:127`) |
| Toplu cleanup: bir kişinin hatası diğerlerini geri alır mı | **Evet, ama zararsız** | `supersedePersonDeletionsBatch` (`hikvisionSync.ts:1297`) tek transaction; bir kimlikte throw olursa (ör. `:1256` "Kart sahibi sınırı aşıldı") 20 kimliğin tümü geri alınıyor, action bunu sessizce yutuyor (`hikSyncEmployee.ts:628-630`). Koruma durum tabanlı: claim (`:643`), retry (`:1175`) ve `protectQueuedDeletion` (`:1275`) aynı kontrolü yeniden yapıyor. Sonuç: yanlış silme yok, yalnız eski "failed" silme satırları listede kalıyor |
| Yarıda kalırsa kalıntı | Yeni kalıntı yok | Cleanup yalnız `status` değiştiriyor. Yarıda kalırsa en kötü ihtimalle bazı cihazlarda eski failed silme satırları kalıyor; bunları cron/claim zaten temizliyor |

## Engel

Yok.

## Düzeltilmeli

**D-A1 — Toplu cleanup, birikmiş failed işlerin olduğu cihazda okuma sınırını aşabilir; o zaman 20 kişinin cleanup'ı da sessizce düşer.**
`hikvisionSync.ts:1297-1308`: önce `by_device_status=failed` üzerinden `take(4096)` okunuyor. Sonra eşleşen her kimlik için `protectCurrentCredential` → `supersedeDeletions` (`:1235`) aynı aralığı yeniden `take(4096)` ile okuyor. 20 eşleşmede en kötü durum 21 × 4096 ≈ 86 bin doküman eder; Convex'in transaction başına doküman/bayt sınırı (~32 bin doküman / 16 MiB, sınır değerleri ezberden) bunu karşılamaz. Gerçekçi bir örnek: kesintiden dönen bir cihazda ~1.500 failed iş varken 20 kimlik eşleşirse ≈ 31 bin okuma olur, sınırın eşiğine gelir. Eski kişi başı yolda (`supersedePersonDeletions`) her mutation en fazla 2 × 4096 okuyordu, bu sınıra takılmıyordu. Sonuç güvenlik değil, görünürlük sorunu (bkz. tablo): eski silme satırları "Silme onayı bekleniyor" olarak kalır ve claim/cron'a kadar beklemede durur.
Düzeltme: `failed` listesini bir kez oku. Kimlik başına yalnız sahip/yetki kontrolünü yap ve eşleşen satırlar için `supersedeDeletion(op._id)`'i bu listeden çağır; `supersedeDeletions`'ın yeniden taramasını atla. İstenirse kimlik başına iş mantığı hatalarını `try/catch` ile yalıt; Convex mutation'da yakalanan bir JS hatası önceki yazımları geri almaz. Testi `hikRevocation.test.ts:625` "batchCleanup" vakasına okuma sayacıyla eklenebilir.

## (B) Yayın engeli: tek kaynak

| Soru | Sonuç | Kanıt |
|---|---|---|
| Frontend ve Convex aynı fonksiyonu mu kullanıyor | **Evet** | `src/components/employees/lib/employeeList.ts:1-2` ve `employeeListKeys.ts:1-2` yalnız `convex/lib/employeeListShared.ts`'ten yeniden dışa aktarıyor. Convex `employees.ts:31-32`, `lib/employeeListFields.ts:3`, `lib/employeeListPage.ts:3-4` aynı modülü içe aktarıyor. Kimlik eşitliği testi var: `employeeListShared.test.ts:10-13` (`toBe`) |
| Davranış değişti mi (sıralama/filtre/versiyon) | **Hayır** | HEAD'deki `filterAndSortEmployees` ile gövde birebir aynı (değer seçimi, `localeCompare("tr",{numeric:true})`, `_id` eşitlik bozucu, durum/arama koşulları). Tek ek, isteğe bağlı `org.departmentIds` dalı; verilmezse eski `=== department` davranışı korunuyor (`employeeListShared.ts:99-101`). Frontend (`Employees.tsx:133,198`) ve backend (`employees.ts:235-239`) kapsamı aynı `employeeDepartmentScope` ile hesaplıyor. `EMPLOYEE_LIST_VERSION = 2` tek yerde tanımlı; `employeeIndexFields`/sayfa kapsamı (`employeeListPage.ts:15-16`) onu kullanıyor |
| `convex/` altında `src`/`@/` import'u | **Yok (üretim)** | Tüm test dışı `convex/**/*.ts` import yollarını çözdüm: `convex/` dışına çıkan göreli import yok. `src` import eden dosyalar yalnız testler (`employeeImport.test.ts:10-12`, `employees.wc.test.ts:9`, `pdksBatches.test.ts:11`, `employeeListShared.test.ts:6-7`); Convex bunları fonksiyon olarak paketlemiyor. Bekçi testi: `employeeListShared.test.ts:18-27` |
| `convex/tsconfig.json:26` test hariç tutma | Tip kapsamı kaybı yok | Testler hâlâ `tsconfig.app.json:30-33` (`include: src, convex`) ile, yani CLAUDE.md'deki kapı komutuyla tip denetleniyor. Hariç tutma, `convex dev`'in kendi tsc'sinin testlerdeki frontend import'larında durmasını önlüyor |

## Not

- **N1** `beginGatewayGrants` artık kişi ile cihaz farklı projedeyse (taşıma) rezervasyon döndürmüyor (`hikvisionSync.ts:1350-1351`; upsert `undefined` dönüyor). Eskiden mevcut satırın generation'ı yine de dönüyordu. Şimdi bitiş yazımı `expectedGeneration` olmadan atlanıyor (`:1365`). Bu daha doğru bir davranış; yalnız kayıt amaçlı not edildi.
- **N2** `finishGatewayGrants` içinde `expectedGrantId` hedef uyuşmazlığı throw ediyor (`grantStatus.ts:115`), bu da 500'lük grubun tümünü geri alıyor. Haftalık planın `catch` yolu aynı satırlarla yeniden deneyince yine throw eder (`hikSyncEmployee.ts:640-644`). Bu yalnız bir programlama hatasında olur, çünkü id aynı çiftin rezervasyonundan geliyor; yine de `skip` + audit daha dayanıklı olur.
- **N3** Cleanup artık kişi başı anında değil, 20 kişilik grup bitince çalışıyor (`hikSyncEmployee.ts:627-632`). Aradaki pencerede bayat bir failed silme işi claim edilirse `claimLocalBridgeOperations:643` ve `protectQueuedDeletion:1275` güncel durumu kontrol edip koruyor, yani yanlış silme yok.
- **N4** Haftalık plan çiftleri hâlâ `!data?.employee.cardNumber` ile süzülüyor (`hikSyncEmployee.ts:602`). Kartsız ama `hikEmployeeNo`'lu kişi cihaza gönderiliyor (`syncEmployeeDevices` `hikPersonIdentity` kullanıyor) ama rezervasyonu olmadığı için grant durumu güncellenmiyor. Bu turda gelmedi; D9 matrisinde "Eksik" kalabilir. Düzeltme: süzgeçte `hikPersonIdentity(data.employee)` kullanmak.
