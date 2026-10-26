# M5 — Mobil uygulama ve çalışan uçları

## 1. Sonuç

Mobil oturum, güvenli saklama, tek kullanımlık QR ve kapı komutunun tekrar gönderilmesini önleme korumaları büyük ölçüde kurulmuş; ancak pasif proje kontrolü ve tüketilmiş QR üzerinden kişisel veri erişiminde açıklar var. Yeni vardiya hesabı mobil özet okuyucusuyla uyuşmuyor; ayrıca çalışma ağacına eklenen düzeltme başvurularının yönetici kuyruğu daha önce kaldırıldığı için süreç tamamlanamıyor. **Yeni bulgular: P0: 2 / P1: 4 / P2: 1 / P3: 0; toplam 7** — eski maddeler aşağıda ayrıca değerlendirilmiştir, bu sayıma katılmamıştır.

İnceleme: 2026-10-25, yerel `main`, HEAD `520ba5fc`; son 120 commit okundu. Satırlar çalışma ağacına aittir. `convex/attendanceCorrections.ts`, `convex/leaveRequests.ts`, `convex/lib/requestRules.ts`, mobil talep ekranı/model/provider/repository ve bunları bağlayan router/main/home/l10n dosyaları **(commit'siz WIP)**; `git diff HEAD` ile ayrıldı. Auth/QR/kapı/özet çekirdeğinde bu tur HEAD farkı yok; WIP'in canlıya çıktığı varsayılmadı.

Doğrulama: `flutter analyze --no-pub` **0 sorun**; hedefli Vitest dosyaları `mobileAttendance.test.ts`, `employeeCheckIn.test.ts`, `mobileAccess.handlers.test.ts` **67/67**, `pdksFixedRules.integration.test.ts`, `virtualReaders.test.ts` **7/7** geçti. Bunlar yerel sahte veri kullanan testlerdir; canlı DB/cihaz çağrısı yapılmadı. TR/EN ARB katalogları **457/457**, eksik anahtar yok; bu, bütün hata kodlarının anlaşılır metne çevrildiği anlamına gelmez. Flutter testleri özellikle çalıştırılmadı; kaynakları okundu.

## 2. Modül haritası

| Alan | Dosyalar | Tablolar / bağ | Sayfa / ekran |
|---|---|---|---|
| Çalışan oturumu | `convex/employeeAuth.ts`, `convex/lib/employeeAuth.ts`, `convex/lib/customFunctions.ts:89`; `mobile/lib/providers/auth_provider.dart`, `services/session_store.dart` | `employees`, `employeeAuth`, `employeeSessions`, `projects`, `departments` | Login, splash, profil, parola değiştirme; web `EmployeeSetup.tsx` |
| QR | `convex/employeeCheckIn.ts`, `convex/lib/checkInUx.ts`, `lib/processCardReadingCore.ts:290`; `mobile/lib/providers/qr_provider.dart`, `repositories/qr_repository.dart` | `checkInTokens`, oturum/parola sürümü; tüketimde `cardReadings` | QR göster/tara; web `/check-in`; M2 tablet okuyucu |
| Kapı açma | `convex/mobileAccess.ts`, `lib/mobileAccess.ts`, `mobileAccessGateway.ts`; `mobile/lib/providers/door_operation_provider.dart`, `services/door_operation_store.dart` | `mobileAccessOperations`, `idePendingOperations`, `hikPendingOperations`, `groupMembers/groupDevices/groupDoors`, `accessRules`, `accessScheduleTemplates`, `doors/devices` | Ana sayfa hızlı aç, kapı seçimi, belirsiz sonuç kurtarma |
| Hareket ve devam özeti | `convex/mobileAttendance.ts`, `lib/mobileAttendance.ts`; `mobile/lib/models/attendance*.dart`, `providers/attendance_provider.dart` | `cardReadings`, `pdksRecords`, `leaves`, vardiya/plan/kural/tatil ayarları | Ana sayfa, geçmiş, takvim, hafta/ay özeti |
| Ziyaretçi | `convex/mobileVisitors.ts`, `lib/mobileVisitors.ts`; `mobile/lib/providers/visitor_provider.dart`, `services/visitor_create_intent_store.dart` | `employees` içindeki pasif ön kayıt; `projectPrivacySettings`; salt okunan cihaz kuyrukları | Davet listesi, form, detay; M1 operatör aktivasyonu |
| Talepler (commit'siz WIP) | `convex/leaveRequests.ts`, `attendanceCorrections.ts`, `lib/requestRules.ts`; `mobile/lib/screens/requests/requests_screen.dart`, `providers/request_provider.dart` | `leaves`, `attendanceCorrections`, `pdksRecords`, `auditLogs` | Ana sayfa → Talepler; yönetici izin kuyruğu var, düzeltme kuyruğu yok |

Public uç envanteri ve sınırlar:

- `employeeAuth`: `getByToken` anonim kurulum bilgisi; `signIn` e-posta başına sınırlı giriş; `signOut` verilen oturumu siler; `me/changePassword` çalışan oturumu ister. Parola yazımı sürümü artırıp eski oturumları kapatır. `create/update/getByEmployee/getByTokenInternal/consumeSetupToken/wipeLegacyHashes/cleanupExpiredSetupTokens` internal (dış istemciye kapalı).
- `mobileAccess`: `listTargets/requestOpen/getOperation/getRequestOperation` çalışan ve proje/hedef sahipliğini denetler; `claimGateway/finishGateway/expireQueue` internal. Keşif ve gönderim öncesi aynı kural/saat/hedef kontrolü kullanılır. `requestOpen` tek `requestId` için tek kuyruk kaydı üretir; kapı komutu puantaj yazmaz.
- `employeeCheckIn`: `createMyCheckInToken/getMyCheckInTokenStatus` oturumlu; `checkInWithToken` anonim uyumluluk ucu, yeni geçiş oluşturmaz. Tüketim yalnız okuyucu yetkisiyle yapılır; QR 60 saniye, `usedAt` aynı işlem içinde yazılır.
- `mobileAttendance`: `listPage/summary` çalışanı sunucuda bulur; tarih/sayfa/cursor doğrulaması, zaman indeksleri ve okuma sınırları var. Özet 93 gün / 10.000 hareket sınırında açık hata verir; listede devam anahtarı var.
- `mobileVisitors`: `notice/getCreateReceipt/listPage/summary/detail/create/update/cancel` çalışan oturumu ister; kendi ev sahipliği, proje ve ziyaretçi durumu sınırları var. Create UUID ile tekrarları birleştirir, gerçek kart/yetki/senkronizasyon oluşturmaz. Sayfa 30, tarama 200; özet 1.000 sınırında eksiklik işareti döner.
- Talepler: `submit/listMine/withdraw` çalışan oturumu; `listPending/approve/reject` web kullanıcı + proje + `attendance.approve`; `leaveRequests.pendingCount` aynı izinle sınırlı. Onay PDKS yazımıyla aynı işlemde gerçekleşir. Çalışanın kendi geçmişinin eski projeyi kapsaması tek başına yabancı kişinin verisine erişim değildir.
- HTTP: mobil istemci Convex query/mutation uçlarını kullanır; kendi özel HTTP router'ı yok. Kapı gönderimi `mobileAccessGateway.send` internal action ile harici gateway'e gider; IDE kuyruğu kendi tüketicisine gider. Bu audit hiçbirini çağırmadı.
- Zamanlanan işler: kapı gönderimi hemen, kuyruk sona erdirme 30 saniye (`convex/mobileAccess.ts:101`); günlük kurulum token temizliği (`convex/crons.ts:83`). Çalışan oturumu ve QR kayıtlarının süre dolumu temizliği bulunamadı (B-07).
- İncelenen ana backend dosyalarında `any`, `as any`, `filter(Boolean)` veya sınırsız `.collect()` yok. İç içe yetki grafiği okumaları parça başına 500 sınırı taşısa da toplam işlem maliyeti ayrıca yük testi gerektirir (`convex/lib/mobileAccess.ts:85`).

## 3. Yeni bulgular

| ID | Önem | Tür | Yer (file:line) | Ne oluyor (kullanıcı gözünden) | Kanıt (kısa) | Öneri | Emek | Güven |
|---|---|---|---|---|---|---|---|---|
| B-01 | P0 | YETKİ | `convex/employeeCheckIn.ts:61`; `convex/lib/checkInUx.ts:4`; `convex/lib/employeeUx.ts:11` | Kullanılmış QR'ı elinde tutan biri, çalışan çıkış yapsa veya kaydı silinse bile adını ve okutma zamanını anonim olarak okuyabilir. | `usedAt` kontrolü süreden önce; public uç tamamlanmış kaydın `employeeName/accessTime` alanlarını oturum/çalışan kontrolü olmadan döndürür. Silme zinciri `checkInTokens` tablosunu temizlemez (`convex/employees.ts:394`). Bu, yeni kapı açma veya yeniden puantaj yazma açığı değildir; kopyalanmış token üzerinden kalıcı kişisel veri erişimidir. | Sonuç okumasını sahip oturumuna bağla; anonim uyumluluk sonucunda kişisel alanları kaldır veya kısa süreyle sınırla; çalışan silmede token kopyalarını temizle. | M | KESİN |
| B-02 | P0 | YETKİ | `convex/lib/mobileAccess.ts:174`; `convex/lib/mobileAccess.ts:177`; `convex/virtualReaders.ts:89` | QR üretildikten sonra proje pasifleştirilirse tablet okuyucu, QR'ın kalan süresinde yine başarılı geçiş kaydı yazabilir. | Üretim proje aktifliğini denetler (`convex/employeeCheckIn.ts:17`); sanal okuyucu tüketiminde aynı-proje/cihaz/çalışan kontrollerinden sonra doğrudan `true` döner, projenin varlığını/aktifliğini okumaz. Tüketim `cardReadings` yazar (`convex/lib/processCardReadingCore.ts:317`). Olağan genel okuyucu ise `listMobileTargets` üzerinden proje kontrolüne girer. | Sanal/genel okuyucu tüketiminden önce ortak aktif proje kontrolü koy; üretim ile tüketim arasında pasifleştirme testini ekle. | S | KESİN |
| B-03 | P1 | TUTARSIZ | `mobile/lib/models/attendance_summary.dart:179`; `convex/mobileAttendance.ts:175`; `convex/lib/mobileAttendance.ts:163` | Vardiyada eksik çalışma veya manuel tamamlanan gün olduğunda ana sayfa/geçmiş özeti hata gösterebilir. | Dart `presentDays == giriş olan gün adedi` şartı koyuyor; sunucu artık gerekli süre/vardiya/manuel kayda göre sayıyor. Mevcut backend testi 09–17 hareketleri ve 500 dakika şartında `presentDays=0` bekliyor (`convex/pdksFixedRules.integration.test.ts:38`); istemci aynı günü 1 sayıp yanıtı reddeder. Manuel günün hareketi 0 ama devam sayısı 1 olabilir (`convex/w5aFix1.test.ts:154`). | Ham hareket günü ile hesaplanan devam gününü ayrı alanlarla tanımla; Dart doğrulamasını sözleşmeye göre değiştir; gerçek sunucu örneğini Dart decoder testine bağla. | M | KESİN |
| B-04 | P1 | HATA | `convex/attendanceCorrections.ts:27` (commit'siz WIP; aynı kontrol HEAD'de de var) | Çok sayıda geri çekilmiş/red edilmiş başvurudan sonra aynı güne birden fazla bekleyen düzeltme açılabilir. | Aynı günün ilk 100 kaydı alınır, sadece o dilimde `pending` aranır. İlk 100 kapanmışsa 101. bekleyen kayıt görülmez; sonraki gönderim kabul edilir. `.take(100)` taşma denetimi ve durum indeksi yok. | Çalışan+tarih+durum indeksinden bekleyeni doğrudan ara veya sınırda güvenli ret ver. | S | KESİN |
| B-05 | P1 | EKSİK | `convex/leaveRequests.ts:64`; `convex/attendanceCorrections.ts:58`; `mobile/lib/repositories/request_repository.dart:18` (commit'siz WIP) | Eski bekleyen talep listeden düşebilir; çalışan durumunu göremez ve geri çekemez. | İzin bir yıl, düzeltme 90 gün aralığında en fazla 100 satır; taşma/devam bilgisi yok. Sıralama başvuru zamanı değil talep tarihi; ileri tarihli izinler yakın tarihli başvuruyu dışarı itebilir. Dart yalnız dönen 100'ü yeniden sıralar, kalanını alamaz. Kesilme HEAD backend'de de var; yeni mobil ekran bunu görünür kılıyor. | Gerçek sayfalama veya ayrı bekleyen listesi + kesilme uyarısı; geçmiş tarih sınırını kullanıcıya göster. | M | KESİN |
| B-06 | P2 | TUTARSIZ | `src/pages/EmployeeSetup.tsx:87`; `src/pages/CheckIn.tsx:68`; `convex/employeeCheckIn.ts:65` | Şifresini kuran çalışan, artık yeni giriş yapamayan web QR yoluna yönlendiriliyor; tarayıcı gereksiz konum izni istiyor. | Başarı metni “Şimdilik işyerinizin web QR girişini kullanın” diyor; `/check-in` konum toplayıp “Giriş kaydediliyor” gösteriyor; backend kullanılmamış token için her zaman `READER_REQUIRED` döndürüyor. | Kurulum metnini mobil/okuyucu akışına uyarla; web uyumluluk sayfasını kayıt vaadi ve konum istemeden okuyucuya yönlendirsin. | S | KESİN |
| B-07 | P1 | PERF/KOTA | `convex/employeeCheckIn.ts:26`; `convex/employeeAuth.ts:244`; `convex/mobileAccess.ts:77`; `convex/crons.ts:83` | Kullanım sürdükçe süresi geçmiş QR/oturum/kapı işlem kayıtları birikir. | Her QR yeni satır, oturum 90 gün, kapı niyetleri kalıcı; sona erme yalnız kontrol/işaretleme. Tüm `convex` kaynak taramasında QR ve mobil işlem silme/temizleme yolu bulunmadı; cron yalnız kurulum token alanlarını temizler. Oturumlar yalnız logout/çalışan silmede silinir. | Süre indeksleri ve sınırlı partilerle saklama temizliği; tekrar isteği kurtarma süresini koruyan açık saklama politikası; B-01 kişisel veri temizliğini birlikte ele al. | M | KESİN |

B-01/B-02 statik olarak kanıtlanan dar senaryolardır; token tahmini veya canlı istismar denenmedi. B-02'nin penceresi mevcut QR'ın kalan ömrü, en fazla 60 saniyedir; proje kapalıyken yeni QR üretimi zaten reddedilir. B-07 mevcut hacmin kotayı aştığı iddiası değildir.

## 4. Modüller arası ilişkiler

| Karşı modül | Bağ (tablo/fonksiyon) | Yön | Sorun var mı (file:line) |
|---|---|---|---|
| M1 kişi/üyelik | `employees`, `employeeAuth`, `groupMembers`, `groupDevices`, `groupDoors`, `accessRules`, şablon | M1 → M5 yetki | Çalışan pasif/işten ayrılmışsa oturum ret; başlangıcı gelecekteyse kapı/QR ret (`convex/lib/employeeAuth.ts:26`, `convex/lib/mobileAccess.ts:50`). Kişi silmede QR ad kopyası kalıyor: B-01. |
| M1 ziyaretçi | `mobileVisitors.create` → pasif `employees`; operatör aktivasyonu → mobil detay | Çift yönlü | Ev sahibi kendi kaydıyla sınırlı; gerçek kart/kuralı yalnız operatör atar (`convex/mobileVisitors.ts:105`, `convex/lib/mobileVisitors.ts:17`). Karar/onay değil ön kayıt oluşturulduğu UI'da ayrı. |
| M2 kapı/köprü | `mobileAccess.requestOpen`, `mobileOperationAllowed`, IDE/Hik kuyrukları | M5 → M2 | Son gönderim öncesi oturum/parola/kural yeniden kontrol edilir (`convex/lib/mobileAccess.ts:192`); ACK fiziksel geçiş kanıtı değildir (`convex/mobileAccessGateway.ts:19`). localBridge bilinçli kapalı (`convex/lib/mobileAccess.ts:73`), aktif kırık çağrı saptanmadı. |
| M2 sanal okuyucu | `virtualReaders.scan` → `consumeReaderTokenDetailed` → `cardReadings` | M5 QR → M2 → M3 | Aynı token ikinci kez tüketilemez (`convex/lib/processCardReadingCore.ts:300`); proje pasifliği istisnası B-02. Sanal okuyucunun tüm aktif proje çalışanlarına açık olması kodun açık ürün kararıdır; kural üyeliği atlanmasını ayrıca açık saymadım. |
| M2 kapı planları | `doors.hikDoorStatusPlan/hikDoorHolidayPlan/hikVerifyPlan` | M2 cihaz planı ↔ M5 bulut kararı | Mobil karar bunları okumuyor (`convex/lib/mobileAccess.ts:143`); `remainClosed` zamanında uzaktan `open` davranışı ve istisna politikası TEYİT GEREK. Kural zaman şablonu ise gerçekten okunuyor (`convex/lib/mobileAccess.ts:117`). |
| M3 PDKS | `mobileAttendance.summary` → ortak vardiya/PDKS hesabı → Dart model | M3 → M5 | B-03: hesaplanan gün sayısı ile ham hareket sayısı karıştırılmış. Biyometrinin PDKS dışında olması bilinçli; hareket geçmişinde görünmesi tek başına çelişki değil. |
| M3 talep/onay | Mobil `submit/listMine/withdraw` → `attendanceCorrections`, `leaves`; onay → `pdksRecords` | M5 ↔ M3 | İzin kuyruğu bağlı (`src/components/leaves/LeaveRequestsPanel.tsx:38`). Düzeltme kuyruğu kaldırılmış; `src` içinde `attendanceCorrections` API tüketicisi yok; eski B3.3 AÇIK. |
| M4 oturum/denetim/KVKK | `employeeSessions`, `passwordVersion`, `writeAudit`, `projectPrivacySettings` | Çift yönlü | Web kimliği ile çalışan oturumu ayrı; talep işlemleri audit yazar (`convex/attendanceCorrections.ts:31`). B-01/B-07 saklama ve iptal sonrası kişisel veri kopyası; ziyaretçi KVKK onayı ziyaretçi rızası gibi üretilmiyor (`convex/mobileVisitors.ts:110`). |

Sözleşme ve zincir değerlendirmesi:

1. **Düzeltme talebi → yönetici zinciri kopuk.** `bb7d942a` commit'i `CorrectionRequestsPanel.tsx` dosyasını “mobilde talep gönderme yok” gerekçesiyle kaldırmış. Şimdiki **(commit'siz WIP)** `mobile/lib/router/app_router.dart:124` ve `mobile/lib/repositories/request_repository.dart:32` bu varsayımı değiştiriyor; `src/pages/PDKSRecords.tsx:141` yalnız sonuçları gösteriyor, yeni onay alanı yok. `convex/attendanceCorrections.ts:103` uçları var ama web çağıranı yok. Eski bulgu B3.3'ün durumu kötüleşmiştir; yeni bulgu sayısına tekrar eklenmedi.
2. **Hata kodları:** `convex/lib/mobileErrors.ts` içindeki 7 kodun tamamı istemcide karşılanıyor; oturum/pasif/işten ayrılma decoder'da terminal hata, kimlik ve deneme sınırı business hata (`mobile/lib/core/response_decoder.dart:45`, `mobile/lib/core/errors.dart:179`). WIP talep kodları da eklenmiş. Ancak `SUMMARY_TOO_LARGE/INVALID_CURSOR/DEVICE_NOT_FOUND/SUMMARY_INVALID_DATA` ve `VISITOR_INVALID/VISITOR_LOCKED/VISITOR_NOTICE_CHANGED/REQUEST_CONFLICT` allowlist'te yok; decoder kodu `BUSINESS_ERROR` yapıyor, yerelleştirici “bilinmeyen hata” gösteriyor (`response_decoder.dart:51`, `error_localizer.dart:44`). Bu eski NET/L10N hata sunumu maddelerinin kalan kısmıdır. Kullanıcıya “dönemi küçült / daveti yenile / operatöre başvur” çözümü kaybolur.
3. **Alan/tarih sözleşmesi:** auth, hedef, ziyaretçi, hareket ve talep modelleri camelCase; null alanlar korunuyor. Hareket/QR anları ISO zaman damgası, talep günü `YYYY-MM-DD`, `retryAfterMs` milisaniye. Convex tam sayı görünümlü float64 değerleri decoder'da normalize edilir (`response_decoder.dart:141`). İstanbul hareket günü sunucu/istemcide ortak; ziyaretçi form/gösterimi telefonun yerel saatini kullanır (`mobile/lib/widgets/visitor/visitor_labels.dart:22`); Türkiye dışı cihazda hangi saat diliminin gösterildiği kullanıcı kabulünde doğrulanmalı.
4. **Oturum ömrü ve cihaz:** mobil oturum sabit 90 gün (`convex/employeeAuth.ts:14`), yenileme ucu yok; sona erince yeniden giriş bekleniyor. Güvenli depo token saklar, parola kabul etmez (`mobile/lib/services/session_store.dart:6`). Sunucu oturumu fiziksel telefona bağlamaz; `employeeSessions` içinde cihaz/kurulum anahtarı yok (`convex/schema.ts:199`); kullanıcıya ayrı cihaz oturumlarını listeleme/tek cihazı iptal etme ekranı yok. Bunlar ürün güvenlik politikası kararıdır; tek başına yeni yetki açığı veya zorunlu “7 gün” ihlali sayılmadı. Parola değişimi tüm eski sürümleri, logout sadece kendi token'ını iptal eder.
5. **Ağ/çevrimdışı:** bootstrap ağ hatasında token silinmeden yeniden deneme ekranı; router korumalı sayfaları açmaz (`auth_provider.dart:160`, `app_router.dart:57`). Kapı ve ziyaretçi belirsiz sonuçları kalıcı niyetle kurtarılır; otomatik ikinci mutasyon yok. Talep WIP mutasyonları tekrar denemesiz, belirsiz sonuçta liste yenilenir (`request_provider.dart:116`); karar bildirimi/push yok. Uçak modu ve süreç ölümünde son paket doğrulaması bu audit'in dışında.

## 5. Eski audit durumu

“DÜZELDİ” yerel kod kanıtıdır; üretim yayını veya fiziksel kabul değildir. Aynı kökten gelen eski ID'ler tek satırda birlikte gösterilmiştir; her ID için o satırın durumu geçerlidir. Native/platform başlıklarının kaynakları izinli mobil kapsamın dışında kaldığından **KISMEN** işareti tam kapatma iddiası taşımaz.

### Önceki genel akış audit'i — B2.8, B3 ve B4

| Eski madde | DÜZELDİ/AÇIK/KISMEN | Kanıt |
|---|---|---|
| B2.8 — Mobil manuel/hesaplanan puantajı göstermez | KISMEN | Yeni kurallı yolda manuel kayıt okunuyor (`convex/mobileAttendance.ts:149`); günlük saatler hâlâ ham hareket (`:174`), eski kural dalı `:135` manuel okumadan dönüyor; Dart reddi B-03. |
| B3.1 — Çalışan düzeltme ekranı yok | DÜZELDİ (commit'siz WIP) | `mobile/lib/router/app_router.dart:124`, `screens/requests/requests_screen.dart:320`; HEAD'de rota/form yok. |
| B3.2 — Kayıt doğrulaması/istemci/ek dosya | KISMEN (commit'siz WIP) | `convex/attendanceCorrections.ts:20`, `mobile/lib/models/employee_request.dart:179`; istemci var, ek dosya yok; sınırdaki mükerrer kontrolü B-04. |
| B3.3 — Yönetici düzeltme kuyruğu | AÇIK — gerileme | `bb7d942a` eski paneli sildi; `src` API taramasında çağıran yok, `src/pages/PDKSRecords.tsx:141`; `src/components/pdks/auditPage.test.tsx:41` düğmenin yokluğunu bekliyor. Mobil WIP gelince yeniden bağlanmalı. |
| B3.4 — Yetkili karar ve atomik PDKS yazımı | DÜZELDİ (backend korunmuş) | `convex/attendanceCorrections.ts:87`, `:96`, `:99`: proje/izin ve ortak manuel yazım. Kullanılabilir yönetici ekranı B3.3'e bağlı. |
| B3.5 — Düzeltmenin rapora yansıması | KISMEN | `convex/mobileAttendance.ts:158` manuel kayıt eşlemesi; `:135` eski dal ve mobil saatler hâlâ ham. Tüm muhasebe raporlarını kapatma M3'e aittir. |
| B3.6 — Çalışan sonucu/bildirimi | KISMEN (commit'siz WIP) | `mobile/lib/screens/requests/requests_screen.dart:228` karar notu gösteriyor; `convex/attendanceCorrections.ts:99` yalnız kayıt/audit, push/e-posta yok; onay kuyruğu kopuk. |
| B3.7 — Geri çekme düğmesi | DÜZELDİ (commit'siz WIP) | `mobile/lib/screens/requests/requests_screen.dart:244`, `providers/request_provider.dart:153`; backend `convex/attendanceCorrections.ts:42` geçmişi korur. |
| B4.1 — Mobil izin formu yok | DÜZELDİ (commit'siz WIP) | `mobile/lib/screens/requests/requests_screen.dart:320`, `repositories/request_repository.dart:49`. |
| B4.2 — Gün/tür/çakışma, saatlik izin ve ek dosya | KISMEN | `convex/leaveRequests.ts:28` ve `:33` tarih/çakışma; günlük aralık; saatlik izin/ek dosya hâlâ yok. |
| B4.3 — Yönetici izin kuyruğu | DÜZELDİ (korunmuş) | `src/components/leaves/LeaveRequestsPanel.tsx:38`, `convex/leaveRequests.ts:162`. |
| B4.4 — Doğrudan yönetici izni | DÜZELDİ (korunmuş) | WIP kendi liste modelinde `source` alanı ayrılmış (`convex/leaveRequests.ts:60`); mobil `models/employee_request.dart:80` yönetici kaydını tanır. |
| B4.5 — İznin puantaja ve tür hesabına aktarımı | KISMEN | `convex/mobileAttendance.ts:168` onaylı izinleri ortak hesaba verir; mobil günlük çıktı ayrı izin/tür sonucu dönmüyor; rapor kod eşlemesinin tamamı M3 kapsamı. |
| B4.6 — İzin bakiyesi | AÇIK | `leaveBalances` yalnız schema, idari silme koruması ve testlerde; `convex/leaveRequests.ts:171` onay bakiyeyi düşmez. |
| B4.7 — Karar/geri çekme/geçmiş | KISMEN (commit'siz WIP) | Liste/karar/düğme var (`requests_screen.dart:128`, `:228`); `convex/leaveRequests.ts:48` geri çekilen izni siliyor, bildirim yok. Düzeltmenin `withdrawn` geçmişiyle farklı davranış sürüyor. |

### `docs/mobile-audit` ham bulgu dizini — 97 eski gözlem

| Eski madde | Durum | Kanıt |
|---|---|---|
| AUTH-F01 | DÜZELDİ | `mobile/lib/services/session_store.dart:6`: parola saklamaz; `:27` secure storage; eski sırlar temizlenir. |
| AUTH-F02, PROFILE-F01, AN-F01 | DÜZELDİ | `session_store.dart:109` restore işaretini kapatır; `auth_provider.dart:324` UI'ı hemen kapatır, otomatik parola girişi yok. |
| AUTH-F03 | DÜZELDİ | `convex/lib/employeeAuth.ts:34`, `:51`: parola sürümü; `convex/employeeAuth.ts:139` kurulumda da ortak yazım. |
| AUTH-F04, HOME-F08, AH-F05, AN-F02, AN-F07 | DÜZELDİ | `auth_provider.dart:74`, `:79`; `attendance_provider.dart:161`; `convex_config.dart:344` gecikmiş eski oturum yanıtlarını engeller. |
| AUTH-F05, AN-F06 | DÜZELDİ | `auth_provider.dart:160` token korunur, retryableFailure; `app_router.dart:57` splash/yeniden deneme. |
| AUTH-F06 | DÜZELDİ | `response_decoder.dart:75` pasif çalışan terminal oturum hatası; işten ayrılma özel hata `:46`. |
| AUTH-F07, PROFILE-F04, L10N-F02 | DÜZELDİ | `screens/auth/forgot_password_screen.dart:61` yönetici yardımı; `auth_provider.dart:314` yönetici kurulum akışı. |
| AUTH-F08 | DÜZELDİ | `convex/employeeAuth.ts:205` başarısız deneme limiti rollback olmadan kaydedilir; parola değişiminde `:306`. |
| AUTH-F09, NET-F01 | DÜZELDİ | `response_decoder.dart:6`, `:45`: HTTP 560 ve yapılandırılmış oturum kodları; `convex_config.dart:366` 560 tekrar edilmez. |
| HOME-F01, PROFILE-F05, DEV-F04, NET-F02, QR-F02 | DÜZELDİ | `convex/mobileAccess.ts:55` gerçek komut kuyruğu, puantaj yazmaz; `mobileAccessGateway.ts:15` gönderim; `mobile/lib/l10n/app_en.arb:421` fiziksel geçiş garantisi verilmez. |
| HOME-F02, QR-F04 | DÜZELDİ | `convex/mobileAccess.ts:63` requestId; `mobile/lib/providers/qr_provider.dart:213` aynı taramayı yeniden kurmaz; kalıcı kapı kurtarma yolu var. |
| HOME-F03, DA-F07 | DÜZELDİ | `mobile/lib/screens/home/home_screen.dart:181` ayrı yükleme/hata/bilinmeyen durum. |
| HOME-F04 | DÜZELDİ | `convex/mobileAttendance.ts:108` bağımsız tam dönem özeti; 10.000 satır sınırında açık hata. B-03 ayrı yeni sözleşme regresyonu. |
| HOME-F05, AH-F01, AH-F03 | DÜZELDİ | `convex/lib/mobileAttendance.ts:34` İstanbul sınırları; `mobile/lib/core/attendance_date.dart:1` ortak iş günü yardımcıları. |
| HOME-F06, AH-F04 | DÜZELDİ | `mobile/lib/models/attendance.dart:39`, `:63` bilinmeyen/red ayrı; `convex/lib/mobileAttendance.ts:139` yalnız uygun hareket devam sayısına girer. |
| HOME-F07, PROFILE-F02, DEV-F01, AN-F05 | DÜZELDİ | `mobile/lib/providers/preferred_device_provider.dart:149` yeniden doğrulama; `:201` kimlik kapsamı; kaldırma yolu `:145`. |
| HOME-F09, DEV-F02, NET-F03, QR-F10 | DÜZELDİ | `convex/lib/mobileAccess.ts:143` cihaz/kapı/erişim dönemi/saat; `:192` gönderim öncesi tekrar kontrol. Yeni sanal okuyucu proje istisnası B-02. |
| AH-F02, AH-F07, NET-F09 | DÜZELDİ | `convex/mobileAttendance.ts:85`, `:98`: olay zamanı indeksleri, cursor ve tarama sınırı; `mobile/lib/providers/attendance_provider.dart:60` arşiv birleştirme. |
| AH-F06 | KISMEN | Ham hareket günü/hesaplanan vardiya ayrımı sunucuda var (`convex/mobileAttendance.ts:173`), Dart'ın gün sayısı varsayımı B-03; ham günlük saatler hesaplanan saatler değildir. |
| AH-F08 | DÜZELDİ | `mobile/lib/providers/attendance_provider.dart:41` ID tabanlı cihaz kümesi; backend filtre `convex/mobileAttendance.ts:69`. |
| AH-F09, AH-F11, DA-F08 | DÜZELDİ | `mobile/lib/widgets/history/history_records_list.dart:51` kaydırılabilir boş durum; `attendance_provider.dart:161` sahiplik; mevcut `mobile/test/widgets/history_screen_test.dart` kaynakları kontrol edildi. |
| AH-F10 | DÜZELDİ | `mobile/lib/providers/attendance_provider.dart:49` liste/komut/özet hataları ayrı; oturum değişiminde `:200` temizleme. |
| QR-F01 | DÜZELDİ | `mobile/lib/repositories/qr_repository.dart:31` reader token/status alanları; `convex/employeeCheckIn.ts:30` aynı sözleşme. |
| QR-F03 | DÜZELDİ (eski sahte yoklama kaldırılmış) | Statik cihaz kodu fiziksel varlık kanıtı sayılmaz; yeni QR yalnız okuyucuda tüketilir (`convex/employeeCheckIn.ts:65`), uzaktan kapı komutu devam yazmaz. |
| QR-F05, NET-F05 | DÜZELDİ (eski geçiş yazma açığı) | `convex/employeeCheckIn.ts:65` anonim yeni geçiş yok; `lib/processCardReadingCore.ts:311` çalışan erişim dönemi yeniden doğrulanır. Eski tamamlanmış sonucun kişisel veri erişimi ayrı B-01. |
| QR-F06 | DÜZELDİ (destek sınırı açık) | `convex/lib/mobileAccess.ts:175` IDE/Hik token reddi; mobil okuyucu ipucu `mobile/lib/l10n/app_en.arb:421`; cihaz desteği saha teyidi ister. |
| QR-F07, QR-F08, AN-F04 | DÜZELDİ | `mobile/lib/providers/qr_provider.dart:163`, `:210` görünürlük/lifecycle; `screens/qr_scan/qr_scan_screen.dart` kamera yönetimi ve mounted kontrolleri. |
| QR-F09 | DÜZELDİ | `mobile/lib/providers/qr_provider.dart:116` sunucu ömrü ve gidiş-dönüş süresi; `:60` belirsiz/geçersiz token gizlenir. |
| VIS-F01, VIS-F04, L10N-F04 | DÜZELDİ | `convex/mobileVisitors.ts:81` gerçek ön kayıt; `mobile/lib/screens/visitor/visitor_screen.dart`, `widgets/visitor/visitor_labels.dart:6` yerelleştirilmiş durumlar. |
| VIS-F02 | DÜZELDİ (önceki yetki düzeltmesi korunmuş) | `convex/mobileVisitors.test.ts:163` gerçek web wrapper'larıyla projesiz kayıt koruma senaryoları; mobil sahiplik `lib/mobileVisitors.ts:17`. Bu tur web ziyaretçi uçları baştan sona yeniden denetlenmedi (M1). |
| VIS-F03 | DÜZELDİ | `convex/lib/mobileVisitors.ts:104` seçilmiş IDE hedeflerinde kart doğrulama; `mobileVisitors.test.ts:228` operatör kart senaryoları. |
| PROFILE-F03 | KISMEN | `mobile/lib/screens/profile/profile_screen.dart:470` parola/help/privacy var; `:458` bildirim ekranı bilgilendirme metni, teslim altyapısı değil. |
| PROFILE-F06, L10N-F07 | DÜZELDİ | `mobile/lib/screens/profile/profile_screen.dart:38`, `:761` runtime paket sürümü. |
| DEV-F03, NET-F04 | DÜZELDİ | `convex/mobileAttendance.ts:44` yabancı cihaz metadata'sını döndürmez; `lib/mobileAccess.ts:111` hedef proje kontrolü. |
| DEV-F05 | DÜZELDİ | `convex/lib/mobileAccess.ts:108` cihaz ve kapı bağlantılarının birleşimi. |
| DEV-F06 | DÜZELDİ | `mobile/lib/providers/preferred_device_provider.dart:194` sıralı kayıt, `:114` saklama hatası; bellek erişimi kayıtta/silinmede sınırlandırılır. |
| DEV-F07, NET-F06 | DÜZELDİ | `mobile/lib/models/device.dart`, `models/attendance_summary.dart:143` yapısal doğrulama; bozuk veri boş yetki listesi sayılmaz. |
| DEV-F08, NET-F07, L10N-F03 | KISMEN | Ham sunucu metni gösterilmiyor (`response_decoder.dart:49`); fakat ziyaretçi/özet hata kodları siliniyor, bölüm 4.2. Erişim ret kodları da tek genel metne indirgeniyor (`errors.dart:90`, `error_localizer.dart:16`). |
| AN-F03 | DÜZELDİ | `mobile/lib/router/app_router.dart:47` bootstrap ve güvenli geri dönüş hedefi. |
| AN-F08 | DÜZELDİ | `mobile/lib/main.dart:189` repository/provider bileşimi ve `:270` dispose; router her örnekte kendi anahtarını üretir (`app_router.dart:40`). |
| NET-F08, PLAT-F02 | DÜZELDİ | `mobile/lib/config/convex_config.dart:60` boş yapılandırma ret, release host/env doğrulaması; sabit deployment fallback yok. |
| DA-F01 | KISMEN | `mobile/lib/theme/app_theme.dart` merkezi renkler ve `mobile/test/theme/app_theme_test.dart` var; bu tur görsel kontrast/cihaz deneyi yapılmadı, tam kapatma yok. |
| DA-F02 | DÜZELDİ (kod) | `mobile/lib/widgets/app_bottom_navigation.dart:170` Semantics/tooltip; fiziksel ekran okuyucu kabulü hâlâ gerekli. |
| DA-F03 | KISMEN | `mobile/lib/widgets/visitor/visitor_detail.dart:73` ve QR'da erişilebilir kontroller mevcut; bütün dokunma hedefleri/ekran okuyucu kombinasyonları bu tur ölçülmedi. |
| DA-F04 | DÜZELDİ | `mobile/lib/screens/auth/forgot_password_screen.dart:61` kaydırılabilir içerik. |
| DA-F05 | DÜZELDİ (kod) | `mobile/lib/screens/qr_scan/qr_scan_screen.dart:287` LayoutBuilder ve kaydırma; fiziksel QR boyutu teyidi ayrı. |
| DA-F06 | KISMEN | Duyarlı kartlar ve `mobile/test/widgets/home_cards_test.dart` var; bu tur %200 yazı/platform kabulü yapılmadı. |
| L10N-F01 | DÜZELDİ | `mobile/lib/providers/locale_provider.dart`, `mobile/lib/main.dart` locale bağlantısı; TR/EN 457 anahtar eşleşiyor. |
| L10N-F05 | DÜZELDİ (eski gösterim kaldırılmış) | `mobile/lib/screens/qr_scan/qr_scan_screen.dart:338` ham tarih/saat yerine yerelleştirilmiş kalan saniye gösterir; `qrTimeLine` katalogda kalsa da bu ekranda kullanılmıyor. |
| L10N-F06 | DÜZELDİ | `mobile/lib/l10n/app_en.arb:68`, `:197`, `:242` plural tanımları. |
| PLAT-F01 | KISMEN | `docs/mobile-release/PLAN-20261022.md:40` anahtar/preflight tamam bilgisi var; `:47` imzalı paket/mağaza teslimi açık. Yerel anahtar okunmadı, mağaza imzası doğrulanmadı. |
| PLAT-F03, PLAT-F04, PLAT-F05, PLAT-F06 | KISMEN — kapsam sınırı | `mobile/pubspec.yaml:7` SDK, `:32` secure storage bağımlılıkları; `docs/mobile-release/PLAN-20261022.md:49` final CI/alt OS kabulü açık. Native lock, manifest ve macOS runner kapsam dışı; eski maddeler bu audit ile kapatılamaz. |
| PLAT-F07 | KISMEN | Güncel kabul planı var (`docs/mobile-release/PLAN-20261022.md:15`); eski “mobil yakında/web QR” ürün metni sürüyor (`src/pages/EmployeeSetup.tsx:90`, B-06). README bu tur kapsam dışı. |
| PLAT-F08 | DÜZELDİ (kod) | `mobile/lib/core/safe_diagnostics.dart:18` sınırlı, kişisel verisiz kayıt; `:41` kullanıcı başlatmalı güvenli dışa aktarım. |

### 2026-10-21 tekrar audit'i ve yayın kabulü

| Eski madde | Durum | Kanıt |
|---|---|---|
| AUD-01 — Kapı kayıp yanıtında kurtarma yok | DÜZELDİ | `mobile/lib/screens/home/home_screen.dart:269` kurtarma diyaloğu; `widgets/door_operation_recovery_dialog.dart`; ilgili widget test kaynağı var. |
| AUD-02 — Ziyaretçi detayında yenileme duruyor | DÜZELDİ | `mobile/lib/widgets/visitor/visitor_detail.dart:30` detay sahibi; `providers/visitor_provider.dart:183` detay açıkken bağımsız polling. |
| AUD-03 — Ay/hafta değişiminde eski dönem | DÜZELDİ | `mobile/lib/screens/history/history_screen.dart:76`, `:89` resume/görünürlükte gün karşılaştırma ve yenileme. |
| AUD-04 — Firma/proje adı görünmüyor | DÜZELDİ | `convex/employeeAuth.ts:342`; `mobile/lib/screens/profile/profile_screen.dart:123`, `:454`. |
| MOB-N05 — Ziyaretçi süreç ölümünden kurtarma | KISMEN (kod + eski kanıt) | `mobile/lib/services/visitor_create_intent_store.dart:116` kalıcı requestId; `convex/mobileVisitors.ts:23` receipt. `33ceb6af/50be0531` kanıt commit'leri var; plan `docs/mobile-release/PLAN-20261022.md:17` hâlâ açık kutular taşıyor. Bu tur OS-kill tekrar edilmedi. |
| MOB-N07 — Güncel backend iş akışı kabulü | KISMEN | Kaynak/test var; `docs/mobile-release/PLAN-20261022.md:23` kabul açık; yeni B-03 ve WIP düzeltme kuyruğu çözülmeden tamam sayılamaz. |
| MOB-N08 — Fiziksel cihaz | AÇIK | `docs/mobile-release/PLAN-20261022.md:30`; bu audit kamera/kapı/VoiceOver/TalkBack deneyi yapmadı. |
| MOB-N09 — İmza/mağaza | KISMEN | `docs/mobile-release/PLAN-20261022.md:38` Android hazırlık var, Apple/final paket/inceleme adımları açık. |
| MOB-N10 — Son aday kabulü/yayın | AÇIK | `docs/mobile-release/PLAN-20261022.md:49`; önceki test APK veya yerel test sonuçları final mağaza kabulü yerine geçmez. |

## 6. Test boşlukları

1. Sunucunun vardiya/manuel `presentDays` yanıtını gerçek Dart `AttendanceSummary.fromJson` ile okuyan ortak sözleşme testi yok; mevcut mobil test eski eşitliği koruyor (`mobile/test/models/attendance_summary_test.dart:36`). B-03'te backend testinin geçmesi istemcinin çalıştığını kanıtlamıyor.
2. QR üretiminden sonra proje pasifleştirme/silme → sanal okuyucuda ret; mevcut `virtualReaders.test.ts` bu proje değişimini kapsamıyor.
3. Tüketilmiş token → süre dolumu/logout/parola iptali/çalışan silme → anonim sonucun kişisel veri içermemesi. `convex/employeeCheckIn.test.ts:100` eski snapshot davranışını koruyor, mahremiyet sınırını sınamıyor.
4. Aynı tarih için 100 kapanmış + bir bekleyen düzeltme; yeni başvurunun ret olması ve 100 üzerindeki listenin kurtarılması.
5. Mobil WIP düzeltme aç → gerçek yönetici ekranından onay/red → mobil sonuç zinciri. Şu anda yönetici ekranı olmadığı için bu kabul tamamlanamaz.
6. QR/oturum/kapı kaydı saklama süresi, toplu temizlik ve temizliğin belirsiz kapı/ziyaretçi kurtarmasını bozmaması.
7. Bütün backend hata kodlarını decoder + TR/EN yerelleştirici üzerinden geçiren kapsama testi; mevcut auth/request testleri ziyaretçi/özet kodlarının kaybolmasını yakalamıyor.
8. `remainClosed`/tatil planı + mobil open/ACK/gerçek kapı davranışı; politika kararı ve fiziksel test birlikte gerekli.

## 7. TEYİT GEREK ve kapsam dışı

- **TEYİT GEREK (cihaz):** Hik gateway ACK'sinin fiziksel açılmayla ilişkisi; kapı kapalı planının uzaktan mobil komuta önceliği. Kodda plan okumasının yokluğu kesindir, donanımın komutu uygulayıp uygulamadığı bu audit'ten çıkarılamaz.
- **TEYİT GEREK (canlı):** `MOBILE_IDE_ISOLATION_VERIFIED` dağıtım ayarı, tenant/ACL/TLS/firmware kabulü; hangi revision'ın mobil/backend'de kurulu olduğu; WIP taleplerin yayın durumu. Ortam/sırlar okunmadı.
- **TEYİT GEREK (ürün):** 90 günlük mobil token ve cihaz bağlama/tek cihaz iptali politikası; ziyaretçinin Türkiye dışı telefon saatinde gösterimi; bildirim teslimi ve izin geri çekme geçmişinin kalıcılığı.
- **TEYİT GEREK (kabul):** yeni son pakette OS-kill ziyaretçi/kapı kurtarma, offline logout, kamera izin/resume, erişilebilirlik ve mağaza imzası. Eski release kanıtları güncel paketin yerine geçirilmedi.
- **Kapsam dışı:** canlı veri/cihaz/ağ sorgusu, Supabase, Convex CLI, tarayıcı, build/pub get/pod, Flutter test, tüm test suite'i, native platform/mağaza denetimi, mevzuat kararı. M1/M2/M3/M4 kodları yalnız ortak sözleşmenin izini sürmek için okundu; o modüllerin tamamı yeniden denetlenmedi.
- **Değişiklik sınırı:** uygulama/backend/test kaynakları değiştirilmedi; git add/commit/stash/checkout/reset/restore/switch, push/deploy yapılmadı. Yalnız bu rapor dosyası yazıldı.
