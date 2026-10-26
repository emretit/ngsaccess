# M4 — Hesap, yetki, proje, ayarlar, KVKK, denetim, alarm ve public sayfalar

## 1. Sonuç

Proje bazlı roller, yedi günlük web oturumu, hesap dondurma ve önceki çalışan denetim geçmişi açığı için korumalar mevcut; ancak personeli yalnız görüntüleyebilen bir kullanıcı çalışanın mobil hesabını devralabiliyor. Ayrıca bazı okuma yolları kaldırılmış rol yetkilerini uygulamıyor; imha tutanağı, alarm kurtarma ve hesap kurtarma zincirlerinde tamamlanmamış adımlar var. **Yeni bulgular: P0: 2 · P1: 6 · P2: 2 · P3: 2; toplam 12**; eski açıklar bu sayıma tekrar eklenmedi.

**Kanıt sınırı:** 25.10.2026, salt kaynak incelemesi; başlangıç HEAD `520ba5fc`, son kontrol HEAD `77bce329`. İnceleme sırasında başka oturum `5de547a8` ile mobil talepleri, `77bce329` ile dokümanları commit etti; M4 bulgularının kaynak dosyaları değişmedi. Başlangıçtaki `attendanceCorrections`, `leaveRequests`, `requestRules` değişiklikleri **(commit'siz WIP)** olarak görüldü; son kontrolde bu commit'e girmişti. Bu worker kod/Git/DB/ağ/cihaz işlemi yapmadı; yalnız bu raporu yazdı.

`git log --oneline -120`, eski C raporu ve OZET Faz 1/5, Convex yerel yönergeleri okundu. **KESİN** kod davranışını belirtir; canlıda istismar, fiziksel kapı başarısı veya e-posta teslimi anlamına gelmez.

## 2. Modül haritası

| Alan | Dosyalar | Başlıca tablolar | Sayfa / ekran |
|---|---|---|---|
| Web kimliği ve kurulum | `convex/auth.ts`, `users.ts`, `invites.ts`, `emailVerification.ts`, `onboarding.ts`, `lib/auth.ts` | users, authAccounts, authSessions, authRefreshTokens, invites | Login, Register, VerifyEmail, UserSetup, AdminSetup, AuthProvider |
| Roller / erişimi kapatma | `roles.ts`, `accountAccess.ts`, `userProjects.ts`, `lib/{customFunctions,permissions,roleCatalog,adminGuards,sessionRevoke}.ts` | userProjects, projectRolePermissions, users | Settings/Users/Roles, SystemAdmin, Profile; usePermissions |
| Proje / genel ayarlar | `projects.ts`, `companies.ts`, `settings.ts`, `userPreferences.ts` | projects, companies, generalSettings, notificationSettings, workSettings, overtimeRates, userPreferences | ActiveProjectContext, Settings, admin panelleri |
| Mobil hesap bağlantısı | `actions/{sendEmail,setPassword}.ts`, `employeeAuth.ts` | employeeAuth, employeeSessions | EmployeeSetup, EmployeePasswordResetDialog; mobil giriş |
| KVKK / dosyalar | `privacyRetention.ts`, `privacyBiometric.ts`, `biometricDestruction.ts`, `files.ts`, ilgili lib/action'lar | projectPrivacySettings, pendingUploads, employeeFaces, employeeFingerprints, employeeConsents, cardReadings, auditLog | Settings/Privacy, rıza ve imha kartları, ProfilePhoto |
| Denetim / alarm | `auditLog.ts`, `alarms.ts`, `lib/{audit,alarmNotify}.ts`, `actions/sendAlarmEmail.ts` | auditLog, deviceEvents, alarmSettings | AuditLog, Alarms, denetim Excel çıktısı |
| Asistan / rapor e-postası | `actions/{getChatData,openaiChat,sendScheduledReports}.ts`, `privacyRetention.ts`, `reports.ts` | cardReadings, projectPrivacySettings, reportScheduleSettings | Sohbet bileşenleri, Settings/Reports |
| Bakım / zamanlama | `crons.ts`, `migrations.ts`, `maintenance.ts`, üç seed dosyası | İlgili proje/cihaz tabloları | Doğrudan müşteri ekranı yok |
| Dış sayfalar | `src/App.tsx`, `pages/{LandingPage,CheckIn,NotFound}.tsx`, public/landing bileşenleri | Token doğrulaması dışında yok | `/`, `/check-in`, `/reader`; ayrıca `public/{gizlilik,destek,hesap-silme}/index.html` |

### Dışa açık uç sayımı ve sarmalayıcılar

Tüm `convex/**/*.ts` üzerinde export tarandı; testler ve `_generated` hariç, `userProjects.ts` içindeki `_internalQuery` takma adı dahil **540 doğrudan fonksiyon kaydı** bulundu. Sarmalayıcı fabrikaları kayıt sayılmadı; `auth.ts:8` içindeki `convexAuth` tarafından üretilen beş destructured export ve `http.ts` içindeki HTTP işleyicileri bu 540'a dahil değildir.

| Sarmalayıcı | Sayı | Sağladığı koruma |
|---|---:|---|
| authedQuery / authedMutation / authedAction | 119 / 113 / 29 | Geçerli, dondurulmamış, doğrulanmış web hesabı; **rol/proje yetkisi ayrıca handler'da aranmalı** |
| superAdminQuery / superAdminMutation | 6 / 8 | Yukarıdakilere ek platform yöneticisi |
| employeeAuthedQuery / employeeAuthedMutation | 16 / 9 | Mobil sessionToken, çalışan durumu ve parola sürümü |
| optionalAuthQuery | 3 | currentUser, userProjects.getByCurrentUser, settings.getDarkMode; doğrulanmamış hesaba yalnız dar profil/boş sonuç |
| query / mutation / action | 6 / 12 / 4 | Aşağıda tek tek açıklanan 22 manuel korumalı veya açık uç |
| internalQuery / internalMutation / internalAction | 63 / 115 / 37 | İstemciden doğrudan çağrılamayan 215 uç |

Toplam **325 public**, bunun **303'ü özel sarmalayıcıyla**, **22'si çıplak builder ile** kayıtlıdır. `adminMutation` isimli bir sarmalayıcı artık yok; yönetici yetkisi `requirePermission` ile proje üzerinde veriliyor. Sadece `authed*` kullanmak yönetim yetkisi anlamına gelmez: Y-01 bunun somut karşı örneği.

| Çıplak public uç (file:line) | Neden public / fiilî kontrol |
|---|---|
| `convex/projects.ts:31` listActive | Giriş yoksa boş liste; sonra getCurrentUser + üyelik, yalnız aktif projeler |
| `convex/users.ts:17` hasSuperAdmin | İlk kurulum ekranına yalnız boolean döner; bilinçli anonim okuma |
| `convex/users.ts:188` initializeAdmin | Henüz doğrulanmamış kurucu oturumu + ADMIN_SETUP_SECRET + hiç super_admin olmaması |
| `convex/invites.ts:103` verify | UUID davet token'ı; kullanım/süre kontrolü, davetli e-posta ve rol önizlemesi |
| `convex/invites.ts:181` claimSetupAccount | Davet token'ı + yalnız yeni/doğrulanmamış/üyeliksiz hesabı devralma; mevcut ayrıcalıklı hesabı reddeder |
| `convex/invites.ts:213` consume | Geçerli oturum kimliği ve davet e-postası eşleşir; doğrulanmamış davetli için dar istisna |
| `convex/emailVerification.ts:21` requestVerification | Giriş öncesi e-posta; adres başına limit, tek tip yanıt |
| `convex/emailVerification.ts:71` verifyEmail | Doğrulama token'ı; süre kontrolü ve atomik tüketim |
| `convex/employeeAuth.ts:41` getByToken | Mobil hesap kurulum token'ıyla e-posta/süre önizlemesi; hash dönmez; süresi dolmuş kayıt temizlenene kadar önizlenebilir |
| `convex/employeeAuth.ts:178` signIn | E-posta/parola, hesap durumu, işten ayrılma ve rate limit; mobil oturum üretir |
| `convex/employeeAuth.ts:279` signOut | Yalnız gönderilen güçlü sessionToken'ı siler; oturumsuz çıkış idempotent |
| `convex/actions/setPassword.ts:11` setEmployeePassword | Kurulum token'ı + parola politikası; nihai tüketim internal mutation'da atomik |
| `convex/employeeCheckIn.ts:9` createMyCheckInToken | getCurrentEmployee + session/aktif proje/erişim aralığı; web JWT yerine mobil token |
| `convex/employeeCheckIn.ts:55` checkInWithToken | Eski bağlantı uyumluluğu; yeni PDKS yazmaz, fiziksel okuyucu ister; tüketilmiş token'a sınırlı sonuç döner |
| `convex/mobileAccess.ts:56` requestOpen | Mobil session + çalışan/hedef/proje/saat politikası + tekrar istek kimliği |
| `convex/virtualReaders.ts:43` connect | Okuyucuya özgü apiToken; web hesabı gerektirmeyen kiosk bağlantısı |
| `convex/virtualReaders.ts:68` scan | Okuyucu token'ı + aktif cihaz + tek kullanımlık çalışan QR'ı |
| `convex/ideSync.ts:664` listSyncIssues | Oturumsuz boş sonuç, sonra getCurrentUser + resolveProjectScope |
| `convex/hikvisionSync.ts:732` listSyncIssues | Aynı manuel oturum/proje kontrolü; ham operasyon payload'ı dönmez |
| `convex/actions/pdksImport.ts:87` previewPdksCsv | İçerikli CSV için employees.listLightForImport → employees.manage; ters saatlerde ek vardiya kontrolü; boş CSV veri açığa çıkarmaz |
| `convex/actions/pdksImport.ts:156` importPdksCsv | Önizleme koruması + pdksRecords.bulkUpsertManual yazma yetkisi; boş/uygunsuz girdide yazmaz |
| `convex/onboarding.ts:89` assignProjectsToExistingUsers | **Public bakım istisnası**: yalnız ADMIN_SETUP_SECRET; oturum gerektirmez, tüm users'ı tarar; rutin müşteri akışı değil |

Üç seed, `maintenance.clearDeviceSyncQueue`, `migrations` ve `actions/hikDebug` internal'dır; anonim açık seed bulunmadı (`convex/seedCardReaderTest.ts:12`, `seedHikvisionLanDevice.ts:12`, `seedTestCardAccess.ts:4`, `maintenance.ts:4`, `migrations.ts:18`, `actions/hikDebug.ts:14`). Public onboarding bakım istisnasının internal'a taşınması savunmayı sadeleştirir; mevcut secret kontrolü yokmuş gibi bir açık yazılmadı.

HTTP yüzeyi: `convex/http.ts:12` auth rotalarını ekler; kalan kayıtlar Hik durum, kart okuyucu (POST/OPTIONS), IDE event/poll/sent/ack, Hik poll/ack ve röle onayıdır (`:16`, `:69`, `:88`, `:339`, `:380`, `:395`, `:412`, `:446`, `:465`, `:501`). Bunlar cihaz/bridge kimlik doğrulamasına dayanır; web rol sarmalayıcısı gerektirmemeleri tek başına hata değildir, ayrıntılı cihaz sözleşmesi M2 kapsamındadır.

### Cron sıklığı ve aylık çağrı hesabı

**Model:** 30 gün, 43.200 dakika, bir aylık tetik; tablo en küçük boş-veri çağrı tabanını ve ek yükü ayrı verir. `db.get/query/patch` aynı fonksiyon içinde ek fonksiyon çağrısı sayılmadı; `runQuery/runMutation/runAction` ve scheduler çağrıları sayıldı. 1.000.000 kota spec'in karşılaştırma varsayımıdır; güncel plan limiti/canlı kullanım sorgulanmadı.

| İş (`convex/crons.ts`) | Sıklık | Ana tetik/ay | Bilinen taban çağrı/ay ve ek yük |
|---|---|---:|---|
| send-scheduled-reports `:7` | Ayın 1'i 09:00 UTC / TR 12:00 | 1 | **3**: tetik + action + enabled sorgusu; S plan için +S özet, başarılı her gönderime +1 işaretleme |
| process-hik-queue `:14` | 3 dk | 14.400 | **28.800**: action + aday sorgusu; en çok 20 aday/tetik, sonuç mutation'ı ve operasyon türüne göre ek sorgu/action |
| cleanup-stale-hik-failures `:21` | 10 dk | 4.320 | **4.320**; tetik başına en çok 2.000 aday, aynı işlemde cihaz okumaları |
| requeue-stale-hik-local-bridge-ops `:28` | 3 dk | 14.400 | **14.400**; ilk 200 processing kayıt incelenir; Windows ertelenmiş olsa da cron etkin |
| sync-hik-device-times `:36` | Günlük 01:00 UTC | 30 | **60**: action + cihaz listesi; cihaz HTTP istekleri Convex fonksiyon sayısı değildir |
| hik-backfill-events `:45` | Günlük 02:00 UTC | 30 | **60** + her cihaz/gün için taranan olay sayısı kadar mutation ve +1 ilerleme yazımı; 50×30 = 1.500 olay/cihaz/gün üst tarama sınırı |
| expire-visitor-access `:67` | 5 dk | 8.640 | **8.640** + ek 50'lik sayfalar + biten ziyaretçi başına Hik senkron ve gerekirse IDE silme zinciri |
| cleanup-expired-email-tokens `:75` | Günlük 03:00 UTC | 30 | **30**; sayfalama yok, Y-08 |
| cleanup-expired-employee-setup-tokens `:81` | Günlük 03:15 UTC | 30 | **30 × max(1, ceil(employeeAuth / 200))**; her gün tablo taranır |
| cleanup-pending-uploads `:88` | Günlük 04:00 UTC | 30 | **30** + her dolu 200'lük eski yükleme partisi için devam çağrısı |
| purge-expired-card-readings `:95` | 24 saat | 30 | **30** + 50 ayar/sayfa devamı; süreli proje başına günlük 1–20 silme çağrısı, 200 kayıt/parti |
| close-ended-employments `:98` | Günlük 21:05 UTC / TR 00:05 | 30 | **30** + 50'lik sayfalar + kapanan çalışanların cihaz temizleme zincirleri |
| retry-fingerprint-purges `:100` | Günlük 04:30 UTC | 30 | **30 × max(1, ceil(enrollment / 100))** + silme snapshot'ları olan her sayfaya action; snapshot başına durum/cihaz/sonuç çağrıları |

Ana tetik toplamı **42.001/ay**; boş tablolarda dahi bilinen alt çağrılarla **56.463/ay ≈ %5,65**. Bu toplam ekran abonelikleri, mobil istekler, cihaz olayları, e-posta gönderimi, yoğun retry ve imha işlerini içermez; gerçek yük tahmini için bu değişkenler eklenmelidir. Örneğin günlük backfill'de sürekli 1.500 olay taranan **21 cihaz**, yalnız olay mutation'larıyla 945.000/ay; tabanla yaklaşık **1.002.093/ay** olur (21×30 ilerleme yazımı dahil, alarm alt çağrıları hariç); bu koşullu kapasite hesabı, canlı aşım iddiası değildir.

`requeue-ide-timeouts` (`crons.ts:59`) yorumda ve **0 çağrı**: bilinçli kota kararı, bulgu değil. LocalBridge kurtarması etkin ama ürün ertelenmiş; gereksiz olup olmadığı ancak canlı kuyruk envanteriyle anlaşılır. Worker yorumu “1 dakika” dese de gerçek Hik retry sıklığı 3 dakikadır (`actions/hikQueueWorker.ts:25`, `crons.ts:16`).

## 3. Yeni bulgular

| ID | Önem | Tür | Yer (file:line) | Ne oluyor (kullanıcı gözünden) | Kanıt (kısa) | Öneri | Emek | Güven |
|---|---|---|---|---|---|---|---|---|
| Y-01 | P0 | YETKİ | `convex/actions/sendEmail.ts:141`, `convex/employees.ts:162`, `convex/employeeAuth.ts:139` | Yalnız görüntüleme yetkili üye, başka çalışanın mobil hesabının parolasını belirleyebilir. | Action yalnız getById/ employees.view arıyor; token'ı istemcinin `email` adresine gönderiyor (`sendEmail.ts:171`, `:202`), setEmployeePassword bu token'la gerçek employeeAuth hash'ini değiştiriyor. | employees.manage zorunlu olsun; e-posta/proje/adları çalışan kaydından al; atomik hedef doğrulaması, limit ve audit ekle. | M | KESİN |
| Y-02 | P0 | YETKİ | `convex/privacyRetention.ts:64`, `convex/files.ts:60`, `convex/actions/getChatData.ts:59` | Personel görme yetkisi kaldırılmış proje üyesi yine kişi verisine ulaşabiliyor. | AssistantContext yalnız proje üyeliği arar; aiMaskNames=false iken son 5 kişinin adı/saatini verir. getUploadUrl çalışan fotoğrafında yalnız proje üyeliğini kontrol eder; employees.getById ise employees.view arar (`:162`). | Asistan için reports.view ve kişi alanları için employees.view; fotoğrafta da aynı personel okuma izni. | M | KESİN |
| Y-03 | P1 | EKSİK | `convex/auth.ts:19`, `src/components/profile/SecurityCard.tsx:20`, `src/pages/UserSetup.tsx:148` | Web parolasını unutan kullanıcı işi kendi başına tamamlayamaz; açık hesabın parolasını da değiştiremez. | Password sağlayıcısında reset kanalı yok; profil düğmesi kapalı. API reset e-postası üretebiliyor (`sendEmail.ts:249`) fakat UserSetup reset davetini reddediyor; consume da `invites.ts:23`'te reddeder. | Tek kullanımlık e-posta kurtarma ve mevcut parolayla değiştirme akışını, tüm oturumları iptal ederek tamamla; çalışmayan reset gönderimini kapat. | L | KESİN |
| Y-04 | P1 | TUTARSIZ | `convex/biometricDestruction.ts:142`, `convex/fingerprintEnrollment.ts:215`, `convex/lib/employeeCardChange.ts:37` | Cihazda olup merkezde şablonu olmayan parmak izi için imha “tamamlandı” olabilir; bekleyen/başarısız cihaz işi tutanak sayısına girmez. | Legacy tarama removeAllForEmployee çağırır; helper ayrı purge action'ı planlar ama runId/op kimliği ve sonuç dönmez. Run yalnız kendi pendingOpIds listesini bekler (`biometricDestruction.ts:129`, `:302`); source-only dal sayaç artırmaz. | Kaynak cihaz silme işlerini aynı imha run'ına bağla; tamamlanana kadar bekle veya açıkça teyitsiz say. | M | KESİN |
| Y-05 | P1 | HATA | `convex/alarms.ts:163`, `convex/actions/sendAlarmEmail.ts:12`, `convex/alarms.ts:190` | Gönderim action'ı claim'den sonra kesilirse e-posta süresiz “gönderiliyor” kalabilir. | Kesilmiş sending'i ikinci denemede kabul eden kod var, ama ikinci çağrı yalnız recordEmailResult çalışınca planlanır; cron/claim tarafında watchdog yok. | Claim sırasında süreli kurtarma işi oluştur; aynı teslim için sağlayıcı tekrar anahtarını koru; ikinci deneme kesilmesini de sonlandır. | M | KESİN |
| Y-06 | P1 | PERF/KOTA | `convex/actions/openaiChat.ts:40`, `:73`, `convex/lib/rateLimit.ts:4` | Tek doğrulanmış hesap, peş peşe asistan çağrılarıyla ortak ücretli API/kota tüketimini artırabilir. | Yalnız string argüman kontrolü; kullanıcı/proje hız limiti, günlük bütçe veya eşzamanlı istek sınırı yok; her çağrı sunucu OPENAI_API_KEY ile fetch yapar. | Kullanıcı/proje limitleri, metin uzunluğu ve eşzamanlılık sınırı; harcama eşiği. | M | KESİN |
| Y-07 | P1 | HATA | `convex/actions/sendScheduledReports.ts:57`, `convex/auth.config.ts:4`, `convex/actions/sendEmail.ts:186` | Aylık rapor e-postasındaki bağlantı uygulamadaki rapor ekranına götürmeyebilir. | Normal mail SITE_URL kullanırken rapor maili auth issuer/Convex HTTP adresi olan CONVEX_SITE_URL üzerine `/settings` ekler; seçili rapor sekmesini de taşımıyor. | SITE_URL + `/settings?tab=reports` ve uygun rapor/proje dönüş bağlantısı; gönderici alanını da ortaklaştır. | S | KESİN |
| Y-08 | P1 | PERF/KOTA | `convex/emailVerification.ts:112`, `:121` | Doğrulanmamış hesap birikiminde günlük token temizliği işlem sınırına takılabilir ve token kayıtları temizlenmez. | by_setup_token üzerinde süre filtresi + sınırsız collect + bütün sonuçlara aynı mutation'da patch; employeeAuth temizliği ise sayfalı. | Son kullanma zamanı indeksi ve sınırlı sayfa/devam zinciri; başarısızlık görünürlüğü. | M | OLASI |
| Y-09 | P2 | EKSİK | `convex/lib/adminGuards.ts:37`, `:62`, `convex/projects.ts:120`, `convex/schema.ts:256` | Proje silme önizlemesi bütün bağlı kayıtları göstermez; silinen projenin bazı ayar/planları sahipsiz kalır. | Bloklama/temizlik listelerinde alarmSettings, pdksRuleVersions/pdksCheckpointSelections ve accessScheduleTemplates yok. Boş projede bu bağımsız kayıtlar oluşturulabilir. | Proje sahibi olan tüm tablolar için koru/sil/engelle matrisi; önizleme ve silmeyi aynı listeden üret. | M | KESİN |
| Y-10 | P2 | TUTARSIZ | `public/hesap-silme/index.html:47`, `convex/employees.ts:394`, `convex/lib/employeeUx.ts:11` | Public hesap silme açıklaması, davet edilen ziyaretçilerin iletişim bilgilerinin de silineceğini söylüyor; webde çalışan silme bunu yapmıyor. | Bağlı silme listesi auth/sessions/shiftAssignments; cascade yalnız biyometri/rıza/kart okumaları. hostEmployeeId ile ziyaretçi iletişim alanlarını temizleyen adım yok. | Silme kapsamını ürün davranışıyla eşleştir; manuel süreç varsa açık belirt ve doğrulanabilir kontrol adımı ekle. | M | KESİN |
| Y-11 | P3 | ÖLÜ KOD | `convex/schema.ts:1096`, `:1160`, `convex/lib/adminGuards.ts:65`, `convex/lib/rateLimit.ts:10` | Eski SMTP/sohbet veri modeli ve kullanılmayan kayıt limiti bakımda gerçek işlev izlenimi yaratıyor. | mailSettings/chatConversations için şema + proje silme dışında aktif üretim okuyucu/yazıcı bulunmadı; sohbet messages sınırsız array; register limiter tanımlı ama çağrılmıyor. | Canlı veri varlığını ayrı teyit edip eski alanları daralt/kaldır; aktif kayıt koruması gibi belgelememe. | S | KESİN |
| Y-12 | P3 | TUTARSIZ | `convex/crons.ts:7`, `:36`, `:45`, `:75`; `convex/_generated/ai/guidelines.md` Cron guidelines | Zamanlama kodu projenin zorunlu Convex yönergesiyle uyuşmuyor. | Yönerge yalnız interval/cron isterken monthly/daily kullanılıyor; bu mevcut çalışma hatası değil, yerel kural ihlali. | Aynı UTC zamanlarını koruyarak cron ifadelerine geçir; saatleri test et. | S | KESİN |

**Y-01 kanıt zinciri:** Varsayılan viewer/security/technician rollerinde employees.view vardır (`convex/lib/roleCatalog.ts:91`). Bu yetkiyle çalışan kimliği/e-postası alınabilir; caller kendi adresini `sendEmployeeSetupEmail`'a verebilir; action çalışan kaydını değiştirmeden **o çalışana ait** employeeAuth setup token'ını yeni adrese yollar. Token tüketimi çalışan hash'ini değiştirir; sonraki giriş çalışan kaydındaki asıl e-posta + yeni parola ile olur (`convex/employeeAuth.ts:211`, `:226`, `:236`). Resend yapılandırması/teslimi saldırının operasyonel önkoşuludur; hiçbir gerçek e-posta veya hesap denemesi yapılmadı.

**Y-02 sınırı:** Bu çapraz proje sızıntısı iddiası değildir; aynı projede **kaldırılmış ayrıntılı rol izninin** aşılmasıdır. Fotoğraf yolunda bilinen storageId gerekir; AI adı sızıntısı aiMaskNames=false koşuluna bağlıdır. Maskeli varsayılanda dahi asistanın rapor erişimi, reports.view kaldırılmasıyla kapanmaz.

## 4. Modüller arası ilişkiler

### 4a. Verilen / alınan arayüzler

| Karşı modül | Bağ (tablo/fonksiyon) | Yön | Sorun var mı (file:line) |
|---|---|---|---|
| M1 kişi/erişim | users + userProjects → permissions; employees → employeeAuth; employeeConsents → imha | Çift yön | **Y-01** mobil parola kurulumu okuma yetkisiyle yazıyor; **Y-02** fotoğraf okuması ayrıntılı izni atlıyor |
| M2 cihaz | deviceEvents → notifyAlarmIfNeeded → sendAlarmEmail; cihaz komutları → audit | M2 → M4 | Normal hata görünür; **Y-05** kesilmiş action kurtarması eksik; IDE kart dışı olay kapsamı eski C4-1'de açık |
| M1 + M2 biyometri | employeeFaces/employeeFingerprints/deviceFingerprintEnrollments → destruction/purge → Hik | Çift yön | **Y-04** iki ayrı takip zinciri; merkezde şablon yoksa cihaz-only iş tutanaktan kopuyor |
| M3 PDKS/rapor | cardReadings saklama ve AI bağlamı; reports → sendScheduledReports; pdksRecords → auditLog | Çift yön | **Y-07** mailde yanlış uygulama adresi; saklama sonrasında geçmiş raporun ham kaynağı azalır; snapshot yok |
| M5 mobil | employeeAuth/employeeSessions → employeeAuthed*; kurulum token'ı ve parola sürümü | M4 → M5 | **Y-01** aynı hesabın mobil yetkilerine geçiş sağlar; web hesap dondurma mobil employeeSessions'ı kapatmaz (ayrı kimlik modeli) |
| Tümü | projects.remove → ortak tablolar | M4 → diğerleri | **Y-09** tablo sahipliği listesi eksik; eklenen her tablo silme sözleşmesine girmiyor |
| Public sayfalar ↔ M1/M5 | hesap-silme anlatımı → employees.remove | Anlatım → işlem | **Y-10** ziyaretçi iletişimi temizleme vaadi bağlı kodda yok |

### 4b. Uç / sarmalayıcı / ek kontrol karşılaştırması

| Modül / uç grubu | Sarmalayıcı | Ek kontrol / tutarsız olan |
|---|---|---|
| M1 employees create/update/remove/bulk; employeeImport | authedMutation | employees.manage ve proje; getById employees.view, ücret alanı pay.view (`employees.ts:162`, `:174`, `:413`) |
| M1 accessRules create/update/remove/WithGroups; templates | authedMutation | accessRules.manage (`accessRules.ts:694`, `:733`, `:814`, `lib/accessRuleWrite.ts:34`); eski sadece-oturum açığı kapanmış |
| M1 employeeConsents grant/revoke; fingerprintEnrollment | authedMutation; cihaz action'ları authedAction | biyometrik türlerde biometrics.manage, diğerinde employees.manage; çalışan proje kontrolü (`employeeConsents.ts:119`, `fingerprintEnrollment.ts:285`) |
| M1/M4 çalışan kurulum maili | authedAction | **Tutarsız:** employees.view üzerinden geçiyor; yazma yetkisi yok, Y-01 |
| M2 devices/zones/doors/readers yazımı | authedMutation | devices.manage; kapı planı accessRules.manage; hedef cihazın projesi kontrol edilir (`doors.ts:276`, `:300`, `readers.ts:126`) |
| M2 Hik/IDE uzaktan açma / cihaz komutları | authedAction | doors.open / devices.manage; bilinçli viewer kapı açma kararı korunmuş (`actions/ideGatewayDevice.ts:378`, `lib/gatewayCommand.ts:188`) |
| M2 senkron hata listeleri | query | Manuel geçerli oturum + resolveProjectScope; payload dışarı çıkarılmaz (`hikvisionSync.ts:732`, `ideSync.ts:664`) |
| M3 shifts/shiftPlans/holidays/settings yazımı | authedMutation | schedule.manage + proje; departments employees.manage (`shifts.ts:516`, `holidays.ts:13`, `departments.ts:30`); ertelenmiş eski rol eksikliği artık kapanmış |
| M3 reports / SGK / bordro | authedQuery | reports.view, ücret içeren alanlarda pay.view (`lib/reportScope.ts:34`); asistan bu rapor kapısından geçmiyor, Y-02 |
| M3 PDKS manuel / talep onayı | authedMutation | attendance.approve + çalışan/proje; getPdksAuditForEmployee ayrıca admin.manage ister (`auditLog.ts:31`) |
| M5 talepler submit/withdraw/listMine | employeeAuthedMutation / employeeAuthedQuery | Kendi çalışan kimliği; inceleme başında **(commit'siz WIP)**, sonradan `5de547a8`; web karar uçları ayrı authedMutation |
| M5 mobil kapı / QR | mutation ve employeeAuthed* | getCurrentEmployee + session/şifre sürümü/aktiflik + hedef proje; raw mutation olması tek başına açık değil (`mobileAccess.ts:60`, `employeeCheckIn.ts:12`) |

Web `Layout` oturum/doğrulama kapısıdır (`src/components/Layout.tsx:34`); sayfa/düğme izinleri usePermissions → roles.myPermissions üzerinden gelir. `src/lib/capabilities.ts:1` Permission tipini doğrudan roleCatalog'dan alır: 5 rol × 13 izin için ikinci, bağımsız bir rol matrisi yoktur. Settings sekmeleri admin.manage/reports.view/devices.manage'e göre ayrılır; SystemAdmin ayrıca platform rolünü kontrol eder; UI görünürlüğü backend kontrolünün yerine geçmez.

Diğer zincir notları:
- Saklama yalnız cardReadings'ı siler, PDKS/raporun ham kaynağı da budur; gün başı Türkiye saatinden hesaplanır, süre değişince eski zincir durur, günlük proje başına üst sınır 4.000'dir (`lib/cardReadingRetention.ts:4`, `:12`, `privacyRetention.ts:97`). Alarm/audit/consent için aynı otomatik saklama varmış gibi anlatılmamalı.
- AI dbContext istemciden kabul edilse de OpenAI sınırında **yeniden sunucudan üretiliyor**; kart numarası/kimlik örneğe alınmıyor, ad maskeleme varsayılan açık, API key env'de (`openaiChat.ts:60`, `:68`, `privacyRetention.ts:68`). Kullanıcının serbest `input` metni ayrıca maskelenmez (`openaiChat.ts:88`).
- Şema birçok eski projectId/role/verified alanını optional tutuyor; eksik membership.role global eski rolden türetiliyor, verified yalnız tam false ise engelleniyor (`lib/permissions.ts:31`, `lib/auth.ts:50`). Bu geçiş borcu canlı veri envanteri olmadan güvenlik açığı ilan edilmedi.
- Denetim günlüğü append-only mühürlü kayıt değildir: imha çalışma durumu aynı auditLog satırında patch edilir (`biometricDestruction.ts:41`); final tutanak ayrı yazılır. İç operasyon durumunu ayrı tabloya taşımak denetim bütünlüğünü daha açık kılar; istemcinin keyfi audit silme/değiştirme ucu bulunmadı.

## 5. Eski audit durumu

Eski “TAMAM” satırları da yeniden kontrol edildi; aşağıdaki DÜZELDİ bunlarda “kontrol mevcut/korunmuş” anlamındadır. Eski eksikler yeni Y listesinde tekrar sayılmadı.

| Eski madde | Durum | Güncel kanıt / kalan iş |
|---|---|---|
| C1-1/2/3 proje → davet → kabul | DÜZELDİ | `projects.ts:59`, `actions/sendEmail.ts:214`, `invites.ts:213`; rol artık üyeliğe yazılıyor |
| C1-4 ve C bulgu 5 / OZET 5.3 kurulum kontrol listesi | KISMEN | `projects.ts:180`, `src/components/dashboard/SetupChecklist.tsx:34`; beş adım var; son sinyal varlığı gerçek güncel cihaz sağlığı garantisi değil (`projects.ts:196`); fiziksel kurulum yine servis işi |
| C1-5/6/7/8 cihaz, kişi, kural, ilk geçiş bağlantısı | KISMEN | `projects.ts:186` beş bağımsız varlık/sinyali topluyor; aynı kişinin aynı kural/cihaz üzerinden gerçek ilk geçişini uçtan uca kanıtlamıyor; cihaz teyidi M1/M2 |
| C4-1 IDE kart dışı alarm | AÇIK | `convex/http.ts:359` kart yoksa lastSeen güncelleyip döner; Hik dışı kurcalama eşlemesi yok |
| C4-2 alarm listesi/proje filtreleri | DÜZELDİ | `alarms.ts:16`, `:19`, `:41`; sınırlı okuma, proje/cihaz doğrulaması |
| C4-3 olay/kapı kuralı, takvim, App bildirim | AÇIK | `alarms.ts:103` hâlâ proje aç/kapa, önem ve alıcı listesi; `src/pages/Alarms.tsx:63` aynı kapsam |
| C4-4 gönderim durumları/test/tekrar | DÜZELDİ | `alarms.ts:134`, `:180`, `actions/sendAlarmEmail.ts:41`; normal hata retryScheduled/failed görünür. Yeni kesilme dalı Y-05 ayrıca |
| C4-5 normal olayda tazelik | DÜZELDİ | `lib/alarmNotify.ts:31` ortak girişte 10 dk geçmiş / 2 dk ileri sınırı |
| C4-6 onay/note UI | KISMEN | `alarms.ts:67` proje + alarms.ack + 50 limit/not var; `src/pages/Alarms.tsx:102` yalnız ids gönderiyor, not giriş alanı yok |
| C4-7 alarm export/sınıflandırma | AÇIK | `src/pages/Alarms.tsx:109` liste/onay var; ayrı alarm export/yanlış alarm sınıflandırması yok; audit Excel mevcut |
| C5-1 kullanıcı yönetimi sınırı | DÜZELDİ | `roles.ts:159`, `users.ts:371`, `src/lib/capabilities.ts:6`; proje admin ve platform admin ayrılmış |
| C5-2 global rol + diğer projelerin davetinin iptali | KISMEN | Rol `invites.ts:257` ile üyelikte; **bütün projelerde aynı e-postanın açık davetini iptal etme hâlâ var** (`invites.ts:75`) |
| C5-3 web/mobil süre ayrımı ve 2FA | KISMEN | Web `auth.ts:9` 7 gün, mobil `employeeAuth.ts:14` 90 gün; `SecurityCard.tsx:32` 2FA yok; farklı hesap modelleri korunuyor |
| C5-4 hesap dondurma/bitiş/son super_admin | DÜZELDİ | `accountAccess.ts:10`, `:36`, `lib/adminGuards.ts:184`, `lib/sessionRevoke.ts:17`; eski JWT dahil oturum cutoff'u kontrol edilir |
| C5-5 proje değiştirme / üyelik kaldırma | DÜZELDİ | `userProjects.ts:6`, `src/contexts/ActiveProjectContext.tsx:104`; backend her çağrıda üyelik okuyarak izin çözer |
| C5-6 / C bulgu 1 / OZET 1.2 topoloji yetkisi ve yabancı cihaz | DÜZELDİ | `doors.ts:276`, `:300`, `readers.ts:126`, `zones.ts:46`; devices.manage + aynı proje |
| C5-7 pasif proje erişimi | AÇIK | `lib/auth.ts:88` üyelikleri isActive süzmeden döndürür; normal üye seçicisi `userProjects.ts:17`, `ActiveProjectContext.tsx:88`; pasife almak web erişimini kesmez |
| C5-8 rol/üyelik audit'i; projesiz dondurma kaydı | KISMEN | Yeni proje rolü/yetkisi audit'li (`roles.ts:135`, `:204`); platform updateRole/deleteUser audit'siz (`users.ts:84`, `:221`), dondurma audit'inde projectId yok (`accountAccess.ts:18`) |
| C5-9 / C bulgu 2 / OZET 1.4 çalışan denetimi tenant sızıntısı | DÜZELDİ | `auditLog.ts:31` çalışan+rol kontrolü, `:43` hedef indeksi, `:46` proje filtresi; global bulk-upsert tüm çalışanlara eklenmiyor |
| C6-1 eski projelerde biyometri açık varsayım | AÇIK | `lib/privacySettings.ts:12` eski ayarsız projede true; yeni proje false (`projects.ts:77`); canlı envanter gerekir |
| C6-2 kritik alan gerekçesi ve imha kilidi | DÜZELDİ | `privacyBiometric.ts:36`, `:39`, `lib/biometricGate.ts:15` |
| C6-3 rıza/belge/yükleme sahipliği | DÜZELDİ | `employeeConsents.ts:32`, `:145`, `files.ts:25`; mevcut rıza belgesinin yeniden claim edilmesi engelli |
| C6-4 yüz/fotoğraf rızası geri alma | KISMEN | Parmak için purge devam ediyor; yüz/fotoğrafta yalnız revokedAt (`employeeConsents.ts:122`, `:125`) |
| C6-5 kapatma ve imhanın ayrı olması | KISMEN | Ayrı doğrulamalı imha var (`biometricDestruction.ts:78`, `:89`); kapatma otomatik silme değil, cihaz teyidi ayrı; yeni source-only takip açığı Y-04 |
| C6-6 saklama süresi | DÜZELDİ | `privacyRetention.ts:90`, `lib/cardReadingRetention.ts:12`; 5–10 yıl/süresiz, süre değişimi durduruyor; kapsam kart okumaları |
| C6-7 kişi silme ölçeği ve zayıf maskeleme | AÇIK | `lib/employeeCascade.ts:59` sınırsız collect; `:97` 32-bit hash; güçlü anonimlik ve büyük veri kapasitesi kanıtı değil |
| C6-8 genel ayarların proje kapsamı | DÜZELDİ | `settings.ts:34`, `:64`; üyelik/yetkili projeden okuma, hedef projeye yazma |
| C6-9 etkisiz genel bildirim tercihleri | KISMEN | Alarm ayrı ekrana açıkça yönlendirilmiş (`NotificationSettings.tsx:23`), genel e-posta anahtarı gizlenmiş; report/system hâlâ gönderim tüketicisine bağlı değil (`:28`, `settings.ts:113`) |
| C6-10 sağlayıcı yapılandırma/test | KISMEN | `alarms.ts:134` alarm testi var; MailSettings sunucu Resend bilgisi; müşteri SMTP/ortak sağlayıcı sağlık ekranı yok |
| C bulgu 3 / OZET 5.1 Windows roster | AÇIK — bilinçli erteleme | Roster yok, ürün ertelenmiş; yeni bulgu yapılmadı. Etkin localBridge cron ve kalan poll/ack yüzeyi maliyet haritasında gösterildi |
| C bulgu 4 / OZET 5.2 offline + mail + tek ayar | KISMEN | `lib/deviceConnection.ts:61` geri bağlantıda arıza; `devices.ts:1038` ISUP offline teyidi; mail durumu/test düzeldi; IDE kart dışı kapsam ve etkisiz tercihler sürüyor |
| OZET 1.1 erişim kuralı yazımı | DÜZELDİ | `accessRules.ts:694`, `:733`, `:814`, `lib/accessRuleWrite.ts:34` accessRules.manage |
| OZET 1.3 tatil proje sınırı | DÜZELDİ | `holidays.ts:12`, `:24`; kullanıcı projeleri + global görünür tatiller, yazma schedule.manage |
| OZET 1.5 kart eşleştirme / toplu kart çakışması | DÜZELDİ (yetki sınırı incelemesi) | `lib/processCardReadingCore.ts:183` proje eşleştirmesi ve `employeeImport.ts:112` global kart çakışması kontrolü; ayrıntılı kart kararı/cihaz etkisi M1/M2 |
| OZET 1.6 olumsuz yetki testleri | KISMEN | `convex/akisFaz1.authz.test.ts`, `roles.*.test.ts`, `invites.test.ts` var; Y-01/Y-02 uçları kapsam dışında kalmış |
| Ertelenmiş shifts/departments yazma rolü | DÜZELDİ | Güncel kod `shifts.ts:516` schedule.manage, `departments.ts:30`, `:60`, `:94` employees.manage arıyor; eski ertelendi bilgisi artık kodu yansıtmıyor |

## 6. Doğrulama ve test boşlukları

Çalıştırılan salt-okuma kontroller: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` **0 hata**; M4 backend dosyaları, ilgili action'lar, App/Settings/auth/profile üzerinde hedefli ESLint **0 hata, 0 uyarı**. Tam lint/tam test suite çalıştırılmadı.

`vitest run convex/invites.test.ts convex/accountAccess.test.ts convex/alarmDelivery.test.ts convex/files.test.ts convex/roles.admin.test.ts`: **5 dosya, 122 test geçti**. Bu testler tüm yeni bulguları doğrulayan kapsama sahip değildir; bulguların ana kanıtı yukarıdaki kaynak zincirleridir.

Kritik test boşlukları (en fazla sekiz):
1. Viewer/security/technician ile sendEmployeeSetupEmail çağrısı; alıcı/proje değiştirme ve çalışan hesabının devralınmasının reddi (Y-01).
2. Aynı projede employees.view/reports.view geri alındığında AI bağlamı ve storage URL'inin reddi; normal personel API'siyle aynı karar (Y-02).
3. Web şifre kurtarma/değiştirme uçtan uca: süresi dolmuş/ikinci kez kullanılan token, eski JWT, tüm cihaz oturumlarının iptali (Y-03).
4. Merkezde şablonsuz ama cihazda enrollment bulunan çalışan; purge başarısızken imha tutanağının completed/0 teyitsiz olmaması (Y-04).
5. Alarm claim'den hemen sonra action kesilmesi; sonuç mutation'ı hiç çalışmadığında otomatik kurtarma ve ikinci kesilmenin terminal hâle gelmesi (Y-05).
6. Asistan paralel/seri çağrı limiti ve büyük input; scheduler rapor linkinde SITE_URL/sekme doğrulaması (Y-06/Y-07).
7. Çok sayıda doğrulanmamış kullanıcıda token temizliğinin parti devamı; sıfır bağlı kişi/cihaz ama ayar/şablon bulunan projede silme matrisi (Y-08/Y-09).
8. Public silme anlatımıyla gerçek çalışan/ziyaretçi kişisel veri temizliği eşleşmesi (Y-10); yalnız mailto bağlantısının varlığı yeterli değil.

## 7. TEYİT GEREK ve kapsam dışı

- **TEYİT GEREK (canlı):** İncelenen sürümün deployment eşleşmesi; eski verified/role/projectId boş kayıt sayıları; kullanılmayan mailSettings/chatConversations satırlarının gerçekten varlığı; Resend/SITE_URL/OPENAI_API_KEY yapılandırmasının varlığı (değerleri okunmadı); cron çağrı/okuma grafikleri ve etkin cihaz sayısı.
- **TEYİT GEREK (cihaz):** Yüz/fotoğraf rıza iptali sonrası terminaldeki şablon; çevrimdışı parmak izi silme ve source-only sonuçları; Hik/IDE alarm türleri ve fiziksel kapı/komut ayrımı. Kaynak açıklarını kanıtlamak için cihaz denemesi yapılmadı.
- **TEYİT GEREK (ürün):** Pasif proje “erişimi kes” mi “listeden gizle” mi; web/mobil hesap dondurmasının bağımsızlığı; 30 günlük public silme talebinin operasyonel takibi. Hukuki uygunluk kararı verilmedi.
- M1/M2'nin bütün erişim kararları, M3 hesap/ücret formülleri, M5 mobil ekran davranışı yeniden kapsamlı audit edilmedi; burada ortak yetki, proje, mail, audit ve imha sözleşmeleri izlendi. Tüm Convex dosyaları export/sarmalayıcı taramasına dahil edildi, bu her internal cihaz algoritmasının doğrulandığı anlamına gelmez.
- Tarayıcı, internet araştırması, DB/Supabase, cihaz/ağ istekleri, paket kurma, Convex CLI, deploy, Git yazma/commit işlemi yapılmadı. `src/lib/permissionsUI.ts` ve `src/components/auth/ProtectedRoute.tsx` mevcut değil; fiilî koruma Layout/usePermissions/capabilities üzerinden incelendi.
