# Yetki / rol kontrol noktaları envanteri

Kaynak: `docs/roles/PLAN.md`; 2026-10-22 çalışma ağacı. **399 satır**, **149 dosya**. Sayılar aşağıdaki envanter satırlarını sayar; aynı fonksiyonun farklı amaçlı kapıları ayrı satırdır. Tip/yorum/indeks eşleşmeleri de kabul taramasını izlenebilir kılmak için açıkça etiketlenmiştir; bunlar çalışan yetki kapısı sayılmaz.

| Önerilen anahtar | Satır |
|---|---:|
| `employees.view` | 3 |
| `employees.manage` | 27 |
| `biometrics.manage` | 23 |
| `pay.view` | 21 |
| `schedule.manage` | 24 |
| `attendance.approve` | 24 |
| `reports.view` | 18 |
| `visitors.manage` | 6 |
| `doors.open` | 3 |
| `alarms.ack` | 2 |
| `devices.manage` | 70 |
| `accessRules.manage` | 31 |
| `admin.manage` | 55 |
| `super_admin` | 39 |
| `üye` | 53 |

## Karar gerekiyor (11)

1. Global kullanıcı rolü/hesap silme (`users.updateRole/deleteUser`): platform işlemi `super_admin` kalsın; proje rolü ve üyelik yönetimi `admin.manage` uçlarına ayrılsın.
2. Proje silme ve silme etkisi (`projects.remove/getDeletionImpact`): bugün owner veya super_admin; proje içi işlem için `admin.manage` önerilir, owner ayrıcalığı kaldırılmalı mı kararı gerekir.
3. Personelin işten ayrılma nedeni/SGK çıkış kodu (`employees.list/getById`): PLAN ücret dışı hassas İK alanını tanımlamıyor; `employees.manage` önerilir.
4. KVKK rızası, belge ve biyometri imhası: biyometrik rıza/şablon `biometrics.manage`; fotoğraf rızası `employees.manage`; modül/genel gizlilik ayarı `admin.manage` önerilir.
5. Senkron uyarısı kapatma (`hikvisionSync/ideSync.dismiss*`): bugün çoğunlukla her üyeye yazma açık; `devices.manage`, çözümsüz personel silme istisnasında `super_admin` önerilir.
6. Erişim durumu teşhisi ve yeniden dağıtım (`accessGrantStatus`, `deviceSyncRuns`): kural dağıtımı `accessRules.manage`, tüm proje cihaz senkronu `devices.manage`; sır içermeyen salt durum okuması `üye` olabilir.
7. Alarm e-posta ayarı/testi ve ziyaretçi KVKK metni: `alarms.ack`/`visitors.manage` yerine proje ayarı olduğu için `admin.manage` önerilir.
8. Zamanlanmış rapor/e-posta (`reports.saveReportSchedule`, `lib/reportScope`): `reports.view` önerilir; ücretli içerik `pay.view` ile ayrıca maskelenmeli, cron güncel yetkiyi yeniden denetlemeli.
9. İlk proje kurulumu (`onboarding.ensureProjectForNewUser`): mevcut proje admin.manage gerektirmeyen doğrulanmış hesap bootstrap istisnası `üye`; yeni projenin ilk admini atomik kurulmalı.
10. Ayarlar kapsayıcıları (`capabilities.settingsTabs`, `Settings`, `SettingsSidebar`): genel/kullanıcı/gizlilik `admin.manage`, PDKS `schedule.manage`, entegrasyon `devices.manage`, rapor `reports.view`, platform posta `super_admin` olarak ayrılmalı.
11. Genel yükleme ve gateway sağlık testi (`files.generateUploadUrl/claimUpload`, `pingHikGateway`): ortak altyapı `üye`; dosyayı personel/biyometriye bağlama amaç yetkisiyle, platform bilgisi içeren ping `super_admin` ile sınırlandırılmalı.

## Okuma notları

- `[SAHİPLİ]`: görevde belirtilen dosyalar; içerikleri okundu, değiştirilmedi. Diğer oturumların Faz 1 çekirdeği (`schema`, `permissions`, `roleCatalog`) tarama sırasında oluştu; bunlar mevcut çalışma ağacı bağlamıdır.
- `doc.projectId`: argümandaki employee/device/rule/door/shift kimliği sunucuda okunarak proje bulunur. `arg`: seçili proje argümanı (UI için aktif proje/prop). Liste kapsamı gerektiğinde `getProjectIdsForUser listesi` kullanılır. Projesiz kayda yalnız `super_admin` kuralı her anahtara ek koşuldur.
- Konum fonksiyon/bileşen başlangıcıdır; o fonksiyon içindeki aynı amaca ait tekrarlanan JSX ve rol kontrolleri aynı satırda toplanır. Ortak yardımcılar `internal` türüyle belirtilir; bu etiket tek başına Convex internal API kaydı demek değildir.
- `üye`: PLAN’da ayrı yetki tanımlanmayan okumalar ve kendi profil/tercih işlemleri. Personel okumaları `employees.view`; ücret okumaları ayrıca `pay.view`; rapor/dışa aktarım ayrıca `reports.view` gerektirir. UI bayrakları sunucu yetkisinin yerine geçmez.

## `convex/accessGrantStatus.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/accessGrantStatus.ts:12` | `authorize` | internal | requireAdmin | Erişim dağıtımı durumunu denetler | **`accessRules.manage`** | arg | Karar 6: teşhis/yeniden dağıtım accessRules.manage önerisi; sır içermeyen görüntüleme üye olabilir. |
| `convex/accessGrantStatus.ts:45` | `listByProject` | query | authedQuery → authorize | Projenin erişim dağıtımı durumunu listeler | **`accessRules.manage`** | arg | authorize → requireAdmin; karar 6. |
| `convex/accessGrantStatus.ts:89` | `counts` | query | authedQuery → authorize | Erişim dağıtım durumlarını sayar | **`accessRules.manage`** | arg | authorize → requireAdmin; karar 6. |
| `convex/accessGrantStatus.ts:146` | `byEmployee` | query | authedQuery + requireAdmin | Erişim dağıtımı durumunu denetler | **`accessRules.manage`** | doc.projectId | Karar 6: teşhis/yeniden dağıtım accessRules.manage önerisi; sır içermeyen görüntüleme üye olabilir. |
| `convex/accessGrantStatus.ts:180` | `redistribute` | mutation | adminMutation | Erişim dağıtımı durumunu yeniden uygular | **`accessRules.manage`** | arg | Karar 6: teşhis/yeniden dağıtım accessRules.manage önerisi; sır içermeyen görüntüleme üye olabilir. |

## `convex/accessRules.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/accessRules.ts:676` | `create` | mutation | adminMutation | Erişim kuralı oluşturur | **`accessRules.manage`** | arg | [SAHİPLİ]  |
| `convex/accessRules.ts:711` | `update` | mutation | adminMutation | Erişim kuralı günceller | **`accessRules.manage`** | doc.projectId | [SAHİPLİ]  |
| `convex/accessRules.ts:805` | `remove` | mutation | adminMutation + canAccessEmployeeProject + role karşılaştırması | Erişim kuralı siler | **`accessRules.manage`** | doc.projectId | [SAHİPLİ]  |
| `convex/accessRules.ts:870` | `createWithGroups` | mutation | adminMutation | Kuralı kişi ve cihaz üyelikleriyle oluşturur | **`accessRules.manage`** | arg | [SAHİPLİ]  |
| `convex/accessRules.ts:1173` | `updateWithGroups` | mutation | adminMutation | Kuralı ve bağlı üyeliklerini günceller | **`accessRules.manage`** | doc.projectId | [SAHİPLİ]  |
| `convex/accessRules.ts:1179` | `updateWithGroupsTracked` | mutation | adminMutation | Kuralı güncelleyip senkron çalışmasını izler | **`accessRules.manage`** | doc.projectId | [SAHİPLİ]  |

## `convex/accessScheduleTemplates.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/accessScheduleTemplates.ts:79` | `validateScheduleBinding` | internal | role karşılaştırması | Şablon bağlamanın rolünü ve projesini denetler | **`accessRules.manage`** | arg | — |
| `convex/accessScheduleTemplates.ts:104` | `create` | mutation | adminMutation | Erişim zaman şablonu oluşturur | **`accessRules.manage`** | arg | — |
| `convex/accessScheduleTemplates.ts:116` | `update` | mutation | adminMutation | Erişim zaman şablonu günceller | **`accessRules.manage`** | doc.projectId | — |
| `convex/accessScheduleTemplates.ts:134` | `duplicate` | mutation | adminMutation | Erişim zaman şablonu kopyalar | **`accessRules.manage`** | doc.projectId | — |
| `convex/accessScheduleTemplates.ts:143` | `setArchived` | mutation | adminMutation | Erişim zaman şablonu arşivler | **`accessRules.manage`** | doc.projectId | — |
| `convex/accessScheduleTemplates.ts:151` | `remove` | mutation | adminMutation | Erişim zaman şablonu siler | **`accessRules.manage`** | doc.projectId | — |

## `convex/accountAccess.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/accountAccess.ts:9` | `freezeUser` | mutation | adminMutation + requireAccountAccessTarget | Kullanıcının hesap erişimini dondurur | **`admin.manage`** | getProjectIdsForUser listesi | requireAccountAccessTarget hedefin bütün projelerini doğrular; çok projeli hesap platform istisnası korunmalı. |
| `convex/accountAccess.ts:23` | `unfreezeUser` | mutation | adminMutation + requireAccountAccessTarget | Kullanıcının hesap erişimini açar | **`admin.manage`** | getProjectIdsForUser listesi | requireAccountAccessTarget hedefin bütün projelerini doğrular; çok projeli hesap platform istisnası korunmalı. |
| `convex/accountAccess.ts:36` | `setAccessExpiry` | mutation | adminMutation + requireAccountAccessTarget | Kullanıcının erişim son tarihini değiştirir | **`admin.manage`** | getProjectIdsForUser listesi | requireAccountAccessTarget hedefin bütün projelerini doğrular; çok projeli hesap platform istisnası korunmalı. |

## `convex/actions/getChatData.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/actions/getChatData.ts:11` | `getCardReadings` | action | authedAction | Asistan için okutma örneklemi okur | **`üye`** | arg | — |
| `convex/actions/getChatData.ts:59` | `getDatabaseContext` | action | authedAction | Asistan için proje bağlamı okur | **`üye`** | arg | — |

## `convex/actions/hikFingerprint.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/actions/hikFingerprint.ts:31` | `enrollFingerprintOnDevice` | action | authedAction + isManager | Parmak izini kaydeder ve dağıtır | **`biometrics.manage`** | doc.projectId | — |
| `convex/actions/hikFingerprint.ts:87` | `removeFingerprintFromDevice` | action | authedAction + isManager | Cihaz parmak izini siler | **`biometrics.manage`** | doc.projectId | — |
| `convex/actions/hikFingerprint.ts:207` | `resendFingerprint` | action | authedAction + isManager | Parmak izini yeniden dağıtır | **`biometrics.manage`** | doc.projectId | — |
| `convex/actions/hikFingerprint.ts:220` | `removeFingerprint` | action | authedAction + isManager | Merkez ve cihaz parmak izini siler | **`biometrics.manage`** | doc.projectId | — |

## `convex/actions/hikGatewayDevice.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/actions/hikGatewayDevice.ts:35` | `registerDeviceOnGateway` | action | authedAction | Cihazı gateway sistemine kaydeder | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:70` | `removeDeviceFromGateway` | action | authedAction | Cihazı gateway sisteminden kaldırır | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:85` | `refreshGatewayDeviceStatus` | action | authedAction | Gateway cihaz durumlarını yeniler | **`devices.manage`** | yok | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:100` | `pingHikGateway` | action | authedAction | Gateway bağlantısını sınar | **`üye`** | yok | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:116` | `fetchDeviceCapabilities` | action | authedAction | Cihaz özelliklerini tarayıp kaydeder | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:129` | `remoteOpenDoor` | action | authedAction | Hikvision kapısını uzaktan açar | **`doors.open`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:146` | `rebootDevice` | action | authedAction | Cihazı yeniden başlatır | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:160` | `fetchDeviceWorkStatus` | action | authedAction | Cihaz çalışma durumunu kaydeder | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:188` | `backfillDeviceEvents` | action | authedAction | Cihaz olaylarını geçmişe aktarır | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:238` | `reconcileDevice` | action | authedAction | Cihaz ile merkez kayıtlarını karşılaştırır | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:271` | `captureCardFromDevice` | action | authedAction | Cihazdan kart numarası yakalar | **`employees.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:288` | `captureFaceFromDevice` | action | authedAction | Cihazdan yüz görüntüsü yakalar | **`biometrics.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:315` | `applyDoorStatusPlan` | action | authedAction | Kapı durum planını cihaza uygular | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:325` | `fetchReaderCfg` | action | authedAction | Okuyucu yapılandırmasını okuyup kaydeder | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |
| `convex/actions/hikGatewayDevice.ts:343` | `applyVerifyPlan` | action | authedAction | Doğrulama planını cihaza uygular | **`devices.manage`** | doc.projectId | Kapı çoğunlukla lib/gatewayCommand veya gatewayBackfill/gatewayReconcile yardımcısında. |

## `convex/actions/hikvisionSync.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/actions/hikvisionSync.ts:47` | `syncEmployeeToDevices` | action | authedAction | Personeli cihazlara yeniden dağıtır | **`accessRules.manage`** | getProjectIdsForUser listesi | rol kontrolü yok; yalnız hedef proje kapsamı denetleniyor. |

## `convex/actions/ideGatewayDevice.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/actions/ideGatewayDevice.ts:377` | `openIdeDoor` | action | authedAction | IDE kapısını uzaktan açar | **`doors.open`** | doc.projectId | rol kontrolü yok; yalnız hedef proje kapsamı denetleniyor. |
| `convex/actions/ideGatewayDevice.ts:417` | `triggerPanelSync` | action | authedAction + isManager | Panel eşitlemesini kuyruğa alır | **`devices.manage`** | doc.projectId | — |

## `convex/actions/openaiChat.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/actions/openaiChat.ts:40` | `processMessage` | action | authedAction | PDKS bağlamıyla yapay zekaya sorar | **`üye`** | arg | — |

## `convex/actions/sendEmail.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/actions/sendEmail.ts:141` | `sendEmployeeSetupEmail` | action | authedAction | Mobil personel aktivasyonunu yenileyip gönderir | **`employees.manage`** | arg | rol kontrolü yok; yalnız hedef proje kapsamı denetleniyor. |
| `convex/actions/sendEmail.ts:214` | `sendUserInviteEmail` | action | authedAction → internal.invites.create | Kullanıcı daveti üretip gönderir | **`admin.manage`** | arg | — |

## `convex/adminDevices.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/adminDevices.ts:19` | `list` | query | superAdminQuery | Platform cihazı listeler | **`super_admin`** | yok | — |
| `convex/adminDevices.ts:38` | `listForClaim` | query | adminQuery | Sahiplenilebilir platform cihazlarını listeler | **`devices.manage`** | yok | — |
| `convex/adminDevices.ts:71` | `register` | mutation | superAdminMutation | Platform cihazını seri numarasıyla kaydeder | **`super_admin`** | yok | — |
| `convex/adminDevices.ts:122` | `backfillExisting` | mutation | superAdminMutation | Eski cihazları platform envanterine ekler | **`super_admin`** | doc.projectId | — |
| `convex/adminDevices.ts:154` | `remove` | mutation | superAdminMutation | Platform cihazı siler | **`super_admin`** | doc.projectId | — |
| `convex/adminDevices.ts:216` | `adminListPage` | query | superAdminQuery | Platform cihazlarını sayfalı listeler | **`super_admin`** | yok | — |

## `convex/alarms.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/alarms.ts:66` | `acknowledge` | mutation | adminMutation | Seçilen alarmları onaylar | **`alarms.ack`** | doc.projectId | — |
| `convex/alarms.ts:86` | `getSettings` | query | adminQuery | Alarm e-posta ayarlarını okur | **`admin.manage`** | arg | — |
| `convex/alarms.ts:100` | `saveSettings` | mutation | adminMutation | Alarm e-posta ayarlarını kaydeder | **`admin.manage`** | arg | — |
| `convex/alarms.ts:130` | `testEmail` | mutation | adminMutation | Test alarmı ve e-posta isteği üretir | **`admin.manage`** | arg | — |

## `convex/attendanceCorrections.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/attendanceCorrections.ts:55` | `listPending` | query | adminQuery | Bekleyen PDKS düzeltmelerini listeler | **`attendance.approve`** | arg | — |
| `convex/attendanceCorrections.ts:72` | `decision` | internal | canAccessEmployeeProject | PDKS düzeltmesi kararını uygular | **`attendance.approve`** | doc.projectId | — |
| `convex/attendanceCorrections.ts:90` | `approve` | mutation | adminMutation | PDKS düzeltmesi onaylar | **`attendance.approve`** | yok | — |
| `convex/attendanceCorrections.ts:91` | `reject` | mutation | adminMutation | PDKS düzeltmesi reddeder | **`attendance.approve`** | yok | — |

## `convex/auditLog.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/auditLog.ts:24` | `getPdksAuditForEmployee` | query | adminQuery | Personelin PDKS değişiklik geçmişini okur | **`admin.manage`** | doc.projectId | — |
| `convex/auditLog.ts:76` | `list` | query | adminQuery + role karşılaştırması | Kayıt listeler | **`admin.manage`** | arg | — |
| `convex/auditLog.ts:76` | `list` | query | adminQuery + allProjects && role !== super_admin | Tüm projelerin denetim kaydını okur | **`super_admin`** | yok | allProjects=true için ayrı platform kapısı; normal tek proje admin.manage. |
| `convex/auditLog.ts:143` | `actorOptions` | query | adminQuery + role karşılaştırması | Denetim kaydı aktörlerini listeler | **`admin.manage`** | arg | — |
| `convex/auditLog.ts:143` | `actorOptions` | query | adminQuery + allProjects && role !== super_admin | Tüm projelerden denetim aktörü seçer | **`super_admin`** | yok | allProjects=true için ayrı platform kapısı; normal tek proje admin.manage. |

## `convex/auth.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/auth.ts:31` | `auth / Password.profile` | internal | Çalışan rol kontrolü yok | Rol metadata veya açıklamasını taşır | **`üye`** | yok | Çalışan bir rol kapısı değil; literal, indeks adı, yorum veya import eşleşmesi. |

## `convex/biometricDestruction.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/biometricDestruction.ts:51` | `previewBiometricDestruction` | query | adminQuery | Biyometri imha kapsamını önizler | **`biometrics.manage`** | arg | — |
| `convex/biometricDestruction.ts:76` | `startBiometricDestruction` | mutation | adminMutation | Proje biyometri imhasını başlatır | **`biometrics.manage`** | arg | — |
| `convex/biometricDestruction.ts:99` | `getDestructionRun` | query | adminQuery | Biyometri imha çalışması durumunu okur | **`biometrics.manage`** | arg | — |

## `convex/cardReadings.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/cardReadings.ts:279` | `assignCardFromReading` | mutation | adminMutation | Okutmadaki kartı personele atar | **`employees.manage`** | doc.projectId | [SAHİPLİ]  |
| `convex/cardReadings.ts:509` | `getEmployeeAttendanceDetail` | query | authedQuery + canSeePay + role karşılaştırması | Mesai ücretini koşullu hesaplar | **`pay.view`** | arg | [SAHİPLİ]  |
| `convex/cardReadings.ts:509` | `getEmployeeAttendanceDetail` | query | authedQuery + canSeePay + role karşılaştırması | Personelin devam ayrıntısını görüntüler | **`üye`** | arg | [SAHİPLİ]  |

## `convex/dashboard.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/dashboard.ts:37` | `getStats` | query | authedQuery + role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | arg | — |
| `convex/dashboard.ts:124` | `getTodayTimeline` | query | authedQuery + role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | arg | — |
| `convex/dashboard.ts:157` | `loadPdksDataset` | internal | role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | arg | — |
| `convex/dashboard.ts:572` | `getRecentReadings` | query | authedQuery + role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | arg | — |

## `convex/departments.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/departments.ts:21` | `create` | mutation | authedMutation | Departman oluşturur | **`employees.manage`** | arg | rol kontrolü yok; yalnız proje kapsamı. create projectId verilmezse orphan oluşturabiliyor. |
| `convex/departments.ts:48` | `update` | mutation | authedMutation + role karşılaştırması | Departman günceller | **`employees.manage`** | doc.projectId | rol kontrolü yok; yalnız proje kapsamı. create projectId verilmezse orphan oluşturabiliyor. |
| `convex/departments.ts:85` | `remove` | mutation | authedMutation + role karşılaştırması | Departman siler | **`employees.manage`** | doc.projectId | rol kontrolü yok; yalnız proje kapsamı. create projectId verilmezse orphan oluşturabiliyor. |

## `convex/deviceSyncRuns.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/deviceSyncRuns.ts:79` | `createRunInTransaction` | internal | requireAdmin | Proje veya kural senkronunu başlatır | **`devices.manage`** | arg | Karar 6: proje senkronu devices.manage; kural senkronu accessRules.manage olarak ayrılmalı. |
| `convex/deviceSyncRuns.ts:116` | `startProjectResync` | action | authedAction | Proje veya kural senkronunu başlatır | **`devices.manage`** | arg | Karar 6: proje senkronu devices.manage; kural senkronu accessRules.manage olarak ayrılmalı. |
| `convex/deviceSyncRuns.ts:123` | `startRuleSync` | action | authedAction | Proje veya kural senkronunu başlatır | **`accessRules.manage`** | yok | Karar 6: proje senkronu devices.manage; kural senkronu accessRules.manage olarak ayrılmalı. |

## `convex/devices.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/devices.ts:41` | `list` | query | authedQuery + isManager + role karşılaştırması + isAdmin | Cihaz sırlarını koşullu döndürür | **`devices.manage`** | arg | isManager ile apiToken ve bağlantı sırları maskeleniyor. |
| `convex/devices.ts:41` | `list` | query | authedQuery + isManager + role karşılaştırması + isAdmin | Cihaz görünürlüğünü proje üyeliğiyle sınırlar | **`üye`** | arg | Listede projesiz kayıtları da toplayabilen super_admin dalı var. |
| `convex/devices.ts:96` | `getById` | query | authedQuery + isManager | Cihaz sırlarını koşullu döndürür | **`devices.manage`** | doc.projectId | isManager ile apiToken ve bağlantı sırları maskeleniyor. |
| `convex/devices.ts:96` | `getById` | query | authedQuery + isManager | Cihaz görünürlüğünü proje üyeliğiyle sınırlar | **`üye`** | doc.projectId | — |
| `convex/devices.ts:118` | `create` | mutation | adminMutation + role karşılaştırması | Cihaz oluşturur | **`devices.manage`** | arg | — |
| `convex/devices.ts:204` | `update` | mutation | adminMutation + isManager + role karşılaştırması | Cihaz günceller | **`devices.manage`** | doc.projectId | — |
| `convex/devices.ts:328` | `remove` | mutation | adminMutation + role karşılaştırması | Cihaz siler | **`devices.manage`** | doc.projectId | — |
| `convex/devices.ts:457` | `regenerateApiToken` | mutation | adminMutation + role karşılaştırması | Cihaz API sırrını yeniler | **`devices.manage`** | doc.projectId | — |
| `convex/devices.ts:562` | `createIdePanel` | mutation | adminMutation + role karşılaştırması | IDE panelini kapı ve bölgesiyle kurar | **`devices.manage`** | arg | — |
| `convex/devices.ts:669` | `createHikDevice` | mutation | adminMutation + role karşılaştırması | Hikvision cihazını kapılarıyla kurar | **`devices.manage`** | arg | — |
| `convex/devices.ts:784` | `claimDevice` | mutation | adminMutation | Envanter cihazını projeye sahiplenir | **`devices.manage`** | arg | — |
| `convex/devices.ts:843` | `reassignDevice` | mutation | adminMutation | Cihazı başka projeye yeniden atar | **`devices.manage`** | arg | — |
| `convex/devices.ts:913` | `releaseDevice` | mutation | adminMutation | Cihazı projeden serbest bırakır | **`devices.manage`** | doc.projectId | — |

## `convex/doors.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/doors.ts:113` | `list` | query | authedQuery + role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | arg | — |
| `convex/doors.ts:159` | `create` | mutation | adminMutation | Kapı oluşturur | **`devices.manage`** | arg | — |
| `convex/doors.ts:247` | `update` | mutation | adminMutation | Kapı günceller | **`devices.manage`** | doc.projectId | — |
| `convex/doors.ts:330` | `remove` | mutation | adminMutation | Kapı siler | **`devices.manage`** | doc.projectId | — |
| `convex/doors.ts:374` | `readerStatus` | query | authedQuery + role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | arg | — |

## `convex/employeeBiometrics.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/employeeBiometrics.ts:15` | `summary` | query | authedQuery + isManager | Personeldeki yüz ve parmak varlığını döndürür | **`biometrics.manage`** | arg | [SAHİPLİ]  |

## `convex/employeeConsents.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/employeeConsents.ts:29` | `grant` | mutation | adminMutation | KVKK rızası rıza kaydeder | **`biometrics.manage`** | doc.projectId | Karar 4: biyometrik rıza biometrics.manage; photo rızası employees.manage olarak ayrılmalı. |
| `convex/employeeConsents.ts:109` | `revoke` | mutation | adminMutation | KVKK rızası rızayı iptal eder | **`biometrics.manage`** | doc.projectId | Karar 4: biyometrik rıza biometrics.manage; photo rızası employees.manage olarak ayrılmalı. |
| `convex/employeeConsents.ts:140` | `getDocumentUrl` | query | adminQuery | Rıza belgesinin indirme adresini döndürür | **`biometrics.manage`** | doc.projectId | Karar 4: biyometrik rıza biometrics.manage; photo rızası employees.manage olarak ayrılmalı. |

## `convex/employeeImport.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/employeeImport.ts:24` | `importChunk` | mutation | adminMutation | Personeli dosyadan topluca oluşturur | **`employees.manage`** | arg | — |
| `convex/employeeImport.ts:90` | `assignCards` | mutation | adminMutation | Personel kart numaralarını topluca atar | **`employees.manage`** | doc.projectId | — |
| `convex/employeeImport.ts:136` | `logExport` | mutation | adminMutation | Personel dışa aktarımını denetim kaydına yazar | **`reports.view`** | arg | — |

## `convex/employeeTermination.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/employeeTermination.ts:38` | `terminate` | mutation | adminMutation | İşten ayrılmayı ve erişim sonunu kaydeder | **`employees.manage`** | doc.projectId | — |
| `convex/employeeTermination.ts:77` | `reinstate` | mutation | adminMutation | Personeli yeniden işe başlatır | **`employees.manage`** | doc.projectId | — |

## `convex/employees.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/employees.ts:76` | `list` | query | authedQuery + isManager + canSeePay | Personel kayıtlarını görüntüler | **`employees.view`** | arg | — |
| `convex/employees.ts:76` | `list` | query | authedQuery + isManager + canSeePay | İşten ayrılma ayrıntılarını koşullu gösterir | **`employees.manage`** | arg | Karar 3: ücret dışı hassas İK alanı; employees.manage önerisi. |
| `convex/employees.ts:76` | `list` | query | authedQuery + isManager + canSeePay | Personelin ücret alanlarını maskeler | **`pay.view`** | arg | — |
| `convex/employees.ts:115` | `listLightForImport` | query | adminQuery | İçe aktarım için personeli listeler | **`employees.manage`** | arg | — |
| `convex/employees.ts:131` | `getById` | query | authedQuery + isManager + canSeePay + role karşılaştırması | Personel kayıtlarını görüntüler | **`employees.view`** | doc.projectId | — |
| `convex/employees.ts:131` | `getById` | query | authedQuery + isManager + canSeePay + role karşılaştırması | İşten ayrılma ayrıntılarını koşullu gösterir | **`employees.manage`** | doc.projectId | Karar 3: ücret dışı hassas İK alanı; employees.manage önerisi. |
| `convex/employees.ts:131` | `getById` | query | authedQuery + isManager + canSeePay + role karşılaştırması | Personelin ücret alanlarını maskeler | **`pay.view`** | doc.projectId | — |
| `convex/employees.ts:157` | `create` | mutation | adminMutation | Personel oluşturur | **`employees.manage`** | arg | — |
| `convex/employees.ts:221` | `update` | mutation | adminMutation | Personel günceller | **`employees.manage`** | arg | — |
| `convex/employees.ts:360` | `remove` | mutation | adminMutation + role karşılaştırması | Personel siler | **`employees.manage`** | doc.projectId | — |
| `convex/employees.ts:377` | `bulkDelete` | mutation | adminMutation + role karşılaştırması | Seçili personelleri topluca siler | **`employees.manage`** | doc.projectId | — |
| `convex/employees.ts:397` | `bulkUpdateDepartment` | mutation | adminMutation | Personelleri topluca departmana taşır | **`employees.manage`** | doc.projectId | — |

## `convex/files.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/files.ts:15` | `generateUploadUrl` | mutation | authedMutation | Depolama yükleme adresi üretir | **`üye`** | yok | rol kontrolü yok; oturum ve yükleme sahipliği. Genel yükleme için amaç bazlı kapı ayrıca gerekir. |
| `convex/files.ts:22` | `claimUpload` | mutation | authedMutation | Yüklemenin sahipliğini kullanıcıya bağlar | **`üye`** | yok | rol kontrolü yok; oturum ve yükleme sahipliği. Genel yükleme için amaç bazlı kapı ayrıca gerekir. |
| `convex/files.ts:39` | `saveUserPhoto` | mutation | authedMutation | Kendi profil fotoğrafını kaydeder | **`üye`** | yok | rol kontrolü yok; oturum ve yükleme sahipliği. Genel yükleme için amaç bazlı kapı ayrıca gerekir. |
| `convex/files.ts:57` | `getUploadUrl` | mutation | authedMutation | Sahip olunan yüklemenin adresini döndürür | **`üye`** | doc.projectId | rol kontrolü yok; oturum ve yükleme sahipliği. Genel yükleme için amaç bazlı kapı ayrıca gerekir. |

## `convex/fingerprintEnrollment.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/fingerprintEnrollment.ts:74` | `listForEmployee` | query | adminQuery | Personelin parmak izi kayıtlarını listeler | **`biometrics.manage`** | doc.projectId | — |
| `convex/fingerprintEnrollment.ts:105` | `getTargetInternal` | internal | internalQuery + canAccessEmployeeProject + role karşılaştırması | Parmak kayıt hedefinin yetkisini denetler | **`biometrics.manage`** | doc.projectId | — |
| `convex/fingerprintEnrollment.ts:124` | `beginEnrollment` | mutation | adminMutation | Parmak izi kayıt girişimi başlatır | **`biometrics.manage`** | doc.projectId | — |
| `convex/fingerprintEnrollment.ts:142` | `cancelEnrollment` | mutation | adminMutation | Parmak izi kayıt girişimini iptal eder | **`biometrics.manage`** | doc.projectId | — |
| `convex/fingerprintEnrollment.ts:207` | `authorizeEmployee` | internal | internalQuery + role karşılaştırması | Parmak işleminin personel erişimini denetler | **`biometrics.manage`** | doc.projectId | — |
| `convex/fingerprintEnrollment.ts:259` | `removeFingerprint` | mutation | adminMutation | Personelin parmak izini silme kuyruğuna alır | **`biometrics.manage`** | doc.projectId | — |
| `convex/fingerprintEnrollment.ts:319` | `auditResend` | mutation | adminMutation | Parmak tekrar gönderimini denetim kaydına yazar | **`biometrics.manage`** | doc.projectId | — |

## `convex/hikBridge.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/hikBridge.ts:38` | `assertProjectAccess` | internal | role karşılaştırması | Bridge projesine erişimi denetler | **`devices.manage`** | arg | — |
| `convex/hikBridge.ts:50` | `createBridge` | mutation | adminMutation | Bridge bağlantısı ve sırrını oluşturur | **`devices.manage`** | arg | — |
| `convex/hikBridge.ts:66` | `listBridges` | query | adminQuery | Bridge bağlantılarını listeler | **`devices.manage`** | arg | — |
| `convex/hikBridge.ts:85` | `revokeBridge` | mutation | adminMutation | Bridge bağlantısını iptal eder | **`devices.manage`** | doc.projectId | — |

## `convex/hikvisionSync.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/hikvisionSync.ts:734` | `listSyncIssues` | query | query + role karşılaştırması | Senkron sorunlarını güvenli alanlarla listeler | **`üye`** | arg | Personel silme canDismiss bayrağı yalnız super_admin ve çözümsüz hata için true. |
| `convex/hikvisionSync.ts:764` | `dismissSyncIssue` | mutation | authedMutation + role karşılaştırması | Senkron hata uyarısını kapatır | **`devices.manage`** | doc.projectId | rol kontrolü yok; proje kapsamı. Karar 5: uyarı kapatma devices.manage önerisi. Personel silme uyarısında ek super_admin kapısı var. |
| `convex/hikvisionSync.ts:764` | `dismissSyncIssue` | mutation | authedMutation + role !== super_admin | Çözülemeyen personel silme uyarısını kapatır | **`super_admin`** | doc.projectId | Silme uyarısına özgü platform istisnası korunmalı. |
| `convex/hikvisionSync.ts:1027` | `dismissAllSyncIssues` | mutation | authedMutation | Senkron hata uyarısını kapatır | **`devices.manage`** | arg | rol kontrolü yok; proje kapsamı. Karar 5: uyarı kapatma devices.manage önerisi. |
| `convex/hikvisionSync.ts:1049` | `retrySyncIssue` | mutation | adminMutation | Hikvision işlemini tekrar kuyruğa alır | **`devices.manage`** | doc.projectId | — |

## `convex/holidays.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/holidays.ts:11` | `requireHolidayScope` | internal | role karşılaştırması | Tatil okuma ve yazma kapsamını denetler | **`schedule.manage`** | arg | Okuma üye; yazma schedule.manage; projesiz global yazma super_admin kalmalı. |
| `convex/holidays.ts:11` | `requireHolidayScope` | internal | role === super_admin; projectId yoksa yazma reddi | Projesiz genel tatil yazmasını sınırlar | **`super_admin`** | yok | Proje tatili schedule.manage; global tatil yalnız platform. |
| `convex/holidays.ts:22` | `visibleHolidays` | internal | role karşılaştırması | Üye projelerin ve genel tatilleri okur | **`üye`** | getProjectIdsForUser listesi | — |
| `convex/holidays.ts:60` | `create` | mutation | adminMutation | Tatil oluşturur | **`schedule.manage`** | arg | — |
| `convex/holidays.ts:97` | `remove` | mutation | adminMutation | Tatil siler | **`schedule.manage`** | doc.projectId | — |
| `convex/holidays.ts:115` | `seedTurkishHolidays` | mutation | adminMutation | Türkiye resmi tatillerini projeye ekler | **`schedule.manage`** | arg | — |

## `convex/ideDefaults.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/ideDefaults.ts:16` | `get` | query | adminQuery | IDE bağlantı varsayılanlarını okur | **`devices.manage`** | yok | Global sır varsa platform super_admin olarak ayrılmalı. |
| `convex/ideDefaults.ts:35` | `upsert` | mutation | superAdminMutation | Platform IDE bağlantı varsayılanlarını kaydeder | **`super_admin`** | yok | — |

## `convex/ideSync.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/ideSync.ts:694` | `dismissSyncIssue` | mutation | authedMutation | Senkron hata uyarısını kapatır | **`devices.manage`** | getProjectIdsForUser listesi | rol kontrolü yok; proje kapsamı. Karar 5: uyarı kapatma devices.manage önerisi. |
| `convex/ideSync.ts:707` | `dismissAllSyncIssues` | mutation | authedMutation | Senkron hata uyarısını kapatır | **`devices.manage`** | arg | rol kontrolü yok; proje kapsamı. Karar 5: uyarı kapatma devices.manage önerisi. |
| `convex/ideSync.ts:729` | `retrySyncIssue` | mutation | adminMutation | IDE işlemini tekrar kuyruğa alır | **`devices.manage`** | getProjectIdsForUser listesi | — |

## `convex/invites.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/invites.ts:48` | `create` | internal | internalMutation | Projeye davet ve rol ataması oluşturur | **`admin.manage`** | arg | — |
| `convex/invites.ts:273` | `listExpired` | query | superAdminQuery | Platformdaki süresi dolmuş davetleri listeler | **`super_admin`** | yok | Global davet yönetimi platform kapısı; proje filtreli liste admin.manage uç olarak ayrılabilir. |
| `convex/invites.ts:306` | `list` | query | superAdminQuery | Platform veya proje davetlerini listeler | **`super_admin`** | arg | Global davet yönetimi platform kapısı; proje filtreli liste admin.manage uç olarak ayrılabilir. |

## `convex/leaveRequests.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/leaveRequests.ts:61` | `requireProject` | internal | role karşılaştırması | İzin talebi projesine erişimi denetler | **`üye`** | arg | — |
| `convex/leaveRequests.ts:77` | `listPending` | query | adminQuery | Bekleyen izin taleplerini listeler | **`attendance.approve`** | arg | — |
| `convex/leaveRequests.ts:122` | `pendingCount` | query | adminQuery | Bekleyen izin taleplerini sayar | **`attendance.approve`** | arg | — |
| `convex/leaveRequests.ts:194` | `approve` | mutation | adminMutation | İzin talebi onaylar | **`attendance.approve`** | yok | — |
| `convex/leaveRequests.ts:199` | `reject` | mutation | adminMutation | İzin talebi reddeder | **`attendance.approve`** | yok | — |

## `convex/leaves.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/leaves.ts:119` | `listPage` | query | authedQuery + canManageLeaves | İzin listesinin hassas alanlarını maskeler | **`attendance.approve`** | arg | Liste üye kalır; canManageLeaves=false ise hassas izin alanları gizlenir. |
| `convex/leaves.ts:178` | `create` | mutation | adminMutation | İzin oluşturur | **`attendance.approve`** | arg | — |
| `convex/leaves.ts:202` | `update` | mutation | adminMutation | İzin günceller | **`attendance.approve`** | doc.projectId | — |

## `convex/lib/accessRuleRead.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/accessRuleRead.ts:6` | `listAccessRules` | internal | authedQuery çağıranı + resolveProjectScope | Üye projelerin erişim kurallarını okur | **`üye`** | arg | [SAHİPLİ] Rol kapısı yok; resolveProjectScope; yetki görüntüleme üye kalır. |

## `convex/lib/accessRuleWrite.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/accessRuleWrite.ts:27` | `createAccessRuleWithGroups` | internal | adminMutation çağıranı + validateScheduleBinding | Gruplu erişim kuralını oluşturur | **`accessRules.manage`** | arg | Rol kapısı çağıran accessRules.createWithGroups içinde. |

## `convex/lib/adminGuards.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/adminGuards.ts:15` | `userProtectionError` | internal | isSuperAdmin | Hesap ve son yönetici korumasını denetler | **`super_admin`** | yok | — |
| `convex/lib/adminGuards.ts:152` | `activeSuperAdminCount` | internal | users.by_role super_admin | Etkin platform yöneticilerini sayar | **`super_admin`** | yok | Son etkin super_admin korumasının veri kaynağı. |
| `convex/lib/adminGuards.ts:168` | `requireAccountAccessTarget` | internal | requireAccountAccessTarget + role karşılaştırması | Hesap ve son yönetici korumasını denetler | **`admin.manage`** | doc.projectId | — |

## `convex/lib/auditActors.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/auditActors.ts:19` | `auditActorIndex` | internal | Çalışan rol kontrolü yok | Rol metadata veya açıklamasını taşır | **`üye`** | yok | Çalışan bir rol kapısı değil; literal, indeks adı, yorum veya import eşleşmesi. |

## `convex/lib/auditLogQuery.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/auditLogQuery.ts:63` | `auditPageMatches` | internal | Çalışan rol kontrolü yok | Rol metadata veya açıklamasını taşır | **`üye`** | yok | Çalışan bir rol kapısı değil; literal, indeks adı, yorum veya import eşleşmesi. |

## `convex/lib/auth.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/auth.ts:62` | `getProjectIdsForUser` | internal | role karşılaştırması | Erişilebilir projeleri çözer | **`üye`** | doc.projectId | Orphan yalnız super_admin kuralı korunmalı. |
| `convex/lib/auth.ts:89` | `isManager` | internal | isManager + role karşılaştırması | Ortak rol kapısını tanımlar | **`admin.manage`** | yok | Ortak kapı: tek anahtara doğrudan çevrilmez; çağırana göre ayrılır. |
| `convex/lib/auth.ts:97` | `requireAdmin` | internal | requireAdmin + isManager | Ortak rol kapısını tanımlar | **`admin.manage`** | yok | Ortak kapı: tek anahtara doğrudan çevrilmez; çağırana göre ayrılır. |
| `convex/lib/auth.ts:110` | `requireSuperAdmin` | internal | requireSuperAdmin + role karşılaştırması | Ortak rol kapısını tanımlar | **`super_admin`** | yok | Orphan yalnız super_admin kuralı korunmalı. |
| `convex/lib/auth.ts:137` | `canAccessEmployeeProject` | internal | canAccessEmployeeProject | Personel projesi ve orphan erişimini denetler | **`üye`** | arg | Orphan yalnız super_admin kuralı korunmalı. |
| `convex/lib/auth.ts:151` | `requireEmployeeAccess` | internal | role karşılaştırması | Personel projesi ve orphan erişimini denetler | **`üye`** | doc.projectId | Orphan yalnız super_admin kuralı korunmalı. |

## `convex/lib/customFunctions.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/customFunctions.ts:25` | `authedMutation` | internal | getCurrentUser / requireCurrentUser | Oturumu doğrular; rol kontrolü yapmaz | **`üye`** | yok | rol kontrolü yok; işlem amacı çağıran API tarafından denetlenmeli. |
| `convex/lib/customFunctions.ts:47` | `adminQuery` | internal | role karşılaştırması | Ortak kayıt sarmalayıcısında rol denetler | **`admin.manage`** | yok | Ortak kapı; çağıran işleme ait anahtarla değişmeli. |
| `convex/lib/customFunctions.ts:61` | `adminMutation` | internal | role karşılaştırması | Ortak kayıt sarmalayıcısında rol denetler | **`admin.manage`** | yok | Ortak kapı; çağıran işleme ait anahtarla değişmeli. |
| `convex/lib/customFunctions.ts:75` | `superAdminQuery` | internal | role karşılaştırması | Ortak kayıt sarmalayıcısında rol denetler | **`super_admin`** | yok | Sarmalayıcı tanımı; bağımsız API uç noktası değil. |
| `convex/lib/customFunctions.ts:89` | `superAdminMutation` | internal | role karşılaştırması | Ortak kayıt sarmalayıcısında rol denetler | **`super_admin`** | yok | Sarmalayıcı tanımı; bağımsız API uç noktası değil. |
| `convex/lib/customFunctions.ts:104` | `authedAction` | internal | getCurrentUser / requireCurrentUser | Oturumu doğrular; rol kontrolü yapmaz | **`üye`** | yok | rol kontrolü yok; işlem amacı çağıran API tarafından denetlenmeli. |

## `convex/lib/gatewayBackfill.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/gatewayBackfill.ts:122` | `runBackfillDeviceEvents` | internal | isManager | Cihaz olaylarını geçmişe aktarır | **`devices.manage`** | doc.projectId | — |

## `convex/lib/gatewayCommand.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/gatewayCommand.ts:70` | `runRegisterDeviceOnGateway` | internal | isManager | Cihazı gateway sistemine kaydeder | **`devices.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:172` | `runRemoveDeviceFromGateway` | internal | isManager | Cihazı gateway sisteminden kaldırır | **`devices.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:203` | `runRefreshGatewayDeviceStatus` | internal | isManager | Gateway cihaz durumlarını yeniler | **`devices.manage`** | getProjectIdsForUser listesi | — |
| `convex/lib/gatewayCommand.ts:235` | `runPingHikGateway` | internal | authedAction çağıranı; rol kontrolü yok | Gateway sağlık durumunu okur | **`üye`** | yok | Action yalnız oturum gerektirir; global sağlık bilgisi için karar 10. |
| `convex/lib/gatewayCommand.ts:250` | `runFetchDeviceCapabilities` | internal | isManager | Cihaz özelliklerini tarayıp kaydeder | **`devices.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:290` | `runRemoteOpenDoor` | internal | Proje üyeliği; rol kontrolü yok | Hikvision kapısını uzaktan açar | **`doors.open`** | doc.projectId | rol kontrolü yok; cihazın proje erişimi var. |
| `convex/lib/gatewayCommand.ts:325` | `runRebootDevice` | internal | isManager | Cihazı yeniden başlatır | **`devices.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:365` | `runFetchDeviceWorkStatus` | internal | isManager | Cihaz çalışma durumunu kaydeder | **`devices.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:438` | `runCaptureCardFromDevice` | internal | isManager | Cihazdan kart numarası yakalar | **`employees.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:469` | `runCaptureFaceFromDevice` | internal | isManager + canAccessEmployeeProject | Cihazdan yüz görüntüsü yakalar | **`biometrics.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:520` | `runApplyDoorStatusPlan` | internal | isManager | Kapı durum planını cihaza uygular | **`devices.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:574` | `runFetchReaderCfg` | internal | isManager | Okuyucu yapılandırmasını okuyup kaydeder | **`devices.manage`** | doc.projectId | — |
| `convex/lib/gatewayCommand.ts:634` | `runApplyVerifyPlan` | internal | isManager | Doğrulama planını cihaza uygular | **`devices.manage`** | doc.projectId | — |

## `convex/lib/gatewayReconcile.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/gatewayReconcile.ts:95` | `runReconcileDevice` | internal | isManager | Cihaz ile merkez kayıtlarını karşılaştırır | **`devices.manage`** | doc.projectId | — |

## `convex/lib/leaveRules.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/leaveRules.ts:3` | `canManageLeaves` | internal | canManageLeaves | İzin onayını ve hassas alanları sınırlar | **`attendance.approve`** | yok | — |
| `convex/lib/leaveRules.ts:7` | `requireLeaveAdmin` | internal | requireLeaveAdmin → canManageLeaves | İzin onayını ve hassas alanları sınırlar | **`attendance.approve`** | yok | — |
| `convex/lib/leaveRules.ts:11` | `approvedLeaveFields` | internal | requireLeaveAdmin → canManageLeaves | İzin onayını ve hassas alanları sınırlar | **`attendance.approve`** | yok | — |
| `convex/lib/leaveRules.ts:16` | `leaveDecisionPatch` | internal | requireLeaveAdmin → canManageLeaves | İzin onayını ve hassas alanları sınırlar | **`attendance.approve`** | yok | — |

## `convex/lib/payVisibility.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/payVisibility.ts:5` | `canSeePay` | internal | isManager + canSeePay | Ücret alanları için görünürlük kararı verir | **`pay.view`** | yok | — |

## `convex/lib/pdksPayrollQuery.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/pdksPayrollQuery.ts:25` | `getMonthlyPayrollSheet` | internal | canSeePay + role karşılaştırması | PDKS ücret alanlarını maskeler | **`pay.view`** | arg | Aynı fonksiyonda super_admin toplu/orphan kapsamı da var. |

## `convex/lib/pdksTableQuery.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/pdksTableQuery.ts:34` | `getPdksTableData` | internal | canSeePay + role karşılaştırması | PDKS ücret alanlarını maskeler | **`pay.view`** | arg | Aynı fonksiyonda super_admin toplu/orphan kapsamı da var. |

## `convex/lib/publicUser.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/publicUser.ts:19` | `publicUserValidator` | internal | Çalışan rol kontrolü yok | Rol metadata veya açıklamasını taşır | **`admin.manage`** | yok | Çalışan bir rol kapısı değil; literal, indeks adı, yorum veya import eşleşmesi. |

## `convex/lib/reportScope.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/lib/reportScope.ts:66` | `selectScheduleProjectIds` | internal | isManager | Zamanlanmış rapor sahibinin güncel yetkisini denetler | **`reports.view`** | arg | Karar 8: e-posta zamanlama için reports.view önerisi. |
| `convex/lib/reportScope.ts:74` | `resolveScheduleScope` | internal | isManager + role karşılaştırması | Zamanlanmış rapor sahibinin güncel yetkisini denetler | **`reports.view`** | doc.projectId | Karar 8: e-posta zamanlama için reports.view önerisi. |

## `convex/onboarding.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/onboarding.ts:17` | `ensureProjectForNewUser` | mutation | authedMutation + role karşılaştırması | Projesiz kullanıcıya ilk proje ve rol kurar | **`üye`** | yok | rol kontrolü yok; doğrulanmış ve üyeliği olmayan hesap. Karar 9: bootstrap istisnası korunmalı. |
| `convex/onboarding.ts:94` | `assignProjectsToExistingUsers` | mutation | mutation + role karşılaştırması | Eski projesiz hesaplara proje kurar | **`super_admin`** | yok | requireSetupSecret; platform bakım işi, normal yetki anahtarına açılmaz. |

## `convex/pdksRecords.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/pdksRecords.ts:10` | `upsertManual` | mutation | adminMutation + role karşılaştırması | Personelin manuel PDKS kaydını düzeltir | **`attendance.approve`** | doc.projectId | — |
| `convex/pdksRecords.ts:42` | `bulkUpsertManual` | mutation | adminMutation + role karşılaştırması | Manuel PDKS kayıtlarını topluca düzeltir | **`attendance.approve`** | doc.projectId | — |

## `convex/pdksRules.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/pdksRules.ts:22` | `getRules` | query | adminQuery | PDKS kural sürümlerini okur | **`schedule.manage`** | arg | — |
| `convex/pdksRules.ts:36` | `listCheckpointTargets` | query | adminQuery | PDKS kontrol noktası adaylarını listeler | **`schedule.manage`** | arg | — |
| `convex/pdksRules.ts:58` | `publishRuleVersion` | mutation | adminMutation | Gelecek PDKS kural sürümü yayımlar | **`schedule.manage`** | arg | — |
| `convex/pdksRules.ts:94` | `deleteFutureRuleVersion` | mutation | adminMutation | Gelecek PDKS kural sürümünü siler | **`schedule.manage`** | doc.projectId | — |

## `convex/positions.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/positions.ts:5` | `list` | query | authedQuery + role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | getProjectIdsForUser listesi | — |

## `convex/privacyBiometric.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/privacyBiometric.ts:18` | `getBiometricModule` | query | adminQuery | Projenin biyometri modül ayarını okur | **`admin.manage`** | arg | Modül ayarı admin.manage; kayıt akışının basit enabled bilgisi üye endpointinde. |
| `convex/privacyBiometric.ts:30` | `setBiometricModule` | mutation | adminMutation | Projenin biyometri modül ayarını değiştirir | **`admin.manage`** | arg | — |

## `convex/privacyRetention.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/privacyRetention.ts:18` | `getRetentionAndAssistant` | query | adminQuery | Saklama ve asistan gizlilik ayarlarını okur | **`admin.manage`** | arg | — |
| `convex/privacyRetention.ts:27` | `setCardReadingRetention` | mutation | adminMutation | Kart okutma saklama süresini değiştirir | **`admin.manage`** | arg | — |
| `convex/privacyRetention.ts:39` | `setAssistantMasking` | mutation | adminMutation | Asistan ad maskelemesini değiştirir | **`admin.manage`** | arg | — |
| `convex/privacyRetention.ts:109` | `getVisitorNotice` | query | adminQuery | Ziyaretçi KVKK metni ayarlarını okur | **`admin.manage`** | arg | Karar 7: KVKK metni proje ayarı; admin.manage önerisi. |
| `convex/privacyRetention.ts:118` | `setVisitorNotice` | mutation | adminMutation | Ziyaretçi KVKK metni ayarlarını kaydeder | **`admin.manage`** | arg | Karar 7: KVKK metni proje ayarı; admin.manage önerisi. |

## `convex/projects.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/projects.ts:14` | `list` | query | authedQuery + role karşılaştırması | Üye olunan veya sahip olunan projeyi okur | **`üye`** | doc.projectId | — |
| `convex/projects.ts:30` | `listActive` | query | query + role karşılaştırması | Üye olunan veya sahip olunan projeyi okur | **`üye`** | doc.projectId | — |
| `convex/projects.ts:45` | `getById` | query | authedQuery + role karşılaştırması | Üye olunan veya sahip olunan projeyi okur | **`üye`** | arg | — |
| `convex/projects.ts:58` | `create` | mutation | superAdminMutation | Proje oluşturur | **`super_admin`** | yok | — |
| `convex/projects.ts:82` | `update` | mutation | superAdminMutation | Proje günceller | **`super_admin`** | yok | — |
| `convex/projects.ts:107` | `remove` | mutation | authedMutation + role karşılaştırması + isSuperAdmin | Boş projeyi bağlı kayıtlarıyla siler | **`admin.manage`** | yok | Karar 2: bugün ownerId veya super_admin; PLAN proje silmeyi açıkça tanımlamıyor. |
| `convex/projects.ts:135` | `adminList` | query | superAdminQuery | Platform projelerini sayfalı listeler | **`super_admin`** | yok | — |
| `convex/projects.ts:165` | `getDeletionImpact` | query | authedQuery + role karşılaştırması | Proje silme etkisini hesaplar | **`admin.manage`** | arg | Karar 2: bugün ownerId veya super_admin; PLAN proje silmeyi açıkça tanımlamıyor. |
| `convex/projects.ts:178` | `getSetupStatus` | query | adminQuery + role karşılaştırması | Proje kurulum kontrol listesini hesaplar | **`admin.manage`** | arg | — |

## `convex/readers.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/readers.ts:60` | `create` | mutation | adminMutation | Okuyucu oluşturur | **`devices.manage`** | doc.projectId | — |
| `convex/readers.ts:114` | `move` | mutation | adminMutation | Okuyucuyu başka kapıya taşır | **`devices.manage`** | doc.projectId | — |
| `convex/readers.ts:161` | `update` | mutation | adminMutation | Okuyucu günceller | **`devices.manage`** | doc.projectId | — |
| `convex/readers.ts:216` | `remove` | mutation | adminMutation | Okuyucu siler | **`devices.manage`** | doc.projectId | — |

## `convex/reports.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/reports.ts:23` | `getSgkMonthlyReport` | query | authedQuery | Proje raporunu üretir | **`reports.view`** | arg | Bugün rol kapısı yok; resolveReportScope yalnız üyelik denetler. |
| `convex/reports.ts:135` | `getOvertimeSummaryReport` | query | authedQuery + canSeePay | Mesai özet raporunu üretir | **`pay.view`** | arg | reports.view ile rapor; pay.view ile ücret alanları ayrı kontrol. |
| `convex/reports.ts:135` | `getOvertimeSummaryReport` | query | authedQuery + canSeePay | Mesai özet raporunu üretir | **`reports.view`** | arg | — |
| `convex/reports.ts:242` | `getAttendanceSummaryReport` | query | authedQuery | Proje raporunu üretir | **`reports.view`** | arg | Bugün rol kapısı yok; resolveReportScope yalnız üyelik denetler. |
| `convex/reports.ts:257` | `getDepartmentCostReport` | query | authedQuery + canSeePay | Departman maliyet raporunu üretir | **`pay.view`** | arg | reports.view ile rapor; pay.view ile ücret alanları ayrı kontrol. |
| `convex/reports.ts:257` | `getDepartmentCostReport` | query | authedQuery + canSeePay | Departman maliyet raporunu üretir | **`reports.view`** | arg | — |
| `convex/reports.ts:358` | `getReportSchedule` | query | authedQuery + requireAdmin | Kullanıcının rapor zamanlamasını okur | **`reports.view`** | arg | — |
| `convex/reports.ts:368` | `saveReportSchedule` | mutation | authedMutation + requireAdmin | Kullanıcının rapor zamanlamasını kaydeder | **`reports.view`** | arg | — |

## `convex/settings.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/settings.ts:44` | `upsertGeneral` | mutation | adminMutation | Genel proje ayarlarını kaydeder | **`admin.manage`** | arg | — |
| `convex/settings.ts:106` | `upsertNotification` | mutation | adminMutation | Proje bildirim ayarlarını kaydeder | **`admin.manage`** | arg | — |
| `convex/settings.ts:171` | `saveOvertime` | mutation | adminMutation | Fazla mesai hesaplama kurallarını kaydeder | **`schedule.manage`** | arg | Ücret görüntüleme değil; mesai hesaplama politikası yazıyor. |

## `convex/sgkExport.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/sgkExport.ts:11` | `buildAphbForMonth` | query | authedQuery + role karşılaştırması | Aylık SGK APHB taslağını üretir | **`reports.view`** | arg | — |

## `convex/shifts.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/shifts.ts:142` | `updateAssignment` | mutation | authedMutation | Vardiya atamasını değiştirir | **`schedule.manage`** | doc.projectId | rol kontrolü yok; yalnız proje üyeliği (orphan için super_admin). |
| `convex/shifts.ts:236` | `bulkAssignShift` | mutation | authedMutation | Personellere topluca vardiya atar | **`schedule.manage`** | doc.projectId | rol kontrolü yok; yalnız proje üyeliği (orphan için super_admin). |
| `convex/shifts.ts:276` | `removeAssignment` | mutation | authedMutation + role karşılaştırması | Vardiya atamasını siler | **`schedule.manage`** | doc.projectId | rol kontrolü yok; yalnız proje üyeliği (orphan için super_admin). |
| `convex/shifts.ts:393` | `create` | mutation | authedMutation + role karşılaştırması | Vardiya veya atama oluşturur | **`schedule.manage`** | arg | rol kontrolü yok; yalnız proje üyeliği (orphan için super_admin). |
| `convex/shifts.ts:430` | `update` | mutation | authedMutation + role karşılaştırması | Vardiya veya atama günceller | **`schedule.manage`** | doc.projectId | rol kontrolü yok; yalnız proje üyeliği (orphan için super_admin). |
| `convex/shifts.ts:462` | `remove` | mutation | authedMutation + role karşılaştırması | Vardiya veya atama siler | **`schedule.manage`** | doc.projectId | rol kontrolü yok; yalnız proje üyeliği (orphan için super_admin). |
| `convex/shifts.ts:489` | `prepareClear` | internal | role karşılaştırması | Toplu vardiya temizleme yetkisini denetler | **`schedule.manage`** | doc.projectId | prepareClear içinde global yönetici rol kapısı var. |
| `convex/shifts.ts:524` | `clearAssignments` | mutation | authedMutation | Tarih aralığındaki vardiya atamalarını temizler | **`schedule.manage`** | doc.projectId | prepareClear içinde global yönetici rol kapısı var. |

## `convex/userPreferences.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/userPreferences.ts:17` | `set` | mutation | authedMutation | Kullanıcının kendi profil veya tercihini yazar | **`üye`** | yok | rol kontrolü yok; yalnız kendi kaydı. |

## `convex/userProjects.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/userProjects.ts:24` | `getProjectIdsByUser` | query | authedQuery + role karşılaştırması | Başka kullanıcının proje üyeliklerini okur | **`super_admin`** | doc.projectId | Kendi hesabı istisnası üye; başkasını okuma bugün super_admin. Proje yönetimi için admin.manage kapsamlı uç gerekir. |

## `convex/users.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/users.ts:15` | `hasSuperAdmin` | query | query; rol kontrolü yok | İlk platform yöneticisinin varlığını bildirir | **`üye`** | yok | Kurulum akışının yalnız varlık bilgisi; anonim okuma. |
| `convex/users.ts:52` | `updateRole` | mutation | superAdminMutation + role karşılaştırması + isSuperAdmin | Global kullanıcı rolünü veya hesabını değiştirir | **`super_admin`** | doc.projectId | Karar 1: proje üyeliği yönetimi admin.manage olarak ayrılmalı; platform rolü/silme super_admin kalmalı. |
| `convex/users.ts:103` | `updateProfile` | mutation | authedMutation | Kullanıcının kendi profil veya tercihini yazar | **`üye`** | yok | rol kontrolü yok; yalnız kendi kaydı. |
| `convex/users.ts:118` | `list` | query | adminQuery + role karşılaştırması | Kullanıcı listeler | **`admin.manage`** | getProjectIdsForUser listesi | — |
| `convex/users.ts:150` | `initializeAdmin` | mutation | ADMIN_SETUP_SECRET + ilk admin koşulu | İlk platform yöneticisini güvenli kurar | **`super_admin`** | yok | Normal rol yetkisi değil; secret + oturum + hiç admin yok şartı. |
| `convex/users.ts:183` | `deleteUser` | mutation | superAdminMutation + role karşılaştırması + isSuperAdmin | Global kullanıcı rolünü veya hesabını değiştirir | **`super_admin`** | yok | Karar 1: proje üyeliği yönetimi admin.manage olarak ayrılmalı; platform rolü/silme super_admin kalmalı. |
| `convex/users.ts:223` | `setRoleByEmail` | internal | internalMutation | Bakım için global kullanıcı rolünü değiştirir | **`super_admin`** | yok | internalMutation; kullanıcıya açık normal proje yönetimi değil. |
| `convex/users.ts:251` | `adminDeleteByEmail` | internal | internalMutation | Bakım için kullanıcı hesabını siler | **`super_admin`** | yok | internalMutation; platform bakım yüzeyi. |
| `convex/users.ts:325` | `adminList` | query | adminQuery + role karşılaştırması | Proje kapsamındaki kullanıcıları sayfalı listeler | **`admin.manage`** | doc.projectId | — |

## `convex/visitors.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/visitors.ts:226` | `getDetail` | query | authedQuery + isManager | Ziyaretçinin hassas ayrıntılarını koşullu gösterir | **`visitors.manage`** | doc.projectId | — |
| `convex/visitors.ts:262` | `create` | mutation | adminMutation | Ziyaretçi oluşturur | **`visitors.manage`** | arg | — |
| `convex/visitors.ts:364` | `update` | mutation | adminMutation | Ziyaretçi günceller | **`visitors.manage`** | arg | — |
| `convex/visitors.ts:488` | `checkOut` | mutation | adminMutation | Ziyaretçiyi çıkış yapmış işaretler | **`visitors.manage`** | doc.projectId | — |
| `convex/visitors.ts:518` | `releaseCard` | mutation | adminMutation | Ziyaretçinin kart atamasını kaldırır | **`visitors.manage`** | doc.projectId | — |

## `convex/zones.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `convex/zones.ts:8` | `list` | query | authedQuery + role karşılaştırması | Proje kayıtlarının görünürlük kapsamını seçer | **`üye`** | arg | — |
| `convex/zones.ts:34` | `create` | mutation | adminMutation | Bölge oluşturur | **`devices.manage`** | arg | — |
| `convex/zones.ts:56` | `remove` | mutation | adminMutation | Bölge siler | **`devices.manage`** | doc.projectId | — |

## `src/components/access-control/EditDoorDialog.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/EditDoorDialog.tsx:79` | `EditDoorDialog` | UI | isAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | arg | — |

## `src/components/access-control/unified/AccessRulesList.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/AccessRulesList.tsx:15` | `AccessRulesList` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/access-control/unified/UnifiedAccessControl.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/UnifiedAccessControl.tsx:13` | `ProjectAccessControl` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/access-control/unified/rules-list/RuleRow.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/rules-list/RuleRow.tsx:28` | `RuleRow` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/access-control/unified/status/StatusPage.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/status/StatusPage.tsx:31` | `StatusPage` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/access-control/unified/status/StatusResults.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/status/StatusResults.tsx:38` | `StatusResults` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/access-control/unified/status/StatusViews.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/status/StatusViews.tsx:44` | `GrantRows` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/access-control/unified/templates/TemplatePicker.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/templates/TemplatePicker.tsx:7` | `TemplatePicker` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/access-control/unified/templates/TemplatesPage.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/access-control/unified/templates/TemplatesPage.tsx:22` | `TemplatesPage` | UI | isAdmin | Erişim yönetim araçlarını gösterir | **`accessRules.manage`** | arg | — |

## `src/components/admin/AdminUsersPanel.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/admin/AdminUsersPanel.tsx:114` | `AdminUsersContent` | UI | role karşılaştırması | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |
| `src/components/admin/AdminUsersPanel.tsx:114` | `AdminUsersContent` | UI | capabilities.manageUsers / super_admin | Global kullanıcı veya platform rolünü yönetir | **`super_admin`** | arg | manageUsers/systemAdmin ve super_admin rolü seçenekleri; proje üyeliği admin.manage olarak ayrılmalı. |
| `src/components/admin/AdminUsersPanel.tsx:297` | `AdminUsersPanel` | UI | ProjectFilter requiredRole=admin | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/admin/components/UserFormDialog.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/admin/components/UserFormDialog.tsx:34` | `UserFormDialog` | UI | role karşılaştırması | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | doc.projectId | — |
| `src/components/admin/components/UserFormDialog.tsx:34` | `UserFormDialog` | UI | capabilities.manageUsers / super_admin | Global kullanıcı veya platform rolünü yönetir | **`super_admin`** | arg | manageUsers/systemAdmin ve super_admin rolü seçenekleri; proje üyeliği admin.manage olarak ayrılmalı. |

## `src/components/admin/components/UserTable.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/admin/components/UserTable.tsx:19` | `UserTable` | UI | role karşılaştırması + capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |
| `src/components/admin/components/UserTable.tsx:19` | `UserTable` | UI | capabilities.manageUsers / super_admin | Global kullanıcı veya platform rolünü yönetir | **`super_admin`** | arg | manageUsers/systemAdmin ve super_admin rolü seçenekleri; proje üyeliği admin.manage olarak ayrılmalı. |

## `src/components/admin/hooks/useUserManagement.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/admin/hooks/useUserManagement.ts:25` | `useUserManagement` | UI | role karşılaştırması + capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | doc.projectId | — |
| `src/components/admin/hooks/useUserManagement.ts:25` | `useUserManagement` | UI | capabilities.manageUsers / super_admin | Global kullanıcı veya platform rolünü yönetir | **`super_admin`** | arg | manageUsers/systemAdmin ve super_admin rolü seçenekleri; proje üyeliği admin.manage olarak ayrılmalı. |

## `src/components/admin/types/user-types.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/admin/types/user-types.ts:6` | `UserRole / userSchema` | UI | Çalışan rol kontrolü yok | Rol metadata veya açıklamasını taşır | **`admin.manage`** | yok | Çalışan bir rol kapısı değil; literal, indeks adı, yorum veya import eşleşmesi. |

## `src/components/auth/AuthProvider.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/auth/AuthProvider.tsx:37` | `AuthProvider` | UI | checkUserRole çağrısı | Oturum rolü hiyerarşisini hesaplar | **`üye`** | yok | Genel rol hiyerarşisi; requiredRole=admin işlemleri çağırana göre ayrılmalı. |

## `src/components/auth/ProjectFilter.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/auth/ProjectFilter.tsx:5` | `ProjectFilter` | UI | isAdmin + isSuperAdmin | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | getProjectIdsForUser listesi | — |
| `src/components/auth/ProjectFilter.tsx:5` | `ProjectFilter` | UI | requiredRole === super_admin → isSuperAdmin | Platform rolü gerektiren içeriği sınırlar | **`super_admin`** | arg | requiredRole=super_admin dalı. |
| `src/components/auth/ProjectFilter.tsx:5` | `ProjectFilter` | UI | projectIds.length > 0 veya isSuperAdmin | Proje üyesine ait içeriği sınırlar | **`üye`** | getProjectIdsForUser listesi | Varsayılan requiredRole=project_user; diğer yönetim dalları ayrı. |

## `src/components/dashboard/LiveFeed.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/dashboard/LiveFeed.tsx:23` | `LiveFeed` | UI | capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/dashboard/QuickLinksGrid.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/dashboard/QuickLinksGrid.tsx:18` | `QuickLinksGrid` | UI | visibleRoutes → capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/dashboard/SetupChecklist.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/dashboard/SetupChecklist.tsx:23` | `SetupChecklist` | UI | isAdmin | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/devices/ClaimDeviceDialog.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/devices/ClaimDeviceDialog.tsx:47` | `ClaimDeviceDialog` | UI | isSuperAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | arg | — |

## `src/components/devices/DeviceCommandCenter.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/devices/DeviceCommandCenter.tsx:43` | `DeviceCenter` | UI | isAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | arg | — |

## `src/components/devices/DeviceDetailsPanel.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/devices/DeviceDetailsPanel.tsx:45` | `DeviceDetailsPanel` | UI | isAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | arg | — |

## `src/components/devices/DeviceDoorsSection.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/devices/DeviceDoorsSection.tsx:5` | `DeviceDoorsSection` | UI | isAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | arg | — |

## `src/components/devices/hooks/useDeviceFormSchema.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/devices/hooks/useDeviceFormSchema.ts:27` | `useDeviceFormSchema` | UI | Çalışan rol kontrolü yok | Rol metadata veya açıklamasını taşır | **`üye`** | arg | Çalışan bir rol kapısı değil; literal, indeks adı, yorum veya import eşleşmesi. |

## `src/components/employees/EmployeeConsentsCard.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/employees/EmployeeConsentsCard.tsx:62` | `EmployeeConsentsCard` | UI | capabilities | Biyometri ve rıza araçlarını gösterir | **`biometrics.manage`** | arg | [SAHİPLİ]  |

## `src/components/employees/EmployeeDetails.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/employees/EmployeeDetails.tsx:19` | `EmployeeDetails` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | arg | [SAHİPLİ]  |
| `src/components/employees/EmployeeDetails.tsx:151` | `EmployeeAccessSection` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | arg | [SAHİPLİ]  |
| `src/components/employees/EmployeeDetails.tsx:151` | `EmployeeAccessSection` | UI | isAdmin | Personelin erişim üyeliklerini yönetir | **`accessRules.manage`** | arg | [SAHİPLİ] Personel düzenleme yetkisinden ayrılmalı. |

## `src/components/employees/EmployeeFingerprintCard.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/employees/EmployeeFingerprintCard.tsx:14` | `EmployeeFingerprintCard` | UI | isAdmin | Biyometri ve rıza araçlarını gösterir | **`biometrics.manage`** | arg | [SAHİPLİ]  |

## `src/components/employees/EmployeeTable.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/employees/EmployeeTable.tsx:38` | `EmployeeTable` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | arg | [SAHİPLİ]  |
| `src/components/employees/EmployeeTable.tsx:38` | `EmployeeTable` | UI | isAdmin | Personelin biyometri özetini sorgular | **`biometrics.manage`** | arg | [SAHİPLİ] isAdmin && projectId → employeeBiometrics.summary. |
| `src/components/employees/EmployeeTable.tsx:38` | `EmployeeTable` | UI | isAdmin | Seçili personelleri cihazlara tekrar dağıtır | **`accessRules.manage`** | arg | [SAHİPLİ] isAdmin ile manuel senkron araçları; personel düzenlemeden ayrı. |

## `src/components/employees/SlideOverPanel.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/employees/SlideOverPanel.tsx:28` | `SlideOverPanel` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | arg | [SAHİPLİ]  |

## `src/components/employees/table/EmployeeTableDialogs.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/employees/table/EmployeeTableDialogs.tsx:35` | `EmployeeTableDialogs` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | arg | [SAHİPLİ]  |

## `src/components/employees/table/EmployeeTableRow.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/employees/table/EmployeeTableRow.tsx:27` | `EmployeeTableRow` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | arg | [SAHİPLİ]  |
| `src/components/employees/table/EmployeeTableRow.tsx:27` | `EmployeeTableRow` | UI | isAdmin | Personeli cihazlara tekrar dağıtır | **`accessRules.manage`** | arg | [SAHİPLİ] isAdmin ile sync eylemi; karar 6. |

## `src/components/layout/AppHeader.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/layout/AppHeader.tsx:15` | `AppHeader` | UI | capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/layout/AppSidebarNav.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/layout/AppSidebarNav.tsx:9` | `AppSidebarNav` | UI | visibleRoutes → capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/layout/CommandPalette.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/layout/CommandPalette.tsx:10` | `CommandPalette` | UI | visibleRoutes → capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/layout/ProjectSwitcher.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/layout/ProjectSwitcher.tsx:8` | `ProjectSwitcher` | UI | isSuperAdmin | Proje kapsamını veya rol etiketini gösterir | **`üye`** | arg | — |

## `src/components/leaves/LeaveDetails.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/leaves/LeaveDetails.tsx:19` | `LeaveDetails` | UI | isAdmin | İzin veya PDKS düzenlemesini gösterir | **`attendance.approve`** | arg | — |

## `src/components/leaves/LeaveList.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/leaves/LeaveList.tsx:11` | `LeaveList` | UI | isAdmin | İzin veya PDKS düzenlemesini gösterir | **`attendance.approve`** | arg | — |

## `src/components/leaves/LeaveResults.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/leaves/LeaveResults.tsx:24` | `LeaveResults` | UI | isAdmin | İzin veya PDKS düzenlemesini gösterir | **`attendance.approve`** | arg | — |

## `src/components/live-monitoring/ReadingDetailPanel.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/live-monitoring/ReadingDetailPanel.tsx:13` | `Detail` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | doc.projectId | — |

## `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:91` | `Detail` | UI | isAdmin | İzin veya PDKS düzenlemesini gösterir | **`attendance.approve`** | arg | — |

## `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:54` | `PDKSEnhancedExportPanel` | UI | capabilities | Ücret alanlarını ve sütunlarını gösterir | **`pay.view`** | arg | — |
| `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:54` | `PDKSEnhancedExportPanel` | UI | Ücret: capabilities.admin; genel dışa aktarım rol kontrolü yok | PDKS dosya dışa aktarımını açar | **`reports.view`** | arg | Mevcut explicit reports.view kapısı yok; ücret için ayrıca pay.view. |
| `src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx:61` | `ExportPanel` | UI | üst bileşenden gelen yetki bayrağı | Ücret alanlarını ve sütunlarını gösterir | **`pay.view`** | arg | — |

## `src/components/pdks/dashboard/export/PDKSExportColumns.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/pdks/dashboard/export/PDKSExportColumns.tsx:15` | `PDKSExportColumns` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |

## `src/components/pdks/records/usePdksRecordsView.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/pdks/records/usePdksRecordsView.ts:11` | `usePdksRecordsView` | UI | isAdmin | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | Bayrak aktarımı; karar çağıran bileşende. |

## `src/components/profile/UserProjectsCard.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/profile/UserProjectsCard.tsx:8` | `UserProjectsCard` | UI | isSuperAdmin | Proje kapsamını veya rol etiketini gösterir | **`üye`** | arg | — |

## `src/components/settings/SettingsSidebar.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/SettingsSidebar.tsx:16` | `SettingsSidebar` | UI | settingsTabs work-payroll | Vardiya ve bordro ayar bölümünü açar | **`schedule.manage`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/components/settings/SettingsSidebar.tsx:16` | `SettingsSidebar` | UI | settingsTabs reports | Rapor ayar bölümünü açar | **`reports.view`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/components/settings/SettingsSidebar.tsx:16` | `SettingsSidebar` | UI | settingsTabs integrations | Cihaz entegrasyon ayar bölümünü açar | **`devices.manage`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/components/settings/SettingsSidebar.tsx:16` | `SettingsSidebar` | UI | capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |
| `src/components/settings/SettingsSidebar.tsx:16` | `SettingsSidebar` | UI | settingsTabs mail / systemAdmin | Platform posta ayar bölümünü açar | **`super_admin`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |

## `src/components/settings/sections/ReportsSettings.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/sections/ReportsSettings.tsx:48` | `ReportDownloadSettings` | UI | capabilities | Ücret alanlarını ve sütunlarını gösterir | **`pay.view`** | getProjectIdsForUser listesi | — |
| `src/components/settings/sections/ReportsSettings.tsx:48` | `ReportDownloadSettings` | UI | Üst Reports/Settings kapısı | Proje raporunu indirir | **`reports.view`** | arg | Ücret için ayrıca pay.view; genel rapor üst menüde adminTabs ile kapanıyor. |
| `src/components/settings/sections/ReportsSettings.tsx:234` | `ReportsSettings` | UI | isAdmin | Rapor ekranını gösterir | **`reports.view`** | arg | — |

## `src/components/settings/sections/components/HolidayCalendarManager.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/sections/components/HolidayCalendarManager.tsx:39` | `HolidayCalendarContent` | UI | isAdmin | Vardiya ve PDKS ayarlarını gösterir | **`schedule.manage`** | arg | — |

## `src/components/settings/sections/components/OvertimeSettingsForm.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/sections/components/OvertimeSettingsForm.tsx:45` | `OvertimeSettingsForm` | UI | isAdmin | Vardiya ve PDKS ayarlarını gösterir | **`schedule.manage`** | arg | — |

## `src/components/settings/sections/components/PdksRulesSettings.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/sections/components/PdksRulesSettings.tsx:37` | `PdksRulesSettings` | UI | isAdmin | Vardiya ve PDKS ayarlarını gösterir | **`schedule.manage`** | arg | — |

## `src/components/settings/sections/hooks/useGeneralSettings.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/sections/hooks/useGeneralSettings.ts:6` | `useGeneralSettings` | UI | isAdmin | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:18` | `BridgeIntegrationCard` | UI | isAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | arg | — |

## `src/components/settings/sections/reports/exportReport.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/settings/sections/reports/exportReport.ts:10` | `reportExportTable` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |
| `src/components/settings/sections/reports/exportReport.ts:52` | `exportScopedExcel` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |

## `src/components/shifts/calendar/ShiftCalendarPlan.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/shifts/calendar/ShiftCalendarPlan.tsx:47` | `ShiftCalendarPlan` | UI | capabilities | Vardiya ve PDKS ayarlarını gösterir | **`schedule.manage`** | arg | — |

## `src/components/sync/SyncIssuesBanner.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/sync/SyncIssuesBanner.tsx:53` | `SyncIssueRow` | UI | isSuperAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | doc.projectId | — |
| `src/components/sync/SyncIssuesBanner.tsx:53` | `SyncIssueRow` | UI | isSuperAdmin | Personel silme uyarısı kapatmayı gösterir | **`super_admin`** | doc.projectId | canDismissDeletion: isSuperAdmin && hikvision && canDismiss. |
| `src/components/sync/SyncIssuesBanner.tsx:123` | `SyncIssuesBanner` | UI | isAdmin + isSuperAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | doc.projectId | — |

## `src/components/visitors/VisitorManagement.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/components/visitors/VisitorManagement.tsx:22` | `VisitorManagement` | UI | isAdmin + isSuperAdmin | Ziyaretçi yönetim araçlarını gösterir | **`visitors.manage`** | doc.projectId | — |
| `src/components/visitors/VisitorManagement.tsx:22` | `VisitorManagement` | UI | isAdmin + isSuperAdmin | Yeni bölge oluşturma aracını açar | **`devices.manage`** | doc.projectId | Ziyaretçi yönetiminden ayrılmalı. |

## `src/contexts/ActiveProjectContext.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/contexts/ActiveProjectContext.tsx:68` | `ActiveProjectProvider` | UI | role karşılaştırması + isAdmin + isSuperAdmin | Aktif proje kapsamı ve rol bayraklarını taşır | **`üye`** | doc.projectId | Ortak bayraklar; işlem başına yetkiyi çağıran bileşen seçmeli. |

## `src/hooks/useActiveProjectScope.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/hooks/useActiveProjectScope.ts:4` | `useActiveProjectScope` | UI | isAdmin + isSuperAdmin | Aktif proje kapsamı ve rol bayraklarını taşır | **`üye`** | getProjectIdsForUser listesi | Ortak bayraklar; işlem başına yetkiyi çağıran bileşen seçmeli. |

## `src/hooks/useEmployees.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/hooks/useEmployees.ts:5` | `useEmployees` | UI | isSuperAdmin | Personel görüntüleme kapsamını seçer | **`employees.view`** | getProjectIdsForUser listesi | — |

## `src/hooks/useNotificationSettings.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/hooks/useNotificationSettings.ts:13` | `useNotificationSettings` | UI | isAdmin | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/hooks/useProjectAccess.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/hooks/useProjectAccess.ts:11` | `useProjectAccess` | UI | isAdmin + isSuperAdmin | Aktif proje kapsamı ve rol bayraklarını taşır | **`üye`** | getProjectIdsForUser listesi | Ortak bayraklar; işlem başına yetkiyi çağıran bileşen seçmeli. |

## `src/hooks/useProjectFilteredDevices.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/hooks/useProjectFilteredDevices.ts:11` | `useProjectFilteredDevices` | UI | isSuperAdmin | Proje kapsamını veya rol etiketini gösterir | **`üye`** | getProjectIdsForUser listesi | — |

## `src/lib/capabilities.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/lib/capabilities.ts:4` | `capabilities` | UI | settingsTabs work-payroll | Vardiya ve bordro ayar bölümünü açar | **`schedule.manage`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/lib/capabilities.ts:4` | `capabilities` | UI | settingsTabs reports | Rapor ayar bölümünü açar | **`reports.view`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/lib/capabilities.ts:4` | `capabilities` | UI | settingsTabs integrations | Cihaz entegrasyon ayar bölümünü açar | **`devices.manage`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/lib/capabilities.ts:4` | `capabilities` | UI | capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |
| `src/lib/capabilities.ts:4` | `capabilities` | UI | settingsTabs mail / systemAdmin | Platform posta ayar bölümünü açar | **`super_admin`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |

## `src/lib/pdksExportColumns.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/lib/pdksExportColumns.ts:42` | `availablePDKSColumns` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |
| `src/lib/pdksExportColumns.ts:45` | `defaultPDKSPreferences` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |
| `src/lib/pdksExportColumns.ts:48` | `selectedPDKSColumns` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |
| `src/lib/pdksExportColumns.ts:61` | `readPDKSPreferences` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |
| `src/lib/pdksExportColumns.ts:76` | `savePDKSPreferences` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |

## `src/lib/roleLabels.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/lib/roleLabels.ts:2` | `roleLabel` | UI | Çalışan rol kontrolü yok | Rol metadata veya açıklamasını taşır | **`üye`** | yok | Çalışan bir rol kapısı değil; literal, indeks adı, yorum veya import eşleşmesi. |

## `src/lib/routeMeta.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/lib/routeMeta.ts:5` | `routeMeta` | UI | /audit-log ve /settings adminOnly | Ayar ve denetim menüsünü tanımlar | **`admin.manage`** | arg | /settings alt bölümler iş yetkilerine ayrılmalı. |
| `src/lib/routeMeta.ts:5` | `routeMeta` | UI | /system-admin superAdminOnly | Platform menü görünürlüğünü tanımlar | **`super_admin`** | arg | /system-admin superAdminOnly korunmalı. |
| `src/lib/routeMeta.ts:5` | `routeMeta` | UI | /alarms adminOnly | Alarm menü görünürlüğünü tanımlar | **`üye`** | arg | adminOnly alarm listesinde PLAN ile çelişiyor; liste her üyeye açılmalı. |
| `src/lib/routeMeta.ts:40` | `visibleRoutes` | UI | capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/pages/Alarms.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Alarms.tsx:85` | `Alarms` | UI | isAdmin | Alarm onaylama araçlarını gösterir | **`alarms.ack`** | arg | — |
| `src/pages/Alarms.tsx:85` | `Alarms` | UI | isAdmin | Alarm bildirim ayarlarını açar | **`admin.manage`** | arg | Onaylama alarms.ack; bildirim ayarı admin.manage olarak ayrılmalı. |

## `src/pages/AuditLog.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/AuditLog.tsx:17` | `AuthorizedAuditLog` | UI | role karşılaştırması | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |
| `src/pages/AuditLog.tsx:17` | `AuthorizedAuditLog` | UI | role karşılaştırması | Tüm projeler denetim filtresini gösterir | **`super_admin`** | arg | Tek proje denetimi admin.manage; platform toplu görünüm super_admin. |
| `src/pages/AuditLog.tsx:38` | `AuditLog` | UI | capabilities | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | arg | — |

## `src/pages/Devices.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Devices.tsx:27` | `Devices` | UI | isAdmin | Cihaz yönetim araçlarını gösterir | **`devices.manage`** | doc.projectId | — |

## `src/pages/Employees.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Employees.tsx:40` | `EmployeePage` | UI | isAdmin | Personel düzenleme araçlarını gösterir | **`employees.manage`** | arg | — |
| `src/pages/Employees.tsx:40` | `EmployeePage` | UI | isAdmin | Personel dışa aktarımını gösterir | **`reports.view`** | arg | İçe aktarım employees.manage; dışa aktarım reports.view olarak ayrılmalı. |

## `src/pages/Index.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Index.tsx:15` | `Index` | UI | isSuperAdmin | Proje kapsamını veya rol etiketini gösterir | **`üye`** | arg | — |

## `src/pages/Leaves.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Leaves.tsx:28` | `Leaves` | UI | isAdmin | İzin veya PDKS düzenlemesini gösterir | **`attendance.approve`** | arg | — |
| `src/pages/Leaves.tsx:57` | `LeavesProject` | UI | isAdmin | İzin veya PDKS düzenlemesini gösterir | **`attendance.approve`** | arg | — |

## `src/pages/PDKSRecords.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/PDKSRecords.tsx:39` | `PDKSContent` | UI | isAdmin | İzin veya PDKS düzenlemesini gösterir | **`attendance.approve`** | arg | — |

## `src/pages/Profile.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Profile.tsx:10` | `Profile` | UI | üst bileşenden gelen yetki bayrağı | Proje kapsamını veya rol etiketini gösterir | **`üye`** | arg | — |

## `src/pages/Reports.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Reports.tsx:16` | `OfficialReports` | UI | capabilities | Rapor ekranını gösterir | **`reports.view`** | arg | — |

## `src/pages/Settings.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/Settings.tsx:26` | `Settings` | UI | settingsTabs work-payroll | Vardiya ve bordro ayar bölümünü açar | **`schedule.manage`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/pages/Settings.tsx:26` | `Settings` | UI | settingsTabs reports | Rapor ayar bölümünü açar | **`reports.view`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/pages/Settings.tsx:26` | `Settings` | UI | settingsTabs integrations | Cihaz entegrasyon ayar bölümünü açar | **`devices.manage`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |
| `src/pages/Settings.tsx:26` | `Settings` | UI | capabilities + isSuperAdmin | Yönetim ekranı erişimini sınırlar | **`admin.manage`** | doc.projectId | — |
| `src/pages/Settings.tsx:26` | `Settings` | UI | settingsTabs mail / systemAdmin | Platform posta ayar bölümünü açar | **`super_admin`** | arg | Tek adminTabs kapısı iş yetkilerine ayrılmalı; karar 10. |

## `src/pages/SystemAdmin.tsx`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/pages/SystemAdmin.tsx:17` | `SystemAdmin` | UI | capabilities | Platform yönetimini gösterir | **`super_admin`** | arg | — |

## `src/services/authService.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/services/authService.ts:7` | `checkUserRole` | UI | role karşılaştırması | Oturum rolü hiyerarşisini hesaplar | **`üye`** | yok | Genel rol hiyerarşisi; requiredRole=admin işlemleri çağırana göre ayrılmalı. |

## `src/utils/pdksExport.ts`

| Dosya:satır | Export / bileşen | Tür | Mevcut kapı | Ne yapıyor | Önerilen anahtar | projectId kaynağı | Not |
|---|---|---|---|---|---|---|---|
| `src/utils/pdksExport.ts:16` | `buildPDKSExportTable` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |
| `src/utils/pdksExport.ts:135` | `exportToPdf` | UI | canSeePay parametresi | Dışa aktarımda ücret sütunlarını sınırlar | **`pay.view`** | arg | Ücret kararı üst bileşenden gelir; veri sunucuda da maskelenmeli. |

## ÇEKİRDEK (yeni)

Koordinatörün eşzamanlı Faz 1 çalışmasıdır; mevcut kapı dönüşüm satırlarına ve sayılara dahil edilmedi.

- `convex/schema.ts`: proje rolü, proje yetki kutucukları ve davet doğrulayıcıları.
- `convex/lib/roleCatalog.ts`: beş rol, on üç anahtar ve değiştirilemeyen yönetici kuralları.
- `convex/lib/permissions.ts`: üyelik, etkin yetki, platform/orphan istisnası ve son yönetici koruması.
- `convex/roles.ts`: proje rolleri/üyeleri yönetimi ve action yetki doğrulama uçları.
