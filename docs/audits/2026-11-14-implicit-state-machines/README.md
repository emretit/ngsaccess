# Örtük durum makinesi audit'i — 2026-11-14

## Durum

- [x] Alan A, cihaz ve senkron → [device-sync.md](device-sync.md) (Codex gpt-6.1-sol high)
- [x] Alan B, personel, PDKS, vardiya ve izin → [people-pdks.md](people-pdks.md) (Codex gpt-6.1-sol high)
- [x] Alan C, erişim, ziyaretçi, hesap ve bildirim → [access-visitor-account.md](access-visitor-account.md) (Codex gpt-6.1-sol high)
- [x] Critical/high bulgular koordinatör tarafından koddan yeniden okundu, şiddetler yeniden derecelendirildi
- [ ] Düzeltmeler (bu audit salt okumaydı; kod, DB ve commit değişmedi)

## Özet

- **79 makine kaydı** bulundu: A 25, B 23, C 31. Bazı makineler birden fazla alanda raporlandı (proje taşıma A22=B2/B3, kapı planı A5=C5, saklama zinciri A24=B22=C29). Bunlar tekilleştirilince **~74 benzersiz makine** kalıyor.
- Convex'te DB trigger'ı ya da CHECK kısıtı yok. Bir durum geçişinin kuralı ancak iki yerde zorlanabiliyor: mutation içindeki ön-durum kontrolünde ve schema'daki `v.union(v.literal…)` değer kümesinde. Değer kümesi zorlaması yaygın; geçiş kontrolü ise çoğu makinede var. Asıl açıklar şu üç yerde: **action → dış çağrı → mutation** arasındaki yarışlar, **deneme kimliği olmayan ACK'ler** (cihazdan gelen "tamam" onayları) ve **terminal duruma hiç geçmeyen satırlar**.
- Doğrulama sonrası dağılım: **critical 1 · high 8**. Worker'ların ilk dağılımı 3 critical / 11 high idi; 5 bulgunun şiddeti düşürüldü, aşağıdaki tabloda gerekçeleriyle birlikte yer alıyor.
- Web ↔ mobil ↔ backend değer kopyalarında ciddi ayrışma bulunmadı. Talep durumları ve ziyaretçi durumları uyumlu.

## Makine listesi (özet tablo)

Ayrıntılı geçiş tabloları, yazan yollar (dosya:satır) ve okuyan kopyalar alan raporlarında.

| Alan | # | Varlık | Saklama | Durumlar (kısa) | Zorlama | Bulgu |
|---|---|---|---|---|---|---|
| A | 1 | Cihaz etkinliği | devices.status/isActive | active/inactive (+legacy online/offline) | mutation normalize | — |
| A | 2 | Cihaz bağlantısı/ISUP | devices.lastSeen/hikIsup*/heartbeat* | never/online/offline + alarm | mutation zaman kontrolü | — |
| A | 3 | Provizyon/havuz | adminDevices.assigned* | boş/rezerve/atanmış/serbest | mutation ön-kontrol | — |
| A | 4 | Kapı/okuyucu etkinliği | doors.status, readers.status | active/inactive (serbest string) | **yok** | A-06 |
| A | 5 | Kapı durum/doğrulama planı | doors.hikPlan* | kaydedildi/bekliyor/uygulandı/hata | revizyon kontrolü | — |
| A | 6 | Okuyucu/iş durumu snapshot | readers.hikVerifyMode, devices.hikWorkStatus | cihazdan gelen ham | yok (snapshot) | — |
| A | 7 | Hik köprü kimliği/uyandırma | hikBridges.* | kayıtlı/uyandırma planlı | mutation | A-08 |
| A | 8 | Hik işlem kuyruğu | hikPendingOperations.status | pending/processing/done/failed | enum + claim/ACK, **deneme kimliği yok** | A-03 |
| A | 9 | IDE işlem kuyruğu (MQTT) | idePendingOperations.status | pending/sent/acked/failed | enum + msxId (opsiyonel) | A-04 |
| A | 10 | IDE izin sayacı | ideSequences | monoton | transaction | — |
| A | 11 | IDE panel roster | idePanelUsers | yok/ithal/yönetilen/silinmiş | mutation | — |
| A | 12 | Senkron çalıştırması | deviceSyncRuns.status | running/done/partial/failed | summarizeRun | — |
| A | 13 | Senkron hedefi | deviceSyncRunTargets.status | queued/sent/verified/failed/skipped/unknown | mutation | — |
| A | 14 | Senkron sorun görünürlüğü | *.dismissedAt | açık/kapatılmış/retry | mutation | — |
| A | 15 | Kart okuma/olay sınıfı | cardReadings.accessStatus, deviceEvents.* | izin/red; olay açık/çözüldü | enum | — |
| A | 16 | Backfill/reconcile | devices.hikBackfill* | yok/arama/sayfa/hata/bitti | compare-and-set | — |
| A | 17 | Sanal okuyucu/kiosk | devices.deviceType + UI evresi | invalid/denied/granted | mutation + UI | — |
| A | 18 | Parmak izi kaydı | deviceFingerprintEnrollments.* | bekliyor/iptal/kayıtlı/silme | attemptId eşitliği | — |
| A | 19 | Biyometrik şablon yazımı | employeeFaces/Fingerprints | yok/kayıtlı/değişti/silindi | kuyruk enum | — |
| A | 20 | Biyometrik imha işi | auditLog.newValue (run) | running/waitingDevices/completed/failed | Zod + mutation | — |
| A | 21 | Mobil kapı açma | mobileAccessOperations.status | pending/sent/confirmed/failed/unknown | enum + mutation | A-05 |
| A/B | 22 | Proje erişim taşıması | accessTransfers.status, accessTransferTargets.state | requested…done/stuck/cancelled | enum + ön-durum | A-07 |
| A | 23 | Köprü olay kuyruğu | PanelWorker.cs, bridge.mjs spool | queued/inflight/retry/delivered/dropped | yerel kod | A-01, A-02 |
| A/B/C | 24 | Saklama/temizleme zinciri | scheduler args stage/batch/cursor | aşama/sayfa/bitti/bütçe doldu | stage doğrulama | A-05, C-05 |
| A | 25 | Cihazdan kişi içe aktarma | hikDeviceImport sınıflama | new/matched/conflict/manual | mutation yeniden sınıflama | — |
| B | 1 | İstihdam/erişim başlangıcı | employees.isActive/employmentEndDate/terminatedAt/accessStartsAt | aktif/pasif/ayrılış planlı/ayrılmış | mutation | **B-01** |
| B | 4 | Departman geçmişi | employeeDepartmentHistory | baseline/change | mutation | — |
| B | 5 | Personel şifre kurulum | employeeAuth.* | kurulmamış/token/hazır | token+süre | — |
| B | 6 | Mobil oturum | employeeSessions + isActive | geçerli/expired/revoked/inactive | mutation | B-02 |
| B | 7 | Check-in QR token | checkInTokens.* | pending/consumed/expired | tek kullanım | — |
| B | 8 | Manuel PDKS | pdksRecords.status | present (serbest string) | mutation | — |
| B | 9–10 | PDKS gün/payroll sınıfı | hesaplanan (pdksTable/pdksCalc) | present/late/absent/leave/…/notEmployed | yalnız hesap | B-01 |
| B | 11–12 | PDKS kural sürümü/kontrol noktası | pdksRuleVersions, pdksCheckpointSelections | legacy/requirements; all/selected | enum + mutation | — |
| B | 13–16 | Vardiya tanımı/sürüm/atama/departman planı | shifts*, shiftAssignments, departmentShiftAssignments | aktif/pasif; fixed/flexible; atandı/atlandı | enum + validate | — |
| B | 17 | İzin talebi | leaves.status | pending/approved/rejected (geri çekme = silme) | pending kontrolü | — |
| B | 18 | İzin bakiyesi | leaveBalances | — (akışa bağlı değil) | yok | B-06 |
| B | 19 | PDKS düzeltme talebi | attendanceCorrections.status | pending/approved/rejected/withdrawn | pending+kimlik | B-03 |
| B | 20 | Tatil/çalışma/mesai ayarları | holidays, workSettings, overtimeRates | yarım/tam; mod | enum | — |
| B | 21 | Rapor hatırlatma gönderimi | reportScheduleSettings.lastSentAt | kapalı/açık; gönderildi | yok (yalnız log) | B-04, B-05 |
| B | 23 | Rıza kaydı | employeeConsents | verilmiş/geri alınmış | enum | B-07 |
| C | 1–2 | Erişim kuralı + üyelik | accessRules.isActive, groupMembers.source | aktif/pasif; manuel/departman | mutation | C-02 |
| C | 3 | Dağıtılmış erişim sonucu | accessGrantStatus.state | pending/effective/failed/removed | enum, **toplu yazımda sıra kontrolü yok** | C-03 |
| C | 4 | Erişim zamanı/karar | accessRules.days/time, employees.accessExpiresAt/StartsAt | açık/kapalı pencere | saf fonksiyon | — |
| C | 6–11 | Ziyaretçi yaşam döngüsü, kart, mobil davet, konum, cihaz kanıtı, saklama | employees.visitorStatus/isVisitor/accessExpiresAt… | preRegistered/checkedIn/checkedOut/expired | enum + mutation | C-05 |
| C | 12–14 | Kullanıcı doğrulama, dondurma, oturum iptali | users.verified/disabledAt/sessionsRevokedThrough | etkin/donmuş/süresi dolmuş | auth guard | C-04 |
| C | 15–17 | Rol/üyelik/proje aktifliği | users.role, userProjects.role, projects.isActive | 5 rol × yetki; aktif/pasif | mutation | C-02, C-06 |
| C | 18–20 | Davet/reset/şifre kurulum | invites.used/type/expiresAt | açık/kullanıldı/süresi dolmuş | mutation | C-01 |
| C | 21 | İstek kotası | rateLimiter component | var/yetersiz | component | — |
| C | 22–24 | Alarm onay, e-posta teslimi, tercihler | deviceEvents.acked*/alarmEmailStatus | queued/sending/retryScheduled/sent/failed/skipped | enum + attempt | — |
| C | 25 | Proje SMTP | mailSettings.isActive | kayıtsız/eksik/tam; aktif/pasif | mutation | C-04 |
| C | 26–31 | Yükleme, audit, gizlilik, genel ayar, sohbet | pendingUploads, auditLog, projectPrivacySettings… | çeşitli | mutation | C-07, C-08 |

## Doğrulanmış critical/high bulgular

Her bulgunun kanıtını koordinatör olarak koddan yeniden okudum. Yazan worker'ın kendi değerlendirmesine dayanmadım.

| ID | Şiddet | Makine | Sorun | Kanıt | Doğrulama |
|---|---|---|---|---|---|
| **B-01** | **critical** | İstihdam → PDKS günü | Personel formundan pasife alınan ama ayrılış tarihi girilmemiş kişinin **tüm geçmiş günleri** `notEmployed` sayılıyor. Requirements modunda kart okumaları ve manuel saatler hesaptan düşüyor, bu da geçmiş ay bordrosunu değiştiriyor. | `convex/lib/employment.ts:8-11` (ayrılış tarihi yoksa sonuç `isActive`'e bağlı), `convex/lib/pdksTable.ts:303-308,344`, `convex/lib/pdksPayrollQuery.ts:179`, `convex/employees.ts:388` | DOĞRULANDI |
| B-02 | high | Mobil oturum | Pasifleştirme oturum sürümünü artırmıyor. Kişi yeniden aktifleşince süresi dolmamış eski mobil token tekrar geçerli oluyor. | `convex/lib/employeeAuth.ts:26-34`, `convex/employeeTermination.ts:36` | DOĞRULANDI (ürün kararı: askıya almada eski oturum dönmeli mi?) |
| B-03 | high | PDKS düzeltme kuyruğu | `listPending` proje başına `take(200)` sonrasında cursor=200 döndürüyor; sonraki sayfa boş ama `isDone=false` olduğu için sayfalama sonsuz döngüye giriyor ve en eski talepler görünmüyor. | `convex/attendanceCorrections.ts:74-80` | DOĞRULANDI |
| A-01 | high (critical'dan indirildi) | Köprü olay kuyruğu | Windows köprüsü olayları bellekte 256'lık bir kuyrukta tutuyor; kuyruk dolunca en eskiyi atıyor (DropOldest), 5 başarısız denemeden sonra da olayı bırakıyor. Servis kapanınca bellekteki her şey kayboluyor. | `bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs:27-29,153-158` | DOĞRULANDI. Linux köprüsü (`infra/hik-event-bridge`) olayları diske fsync'li yazıyor ve yalnız 1000 kayıtta düşürüyor (`bridge.mjs:217`), o tarafın etkisi medium. Windows köprüsünün canlıda kullanılıp kullanılmadığı belirsiz. |
| A-02 | high (bilinen) | Köprü protokolü | Windows köprüsü backend'den kaldırılmış `/hik-bridge/roster` ve `/roster-ack` yollarını çağırıyor. Sonuç: 404, komut gelmiyor, kuyruk pending'de kalıyor. | `ConvexBridgeClient.cs:51,67`, `convex/http.ts:473-474` | DOĞRULANDI (2026-10-19'dan beri bilinen açık risk: DS-K2804) |
| A-03 | high | Hik işlem kuyruğu | Dedupe (aynı işi birleştirme) adımı işlenmekte olan satırı yeni payload'la `pending`'e çeviriyor. Ardından eski denemeden gecikmeli gelen ACK, deneme kimliği kontrol edilmediği için yeni işi `done` ve yetkiyi `effective` yapabiliyor. | `convex/hikvisionSync.ts:476-487,619-625,683-695` | DOĞRULANDI. Şu an aktif local-bridge tüketicisi yok (A-02); köprü yeniden yazılınca devreye girer. |
| A-05 | high | Mobil kapı açma | IDE yolunda `mobileAccessOperations` satırını `confirmed`'a çeken bir yazım yolu yok; satır sonsuza dek `pending`/`sent` kalıyor. Saklama temizliği yalnız confirmed/failed/unknown sildiği için bu satırlar **hiç silinmiyor** (KVKK saklama süresi aşılıyor). IDE kuyruğu temizlenince geçmişte görünen sonuç da "unknown"a dönüyor. | `convex/mobileAccess.ts:27-45,163-182`, `convex/privacyRetention.ts:342-344` | DOĞRULANDI |
| C-02 | high | Rol ↔ kural okuma | `accessRules.list` yalnız proje üyeliğine bakıyor. `employees.view` yetkisi olmayan bir üyeye bile kural üyelerinin ad, soyad ve e-postası dönüyor; okuma kapısı ile yetki kapısı birbirini tutmuyor. | `convex/lib/accessRuleRead.ts:5-36`, `convex/accessRules.ts:212-217` | DOĞRULANDI |
| C-03 | high | Erişim sonucu | Toplu gateway sonuçları işlem kimliği ya da sürüm taşımıyor. Geç biten eski bir action, sonradan yazılmış `removed`/`pending` durumunu `effective` ile eziyor. | `convex/lib/hikSyncEmployee.ts:378-389,587-590`, `convex/lib/grantStatus.ts:148-159` | DOĞRULANDI |

### Şiddeti düşürülen bulgular

| ID | Worker'ın derecesi → yeni | Gerekçe |
|---|---|---|
| C-01 davet şifre yarışı | critical → medium | Davet token'ının sızmış olması gerekiyor, ayrıca `resetClaimedAccount` ile `modifyAccountCredentials` arasındaki milisaniyelik pencerede hem giriş hem davet tüketimi olmalı (`convex/invites.ts:249-254`). Sorun gerçek ama pratikte istismarı çok zor. Yine de tek mutation'a toplanmalı. |
| A-04 IDE ACK'te msxId opsiyonel | high → medium | Canlı MQTT köprüsü her ACK'te msxId gönderiyor (`scripts/lib/ide-mqtt-routing.mjs`, nodetest :23/:49). Bu bulgu bir savunma derinliği açığı. |
| B-04 aylık rapor hatırlatması | high → medium | Yalnız hatırlatma e-postası kayboluyor, retry yok. Veri ya da para etkisi yok. |
| C-05 ziyaretçi saklama zinciri | high → medium | Günlük 20 çağrılık bütçe her gün ilk projeden başlıyor (`privacyRetention.ts:192,362-395`, batch 25). Retention'ı açık 20'den fazla proje olunca sondaki projeler hiç işlenmiyor. Bugünkü proje sayısında tetiklenmiyor. |
| C-04 SMTP kaydında dondurma kontrolü | high → low | Pencere yalnız şifreleme süresi kadar (milisaniyeler). `authedAction` girişte kontrol ediyor. |

Medium ve low bulguların tamamı (A-06/07/08, B-05/06/07, C-06/07/08) alan raporlarında.

## Öncelikli 5 aksiyon

1. **B-01, geçmiş PDKS kaybı** (~1-2 saat + ürün kararı). `employedOn` artık `isActive`'e bakmamalı; yalnız tarihli istihdam alanlarına (`employmentEndDate`, gerekirse yeni `deactivatedAt`) dayanmalı. Bunun yerine form pasifleştirirken ayrılış tarihi zorunlu tutulabilir. Kapı: `convex/lib/pdksTable.test` + payroll testleri.
2. **A-05, mobil kapı açma satırları terminale geçmiyor** (~1 saat). Komut acked/failed olunca `mobileAccessOperations` satırını aynı mutation içinde `confirmed`/`failed`'a geçirin. Eski pending/sent satırlar için de yaşa göre terminale geçirme ve temizlik yolu ekleyin (KVKK saklama).
3. **A-03 + C-03, gecikmiş sonuç yeni durumu eziyor** (~3 saat, tek kalıp). Her claim ya da gönderimde bir deneme/nesil token'ı üretin. ACK'te ve `recordGrantResults`'ta bu token'ı güncel değerle karşılaştırın, eşleşmeyen sonucu atın.
4. **B-02 + C-02, oturum ve okuma kapıları** (~1 saat). Pasifleştirme ve işten çıkışta `employeeAuth.passwordVersion`'ı artırın (ya da oturumları iptal edin). `listAccessRules` kişi bilgisini yalnız `employees.view` yetkisi olana döndürsün.
5. **B-03, düzeltme kuyruğu sayfalaması** (~30 dk). `listPending` gerçek index cursor'ıyla `paginate` kullanmalı; tek proje olduğunda doğrudan `.paginate()` çağrılabilir.

Sonra: Windows köprüsünün yeniden yazımı (A-01/A-02, kalıcı disk kuyruğu + cihaz token'lı poll/ack), A-04 msxId zorunluluğu, C-01 tek mutation, C-05 proje bazlı adil bütçe.

## Yöntem ve sınırlar

- 3 Codex worker (gpt-6.1-sol, high), alana göre bölündü, `--worktree current` ile çalıştı. Hepsi salt okumaydı: kod, test, DB ve commit değişmedi. Worker'ların sonunda yaptıkları `git diff --stat` kontrolü ve koordinatörün `git status` karşılaştırması yalnız bu klasörün eklendiğini gösteriyor.
- Keşif sayımları alanın tamamında `rg` ile koşturuldu. Komutlar ve sayılar her alan raporunun "Keşif sayımları" bölümünde.
- Testler ve canlı cihaz/DB üzerinde deneme ÇALIŞTIRILMADI. Bulgular kod okumasına dayanıyor. "Koşullu" diye işaretlenenler canlıda gözlenmedi.
