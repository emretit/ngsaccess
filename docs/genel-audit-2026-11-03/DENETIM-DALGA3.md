# Denetim 3: D4 (PDK-007, PDK-003) ve FIX2 (Y-02, Y-05, GK-04, Y-07, Y-11), 2026-11-04

**Sonuç:** 7 bulgunun 5'i kapandı, 2'si kısmen kapandı.
- **PDK-003 kısmen:** karar gereği geri doldurma yapılmadı ve belirsizlik bayrağı hiçbir yerde kullanılmıyor.
- **Y-02 kısmen:** `update` yolu zincire alındı, form yolu `saveWithGroups` hâlâ satır içi (FIX2 takibi sürüyor).

Düzeltmeler **5 yeni bulgu** getiriyor: **P0 ve P1 yok**, 5'i de P2 (3'ü olası). Değişen test beklentileri gerekçeli. Şüpheli beklenti yok.

Yöntem: `git diff HEAD` ve izlenmeyen `lib/doorTarget*.ts` okundu; çağıran ve tüketen yollar izlendi. Kapılar:
- `vitest`, D4: 3 dosya, 32/32 geçti
- `vitest`, FIX2: 5 dosya, 54/54 geçti
- `tsc -p convex`: 0 hata (10:56 tam ağaç koşumu)

FIX2 şu an test eklediği için tam kapı dalga sonunda koşulmalı. Canlı DB ve cihaz kullanılmadı.

---

## Tablo 1: Bulgu durumu

| ID | Durum | Kanıt (dosya:satır) / not |
|---|---|---|
| PDK-007 | Kapandı | `convex/lib/cardReadingProcess.ts:126-131`: gündüz vardiyasında (`end >= start`) yön ancak şu koşullarda `exit` oluyor: `exitMayCrossMidnight`, ertesi gün çıkış penceresi var ve okutma `validFixedPunch(validWindow, lastDate, now, "exit")` içinde. Eski gece toleransı bu yola eklenmiyor; pencere bitince sonuç `entry`. İş günü çözümü zaten destekliyordu (`pdksWorkDay.ts:46-52`: yönlü çıkış pencere içinde → önceki gün). Gece vardiyası dalı (`end < start`) değişmedi. Fiziksel yönü sabit noktalar (`accessDirection entry/exit`) ve IDE io 0/1 erken dönüyor, değişmedi. Kenar: N3-01. |
| PDK-003 | **Kısmen** (karar gereği) | Yeni sürüm adresi sürümle saklanıyor: `pdksRules.ts:176` Hik için `hikReaderNo`, IDE için `ioId`. `schema.ts:298` alanı ekliyor. `lib/pdksRules.ts:64-66`: adresli hedef güncel okuyucudan bağımsız; okuyucu düzenlenince, taşınınca ya da silinince geçmiş değişmiyor. IDE `ioId` ile Hik `hikReaderNo` karışmıyor: yayında tek biri yazılıyor, eşleştirmede `hikReaderNo` varsa yalnız `hikCardReaderNo` ile karşılaştırılıyor (`:36-38`). Adressiz eski hedef bugünkü numarayla çözülüp `addressUncertain` işaretleniyor (`:67-76`). **Kalan:** N3-02. Bayrak hiçbir yerde okunmuyor; uyarı yalnız güncel ve gelecek sürümler için üretiliyor. |
| Y-02 | **Kısmen** | `accessRules.ts:802-810`: `update` ile pasife alma `reconcileIdeRemovalBatch`'e (100'lük zincir, `:34-48`) ve ardından `reconcileIdeRosterPage`'e (100 satırlık sayfa, `:50-71`) gidiyor. Zincir her adımda güncel DB'den yeniden hesaplıyor; kural yeniden aktif edilirse sonraki adımlar silme planlamıyor. Yalnız `managedByNgsplus === true` ve yetkisiz kart siliniyor; yerel kişiye dokunulmuyor. **Kalan:** form yolu `saveWithGroups` (`:1144-1157`, `isActive === false` koşulu eklendi) hâlâ üye başına satır içi `syncEmployeeToDevicesInternal` + `reconcileRemovedEmployeeIde` planlıyor. Bu, üye başına yaklaşık 2–3 zamanlama demek; yaklaşık 350 üyenin üstünde Convex'in mutation başına zamanlama sınırı aşılır. FIX2'nin "≤100 legacy / 500 tracked" koruması kodda henüz yok (takip `task_15323bba1d47` sürüyor). |
| Y-05 | Kapandı | `doors.ts` güncelleme: `assertDoorTarget` yalnız `targetChanged` iken çalışıyor (`hikDoorNo/deviceId/ioId` değişince). Ad veya plan değişikliği mevcut çakışmaya takılmıyor. |
| GK-04 | Kapandı | Gönderim öncesi kontrol eklendi: `lib/doorTarget.ts:6-21` `assertDeviceDoorTargets`, şu yollardan çağrılıyor: `doors.ts:591` (`getByIdInternal`: kapı komutları ve durum planı), `:788` (`getDoorRightsOperation`), `lib/doorTargetSync.ts:81`. Kuyruk hatası Türkçe mesajla `lastError`'a yazılıyor (`actions/hikQueueWorker.ts:73-77`, yalnız `DOOR_TARGET_CONFLICT`). Kenar: N3-04. |
| Y-07 | Kapandı | `lib/doorTargetSync.ts:34-38`: cihaz geneli kurallar üye saymıyor; kişi başına iş yerine tek `syncDoorBlanketRule` açılıyor (`doors.ts`, Hik → `syncWeekPlanToDevicesInternal`, IDE → `syncPermissionToIdePanels`). Kişi silinmiyor. Hik yolu standart tam senkron (`syncEmployeeDevices`) olduğu için yalnız zaten pasif ya da kapsam dışı ngsplus çalışanları normal kurala göre kaldırılır. Yerel ve ngsplus dışı kişiler `removeScopedPerson` kapsamında değil. |
| Y-11 | Kapandı | `lib/doorTargetSync.ts:130-133`: IO ya da çalışan yoksa `finishTarget(skipped: "Panelde kalan kapı hakkı yok")` ve yetki durumu `removed`. |

---

## Tablo 2: Yeni bulgular

| # | Önem | Dosya:satır | Somut senaryo | En küçük düzeltme |
|---|---|---|---|---|
| N3-01 | P2 (Olası) | `convex/lib/cardReadingProcess.ts:126-131`; doğrulayıcı `lib/pdksFixedRules.ts:44-47` | Doğrulayıcı, ertesi gün çıkış penceresinin sonunun ertesi günün giriş penceresiyle örtüşmesini engellemiyor. **Örnek:** 09–18 vardiya, çıkış penceresi 17:00 → (+1) 10:00, giriş penceresi 08:00–10:00. Kişi dün çıkış okutmayı unuttu (son kayıt `entry`) ve bugün 09:00'da okuttu. Bu okutma artık `exit` yazılıyor, iş günü dün oluyor; bugünün girişi kayboluyor ve gün devamsız ya da eksik görünüyor. Önceden `entry` idi. | Yön çözümünde `pdksWorkDay`'deki `canOpenCurrent` mantığını kullan: bugünün vardiyası bu anı geçerli giriş sayıyorsa `entry` döndür. Ya da `validateFixedRules` içinde `exitEnd(+1) < sonraki checkInStart` şartı koy. |
| N3-02 | P2 | `convex/lib/pdksRules.ts:67-79`; `convex/pdksRules.ts:94-96, :112` | `addressUncertain` ve `checkpointAddressUncertain` hesaplanıyor ama hiçbir tüketici yok (tablo, rapor, arayüz). `getCheckpointWarnings` yalnız güncel ve gelecek sürümleri tarıyor. Okuyucu numarası saklanmamış **geçmiş** bir sürümün günleri bugünkü eşlemeyle sessizce yeniden hesaplanmaya devam ediyor. PDK-003 önerisinin "belirsizlik göster" yarısı karşılanmamış. | `loadPdksPolicies` sonucundaki `checkpointAddressUncertain` bilgisini PDKS tablo ve rapor yanıtına bayrak (`warnings`) olarak taşı. Ya da uyarı sorgusunda adressiz eski hedef taşıyan en az bir geçmiş sürüm varsa tek bir genel uyarı ver (`by_projectId_and_effectiveFrom` ile `take` sınırlı). |
| N3-03 | P2 (Olası; mevcut kalıp) | `convex/lib/accessGraph.ts:76-87`; `convex/actions/ideGatewayDevice.ts:~269-290` (`deleteIdeUserFromPanels`) | Silme action'ı çalıştığı anda yetkiyi yeniden kontrol etmiyor. **Örnek:** kural pasife alındı, batch silme action'ı A'yı planladı; kullanıcı hemen yeniden aktif etti ve `syncEmployeeToIdePanels` (S) planlandı. S, A'dan önce çalışırsa önce upsert sonra silme kuyruğa girer ve kart, kural aktifken panelden silinir. Zincirin sonraki adımları güvenli; risk yalnız zaten planlanmış A'da. | `deleteIdeUserFromPanels` içinde kuyruğa yazmadan önce `resolveEmployeeIdeDeviceIds` (ya da panel yetki kümesi) ile kartın hâlâ yetkisiz olduğunu doğrula; yetkiliyse atla. |
| N3-04 | P2 | `convex/doors.ts:590-591` (`getByIdInternal`) | Gönderim kontrolü cihazın **bütün** kapılarına bakıyor. Eski veride iki kapı (X, Y) aynı numarayı kullanıyorsa aynı cihazdaki ilgisiz Z kapısının uzaktan açma, durum planı ve doğrulama planı komutları da `DOOR_TARGET_CONFLICT` ile reddediliyor. Operasyonel kapı açma (acil durum dahil) çakışma düzeltilene kadar duruyor. | `assertDeviceDoorTargets(ctx, device, door)`: yalnız istenen kapının slotunu paylaşan kapılar varsa reddet; cihazdaki diğer çakışmayı uyarı olarak bırak. |
| N3-05 | P2 (verimlilik) | `convex/accessRules.ts:57-60` | `reconcileIdeRosterPage` her 100 satırlık sayfada `resolvePanelAuthorizedCards`'ı (panelin tüm kuralları ve üyeleri) baştan hesaplıyor. 3.000 kayıtlı panelde aynı yetki grafiği 30 kez okunuyor; büyük kural ve üye grafiğinde tek sayfa da okuma sınırına yaklaşabilir. | Sayfa boyutunu 500'e çıkar. Ya da yetkili kart kümesini ilk adımda hesaplayıp yalnız `managedByNgsplus` satırlarını tarayan zincire aday kart listesi olarak geçir. |

**Not (bulgu değil):**
- `syncDoorBlanketRule` Hik yolu bir kapı düzenlemesinde kuralın tüm üyelerini yeniden senkronluyor (20'li HTTP partileri). Bu, tasarımdaki "tek kural yeniden gönder" işi; mutation sınırına takılmıyor.
- `getByIdInternal` artık yetkisiz projede yanıt vermek yerine hata fırlatıyor (sızıntı önlemi); çağıranların hata metni değişti.

---

## Tablo 3: Değişen ve yeni beklentiler

| Test:satır | Değişiklik | Kontrol | Karar |
|---|---|---|---|
| `convex/pdksCheckpointWarnings.test.ts` (4 yer) | Uyarı listesine `uncertain:<reader>:2026-10-01` eklendi; `unknown/number/moved` korunuyor | Fixture eski (adressiz) seçim kullanıyor; yeni uyarı `pdksRules.ts:112`'den geliyor; mevcut uyarıların metni ve anahtarı aynı | Doğru |
| `convex/lib/cardReadingProcess.direction.test.ts` (yeni testler) | Ertesi gün pencere içinde `exit`, pencere sonrası `entry`; gece ve sabit yönler aynı | `validFixedPunch` üst sınırı `fixedExitEnd` (+1440); tolerans yok | Doğru (örtüşen pencere N3-01) |
| `convex/pdksRules.readerAddress.test.ts` (yeni) | Okuyucu numarası ya da kapısı değişince eski sürüm eşleşmesi korunuyor; eski hedef bugünkü numarayla çözülüp belirsiz işaretleniyor | `lib/pdksRules.ts:64-76` ile birebir | Doğru |
| `convex/doorStatusPlan.integration.test.ts` | Yalnız ekleme: çakışmada iş `failed` + "Diğer kapı" mesajı, gönderim yok | `hikQueueWorker.ts:73-77` + `getByIdInternal` kontrolü | Doğru |
| `doorTarget.test.ts`, `doorStatusPlan.queueErrors.test.ts`, `ideRoster.audit.test.ts` (yeni) | Kapı no tekilliği/kapasite, kuyruk hata mesajı, roster zinciri yalnız `managedByNgsplus` siliyor | Kodla tutarlı | Doğru |

## Convex kuralları
- Yeni `any`, `as any` ya da `!` görmedim.
- Yeni poll ya da cron yok.
- `doorTargetSync` okumaları sınırlı: `bounded` 100/200/500, kişi sınırı 200.
- `doors.ts` içindeki `internalAction` node gerektirmiyor.
- `getCheckpointWarnings` artık okuyucu `get`'ini yalnız adressiz hedefte yapıyor. Hik cihazı başına `cardReadings take(500)` ve `readers take(201)` sınırlı. Kayıtlı numarası olan cihazlar da taranıyor (en fazla Hik cihaz sayısı kadar sorgu); okuma patlaması yok.
