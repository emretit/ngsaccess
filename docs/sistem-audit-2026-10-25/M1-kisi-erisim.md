# M1 — Kişiler, erişim kuralları ve ziyaretçi audit'i

## 1. Sonuç

Hik kart/kural/kişi silme ve silinen kişi için yeniden deneme zincirleri önceki audite göre belirgin biçimde düzelmiş; ziyaretçinin cihazdaki bitiş saati ve kart iadesi zinciri tamamlanmamış. Yeni rol modelinde kişi uçları üzerinden erişim/ziyaretçi yetkilerinin aşılması, kişi proje taşımasında eski cihaz erişiminin bırakılması ve IDE'nin aynı sayıya çevirdiği farklı kart metinleri öncelikle ele alınmalı. **Yeni bulgular: P0: 4, P1: 4, P2: 2, P3: 1; toplam 11**; eski açıklar bu sayıya tekrar eklenmedi.

Başlangıç tabanı: `520ba5fc`, 25.10.2026; `git log --oneline -120` ve çalışma ağacı okundu. Audit sırasında başka oturum `5de547a8` (mobil talepler) ve `77bce329` (dokümanlar) commitlerini ekledi; son HEAD `77bce329`, M1 kaynak dosyaları bu iki committe değişmedi. Bu worker rapor dışındaki dosyalara dokunmadı, commit yapmadı; canlı DB/cihaz/ağ/deploy kullanılmadı. KESİN, kaynak kodundaki davranışın kesinliğidir; sahada kaç kişinin etkilendiğini göstermez.

## 2. Modül haritası

| Alan | Dosyalar / giriş noktaları | Tablolar | Sayfa / ekran |
|---|---|---|---|
| Kişi yaşam döngüsü | `convex/employees.ts`, `employeeImport.ts`, `employeeTermination.ts`, `lib/employeeCascade.ts`, `peopleRelations.ts`, `employeeCardChange.ts` | `employees`, `groupMembers`, `employeeAuth`, `employeeSessions`, `shiftAssignments`, `shiftPlanRefs`, `cardReadings` | `Employees.tsx`, kişi formu/detayı/tablosu, Excel diyalogları |
| Organizasyon | `departments.ts`, `positions.ts`, `lib/departmentTree.ts` | `departments`, `positions`, `departmentShiftAssignments` | Departman ağacı, kişi organizasyon alanları |
| Erişim kuralları | `accessRules.ts`, `lib/accessRuleRead.ts`, `accessRuleWrite.ts`, `accessGraph.ts`, `peopleHikSnapshot.ts` | `accessRules`, `groupMembers`, `groupDevices`, `groupDoors`, `devices`, `doors` | `AccessControl.tsx`, `UnifiedAccessControl`, kural düzenleyicisi |
| Saat ve dağıtım kanıtı | `accessScheduleTemplates.ts`, `accessGrantStatus.ts`, `lib/accessSchedule.ts`, `ruleSchedule.ts`, `grantStatus.ts` | `accessScheduleTemplates`, `accessGrantStatus`, `deviceSyncRuns`, `deviceSyncRunTargets` | Zaman Şablonları, Yetki Durumu, gönderim çalışmaları |
| Ziyaretçi | `visitors.ts`, `lib/visitorStatus.ts`, `visitorPresence.ts`, `accessScopeRelations.ts`; bağlantı: `mobileVisitors.ts` | `employees(isVisitor)`, `employeeConsents`, `groupMembers`, `cardReadings` | `Visitors.tsx`, ziyaretçi kayıt/detay, mobil ön kayıt |
| Biyometri/rıza | `employeeConsents.ts`, `employeeBiometrics.ts`, `employeeFingerprints.ts`, `employeeFaces.ts`, `fingerprintEnrollment.ts`, `actions/hikFingerprint.ts` | `employeeConsents`, `employeeFaces`, `employeeFingerprints`, `deviceFingerprintEnrollments`, dosya deposu | Rıza ve parmak izi kartları, biyometri sütunu |
| Etkinlik | `peopleActivity.ts`, `lib/peopleActivity.ts` | `cardReadings`, Hik/IDE kuyrukları, `idePanelUsers` | Kişi son geçişleri; eski senkron sorgusunun uygulama çağrısı yok |

**Public uç kontrol özeti:** Kişi `list/getById` → `employees.view`; create/update/remove/bulkDelete/bulkUpdateDepartment ve import/assignCards → `employees.manage`; export kaydı → `reports.view`. İşten ayrılma/geri alma → `employees.manage`; departman yazmaları da artık bu yetkiyi istiyor (`departments.ts:30,60,94`). Pozisyon yalnız okuma ucu içeriyor.

Kural create/update/remove/createWithGroups/updateWithGroups/updateWithGroupsTracked ve şablon create/update/duplicate/archive/remove → `accessRules.manage`; liste/detay/üyelik/şablon okumaları proje üyeliğiyle sınırlandırılıyor. Yetki Durumu okumaları `accessRules.manage`, yeniden dağıtım seçili/hatalı için aynı yetki, tüm proje için `devices.manage` istiyor (`accessGrantStatus.ts:182`).

Ziyaretçi create/update/checkOut/releaseCard → `visitors.manage`; liste/özet/detay/preset/KVKK metni proje kapsamlı. Rıza grant/revoke/document ve parmak begin/cancel/remove/resend uçlarında proje + ilgili biyometri/kişi yetkisi var; parmak şablonu okuma/yazma yalnız internal. Parmak hedefi aktif kişi, aynı proje, aktif kural, cihaz desteği, proje biyometri ayarı ve açık rızayı birlikte denetliyor (`fingerprintEnrollment.ts:54`); gönderim sonrası kayıt da aynı kontrolü tekrarlıyor (`:265`). Alternatif kişi uçları ve ziyaretçi silme sözleşmesi aşağıdaki istisnalar.

**Arka plan / HTTP:** Ziyaretçi bitişi 5 dakikada bir, ayrılma TR 00:05, parmak silme tekrar taraması günlük (`convex/crons.ts:66,98,100`). Kişi/kural değişimi scheduler üzerinden Hik/IDE'ye gider. M1'in ayrı HTTP yazma rotası yok; fiziksel kart olayları `convex/http.ts` → `cardReadings.processCardReading` → `lib/processCardReadingCore.ts`; mobil uçlar ayrı çalışan oturumu kullanır.

## 3. Yeni bulgular

| ID | Önem | Tür | Yer (file:line) | Ne oluyor (kullanıcı gözünden) | Kanıt (kısa) | Öneri | Emek | Güven |
|---|---|---|---|---|---|---|---|---|
| K-01 | P0 | YETKİ | `convex/employees.ts:198,231,281,329`; `convex/lib/roleCatalog.ts:82`; `convex/accessRules.ts:928` | Erişim kurallarını yönetemeyen İK kullanıcısı kişi formundan istediği mevcut kurala kişi ekleyip fiziksel erişim verebilir. | İK varsayılanında `employees.manage` var, `accessRules.manage` yok; kişi create/update yalnız ilkini arar, `upsertGroupMembership` üyelik ekler ve cihaz gönderimi tetiklenir. Aynı üyelik değişikliği kural ucunda ikinci yetkiyi ister. | `accessRuleId` ile yeni üyelik eklenirken `accessRules.manage` ara; formdaki kural seçimini aynı yetkiyle sınırla. | M | KESİN |
| K-02 | P0 | EKSİK | `convex/employees.ts:294,320,329,351`; `convex/hikvisionSync.ts:100`; `convex/lib/peopleHikSnapshot.ts:41` | İki projede yetkili kullanıcı kişiyi B projesine taşıdığında A projesindeki kart erişimi cihazda kalabilir; eski ilişkiler daha sonra da bulunamaz. | API `projectId` değişimini kabul eder. Örneğin kişi üzerindeki tekil ilişki alanları boş, üyeliği sonradan kural ekranından `groupMembers` ile eklenmiş kişi taşınabilir; eski snapshot yalnız kart değişince alınır, salt proje değişimi gönderim koşuluna girmez. `groupMembers`, grant geçmişi, auth/biyometri kayıtları taşınmaz; yeni sorgular B projesiyle arar. Aynı istekte B kuralı verilirse üyelik hâlâ `emp.projectId` (A) ile yazılır. | Açık bir taşıma akışı tasarlanana kadar proje değişimini reddet; sonra eski cihaz/kart snapshot'ı, üyelikler, oturumlar ve tarihsel kayıt politikasıyla atomik taşı. | L | KESİN |
| K-03 | P0 | YETKİ | `convex/employees.ts:147,162,281,408`; `convex/employeeImport.ts:101`; `convex/visitors.ts:244,387`; `convex/lib/visitorStatus.ts:69` | Ziyaretçi yönetimi verilmeyen kullanıcı alternatif kişi API'siyle ziyaretçi kartını okuyabilir; kişi düzenleme yetkisi varsa ziyaretçiyi değiştirebilir/silebilir. | `getById` ziyaretçi kaydını `...emp` ile döndürür, ziyaretçi detayındaki kart/TC maskesi uygulanmaz. update/remove/bulkDelete/assignCards `isVisitor` için `visitors.manage` istemez; update yalnız `accessStartsAt` alanını ziyaretçide engeller. Viewer için kart ifşası, İK için ziyaretçi değiştirme yolu var. | Ortak kayıt türü yetkilendirmesi kullan; genel kişi uçlarında ziyaretçiyi reddet veya ziyaretçi yetki/doğrulama/maskesini uygula. | M | KESİN |
| K-04 | P0 | TUTARSIZ | `convex/employees.ts:46`; `convex/employeeImport.ts:113`; `convex/actions/ideGatewayDevice.ts:131,208`; `convex/ideSync.ts:150` | `00123` ve `123` iki ayrı kişiye kaydedilebilir ama aynı IDE paneline aynı kişi kimliği olarak gönderilir; izinler ve geçişin sahibi karışabilir. | Tekillik tam metin eşitliğiyle; IDE `Number(cardNumber)` kullanıyor, iki değer de `userRecord.id=123`. İçe aktarma/toplu atama bunu reddetmez. Olay eşleştirme yeniden tam metin arar (`cardReadings.ts:455`). | IDE hedeflerine atamadan önce sayısal kimlik çakışmasını denetle; gösterim metni ile cihaz kimliğini ayrı tut ve bütün kart yollarında ortaklaştır. | M | KESİN |
| K-05 | P1 | EKSİK | `convex/lib/employeeCascade.ts:27,33`; `convex/employees.ts:317,402`; `convex/lib/peoplePhoto.ts:12`; `convex/files.ts:77` | Kişiyi veya profil fotoğrafını silmek/değiştirmek eski profil fotoğrafı dosyasını silmiyor. | Cascade yalnız `employeeFaces.pictureStorageId` siler; `employees.photoStorageId` silinmez. Fotoğraf sahiplenilince `pendingUploads` kaydı tüketilir, günlük temizlik sadece bu kuyruğu tarar; eski profil dosyası bu temizliğe de girmez. | Fotoğraf değişimi/kaldırma/kişi silmede referans denetimli dosya temizliği ekle; saklama politikası varsa görünür kıl. | M | KESİN |
| K-06 | P1 | TUTARSIZ | `src/components/visitors/VisitorManagement.tsx:25`; `src/components/visitors/VisitorSlideOverPanel.tsx:59,94`; `convex/employees.ts:413` | Güvenlik rolü ziyaretçi kaydedip sonlandırabiliyor, fakat ekranda sunulan “Ziyaretçi kaydını sil” işlemini bitiremiyor. | Düğme `visitors.manage` ile görünür; çağrı `employees.remove` ve sunucu `employees.manage` ister. Varsayılan güvenlik rolünde bu yetki yok. K-03'ün ters yöndeki UI/sunucu uyumsuzluğu. | Ziyaretçi silmeyi uygun tür kontrollü uçta `visitors.manage` ile yürüt; düğme ve sunucu aynı kararı kullansın. | S | KESİN |
| K-07 | P1 | EKSİK | `convex/employees.ts:364,395`; `convex/lib/employeeUx.ts:11`; `convex/visitors.ts:397`; `convex/lib/accessScopeRelations.ts:41` | Ev sahibi kişi silinince ziyaretçi kaydı kırık ev sahibiyle kalır; ev sahibini de değiştirmeden süre/not gibi düzenlemeler hata verir. | Silme bağımlılıkları auth/oturum/vardiya; `hostEmployeeId` ters bağı temizlenmez. Ziyaretçi update mevcut ev sahibini yeniden doğrular ve `db.get` null olduğu için reddeder. Manuel çıkış ayrı uç olduğundan çalışabilir. | Ev sahibi silinirken bağlantıyı kaldır veya silmeyi bağlı ziyaretçiler çözülene kadar engelle; geçmiş isim politikasını belirle. | M | KESİN |
| K-08 | P1 | PERF/KOTA | `convex/employees.ts:98,104,395`; `convex/lib/employeeCascade.ts:58,62`; `convex/visitors.ts:214` | Büyük projede kişi ekranı veya çok geçişi olan kişiyi silme işlemi kaynak sınırına takılabilir. | Kişi listesi bütün projeyi alıp her kişi için departman/pozisyon ve tekrarlanan yetki okumaları yapar. Silme bütün kişinin olaylarını tek transaction'da okuyup tek tek yazar; 50 kişilik toplu silme sınırı olay sayısını sınırlamaz. Ziyaretçi özeti de her kaydı tarar. | Listeyi sunucuda sayfala, proje yetkisini bir kez hesapla; önce erişimi kapatıp kişisel veri temizliğini ilerlemesi izlenen parçalara böl. | L | OLASI |
| K-09 | P2 | TUTARSIZ | `convex/employees.ts:463`; `convex/lib/grantStatus.ts:84`; `convex/accessGrantStatus.ts:24,56` | Departmanı değişen kişi Yetki Durumu'nda eski departman altında görünmeye devam edebilir. | Grant satırının `departmentId` kopyası yalnız grant sonucu yazılırken güncellenir. Tekli/toplu departman değişimi bunu güncellemez; filtre ve görünen departman bu eski alanı kullanır. | Departman değişiminde grant kopyalarını güncelle veya filtreyi güncel kişi alanından türet. | M | KESİN |
| K-10 | P2 | TUTARSIZ | `src/components/employees/hooks/useEmployeeFormSubmit.ts:157`; `convex/actions/hikvisionSync.ts:60`; `src/components/employees/import/EmployeeImportDialog.tsx:103` | İK kişi kaydettiğinde normal yetkileriyle “cihaz gönderimi tamamlanamadı” mesajı alır; import sonundaki gönderim de yetki yüzünden reddedilir. | Form kayıttan sonra koşulsuz `syncEmployeeToDevices` çağırır; bu `accessRules.manage` ister. Import düğmesi `devices.manage` isteyen proje resync'e gider. İK'da ikisi de yok; kişi create backend'i zaten internal gönderim planlar. | Yetkiye göre sonucu göster; otomatik gönderim işini izlet, kullanıcının çalıştıramayacağı ek çağrıyı/düğmeyi kaldır. | S | KESİN |
| K-11 | P3 | ÖLÜ KOD | `convex/peopleActivity.ts:31`; `src/components/employees/EmployeeRecentReadings.tsx:20` | Eski kişi senkron durumu için maliyetli ikinci bir hesaplayıcı tutuluyor; güncel uygulama bunu kullanmıyor. | `api.peopleActivity.employeeSyncStatus` için src/mobile/convex uygulama çağrısı bulunmadı; görünen bileşen yalnız `employeeRecentReadings` çağırıyor. Yetki Durumu ayrı `accessGrantStatus` kaynağından geliyor. | Harici istemci kullanımı yoksa ucu kaldır; varsa tek durum kaynağına yönlendir. | S | KESİN |

K-04'ün kesin kanıtı iki farklı kaydın aynı cihaz kimliğiyle gönderilmesidir; cihazın hangi yazmayı son kabul ettiği ve fiziksel kart etkisi canlı teyit gerektirir. K-08'de sınırlandırılmamış iş miktarı kodda kesindir, mevcut veri hacminde hata oluştuğu iddia edilmemektedir.

## 4. Modüller arası ilişkiler

| Karşı modül | Bağ (tablo/fonksiyon) | Yön | Sorun var mı (file:line) |
|---|---|---|---|
| M2 cihaz/senkron | Kişi/kural → `hikvisionSync.getEmployeeWithDevices` → `lib/hikSyncEmployee` → gateway persons/cards | M1 → M2 | Kişi taşıma K-02; ziyaretçi/ayrılma bitişi senkron şeklinde yok (`hikvisionSync.ts:159`); başlangıç artık taşınıyor. |
| M2 IDE | `syncEmployeeToIdePanels`, `deleteIdeUserFromPanels`, `idePendingOperations`, `idePanelUsers` | Çift yön | Sayısal kart çakışması K-04; silme işinde kişi kimliği eksik olan ziyaretçi ve ayrılma dalları durum tablosunu güncellemiyor (`visitors.ts:513`, `employeeTermination.ts:35`, `lib/grantStatus.ts:97`). |
| M2 yeniden dağıtım | `accessGrantStatus.redistribute` → `createGrantRun/executeGrantTarget` | M1 → M2 → M1 | Silinmiş Hik kişi artık eski silme işiyle yeniden deneniyor (`deviceSyncRuns.ts:761,791`); aynı destek silinmiş IDE kişi için yok. |
| M2 erişim kararı | `groupMembers/groupDevices/groupDoors`, `accessRules`, `accessScheduleTemplates` | M1 → M2 | Hik silme snapshot'ı kapı bağı + uygulanmış grant geçmişini kapsıyor (`peopleHikSnapshot.ts:37`). IDE geçersiz kapı seçimi tüm panel kapılarına düşmeye devam ediyor (`ideSync.ts:649`). |
| M3 PDKS | `employees.isActive/employmentEndDate/departmentId/shiftId`, `shiftAssignments`, `departmentShiftAssignments`, `shiftPlanRefs` | M1 → M3 | Ayrılma günü dahil politikası ortak; kişi silmede vardiya plan referansları temizleniyor (`employees.ts:398`). Departman silme yeni vardiya atamalarını da engelliyor (`departments.ts:98`). |
| M3 tarihsel plan | Güncel departman → `shiftResolver.resolvePlan` | M1 → M3 | Güncel departman eski tarihlere de uygulanıyor (`lib/shiftResolver.ts:130`); kişi formu bunu açıkça uyarıyor (`EmployeeFormFields.tsx:39`). Dönem dondurma ihtiyacı M3'e devir, yeni bulgu sayılmadı. |
| M3 olay/puantaj | `cardReadings` → `filterPdksReadings` | M2 → M3 | Biyometrik/kimliği belirsiz kaynakların hariç tutulması bilinçli; K-04 kimlik çakışması olayın kişisine etki edebilir. |
| M4 roller | `customFunctions`, `permissions`, `roleCatalog`, `userProjects` | M4 → M1 | Sarmalayıcı yalnız oturum getirir, izin handler'da; K-01/K-03/K-06/K-10 farklı girişler arasındaki eksikler. |
| M4 denetim/KVKK | `employeeConsents`, `auditLog`, `biometricDestruction`, `pendingUploads` | Çift yön | Parmak rızası iptali merkezi şablonu silip cihaz silmesini planlıyor; profil dosyası K-05, ham olay kişisel verisi eski A5/7 açık. |
| M5 mobil oturumu | `employees` + `employeeAuth` + `employeeSessions` → `getCurrentEmployee` | M1 → M5 | Pasif/ayrılmış/silinmiş kişi her istekte reddedilir (`lib/employeeAuth.ts:23`). Pasifleştirme/ayrılma mevcut oturumu silmez veya şifre sürümünü artırmaz; geri aktifleştirme ile süresi dolmamış token tekrar geçerli olabilir. Politika teyidi gerekir. |
| M5 ziyaretçi | `mobileVisitors.create` → pasif `employees(isVisitor, PRE:)`; web aktivasyonu → kural/kart/senkron | Çift yön | Ev sahibi silme K-07; aktivasyon preset/proje ve IDE kart biçimini kontrol ediyor (`visitors.ts:393,417`); mobil kayıt kendi başına fiziksel kart yetkisi üretmiyor (`mobileVisitors.ts:106`). |
| M5 talepler | `leaveRequests`, `attendanceCorrections`, `lib/requestRules`, `mobile/lib/**` | M1 kimliği → M5/M3 | Başlangıçta commit'siz WIP idi; audit sırasında başka oturum `5de547a8` ile commitledi. M1 bulguları bunlara dayandırılmadı; talep onay/ret ve mobil ekran doğruluğu M5/M3 kapsamında. |

**Sözleşme / zincir sorunları:**

1. Yetki kontrolü aynı nesneye giden bütün girişlerde aynı değil: kişi formu üyelik yaratıyor; ziyaretçi silme kişi API'sine gidiyor. K-01/K-03/K-06 birlikte kapatılmalı.
2. Kişinin proje alanını değiştirmek bağımlı kayıtları taşımıyor. Eski cihaz hedeflerinin yeni proje filtresinden önce dondurulması gerekli; yalnız form ilişkilerini doğrulamak yeterli değil (K-02).
3. Kartın gösterim değeri ile IDE cihaz kimliği farklı sözleşmeler; metinsel global tekillik sayısal tekilliği sağlamıyor (K-04).
4. Grant durumu cihaz onayıdır; ziyaretçi/ayrılma IDE silmelerindeki eksik `employeeId` eski “Etkin” satır bırakabilir. Departman kopyasının güncel kalması da ayrı sorun (K-09).
5. Parmak kayıt/dağıtım/rıza iptali ortak hedef denetimi ve tekrar silme zincirini kullanıyor. Eski yüz yolunda `assertBiometricSyncAllowed` sadece proje ayarını kontrol ediyor, yüz rızasını kontrol etmiyor (`hikvisionSync.ts:1103`); yüz rızası revoke da yalnız parmak türünde imha başlatıyor (`employeeConsents.ts:128`). Güncel yüz ekleme UI'ı bulunmadığından eski veri/aktif çağıran teyidi bölüm 7'de bırakıldı.

## 5. Eski audit durumu

Kaynak: `docs/genel-akis-audit/A-kisi-erisim.md` tamamı ve `OZET.md` Faz 1–2. Aşağıdaki A1/1 biçimi bölüm/adım numarasıdır; eski zaten TAMAM maddelerde DÜZELDİ, “uygun akış korunuyor” anlamındadır. Fiziksel teslim kanıtı gerektiren açıklar ayrıca belirtilmiştir.

| Eski madde | Durum | Güncel kanıt / kalan iş |
|---|---|---|
| A1/1 tek kişi oluşturma | DÜZELDİ | Proje/ilişki/ücret doğrulaması mevcut (`employees.ts:198,216`); yeni yetki yan yolu K-01. |
| A1/2 Excel önizleme/parçalı import | DÜZELDİ | 100 satır sınırı ve satır sonucu korunuyor (`employeeImport.ts:28,65`); test geçti. |
| A1/3 import sonrası cihazlara gönder | AÇIK | Import üyelik oluşturmaz (`employeeImport.ts:65`); proje gönderimi üyelerden başlar (`deviceSyncRuns.ts:154`); UI gönderim başlatıldı der (`EmployeeImportDialog.tsx:103`). Önce kural atama adımı gerekir. |
| A1/4 kart tekilliği ve biçimi | KISMEN | Toplu atama artık global çakışmayı reddeder (`employeeImport.ts:113`); çalışan yollarında IDE biçimi ön doğrulaması yok (`ideGatewayDevice.ts:131`). Sayısal eşdeğerlik K-04 yeni. |
| A1/5 kişi formundan kural ekleme | KISMEN | Teknik bağ var (`employees.ts:231`), yeni rol ayrımı K-01 ile bozuluyor. |
| A1/6 parmak izi kayıt/dağıtım | KISMEN | Rıza/aktif kişi/hedef denetimi ve şifreli merkez kayıt var (`fingerprintEnrollment.ts:54`, `employeeFingerprints.ts:17`); farklı model ve offline teslim teyidi gerekir. |
| A1/7 profil fotoğrafı → yüz tanıma | AÇIK | Profil ayrı (`peoplePhoto.ts:6`); yüz modülü yalnız internal getStorageRef sunuyor (`employeeFaces.ts:13`), erişilebilir yüz ekleme zinciri yok. |
| A1/8 form gönderim sonucu | AÇIK | Kart gönderimi başarısızken izlenen run yoksa sonuç `ok:true, grantError` olabilir, synced artar (`lib/hikSyncEmployee.ts:296,303,313`). UI teslimin doğrulanmadığını söylese de başarılı sayısı yanıltıcı kalır. |
| A2/1 kural yazma rolü | DÜZELDİ | Bütün kural yazmaları `accessRules.manage` ister (`accessRules.ts:694,733,814,892,928`). Kişi alternatif yolu K-01 ayrı. |
| A2/2 departman/kişi seçimi | AÇIK | Kalıcı üyelik kişi listesidir (`lib/accessRuleWrite.ts:49`); departman değişimi grup üyelerini değiştirmez (`employees.ts:463`). |
| A2/3 haftalık şablon | DÜZELDİ | Ortak saat hesabı ve IDE kapasite kontrolü var (`lib/accessSchedule.ts:49`, `accessScheduleTemplates.ts:70`); şablon testleri geçti. |
| A2/4 Hik kapı kapsamı | DÜZELDİ | Kapı seçimi resolver ve gateway RightPlan'a taşınır (`peopleHikSnapshot.ts:149`, `gateway/persons.ts:114`); fiziksel test ayrıca. |
| A2/5 IDE geçersiz kapı seçimi | AÇIK | Sayısal io çözülemezse tüm panel kapılarına düşer (`ideSync.ts:649,651`). Açık ama geçersiz seçimi güvenli ret yap. |
| A2/6 farklı taşıma yolları | KISMEN | Hik gateway/IDE/bulut farklı teslim biçimleri sürüyor. Windows ertelemesi bilinçli; Windows eşdeğerliği yeni hata sayılmadı. |
| A2/7 Etkin/Bekliyor/Hata | KISMEN | İzin kontrollü ekran ve cihaz onayı kaydı var (`accessGrantStatus.ts:15`, `lib/grantStatus.ts:78`); eski kart temizliği ve eski IDE kimliksiz işler tek tabloda tam temsil edilmiyor. |
| A2/8 yeniden dağıtım | KISMEN | Silinmiş Hik kişi eski silme işiyle destekleniyor (`deviceSyncRuns.ts:761,791`); silinmiş IDE kişi için bu yol yok, genel proje gönderimi tüm eski kayıtların temizliği değil. |
| A3/1 Hik/IDE fiziksel karar | DÜZELDİ | Cihaz kararının olay olarak kaydı korunuyor (`lib/processCardReadingCore.ts:94`); bulut pasifliği cihaz onayının yerini tutmaz. |
| A3/2 genel okuyucu tarih sınırı | DÜZELDİ | Ortak kişi tarih kontrolü generic kart dalında kullanılıyor (`lib/processCardReadingCore.ts:355`, `lib/mobileAccess.ts:55`). |
| A3/3 olay proje/kişi eşleştirme | DÜZELDİ | Kart adayı cihaz projesiyle filtrelenir (`cardReadings.ts:453`); yeni toplu kartlar global çakışmaz (`employeeImport.ts:116`). Legacy 20'den fazla aynı kart verisi teyit listesinde. |
| A3/4 canlı izleme kapı filtresi | AÇIK | Kapı filtresi hâlâ ioId ister (`cardReadings.ts:156,198`); Hik kapı eşdeğerliği yok. M2'ye devir. |
| A3/5 biyometri → PDKS ayrımı | DÜZELDİ | Ortak `lib/pdksSource.ts` politikası korunuyor; biyometriyi dışlama bilinçli. |
| A3/6 project_user webden kapı açma | DÜZELDİ | Açık sayılmıyor: bilinçli karar; yeni rol tablosunda `doors.open` varsayılan viewer yetkisi (`roleCatalog.ts:93`). |
| A3/7 çalışan mobil kapı açma | KISMEN | Kişi/kapı/saat kontrolü korunuyor, ayrılma tarihi de denetleniyor (`lib/mobileAccess.ts:55`); taşıma/model destek sınırları cihazda teyit edilmeli. |
| A3/8 mobil işlem sonucunu geri bulma | DÜZELDİ | İşlem kimliği/çalışan/proje kontrolü korunuyor (`mobileAccess.ts:110,126`); mobil ekran kapsamı M5. |
| A4/1 ortak kart değişimi | DÜZELDİ | Tekli/toplu kart ortak yardımcıya gider (`employees.ts:349`, `employeeImport.ts:126`). |
| A4/2 eski Hik kartını silme | KISMEN | Çalışan yolu eski snapshot ile delete + syncAfter yapar (`employeeCardChange.ts:27`); ziyaretçi update hâlâ yalnız yeni kartla sync yapar (`visitors.ts:447,467`), eski Hik kartını sabitlemez. |
| A4/3 eski IDE kartını silme | KISMEN | Eski kart açıkça gönderilir (`employeeCardChange.ts:18`); eski kart işlemi bilerek employeeId taşımaz, durum ayrı izlenmiyor. |
| A4/4 kişi ekranı ek kural | DÜZELDİ | Add-only açıklama var (`EmployeeFormFields.tsx:270`); rol açığı K-01 ayrı. |
| A4/5 üyeyi/cihazı kuraldan çıkarma | DÜZELDİ | Değişiklik öncesi hedef ve üyeler dondurulur (`accessRules.ts:976,987`), kalan yetkiye göre kaldırma yapılır; Hik regression testleri geçti. |
| A4/6 kuralı tamamen silme | DÜZELDİ | İlişkiler silinmeden Hik snapshot + IDE panel listesi alınır, sonra reconcile edilir (`accessRules.ts:855,862`). |
| A4/7 departman değişince erişim | AÇIK | Departman dinamik erişim bağı değil (`employees.ts:463`); eski üyelik kalır. Yetki Durumu departman kopyası K-09 ayrı. |
| A4/8 eski erişimi durum ekranında düzeltme | KISMEN | Seçili Hik eski kimlik işleri yeniden dağıtılabiliyor (`deviceSyncRuns.ts:793`); yeni kartın Etkin olması eski IDE kart silme kanıtı değildir. |
| A5/1 web hesap dondurma kapsamı | DÜZELDİ | Web hesabı ve çalışan hesabı ayrımı sürüyor (`accountAccess.ts`, `lib/employeeAuth.ts:10`); fiziksel kart iptali olarak yorumlanmamalı. |
| A5/2 ileri tarihli ayrılma | DÜZELDİ | Takvim doğrulaması ve son gün dahil davranış var (`employeeTermination.ts:51,73`); test geçti. |
| A5/3 tarih geçince tüm erişim | KISMEN | Mobil/genel kart gün sınırını cron beklemeden denetler (`employeeAuth.ts:26`, `mobileAccess.ts:55`). Cihaza employmentEndDate gönderilmez (`hikvisionSync.ts:159`); offline kart hâlâ teslim bekler. |
| A5/4 kişi silmede kapı bağlı Hik | DÜZELDİ | Snapshot groupDoors ve grant geçmişini de kapsar (`peopleHikSnapshot.ts:37,150`); kişi silme bunu kullanır (`employees.ts:365`). |
| A5/5 silinmiş kişi için tekrar silme | DÜZELDİ | Retry eski `employeeNo/cardNumber` kullanır (`hikQueueWorker.ts:145`); kişi yokken yeniden dağıtım da desteklenir (`deviceSyncRuns.ts:761`). |
| A5/6 parmak rızası iptali/pasiflik | KISMEN | Merkezi silme + eski cihaz kimliği + günlük sayfalı retry var (`employeeCardChange.ts:38`, `fingerprintEnrollment.ts:328`); fiziksel silme yanıtı teyit gerektirir. |
| A5/7 KVKK imha | KISMEN | Merkezi biyometri/silme kuyruğu mevcut (`biometricDestruction.ts:267`). Kişi cascade olayın yalnız isim/kart alanını maskeler, rawData kalır (`employeeCascade.ts:63`). Profil dosyası K-05 yeni. |
| A5/8 ayrılmayı geri alma | KISMEN | Aktifleştirip senkronlar (`employeeTermination.ts:87,91`), ayrılmada silinen parmak şablonu geri gelmez (`:29`); yeniden kayıt gerekir. |
| A6/1 mobil ön kayıt | DÜZELDİ | Pasif ön kayıt, fiziksel karta/yetkiye web aktivasyonu gerekli (`mobileVisitors.ts:106`, `visitors.ts:393`). |
| A6/2 yönetici kart/bölge/ev sahibi | DÜZELDİ | Proje/preset/IDE kart biçimi kontrolleri var (`visitors.ts:285,292`); ev sahibi yaşam döngüsü K-07 ayrı. |
| A6/3 cihazda geçerlilik aralığı | KISMEN | Gelecek başlangıç Hik ve IDE'ye yazılıyor (`lib/hikSyncEmployee.ts:270`, `ideGatewayDevice.ts:142`); bitiş yok, Hik varsayılan endTime kullanıyor (`gateway/persons.ts:111`). |
| A6/4 süre dolduğu anda kapanma | KISMEN | Genel bulut kartında kesin bitiş kontrolü düzeldi (`processCardReadingCore.ts:355`); fiziksel cihaz hâlâ cron/teslim bekliyor (`crons.ts:66`, `visitors.ts:565`). |
| A6/5 cron eski hedefi bulsun | DÜZELDİ | Hik silme artık güncel graf yanında önceki grant cihazlarını da okur (`hikvisionSync.ts:157`, `actions/hikvisionSync.ts:113`). IDE eski panel/kartı yakalamaya devam eder (`visitors.ts:559,572`). |
| A6/6 kart iadesi ve tekrar kullanım | KISMEN | Hik kuyruğa alınmış eski silmeleri yeni hak sahibi lehine korur (`hikvisionSync.ts:1119`). Fakat checkOut yalnız employeeId planlar, releaseCard/reclaim kartı daha snapshot alınmadan değiştirir (`visitors.ts:506,532,302`); yarış kapanmamış. |
| A6/7 ziyaretçi IDE Yetki Durumu | AÇIK | Silme payload'unda employeeId yok (`visitors.ts:513,572`); grant helper bunu atlar (`lib/grantStatus.ts:97`). |
| A6/8 ziyaretçi PIN/QR/tek geçiş | AÇIK | Web fiziksel kart ister (`visitors.ts:269,291`); mobil çalışan QR'ı ziyaretçiye verilen token değildir. |
| OZET 1.1 kural yazma/silme | DÜZELDİ | Kural uçları izin kontrollü (`accessRules.ts:694,814`); K-01 alternatif yol yeni. |
| OZET 1.2 kapı/bölge/okuyucu | DÜZELDİ | `doors.ts:276,300`, `zones.ts:46,64`, `readers.ts:74,126` yetki ve proje denetimleri mevcut. |
| OZET 1.3 tatil proje kapsamı | DÜZELDİ | `holidays.ts:12,24` proje kapsamlı okuma ve yazma yetkisi. |
| OZET 1.4 PDKS denetim geçmişi | DÜZELDİ | Çalışan erişimi + admin yetkisi + hedef/proje filtresi (`auditLog.ts:31,41,46`). |
| OZET 1.5 olay projesi / toplu kart | DÜZELDİ | `cardReadings.ts:453`, `employeeImport.ts:113`; alias K-04 ayrı. |
| OZET 1.6 ret testleri | KISMEN | `akisFaz1.authz.test.ts` ve rol testleri geçti; yeni alternatif kişi/ziyaretçi/üyelik yolları kapsanmıyor. |
| OZET 2.1 eski kart Hik silme | KISMEN | Çalışan dalı düzeldi (`employeeCardChange.ts:27`); ziyaretçi update eski kartı yakalamıyor (`visitors.ts:467`). |
| OZET 2.2 kural silmede geri alma | DÜZELDİ | `accessRules.ts:855,862`, `peopleHikSnapshot.ts:118`. |
| OZET 2.3 silinmiş kişi tekrar silme | DÜZELDİ | `hikQueueWorker.ts:145`, `deviceSyncRuns.ts:761`; silme işleri sıradan hatalar gibi otomatik dismissed yapılmıyor (`hikvisionSync.ts:1022`). |
| OZET 2.4 ziyaretçi bitişini cihaza yaz | AÇIK | Senkron kişi şekli yalnız başlangıç taşır (`hikvisionSync.ts:159`); Hik bitiş varsayılanı (`gateway/persons.ts:111`), IDE payload bitişsiz (`ideGatewayDevice.ts:208`). |
| OZET 2.5 fiziksel cihaz kabul testi | AÇIK | Bu audit canlı/cihaz testi yapmadı; aşağıdaki kabul listesi uygulanmalı. |
| Ortak kural notu: departments/shifts yazma rolü | DÜZELDİ (departments) | Eskiden ertelense de mevcut departman uçları `employees.manage` ister (`departments.ts:30,60,94`); artık yalnız oturum kontrolü değil. Shifts ayrıntısı M3 kapsamında. |

Eski raporun “en önemli 5 bulgu” eşlemesi: #1 → A4/2+A4/6+A5/4; #2 → A2/1+A3/6; #3 → A5/5; #4 → A6/3–7; #5 → A1/4+A3/3. Aynı sorunlar yeni K listesine tekrar yazılmadı.

## 6. Doğrulama ve test boşlukları

İzinli hedefli testler, yerel bellek içi test ortamında çalıştırıldı; canlı DB kullanılmadı:

- `vitest run convex/roles.people.test.ts convex/employees.accessStart.test.ts convex/employeeTermination.test.ts convex/employeeImport.test.ts convex/fingerprintEnrollment.test.ts` → **5 dosya, 120 test geçti**.
- `vitest run convex/hikRevocation.test.ts convex/akisFaz1.authz.test.ts convex/accessGrantStatus.test.ts convex/accessScheduleTemplates.test.ts` → **4 dosya, 242 test geçti**.

Toplam **362/362**. Yeni test dosyası yazılmadı; tam suite, tsc ve lint çalıştırılmadı. Geçen testler aşağıdaki eksik senaryoları doğrulamaz:

1. İK `employees.create/update(accessRuleId)` çağrısının erişim yetkisi yokken reddi; mevcut rol testi yalnız temsilci uçları deniyor (`roles.people.test.ts:46`).
2. Kişi uçlarına ziyaretçi ID'si verilince alan maskesi, yazma/silme/toplu kart yetkisi ve güvenlik rolünün UI silme akışı.
3. A → B kişi taşıma; eski cihaz silme işi, eski üyelikler, aynı istekte B kuralı, mobil oturum ve biyometri kapsamı.
4. `00123/123` çiftinin tekli/import/toplu atamada ve aynı IDE cihazına bağlamada çakışması; olayın doğru kişiye yazılması.
5. Profil dosyası değiştir/kaldır/kişi sil; dosya gerçekten kaldırılıyor mu ve başka referans korunuyor mu.
6. Ev sahibi silme/pasifleştirme/taşıma sonrası ziyaretçi düzenle/uzat/çıkış ve mobil davet geçmişi.
7. Ziyaretçi checkOut → hemen release/reclaim; kart değişimi; işten ayrılma IDE silme sonucunun grant durumuna yansıması.
8. Çok olaylı kişi silme, büyük proje liste/özet maliyeti ve departman değişiminden sonra grant filtre tutarlılığı.

## 7. TEYİT GEREK ve kapsam dışı

**Canlı/cihaz kabulü:** Hik eski kart → yeni kart, son kural silme, yalnız kapı bağlı kişi silme ve offline tekrar silme; IDE aynı sayıya dönüşen kartlar; ziyaretçi başlangıçtan önce/tam bitişte/offline süresi; iade edilen kartın anında yeni kişiye verilmesi. Kod incelemesi fiziksel yetkinin kalktığını kanıtlamaz.

**Biyometri:** Rıza iptali sırasında devam eden capture/push, offline silme ve farklı cihaz modelleri denenmeli. Eski `employeeFaces` verisi veya yüz sync çağıranı varsa yüz rızası iptalinin cihazdaki karşılığı ve rızasız tekrar dağıtım kontrolü ayrıca ele alınmalı (`employeeConsents.ts:128`, `actions/hikvisionSync.ts:202`, `hikvisionSync.ts:1103`); güncel UI'da yüz ekleme bulunmadığı için sahada aktif açık olarak sayılmadı.

**Veri/politika:** Legacy 20'den fazla aynı kart kaydı varsa `findDeviceCardEmployee.take(20)` doğru projeyi tarama dışında bırakabilir (`cardReadings.ts:456`); canlı veri okunmadı. Aktifleştirme/ayrılmayı geri alma sonrası eski mobil token'ın yeniden kullanılabilir olması isteniyor mu teyit edilmeli. Kişi silmede PDKS/izin/denetim geçmişi korunuyor, çalışan kaydı ve vardiya atamaları siliniyor; tarihsel rapor/kişisel veri saklama kararı M3/M4 ile netleştirilmeli. İşe giriş tarihi bağımsız bir alan olarak görünmüyor; `accessStartsAt` fiziksel erişim başlangıcıdır, PDKS işe giriş tarihi yerine kullanıldığı varsayılmadı (`schema.ts:89`).

**Kapsam dışı:** Bordro/puantaj hesap motoru, cihaz sürücüsü/ağ/firmware, hukuki uygunluk kararı, mobil talep WIP davranışları, Windows köprü ürünleştirme. Biyometrik olayların PDKS dışı kalması, viewer/project_user kapı açması ve IDE poll politikası bilinçli karar olarak korundu. Dış servis, Supabase, canlı deployment, cihaz, tarayıcı, paket kurulumu, git yazma işlemi ve kod değişikliği yapılmadı.
