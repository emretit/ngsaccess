# Kişiler düzeltmeleri — 2. tur denetim (salt okuma) — 2026-11-27

Özet 1/3 — E1 ve E3 kapandı; E2 küçük yollarda kapandı ama **25+ Hik üyeli kural silme/pasifleştirme yolunda hâlâ açık** (yeni Engel E2b).
Özet 2/3 — 1. turun 10 Düzeltilmeli kaleminden 7'si kapandı (D1, D2, D4, D7, D8, D10, D3 büyük ölçüde); D5, D6, D9 açık. Yeni 1 Düzeltilmeli: global kimlik kontrolü "başka kişiye ait" koruması olarak kullanılıyor → projeler arası yanlış pozitif.
Özet 3/3 — `hikPersonIdentity` undefined dönüşü tüm çağıranlarda doğru atlanıyor; `orphanGuards.test.ts:213` beklenti değişimi doğru (IDE'de kalıntı yok). Liste anahtar alanları API'ye sızmıyor; projeler arası IDOR bulunmadı.

Doğrulama: statik inceleme (git diff + yeni dosyalar) + 12 ilgili test dosyası `vitest run` → **308/308 geçti** (hikPersonIdentity, cardReadings.hikIdentity, hikvisionSync.cardOnly, employeeCardChange.imported, peopleHikSnapshot, hikSyncEmployee.identity, orphanGuards, cardIdentity, actions/hikDeviceImport, employees.wc, ideGatewayDevice.cardRules, hikRevocation). Tam vitest/tsc koşulmadı (talimat). DB/cihaz testi yok.

## 1. tur kalemleri

| Kalem | Durum | Kanıt |
|---|---|---|
| E1 kart↔cihaz kişi no tekilliği | **Kapandı** | `convex/lib/cardIdentity.ts:23-24` `by_card` + `by_hikEmployeeNo` (sayısal varyantlar dahil); create/update `employees.ts:83`, toplu kart `employeeImport.ts:156`, Excel `employeeImport.ts:79`, ziyaretçi `visitors.ts:391,524` hepsi bu yardımcıdan geçiyor |
| E2 silme yolu employeeNo | **Kısmen** — bkz. E2b | Snapshot `employeeNo` taşıyor `peopleHikSnapshot.ts:39,57`; `removeScopedPerson` employeeNo/cardNumber ayrı `hikSyncEmployee.ts:99-109`; erken dönüş `hikPersonIdentity` ile `actions/hikvisionSync.ts:115-118`; köprü payload `hikSyncEmployee.ts:103`; `deviceSyncRuns.ts:472,480,500,717`; transfer `accessTransfer.ts:105-117`; yanlış kişiyi silme koruması `hikvisionSync.ts:1238-1247` |
| E3 yüz/parmak olayı → kişi | **Kapandı** | `cardReadings.ts:506-511` önce `by_project_hikEmployeeNo`; canlı yol `cardReaderParse.ts:406,434` → `http.ts:147,270` → `processCardReadingCore.ts:88-93`; backfill `cardReadings.ts:866`. Eski importlar `CARD_FIELDS` içindeki `employeeNo` yedeğiyle `by_card`'dan eşleşmeye devam ediyor (`cardReaderParse.ts:8-18`) |
| D1 org imzası | Kapandı | `employeeListFields.ts:63-66` org anahtarı ID; isim sorgu anında `employeeListPage.ts:56-63` |
| D2 desteklenmeyen karakter | Kapandı | `employeeListKeys.ts:21` kod noktası yedeği, NBSP normalize `:14` |
| D3 arama/filtre sayfalamadan sonra | Büyük ölçüde | Okurken filtre + 2000 okuma bütçesi `employeeListPage.ts:47-53,107-122`; ziyaretçi anahtar kapsamı `E`/`V` ayrı `employeeListFields.ts:58`. Arama hâlâ tarama (Not N3) |
| D4 köprüde eski kart | Kapandı (reddederek) | `employeeCardChange.ts:31` localBridge'de kart değişimi hata; gateway'de kart-only silme `actions/hikvisionSync.ts:25-42` |
| D5 eski kartsız import IDE yer tutucu | **Açık** | `actions/ideGatewayDevice.ts:130` yalnız `cardKey` bakıyor, `hikCardless` yok; `employeeCardChange.ts:29` `!wasCardless` → yer tutucu IDE'den silinmiyor |
| D6 aynı yer tutucu kartı yeniden gönderme | **Açık (dar)** | `employeeImport.ts:162-164` / `employees.ts:585` → `employeeCardChange.ts:28` `hikCardless:false`; form `onlyChangedFields` ile tetiklemez, Excel toplu kart ve API tetikler |
| D7 import kural senkronu | Kapandı | `hikDeviceImport.ts:114-117` `targetEmployeeIds` |
| D8 form eski kayıtları kilitliyor | Kapandı | `useEmployeeFormSchema.ts:57` değişmeyen kart doğrulanmıyor |
| D9 teslim matrisi | **Açık** | `employeeDelivery.ts:55` hâlâ `updatedAt`; `:64,73` Hik op eşleşmesi `employee.cardNumber` (hikEmployeeNo kişide kaçar); IDE `card_invalid` sorgusu yok (`:87` yalnız `upsertUser`) |
| D10 2000 sınırına ziyaretçi | Kapandı | `employeeListPage.ts:37-42` `by_project_visitor` yalnız kişiler |

## Engel

**E2b — 25'ten fazla Hik üyeli kural silinince/pasifleşince içe aktarılmış kişiler cihazdan kaldırılmıyor.**
Kanıt: `convex/accessRules.ts:143` toplu gruplama `entries.push({ employeeId, cardNumber: snapshot.cardNumber })` — `employeeNo` düşüyor; doğrulayıcı `:166` alan yok; `:175` `snapshot: { cardNumber }` ile `reconcileHikRemovalEntry`; hata kaydı `:180` `employeeNo: entry.cardNumber`. Yol: `remove` `:959`, `update` `:1210` (`HIK_RECONCILE_BATCH = 25`, `:35`).
Senaryo a: "X mevcut kişiler" kuralı (cihazdan aktarılan tüm kişiler, tipik olarak 25+) silinir. Kartsız import (`cardNumber=""`, `hikEmployeeNo="5"`) → `planRemovedEmployeeHik` `peopleHikSnapshot.ts:99` kimlik yok → `devices: []` → hiç silme yok → kişi ve kapı yetkisi cihazda kalır.
Senaryo b: kartlı import (`hikEmployeeNo="7"`, kart `456`) → kimlik `456` → `deletePerson("456")` → `protectCurrentCredential` `hikvisionSync.ts:1240` (kaynak hikEmployeeNo 7 ≠ 456) → "superseded" sayılır, başarılı görünür, kişi 7 cihazda erişimle kalır.
≤25 üyeli yol (`:150-151`) tam snapshot geçtiği için doğru. `createRuleDiffRun` toplu yolu da doğru (`deviceSyncRuns.ts:472`).
Düzeltme: `entries`'e `employeeNo: snapshot.employeeNo` ekle (validator `:166`), `:175` snapshot'a ve `:180` hata payload'ına geçir. Test: 26 üyeli kural + kartsız/kartlı hikEmployeeNo kişi silme.

## Düzeltilmeli

**D11 — Global kimlik araması "eski kimlik başka kişiye ait" koruması olarak kullanılıyor → projeler arası yanlış pozitif, biyometri/kart cihazda kalıyor.**
`findDuplicateCard` global (`cardIdentity.ts:23-24`, proje filtresi yok) ve artık `hikEmployeeNo` da arıyor. Cihaz kişi no'ları cihaza yerel küçük sayılar ("1", "2"…) ve iki projede aynı no'yla aktarım serbest (`hikDeviceImport.ts:31` proje bazlı; `lib/hikDeviceImport.ts:31` yalnız `cardNumber` eşliyor).
- `employeeFaces.ts:138` yüz silme planı: başka projede `hikEmployeeNo="1"` varsa A projesindeki kişi "1"in yüz silme işi hiç oluşmaz (sessiz `continue`) → yüz şablonu cihazda kalır (KVKK).
- `employeeFaces.ts:206` aynı kontrol yürütmede hata atar.
- `hikvisionSync.ts:422-425` `physicalCardReassigned` → `actions/hikvisionSync.ts:29-30`: eski kart numarası başka projedeki birinin kart/kişi no'suyla çakışırsa eski kart silinmez → eski kart kapı açmaya devam eder.
Düzeltme: bu koruma çağrılarını cihaz projesiyle sınırla (`by_project_hikEmployeeNo` + `by_card` sonucu `projectId === device.projectId`), `protectCurrentCredential` (`hikvisionSync.ts:1238-1247`) zaten bu şekilde.

**D5, D6, D9** — 1. turdaki tarif ve düzeltmeler geçerli (tablo).

## Not

- **N1 (b) `hikPersonIdentity` undefined** — tüm çağıranlar atlıyor: `actions/hikvisionSync.ts:117,281`, `hikSyncEmployee.ts:134,652`, `hikQueueWorker.ts:152,178,196,210`, `hikFingerprint.ts:39,100,177`, `fingerprintEnrollment.ts:61` (hata), `employeeFaces.ts:52,137`, `deviceSyncRuns.ts:593,703`, `accessTransfer.ts:17,106`, `peopleHikSnapshot.ts:40,79,99,135`, `hikDeviceImport.ts:132`, `employeeCardChange.ts:81-82`. Küçük: `hikFingerprint.ts:177` kimliksizde `continue` `allOk=false` yapmıyor (kimlik yoksa push zaten anlamsız).
- **N2 (b) kartı silinen kişi** — formdan kart boşaltılamıyor (`employees.ts:512` `allowEmpty` yalnız zaten boşsa; `assignCards` boşu reddeder `employeeImport.ts:149`). Kart değişiminde eski kimlik ön-snapshot'la siliniyor (`employees.ts:545-546` → `employeeCardChange.ts:55-58` `employeeNo: previousCardNumber`); hikEmployeeNo kişide kart-only silme. `assignCards` ön-snapshot geçmiyor ama yeni kartla alınan snapshot aynı cihaz kümesini veriyor (kimlik dolu) → sorun yok.
- **N3 (b) `orphanGuards.test.ts:213`** — beklenti doğru. Fixture kişisi kartsız/kimliksiz; `snapshotRuleHikEmployees` (`peopleHikSnapshot.ts:134-135`) artık onu atlıyor → `reconcileRuleSnapshots` (`accessRules.ts:149-152`) IDE reconcile'ı da çağırmıyor. IDE kimliği `cardNumber` ve kartsız kişi IDE'ye hiç gitmez (`ideGatewayDevice.ts:130`), kart boşaltılamaz (N2) → kalıntı yok. `hikPersonIdentity` ⊇ "kartı dolu" olduğundan kartlı herkes hâlâ reconcile ediliyor. Kırılgan bağlantı: IDE reconcile Hik kimliğine bağlı; ileride IDE kimliği karttan ayrılırsa bozulur.
- **N4 (c) sızıntı/IDOR** — `publicEmployee` (`employeeListFields.ts:33-36`) `listKeys/listSearch/listVersion/listOrgSignature`'ı üç genel dönüşte ayıklıyor (`employees.ts:166,263,337`); ziyaretçi `getDetail` kendi satırını kuruyor (`visitors.ts:320`). `listSearch` zaten dokümanda olan ad/e-posta/kart/bordro kodundan türetilmiş, ücret içermiyor. `listPage`/`listPageWindow`/`listSummary`/`listLightForImport` `resolveProjectScope` + `requirePermission` ile başlıyor; imleç JSON'u her sorguda `eq("projectId")` altında kalıyor (`employeeListPage.ts:69,101,112`) → başka projeye taşamıyor; org adları yalnız aynı projeden (`employees.ts:219-223`). `hikEmployeeNo` artık API'de görünüyor (zararsız).
- **N5** `executeGrantTarget` (`deviceSyncRuns.ts:692-699`) `getPendingPersonDeletions` kimliğini `cardNumber` olarak snapshot'a koyuyor → `beginPersonDeletion` payload `cardNumber` = kişi no; `grantStatusForOperation` (`lib/grantStatus.ts:190,199`) mevcut kartla eşleşmediği için hikEmployeeNo kişide grant durumu güncellenmez (matris "eksik" kalır). Silme kendisi doğru.
- **N6** `lib/hikDeviceImport.ts:31-34` aynı projede `hikEmployeeNo` eşleşmesi yoksa `cardNumber` eşleşmesine bakıyor: Y (`hikEmployeeNo=9`, kart `456`) varken cihazda employeeNo'su `456` olan kişi Y'ye "matched" olur. Nadir (cihaz kişi no'su başka kişinin fiziksel kartına eşit); düzeltme: `relevant`'ta `hikPersonIdentity(employee)` kullan.
- **N7** `visitorPass.ts:34` sanal kart üretimi yalnız `by_card`; pass ziyaretçi cihaza gitmediği için etkisiz, tutarlılık için `findDuplicateCard`.
- **N8** Arama indexed modda hâlâ sayfa tarıyor (2000 okuma bütçesi); büyük projede "Devam" ile ilerliyor — kabul edilebilir, `searchIndex` sonraki iş.
