# Kapı Planları — Denetim Raporu (Claude, salt-okuma, 2026-10-23)

**Özet:** Kod derleniyor, testler yeşil, yetki/kiracı izolasyonu sağlam. Yanlış plan *içeriği* gönderen bir hata bulmadım (gün/segment, gece yarısı bölme, ≤8 sınırı, revizyon yarışı doğru). Asıl risk: kaydetme her seferinde **doğrulama planını da** cihaza gönderiyor; kullanıcı dokunmasa bile okuyucuların doğrulama zamanlamasını (CardReaderPlan) sıfırlıyor ya da ilk kez yazıyor. Yayından önce bunu düzeltin ya da NGS0002'de doğrulayın.

Sayılar: **Yüksek 1 · Orta 4 · Düşük 7**

## Kapılar (kendi koşumum)

| Kapı | Sonuç |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 0 hata (exit 0) |
| `tsc --noEmit -p convex/tsconfig.json` | 0 hata (exit 0) |
| `eslint src convex` | 0 hata, 1 uyarı (mevcut, `convex/attendanceCorrections.test.ts:8` unused var) |
| `vitest run` | 353/353 dosya, 3891/3891 test geçti |
| `node scripts/find-node-leak.mjs` | exit 0 |

---

## YÜKSEK

### Y1 — Her kaydetme, kullanıcı dokunmasa da okuyucu doğrulama planını cihaza yazıyor
- **Yer:** `src/components/access-control/door-plans/DoorPlanDialog.tsx:126,133` (her zaman `hikVerifyPlan` + `sendPlans(["status","verify"])`), `door-plans/bulk.ts:41`, `CopyDoorPlansDialog.tsx:76-81` (şablon kaynağında da verify gönderiliyor), `convex/lib/gatewayCommand.ts:878-905`.
- **Kanıt:**
  1. Doğrulama planı hiç kurulmamış kapıda (`hikVerifyPlan` yok) dialog varsayılan `{enabled:false}` kaydeder ve `applyVerifyPlan` çağırır → kapının **her okuyucusuna** `PUT /ISAPI/AccessControl/CardReaderPlan/<readerNo> {templateNo:0}` gider. Belge (fp.txt:12345 civarı, 10.3.6.1): `0` = "şablon bağını kaldır, varsayılana dön". Hik terminallerinde okuyucular genelde fabrika şablonu 1'e bağlıdır (`readers.hikCardReaderPlanTemplateNo` bunu tutuyor, `LocationDoorItem.tsx:35` "Plan N" gösteriyor). Yalnız durum planını değiştirmek isteyen kullanıcı okuyucunun doğrulama zamanlamasını sıfırlıyor.
  2. Eski yol `PUT /ISAPI/AccessControl/VerifyPlan/<doorNo>` kullanıyordu (eski kodda "VERIFY: path netleştirilmedi" notu; belgede böyle bir uç nokta yok) → canlıdaki `hikVerifyPlan` kayıtları büyük olasılıkla **cihaza hiç ulaşmadı**. Yeni yol belgeye uygun; yani yayından sonra ilk kaydetmede bu eski planlar cihaza **ilk kez** yazılacak ve `VerifyWeekPlanCfg/<readerNo>` + `VerifyPlanTemplate/<readerNo>` slotlarının üzerine yazacak (okuyucu 1 için genelde fabrika şablonu 1).
  3. Plan penceresi dışındaki saatlerde (ör. 08–18 dışı) cihazın hangi doğrulama modunu kullanacağı belgede yazmıyor; boş segmentler `enable:false` gidiyor (`plans.ts:166-175`).
  4. Cihaz `isSupportCardReaderPlan` döndürmüyorsa kapı her kaydette "Hata" durumuna düşer, çünkü `recordPlanResult` doğrulama sonucunu da bekliyor (`convex/doors.ts:626`).
- **Öneri:** (a) Dialog/kopya yalnızca **değişen** planı kaydedip göndersin; `hikVerifyPlan` yoksa ve kullanıcı açmadıysa `verify` anahtarını hiç gönderme. (b) Bağı kaldırmak (`templateNo:0`) yalnızca daha önce bizim bağladığımız okuyucuda yapılsın (`hikCardReaderPlanTemplateNo === readerNo` kontrolü ya da gönderim izi). (c) Yayından önce NGS0002'de dene: okuyucunun `CardReaderPlan` değerini oku (fetchReaderCfg) → durum planını kaydet → okuyucunun doğrulama modu değişti mi bak.

## ORTA

### O1 — Capability kapısı belgeden daha katı; şimdiye kadar çalışan durum planı gönderimi kırılabilir
- **Yer:** `convex/lib/gatewayCommand.ts:759-775`, `:870-875`; `convex/lib/gateway/plans.ts:223-243`.
- **Kanıt:** Belge 7.7.2.1 (fp.txt:2904-2906): `isSupportDoorStatusPlan=true` ise cihaz "şablonu da destekler". 7.4.2.2 (fp.txt:2603-2605): `isSupportVerifyPlanTemplate=true` ise "haftalık planı da destekler". Kod ise her alt bayrağın **açıkça** `true` dönmesini istiyor (`DoorStatusWeekPlanCfg`, `DoorStatusPlanTemplate`, `VerifyWeekPlanCfg`). Belge kendi içinde de tutarsız: 7.4.2.3 (fp.txt:2621-2626) olumlu bayrak için `isSupportCardRightWeekPlanCfg`, olumsuz için `isSupportVerifyWeekPlanCfg` diyor. HEAD'de durum planında hiç capability kontrolü yoktu. Cihaz alt bayrağı döndürmezse gönderim sessizce "Bu cihaz istenen zaman planını desteklemiyor" hatasına döner. Güvenli tarafta kalıyor (yanlış plan gitmiyor) ama gerileme riski var.
- **Ayrıca:** `status !== 200` (cihaz çevrimdışı, gateway hatası) durumunda da kullanıcı "desteklemiyor" mesajı görüyor (`plans.ts:237-242`); bu yanıltıcı.
- **Öneri:** Üst bayrak (`isSupportDoorStatusPlan` / `isSupportCardReaderPlan` + `isSupportVerifyPlanTemplate`) yeterli olsun; alt bayraklarda yalnızca açık `false` engellesin. Haftalık doğrulama için `isSupportCardRightWeekPlanCfg` de kabul edilsin. 200 dışı yanıtta "Cihaz yeteneği okunamadı (çevrimdışı?)" mesajı verilsin. NGS0002/K1T804'ün `/ISAPI/AccessControl/capabilities` yanıtında bu bayraklar var mı, bakın.

### O2 — Kapı numarası (hikDoorNo) değişince "Gönderildi" durumu yanlış kalıyor
- **Yer:** `convex/doors.ts:296-306` (`update`), `EditDoorDialog.tsx:79-84`.
- **Kanıt:** Cihazlar → Kapıyı Düzenle'den `hikDoorNo` değişince plan revizyonu artmıyor ve `hikPlanResults` temizlenmiyor. Planlar cihazda eski kapı/okuyucu numarasına bağlı kalıyor, yeni numarada plan yok; listede ise "Gönderildi" görünüyor. Kapı başka cihaza taşındığında (`deviceId`) da `hikDoorHolidaySlots` eski cihazın slotlarını tutuyor. `reserveHolidaySlots` bu durumda "slotlar başka kapıyla çakışıyor" diye kalıcı hata verebilir (`doors.ts:668`).
- **Öneri:** `update` içinde `hikDoorNo` ya da `deviceId` değişirse `hikPlanRevision+1`, `hikPlanResults: undefined` ve `deviceId` değiştiyse `hikDoorHolidaySlots: undefined` yapılsın (+ test).

### O3 — "Şablon değişti — yeniden gönder" uyarısı yanlış zamanda da çıkıyor
- **Yer:** `convex/doors.ts:593`.
- **Kanıt:** Koşulun ilk kısmı `ownTemplate.updatedAt > (status.appliedAt ?? "")`. Kaydedilip henüz gönderilmemiş, gönderimi başarısız olmuş ya da yeniden kaydedilmiş (sonuçlar temizlenmiş) her şablonlu kapıda `appliedAt` boş, bu yüzden şablon değişmediği halde uyarı çıkıyor. İkinci kısım (`updatedAt !== hikDoorStatusTemplateUpdatedAt`) tek başına doğru sinyal.
- **Öneri:** Yalnızca ikinci kısım kalsın; "gönderilmedi" durumu zaten Gönderim kolonunda var.

### O4 — Tatil planı, haftalık planla saniye düzeyinde tutarsız ve boş grupla gönderilebiliyor
- **Yer:** `convex/lib/gateway/plans.ts:300-305`, `gatewayCommand.ts:787-807`.
- **Kanıt:** (a) Haftalık planda `23:59:59` → `24:00:00` dönüşümü var (`normalizeEndTime`), tatil planında yok. Her tatil gününün son saniyesi haftalık plana düşüyor; etkisi küçük ama tutarsız. (b) Seçilen yılda tatil yoksa (`ranges=[]`) `holidayPlanNo: ""` olan grup yazılıyor ve şablona bağlanıyor. Belgede `holidayPlanNo` opsiyonel; firmware'in boş CSV'yi kabul edip etmediği bilinmiyor.
- **Öneri:** Tatil segmentinde de `normalizeEndTime` kullanılsın. `ranges.length===0` ise grubu yazmak yerine `holidayGroupNo` boş gitsin.

## DÜŞÜK

1. **L1** `DoorPlansTab.tsx:22-32`: `modes` haritasında yeni resmi değer `faceAndCard` yok. Yeni kayıtlarda doğrulama özeti ham `faceAndCard` olarak görünüyor. Öneri: `faceAndCard: "Kart + Yüz"` ekleyin.
2. **L2** `DoorPlansTab.tsx:157-165`: kapı adı `Button variant="link"` (altı çizili). Tablo satırı kuralına göre (src/lib/tableRowClick.ts, memory feedback_table_row_click) isimde alt çizgi olmamalı, satır zaten tıklanabilir. Öneri: düz metin + satıra `tabIndex`/klavye erişimi.
3. **L3** `convex/doors.ts:556-557` / `doorStatusPlan.ts:155`: şablon 8 aralığı aşarsa `normalizeWeek`/`splitOvernight` düz `Error` atıyor (ConvexError değil). İstemci genel "Server Error" görüyor. Öneri: ConvexError'a sarın.
4. **L4** `doors.update` (`devices.manage`) hâlâ `hikDoorStatusPlan`/`hikVerifyPlan` kabul ediyor (`doors.ts:266-267`). `accessRules.manage` yetkisi olmayan biri planı DB'ye yazabilir ama gönderemez. UI artık bunu kullanmıyor. Öneri: Faz 3'te bu argümanları kaldırın ya da aynı yetkiye bağlayın.
5. **L5** `convex/doors.ts:622`: `[...].filter(Boolean)` kullanılmış. Bu string dizisi olduğundan CLAUDE.md'deki Doc|null kuralını doğrudan ihlal etmiyor; tutarlılık için `(e): e is string => !!e` kullanılabilir.
6. **L6** `src/components/access-control/door-plans/PHASE2_REPORT.md`: rapor dosyası `src/` altında. Commit'e girmemesi için `.claude/` ya da `docs/` altına taşıyın.
7. **L7** `plans.ts:245-262` `getHolidayCapacity`: `as Record<string, unknown>` cast'leri var (any değil, eslint temiz). Önceki `typeof` kontrolü olduğundan güvenli; bilgi notu.

## Doğru bulunanlar (kanıtlı)
- **Gün/segment:** `buildDoorStatusSegments` boş günleri göndermiyor; `setDoorStatusWeekPlan` her gün için 8 slot yazıp boşları `enable:false` yapıyor, yani eski segmentler temizleniyor (`plans.ts:58-73`). Eski tek pencere 7 güne yayılıyor (`doorStatusPlan.ts:120-129`).
- **Gece yarısı ve sınırlar:** Gece yarısını geçen aralık şablon çevriminde bölünüyor (Pazar→Pazartesi dahil, `accessSchedule.ts:37-46`). `24:00` → `23:59:59` → cihazda `24:00:00` oluyor. Gün başına ≤8 sınırı ve çakışma kontrolü hem istemcide hem sunucuda var (`doorStatusPlan.ts:88-101`).
- **Şablon güvenliği:** Şablon→plan çevrimi sunucuda yapılıyor, istemcinin `weekly` değerine güvenilmiyor. Şablonun proje ve arşiv durumu kontrol ediliyor (`doors.ts:550-556`).
- **Revizyon yarışı:** Aksiyon kapıyı bir kez okuyup o revizyonu gönderiyor. `recordPlanResult` eski revizyonda yanlış "başarılı" yazmıyor, yeniden gönderim istiyor (`doors.ts:617-623`). Sonuç sunucuda internal mutation ile yazılıyor; istemci sonuç yazamıyor.
- **Direkt ve kuyruk yolu aynı:** İkisi de `sendStoredDoorStatusPlan`/`sendStoredVerifyPlan` kullanıyor (`hikQueueWorker.ts:214-224`). Kuyrukta kapı başka cihaza taşındıysa "eşleşmiyor" diye duruyor. Durum planında `doorNo+100` şablon slotu korunmuş.
- **Yetki ve kiracı izolasyonu:**
  - `updatePlans` ve `listPlanTargets`, `accessRules.manage` + üyelik üzerinden proje izolasyonu sağlıyor (`permissions.ts:71-80`).
  - Apply aksiyonları ayrıca `isProjectAllowed`, `device.projectId===door.projectId` ve `brand==="hikvision"` kontrol ediyor.
  - Başka projenin kapısına yazma yolu bulamadım. Toplu işlemde her kapı ayrı yetki kontrolünden geçiyor; ≤50 sınırı yalnız istemcide ama her çağrı zaten yetkili.
  - Rol etkisi: `technician` iki yetkiye de sahip; yalnız `devices.manage`'i olan özel rol artık plan gönderemez (bilinçli değişiklik).
- **ISAPI gövdeleri (fp.txt):**
  - `DoorStatusWeekPlanCfg` (10555-10600), `DoorStatusPlanTemplate` (10396-10415: `templateName` req, `holidayGroupNo` string req), `DoorStatusHolidayPlanCfg` (10140-10175), `DoorStatusHolidayGroupCfg` (9945-9960: `groupName` req, `holidayPlanNo` CSV), `VerifyWeekPlanCfg` (13132-13175), `VerifyPlanTemplate` (12921-12945) ve `CardReaderPlan` (12338-12350: `templateNo` req) alan adları ve tipleri belgeyle uyumlu.
  - `CardReaderPlan` için "cardReaderID = templateNo" kuralı (fp.txt:2586-2587) uygulanmış.
  - Eski `cardAndFace` değeri resmi `faceAndCard` değerine çevriliyor.
- **UI:**
  - Sekme `can("accessRules.manage")` ile kapılı (`UnifiedAccessControl.tsx:19,69-71`). Boş durum ve yükleniyor durumu var.
  - Tek kapıda hata gösterimi ve "Tekrar gönder" yalnız başarısız planı yeniden gönderiyor. Toplu sonuç listesi ve yalnız başarısızı tekrarlama var.
  - Kodda `any` yok, alan adları camelCase, Doc|null dizilerinde type guard kullanılmış (`doors.ts:603`).

## Cihazda doğrulanmadı (yayın öncesi NGS0002, Emre onayıyla)
1. Durum planını kaydetmek okuyucunun CardReaderPlan/doğrulama modunu değiştiriyor mu (Y1)?
2. `/ISAPI/AccessControl/capabilities` yanıtında hangi `isSupport*` bayrakları geliyor (O1)?
3. Doğrulama planı penceresi dışındaki saatlerde okuyucu hangi modla çalışıyor?
4. Tatil planı haftalık plana göre öncelikli mi; boş tatil grubu kabul ediliyor mu (O4)?
