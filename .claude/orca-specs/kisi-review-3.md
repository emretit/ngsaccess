# Kişiler düzeltmeleri — 3. tur kısa denetim (salt okuma) — 2026-11-27

Özet — Engel yok. E2b, D11, D6 kapandı; D5 ve D9 büyük ölçüde kapandı ama her birinde 1 dar yan etki var (Düzeltilmeli D5b, D9b). Cihazda yanlış kişiyi silme, projeler arası sızıntı veya `deviceSyncUpdatedAt`'in genel API dönüşüne çıkması bulunmadı.

Doğrulama: `git diff` + yeni dosyalar (statik) ve 10 test dosyası tek koşuda `vitest run` → **333/333 geçti** (hikRevocation, employeeFaces, employeeDelivery, employeeCardChange.imported, ideGatewayDevice.cardRules, hikvisionSync.cardOnly, employeeImport, peopleHikSnapshot, orphanGuards, hikSyncEmployee.identity). Tam vitest/tsc koşulmadı (talimat gereği). DB/cihaz testi yapılmadı.

## Kalemler

| Kalem | Durum | Kanıt |
|---|---|---|
| E2b 25+ üyeli kural silme/pasifleştirme | **Kapandı** | `accessRules.ts:143` `employeeNo: snapshot.employeeNo` · validator `:166` · snapshot'a geçiyor `:175` · hata kaydı `:180` `employeeNo ?? cardNumber`. `hikSnapshotValidator` alanı taşıyor (`peopleHikSnapshot.ts:67`). Test `hikRevocation.test.ts:681` (remove + inactive, 26 üye, kartsız "7" ve kartlı `PERSON-i` ikisi de cihazdan siliniyor) |
| D11 global kimlik koruması | **Kapandı** | Yeni `hikIdentityReassigned` (`peopleHikSnapshot.ts:180`): `by_project_hikEmployeeNo` proje içinde, `by_card` global ama `projectId === projectId` süzgeci. Çağıranlar cihaz projesini veriyor: `employeeFaces.ts:139` (plan), `:209` (yürütme), `hikvisionSync.ts:422-428` `physicalCardReassigned` → `actions/hikvisionSync.ts:30`. Testler `employeeFaces.test.ts:219`, `hikRevocation.test.ts:700` |
| D5 eski kartsız import IDE yer tutucusu | **Kapandı (kart değişiminde)** — bkz. D5b | `actions/ideGatewayDevice.ts:130` `hikCardless` ise IDE'ye yazmıyor; `lib/employeeCardChange.ts:36-39` kart atanınca eski yer tutucu IDE'den siliniyor (`wasCardless`'tan bağımsız) |
| D6 aynı yer tutucu kartı yeniden gönderme | **Kapandı** | `employeeImport.ts:162-164` ve `employees.ts:584-593` yalnız `cardChanged` ise çağırıyor; kütüphanede ek savunma `lib/employeeCardChange.ts:24` (`hikCardless && kart aynı` → hiçbir şey yapma) |
| D9 teslim matrisi | **Büyük ölçüde kapandı** — bkz. D9b | `employeeDelivery.ts:57` `deviceSyncUpdatedAt` (yedek `updatedAt`); `:58-60` kimlik eşleşmesi `hikPersonIdentity`; `:98-104` IDE `card_invalid` sorgusu (`ideSync.ts:32` ile aynı anahtar). Damga yalnız cihaz alanları değişince basılıyor (`employeeListFields.ts:43-44`), eski kayıt ilk ilgisiz düzenlemede donduruluyor (`:46`) |

`deviceSyncUpdatedAt` sızıntısı: `publicEmployee` ayıklıyor (`employeeListFields.ts:34`), üç genel dönüş bunu kullanıyor (`employees.ts:166,263,337`). Ham kişi dokümanı dönen genel sorgu bulunmadı (`getByEmailInternal` vb. yalnız internal). Ayrıca kişi kayıtlarına raw `ctx.db.patch` / `replace` ile cihaz alanı yazan yol bulunmadı, hepsi `patchEmployee`'den geçiyor → damga atlanmıyor.

## Engel

Yok.

## Düzeltilmeli

**D5b — Eski kartsız import IDE'de yer tutucuyla duruyorsa pasifleştirme/süre değişikliği artık panele gitmiyor.**
`actions/ideGatewayDevice.ts:130` `hikCardless === true` ise sync'i tümden atlıyor. Eski kodla IDE'ye yer tutucu kartla (ör. "5") yazılmış kişi pasifleştirilince (`employees.ts:602-607` → `syncEmployeeToIdePanels`) ya da `accessExpiresAt` değişince artık `status 0` / yeni pencere gönderilmiyor; IDE kaydı aktif kalıyor. Kişi silme (`employees.ts:625-635`) ve kuraldan çıkarma (`accessGraph.ts:61-86`, kimlik yer tutucu olduğu için snapshot'a giriyor) hâlâ siliyor. Fiziksel risk düşük (yer tutucu, kişinin taşıdığı bir kart değil; ama aynı numaralı bir Wiegand kart kapıyı açabilir).
Düzeltme: `hikCardless && cardKey(cardNumber)` durumunda atlamak yerine `deleteIdeUserFromPanels` ile (`employeeId` vererek) yer tutucuyu silmek, ya da tek seferlik temizlik migration'ı.

**D9b — Yüz/parmak izi değişikliği matristeki tüm cihazları "Eksik" gösteriyor.**
Biyometri yazımları damgayı ilerletiyor: `employeeFaces.ts:157,184`, `fingerprintEnrollment.ts:189`, `employeeFingerprints.ts:34`. Ama `accessGrantStatus` yalnız kişi/kart işlemlerinden güncelleniyor (`hikvisionSync.ts:508,524`, `ideSync.ts:372-776`); `addFace`/parmak izi işlemleri grant yazmıyor ve matris işlem listesine de girmiyor (`employeeDelivery.ts:43` yalnız `addPerson/updatePerson/addCard`). Sonuç: yüz yükleyince Hik cihazları ve biyometri hiç almayan IDE panelleri dahil hepsi bir sonraki kişi senkronuna kadar "Eksik" (yeniden dene düğmesi de yok, `:84` yalnız `failed`). Bu, D9'un ilk şikâyetinin (ilgisiz düzenleme her şeyi "eksik" gösteriyor) dar bir tekrarı.
Düzeltme: biyometri yazımlarında `deviceSyncUpdatedAt` basmamak (biyometri teslimi kendi kartında, `employeeFaces.listForEmployee`, zaten izleniyor), ya da damgayı kişi/kart ile biyometri olarak ikiye ayırmak.

## Not

- **N1** `protectCurrentCredential` (`hikvisionSync.ts:1244`) silinen kişinin bugünkü kimliği işteki kimlikten farklıysa (`source.hikEmployeeNo` dolu) silmeyi koruyor ve "superseded" sayıyor. Düzeltmeden önce kart kimliğiyle kuyruğa girmiş eski bir `deletePerson` işi, kişi sonradan `hikEmployeeNo` aldıysa (eşleşen import) hiç çalışmaz ve eski kart-kimlikli cihaz kaydı kalabilir. Dar bir geçiş durumu; yeni işler doğru kimliği taşıyor.
- **N2** `hikIdentityReassigned` sayısal kimlikte 20'ye kadar sıfır dolgulu varyantı da arıyor ("01" ↔ "1"). Hik `employeeNo` string olduğundan bu fazladan koruma yapıyor (silmeyi atlama yönünde); yalnız gerçek çakışmada etkili, ihmal edilebilir. Her kimlik için ≤40 indeks okuması, mevcut sınırlar içinde.
- **N3** `deleteIdeUserFromPanels` kart değişiminde `employeeId` olmadan çağrılıyor (`employeeCardChange.ts:38`, `:53` mevcut yolda da aynı). Bu durumda `enqueueIdeUserRemoval` (`accessRules.ts:96-99`) `idePanelUsers.managedByNgsplus` satırı ister; roster aynası yoksa eski kart/yer tutucu silinmez. Önceden de böyleydi, bu turda gelmedi.
- **N4** 2. tur Not'ları (N5 grant kimliği, N6 import eşleşmesi kart yedeği, N7 `visitorPass` `by_card`, N8 arama taraması) bu turda ele alınmadı; hiçbiri Engel değil.
