# Alan C — Erişim, ziyaretçi, hesap, bildirim ve sistem

## Özet

31 durum makinesi/ilişkili durum uzayı kaydedildi; alt eksenler aynı makinede birlikte gösterildi.
Bulgular: **critical 1, high 4, medium 1, low 2** (8 ayrı kök neden).
En kritik bulgu C-01: davetle temiz hesap devralma action’ı, davet tüketimiyle aynı işlemde şifre yazmadığı için tüketimden sonra da şifre değiştirebilir.
Bu, mevcut kirli çalışma ağacının statik denetimidir; test, servis çağrısı, deploy veya DB yazımı yapılmadı. Yarışlar kod sırasından çıkarılmıştır, çalıştırılarak denenmedi.
Convex’te DB constraint/trigger yoktur: enum doğrulaması değer kümesini sınırlar; geçiş güvenliğini yalnız mutation ön-kontrolü ve işlem (transaction) sağlar. Index tek başına benzersizlik sağlamaz.

## Keşif sayımları

AGENTS.md ve convex/_generated/ai/guidelines.md okundu. Başlangıç `git diff --stat | tail -1`: `211 files changed, 4049 insertions(+), 2058 deletions(-)`.
Tarama beş kökün tamamında içerik üzerinden yapıldı; dosya adlarıyla sınırlandırılmadı. `visitors`, `doorPlans`, `alarms` adında ayrı tablo yok: sırasıyla employees, doors ve deviceEvents alanları kullanılıyor. convex/doorPlans.ts dosyası yok; kapı planı yolları doors.ts ve action/helper dosyalarında.

```sh
rg --files convex src mobile/lib infra bridge | wc -l  # 1521
# S = aşağıdaki regex ile bulunan dosyalar; kabukta boşluk güvenliği için Python subprocess argüman dizisi kullanıldı.
rg -il 'REGEX' convex src mobile/lib infra bridge
```

REGEX (birebir):
```text
accessRules|accessGrantStatus|grantStatus|groupMembers|groupDoors|groupDevices|groupDepartments|doorPlans|doorPlanInvalidation|accessEnd|accessSchedule|accessDecision|visitors|visitorStatus|visitorPresence|visitorRetention|visitorDoorRule|mobileVisitors|visitorHosts|userProjects|projectRolePermissions|invites|emailVerification|setPassword|onboarding|accountAccess|sessionRevoke|rateLimit|alarmSettings|alarmEmail|alarmNotify|alarmDelivery|notificationSettings|mailSettings|projectMail|smtp|auditLog|pendingUploads|chatConversations|projectPrivacySettings|privacyRetention|privacyBiometric|dataMigrations|migrations|maintenance|generalSettings|ideDefaults|"users"|"projects"|visitor|doorPlan|hikPlan|DoorStatusPlan|VerifyPlan|HolidayPlan|sessionsRevokedThrough|disabledAt|setupToken|permission|accountAccess|notification|alarm|privacy|auditLog
```

748 dosya eşleşti. Test, /test/, /_generated/ ve .g. girdileri çıkarılınca 438 üretim dosyası kaldı. Her örüntü için `rg -o 'ÖRÜNTÜ' S...` çalıştırıldı; sonuç satır sayısı **eşleşme** sayısıdır (aynı satırda birden çok eşleşme ayrı sayılır).

| Örüntü | Tüm eşleşen dosyalar | Üretim |
|---|---:|---:|
| `\bstatus\b` | 2354 | 1215 |
| `\bstate\b` | 1878 | 557 |
| `\bphase\b` | 61 | 51 |
| `v\.literal\(` | 572 | 569 |
| `\b\w*At\s*:` | 2471 | 792 |
| `\bis[A-Z]\w*` | 3001 | 1891 |

Sayım aday havuzudur; yorum, validator, okuma, A/B alanına ortak dosya ve UI geçici durumları içerir. At eşleşmesi timestamp adlandırma adayı, is eşleşmesi boolean adlandırma adayıdır; tip kontrolü değildir. Schema gerçek alan tipleri Ek A’dadır. DB yazan satırlar ve UI durum kopyaları Ek B/C’de yeniden üretilebilir tam envanter olarak yer alır.

## Makine listesi

| # | Varlık | Saklama (tablo.alan; dosya:satır) | Durumlar | Zorlama yeri | Bulgu sayısı |
|---|---|---|---|---|---:|
| 1 | Erişim kuralı | accessRules.isActive/isTemplate/targetType; convex/schema.ts:550 | aktif/pasif; şablon/normal; hedef türü string | schema boolean; mutation yetki ve kapsam kontrolü | 1 (C-02) |
| 2 | Kural üyeliği ve kapsamı | groupMembers.source; groupDevices/groupDoors/groupDepartments satır varlığı; convex/schema.ts:579 | yok/manuel/departmandan; kapı seçimi yok=tüm kapılar veya açık seçilmiş alt küme | schema source union; mutation proje/ilişki kontrolleri | 0 (—) |
| 3 | Dağıtılmış erişim sonucu | accessGrantStatus.state/appliedAt/lastOperationId/lastRunId/lastError; convex/schema.ts:537 | pending/effective/failed/removed; uygulanma tarihi eski başarıyı koruyabilir | schema union; tekil ACK işlem kimliği; toplu yazımda sıralama kontrolü yok | 1 (C-03) |
| 4 | Erişim zamanı ve karar | accessRules.days/startTime/endTime/isActive; employees.accessExpiresAt/accessStartsAt; convex/schema.ts:550 | açık/kapalı pencere; erişim sona ermiş/sınırsız; en az bir ortak açık kural | mutation doğrulaması; saf karar fonksiyonu | 0 (—) |
| 5 | Kapı planı sürüm/teslim | doors.hikPlanRevision/hikPlanResults/hikPlanPendingReason/hikPlanAppliedAt; convex/schema.ts:332 | kaydedilmemiş/bekliyor/uygulandı/hatalı; status ve verify ayrı alt sonuçlar | schema şekil; mutation revision kontrolü | 0 (—) |
| 6 | Ziyaretçi erişim yaşam döngüsü | employees.isVisitor/isActive/visitorStatus/accessExpiresAt; convex/schema.ts:130 | saklanan preRegistered/checkedIn/checkedOut/expired; sunulan active/checkedOut/expired/preRegistered | schema enum; mutation tarih/kart/yetki kontrolü; türetilmiş durum fonksiyonu | 0 (—) |
| 7 | Ziyaretçi kart sahipliği | employees.cardNumber (normal/PRE:/IADE:); convex/schema.ts:100 | ön kayıt yer tutucu/atanmış/iade edilmiş | mutation kart çakışma ve eski kimlik korumaları | 0 (—) |
| 8 | Mobil ziyaretçi daveti ve tekrar | employees.mobileVisitorRequestId/Fingerprint/hostEmployeeId/notice; convex/schema.ts:144 | oluşturma niyeti/bilinmeyen sonuç/makbuz alındı; düzenlenebilir/kilitli/iptal | mutation sahiplik+fingerprint; UI epoch ve kalıcı niyet | 0 (—) |
| 9 | Ziyaretçi fiziksel konumu | cardReadings accessTime/accessStatus/direction (türetilir); convex/lib/visitorPresence.ts:10 | unknown/inside/outside; aynı anda zıt yön unknown | yalnız saf okuma; saklanan status ile eş tutulmaz | 0 (—) |
| 10 | Ziyaretçi cihaz kanıtı | grant ve operasyon satırlarından hesaplanan sync.status; convex/lib/mobileVisitors.ts:1 | pending/applied/failed/unknown; sınırlı okuma bounded | okuma izdüşümü (projection); ayrı saklanan visitor enum yok | 0 (—) |
| 11 | Ziyaretçi saklama/imha | projectPrivacySettings.visitorRetentionDays; employees bitiş+pasif; convex/schema.ts:1483 | süresiz/30..3650 gün; aday/zamanlandı/yeniden kontrol/silindi/hata kaydı | mutation tekrar kontrolü; batch bütçesi | 1 (C-05) |
| 12 | Kullanıcı doğrulama | users.verified/setupToken/tokenExpiresAt/emailVerificationTime; convex/schema.ts:22 | legacy undefined=izinli; false=doğrulanmamış; true=doğrulanmış; token yok/geçerli/süresi dolmuş | schema boolean; auth guard ve mutation | 0 (—) |
| 13 | Hesap dondurma ve bitiş | users.disabledAt/disabledBy/accessExpiresAt/accessExpiryJobId; convex/schema.ts:33 | etkin/donmuş/süresi dolmuş; donmuş ve süresi dolmuş birlikte olabilir | mutation hedef ve son admin kontrolü; auth accessBlockReason | 1 (C-04) |
| 14 | Oturum iptal zinciri | users.sessionsRevokedThrough; authSessions/authRefreshTokens varlığı; convex/schema.ts:32 | geçerli/iptal eşiğinden eski/silinmiş; devam işi | mutation cutoff; her istekte session+expiration+watermark kontrolü | 0 (—) |
| 15 | Platform ve proje rolleri | users.role; userProjects.role; projectRolePermissions.permissions; convex/schema.ts:39 | platform super_admin/project_admin/project_user; proje admin/hr/security/technician/viewer; varsayılan/özel yetki | schema union; mutation admin.manage; admin rolü kilitli; okuma kapıları farklı | 1 (C-02) |
| 16 | Proje üyeliği ve onboarding | userProjects satır varlığı; projects.ownerId; users.firstCompanyName; convex/schema.ts:63 | üye değil/üye; yeni kullanıcı/projesi var; owner ayrı meta veri | mutation duplicate sorgusu; Convex transaction | 0 (—) |
| 17 | Proje aktiflik ve silme | projects.isActive; satır varlığı; convex/schema.ts:83 | aktif/pasif/legacy undefined/silinmiş | schema boolean; superAdmin mutation; aktiflik genel yetki kapısı değil | 1 (C-06) |
| 18 | Davet ve reset tüketimi | invites.used/type/expiresAt/token/role; convex/schema.ts:1492 | açık/kullanıldı/süresi dolmuş; invite/reset; türsüz legacy=invite | schema tür union; mutation token+süre+yaratanın güncel yetkisi | 0 (—) |
| 19 | Davetle hesap devralma | authAccounts/users temiz hesap + action geçişi; convex/invites.ts:179 | none/claimable/taken; flow signUp/signIn | query ve temizlik mutation kontrolü var; credential yazımı ayrı transaction | 1 (C-01) |
| 20 | Şifre kurulum/reset | employeeAuth.setupToken/expiresAt/passwordHash; invites reset; convex/actions/setPassword.ts:12 | token yok/geçerli/expired/consumed; success/error | nihai consumeSetupToken mutation; bcrypt öncesi query yalnız optimizasyon | 0 (—) |
| 21 | İstek kotası | rateLimiter component state; convex/lib/rateLimit.ts:4 | token var/yetersiz/doluyor; fixed window açık/doldu | component mutation; throws ve anahtarlandırma | 0 (—) |
| 22 | Alarm onay ve çözüm | deviceEvents.ackedAt/ackedBy/resolvedAt/category/severity; convex/schema.ts:697 | onaysız/onaylı × açık/çözülmüş; category alarm/exception vb.; info/warning/critical | schema enum; acknowledge mutation izin+category+idempotence | 0 (—) |
| 23 | Alarm e-posta teslimi | deviceEvents.alarmEmailStatus/Attempts/RetryAt/Content/Recipients; convex/schema.ts:744 | queued/sending/retryScheduled/sent/failed/skipped | schema enum; claim mutation deneme ve ön durum; sonuç aynı attempt; provider idempotency | 0 (—) |
| 24 | Alarm ve bildirim tercihleri | alarmSettings.emailEnabled/minSeverity; notificationSettings dört boolean; generalSettings.notificationsEnabled; convex/schema.ts:764 | kapalı/açık × warning/critical; bağımsız legacy/rapor/geç/sistem tercihleri | schema boolean; mutation admin.manage; bazı tercihler yalnız kayıt | 0 (—) |
| 25 | Proje SMTP ve e-posta action | mailSettings.isActive/smtpPassword/alan tamlığı; convex/schema.ts:1147 | kayıtsız/eksik/tam; aktif/pasif; test başarı/hata geçici sonuç, saklanan doğrulandı yok | mutation admin.manage; şifre değişimi şartı; sonuç UI | 1 (C-04) |
| 26 | Dosya yükleme sahipliği | pendingUploads satır varlığı; users.photoUrl/employees.photoStorageId; convex/schema.ts:1449 | URL üretildi/yüklendi/sahiplenildi/bağlandı/24saat artık/silindi | mutation owner kontrolü; storage id varlık kontrolü | 0 (—) |
| 27 | Denetim kaydı ve maskeleme | auditLog.action/oldValue/newValue/searchText; privacy aiMaskNames; convex/schema.ts:1411 | create/update/delete; ham/minimize edilmiş; isim maskeli/açık | schema action union; mutation writeAudit ve silmede/migration minimization | 0 (—) |
| 28 | Gizlilik ve biyometri anahtarı | projectPrivacySettings.biometricEnabled/ChangedAt/Reason; cardReadingRetentionDays/aiMaskNames; convex/schema.ts:1475 | legacy default açık/yeni açık/kapalı; saklama süresiz veya 1825..3650; isim maskeli/açık | schema boolean; mutation admin.manage+imha sürerken açma engeli | 1 (C-07) |
| 29 | Retention / migration / maintenance zinciri | scheduler args stage/batch/cursor/runAt; migrations component; convex/privacyRetention.ts:202 | operations/events/access; aşama 0..14; batch 0..19; bitti/devam/atlandı; dryRun/yaz | internal mutation; stage doğrulama; component migration ilerlemesi | 1 (C-05) |
| 30 | Genel ayarlar ve IDE varsayılanları | generalSettings.darkMode/timezone/dateFormat/systemLanguage; ideDefaults singleton; convex/schema.ts:1125 | satır yok/default veya kayıtlı; dark/light; kimlik yeni cihaza kopyalanır | mutation admin.manage / superAdmin; string enum zorlaması yok | 0 (—) |
| 31 | Sohbet mesaj rolü ve konuşma varlığı | chatConversations.messages[].role; satır varlığı; convex/schema.ts:1211 | user/assistant; yok/var/silinmiş; pending/error kalıcı alan yok | schema role union; görünür üretim insert yolu bulunmadı | 1 (C-08) |

Aynı kök neden birden fazla makineyi etkileyebilir; bulgu sayısı toplamı benzersiz bulgu sayısı değildir.

## Makineler

### 1. Erişim kuralı

Durumlar: aktif/pasif; şablon/normal; hedef türü string. Saklama: `accessRules.isActive/isTemplate/targetType` (convex/schema.ts:550). Zorlama: schema boolean; mutation yetki ve kapsam kontrolü.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| oluştur → aktif/pasif | convex/accessRules.ts:801, convex/lib/accessRuleWrite.ts:58 | yetki ve ilişki doğrulaması |
| aktif ↔ pasif, plan değişir | convex/accessRules.ts:844,1100 | accessRules.manage |
| her durum → silindi | convex/accessRules.ts:960 | yetki; ilişkiler temizlenir |

Okuyan kopyalar: src/components/access-control/unified; convex/lib/accessRuleRead.ts:6; mobil doğrudan kural yönetmez. Bulgu: C-02. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 2. Kural üyeliği ve kapsamı

Durumlar: yok/manuel/departmandan; kapı seçimi yok=tüm kapılar veya açık seçilmiş alt küme. Saklama: `groupMembers.source; groupDevices/groupDoors/groupDepartments satır varlığı` (convex/schema.ts:579). Zorlama: schema source union; mutation proje/ilişki kontrolleri.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| yok → bağlı | convex/lib/accessRuleWrite.ts:69,83,98 | doğrulama |
| bağlı → yok/değişti | convex/accessRules.ts:1106,1121,1128,1160 | yetki |
| kural sil → tüm bağlar yok | convex/accessRules.ts:955,958 | kontrollü |

Okuyan kopyalar: convex/lib/grantStatus.ts:22; convex/lib/accessGraph.ts; src/components/access-control/unified. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 3. Dağıtılmış erişim sonucu

Durumlar: pending/effective/failed/removed; uygulanma tarihi eski başarıyı koruyabilir. Saklama: `accessGrantStatus.state/appliedAt/lastOperationId/lastRunId/lastError` (convex/schema.ts:537). Zorlama: schema union; tekil ACK işlem kimliği; toplu yazımda sıralama kontrolü yok.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| yok/herhangi → pending | convex/lib/grantStatus.ts:158 | kapsam |
| pending → effective/failed/removed | convex/lib/grantStatus.ts:210 | tekil işlem kimliği |
| herhangi → sonuç | convex/accessGrantStatus.ts:288 | toplu sonuç; sürüm kontrolü yok |

Okuyan kopyalar: convex/accessGrantStatus.ts:151,211,250; src içindeki grant filtreleri; mobil visitorSyncEvidence. Bulgu: C-03. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 4. Erişim zamanı ve karar

Durumlar: açık/kapalı pencere; erişim sona ermiş/sınırsız; en az bir ortak açık kural. Saklama: `accessRules.days/startTime/endTime/isActive; employees.accessExpiresAt/accessStartsAt` (convex/schema.ts:550). Zorlama: mutation doğrulaması; saf karar fonksiyonu.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| saat/gün geçer → açık/kapalı | convex/lib/accessSchedule.ts | saf hesap |
| bitiş geçer → süresi doldu | convex/lib/accessEnd.ts:11 | tarih hesaplama |
| ortak aktif+açık kural → izin | convex/lib/accessDecision.ts:21 | kesişim |

Okuyan kopyalar: web kural formu; mobile token çağrıları; başlangıç alanı schema yorumuna göre yalnız kayıt amaçlı. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 5. Kapı planı sürüm/teslim

Durumlar: kaydedilmemiş/bekliyor/uygulandı/hatalı; status ve verify ayrı alt sonuçlar. Saklama: `doors.hikPlanRevision/hikPlanResults/hikPlanPendingReason/hikPlanAppliedAt` (convex/schema.ts:332). Zorlama: schema şekil; mutation revision kontrolü.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| düzenle → yeni revision/bekliyor | convex/doors.ts:639 | devices.manage |
| sonuç → uygulandı/hata | convex/doors.ts:689 | revision; eski sonuç yeni sürümü başarılı yapmaz |
| takvim değişti → bekliyor | convex/doorPlanInvalidation.ts:19 | yalnız status sonucu düşürülür |

Okuyan kopyalar: convex/doors.ts:650; web kapı planı hedefleri; mobil plan düzenlemez. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 6. Ziyaretçi erişim yaşam döngüsü

Durumlar: saklanan preRegistered/checkedIn/checkedOut/expired; sunulan active/checkedOut/expired/preRegistered. Saklama: `employees.isVisitor/isActive/visitorStatus/accessExpiresAt` (convex/schema.ts:130). Zorlama: schema enum; mutation tarih/kart/yetki kontrolü; türetilmiş durum fonksiyonu.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| yok → checkedIn veya preRegistered | convex/visitors.ts:419 | yetki+tarih |
| aktif ↔ pasif → checkedIn/checkedOut | convex/visitors.ts:560 | yeniden aktivasyonda bitiş doğrulanır |
| herhangi → checkedOut | convex/visitors.ts:614 | yetki; tekrar güvenli |
| aktif ve bitiş geçti → expired | convex/visitors.ts:662 | cron 5dk |

Okuyan kopyalar: convex/lib/visitorStatus.ts:39; src/components/visitors/lib/status.ts:4; mobile/lib/models/visitor.dart:5,54. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 7. Ziyaretçi kart sahipliği

Durumlar: ön kayıt yer tutucu/atanmış/iade edilmiş. Saklama: `employees.cardNumber (normal/PRE:/IADE:)` (convex/schema.ts:100). Zorlama: mutation kart çakışma ve eski kimlik korumaları.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| yok → PRE: | convex/mobileVisitors.ts:107 | host+request doğrulanır |
| PRE → gerçek kart | convex/visitors.ts:556 | ilk aktivasyon koşulu |
| gerçek → IADE: | convex/visitors.ts:636 | aktif kart iade edilemez |
| kart değişimi → eski cihaz kartı silinir | convex/visitors.ts:538 | patch öncesi snapshot |

Okuyan kopyalar: src/components/visitors/VisitorSlideOverPanel.tsx:63; convex/lib/grantStatus.ts:176; mobil kart yazmaz. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 8. Mobil ziyaretçi daveti ve tekrar

Durumlar: oluşturma niyeti/bilinmeyen sonuç/makbuz alındı; düzenlenebilir/kilitli/iptal. Saklama: `employees.mobileVisitorRequestId/Fingerprint/hostEmployeeId/notice` (convex/schema.ts:144). Zorlama: mutation sahiplik+fingerprint; UI epoch ve kalıcı niyet.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| yok → preRegistered | convex/mobileVisitors.ts:105 | idempotent requestId |
| ön kayıt → düzenlendi | convex/mobileVisitors.ts:124 | ownInvitation+editableInvitation |
| ön kayıt → checkedOut | convex/mobileVisitors.ts:138 | yalnız kendi daveti |
| yanıt kayıp → makbuz sorgula | convex/mobileVisitors.ts:23 | aynı host |

Okuyan kopyalar: mobile/lib/providers/visitor_provider.dart:20,48; mobile/lib/models/visitor.dart:185; web ilk kapı ataması convex/visitors.ts:491. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 9. Ziyaretçi fiziksel konumu

Durumlar: unknown/inside/outside; aynı anda zıt yön unknown. Saklama: `cardReadings accessTime/accessStatus/direction (türetilir)` (convex/lib/visitorPresence.ts:10). Zorlama: yalnız saf okuma; saklanan status ile eş tutulmaz.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| son izinli entry → inside | convex/lib/visitorPresence.ts:15 | zaman karşılaştırması |
| son izinli exit → outside | aynı fonksiyon |  |
| kanıt yok/çelişki → unknown | convex/lib/visitorPresence.ts:20 | ret ve bilinmeyen yön elenir |

Okuyan kopyalar: convex/lib/mobileVisitors.ts:85; src/components/visitors/lib/status.ts; mobile/lib/models/visitor.dart:7. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 10. Ziyaretçi cihaz kanıtı

Durumlar: pending/applied/failed/unknown; sınırlı okuma bounded. Saklama: `grant ve operasyon satırlarından hesaplanan sync.status` (convex/lib/mobileVisitors.ts:1). Zorlama: okuma izdüşümü (projection); ayrı saklanan visitor enum yok.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| güncel operasyon kanıtı → pending/failed/applied | convex/lib/mobileVisitors.ts visitorSyncEvidence | hedef ve kart eşleştirme |
| kanıt yetersiz → unknown | aynı fonksiyon |  |

Okuyan kopyalar: mobile/lib/models/visitor.dart:9,99; web ziyaretçi detayları. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 11. Ziyaretçi saklama/imha

Durumlar: süresiz/30..3650 gün; aday/zamanlandı/yeniden kontrol/silindi/hata kaydı. Saklama: `projectPrivacySettings.visitorRetentionDays; employees bitiş+pasif` (convex/schema.ts:1483). Zorlama: mutation tekrar kontrolü; batch bütçesi.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| ayar → sonlu/süresiz | convex/privacyRetention.ts:131 | admin.manage |
| süresi dolmuş pasif → silme işi | convex/privacyRetention.ts:379 | predicate |
| iş → silindi veya atlandı | convex/privacyRetention.ts:392,407 | güncel politika tekrar okunur |

Okuyan kopyalar: web Gizlilik ayarları; convex/privacyRetention.ts:144 önizleme; mobil kayıt kaybolur. Bulgu: C-05. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 12. Kullanıcı doğrulama

Durumlar: legacy undefined=izinli; false=doğrulanmamış; true=doğrulanmış; token yok/geçerli/süresi dolmuş. Saklama: `users.verified/setupToken/tokenExpiresAt/emailVerificationTime` (convex/schema.ts:22). Zorlama: schema boolean; auth guard ve mutation.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| signup → false | convex/auth.ts profile |  |
| false → token | convex/emailVerification.ts:51 | limiter+prepareVerificationToken |
| token → verified | convex/emailVerification.ts:83 | token ve süre |
| expired token → yok | convex/emailVerification.ts:135 | günlük cron; batch |

Okuyan kopyalar: src/pages/VerifyEmail.tsx:25; src/providers veya auth context; mobil ayrı employeeAuth alanı. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 13. Hesap dondurma ve bitiş

Durumlar: etkin/donmuş/süresi dolmuş; donmuş ve süresi dolmuş birlikte olabilir. Saklama: `users.disabledAt/disabledBy/accessExpiresAt/accessExpiryJobId` (convex/schema.ts:33). Zorlama: mutation hedef ve son admin kontrolü; auth accessBlockReason.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| etkin → donmuş | convex/accountAccess.ts:17 | guard+oturum iptali |
| donmuş → çözülmüş | convex/accountAccess.ts:32 | kalan oturum engeli |
| bitiş ekle/değiştir/kaldır | convex/accountAccess.ts:54 | eski işi cancel |
| zamanı gelen → revoke | convex/accountAccess.ts:66 | expectedExpiresAt eşleşmesi |

Okuyan kopyalar: src/components/admin/components/AccountAccessActions; convex/lib/auth.ts:24; SMTP action internal yeniden kontrolde eksik. Bulgu: C-04. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 14. Oturum iptal zinciri

Durumlar: geçerli/iptal eşiğinden eski/silinmiş; devam işi. Saklama: `users.sessionsRevokedThrough; authSessions/authRefreshTokens varlığı` (convex/schema.ts:32). Zorlama: mutation cutoff; her istekte session+expiration+watermark kontrolü.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| revoke → watermark + ilk 50 oturum sil | convex/lib/sessionRevoke.ts:16 |  |
| tokenlar → 100 lük silme/devam | convex/lib/sessionRevoke.ts:6 |  |
| eski JWT → reddet | convex/lib/auth.ts:21 | DB oturum ve cutoff kontrolü |

Okuyan kopyalar: web currentUser; mobil employeeSessions farklı kimlik alanı; worker iptal devamları convex/accountAccess.ts:79. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 15. Platform ve proje rolleri

Durumlar: platform super_admin/project_admin/project_user; proje admin/hr/security/technician/viewer; varsayılan/özel yetki. Saklama: `users.role; userProjects.role; projectRolePermissions.permissions` (convex/schema.ts:39). Zorlama: schema union; mutation admin.manage; admin rolü kilitli; okuma kapıları farklı.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| atanmış → yeni platform rolü | convex/users.ts:85,131 | superAdmin |
| üyelik rolü → yeni rol | convex/roles.ts:182,208 | son aktif admin koruması |
| varsayılan ↔ özel | convex/roles.ts:113,135 | normalize; admin.manage yalnız admin |

Okuyan kopyalar: convex/lib/roleCatalog.ts; src rol/yetki hooks; mobil employee kimliği kullanır, platform rol düzenlemez. Bulgu: C-02. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 16. Proje üyeliği ve onboarding

Durumlar: üye değil/üye; yeni kullanıcı/projesi var; owner ayrı meta veri. Saklama: `userProjects satır varlığı; projects.ownerId; users.firstCompanyName` (convex/schema.ts:63). Zorlama: mutation duplicate sorgusu; Convex transaction.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| ilk doğrulanmış hesap → proje+admin üyelik | convex/onboarding.ts:18,56,70 | mevcut üyelik kontrolü |
| davet → üyelik | convex/invites.ts:338 | aynı transaction duplicate kontrolü |
| platform rol düzenleme → ekle/sil | convex/users.ts:122,126 | superAdmin |

Okuyan kopyalar: src UserSetup ve proje seçimi; convex/userProjects.ts:4; mobil çalışan projesi. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 17. Proje aktiflik ve silme

Durumlar: aktif/pasif/legacy undefined/silinmiş. Saklama: `projects.isActive; satır varlığı` (convex/schema.ts:83). Zorlama: schema boolean; superAdmin mutation; aktiflik genel yetki kapısı değil.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| yok → aktif/pasif | convex/projects.ts:68 |  |
| aktif ↔ pasif | convex/projects.ts:104 | superAdmin |
| var → silindi | convex/projects.ts:129 | blocker+501 sınırı; audit korunur |

Okuyan kopyalar: convex/projects.ts:31; src admin proje rozetleri; getProjectIdsForUser aktifliği elemez. Bulgu: C-06. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 18. Davet ve reset tüketimi

Durumlar: açık/kullanıldı/süresi dolmuş; invite/reset; türsüz legacy=invite. Saklama: `invites.used/type/expiresAt/token/role` (convex/schema.ts:1492). Zorlama: schema tür union; mutation token+süre+yaratanın güncel yetkisi.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| oluştur → açık, eski aynı amaç → used | convex/invites.ts:125,132 |  |
| açık → consumed | convex/invites.ts:296,347 | reset nested auth store aynı transaction |
| saat geçer → expired | convex/invites.ts:26 | türetilmiş; cron yok |

Okuyan kopyalar: src/pages/UserSetup.tsx; src/components/admin/AdminUsersPanel; verify query yaratanın yetkisini kontrol etmez; consume eder. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 19. Davetle hesap devralma

Durumlar: none/claimable/taken; flow signUp/signIn. Saklama: `authAccounts/users temiz hesap + action geçişi` (convex/invites.ts:179). Zorlama: query ve temizlik mutation kontrolü var; credential yazımı ayrı transaction.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| none → signUp yönlendir | convex/invites.ts:245 |  |
| claimable → temizle → şifre değiştir → invalidate | convex/invites.ts:249,250,254 | son credential yazımında token/fresh kontrolü yok |
| taken → hata | convex/invites.ts:246 |  |

Okuyan kopyalar: src/pages/UserSetup.tsx; mobil bu davet yolunu kullanmaz. Bulgu: C-01. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 20. Şifre kurulum/reset

Durumlar: token yok/geçerli/expired/consumed; success/error. Saklama: `employeeAuth.setupToken/expiresAt/passwordHash; invites reset` (convex/actions/setPassword.ts:12). Zorlama: nihai consumeSetupToken mutation; bcrypt öncesi query yalnız optimizasyon.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| token → hash hazırlanır → atomik tüket | convex/actions/setPassword.ts:33,36 | nihai yeniden kontrol |
| reset invite → yeni auth şifre+revoke+used | convex/invites.ts:286 | nested mutation |

Okuyan kopyalar: web şifre sayfaları; mobile auth repository; adminSetEmployeePassword internal farklı yol. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 21. İstek kotası

Durumlar: token var/yetersiz/doluyor; fixed window açık/doldu. Saklama: `rateLimiter component state` (convex/lib/rateLimit.ts:4). Zorlama: component mutation; throws ve anahtarlandırma.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| istek → kota harca | convex/emailVerification.ts:33; convex/invites.ts:121 |  |
| zaman → kota yenilenir | convex/lib/rateLimit.ts:6 | token bucket/fixed window |

Okuyan kopyalar: web hata sunumu; component iç şeması bu repoda yok; phase alanları uygulama işi olmayabilir. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 22. Alarm onay ve çözüm

Durumlar: onaysız/onaylı × açık/çözülmüş; category alarm/exception vb.; info/warning/critical. Saklama: `deviceEvents.ackedAt/ackedBy/resolvedAt/category/severity` (convex/schema.ts:697). Zorlama: schema enum; acknowledge mutation izin+category+idempotence.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| alarm → onaylı | convex/alarms.ts:96 | alarms.ack; ackedAt varsa skip |
| offline → resolved | convex/devices.ts:1103; convex/lib/deviceConnection.ts:71 | cihaz dönüşü |

Okuyan kopyalar: src alarm merkezi; convex/alarms.ts:70 açık sayacı ackedAt bazlı; resolved ayrı eksen, kapandı=onaylandı değil. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 23. Alarm e-posta teslimi

Durumlar: queued/sending/retryScheduled/sent/failed/skipped. Saklama: `deviceEvents.alarmEmailStatus/Attempts/RetryAt/Content/Recipients` (convex/schema.ts:744). Zorlama: schema enum; claim mutation deneme ve ön durum; sonuç aynı attempt; provider idempotency.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| taze olay → queued | convex/lib/alarmNotify.ts:51 | debounce+ayar |
| queued/retryScheduled → sending/skipped | convex/alarms.ts:188 | atomic claim |
| sending → sent/retryScheduled/failed | convex/alarms.ts:220 | güncel attempt |
| 10dk sending → retry/failed | convex/alarms.ts:241 | watchdog; en çok 3 |

Okuyan kopyalar: src alarm ayarları son gönderim; convex/actions/sendAlarmEmail.ts:42 sabit alıcı+event idempotency; cron yerine scheduler. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 24. Alarm ve bildirim tercihleri

Durumlar: kapalı/açık × warning/critical; bağımsız legacy/rapor/geç/sistem tercihleri. Saklama: `alarmSettings.emailEnabled/minSeverity; notificationSettings dört boolean; generalSettings.notificationsEnabled` (convex/schema.ts:764). Zorlama: schema boolean; mutation admin.manage; bazı tercihler yalnız kayıt.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| ayar → açık/kapalı | convex/alarms.ts:134; convex/settings.ts:127,130 |  |
| test → queued | convex/alarms.ts:160 | 5dk limit |

Okuyan kopyalar: src/components/settings/sections/NotificationSettings.tsx:22,29 etkisiz sistem tercihini açıkça anlatır; convex/lib/lateReading.ts:50; mobil bu ayarları yazmaz. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 25. Proje SMTP ve e-posta action

Durumlar: kayıtsız/eksik/tam; aktif/pasif; test başarı/hata geçici sonuç, saklanan doğrulandı yok. Saklama: `mailSettings.isActive/smtpPassword/alan tamlığı` (convex/schema.ts:1147). Zorlama: mutation admin.manage; şifre değişimi şartı; sonuç UI.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| kaydet → aktif/pasif config | convex/mailSettings.ts:95,102,111 | requireCaller |
| tam ve aktif → delivery config | convex/mailSettings.ts:130 |  |
| test → ok/error | convex/actions/projectMail.ts:55 | sonuç kalıcı değil |
| sil → kayıtsız | convex/mailSettings.ts:51 |  |

Okuyan kopyalar: src SMTP ayar formu; convex/actions/sendEmail.ts:40 varsayılan provider; getForDelivery aktif değilse fallback. Bulgu: C-04. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 26. Dosya yükleme sahipliği

Durumlar: URL üretildi/yüklendi/sahiplenildi/bağlandı/24saat artık/silindi. Saklama: `pendingUploads satır varlığı; users.photoUrl/employees.photoStorageId` (convex/schema.ts:1449). Zorlama: mutation owner kontrolü; storage id varlık kontrolü.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| URL → storage | convex/files.ts:18 | auth |
| storage → pending | convex/files.ts:36 | ilk sahiplenen |
| pending → profil | convex/files.ts:51,55 | sahiplik |
| eski pending → sil/yalnız pending temizle | convex/files.ts:92,105 | bağlı kullanım tekrar okunur |

Okuyan kopyalar: src/components/profile/ProfilePhoto.tsx:30,34,35; employee foto hook; mobil ziyaretçi dosya yazmaz. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 27. Denetim kaydı ve maskeleme

Durumlar: create/update/delete; ham/minimize edilmiş; isim maskeli/açık. Saklama: `auditLog.action/oldValue/newValue/searchText; privacy aiMaskNames` (convex/schema.ts:1411). Zorlama: schema action union; mutation writeAudit ve silmede/migration minimization.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| işlem → audit insert | convex/lib/audit.ts |  |
| employee silme → audit minimizasyonu | convex/dataMigrations.ts:57; convex/lib/auditPrivacy.ts |  |
| masking açık ↔ kapalı | convex/privacyRetention.ts:42 | admin.manage |

Okuyan kopyalar: src AuditLog; convex/auditLog.ts; mobil ziyaretçi verisi dönen alanlar ayrı maskeleme. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 28. Gizlilik ve biyometri anahtarı

Durumlar: legacy default açık/yeni açık/kapalı; saklama süresiz veya 1825..3650; isim maskeli/açık. Saklama: `projectPrivacySettings.biometricEnabled/ChangedAt/Reason; cardReadingRetentionDays/aiMaskNames` (convex/schema.ts:1475). Zorlama: schema boolean; mutation admin.manage+imha sürerken açma engeli.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| açık ↔ kapalı | convex/privacyBiometric.ts:45 | aktif imha varsa açılamaz |
| retention/mask → yeni değer | convex/privacyRetention.ts:30,42 | sınır |
| proje yarat → true | convex/projects.ts:77; convex/onboarding.ts:64 |  |

Okuyan kopyalar: web Gizlilik; convex/lib/privacySettings.ts:15 gerçek default; mobil yalnız gerekli modül flag. Bulgu: C-07. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 29. Retention / migration / maintenance zinciri

Durumlar: operations/events/access; aşama 0..14; batch 0..19; bitti/devam/atlandı; dryRun/yaz. Saklama: `scheduler args stage/batch/cursor/runAt; migrations component` (convex/privacyRetention.ts:202). Zorlama: internal mutation; stage doğrulama; component migration ilerlemesi.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| cron → ilk stage | convex/privacyRetention.ts:239 |  |
| batch → aynı/sonraki stage | convex/privacyRetention.ts:215 | bütçe ve kalan aşama rezervi |
| migration → sayfalama/bitti | convex/migrations.ts:125,170 |  |
| maintenance → kuyruk silindi | convex/maintenance.ts:4 | internal; çalıştırılmadı |

Okuyan kopyalar: web doğrudan yönetim yok; convex/dataMigrations.ts component durumları kaynak dışı; bridge çağrıları yalnız operasyon yüzeyleri. Bulgu: C-05. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 30. Genel ayarlar ve IDE varsayılanları

Durumlar: satır yok/default veya kayıtlı; dark/light; kimlik yeni cihaza kopyalanır. Saklama: `generalSettings.darkMode/timezone/dateFormat/systemLanguage; ideDefaults singleton` (convex/schema.ts:1125). Zorlama: mutation admin.manage / superAdmin; string enum zorlaması yok.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| yok → ayar satırı | convex/settings.ts:83 |  |
| ayar → patch | convex/settings.ts:80 |  |
| IDE yok/default → kayıtlı/güncel | convex/ideDefaults.ts:49,58 | first singleton transaction |

Okuyan kopyalar: src/components/settings/sections/GeneralSettings.tsx; convex/settings.ts:154 dark mode; bridge cihazdaki kopyayı okur, singleton dinamik değil. Bulgu: —. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

### 31. Sohbet mesaj rolü ve konuşma varlığı

Durumlar: user/assistant; yok/var/silinmiş; pending/error kalıcı alan yok. Saklama: `chatConversations.messages[].role; satır varlığı` (convex/schema.ts:1211). Zorlama: schema role union; görünür üretim insert yolu bulunmadı.

| Kaynak → hedef | Yazan/hesaplayan yol | Ön-koşul |
|---|---|---|
| var → silindi | convex/projects.ts:126 | proje cleanup |
| yok → var | taramada üretim writer bulunmadı |  |

Okuyan kopyalar: asistan action çıktıları ile bu tabloyu aynı sanmamak gerekir; schema dışında aktif chatConversations akışı bulunmadı. Bulgu: C-08. Dosya düzeyindeki tüm aday yazımlar için Ek B, kopyalar için Ek C esas alınır; yukarıdaki tablo yürütülebilir giriş ve ortak yardımcıları gösterir.

## Bulgular

| ID | Şiddet | Makine | Başlık | Kanıt dosya:satır | Senaryo | Önerilen düzeltme |
|---|---|---|---|---|---|---|
| C-01 | critical | 19 | Davet tüketiminden sonra hesap şifresi yazılabilir | convex/invites.ts:249,250,254 | Aynı açık davetle iki claim action’ı temizlikten geçer; ilki şifreyi kurar, kullanıcı giriş yapıp consume ile admin üyelik alır; bekleyen ikinci action tokenı yeniden kontrol etmeden şifreyi değiştirir ve oturumları kapatır. | Şifre yazımı, fresh-account koşulu, davet rezervasyonu/tüketimi ve oturum iptalini aynı mutation içinde yap. |
| C-02 | high | 1,15 | employees.view kaldırılmış üyeye kural listesinden kişi e-postası döner | convex/lib/accessRuleRead.ts:10,32,34 | Özel rolün employees.view yetkisi kaldırılır; üyelik korunur; accessRules.list çağrısı ad, soyad, e-posta döndürmeye devam eder. | Kişi birleşimini employees.view ile sınırla veya sadece izinli anonim üyelik izdüşümünü döndür. |
| C-03 | high | 3 | Gecikmiş toplu sonuç yeni grant durumunu ezer | convex/lib/hikSyncEmployee.ts:387,590; convex/lib/grantStatus.ts:148,158 | Eski gateway action sonucunu bekletirken yeni hak silme/değiştirme tamamlanır; eski effective sonucu lastOperationId/sürüm karşılaştırması olmadan gelir ve yeni removed/pending durumunu effective yapar. | Her sonuçta başlangıç revision/operation kimliğini taşı ve upsert içinde güncel nesille eşleştir. |
| C-04 | high | 13,25 | SMTP action son yazımında dondurulmuş hesabı reddetmez | convex/mailSettings.ts:26,29; convex/actions/projectMail.ts:27 | Yetkili save action başlar; kullanıcı freezeUser ile dondurulur; şifreleme sonrası internal upsert kullanıcı satırını yeniden okur ama disabledAt/expiry/session kontrol etmeden ayarı kaydeder. | Internal commit kapısında güncel verified, accessBlockReason ve mümkünse oturum/iptal neslini doğrula. |
| C-05 | high | 11,29 | Başarısız saklama silmeleri sonraki projeleri aç bırakabilir | convex/privacyRetention.ts:362,374,383,395 | İlk projenin yeterince eski kaydı removeEmployeeRecord hatası yüzünden silinmez; günlük zincir aynı projenin başından başlar, 20 çağrı bütçesini bitirir; sonraki projelerin geçmiş ziyaretçileri sürekli tutulur. | Proje ilerlemesini günler arasında sakla; hata kayıtlarını ayrı retry kuyruğuna taşı; proje başına adil bütçe ayır. |
| C-06 | medium | 17 | Pasif proje genel erişim kapısını kapatmıyor (şüpheli, politika doğrulanmadı) | convex/projects.ts:104; convex/lib/auth.ts:102; convex/lib/permissions.ts:88 | Super admin isActive=false yapar; listActive projeyi gizler ama doğrudan API üyelik+rol üzerinden işlem kabul eder. Eğer pasife alma askıya alma demekse durum ile yetki ayrışır. | Pasifliğin anlamını netleştir; askıya alma ise ortak project gate’te ve cihaz erişim kararında zorla. |
| C-07 | low | 28 | Schema yeni projede biyometri varsayılanını yanlış anlatıyor | convex/schema.ts:1474; convex/lib/privacySettings.ts:15; convex/onboarding.ts:64 | Schema yorumu yeni projenin kapalı başladığını söyler; gerçek oluşturma true yazar; yorumdan politika çıkaran geliştirme yanlış ön-kabul yapar. | Schema yorumunu gerçek onaylı varsayılanla eşitle. |
| C-08 | low | 31 | chatConversations için aktif oluşturma yolu bulunamadı | convex/schema.ts:1211; convex/lib/adminGuards.ts:74; convex/projects.ts:126 | Uygulama sohbeti kullanıldığında tabloyu dolduran üretim writer taramada bulunmuyor; tablo schema ve silme listesinde kalmış. | Kullanılmayan tabloyu belgele/kaldır veya kalıcılık isteniyorsa sahiplik kontrollü yazımı bağla. |

### Kanıt alıntıları ve sınırlar

C-01 kod sırası yarışa izin verir; tokenı bilmeyen rastgele kullanıcının hesabı devraldığı iddia edilmez. İkinci action’ın başta yetkili olması, davet sonradan tüketildiğinde credential yetkisinin devam etmesini haklı kılmaz. Reset consume yolu aynı soruna sahip değildir: auth store çağrıları ve used patch aynı mutation içindedir.

**C-01 — convex/invites.ts:249**

```ts
249:     await ctx.runMutation(internal.invites.resetClaimedAccount, { userId: state.userId, token: args.token });
250:     await modifyAccountCredentials(ctx, {
254:     await invalidateSessions(ctx, { userId: state.userId });
```

**C-02 — convex/lib/accessRuleRead.ts:32**

```ts
32:                   firstName: employee.firstName,
33:                   lastName: employee.lastName,
34:                   email: employee.email,
```

**C-03 — convex/lib/grantStatus.ts:155**

```ts
155:   const value = { ...args, ruleIds: [...new Set(ruleIds)], departmentId: employee ? employee.departmentId : existing?.departmentId,
157:     appliedAt: args.state === "effective" ? now : existing?.appliedAt, updatedAt: now };
158:   if (existing) await ctx.db.patch(existing._id, value);
```

**C-04 — convex/mailSettings.ts:26**

```ts
26:   const user = await ctx.db.get(callerId);
27:   if (!user) throw new ConvexError("Giriş yapmanız gerekiyor");
28:   await requirePermission(ctx, user, projectId, "admin.manage");
```

**C-05 — convex/privacyRetention.ts:383**

```ts
383:     const batch = args.batch + 1;
384:     if (batch < MAX_CHAIN_LENGTH) await ctx.scheduler.runAfter(0, internal.privacyRetention.purgeVisitors, {
385:       stage: args.stage, batch, runAt: args.runAt, visitorProjectId: projectId, ...(cursor && days !== null ? { cursor, days } : {}),
```

**C-06 — convex/lib/permissions.ts:76**

```ts
76:   if (isSuperAdmin(user)) return new Set(PERMISSIONS);
78:   const role = await getProjectRole(ctx, user, projectId);
79:   return role ? await getRolePermissions(ctx, projectId, role) : new Set();
```

**C-07 — convex/schema.ts:1473**

```ts
1473:   // convex/lib/privacySettings.ts DEFAULT_PRIVACY): biyometri açık, saklama süresiz,
1474:   // asistan isimleri maskeli. Yeni projeler biyometri KAPALI başlar.
1475:   projectPrivacySettings: defineTable({
```

**C-08 — convex/lib/adminGuards.ts:74**

```ts
74:   { table: "chatConversations", index: "by_project", label: "Sohbetler", policy: "delete" },
```

C-02 için üyelik düzeyinde okuma helper yorumunda bilinçli tercih olarak yazılmıştır; raporun itirazı kural meta verisi okunması değil, ayrı employees.view izni kaldırıldığında kişisel alanların da dönmesidir. Proje yöneticisi dışındaki rollere admin.manage atanması normalizeRolePermissions tarafından elenir; bu konuda yükseltme bulgusu yoktur. setMemberRole son yöneticiyi düşürmez, reset consume yaratanın güncel admin.manage yetkisini tekrar denetler.
C-03 tekil operasyon ACK’lerinde lastOperationId koruması bulunduğu halde ortak upsert’te yoktur; gateway action’dan toplu çağrı bulunduğu için yalnız teorik internal API açığı değildir. Fiziksel kapının yanlış açıldığını bu statik kanıtla ileri sürmüyoruz; teslim rozetinin yanlış başarılı duruma dönmesi high sınıfıdır.
C-05 için somut silme engeli örneği convex/lib/employeeCascade.ts:121: `if (departmentHistory.length > 200) throw new ConvexError(...)`; ziyaretçi satırına legacy/import yoluyla bu geçmişin bağlı olması silmeyi sürekli geri alır. Bu verinin üretimde bulunduğu doğrulanmadı; kodun bu girişteki geçişi statik olarak doğrulanabilir. C-05 tek başına yüksek hacim gecikmesi değil, silinmeyen ilk proje adaylarının her gün tekrar bütçeyi tüketmesi senaryosudur. removeRetainedVisitor hatayı audit edip aday kaydı tutar; bu durumda tamamlanma/karantina işareti yoktur.
C-08 yokluk taramasıdır; component veya repo dışından doğrudan veri yazıldığı doğrulanmadı. PendingUploads için “ilk sahiplenen” politikası bilinçli schema yorumudur; yükleme URL’siyle upload kimliğinin kriptografik bağı bulunmaması bu raporda kanıtsız hesaplar arası sızıntı olarak sınıflandırılmadı.

### Cron, HTTP, bridge ve mobil uçlar

- Cron ziyaretçi erişimini 5 dakikada bir kapatır; email tokenı 03:00 UTC temizler, pendingUploads 04:00 UTC temizler; retention operations/events/access bağımsız günlük zincirlerdir. Alarm teslimi cron değil 0/5/10 dakika scheduler işleriyle ilerler. Davet expiry yazımı/temizleme cron’u yoktur; expiresAt okuma sırasında değerlendirilir.
- HTTP `/card-reader`, `/ide-bridge/event`, `/ide-bridge/ack`, `/hik-bridge/ack`, `/hik-gateway/device-status` ortak A sınırıdır: kimlikli olay → alarm bildirimi/ziyaretçi konumu/erişim sonucu. Alan C için ayrı ziyaretçi veya kullanıcı yazan HTTP endpoint bulunmadı; doğrudan mobil mutation’lar mobileVisitors.ts içindedir. HTTP raw status alanları iş durumu sayılmaz.
- infra/ ve bridge/ tarandı; doğrudan kullanıcı/davet/SMTP durum yazımı bulunmadı. Cihaz ACK/event yolları grantStatusForOperation, notifyAlarmIfNeeded ve deviceConnection üzerinden C durumlarını etkiler. Operasyon kuyruğunun tüm durumları Alan A’ya aittir; burada yalnız C’ye giriş sınırı incelendi.
- Mobil VisitorAccessStatus dört değerle backend sunumuna uyumludur. Schema checkedIn saklar ama backend isActive’den active üretir; bu bilinçli çeviri bir enum ayrışması değildir. Mobil Presence üç, Sync dört değerle uyumludur; bilinmeyen protokol değeri ProtocolError üretir. Provider epoch/session ve request owner ile eski yanıtı eler, requestId üzerinden kayıp oluşturma yanıtını makbuzla kurtarır.
- Web form kaydetme/butonları dirty/loading/isSaving/confirmation ile; ziyaretçi paneli checkout/release/remove teyitleriyle; ayar formları remoteChanged/failed ile ek geçici UI durumları taşır. Bunlar kalıcı yaşam döngüsü değildir; ilgili makinelere bağlı alt eksenler ve tam satır envanteri Ek C’de gösterilir. Bildirim UI’si sistem tercihinin gönderimi durdurmadığını açıkça söyler; bu yüzden etkisiz tercih ayrıca yanlış teslim durumu bulgusu sayılmadı.

## Ek A — İlgili schema tablolarının bütün alanları

Aşağıda ilgili defineTable blokları validator ve index’leriyle kaynak satır numarası korunarak verilmiştir. employees ve doors/deviceEvents ortak tabloları C alanlarını bağlamıyla gösterir; diğer alanlarının Alan A/B iş kuralları hakkında hüküm verilmez. authTables ve migrations/rateLimiter component iç tabloları bu schema’da tanımlı değildir; repo dışı değer kümesi uydurulmadı.

### users — convex/schema.ts:22

```ts
22:   users: defineTable({
23:     // Convex Auth core fields
24:     name: v.optional(v.string()),
25:     image: v.optional(v.string()),
26:     email: v.optional(v.string()),
27:     emailVerificationTime: v.optional(v.number()),
28:     phone: v.optional(v.string()),
29:     phoneVerificationTime: v.optional(v.number()),
30:     isAnonymous: v.optional(v.boolean()),
31:     // Custom NGS fields
32:     sessionsRevokedThrough: v.optional(v.number()),
33:     disabledAt: v.optional(v.number()),
34:     disabledBy: v.optional(v.id("users")),
35:     accessExpiresAt: v.optional(v.number()),
36:     accessExpiryJobId: v.optional(v.id("_scheduled_functions")),
37:     fullName: v.optional(v.string()),
38:     photoUrl: v.optional(v.string()),
39:     role: v.optional(
40:       v.union(
41:         v.literal("super_admin"),
42:         v.literal("project_admin"),
43:         v.literal("project_user")
44:       )
45:     ),
46:     // E-posta doğrulama (self-signup): verified=false olan kullanıcı login olamaz.
47:     // Eski kullanıcılar undefined → guard yalnızca === false olanları engeller.
48:     // NOT: "emailVerified" adı kullanılamaz — Convex Auth onu profile()'dan ayıklayıp
49:     // kendi iç mantığında (emailVerificationTime) kullanır, users'a yazmaz.
50:     verified: v.optional(v.boolean()),
51:     // Kayıt formundaki firma adı; ilk doğrulanmış girişte projeye dönüştürülür.
52:     firstCompanyName: v.optional(v.string()),
53:     setupToken: v.optional(v.string()),
54:     tokenExpiresAt: v.optional(v.string()),
55:     updatedAt: v.optional(v.string()),
56:   })
57:     .index("email", ["email"])
58:     .index("by_setup_token", ["setupToken"])
59:     .index("by_tokenExpiresAt", ["tokenExpiresAt"])
60:     .index("by_role", ["role"])
61:     .index("by_photo_url", ["photoUrl"]),
62: 
```

### userProjects — convex/schema.ts:63

```ts
63:   userProjects: defineTable({
64:     userId: v.id("users"),
65:     projectId: v.id("projects"),
66:     // Proje rolü (docs/roles/PLAN.md). Yoksa users.role'den türetilir (lib/permissions.ts).
67:     role: v.optional(projectRoleValidator),
68:     createdAt: v.optional(v.string()),
69:   })
70:     .index("by_user", ["userId"])
71:     .index("by_project", ["projectId"]),
72: 
73:   // Proje bazında rol yetkisi değişikliği. Satır yoksa rol varsayılanı (ROLE_DEFAULTS) geçerli;
74:   // "admin" rolü için satır yazılmaz (kilitli).
```

### projectRolePermissions — convex/schema.ts:75

```ts
75:   projectRolePermissions: defineTable({
76:     projectId: v.id("projects"),
77:     role: projectRoleValidator,
78:     permissions: v.array(permissionValidator),
79:     updatedAt: v.number(),
80:     updatedBy: v.id("users"),
81:   }).index("by_projectId_and_role", ["projectId", "role"]),
82: 
```

### projects — convex/schema.ts:83

```ts
83:   projects: defineTable({
84:     name: v.string(),
85:     description: v.optional(v.string()),
86:     ownerId: v.optional(v.id("users")),
87:     isActive: v.optional(v.boolean()),
88:     createdAt: v.optional(v.string()),
89:     updatedAt: v.optional(v.string()),
90:   }),
91: 
92:   // ═══════ 2 · ÇALIŞANLAR · KİMLİK DOĞRULAMA · ORGANİZASYON ══════════════
```

### employees — convex/schema.ts:93

```ts
93:   employees: defineTable({
94:     hasDepartmentHistory: v.optional(v.boolean()),
95:     projectId: v.optional(v.id("projects")),
96:     firstName: v.string(),
97:     lastName: v.string(),
98:     email: v.string(),
99:     tcNo: v.optional(v.string()),
100:     cardNumber: v.string(),
101:     hikCardless: v.optional(v.boolean()),
102:     payrollCode: v.optional(v.string()),
103:     departmentId: v.optional(v.id("departments")),
104:     companyId: v.optional(v.id("companies")),
105:     positionId: v.optional(v.id("positions")),
106:     shiftId: v.optional(v.id("shifts")),
107:     accessRuleId: v.optional(v.id("accessRules")),
108:     photoUrl: v.optional(v.string()),
109:     photoStorageId: v.optional(v.id("_storage")),
110:     isActive: v.optional(v.boolean()),
111:     employmentEndDate: v.optional(v.string()),
112:     terminationType: v.optional(v.union(
113:       v.literal("resignation"), v.literal("employerTermination"),
114:       v.literal("retirement"), v.literal("contractEnd"), v.literal("other"), v.literal("transfer"),
115:     )),
116:     terminationReason: v.optional(v.string()),
117:     sgkExitCode: v.optional(v.string()),
118:     terminatedAt: v.optional(v.string()),
119:     terminatedBy: v.optional(v.id("users")),
120:     transferredFromEmployeeId: v.optional(v.id("employees")),
121:     transferredToEmployeeId: v.optional(v.id("employees")),
122:     transferredCardNumber: v.optional(v.string()),
123:     notes: v.optional(v.string()),
124:     shift: v.optional(v.string()),
125:     hourlyRate: v.optional(v.number()),
126:     monthlySalary: v.optional(v.number()),
127:     // --- Ziyaretçi modülü (geçici erişim) ---
128:     // Bu kayıt bir ziyaretçi mi? true ise Kişiler listesinden gizlenir, Ziyaretçiler
129:     // sekmesinde görünür. Cihaz sync / kart eşleştirme / canlı izleme aynen çalışır.
130:     isVisitor: v.optional(v.boolean()),
131:     // ISO UTC — bu andan sonra erişim cron ile otomatik iptal (isActive=false → desync).
132:     accessExpiresAt: v.optional(v.string()),
133:     // Ziyaret başlangıcı (log/raporlama; cihaz erişimini etkilemez).
134:     accessStartsAt: v.optional(v.string()),
135:     visitorCompany: v.optional(v.string()),
136:     visitorPhone: v.optional(v.string()),
137:     visitPurpose: v.optional(v.string()),
138:     // Ziyaret edilen personel.
139:     hostEmployeeId: v.optional(v.id("employees")),
140:     mobileVisitorRequestId: v.optional(v.string()),
141:     mobileVisitorRequestFingerprint: v.optional(v.string()),
142:     mobileVisitorNoticeUrl: v.optional(v.string()),
143:     mobileVisitorNoticeVersion: v.optional(v.string()),
144:     // UI yaşam döngüsü; cihaz erişimini isActive belirler.
145:     visitorStatus: v.optional(
146:       v.union(
147:         v.literal("preRegistered"),
148:         v.literal("checkedIn"),
149:         v.literal("checkedOut"),
150:         v.literal("expired"),
151:       ),
152:     ),
153:     createdAt: v.optional(v.string()),
154:     updatedAt: v.optional(v.string()),
155:   })
156:     .index("by_active_employment_end", ["isActive", "employmentEndDate"])
157:     .index("by_project", ["projectId"])
158:     .index("by_email", ["email"])
159:     .index("by_card", ["cardNumber"])
160:     .index("by_tc", ["tcNo"])
161:     .index("by_visitor", ["isVisitor"])
162:     .index("by_department", ["departmentId"])
163:     .index("by_company", ["companyId"])
164:     .index("by_position", ["positionId"])
165:     .index("by_photo_storage", ["photoStorageId"])
166:     .index("by_project_visitor", ["projectId", "isVisitor"])
167:     .index("by_project_host_visitor", ["projectId", "hostEmployeeId", "isVisitor"])
168:     .index("by_host_mobile_visitor_request", ["hostEmployeeId", "mobileVisitorRequestId"])
169:     // Ziyaretçi listesi durum filtresi: projede süre aralığına göre cursor tarama (UI audit 2, 06-H1).
170:     .index("by_project_visitor_expiry", ["projectId", "isVisitor", "accessExpiresAt"])
171:     // Bitişi ileri taşınmış ama durumu "expired" kalan ziyaretçiler için ikinci tarama aralığı (06-H1).
172:     .index("by_project_visitor_status_expiry", ["projectId", "isVisitor", "visitorStatus", "accessExpiresAt"])
173:     // Ziyaretçi özeti: projedeki en yakın aktif bitiş, sınırlı taramada (Z-O5); isActive=false
174:     // aralığı ziyaretçi saklama süresi önizleme/imha taramasında da kullanılır (privacyRetention.ts).
175:     .index("by_project_visitor_active_expiry", ["projectId", "isVisitor", "isActive", "accessExpiresAt"])
176:     .searchIndex("search_first_name", { searchField: "firstName", filterFields: ["projectId"] })
177:     .searchIndex("search_last_name", { searchField: "lastName", filterFields: ["projectId"] })
178:     // Expiry cron: isVisitor=true ∧ isActive=true ∧ accessExpiresAt<=now (ISO-UTC sıralanabilir).
179:     .index("by_visitor_active_expiry", ["isVisitor", "isActive", "accessExpiresAt"]),
180: 
```

### doors — convex/schema.ts:304

```ts
304:   doors: defineTable({
305:     name: v.string(),
306:     projectId: v.optional(v.id("projects")),
307:     // Kapının bölgesi (mantıksal alan). Variant 1: panele bağlı kapılar panelin
308:     // bölgesini (device.zoneId) yansıtır; panel taşınınca eşitlenir.
309:     zoneId: v.optional(v.id("zones")),
310:     // Kapıyı kontrol eden fiziksel cihaz/panel (controller). IDE Smart panellerde
311:     // panel device'ı; tek-kapılı cihazlarda da bağlanabilir. Boşsa manuel kapı.
312:     deviceId: v.optional(v.id("devices")),
313:     location: v.optional(v.string()),
314:     doorCode: v.optional(v.string()),
315:     status: v.optional(v.string()),
316:     // IDE Smart aktüatör index'i (io_id 0–3). Diğer markalarda boş.
317:     ioId: v.optional(v.number()),
318:     // Kapıda fiziksel "kapı açıldı" sensörü var mı → panel ACTUATOR{ioId}.REQUIRE_SENSOR_ACTIVATION.
319:     // true = sensör onayı beklenir (1); false = pulse sensör beklemeden tamamlanır (0).
320:     // Boşsa panelin mevcut değerine dokunulmaz. Sensörsüz kapıda false yapılmazsa actuator "busy"de takılır.
321:     requireSensor: v.optional(v.boolean()),
322:     // Okuyucu (Wiegand giriş yüzü) — kapıyla 1:1. Boşsa UI door.name'den türetir.
323:     readerName: v.optional(v.string()),
324:     // Okuyucu yön etiketi (görsel). Boşsa ioId'den türetilir (0=entry,1=exit,diğer=both).
325:     readerDirection: v.optional(
326:       v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
327:     ),
328:     // Hikvision fiziksel kapı numarası (1..N). IDE Smart'ta boş (ioId kullanılır).
329:     // openDoor/setDoorParam ile tutarlı; boşsa 1 default.
330:     hikDoorNo: v.optional(v.number()),
331:     // Kapı durum planı (DoorStatusPlan) — mesai saatinde kapıyı otomatik açık/kapalı tutar.
332:     hikDoorStatusPlan: v.optional(doorStatusPlanValidator),
333:     // Doğrulama planı (VerifyWeekPlan) — saate göre doğrulama modunu değiştirir.
334:     hikVerifyPlan: v.optional(verifyPlanValidator),
335:     hikVerifyPlanSavedAt: v.optional(v.string()),
336:     hikVerifyPlanReaderNos: v.optional(v.array(v.number())),
337:     hikDoorHolidayPlan: v.optional(holidayPlanValidator),
338:     hikDoorHolidaySlots: v.optional(v.array(v.number())),
339:     hikPlanSavedAt: v.optional(v.string()),
340:     hikPlanRevision: v.optional(v.number()),
341:     hikPlanPendingReason: v.optional(v.string()),
342:     hikPlanAppliedAt: v.optional(v.string()),
343:     hikPlanApplyError: v.optional(v.string()),
344:     hikPlanResults: v.optional(v.object({
345:       status: v.optional(v.object({ revision: v.number(), appliedAt: v.optional(v.string()), error: v.optional(v.string()), failedAt: v.optional(v.string()) })),
346:       verify: v.optional(v.object({ revision: v.number(), appliedAt: v.optional(v.string()), error: v.optional(v.string()), failedAt: v.optional(v.string()) })),
347:     })),
348:     createdAt: v.optional(v.string()),
349:     updatedAt: v.optional(v.string()),
350:   })
351:     .index("by_project", ["projectId"])
352:     .index("by_zone", ["zoneId"])
353:     .index("by_device", ["deviceId"])
354:     .searchIndex("search_name", { searchField: "name", filterFields: ["projectId"] }),
355: 
356:   /**
357:    * Okuyucu (kart/yüz tarama yüzü) — kapıyla N:1. Bir kapı 1..2 okuyucu taşır
358:    * (giriş + çıkış). Önceden okuyucu doors.readerName/readerDirection ile 1:1
359:    * modelleniyordu; o alanlar legacy fallback olarak korunur, yeni kayıtlar bu
360:    * tabloya yazılır. İzin modeli kapı bazlı kalır — okuyucular panele gönderilmez
361:    * (Hik event'i okuyucu no taşımaz; hikReaderNo şimdilik görsel/ileriye dönük).
362:    */
```

### accessGrantStatus — convex/schema.ts:537

```ts
537:   accessGrantStatus: defineTable({
538:     projectId: v.id("projects"), employeeId: v.id("employees"), deviceId: v.id("devices"),
539:     departmentId: v.optional(v.id("departments")),
540:     state: v.union(v.literal("pending"), v.literal("effective"), v.literal("failed"), v.literal("removed")),
541:     ruleIds: v.array(v.id("accessRules")), appliedAt: v.optional(v.number()),
542:     lastError: v.optional(v.string()), lastRunId: v.optional(v.id("deviceSyncRuns")), updatedAt: v.number(),
543:     lastOperationId: v.optional(v.string()), // Ignore late acknowledgements for superseded user operations.
544:   }).index("by_employee_device", ["employeeId", "deviceId"])
545:     .index("by_project_state", ["projectId", "state"])
546:     .index("by_project_employee", ["projectId", "employeeId"])
547:     .index("by_project_device", ["projectId", "deviceId"])
548:     .index("by_project_department_state", ["projectId", "departmentId", "state"]),
549: 
```

### accessRules — convex/schema.ts:550

```ts
550:   accessRules: defineTable({
551:     ideExtraPermissionNos: v.optional(v.array(v.number())),
552:     name: v.string(),
553:     projectId: v.optional(v.id("projects")),
554:     targetType: v.optional(v.string()),
555:     description: v.optional(v.string()),
556:     startTime: v.optional(v.string()),
557:     endTime: v.optional(v.string()),
558:     days: v.optional(v.array(v.string())),
559:     hikWeekPlanNo: v.optional(v.number()),
560:     // IDE Smart permission record id (1–65535). hikWeekPlanNo analogu, ayrı namespace.
561:     idePermissionNo: v.optional(v.number()),
562:     priority: v.optional(v.number()),
563:     accessDirection: v.optional(v.string()),
564:     isActive: v.optional(v.boolean()),
565:     isTemplate: v.optional(v.boolean()),
566:     templateName: v.optional(v.string()),
567:     createdAt: v.optional(v.string()),
568:     updatedAt: v.optional(v.string()),
569:   })
570:     .index("by_project", ["projectId"])
571:     .index("by_project_active", ["projectId", "isActive"])
572:     // Kural listesi tür filtresi sayfalamadan önce (UI audit 2, 05-D1).
573:     .index("by_project_targetType", ["projectId", "targetType"])
574:     .index("by_project_targetType_isActive", ["projectId", "targetType", "isActive"])
575:     .index("by_active", ["isActive"])
576:     .index("by_hikWeekPlanNo", ["hikWeekPlanNo"])
577:     .searchIndex("search_name", { searchField: "name", filterFields: ["projectId", "isActive", "targetType"] }),
578: 
```

### groupMembers — convex/schema.ts:579

```ts
579:   groupMembers: defineTable({
580:     groupId: v.id("accessRules"),
581:     employeeId: v.id("employees"),
582:     projectId: v.optional(v.id("projects")),
583:     createdAt: v.string(),
584:     // Missing source is a legacy, explicitly assigned membership.
585:     source: v.optional(v.union(v.literal("manual"), v.literal("department"))),
586:   })
587:     .index("by_group", ["groupId"])
588:     .index("by_employee", ["employeeId"])
589:     .index("by_project_employee", ["projectId", "employeeId"])
590:     .index("by_project_group", ["projectId", "groupId"]),
591: 
```

### groupDepartments — convex/schema.ts:604

```ts
604:   groupDepartments: defineTable({
605:     projectId: v.id("projects"),
606:     groupId: v.id("accessRules"),
607:     departmentId: v.id("departments"),
608:     includeChildren: v.boolean(),
609:   })
610:     .index("by_group", ["groupId"])
611:     .index("by_project", ["projectId"])
612:     .index("by_department", ["departmentId"]),
613: 
```

### groupDevices — convex/schema.ts:614

```ts
614:   groupDevices: defineTable({
615:     groupId: v.id("accessRules"),
616:     deviceId: v.id("devices"),
617:     projectId: v.optional(v.id("projects")),
618:     createdAt: v.string(),
619:   })
620:     .index("by_group", ["groupId"])
621:     .index("by_device", ["deviceId"])
622:     .index("by_project_device", ["projectId", "deviceId"])
623:     .index("by_project_group", ["projectId", "groupId"]),
624: 
625:   // Kural × kapı (groupDevices'ın kapı granülaritesi). Bir kuralda belirli kapılar
626:   // seçildiğinde IDE permission.io o kuralın bu panele ait kapılarının ioId'lerinden türer.
627:   // Bir kuralın bir panel için hiç kaydı yoksa → panelin tüm kapıları (geriye uyumlu).
```

### groupDoors — convex/schema.ts:628

```ts
628:   groupDoors: defineTable({
629:     groupId: v.id("accessRules"),
630:     doorId: v.id("doors"),
631:     deviceId: v.optional(v.id("devices")),
632:     projectId: v.optional(v.id("projects")),
633:     createdAt: v.string(),
634:   })
635:     .index("by_group", ["groupId"])
636:     .index("by_door", ["doorId"])
637:     .index("by_project_group", ["projectId", "groupId"]),
638: 
639:   // ═══════ 5 · KART OKUMA · CİHAZ İŞ KUYRUKLARI ═════════════════════════
```

### deviceEvents — convex/schema.ts:697

```ts
697:   deviceEvents: defineTable({
698:     projectId: v.optional(v.id("projects")),
699:     deviceId: v.optional(v.id("devices")),
700:     source: v.union(
701:       v.literal("hikvision"),
702:       v.literal("ide_smart"),
703:       v.literal("system"),
704:     ),
705:     eventTime: v.string(),
706:     category: v.union(
707:       v.literal("access"),
708:       v.literal("alarm"),
709:       v.literal("exception"),
710:       v.literal("operation"),
711:       v.literal("status"),
712:       v.literal("unknown"),
713:     ),
714:     severity: v.union(
715:       v.literal("info"),
716:       v.literal("warning"),
717:       v.literal("critical"),
718:     ),
719:     label: v.string(),
720:     major: v.optional(v.number()),
721:     minor: v.optional(v.number()),
722:     cardNo: v.optional(v.string()),
723:     rawData: v.optional(v.string()),
724:     deviceSerial: v.optional(v.string()),
725:     deviceIp: v.optional(v.string()),
726:     hikDevIndex: v.optional(v.string()),
727:     hikEhomeID: v.optional(v.string()),
728:     hikSerialNo: v.optional(v.number()),
729:     hikFrontSerialNo: v.optional(v.number()),
730:     hikEventState: v.optional(v.string()),
731:     ideUuid: v.optional(v.string()),
732:     // Alarm merkezi: yönetici onayı (P1). category alarm/exception + severity warning/critical olaylar alarm sayılır.
733:     ackedAt: v.optional(v.string()),
734:     ackedBy: v.optional(v.id("users")),
735:     ackNote: v.optional(v.string()),
736:     // Eski kayıtlarda planlama damgası; yeni akışta yalnız servis kabulünden sonra yazılır.
737:     alarmNotifiedAt: v.optional(v.string()),
738:     // Yeni akışın debounce rezervasyonu gönderim sonucundan ayrıdır.
739:     alarmQueuedAt: v.optional(v.string()),
740:     resolvedAt: v.optional(v.string()),
741:     alarmEmailTest: v.optional(v.boolean()),
742:     alarmEmailStatus: v.optional(v.union(v.literal("queued"), v.literal("sending"), v.literal("retryScheduled"), v.literal("sent"), v.literal("failed"), v.literal("skipped"))),
743:     alarmEmailAttempts: v.optional(v.number()),
744:     alarmEmailAttemptAt: v.optional(v.string()),
745:     alarmEmailError: v.optional(v.string()),
746:     alarmEmailRetryAt: v.optional(v.string()),
747:     alarmEmailRecipients: v.optional(v.array(v.string())),
748:     alarmEmailContent: v.optional(v.object({ from: v.string(), subject: v.string(), html: v.string() })),
749:     createdAt: v.string(),
750:     updatedAt: v.string(),
751:   })
752:     .index("by_eventTime", ["eventTime"])
753:     .index("by_project", ["projectId"])
754:     .index("by_device", ["deviceId"])
755:     .index("by_project_and_event_time", ["projectId", "eventTime"])
756:     .index("by_project_category_event_time", ["projectId", "category", "eventTime"])
757:     .index("by_device_and_event_time", ["deviceId", "eventTime"])
758:     .index("by_device_category_label_alarmQueuedAt", ["deviceId", "category", "label", "alarmQueuedAt"])
759:     .index("by_device_category_label_alarmNotifiedAt", ["deviceId", "category", "label", "alarmNotifiedAt"])
760:     .index("by_device_category_label_event_time", ["deviceId", "category", "label", "eventTime"])
761:     .index("by_device_and_hik_serial", ["deviceId", "hikSerialNo"]),
762: 
763:   // Alarm e-posta bildirimi ayarı (proje başına tek satır; P1).
```

### alarmSettings — convex/schema.ts:764

```ts
764:   alarmSettings: defineTable({
765:     projectId: v.id("projects"),
766:     emailEnabled: v.boolean(),
767:     recipients: v.array(v.string()),
768:     minSeverity: v.union(v.literal("warning"), v.literal("critical")),
769:     lastEmailEventId: v.optional(v.id("deviceEvents")),
770:     lastTestRequestedAt: v.optional(v.string()),
771:     updatedBy: v.optional(v.id("users")),
772:     updatedAt: v.string(),
773:   }).index("by_project", ["projectId"]),
774: 
775:   // Cihaz offline iken biriken Convex -> cihaz komutları kuyruğu.
776:   // Gateway cihazlarda worker failed kayıtları retry eder; localBridge cihazlarda
777:   // Windows bridge pending kayıtları claim edip SDK ile panele uygular.
```

### generalSettings — convex/schema.ts:1125

```ts
1125:   generalSettings: defineTable({
1126:     projectId: v.optional(v.id("projects")),
1127:     companyName: v.string(),
1128:     address: v.optional(v.string()),
1129:     email: v.optional(v.string()),
1130:     phone: v.optional(v.string()),
1131:     website: v.optional(v.string()),
1132:     taxNumber: v.optional(v.string()),
1133:     currency: v.optional(v.string()),
1134:     logoUrl: v.optional(v.string()),
1135:     darkMode: v.optional(v.boolean()),
1136:     dateFormat: v.optional(v.string()),
1137:     timezone: v.optional(v.string()),
1138:     systemLanguage: v.optional(v.string()),
1139:     workingDays: v.optional(v.array(v.string())),
1140:     workingHoursStart: v.optional(v.string()),
1141:     workingHoursEnd: v.optional(v.string()),
1142:     notificationsEnabled: v.optional(v.boolean()),
1143:     createdAt: v.optional(v.string()),
1144:     updatedAt: v.optional(v.string()),
1145:   }).index("by_project", ["projectId"]),
1146: 
```

### mailSettings — convex/schema.ts:1147

```ts
1147:   mailSettings: defineTable({
1148:     projectId: v.optional(v.id("projects")),
1149:     smtpHost: v.optional(v.string()),
1150:     smtpPort: v.optional(v.number()),
1151:     smtpUsername: v.optional(v.string()),
1152:     smtpPassword: v.optional(v.string()),
1153:     smtpSecure: v.optional(v.boolean()),
1154:     fromEmail: v.optional(v.string()),
1155:     fromName: v.optional(v.string()),
1156:     isActive: v.optional(v.boolean()),
1157:     createdAt: v.optional(v.string()),
1158:     updatedAt: v.optional(v.string()),
1159:   }).index("by_project", ["projectId"]),
1160: 
```

### notificationSettings — convex/schema.ts:1161

```ts
1161:   notificationSettings: defineTable({
1162:     projectId: v.optional(v.id("projects")),
1163:     emailNotifications: v.optional(v.boolean()),
1164:     systemNotifications: v.optional(v.boolean()),
1165:     lateNotifications: v.optional(v.boolean()),
1166:     reportNotifications: v.optional(v.boolean()),
1167:     createdAt: v.optional(v.string()),
1168:     updatedAt: v.optional(v.string()),
1169:   }).index("by_project", ["projectId"]),
1170: 
1171:   // ═══════ 9 · CİHAZ HAVUZU · IDE VARSAYILANLARI · CHAT ═════════════════
1172:   // IDE Smart panelleri için sistem geneli ortak varsayılanlar (singleton — proje
1173:   // index'i yok, `.first()` ile okunur). Admin "UUID ile ekle" yaparken bu kimlik
1174:   // cihaz satırına KOPYALANIR (bridge op-zamanı device.ideUser/idePassword okur).
1175:   // Fiziksel cihaz envanteri — super_admin burada UUID ile kaydeder.
1176:   // Projeye atama (claim) anında bu tablodan `devices` tablosuna taşınır.
1177:   // `releaseDevice` cihazı `devices`'dan kaldırıp buraya geri koyar.
```

### ideDefaults — convex/schema.ts:1204

```ts
1204:   ideDefaults: defineTable({
1205:     ideUser: v.string(),
1206:     idePassword: v.string(),
1207:     ideDoorCount: v.optional(v.number()),
1208:     updatedAt: v.string(),
1209:   }),
1210: 
```

### chatConversations — convex/schema.ts:1211

```ts
1211:   chatConversations: defineTable({
1212:     projectId: v.optional(v.id("projects")),
1213:     title: v.optional(v.string()),
1214:     messages: v.array(
1215:       v.object({
1216:         role: v.union(v.literal("user"), v.literal("assistant")),
1217:         content: v.string(),
1218:         data: v.optional(v.any()),
1219:       })
1220:     ),
1221:     createdAt: v.string(),
1222:     updatedAt: v.string(),
1223:   }).index("by_project", ["projectId"]),
1224: 
1225:   // ═══════ 10 · İZİN · MESAİ · ÇALIŞMA AYARLARI ═════════════════════════
```

### auditLog — convex/schema.ts:1411

```ts
1411:   auditLog: defineTable({
1412:     userId: v.optional(v.id("users")),
1413:     userName: v.optional(v.string()),
1414:     projectId: v.optional(v.id("projects")),
1415:     action: v.union(
1416:       v.literal("create"),
1417:       v.literal("update"),
1418:       v.literal("delete")
1419:     ),
1420:     targetTable: v.string(),
1421:     targetId: v.string(),
1422:     oldValue: v.optional(v.any()),
1423:     newValue: v.optional(v.any()),
1424:     note: v.optional(v.string()),
1425:     timestamp: v.number(),
1426:     ipAddress: v.optional(v.string()),
1427:     /** Arama için yazım anında doldurulur (kullanıcı adı, hedef etiketi, ad alanları; serbest not KVKK gereği dahil değil). Eski kayıtlarda yok. */
1428:     searchText: v.optional(v.string()),
1429:   })
1430:     .index("by_project_timestamp", ["projectId", "timestamp"])
1431:     .index("by_project_action_timestamp", ["projectId", "action", "timestamp"])
1432:     .index("by_action_timestamp", ["action", "timestamp"])
1433:     .searchIndex("search_text", {
1434:       searchField: "searchText",
1435:       filterFields: ["projectId", "targetTable", "action", "userId"],
1436:     })
1437:     .index("by_target", ["targetTable", "targetId"])
1438:     .index("by_user_timestamp", ["userId", "timestamp"])
1439:     .index("by_timestamp", ["timestamp"])
1440:     .index("by_table_timestamp", ["targetTable", "timestamp"])
1441:     .index("by_project_table_timestamp", ["projectId", "targetTable", "timestamp"])
1442:     .index("by_project_user_timestamp", ["projectId", "userId", "timestamp"]),
1443: 
1444:   /**
1445:    * Yüklenen ama henüz bir kayda bağlanmamış dosyaların sahipliği. Yükleme sonrası
1446:    * istemci storageId'yi ilk talep eden olarak kaydeder; bağlanmamış dosyaya erişim
1447:    * yalnız yükleyene açıktır. Bağlanınca (ör. personel fotoğrafı) kayıt silinir.
1448:    */
```

### pendingUploads — convex/schema.ts:1449

```ts
1449:   pendingUploads: defineTable({
1450:     storageId: v.id("_storage"),
1451:     userId: v.id("users"),
1452:     createdAt: v.number(),
1453:   })
1454:     .index("by_storage", ["storageId"])
1455:     .index("by_created", ["createdAt"]),
1456: 
```

### reportScheduleSettings — convex/schema.ts:1457

```ts
1457:   reportScheduleSettings: defineTable({
1458:     userId: v.id("users"),
1459:     projectId: v.optional(v.id("projects")),
1460:     reportType: v.string(),
1461:     email: v.string(),
1462:     enabled: v.boolean(),
1463:     lastSentAt: v.optional(v.string()),
1464:     createdAt: v.string(),
1465:     updatedAt: v.string(),
1466:   })
1467:     .index("by_user", ["userId"])
1468:     .index("by_project", ["projectId"])
1469:     .index("by_user_project", ["userId", "projectId"]),
1470: 
1471:   // KVKK Faz 1: proje bazlı gizlilik ayarları (biyometri modülü, okuma saklama
1472:   // süresi, asistan isim maskeleme). Satır YOKSA eski davranış (bkz.
1473:   // convex/lib/privacySettings.ts DEFAULT_PRIVACY): biyometri açık, saklama süresiz,
1474:   // asistan isimleri maskeli. Yeni projeler biyometri KAPALI başlar.
```

### projectPrivacySettings — convex/schema.ts:1475

```ts
1475:   projectPrivacySettings: defineTable({
1476:     projectId: v.id("projects"),
1477:     biometricEnabled: v.optional(v.boolean()),
1478:     biometricReason: v.optional(v.string()),
1479:     biometricChangedAt: v.optional(v.string()),
1480:     biometricChangedBy: v.optional(v.id("users")),
1481:     cardReadingRetentionDays: v.optional(v.number()),
1482:     visitorRetentionDays: v.optional(v.number()),
1483:     aiMaskNames: v.optional(v.boolean()),
1484:     // Ziyaretçi KVKK aydınlatma metni bağlantısı ve sürümü (06-O5; Ayarlar > Gizlilik'ten yönetilir).
1485:     visitorKvkkUrl: v.optional(v.string()),
1486:     visitorKvkkVersion: v.optional(v.string()),
1487:     updatedAt: v.string(),
1488:   }).index("by_project", ["projectId"]),
1489: 
1490:   // Kullanıcı davet sistemi - yetkili kullanıcılar projeye davet eder veya
1491:   // mevcut kullanıcıya şifre sıfırlama maili gönderir (type === "reset")
```

### invites — convex/schema.ts:1492

```ts
1492:   invites: defineTable({
1493:     email: v.string(),
1494:     token: v.string(),
1495:     projectId: v.id("projects"),
1496:     // Eski davetler project_admin/project_user taşır; yenileri proje rolü (lib/permissions.ts).
1497:     role: inviteRoleValidator,
1498:     type: v.optional(v.union(v.literal("invite"), v.literal("reset"))),
1499:     createdBy: v.id("users"),
1500:     expiresAt: v.string(),
1501:     used: v.optional(v.boolean()),
1502:     createdAt: v.string(),
1503:   })
1504:     .index("by_token", ["token"])
1505:     .index("by_email", ["email"]),
```

## Ek B — Yazan yolların dosya/satır envanteri

Yeniden üretim komutu: üretim adaylarında `rg -n 'db\.(patch|insert|replace|delete)\(|status\s*:|state\s*:|phase\s*:|\b\w*At\s*:|\bis[A-Z]\w*\s*:' S...`. Ekte aynı örüntü Python re ile satır satır uygulanmıştır. Çok satırlı patch için alan satırı ayrıca görünür. Bu tam aday havuzu ortak A/B dosyalarını içerir; bunların C dışındaki iş kuralları hakkında hüküm verilmez. Genel transaction helper’ları ve internal/action çağrılarını yukarıdaki makineler çözümler.


### convex/accessGrantStatus.ts

```text
23: type MembershipCache = Map<Id<"employees">, Promise<{ rule: Doc<"accessRules">; createdAt: string }[]>>;
33:       const rules = await Promise.all(links.map(async link => ({ rule: await ctx.db.get(link.groupId), createdAt: link.createdAt })));
34:       return rules.filter((entry): entry is { rule: Doc<"accessRules">; createdAt: string } =>
39:   const deviceRules: { rule: Doc<"accessRules">; createdAt: string }[] = [];
148:   return { rows: matched.slice(offset, end), isDone: end >= matched.length, continueCursor: `grant-scan:${end}` };
152:   args: { projectId: v.id("projects"), state: v.optional(v.union(grantState, v.literal("unknown"))), departmentId: v.optional(v.id("departments")),
176:           departmentId: pair.employee.departmentId, state: "pending", ruleIds: pair.ruleIds, updatedAt: 0 }, scopes, new Map([[pair.employee._id, pair.employee]])),
177:         state: "unknown" as const,
274:         departmentId: employee.departmentId, state: "pending", ruleIds: scope.ruleIds, updatedAt: 0 }, scopes, employees);
275:       rows.push({ ...synthetic, ...diagnose(deviceId), _id: null, state: "unknown" as const, authorized: true, removalRequired: false });
279:     return { rows, unauthorizedDoors: doors.filter(door => door.deviceId && !allowedDoors.has(door._id)).map(door => ({ doorId: door._id, doorName: door.name, deviceId: door.deviceId ?? null, state: "unauthorized" as const })) };
284:   args: { results: v.array(v.object({ projectId: v.id("projects"), employeeId: v.id("employees"), deviceId: v.id("devices"), state: grantState,
```

### convex/accessRules.ts

```text
209:   await Promise.all(staleIds.map((id) => ctx.db.delete(id)));
481:   const query = (phase: "active" | "legacy") => {
517:       isDone: false,
518:       continueCursor: JSON.stringify({ scope, phase: "legacy", cursor: null }),
525:       phase: next.phase,
536:   status: "all" | "active" | "inactive",
543:   const query = (phase: number) => {
584:     status: v.optional(
679:       isDone: searchLimited || result.isDone,
790:     isActive: v.optional(v.boolean()),
791:     isTemplate: v.optional(v.boolean()),
801:     const ruleId = await ctx.db.insert("accessRules", {
803:       isActive: args.isActive ?? true,
804:       createdAt: now,
805:       updatedAt: now,
822:     isActive: v.optional(v.boolean()),
823:     isTemplate: v.optional(v.boolean()),
838:     const clean = { ...toPatch(updates), updatedAt: new Date().toISOString() };
844:     await ctx.db.patch(ruleId, clean);
955:     await Promise.all([...members, ...devices, ...doors].map(link => ctx.db.delete(link._id)));
958:     for (const link of departmentLinks) await ctx.db.delete(link._id);
960:     await ctx.db.delete(args.ruleId);
988:     isActive: v.optional(v.boolean()),
1010:     isActive: v.optional(v.boolean()),
1100:     await ctx.db.patch(ruleId, { ...toPatch(updates), updatedAt: now });
1106:       await Promise.all(oldMembers.filter(m => changed.removed.includes(m.employeeId)).map((m) => ctx.db.delete(m._id)));
1109:           ctx.db.insert("groupMembers", {
1113:             createdAt: now,
1121:         if ((member.source ?? "manual") !== source) await ctx.db.patch(member._id, { source });
1128:       await Promise.all(oldDevices.filter(d => changed.removed.includes(d.deviceId)).map((d) => ctx.db.delete(d._id)));
1131:           ctx.db.insert("groupDevices", {
1135:             createdAt: now,
1160:       await Promise.all(oldDoors.filter(d => changed.removed.includes(d.doorId)).map((d) => ctx.db.delete(d._id)));
1164:           await ctx.db.insert("groupDoors", {
1169:             createdAt: now,
1254:     // Salt reaktivasyon: üye listesi ve panel değişmeden isActive:true yapıldığında yukarıdaki
```

### convex/accountAccess.ts

```text
16:     await ctx.db.patch(userId, { disabledAt: now, disabledBy: ctx.user._id });
30:     await ctx.db.patch(userId, { disabledAt: undefined, disabledBy: undefined });
37:   args: { userId: v.id("users"), accessExpiresAt: v.union(v.number(), v.null()) },
48:     const jobId = accessExpiresAt === null ? undefined : await ctx.scheduler.runAt(accessExpiresAt, internal.accountAccess.expireAccess, { userId, expectedExpiresAt: accessExpiresAt });
49:     await ctx.db.patch(userId, { accessExpiresAt: accessExpiresAt ?? undefined, accessExpiryJobId: jobId });
56:   args: { userId: v.id("users"), expectedExpiresAt: v.number() },
62:     await ctx.db.patch(userId, { accessExpiryJobId: undefined });
```

### convex/actions/hikFingerprint.ts

```text
171:           const reserved: { current: true } | { enrollmentId: Id<"deviceFingerprintEnrollments">; attemptId: string } | null = await ctx.runMutation(internal.fingerprintEnrollment.beginPush, { employeeId: args.employeeId, deviceId, fingerNo: template.fingerPrintID, templateId: template._id, addedAt: template.addedAt, expectedCardNumber: target.employee.cardNumber, force: args.force });
181:           await ctx.runMutation(internal.fingerprintEnrollment.recordPush, { employeeId: args.employeeId, deviceId, fingerNo: template.fingerPrintID, templateId: template._id, addedAt: template.addedAt, expectedCardNumber: target.employee.cardNumber, enrolledBy: template.enrolledBy, attemptId: reservation.attemptId });
```

### convex/actions/hikGatewayDevice.ts

```text
176:       updatedAt: number;
```

### convex/actions/ideGatewayDevice.ts

```text
144:     const status: 0 | 1 = data.employee.isActive === false ? 0 : 1;
417:         payload: { ioId: door.ioId, keep, expiresAt: Date.now() + 30_000 },
```

### convex/actions/projectMail.ts

```text
21:     isActive: v.boolean(),
29:       username: config.username, fromEmail: config.fromEmail, fromName: config.fromName, isActive: config.isActive, passwordEnc,
```

### convex/adminDevices.ts

```text
93:     await ctx.db.patch(device._id, {
96:       updatedAt: new Date().toISOString(),
123:     return await ctx.db.insert("adminDevices", {
131:       createdAt: now,
132:       updatedAt: now,
151:       const adminDeviceId = await ctx.db.insert("adminDevices", {
164:         createdAt: now,
165:         updatedAt: now,
167:       await ctx.db.patch(device._id, { adminDeviceId, updatedAt: now });
187:     await ctx.db.delete(args.adminDeviceId);
200:       await ctx.db.patch(device._id, { lastSeen: new Date().toISOString() });
213:     await ctx.db.patch(args.adminDeviceId, {
216:       updatedAt: new Date().toISOString(),
227:     await ctx.db.patch(args.adminDeviceId, {
230:       updatedAt: new Date().toISOString(),
272:     return { ...result, filterScope: "server" as const, totalScanned, evaluatedAt: now,
279:           ...("hikLastSeenAt" in signal ? { hikLastSeenAt: signal.hikLastSeenAt } : {}),
282:           ...("hikIsupStatusAt" in signal ? { hikIsupStatusAt: signal.hikIsupStatusAt } : {}),
```

### convex/alarms.ts

```text
96:       await ctx.db.patch(id, { ackedAt: now, ackedBy: ctx.user._id, ackNote: args.note?.trim() || undefined, updatedAt: now });
97:       await writeAudit(ctx, { user: ctx.user, projectId: event.projectId, action: "update", targetTable: "deviceEvents", targetId: id, oldValue: { ackedAt: null }, newValue: { ackedAt: now }, note: args.note?.trim() });
114:       lastEmail: last ? { status: last.alarmEmailStatus, attempts: last.alarmEmailAttempts ?? 0, at: last.alarmEmailAttemptAt ?? last.alarmQueuedAt, error: last.alarmEmailError, retryAt: last.alarmEmailRetryAt, test: last.alarmEmailTest ?? false } : null,
127:     const values = { emailEnabled: args.emailEnabled, recipients, minSeverity: args.minSeverity, updatedBy: ctx.user._id, updatedAt: new Date().toISOString() };
128:     if (existing) await ctx.db.patch(existing._id, values); else await ctx.db.insert("alarmSettings", { projectId: args.projectId, ...values });
160:     const eventId = await ctx.db.insert("deviceEvents", {
162:       eventTime: now, createdAt: now, updatedAt: now, alarmEmailTest: true,
163:       alarmQueuedAt: now, alarmEmailStatus: "queued", alarmEmailAttempts: 0, alarmEmailRecipients: settings.recipients,
166:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId, lastTestRequestedAt: now });
185:       await ctx.db.patch(event._id, { alarmEmailStatus: "skipped", alarmEmailError: "Gönderim güncel alarm ayarları nedeniyle durduruldu", alarmEmailRetryAt: undefined, updatedAt: now });
188:     await ctx.db.patch(event._id, { alarmEmailStatus: "sending", alarmEmailAttempts: args.attempt, alarmEmailAttemptAt: now, alarmEmailRetryAt: undefined, updatedAt: now });
202:     await ctx.db.patch(event._id, { alarmEmailContent: args.content });
220:     await ctx.db.patch(event._id, {
222:       alarmEmailAttemptAt: now, alarmEmailError: error,
223:       alarmEmailRetryAt: retryAt, alarmEmailRecipients: failed,
224:       ...(failed.length === 0 ? { alarmNotifiedAt: now } : {}), updatedAt: now,
241:     await ctx.db.patch(event._id, { alarmEmailStatus: retry ? "retryScheduled" : "failed", alarmEmailRetryAt: retry ? now : undefined, alarmEmailError: "E-posta gönderimi kesildi; yeniden deneme sınırını kontrol edin", updatedAt: now });
```

### convex/attendanceCorrections.ts

```text
30:     const id = await ctx.db.insert("attendanceCorrections", { ...args, reason: args.reason.trim(), employeeId: employee._id, projectId: employee.projectId, status: "pending", createdAt: now, updatedAt: now });
31:     await writeAudit(ctx, { user: null, projectId: employee.projectId, action: "create", targetTable: "attendanceCorrections", targetId: id, newValue: { actorType: "employee", employeeId: employee._id, status: "pending" }, note: "Çalışan talebi" });
42:     await ctx.db.patch(id, { status: "withdrawn", updatedAt: new Date().toISOString() });
43:     await writeAudit(ctx, { user: null, projectId: row.projectId, action: "update", targetTable: "attendanceCorrections", targetId: id, oldValue: { actorType: "employee", employeeId: ctx.employee._id, status: row.status }, newValue: { actorType: "employee", employeeId: ctx.employee._id, status: "withdrawn" }, note: "Çalışan talebi" });
53:     status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("withdrawn")),
54:     decisionNote: v.optional(v.string()), decidedAt: v.optional(v.string()), createdAt: v.string(),
80:     return { page: page.map((row, index) => ({ ...row, employeeName: employees[index] ? `${employees[index].firstName} ${employees[index].lastName}` : "Silinmiş çalışan" })), isDone: start + page.length >= all.length && !hasMore, hasMore, continueCursor: String(start + page.length) };
99:   await ctx.db.patch(id, { status: approve ? "approved" : "rejected", decidedBy: ctx.user._id, decidedAt: now, decisionNote: note, updatedAt: now });
100:   await writeAudit(ctx, { user: ctx.user, projectId: row.projectId, action: "update", targetTable: "attendanceCorrections", targetId: id, oldValue: { status: row.status }, newValue: { status: approve ? "approved" : "rejected", date: row.date }, note });
```

### convex/biometricDestruction.ts

```text
33:   return parsed.success ? { row, projectId: row.projectId, state: parsed.data } : null;
35: async function saveState(ctx: MutationCtx, row: Doc<"auditLog">, state: DestructionState, note: string) {
41:   await ctx.db.patch(row._id, { newValue: state });
45: async function settleIfReady(ctx: MutationCtx, row: Doc<"auditLog">, state: DestructionState) {
54: function trackPending(state: DestructionState, ids: readonly string[]) {
208:       kind: state.phase, employeeId: template.employeeId, addedAt: template.addedAt,
232:     const opId = await ctx.db.insert("hikPendingOperations", {
235:       status: "processing", processingStartedAt: Date.now(), attemptCount: 1, createdAt: Date.now(),
264:     await ctx.db.patch(args.opId, { status: args.ok ? "done" : "failed", completedAt: Date.now(), attemptCount: args.ok ? op.attemptCount : 5, lastError: args.ok ? undefined : "Biyometrik şablon cihazdan silinemedi." });
281:         await ctx.db.delete(face._id); state.deletedFaces += 1;
```

### convex/cardReadings.ts

```text
157:       cardNumber: person.cardNumber, isActive: person.isActive,
231:     if (searched === null) return { page: [], isDone: true, continueCursor: "", scannedCount: 0, matchedCount: 0, scanLimitReached: false, filterScope: "boundedScan" as const };
802:       const eventId = await ctx.db.insert("deviceEvents", {
816:         createdAt: eventTime,
817:         updatedAt: eventTime,
851:     await ctx.db.insert("cardReadings", {
869:       createdAt: eventTime,
870:       updatedAt: eventTime,
```

### convex/companies.ts

```text
48:     return await ctx.db.insert("companies", { projectId: args.projectId, name, ...details(args), createdAt: now, updatedAt: now });
60:     const patch: Partial<Doc<"companies">> = { ...details(args), updatedAt: new Date().toISOString() };
67:     await ctx.db.patch(args.companyId, patch);
86:     await ctx.db.delete(args.companyId);
```

### convex/dataMigrations.ts

```text
23:     return { scanned: page.page.length, missing, isDone: page.isDone, continueCursor: page.continueCursor };
37:     return { scanned: page.page.length, affected, isDone: page.isDone, continueCursor: page.continueCursor };
```

### convex/debugIde.ts

```text
51:         .map((r) => ({ _id: r._id, name: r.name, isActive: r.isActive })),
```

### convex/departments.ts

```text
54:     return await ctx.db.insert("departments", {
57:       createdAt: now,
58:       updatedAt: now,
95:     await ctx.db.patch(departmentId, {
97:       updatedAt: new Date().toISOString(),
120:     await ctx.db.delete(args.departmentId);
148:       await ctx.db.patch(department._id, { companyId, updatedAt: now });
154:           await ctx.db.patch(employee._id, { companyId, updatedAt: now });
```

### convex/deviceEvents.ts

```text
48:     const eventId = await ctx.db.insert("deviceEvents", {
62:       createdAt: now,
63:       updatedAt: now,
148:     const eventId = await ctx.db.insert("deviceEvents", {
168:       createdAt: now,
169:       updatedAt: now,
```

### convex/deviceSyncRuns.ts

```text
31:   const next = { ...summary, finishedAt: summary.status === "running" ? undefined : run.finishedAt ?? Date.now() };
32:   if (summaryChanged(run, next)) await ctx.db.patch(runId, next);
43:     const patch = { status: "unknown" as const, reason: "Süre doldu; cihaz sonucu doğrulanamadı", updatedAt: Date.now() };
44:     await ctx.db.patch(target._id, patch);
57:   const patch = { status, reason, updatedAt: Date.now() };
58:   await ctx.db.patch(target._id, patch);
93:     const runId = await ctx.db.insert("deviceSyncRuns", {
95:       startedBy: user._id, startedAt, status: "running",
101:       const targetId = await ctx.db.insert("deviceSyncRunTargets", {
103:         status: reason ? "skipped" : "queued", reason, updatedAt: startedAt,
256:     await ctx.db.patch(rule._id, { hikWeekPlanNo: weekPlanNo });
332:     await ctx.db.patch(target._id, { dispatchFinished: true, status, reason, updatedAt: Date.now() });
451:   const runId = await ctx.db.insert("deviceSyncRuns", {
453:     startedBy: args.startedBy, startedAt, status: "running",
458:     const targetId = await ctx.db.insert("deviceSyncRunTargets", {
460:       status: reason ? "skipped" : "queued", reason, updatedAt: startedAt,
659:   const runId = await ctx.db.insert("deviceSyncRuns", { projectId: args.projectId, startedBy: args.startedBy, kind: "project_resync", status: "running", startedAt: now, counts: summarizeRun([], false).counts, dispatchFinished: true });
662:     const targetId = await ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other", status: reason ? "skipped" : "queued", reason, updatedAt: now });
```

### convex/devices.ts

```text
42:   args: { deviceId: v.id("devices"), checkAt: v.number() },
140:     status: v.optional(v.string()),
141:     isActive: v.optional(v.boolean()),
178:     status: v.optional(v.string()),
179:     isActive: v.optional(v.boolean()),
237:     const clean: Record<string, unknown> = { updatedAt: new Date().toISOString() };
272:           await ctx.db.patch(poolDevice._id, { ideUuid, updatedAt: new Date().toISOString() });
288:     await ctx.db.patch(deviceId, toPatch(clean));
303:           ctx.db.patch(door._id, { zoneId: args.zoneId, updatedAt: new Date().toISOString() })
313:           ctx.db.patch(reader._id, { zoneId: args.zoneId, updatedAt: new Date().toISOString() })
340:           await ctx.db.delete(device.adminDeviceId);
342:           await ctx.db.patch(device.adminDeviceId, {
345:             updatedAt: new Date().toISOString(),
413:       await ctx.db.patch(device._id, {
415:         hikLastSeenAt: Date.parse(now),
426:         await ctx.db.patch(adminDevice._id, { lastSeen: now });
441: ): Promise<{ token: string; createdAt: string }> {
444:   await ctx.db.patch(deviceId, {
446:     apiTokenCreatedAt: createdAt,
447:     updatedAt: createdAt,
457:   returns: v.object({ token: v.string(), createdAt: v.string() }),
532:         await ctx.db.patch(poolDevice._id, { ideUuid, updatedAt: new Date().toISOString() });
535:     await ctx.db.patch(args.deviceId, {
537:       updatedAt: new Date().toISOString(),
550:     await ctx.db.patch(args.deviceId, {
552:       status: "active",
553:       updatedAt: now,
579:     status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
630:     status: v.optional(v.string()),
773:         hikLastBackfillAt: d.hikLastBackfillAt,
785:     await ctx.db.patch(args.deviceId, {
788:       updatedAt: new Date().toISOString(),
796:     await ctx.db.patch(args.deviceId, {
798:       updatedAt: new Date().toISOString(),
806:     await ctx.db.patch(args.deviceId, {
808:       updatedAt: new Date().toISOString(),
817:       updatedAt: v.number(),
827:     await ctx.db.patch(args.deviceId, {
829:       updatedAt: new Date().toISOString(),
838:     updatedAt: v.number(),
841:     await ctx.db.patch(args.deviceId, {
843:       hikCapabilitiesUpdatedAt: args.updatedAt,
844:       updatedAt: new Date().toISOString(),
852:     await ctx.db.patch(args.deviceId, {
853:       hikLastRebootAt: args.at,
854:       updatedAt: new Date().toISOString(),
880:     await ctx.db.patch(args.deviceId, { hikBackfillPending: args.pending });
898:     await ctx.db.patch(args.deviceId, {
900:       hikLastBackfillAt: Math.max(device.hikLastBackfillAt ?? 0, args.at),
902:       updatedAt: new Date().toISOString(),
1033:     const lastHeartbeat = args.online ? device.hikLastSeenAt : Date.parse(device.updatedAt);
1038:     await ctx.db.patch(device._id, {
1040:       ...(args.online ? { hikLastSeenAt: now } : {}),
1041:       updatedAt: nowIso,
1073:     status: v.union(v.literal("online"), v.literal("offline")), at: v.number(),
1087:       await ctx.db.patch(device._id, { hikIsupStatusAt: args.at });
1093:       await ctx.db.insert("deviceEvents", {
1096:         eventTime: endIso, createdAt: nowIso, updatedAt: nowIso,
1103:         await ctx.db.patch(alarm._id, { resolvedAt: new Date(args.at).toISOString(), updatedAt: new Date(now).toISOString() });
1106:     await ctx.db.patch(device._id, {
1107:       hikIsupOnline: online, hikIsupStatusAt: args.at,
1129:     const eventId = await ctx.db.insert("deviceEvents", {
1132:       eventTime: now, createdAt: now, updatedAt: now,
```

### convex/doorPlanInvalidation.ts

```text
19:     await ctx.db.patch(door._id, {
21:       hikPlanSavedAt: now,
25:       updatedAt: now,
```

### convex/doors.ts

```text
173:     status: v.optional(v.string()),
226:     const doorId = await ctx.db.insert("doors", {
230:       status: args.status ?? "active",
231:       createdAt: now,
232:       updatedAt: now,
238:     await ctx.db.insert("readers", {
247:       status: "active",
248:       createdAt: now,
249:       updatedAt: now,
266:     status: v.optional(v.string()),
326:     await ctx.db.patch(doorId, { ...updates, updatedAt: now, ...(plansChanged ? {
327:       hikPlanSavedAt: now, hikPlanRevision: (door.hikPlanRevision ?? 0) + 1,
331:       hikPlanResults: undefined, hikPlanApplyError: undefined, hikPlanAppliedAt: undefined,
332:       hikPlanSavedAt: undefined, hikDoorHolidaySlots: undefined, hikVerifyPlanReaderNos: undefined,
351:           await ctx.db.patch(reader._id, {
358:             updatedAt: now,
409:     await ctx.db.delete(args.doorId);
545:           lastReadAt: canRead ? last?.accessTime ?? null : null,
563:           hikLastCfgAt: r.hikLastCfgAt ?? null,
569:             ? { lastReadAt: null, lastCardNo: null, lastEmployeeName: null,
636:       ...(!changed.includes("status") && door.hikPlanResults?.status ? { status: { ...door.hikPlanResults.status, revision } } : {}),
639:     await ctx.db.patch(door._id, {
642:       ...(verifyChanged ? { hikVerifyPlan: normalizedVerify, hikVerifyPlanSavedAt: now } : {}),
643:       hikPlanSavedAt: now, hikPlanRevision: revision,
644:       hikPlanResults: results, hikPlanApplyError: [results.status?.error, results.verify?.error].filter((e): e is string => !!e).join("; ") || undefined, updatedAt: now,
661:         const result = key === "status" ? door.hikPlanResults?.status : door.hikPlanResults?.verify;
669:         hikPlanSavedAt: door.hikPlanSavedAt ?? null, hikPlanAppliedAt: door.hikPlanAppliedAt ?? null,
673:         hikPlanFailedAt: [door.hikPlanResults?.status, door.hikPlanResults?.verify]
699:       await ctx.db.patch(door._id, {
700:         hikPlanResults: { ...door.hikPlanResults, [args.key]: { revision: door.hikPlanRevision ?? 0, error, failedAt: new Date().toISOString() } },
707:       ...(args.error ? { error: args.error.slice(0, 500), failedAt: now } : { appliedAt: now }) } };
710:     await ctx.db.patch(door._id, { hikPlanResults: results, hikPlanApplyError: error || undefined,
711:       ...(complete && !error ? { hikPlanAppliedAt: now, hikPlanPendingReason: undefined } : {}) });
749:     await ctx.db.patch(doorId, { hikDoorHolidaySlots: slots });
779:     await ctx.db.patch(door._id, { hikVerifyPlanReaderNos: [...readers] });
807:     await ctx.db.patch(op._id, { status: args.ok ? "done" : "failed", completedAt: args.ok ? Date.now() : undefined, attemptCount: op.attemptCount + 1, lastError: args.ok ? undefined : args.error ?? "Kapı yetkisi gönderilemedi" });
811:     await upsertGrantStatus(ctx, { projectId: op.projectId, employeeId, deviceId: op.deviceId, state: args.ok ? args.removed ? "removed" : "effective" : "failed", lastRunId: op.runId, lastOperationId: op._id, lastError: args.error });
```

### convex/emailVerification.ts

```text
50:       await ctx.db.patch(user._id, {
52:         tokenExpiresAt: tokenDecision.expiresAt,
53:         updatedAt: now.toISOString(),
108:   args: { cursor: v.optional(v.string()), runAt: v.optional(v.string()), batch: v.optional(v.number()) },
118:       await ctx.db.patch(user._id, { setupToken: undefined, tokenExpiresAt: undefined });
```

### convex/employeeAuth.ts

```text
69:       tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: now };
70:     if (existing) await ctx.db.patch(existing._id, values);
71:     else await ctx.db.insert("employeeAuth", { employeeId, ...values, createdAt: now });
95:       tokenExpiresAt: v.optional(v.string()),
105:       ? { tokenExpiresAt: authRecord.tokenExpiresAt, email: authRecord.email }
131:     tokenExpiresAt: v.optional(v.string()),
135:     return await ctx.db.insert("employeeAuth", {
138:       createdAt: now,
139:       updatedAt: now,
150:     tokenExpiresAt: v.optional(v.union(v.string(), v.null())),
156:       updatedAt: new Date().toISOString(),
159:       ...(updates.tokenExpiresAt === undefined ? {} : { tokenExpiresAt: updates.tokenExpiresAt ?? undefined }),
169:       await ctx.db.patch(authId, clean);
177:     v.object({ status: v.literal("invalid") }),
178:     v.object({ status: v.literal("expired") }),
179:     v.object({ status: v.literal("ok") }),
186:     if (!auth) return { status: "invalid" as const };
188:       return { status: "expired" as const };
192:     return { status: "ok" as const };
209:         await ctx.db.patch(auth._id, {
211:           tokenExpiresAt: undefined,
212:           updatedAt: new Date(now).toISOString(),
237:     expiresAt: v.string(),
307:     await ctx.db.insert("employeeSessions", {
312:       createdAt: now.toISOString(),
313:       lastUsedAt: now.toISOString(),
316:     await ctx.db.patch(auth._id, {
319:       updatedAt: now.toISOString(),
352:       await ctx.db.delete(session._id);
445:   returns: v.object({ wiped: v.number(), isDone: v.boolean(), continueCursor: v.string() }),
455:     return { wiped, isDone: page.isDone, continueCursor: page.continueCursor };
```

### convex/employeeFingerprints.ts

```text
26:     const value = { employeeId: args.employeeId, projectId: employee.projectId, fingerPrintID: args.fingerNo, encData: args.encData, iv: args.iv, keyVersion: args.keyVersion, sourceDeviceId: args.sourceDeviceId, enrolledBy: args.enrolledBy, addedAt: Date.now() };
29:       if (delivery.fingerNo === args.fingerNo && delivery.deviceId !== args.sourceDeviceId && delivery.enrolledAt) await ctx.db.patch(delivery._id, { enrolledAt: "" });
31:     if (existing) await ctx.db.replace(existing._id, value);
32:     else await ctx.db.insert("employeeFingerprints", value);
```

### convex/employeeImport.ts

```text
18:   department: v.optional(v.string()), position: v.optional(v.string()), company: v.optional(v.string()), isActive: v.optional(v.boolean()),
47:     const results: { rowNumber: number; status: "created" | "skippedDuplicate" | "error"; message: string }[] = [];
70:       if (errors.length) { results.push({ rowNumber: row.rowNumber, status: "error", message: errors.join("; ") }); continue; }
94:       if (duplicateMessage) { results.push({ rowNumber: row.rowNumber, status: "skippedDuplicate", message: duplicateMessage }); continue; }
95:       if (args.dryRun) { results.push({ rowNumber: row.rowNumber, status: "created", message: "İçe aktarmaya hazır" }); continue; }
97:       const employeeId = await ctx.db.insert("employees", {
103:         isActive: row.isActive ?? true, createdAt: now, updatedAt: now,
109:       results.push({ rowNumber: row.rowNumber, status: "created", message: "Kişi oluşturuldu" });
131:     const results: { employeeId: string; status: "assigned" | "error"; message: string }[] = [];
137:         results.push({ employeeId: assignment.employeeId, status: "error", message: "Kişiye erişim yetkiniz yok" });
147:         results.push({ employeeId: assignment.employeeId, status: "error", message: "Kart numarası biçimi geçersiz" });
152:         results.push({ employeeId: assignment.employeeId, status: "error", message: cardConflictMessage(cardNumber, conflict, "Kart numarası başka bir kişide kullanılıyor") });
157:       await ctx.db.patch(employee._id, { cardNumber, updatedAt: new Date().toISOString() });
159:       results.push({ employeeId: assignment.employeeId, status: "assigned", message: "Kart atandı" });
```

### convex/employeeTermination.ts

```text
36:   await ctx.db.patch(employee._id, { isActive: false, updatedAt: now });
84:     const updates = { ...details, terminatedAt: now, terminatedBy: ctx.user._id, updatedAt: now };
85:     await ctx.db.patch(employeeId, updates);
92:     await writeAudit(ctx, { user: ctx.user, projectId: employee.projectId, action: "update", targetTable: "employees", targetId: employeeId, oldValue: employee, newValue: { ...updates, isActive: args.employmentEndDate < today ? false : employee.isActive }, note: "İşten ayrılma" });
105:     await ctx.db.patch(employeeId, {
107:       sgkExitCode: undefined, terminatedAt: undefined, terminatedBy: undefined,
108:       isActive: true, updatedAt: new Date().toISOString(),
189:     const targetEmployeeId = await ctx.db.insert("employees", {
194:       departmentId: args.departmentId, companyId, cardNumber: "", isActive: true, transferredFromEmployeeId: employee._id,
195:       createdAt: now, updatedAt: now,
197:     const transferId = await ctx.db.insert("accessTransfers", {
198:       kind: "employee", status: "revoking", sourceProjectId: employee.projectId, targetProjectId: args.targetProjectId,
202:       requestedBy: ctx.user._id, requestedAt: Date.now(), deadlineAt: Date.now() + TRANSFER_WINDOW_MS,
206:       await ctx.db.insert("accessTransferTargets", { transferId, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
208:     await ctx.db.patch(employee._id, { isActive: false, employmentEndDate: trTodayKey(), terminationType: "transfer", terminatedAt: now, terminatedBy: ctx.user._id, transferredToEmployeeId: targetEmployeeId, updatedAt: now });
210:     for (const member of memberships) await ctx.db.delete(member._id);
213:       for (const row of rows) await ctx.db.delete(row._id);
217:       await ctx.db.patch(transferId, { status: "revoked" });
238:     await ctx.db.patch(transferId, { status: "stuck", stuckReason: error, lastError: error });
241:   await ctx.db.patch(transferId, { status: "provisioning" });
243:   await ctx.db.patch(source._id, { cardNumber: "", transferredCardNumber: transfer.cardNumber, updatedAt: now });
244:   await ctx.db.patch(target._id, { cardNumber: transfer.cardNumber, departmentId: transfer.targetPlan.departmentId, companyId, updatedAt: now });
250:   await ctx.db.patch(transferId, { status: "done", completedAt: Date.now(), stuckReason: undefined, lastError: undefined });
252:   for (const projectId of [transfer.sourceProjectId, transfer.targetProjectId]) await writeAudit(ctx, { user, projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "done", employeeId: source._id, targetEmployeeId: target._id }, note: "Başka projeye taşıma tamamlandı" });
267:     await ctx.db.patch(transferId, { status: "cancelled", completedAt: Date.now() });
270:       if (row.state !== "confirmed" && row.state !== "deviceRemoved") await ctx.db.patch(row._id, { state: "superseded", lastError: "Taşıma iptal edildi", updatedAt: Date.now() });
273:         for (const op of ops) if ((op.operation === "deletePerson" || op.operation === "deleteCard") && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: "Taşıma iptal edildi" });
277:         for (const op of ops) if (op.opType === "deleteUser" && operationPayload(op.payload).employeeId === source._id) await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: "Taşıma iptal edildi" });
280:     await ctx.db.patch(source._id, { employmentEndDate: undefined, terminationType: undefined, terminationReason: undefined, sgkExitCode: undefined, terminatedAt: undefined, terminatedBy: undefined, transferredToEmployeeId: undefined, isActive: true, updatedAt: new Date().toISOString() });
288:     await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "cancelled" }, note: "Başka projeye taşıma iptal edildi" });
302:     await ctx.db.patch(transferId, { status: "revoking", deadlineAt: Date.now() + TRANSFER_WINDOW_MS, stuckReason: undefined, lastError: undefined });
307:       await ctx.db.patch(row._id, { state: "pending", lastError: undefined, updatedAt: Date.now() });
311:     await writeAudit(ctx, { user: ctx.user, projectId: source.projectId, action: "update", targetTable: "accessTransfers", targetId: transferId, newValue: { status: "revoking" }, note: "Başka projeye taşıma yeniden denendi" });
320:     for (const transfer of batch.page) await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "24 saat içinde tüm cihazlardan silme onayı alınamadı. Yeniden deneyin veya taşımayı iptal edin." });
353:       return { deviceId: target.deviceId, deviceName: device?.name ?? "Kaldırılan cihaz", brand: target.brand, state: target.state, lastSeen: device ? deviceLastSignal(device) ?? null : null, lastError: target.lastError ?? null, confirmedAt: target.confirmedAt ?? null };
355:     return { transferId: transfer._id, status: transfer.status, counterpartProjectName: counterpart?.name ?? "Silinen proje",
356:       requestedAt: transfer.requestedAt, deadlineAt: transfer.deadlineAt, completedAt: transfer.completedAt ?? null,
```

### convex/employees.ts

```text
96:     if (existing.source === "department") await ctx.db.patch(existing._id, { source: "manual" });
99:   await ctx.db.insert("groupMembers", {
103:     createdAt: new Date().toISOString(),
230:     accessStartsAt: v.optional(v.union(v.string(), v.null())),
231:     isActive: v.optional(v.boolean()),
262:     const id = await ctx.db.insert("employees", {
267:       accessStartsAt: normalizeEmployeeAccessStart(args.accessStartsAt),
268:       isActive: args.isActive ?? true,
269:       createdAt: now,
270:       updatedAt: now,
274:       targetId: id, newValue: { accessStartsAt: normalizeEmployeeAccessStart(args.accessStartsAt) }, note: "Erişim başlangıcı",
310:     accessStartsAt: v.optional(v.union(v.string(), v.null())),
311:     isActive: v.optional(v.boolean()),
338:     const accessStartsAt = updates.accessStartsAt === undefined ? emp.accessStartsAt : normalizeEmployeeAccessStart(updates.accessStartsAt);
388:     await ctx.db.patch(employeeId, { ...toPatch(updates), ...photo, updatedAt: new Date().toISOString() });
397:       if (auth) await ctx.db.patch(auth._id, {
398:         email: updates.email || undefined, setupToken: undefined, tokenExpiresAt: undefined, updatedAt: new Date().toISOString(),
404:       targetId: employeeId, oldValue: { accessStartsAt: emp.accessStartsAt ?? null },
405:       newValue: { accessStartsAt: accessStartsAt ?? null }, note: "Erişim başlangıcı",
472:     await Promise.all(groupMembers.map((gm) => ctx.db.delete(gm._id)));
478:         await ctx.db.delete(record._id);
485:     await ctx.db.delete(emp._id);
545:         await ctx.db.patch(emp._id, { departmentId: dept._id, updatedAt: new Date().toISOString() });
587:     return await ctx.db.insert("employeeAuth", {
593:       createdAt: now,
594:       updatedAt: now,
620:     await ctx.db.patch(args.employeeId, {
622:       updatedAt: new Date().toISOString(),
639:         isActive: v.optional(v.boolean()),
646:           tokenExpiresAt: v.union(v.string(), v.null()),
671:         isActive: employee.isActive,
678:             tokenExpiresAt: auth.tokenExpiresAt ?? null,
```

### convex/files.ts

```text
35:     await ctx.db.insert("pendingUploads", { ...args, userId: ctx.user._id, createdAt: Date.now() });
48:     await ctx.db.patch(ctx.user._id, {
50:       updatedAt: new Date().toISOString(),
52:     if (pending) await ctx.db.delete(pending._id);
83:         await ctx.db.delete(upload._id);
93:       await ctx.db.delete(upload._id);
```

### convex/fingerprintEnrollment.ts

```text
71:     enrollments: v.array(v.object({ _id: v.id("deviceFingerprintEnrollments"), deviceId: v.id("devices"), fingerNo: v.number(), enrolledAt: v.string(), deviceName: v.string() })),
72:     templates: v.array(v.object({ fingerNo: v.number(), enrolledAt: v.string(), deviceIds: v.array(v.id("devices")) })),
81:       _id: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, enrolledAt: row.enrolledAt,
85:       fingerNo: template.fingerPrintID, enrolledAt: new Date(template.addedAt).toISOString(),
90:       if (row.enrolledAt && !templates.some(template => template.fingerNo === row.fingerNo)) templates.push({ fingerNo: row.fingerNo, enrolledAt: row.enrolledAt, deviceIds: rows.filter(item => item.fingerNo === row.fingerNo && !!item.enrolledAt && item.deletionEmployeeNo === undefined).map(item => item.deviceId) });
138:     if (existing) await ctx.db.patch(existing._id, state);
139:     else await ctx.db.insert("deviceFingerprintEnrollments", { ...args, projectId: employee.projectId, enrolledAt: "", enrolledBy: ctx.user._id, ...state });
151:     if (row?.attemptId === args.attemptId) await ctx.db.patch(row._id, { cancelRequested: true });
173:     await ctx.db.patch(op._id, { status: "done", completedAt: now, lastError: undefined });
184:     await ctx.db.patch(row._id, { enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber.trim(), enrolledBy: args.enrolledBy, attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
196:       if (!row.enrolledAt || args.clearEnrolled) await ctx.db.delete(row._id);
197:       else await ctx.db.patch(row._id, { attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined });
212: export const remove = internalMutation({ args: { enrollmentId: v.id("deviceFingerprintEnrollments") }, returns: v.null(), handler: async (ctx, args) => { if (await ctx.db.get(args.enrollmentId)) await ctx.db.delete(args.enrollmentId); return null; } });
261:   args: { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), templateId: v.id("employeeFingerprints"), addedAt: v.number(), expectedCardNumber: v.string(), attemptId: v.string(), enrolledBy: v.optional(v.id("users")) },
271:     const value = { employeeId: args.employeeId, projectId: employee.projectId, deviceId: args.deviceId, fingerNo: args.fingerNo, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber.trim(), enrolledBy, deletionEmployeeNo: undefined, deletionRequestedAt: undefined, attemptId: undefined, pendingUntil: undefined, cancelRequested: undefined };
272:     await ctx.db.patch(row._id, value);
296:   args: { ...targetArgs, templateId: v.id("employeeFingerprints"), addedAt: v.number(), expectedCardNumber: v.string(), force: v.optional(v.boolean()) },
307:     const state = { attemptId: crypto.randomUUID(), pendingUntil: Date.now() + 180_000, cancelRequested: false, deletionEmployeeNo: employee.cardNumber.trim(), deletionRequestedAt: Date.now() };
308:     const enrollmentId = row ? row._id : await ctx.db.insert("deviceFingerprintEnrollments", { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: "", enrolledBy: template.enrolledBy, ...state });
309:     if (row) await ctx.db.patch(row._id, state);
320:     await ctx.db.patch(row._id, { deletionEmployeeNo: args.employeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), pendingUntil: undefined, cancelRequested: true });
```

### convex/hikBridge.ts

```text
29:     await ctx.db.patch(bridge._id, { nextWakeAt: plan.fireAt });
44:     const bridgeId = await ctx.db.insert("hikBridges", {
48:       createdAt: Date.now(),
66:       lastSeenAt: b.lastSeenAt ?? null,
68:       createdAt: b.createdAt,
79:     await ctx.db.delete(args.bridgeId);
```

### convex/hikDeviceImport.ts

```text
62:     const employeeId = await ctx.db.insert("employees", {
64:       projectId: device.projectId, ...validity, ...(row.cards.length === 0 ? { hikCardless: true } : {}), createdAt: now, updatedAt: now,
75:         ruleId = await ctx.db.insert("accessRules", { name, projectId: device.projectId, isActive: true, startTime: "00:00", endTime: "23:59", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], createdAt: now, updatedAt: now });
76:         await ctx.db.insert("groupDevices", { groupId: ruleId, deviceId: args.deviceId, projectId: device.projectId, createdAt: now });
110:     const value = { employeeId: args.employeeId, deviceId: args.deviceId, projectId: employee.projectId, fingerNo: args.fingerNo, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: employee.cardNumber, enrolledBy: user._id };
111:     if (existing) await ctx.db.patch(existing._id, value);
112:     else await ctx.db.insert("deviceFingerprintEnrollments", value);
113:     await ctx.db.insert("employeeFingerprints", { employeeId: args.employeeId, projectId: employee.projectId, fingerPrintID: args.fingerNo, encData: args.encData, iv: args.iv, keyVersion: args.keyVersion, sourceDeviceId: args.deviceId, enrolledBy: args.userId, addedAt: Date.now() });
```

### convex/hikvisionSync.ts

```text
87:     return employee ? { isActive: employee.isActive, terminationType: employee.terminationType, projectId: employee.projectId, cardNumber: employee.cardNumber } : null;
171:       isActive: employee.isActive,
172:       accessStartsAt: employee.accessStartsAt,
173:       accessExpiresAt: employee.accessExpiresAt,
266:         isActive: rule.isActive,
294:     await ctx.db.patch(rule._id, { hikWeekPlanNo: weekPlanNo });
398:     await ctx.db.insert("hikPendingOperations", {
403:       status: "failed",
406:       createdAt: Date.now(),
421:     const id = await ctx.db.insert("hikPendingOperations", {
424:       status: "failed", attemptCount: 0, createdAt: Date.now(), lastError: "Silme onayı bekleniyor — cihazda kalmış olabilir",
477:         await ctx.db.patch(existing._id, {
480:           status: "pending",
482:           nextRetryAt: now,
483:           processingStartedAt: undefined,
484:           completedAt: undefined,
493:     const opId = await ctx.db.insert("hikPendingOperations", {
499:       status: "pending",
501:       nextRetryAt: now,
502:       createdAt: now,
572:           ctx.db.patch(op._id, {
573:             status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
574:             nextRetryAt: now,
592:         await ctx.db.patch(op._id, { status: "done", completedAt: now, lastError: TRANSFER_INVALID_OPERATION });
597:         await ctx.db.patch(op._id, { status: "failed", lastError: "MOBILE_COMMAND_NOT_DELIVERABLE" });
603:         await ctx.db.patch(op._id, { status: "failed", attemptCount: 5, lastError: "Biyometri modülü kapalı; işlem gönderilmedi." });
607:         await ctx.db.patch(op._id, { status: "failed", lastError: deletionUnresolvableReason(op, device) });
621:         ctx.db.patch(op._id, {
622:           status: "processing",
624:           processingStartedAt: now,
644:         createdAt: op.createdAt,
691:       await ctx.db.patch(args.opId, {
692:         status: "done",
693:         completedAt: Date.now(),
701:     await ctx.db.patch(args.opId, {
702:       status: "failed",
732:         ctx.db.patch(op._id, {
733:           status: mobileOperationId(op.payload) !== undefined ? "failed" : "pending",
734:           nextRetryAt: now,
765:         status: op.status, lastError: op.lastError ?? null, createdAt: op.createdAt,
766:         nextRetryAt: op.nextRetryAt,
794:         oldValue: { status: op.status }, newValue: { status: op.status, dismissedAt: now }, note: `Çözülemez silme uyarısı açıkça kapatıldı: ${reason}` });
797:     await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
822:       if (device?.hikTransport !== "localBridge") await ctx.db.patch(op._id, { status: "failed", nextRetryAt: now, lastError: "İşlem zaman aşımına uğradı; yeniden denenecek" });
839:             await ctx.db.patch(f._id, { status: "done", completedAt: now, lastError: TRANSFER_INVALID_OPERATION });
844:             await ctx.db.patch(f._id, { nextRetryAt: Number.MAX_SAFE_INTEGER });
850:             await ctx.db.patch(f._id, { nextRetryAt: permanent ? Number.MAX_SAFE_INTEGER : now + 3 * 60 * 1000 });
897:                   accessStartsAt: employee.accessStartsAt,
898:                   accessExpiresAt: employee.accessExpiresAt,
912:     for (const candidate of candidates) if (isTransferAddition(candidate)) await ctx.db.patch(candidate._id, { status: "processing", processingStartedAt: now });
924:     await ctx.db.patch(args.id, { status: "done", completedAt: Date.now(), lastError: args.reason });
937:     await ctx.db.patch(args.id, {
938:       status: "done",
939:       completedAt: Date.now(),
1000:         if (args.cardNumber && ["deletePerson", "deleteCard"].includes(f.operation)) writes.push(ctx.db.patch(f._id, { dismissedAt: now }));
1004:         ctx.db.patch(f._id, { status: "done", completedAt: now }),
1026:     await ctx.db.patch(args.id, {
1027:       status: "failed",
1030:       dismissedAt: undefined,
1078:         patches.push(ctx.db.patch(f._id, { status: "done", completedAt: now, dismissedAt: now }));
1108:       await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
1137:       await ctx.db.patch(op._id, { status: "failed", nextRetryAt: Date.now(), attemptCount: 0, dismissedAt: undefined, dismissedBy: undefined });
1142:     await ctx.db.patch(op._id, {
1143:       status: "pending", nextRetryAt: Date.now(),
1144:       attemptCount: 0, processingStartedAt: undefined, completedAt: undefined, claimedBy: undefined,
1145:       dismissedAt: undefined, dismissedBy: undefined, lastError: undefined,
1188:   await ctx.db.patch(id, { status: "done", completedAt: Date.now(), lastError: SUPERSEDED_DELETION });
```

### convex/holidays.ts

```text
68:     isHalfDay: v.optional(v.boolean()),
81:     const id = await ctx.db.insert("holidays", {
85:       isHalfDay: args.isHalfDay ?? false,
86:       createdAt: new Date().toISOString(),
95:       newValue: { date: args.date, name: args.name, isHalfDay: args.isHalfDay },
107:     await ctx.db.delete(args.id);
115:       oldValue: { date: old.date, name: old.name, isHalfDay: old.isHalfDay },
146:         await ctx.db.insert("holidays", {
150:           isHalfDay: h.isHalfDay ?? false,
152:           createdAt: new Date().toISOString(),
```

### convex/ideDefaults.ts

```text
47:       await ctx.db.patch(existing._id, {
51:         updatedAt: now,
55:     return await ctx.db.insert("ideDefaults", {
59:       updatedAt: now,
```

### convex/ideSync.ts

```text
123: export function ideUserStartFromAccessStart(accessStartsAt: string | undefined, now: number): number {
195:     await ctx.db.patch(existing._id, { deviceId, projectId, syncedAt: Date.now() });
197:     await ctx.db.insert("idePanelUsers", {
203:       syncedAt: Date.now(),
218:   if (existing) await ctx.db.delete(existing._id);
338:         await ctx.db.patch(open._id, {
341:           status: doorError ? "failed" : "pending",
343:           nextRetryAt: now,
351:     const opId = await ctx.db.insert("idePendingOperations", {
357:       status: doorError ? "failed" : "pending",
362:       nextRetryAt: now,
363:       createdAt: now,
377:   const expiresAt = payload && typeof payload === "object" ? (payload as Record<string, unknown>).expiresAt : undefined;
378:   return (typeof expiresAt === "number" ? expiresAt : op.createdAt + 30_000) <= now;
433:   await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), responseMessage: "superseded: Kart aktif bir kişinin güncel kimliği; silme atlandı", lastError: undefined });
475:         ...(op.opType === "openDoor" ? { expiresAt: typeof payload.expiresAt === "number" ? payload.expiresAt : op.createdAt + 30_000 } : {}),
495:       await ctx.db.patch(op._id, { status: "pending", sentAt: undefined, nextRetryAt: Date.now() });
501:         await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
510:         await ctx.db.patch(op._id, { status: "failed", lastError: reason });
522:         await ctx.db.patch(op.opId, { status: "sent", msxId: undefined, sentAt: Date.now(), nextRetryAt: Date.now() + DEFAULT_ACK_TIMEOUT_MS, attempts: queued.attempts + (op.opType === "upsertUser" ? 0 : 1) });
541:       await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
549:       await ctx.db.patch(op._id, { status: "failed", lastError: "Komut süresi doldu" });
552:     await ctx.db.patch(args.opId, {
553:       status: "sent",
555:       sentAt: Date.now(),
556:       nextRetryAt: Date.now() + DEFAULT_ACK_TIMEOUT_MS,
622:       await ctx.db.patch(args.opId, {
623:         status: "acked",
624:         ackedAt: Date.now(),
664:         await ctx.db.patch(args.opId, {
666:           status: "pending",
668:           nextRetryAt: Date.now(),
682:       await ctx.db.patch(args.opId, {
683:         status: "acked",
684:         ackedAt: Date.now(),
703:       await ctx.db.patch(args.opId, {
704:         status: "failed",
708:       await ctx.db.patch(args.opId, {
709:         status: "pending",
711:         nextRetryAt: Date.now() + backoffMs(op.attempts),
738:           await ctx.db.patch(op._id, { status: "failed", lastError: "ack timeout (cron)" });
742:           await ctx.db.patch(op._id, {
743:             status: "pending",
745:             nextRetryAt: now,
751:         await ctx.db.patch(op._id, { nextRetryAt: deadline });
792:       const id = await ctx.db.insert("ideSequences", { name: "permissionNo", last });
800:     await ctx.db.patch(sequence._id, { last });
805:   if (primary !== rule.idePermissionNo || JSON.stringify(patch.ideExtraPermissionNos) !== JSON.stringify(rule.ideExtraPermissionNos ?? [])) await ctx.db.patch(rule._id, patch);
885:         status: op.status, lastError: op.lastError ?? null, createdAt: op.createdAt,
886:         nextRetryAt: op.nextRetryAt,
903:         status: o.status,
922:     await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, Date.now()));
946:       await ctx.db.patch(op._id, syncDismissPatch(ctx.user._id, now));
968:     await ctx.db.patch(op._id, {
969:       status: "pending", nextRetryAt: Date.now(),
970:       attempts: 0, msxId: undefined, sentAt: undefined, ackedAt: undefined, responseMessage: undefined,
971:       dismissedAt: undefined, dismissedBy: undefined, lastError: undefined,
```

### convex/invites.ts

```text
125:         await ctx.db.patch(existing._id, { used: true });
132:     await ctx.db.insert("invites", {
141:       createdAt: new Date().toISOString(),
159:       expiresAt: v.string(),
178:       expiresAt: invite.expiresAt,
187:     v.object({ state: v.literal("none"), email: v.string() }),
188:     v.object({ state: v.literal("claimable"), email: v.string(), userId: v.id("users") }),
189:     v.object({ state: v.literal("taken") }),
201:     if (!account) return { state: "none" as const, email: invite.email };
204:       return { state: "claimable" as const, email: invite.email, userId: user._id };
206:     return { state: "taken" as const };
222:     await ctx.db.patch(user._id, {
226:       tokenExpiresAt: undefined,
227:       updatedAt: new Date().toISOString(),
237:     const state:
238:       | { state: "none"; email: string }
239:       | { state: "claimable"; email: string; userId: Id<"users"> }
240:       | { state: "taken" } = await ctx.runQuery(internal.invites.setupAccountState, { token: args.token });
296:       await ctx.db.patch(invite._id, { used: true });
319:       await ctx.db.patch(user._id, {
321:         updatedAt: new Date().toISOString(),
338:       await ctx.db.insert("userProjects", {
342:         createdAt: new Date().toISOString(),
347:     await ctx.db.patch(invite._id, { used: true });
366:       expiresAt: v.string(),
387:       expiresAt: r.expiresAt,
400:       expiresAt: v.string(),
402:       createdAt: v.string(),
429:     expiresAt: v.string(),
444:       expiresAt: r.expiresAt,
464:       await ctx.db.delete(r._id);
```

### convex/leaveRequests.ts

```text
36:     const id = await ctx.db.insert("leaves", { employeeId: employee._id, projectId: employee.projectId, ...args, status: "pending", source: "employee", createdAt: now, updatedAt: now });
37:     await writeAudit(ctx, { user: null, projectId: employee.projectId, action: "create", targetTable: "leaves", targetId: id, newValue: { actorType: "employee", employeeId: employee._id, status: "pending" }, note: "Çalışan talebi" });
48:     await ctx.db.delete(leaveId);
49:     await writeAudit(ctx, { user: null, projectId: leave.projectId, action: "delete", targetTable: "leaves", targetId: leaveId, oldValue: { actorType: "employee", employeeId: ctx.employee._id, status: leave.status }, note: "Çalışan talebi" });
58:     status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
59:     notes: v.optional(v.string()), decisionNote: v.optional(v.string()), decidedAt: v.optional(v.string()),
60:     source: v.optional(v.union(v.literal("admin"), v.literal("employee"))), createdAt: v.string(),
157:   status: "approved" | "rejected",
189:     decidedAt: now,
192:   await ctx.db.patch(leaveId, patch);
199:     oldValue: { status: leave.status },
```

### convex/leaves.ts

```text
84:       calendarDays: days, status: leave.status, notes: notesHidden ? undefined : leave.notes, notesHidden,
85:       createdAt: leave.createdAt, updatedAt: leave.updatedAt,
93:   status: v.optional(statusValidator),
195:     return await ctx.db.insert("leaves", {
199:       createdAt: now,
200:       updatedAt: now,
212:     expectedUpdatedAt: v.string(),
233:     await ctx.db.patch(leave._id, {
245:     leaveType: leaveTypeValidator, status: statusValidator,
260:           leaveType: leave.leaveType, status: leave.status,
```

### convex/lib/accessRuleRead.ts

```text
112:       isActive: rule.isActive,
```

### convex/lib/accessRuleSummary.ts

```text
36:   isActive: boolean | undefined,
37:   status: "all" | "active" | "inactive",
76:     isDone: remaining.length <= numItems,
96: ): { phase: "active" | "legacy"; cursor: string | null } {
97:   if (!cursor) return { phase: "active", cursor: null };
111:   return { phase: value.phase, cursor: value.cursor };
122:   status: "all" | "active" | "inactive",
136:   fetch: (stage: number, cursor: string | null) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>,
148:   if (phase === stages) return { page: [] as T[], isDone: true, continueCursor: "" };
152:   return { ...result, isDone: phase === stages, continueCursor: phase === stages ? "" : JSON.stringify({ scope, phase, cursor: null }) };
```

### convex/lib/accessRuleWrite.ts

```text
58:   const ruleId = await ctx.db.insert("accessRules", {
60:     isActive: ruleData.isActive ?? true,
61:     createdAt: now,
62:     updatedAt: now,
69:         ctx.db.insert("groupMembers", {
73:           createdAt: now,
83:         ctx.db.insert("groupDevices", {
87:           createdAt: now,
98:         await ctx.db.insert("groupDoors", {
103:           createdAt: now,
```

### convex/lib/accessTransfer.ts

```text
73:       await ctx.db.patch(op._id, { status: "done", completedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
76:       await ctx.db.patch(op._id, { status: "acked", ackedAt: Date.now(), lastError: TRANSFER_INVALID_OPERATION });
```

### convex/lib/adminGuards.ts

```text
19:   isSelf: boolean;
20:   isSuperAdmin: boolean;
```

### convex/lib/adminLists.ts

```text
33:   _id: Doc<"projects">["_id"]; name: string; isActive: boolean;
37:     email: user.email ?? "", role: user.role ?? null, projects, isSelf: user._id === selfId,
38:     disabledAt: user.disabledAt, accessExpiresAt: user.accessExpiresAt,
40:     pendingSetup: user.verified === false, setupExpiresAt: user.tokenExpiresAt,
52:     assignedProjectId: device.assignedProjectId, createdAt: device.createdAt,
53:     updatedAt: device.updatedAt, assignedProjectName,
```

### convex/lib/alarmNotify.ts

```text
51:     await ctx.db.patch(eventId, { alarmQueuedAt: notifiedAt, alarmEmailStatus: "queued", alarmEmailAttempts: 0, alarmEmailRecipients: settings.recipients, updatedAt: notifiedAt });
52:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
54:     await ctx.db.patch(eventId, { alarmEmailStatus: "failed", alarmEmailError: "Alarm e-postası zamanlanamadı", alarmEmailAttemptAt: notifiedAt, updatedAt: notifiedAt });
55:     await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
```

### convex/lib/audit.ts

```text
29:   await ctx.db.insert("auditLog", {
```

### convex/lib/auditActors.ts

```text
9:   status: AuditActorStatus;
57:     const status: AuditActorStatus = !user ? "deleted"
61:     return { userId, label, status, ...(event ? { lastSeenAt: event.timestamp } : {}) };
```

### convex/lib/auth.ts

```text
154:   await ctx.db.patch(userId, {
157:     tokenExpiresAt: undefined,
158:     updatedAt: new Date().toISOString(),
```

### convex/lib/biometricDestructionState.ts

```text
9:   const state: unknown = row?.newValue;
```

### convex/lib/cardReaderParse.ts

```text
451:   readonly status: 400 | 413;
452:   constructor(status: 400 | 413, message: string) { super(message); this.status = status; }
```

### convex/lib/departmentAccess.ts

```text
49:   for (const link of previous) await ctx.db.delete(link._id);
50:   for (const selection of unique.values()) await ctx.db.insert("groupDepartments", { ...selection, groupId, projectId });
81:   for (const member of removed) await ctx.db.delete(member._id);
85:     await ctx.db.insert("groupMembers", { projectId, groupId, employeeId, source: "department", createdAt: now });
```

### convex/lib/deviceAssignment.ts

```text
150:     await ctx.db.patch(args.adminDeviceId, { name: newName, updatedAt: now });
156:       await ctx.db.patch(adminDevice.assignedDeviceId, {
158:         updatedAt: now,
179:     await ctx.db.patch(args.adminDeviceId, {
182:       updatedAt: now,
226:         await ctx.db.delete(adminDeviceId);
228:         await ctx.db.patch(adminDeviceId, {
232:           updatedAt: new Date().toISOString(),
245:         await ctx.db.delete(existing._id);
247:         await ctx.db.patch(existing._id, {
250:           updatedAt: new Date().toISOString(),
```

### convex/lib/deviceConnection.ts

```text
26:     return device.hikIsupOnline ? device.hikIsupStatusAt : device.hikIsupOfflineSince;
53:     await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
62:   await ctx.db.insert("deviceEvents", {
66:     eventTime: now, createdAt: now, updatedAt: now,
71:     await ctx.db.patch(previous._id, { resolvedAt: now, updatedAt: now,
73:     await ctx.db.patch(device._id, { heartbeatOfflineEventId: undefined });
76:   const eventId = await ctx.db.insert("deviceEvents", {
80:     eventTime: now, createdAt: now, updatedAt: now, resolvedAt: now,
98:   await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
103: export async function checkHeartbeatOffline(ctx: MutationCtx, args: { deviceId: Id<"devices">; checkAt: number }): Promise<void> {
107:     await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
113:     await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
118:     await ctx.db.patch(device._id, { heartbeatCheckAt: checkAt });
122:   await ctx.db.patch(device._id, { heartbeatCheckAt: undefined });
128:   const eventId = await ctx.db.insert("deviceEvents", {
132:     eventTime: now, createdAt: now, updatedAt: now,
134:   await ctx.db.patch(device._id, { heartbeatOfflineEventId: eventId });
```

### convex/lib/deviceHelpers.ts

```text
24:     await Promise.all(links.map((link) => ctx.db.delete(link._id)));
46:   await Promise.all(groupDevices.map((gd) => ctx.db.delete(gd._id)));
55:   await Promise.all(ownedDoors.map((d) => ctx.db.delete(d._id)));
65:   await Promise.all(pendingOps.map((op) => ctx.db.delete(op._id)));
68:   await ctx.db.delete(deviceId);
75:   for (const row of rows) await ctx.db.delete(row._id);
128:   return await ctx.db.insert("zones", {
132:     createdAt: opts.now,
133:     updatedAt: opts.now,
152:   return await ctx.db.insert("readers", {
161:     status: "active",
162:     createdAt: opts.now,
163:     updatedAt: opts.now,
200:     const doorId = await ctx.db.insert("doors", {
206:       status: "active",
207:       createdAt: opts.now,
208:       updatedAt: opts.now,
263:     const doorId = await ctx.db.insert("doors", {
269:       status: "active",
270:       createdAt: opts.now,
271:       updatedAt: opts.now,
```

### convex/lib/devicePool.ts

```text
45:   const deviceId = await ctx.db.insert("devices", {
55:     isActive: true,
56:     status: "active",
60:     createdAt: now,
61:     updatedAt: now,
76:   await ctx.db.patch(deviceId, { zoneId, updatedAt: now });
80:   await ctx.db.patch(adminDevice._id, {
85:     updatedAt: now,
```

### convex/lib/deviceProvision.ts

```text
149:   const deviceId = await ctx.db.insert("devices", {
154:     isActive: deviceActive(args.status, args.isActive),
155:     status: deviceActive(args.status, args.isActive) ? "active" : "inactive",
156:     createdAt: now,
157:     updatedAt: now,
159:   const adminDeviceId = await ctx.db.insert("adminDevices", {
171:     createdAt: now,
172:     updatedAt: now,
174:   await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });
218:   const deviceId = await ctx.db.insert("devices", {
231:     isActive: deviceActive(args.status),
232:     status: deviceActive(args.status) ? "active" : "inactive",
234:     createdAt: now,
235:     updatedAt: now,
249:   await ctx.db.patch(deviceId, { zoneId, updatedAt: now });
252:   const adminDeviceId = await ctx.db.insert("adminDevices", {
263:     createdAt: now,
264:     updatedAt: now,
266:   await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });
320:   const deviceId = await ctx.db.insert("devices", {
336:     isActive: deviceActive(args.status),
337:     status: deviceActive(args.status) ? "active" : "inactive",
339:     createdAt: now,
340:     updatedAt: now,
359:   await ctx.db.patch(deviceId, { zoneId, updatedAt: now });
363:   const adminDeviceId = await ctx.db.insert("adminDevices", {
370:     createdAt: now,
371:     updatedAt: now,
373:   await ctx.db.patch(deviceId, { adminDeviceId, updatedAt: now });
```

### convex/lib/doorTargetSync.ts

```text
64:     for (const link of before.links) await ctx.db.patch(link._id, { deviceId: after.deviceId });
71:         for (const link of deviceLinks.filter(link => link.deviceId === before.door.deviceId)) await ctx.db.delete(link._id);
74:         await ctx.db.insert("groupDevices", { projectId, groupId: rule._id, deviceId: after.deviceId, createdAt: new Date(now).toISOString() });
83:     await ctx.db.patch(rule._id, { updatedAt: new Date(now).toISOString() });
84:     const runId = await ctx.db.insert("deviceSyncRuns", { projectId, ruleId: rule._id, kind: "rule_sync", startedBy, startedAt: now, status: "running", dispatchFinished: true, counts: summarizeRun([], false).counts });
88:       const targetId = await ctx.db.insert("deviceSyncRunTargets", { runId, deviceId: device._id, deviceName: device.name, brand: device.brand ?? "other", status: "queued", dispatchFinished: true, updatedAt: now });
90:         await ctx.db.patch(targetId, { dispatchFinished: false });
95:         await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "pending", lastRunId: runId });
99:         const operationId = await ctx.db.insert("hikPendingOperations", {
100:           projectId, deviceId: device._id, runId, operation: "updatePerson", status: "processing", processingStartedAt: now, attemptCount: 0, createdAt: now, nextRetryAt: now,
106:         await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "pending", lastRunId: runId, lastOperationId: operationId });
126:           await ctx.db.patch(targetId, { dispatchFinished: false });
129:           await ctx.db.patch(targetId, { dispatchFinished: false });
133:           for (const employee of employees) await upsertGrantStatus(ctx, { projectId, employeeId: employee._id, deviceId: device._id, state: "removed", lastRunId: runId });
136:       if (!employees.length && device.brand === "hikvision") await ctx.db.patch(targetId, { status: "skipped", reason: "Etkilenen kişi yok" });
```

### convex/lib/emailVerification.ts

```text
11:   expiresAt: string;
32:       expiresAt: existing.tokenExpiresAt,
39:     expiresAt: new Date(nowMs + TOKEN_TTL_MS).toISOString(),
```

### convex/lib/employeeAuth.ts

```text
47:   await ctx.db.patch(auth._id, {
52:     tokenExpiresAt: undefined,
53:     updatedAt: new Date().toISOString(),
```

### convex/lib/employeeCardChange.ts

```text
43:       if (options.fingerNo === undefined || template.fingerPrintID === options.fingerNo) await ctx.db.delete(template._id);
51:     await ctx.db.patch(row._id, { deletionEmployeeNo: oldEmployeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), cancelRequested: true });
```

### convex/lib/employeeCascade.ts

```text
18:     await ctx.db.patch(row._id, { ...values, note: "Kişi kaydı silindi; geçmiş kişisel veri kopyası kaldırıldı",
42:     await ctx.db.patch(reading._id, { employeeName: "[silindi]", cardNo: hashCardNo(reading.cardNo) });
62:   for (const token of tokens) await ctx.db.delete(token._id);
81:     await ctx.db.patch(visitor._id, {
122:   for (const period of departmentHistory) await ctx.db.delete(period._id);
135:     if (correction.status === "pending") await ctx.db.patch(correction._id, {
136:       status: "withdrawn", decisionNote: "Kişi kaydı silindi", decidedAt,
137:       decidedBy: undefined, updatedAt: decidedAt,
141:     if (leave.source === "employee" && leave.status === "pending") await ctx.db.delete(leave._id);
151:     await ctx.db.delete(f._id);
174:       await ctx.db.patch(c._id, { revokedAt: now });
```

### convex/lib/employeeDepartmentHistory.ts

```text
12:   if ((previous.departmentId || employee.departmentId) && !employee.hasDepartmentHistory) await ctx.db.patch(employee._id, { hasDepartmentHistory: true });
14:   if (!existing) await ctx.db.insert("employeeDepartmentHistory", {
16:     validFrom: "0001-01-01", source: "baseline", createdAt: new Date().toISOString(),
25:   else if (employee.departmentId && !employee.hasDepartmentHistory) await ctx.db.patch(employee._id, { hasDepartmentHistory: true });
29:   if (existing) await ctx.db.patch(existing._id, fields);
30:   else await ctx.db.insert("employeeDepartmentHistory", { ...fields, projectId: employee.projectId, employeeId, validFrom, source: "change", createdAt: new Date().toISOString() });
```

### convex/lib/gateway/capabilities.ts

```text
25:   updatedAt: number;
232:     updatedAt: Date.now(),
```

### convex/lib/gateway/devices.ts

```text
447:     status: {
```

### convex/lib/gateway/persons.ts

```text
70: export function hikValidBeginFromAccessStart(accessStartsAt: string | undefined, now: number): string | undefined {
```

### convex/lib/gatewayBackfill.ts

```text
27: function recoveryStartTime(completedAt: number | undefined, previousStart?: string): string {
112:       startedAt: Date.now(), maxPages, failCount: 0,
241:         startedAt: args.startedAt, maxPages: args.maxPages,
242:         ...(args.lastProgressAt !== undefined ? { lastProgressAt: args.lastProgressAt } : {}),
245:         ...(args.lastEventAt !== undefined ? { lastEventAt: args.lastEventAt } : {}),
252:     ...args, continuation: { ...args, ...pending }, progressAt: device.hikLastBackfillAt,
337:       progressAt: device.hikLastBackfillAt,
370:         progressAt: dev.hikLastBackfillAt,
```

### convex/lib/gatewayCommand.ts

```text
293:       updatedAt: snapshot.updatedAt,
382:       updatedAt: number;
418:         updatedAt: number;
432:       updatedAt: Date.now(),
444:     return { ok: true, status: workStatus };
638:         updatedAt: snapshot.updatedAt,
```

### convex/lib/grantStatus.ts

```text
16: export function grantStale(appliedAt: number | undefined, updated: (string | undefined)[]): boolean {
105:   state: GrantState; ruleIds?: Id<"accessRules">[]; lastError?: string; lastRunId?: Id<"deviceSyncRuns">; lastOperationId?: string;
122:           await writeAudit(ctx, { user: null, projectId: transfer.sourceProjectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId: device._id, state: "failed" }, note: `Taşıma sırasında geç yazım yakalandı; silme kuyruğa alınamadı: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) });
127:         if (row) await ctx.db.patch(row._id, { state: "pending", confirmedAt: undefined, updatedAt: Date.now() });
128:         else if (device.brand === "hikvision" || device.brand === "ide_smart") await ctx.db.insert("accessTransferTargets", { transferId: transfer._id, employeeId: employee._id, deviceId: device._id, brand: device.brand, state: "pending", updatedAt: Date.now() });
129:         if (transfer.status === "revoked") await ctx.db.patch(transfer._id, { status: "revoking" });
130:         await writeAudit(ctx, { user: null, projectId: transfer.sourceProjectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId: device._id, state: "pending" }, note: "Taşıma sırasında geç yazım yakalandı; cihaz silmesi yeniden kuyruğa alındı" });
157:     appliedAt: args.state === "effective" ? now : existing?.appliedAt, updatedAt: now };
158:   if (existing) await ctx.db.patch(existing._id, value);
159:   else await ctx.db.insert("accessGrantStatus", value);
166: }, state: GrantState, lastError?: string) {
212:     ...(typeof payload.grantError === "string" && state === "effective" ? { state: "failed", lastError: payload.grantError } : {}) });
```

### convex/lib/hikDeviceImport.ts

```text
16:   if (valid?.enable === false) return { isActive: true };
22:     isActive: intervalValid && Date.parse(accessExpiresAt) > now,
27: export type ImportRow = ImportPerson & { status: "new" | "matched" | "conflict" | "manual"; matchedEmployeeId?: Id<"employees">; storedFingerCount?: number; reason?: string };
33:   if (relevant.some(employee => employee._id !== match?._id)) return { ...person, status: "conflict", reason: "Kart numarası başka bir kayıtta kullanılıyor." };
34:   if (match) return { ...person, status: "matched", matchedEmployeeId: match._id };
35:   if (person.cards.length > 1 || (person.cards.length === 1 && person.cards[0] !== person.employeeNo)) return { ...person, status: "manual", reason: "Cihaz kişi numarası ve kartları elle eşleştirilmeli." };
36:   return { ...person, status: "new" };
```

### convex/lib/hikSyncEmployee.ts

```text
145:   // (Valid.enable cihazda true olarak yazılıydı). isActive: false olunca delete tetiklenir.
382:       state: result.grantRemoved ? "removed" as const : result.ok && !result.grantError ? "effective" as const : "failed" as const,
```

### convex/lib/leaveRules.ts

```text
11:   return { status: "approved" as const, approvedBy: user._id };
19:   status: "approved" | "rejected",
21:   updatedAt: string,
```

### convex/lib/mobileVisitors.ts

```text
67:   return { ...fields, visitorPhone: optionalField(input.visitorPhone, 40, false), notes: optionalField(input.notes, 1000, true), accessStartsAt: new Date(start).toISOString(), accessExpiresAt: new Date(end).toISOString() };
82:     status: visitorStatus(visitor, now), canEdit: editableInvitation(visitor),
95:     presence: presence.presence, lastSeenAt: presence.lastReadingAt,
127: export function mobileVisitorMatches(visitor: Doc<"employees">, search: string, status: MobileVisitorStatus | undefined, now: number) {
134:   evaluatedAt: number;
138:   if (value === null) return { cursor: null, evaluatedAt: Date.now() };
147:   return { cursor: parsed.cursor, evaluatedAt: parsed.evaluatedAt };
150: export function encodeVisitorCursor(cursor: string, host: Doc<"employees">, search: string, status: MobileVisitorStatus | undefined, evaluatedAt: number) {
151:   return JSON.stringify({ version: 1, host: host._id, project: host.projectId, search, status: status ?? null, evaluatedAt, cursor });
155: export interface VisitorSyncEvidence { status: VisitorSyncStatus; observedAt: number; bounded: boolean }
166:   const unknown = (bounded = false): VisitorSyncEvidence => ({ status: "unknown", observedAt, bounded });
251:   const status: VisitorSyncStatus = statuses.includes("failed") ? "failed" : statuses.includes("pending") ? "pending" :
```

### convex/lib/pdksCalc.ts

```text
71:   isLate: boolean,
87:   isEarlyExit: boolean,
124:   isLate: boolean;
161:   let status: DayStatus = "absent";
```

### convex/lib/pdksHelpers.ts

```text
219: ): { isLate: boolean; isEarlyExit: boolean } {
```

### convex/lib/pdksManualWrite.ts

```text
33:   const values = { entryTime: input.entryTime, exitTime: input.exitTime, status, manualEntry: true, manualNote: input.note, editedBy: user._id, editedAt: Date.now(), updatedAt: now };
36:     await ctx.db.patch(existing._id, values);
40:         oldValue: { date: existing.date, entryTime: existing.entryTime, exitTime: existing.exitTime, status: existing.status, manualNote: existing.manualNote },
46:   const id = await ctx.db.insert("pdksRecords", {
48:     date, ...values, createdAt: now,
```

### convex/lib/pdksMultiShift.ts

```text
91:     isLate: days.some(day => day.isLate), isEarlyExit: days.some(day => day.isEarlyExit), exitNextDay: days.some(day => day.exitNextDay),
92:     hasAttendance: days.some(day => day.hasAttendance), isOvernightShift: days[days.length - 1]?.isOvernightShift ?? false,
115:     multiplier: 0, classification: "workday", isLate: false, lateMinutes: 0,
116:     isEarlyExit: false, earlyExitMinutes: 0, exitNextDay: false,
117:     isOvernightShift: false, hasAttendance: false, durationMeasured: false,
```

### convex/lib/peoplePhoto.ts

```text
12:   if (pending) await ctx.db.delete(pending._id);
```

### convex/lib/privacySettings.ts

```text
87:     await ctx.db.patch(row._id, { ...defined, updatedAt });
90:   await ctx.db.insert("projectPrivacySettings", { projectId, ...defined, updatedAt });
```

### convex/lib/processCardReadingCore.ts

```text
84:   const state: ReadingState = { accessTime, projectForRow, hikFields, findDeviceCardEmployee };
166:   state: ReadingState,
234:     await ctx.db.patch(device._id, { hikLastSerialNo: args.hikSerialNo });
237:   await ctx.db.insert("cardReadings", {
251:     createdAt: accessTime,
252:     updatedAt: accessTime,
261:   state: ReadingState,
297:   await ctx.db.insert("cardReadings", {
310:     createdAt: accessTime,
311:     updatedAt: accessTime,
353:   await ctx.db.patch(tokenRow._id, { usedAt: consumedAt, employeeName, locationRecorded: false });
356:   await ctx.db.insert("cardReadings", {
360:     createdAt: consumedAt, updatedAt: consumedAt,
369:   state: ReadingState,
377:     await ctx.db.insert("cardReadings", {
385:       createdAt: accessTime,
386:       updatedAt: accessTime,
396:     await ctx.db.insert("cardReadings", {
406:       createdAt: accessTime,
407:       updatedAt: accessTime,
426:     await ctx.db.insert("cardReadings", {
437:       createdAt: accessTime,
438:       updatedAt: accessTime,
453:   const readingId = await ctx.db.insert("cardReadings", {
465:     createdAt: accessTime,
466:     updatedAt: accessTime,
```

### convex/lib/publicUser.ts

```text
15:   isAnonymous: v.optional(v.boolean()),
24:   updatedAt: v.optional(v.string()),
```

### convex/lib/reportAttendance.ts

```text
38:   const row = computePdksTableRow({ ...params, today, periodDateKeys, isSingleDay: false, viewMode: "matrix" });
123:           isSingleDay: false,
185: export function readingResult(status: Doc<"cardReadings">["accessStatus"]): ReportTransactionResult {
354:         startDate, isSingleDay: false, viewMode: "matrix", manualPdksByEmpDate: new Map(records.map(r => [`${employee._id}__${r.date}`, r])),
```

### convex/lib/sessionRevoke.ts

```text
8:   for (const token of tokens) await ctx.db.delete(token._id);
20:     await ctx.db.patch(userId, { sessionsRevokedThrough: cutoff });
25:     await ctx.db.delete(session._id);
```

### convex/lib/shiftAssign.ts

```text
43:   status: "will_assign" | "conflict" | "on_leave" | "holiday" | "skipped";
48:   holiday: { holidayId: Id<"holidays">; date: string; name: string; isHalfDay: boolean } | null;
66:     status: "will_assign", reason: "Atanacak", occurrenceCount,
69:   if (input.shift.isActive === false) return { ...base, status: "skipped", reason: "Pasif vardiya atanamaz" };
72:   if (!occurrenceCount && (!input.range.plan || input.range.plan.kind === "weekly")) return { ...base, status: "skipped", reason: "Seçilen günlere denk gelen tarih yok" };
81:     if (date && (!base.holiday || date < base.holiday.date)) base.holiday = { holidayId: holiday._id, date, name: holiday.name, isHalfDay: holiday.isHalfDay ?? false };
103:   if (!input.calendarConfirmed && base.leave) return { ...base, status: "on_leave", reason: `İzin: ${base.leave.date}` };
104:   if (!input.calendarConfirmed && base.holiday) return { ...base, status: "holiday", reason: `${base.holiday.date}: ${base.holiday.name}` };
105:   if (!input.forceConfirm && base.conflict) return { ...base, status: "conflict", reason: `OVERLAP:1 Mevcut planın üstünü örter: ${base.conflict.shiftName} ${shiftTimeLabel(base.conflict)} (${base.conflict.startDate}–${shiftEndLabel(base.conflict.endDate)})` };
153:   for (const ref of existing) await ctx.db.delete(ref._id);
156:   for (const shiftId of planShiftIds(plan)) await ctx.db.insert("shiftPlanRefs", { ...owner, projectId, shiftId });
```

### convex/lib/shiftPlan.ts

```text
21:   plan: v.optional(shiftPlanValidator), createdAt: v.string(), updatedAt: v.string(),
```

### convex/lib/smtpConfig.ts

```text
19:   isActive: boolean;
30:   isActive: boolean;
61:   return { host, port: input.port, secure: input.port === 465, username, fromEmail, fromName, isActive: input.isActive, password };
```

### convex/lib/transferGuard.ts

```text
37:   // Point lookups per status: a prefix scan would be crowded out by old cancelled runs.
114:   await ctx.db.patch(transferId, { status: "revoked", stuckReason: undefined, lastError: undefined });
118: export async function updateTransferTarget(ctx: MutationCtx, employeeId: Id<"employees">, deviceId: Id<"devices">, state: "confirmed" | "failed" | "superseded", lastError?: string): Promise<void> {
125:     await ctx.db.patch(row._id, { state, lastError: state === "confirmed" ? undefined : lastError?.slice(0, 2000), confirmedAt: state === "confirmed" ? Date.now() : undefined, updatedAt: Date.now() });
126:     if (state === "superseded") await ctx.db.patch(transfer._id, { status: "stuck", stuckReason: "Silme işi başka bir işlem tarafından geçersiz kılındı. Taşımayı iptal edin veya cihazı kaynak projeden kaldırın.", lastError });
130: export async function transferOperationFailed(ctx: MutationCtx, op: { payload: unknown; deviceId: Id<"devices"> }, reason: string, state: "failed" | "superseded" = "failed"): Promise<void> {
149:       await ctx.db.patch(row._id, { state: "deviceRemoved", updatedAt: Date.now(), lastError: undefined });
150:       await writeAudit(ctx, { user: ctx.user ?? null, projectId, action: "update", targetTable: "accessTransfers", targetId: transfer._id, newValue: { deviceId, state: "deviceRemoved" }, note: "Taşıma hedefi kapandı: cihaz kaynak projeden kaldırıldı" });
```

### convex/lib/visitorPresence.ts

```text
19:   if (!latest) return { lastDirection: null, lastReadingAt: null, presence: "unknown" as const };
23:     lastReadingAt: latest.accessTime,
```

### convex/lib/visitorRetention.ts

```text
11: export function visitorRetentionCutoff(days: number, runAt: number): string {
18:   runAt: number,
```

### convex/mailSettings.ts

```text
21:     passwordEnc: row.smtpPassword, fromEmail: row.fromEmail, fromName: row.fromName ?? "", isActive: row.isActive ?? false,
40:       fromEmail: row.fromEmail ?? "", fromName: row.fromName ?? "", isActive: row.isActive ?? false,
41:       hasPassword: Boolean(row.smtpPassword), updatedAt: row.updatedAt ?? null,
52:     await ctx.db.delete(row._id);
72:     isActive: v.boolean(),
84:       fromEmail: args.fromEmail, fromName: args.fromName, isActive: args.isActive, updatedAt: now,
87:     const audit = { smtpHost: args.host, smtpPort: args.port, smtpUsername: args.username, fromEmail: args.fromEmail, isActive: args.isActive, passwordChanged: Boolean(args.passwordEnc) };
89:       await ctx.db.patch(existing._id, values);
92:         oldValue: { smtpHost: existing.smtpHost, smtpPort: existing.smtpPort, smtpUsername: existing.smtpUsername, fromEmail: existing.fromEmail, isActive: existing.isActive },
97:     const id = await ctx.db.insert("mailSettings", { ...values, projectId: args.projectId, createdAt: now });
```

### convex/migrations.ts

```text
40:         await ctx.db.patch(door._id, {
42:           updatedAt: now,
74:         await ctx.db.delete(door._id);
77:       await ctx.db.delete(zone._id);
130:   returns: v.object({ updated: v.number(), collisions: v.number(), isDone: v.boolean(),
149:         await ctx.db.patch(employee._id, { email: email ?? "" });
154:         await ctx.db.patch(auth._id, { email: normalizeEmployeeEmail(auth.email) });
161:     console.info("Employee email normalization batch", { round, updated, collisions, isDone: page.isDone, cursor: page.continueCursor });
162:     return { updated, collisions, isDone: page.isDone, continueCursor: page.continueCursor, scheduled };
172:   returns: v.object({ cleared: v.number(), isDone: v.boolean() }),
178:       await ctx.db.patch(shift._id, { color: undefined });
182:     console.info("Shift color cleanup batch", { cleared, isDone: page.isDone });
183:     return { cleared, isDone: page.isDone };
214:         if (!dryRun) await ctx.db.patch(row._id, { weekPattern });
```

### convex/mobileAttendance.ts

```text
63:   returns: v.object({ page: v.array(readingValidator), isDone: v.boolean(), continueCursor: v.string() }),
77:     if (previous?.position === "[]") return { page: [], isDone: true, continueCursor: JSON.stringify(previous) };
101:       isDone: result.isDone, continueCursor: JSON.stringify(cursor),
110:     startDate: v.string(), endDate: v.string(), timeZone: v.literal("Europe/Istanbul"), generatedAt: v.string(),
163:       availableDateKeys: new Set(included.map(workDate)), startDate: args.startDate, isSingleDay: false, viewMode: "matrix",
```

### convex/mobileVisitors.ts

```text
25:   returns: v.union(v.null(), v.object({ id: v.id("employees"), status: statusValidator })),
33:     return { id: previous._id, status: visitorStatus(previous, Date.now()) };
38:   args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()), status: v.optional(statusValidator) },
50:       scanLimited: result.pageStatus === "SplitRequired", evaluatedAt: bound.evaluatedAt };
98:       return { id: previous._id, status: invitationRow(previous).status, replayed: true };
105:     const id = await ctx.db.insert("employees", {
106:       ...data, projectId, hostEmployeeId: ctx.employee._id, isVisitor: true,
107:       isActive: false, visitorStatus: "preRegistered", cardNumber: `PRE:${crypto.randomUUID()}`,
112:       createdAt: now, updatedAt: now,
114:     return { id, status: "preRegistered" as const, replayed: false };
124:     await ctx.db.patch(visitor._id, { ...requiredData,
126:       ...(args.notes !== undefined ? { notes } : {}), updatedAt: new Date().toISOString() });
135:     if (visitor.visitorStatus === "checkedOut" && visitor.isActive === false) return { status: "cancelled" as const };
137:     if (!editableInvitation(visitor)) return { status: "operatorRequired" as const };
138:     await ctx.db.patch(visitor._id, { isActive: false, visitorStatus: "checkedOut", updatedAt: new Date().toISOString() });
139:     return { status: "cancelled" as const };
```

### convex/onboarding.ts

```text
47:     const projectId = await ctx.db.insert("projects", {
51:       isActive: true,
52:       createdAt: now,
53:       updatedAt: now,
61:     await ctx.db.insert("userProjects", {
65:       createdAt: now,
69:     await ctx.db.insert("generalSettings", {
72:       createdAt: now,
73:       updatedAt: now,
133:         const projectId = await ctx.db.insert("projects", {
136:           isActive: true,
137:           createdAt: now,
138:           updatedAt: now,
145:         await ctx.db.insert("userProjects", {
149:           createdAt: now,
```

### convex/pdksRules.ts

```text
196:     const data = { ...fields, createdAt: new Date().toISOString(), createdBy: ctx.user._id };
201:       for (const row of await selections(ctx, id)) await ctx.db.delete(row._id);
202:       await ctx.db.replace(id, data);
203:     } else id = await ctx.db.insert("pdksRuleVersions", data);
204:     for (const snapshot of snapshots) await ctx.db.insert("pdksCheckpointSelections", { ...snapshot, projectId: args.projectId, ruleVersionId: id });
217:     for (const row of await selections(ctx, ruleVersionId)) await ctx.db.delete(row._id);
218:     await ctx.db.delete(ruleVersionId);
```

### convex/peopleActivity.ts

```text
70:       return { deviceId: device._id, syncedAt: entry.syncedAt };
83:       cardNumber, employeeCreatedAt: employee._creationTime, roster,
```

### convex/positions.ts

```text
28:     return await ctx.db.insert("positions", { projectId: args.projectId, name, createdAt: now, updatedAt: now });
43:     await ctx.db.patch(args.positionId, { name, updatedAt: new Date().toISOString() });
57:     await ctx.db.delete(args.positionId);
```

### convex/privacyBiometric.ts

```text
27:       changedAt: row?.biometricChangedAt ?? null, changedBy: row?.biometricChangedBy ?? null,
45:       biometricChangedAt: new Date().toISOString(), biometricChangedBy: ctx.user._id };
```

### convex/privacyRetention.ts

```text
72:     const sample = maskChatNames(readings.slice(0, 5).map(row => ({ employeeId: row.employeeId, employeeName: row.employeeName, time: row.accessTime, status: row.accessStatus })), aiMaskNames)
80:   args: { cursor: v.optional(v.string()), runAt: v.optional(v.number()) },
95:   args: { projectId: v.id("projects"), runAt: v.number(), days: v.number(), batch: v.number(), deleted: v.number() },
103:     for (const row of rows) await ctx.db.delete(row._id);
173:     const patch = { visitorKvkkUrl: url || undefined, visitorKvkkVersion: version || undefined, updatedAt: new Date().toISOString() };
174:     if (row) await ctx.db.patch(row._id, patch);
175:     else await ctx.db.insert("projectPrivacySettings", { projectId, ...patch });
212: type BatchArgs = { stage: number; batch: number; runAt: number; cursor?: string };
213: const batchArgs = { stage: v.number(), batch: v.number(), runAt: v.number(), cursor: v.optional(v.string()) };
225:     stage, batch, runAt: args.runAt, ...(stage === args.stage && cursor ? { cursor } : {}),
235: const elapsedRetryAt = (nextRetryAt: number | undefined, runAt: number) =>
236:   nextRetryAt !== undefined && nextRetryAt < Number.MAX_SAFE_INTEGER && nextRetryAt <= runAt ? nextRetryAt : 0;
243:     await ctx.scheduler.runAfter(0, internal.privacyRetention[stages[stage][0]], { stage, batch: 0, runAt: Date.now() });
259:       if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
275:       if (lastUpdate < before && !unresolvedRevocation) await ctx.db.delete(row._id);
294:       for (const target of targets) await ctx.db.delete(target._id);
296:       if (targets.length < capacity) { await ctx.db.delete(run._id); deleted++; }
307:     for (const row of page.page) await ctx.db.delete(row._id);
322:       if (!row.usedAt || row.usedAt < before) await ctx.db.delete(row._id);
333:     for (const row of page.page) await ctx.db.delete(row._id);
345:     for (const row of page.page) await ctx.db.delete(row._id);
385:       stage: args.stage, batch, runAt: args.runAt, visitorProjectId: projectId, ...(cursor && days !== null ? { cursor, days } : {}),
```

### convex/projects.ts

```text
63:     isActive: v.optional(v.boolean()),
68:     const id = await ctx.db.insert("projects", {
72:       isActive: args.isActive ?? true,
73:       createdAt: now,
74:       updatedAt: now,
76:     await ctx.db.insert("userProjects", { userId: ctx.user._id, projectId: id, role: "admin", createdAt: now });
89:     isActive: v.optional(v.boolean()),
99:       updatedAt: new Date().toISOString(),
104:     await ctx.db.patch(projectId, updateData);
126:       for (const row of rows) await ctx.db.delete(row._id);
129:     await ctx.db.delete(args.id);
136:     search: v.optional(v.string()), status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
154:         return { _id: project._id, name: project.name, description: project.description, isActive: project.isActive === true,
155:           createdAt: project.createdAt, memberCount: memberCount.count, memberCountCapped: memberCount.capped,
```

### convex/readers.ts

```text
67:     status: v.optional(v.string()),
98:     return await ctx.db.insert("readers", {
109:       status: args.status ?? "active",
110:       createdAt: now,
111:       updatedAt: now,
152:     await ctx.db.patch(args.readerId, {
159:       updatedAt: new Date().toISOString(),
172:     status: v.optional(v.string()),
183:     await ctx.db.patch(readerId, {
185:       updatedAt: new Date().toISOString(),
201:     updatedAt: v.number(),
208:     await ctx.db.patch(args.readerId, {
210:       hikLastCfgAt: args.updatedAt,
215:       updatedAt: new Date().toISOString(),
230:     await ctx.db.delete(args.readerId);
255:     isDone: v.boolean(),
274:       await ctx.db.insert("readers", {
283:         status: "active",
284:         createdAt: now,
285:         updatedAt: now,
290:       isDone: result.isDone,
307:   await Promise.all(readers.map((r) => ctx.db.delete(r._id)));
```

### convex/reports.ts

```text
295:     const values = { ...args, email, updatedAt: now };
296:     if (existing) await ctx.db.patch(existing._id, values);
297:     else await ctx.db.insert("reportScheduleSettings", { ...values, userId: ctx.user._id, createdAt: now });
341:     await ctx.db.patch(schedule._id, { lastSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
```

### convex/roles.ts

```text
85:     isDefault: v.boolean(),
94:       out.push({ role, permissions, isDefault: isDefaultPermissionSet(role, permissions), locked: role === LOCKED_ROLE });
123:       await ctx.db.delete(existing._id);
125:       await ctx.db.patch(existing._id, { permissions: next, updatedAt: Date.now(), updatedBy: ctx.user._id });
127:       await ctx.db.insert("projectRolePermissions", {
131:         updatedAt: Date.now(),
157:     isSuperAdmin: v.boolean(),
175:         isSuperAdmin: isSuperAdmin(member),
208:     await ctx.db.patch(membership._id, { role: args.role });
247:       await ctx.db.patch(membership._id, { role: legacyRoleToProjectRole(user?.role) });
```

### convex/schema.ts

```text
30:     isAnonymous: v.optional(v.boolean()),
33:     disabledAt: v.optional(v.number()),
35:     accessExpiresAt: v.optional(v.number()),
54:     tokenExpiresAt: v.optional(v.string()),
55:     updatedAt: v.optional(v.string()),
68:     createdAt: v.optional(v.string()),
79:     updatedAt: v.number(),
87:     isActive: v.optional(v.boolean()),
88:     createdAt: v.optional(v.string()),
89:     updatedAt: v.optional(v.string()),
110:     isActive: v.optional(v.boolean()),
118:     terminatedAt: v.optional(v.string()),
130:     isVisitor: v.optional(v.boolean()),
132:     accessExpiresAt: v.optional(v.string()),
134:     accessStartsAt: v.optional(v.string()),
153:     createdAt: v.optional(v.string()),
154:     updatedAt: v.optional(v.string()),
188:     expiresAt: v.string(),
189:     usedAt: v.optional(v.string()),
192:     createdAt: v.string(),
207:     tokenExpiresAt: v.optional(v.string()),
209:     createdAt: v.string(),
210:     updatedAt: v.string(),
219:     expiresAt: v.string(),
220:     createdAt: v.string(),
221:     lastUsedAt: v.optional(v.string()),
236:     requestedAt: v.string(),
237:     status: v.union(v.literal("pending"), v.literal("sent"), v.literal("confirmed"), v.literal("failed"), v.literal("unknown")),
254:     createdAt: v.optional(v.string()),
255:     updatedAt: v.optional(v.string()),
271:     createdAt: v.optional(v.string()),
272:     updatedAt: v.optional(v.string()),
288:     createdAt: v.string(),
315:     status: v.optional(v.string()),
335:     hikVerifyPlanSavedAt: v.optional(v.string()),
339:     hikPlanSavedAt: v.optional(v.string()),
342:     hikPlanAppliedAt: v.optional(v.string()),
345:       status: v.optional(v.object({ revision: v.number(), appliedAt: v.optional(v.string()), error: v.optional(v.string()), failedAt: v.optional(v.string()) })),
346:       verify: v.optional(v.object({ revision: v.number(), appliedAt: v.optional(v.string()), error: v.optional(v.string()), failedAt: v.optional(v.string()) })),
348:     createdAt: v.optional(v.string()),
349:     updatedAt: v.optional(v.string()),
380:     hikLastCfgAt: v.optional(v.number()),
383:     status: v.optional(v.string()), // "active" | "inactive"
384:     createdAt: v.string(),
385:     updatedAt: v.string(),
406:     status: v.optional(v.string()),
407:     isActive: v.optional(v.boolean()),
433:     hikLastSeenAt: v.optional(v.number()),
435:     heartbeatCheckAt: v.optional(v.number()),
440:     hikIsupStatusAt: v.optional(v.number()),
451:     hikLastRebootAt: v.optional(v.number()),
455:     hikLastBackfillAt: v.optional(v.number()),
460:         updatedAt: v.number(),
472:     hikCapabilitiesUpdatedAt: v.optional(v.number()),
474:     apiTokenCreatedAt: v.optional(v.string()),
477:     createdAt: v.string(),
478:     updatedAt: v.string(),
502:     lastSeenAt: v.optional(v.number()),
506:     nextWakeAt: v.optional(v.number()),
507:     createdAt: v.number(),
515:     status: v.union(v.literal("requested"), v.literal("revoking"), v.literal("revoked"), v.literal("provisioning"), v.literal("done"), v.literal("stuck"), v.literal("cancelled")),
521:     requestedBy: v.id("users"), requestedAt: v.number(), deadlineAt: v.number(),
522:     completedAt: v.optional(v.number()), stuckReason: v.optional(v.string()), lastError: v.optional(v.string()),
531:     state: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("failed"), v.literal("superseded"), v.literal("deviceRemoved")),
532:     lastError: v.optional(v.string()), confirmedAt: v.optional(v.number()), updatedAt: v.number(),
540:     state: v.union(v.literal("pending"), v.literal("effective"), v.literal("failed"), v.literal("removed")),
541:     ruleIds: v.array(v.id("accessRules")), appliedAt: v.optional(v.number()),
542:     lastError: v.optional(v.string()), lastRunId: v.optional(v.id("deviceSyncRuns")), updatedAt: v.number(),
564:     isActive: v.optional(v.boolean()),
565:     isTemplate: v.optional(v.boolean()),
567:     createdAt: v.optional(v.string()),
568:     updatedAt: v.optional(v.string()),
583:     createdAt: v.string(),
599:     createdAt: v.string(),
618:     createdAt: v.string(),
633:     createdAt: v.string(),
673:     createdAt: v.optional(v.string()),
674:     updatedAt: v.optional(v.string()),
733:     ackedAt: v.optional(v.string()),
737:     alarmNotifiedAt: v.optional(v.string()),
739:     alarmQueuedAt: v.optional(v.string()),
740:     resolvedAt: v.optional(v.string()),
744:     alarmEmailAttemptAt: v.optional(v.string()),
746:     alarmEmailRetryAt: v.optional(v.string()),
749:     createdAt: v.string(),
750:     updatedAt: v.string(),
770:     lastTestRequestedAt: v.optional(v.string()),
772:     updatedAt: v.string(),
813:     status: v.union(
821:     nextRetryAt: v.optional(v.number()),
823:     processingStartedAt: v.optional(v.number()),
825:     createdAt: v.number(),
826:     completedAt: v.optional(v.number()),
834:     dismissedAt: v.optional(v.number()),
882:     status: v.union(
895:     nextRetryAt: v.optional(v.number()),
897:     sentAt: v.optional(v.number()),
900:     createdAt: v.number(),
901:     ackedAt: v.optional(v.number()),
903:     dismissedAt: v.optional(v.number()),
923:     startedAt: v.number(),
924:     finishedAt: v.optional(v.number()),
925:     status: v.union(
952:     status: v.union(
961:     updatedAt: v.number(),
983:     syncedAt: v.number(),
997:     addedAt: v.number(),
1014:     addedAt: v.number(),
1029:     status: v.string(),
1033:     editedAt: v.optional(v.number()),
1034:     createdAt: v.string(),
1035:     updatedAt: v.string(),
1052:     createdAt: v.optional(v.string()),
1053:     updatedAt: v.optional(v.string()),
1059:     createdAt: v.optional(v.string()),
1060:     updatedAt: v.optional(v.string()),
1072:     isActive: v.optional(v.boolean()),
1073:     createdAt: v.string(),
1074:     updatedAt: v.string(),
1082:     createdAt: v.string(),
1094:     createdAt: v.string(),
1095:     updatedAt: v.string(),
1143:     createdAt: v.optional(v.string()),
1144:     updatedAt: v.optional(v.string()),
1156:     isActive: v.optional(v.boolean()),
1157:     createdAt: v.optional(v.string()),
1158:     updatedAt: v.optional(v.string()),
1167:     createdAt: v.optional(v.string()),
1168:     updatedAt: v.optional(v.string()),
1197:     createdAt: v.string(),
1198:     updatedAt: v.string(),
1208:     updatedAt: v.string(),
1221:     createdAt: v.string(),
1222:     updatedAt: v.string(),
1243:     status: v.union(
1251:     decidedAt: v.optional(v.string()),
1255:     createdAt: v.string(),
1256:     updatedAt: v.string(),
1279:     status: v.union(
1286:     decidedAt: v.optional(v.string()),
1288:     createdAt: v.string(),
1289:     updatedAt: v.string(),
1303:     createdAt: v.string(),
1304:     updatedAt: v.string(),
1323:     updatedAt: v.optional(v.string()),
1333:     enrolledAt: v.string(),
1336:     deletionRequestedAt: v.optional(v.number()),
1358:     grantedAt: v.string(),
1359:     revokedAt: v.optional(v.string()),
1375:     updatedAt: v.string(),
1385:     isHalfDay: v.optional(v.boolean()),
1389:     createdAt: v.string(),
1407:     updatedAt: v.string(),
1452:     createdAt: v.number(),
1463:     lastSentAt: v.optional(v.string()),
1464:     createdAt: v.string(),
1465:     updatedAt: v.string(),
1479:     biometricChangedAt: v.optional(v.string()),
1487:     updatedAt: v.string(),
1500:     expiresAt: v.string(),
1502:     createdAt: v.string(),
```

### convex/seedCardReaderTest.ts

```text
19:       projectId = await ctx.db.insert("projects", {
21:         isActive: true,
22:         createdAt: now,
23:         updatedAt: now,
33:       deviceId = await ctx.db.insert("devices", {
39:         isActive: true,
40:         status: "active",
41:         createdAt: now,
42:         updatedAt: now,
52:       employeeId = await ctx.db.insert("employees", {
59:         isActive: true,
60:         createdAt: now,
61:         updatedAt: now,
71:       ruleId = await ctx.db.insert("accessRules", {
74:         isActive: true,
75:         createdAt: now,
76:         updatedAt: now,
86:       await ctx.db.insert("groupMembers", {
90:         createdAt: now,
100:       await ctx.db.insert("groupDevices", {
104:         createdAt: now,
122:         await ctx.db.insert("cardReadings", {
130:           createdAt: sampleTimes[i],
131:           updatedAt: sampleTimes[i],
```

### convex/seedHikvisionLanDevice.ts

```text
34:       projectId = await ctx.db.insert("projects", {
36:         isActive: true,
37:         createdAt: now,
38:         updatedAt: now,
48:       await ctx.db.patch(existing._id, {
57:         isActive: true,
58:         status: "active",
59:         updatedAt: now,
68:     const deviceId = await ctx.db.insert("devices", {
77:       isActive: true,
78:       status: "active",
79:       createdAt: now,
80:       updatedAt: now,
```

### convex/seedTestCardAccess.ts

```text
30:       const deviceId = await ctx.db.insert("devices", {
36:         isActive: true,
37:         status: "active",
38:         createdAt: now,
39:         updatedAt: now,
51:       const empId = await ctx.db.insert("employees", {
58:         isActive: true,
59:         createdAt: now,
60:         updatedAt: now,
65:       await ctx.db.patch(employee._id, { isActive: true, updatedAt: now });
76:       const ruleId = await ctx.db.insert("accessRules", {
85:         isActive: true,
86:         createdAt: now,
87:         updatedAt: now,
92:       await ctx.db.patch(rule._id, { isActive: true, updatedAt: now });
105:       await ctx.db.insert("groupMembers", {
109:         createdAt: now,
120:       await ctx.db.insert("groupDevices", {
124:         createdAt: now,
```

### convex/settings.ts

```text
80:       await ctx.db.patch(existing._id, { ...toPatch(args), projectId, updatedAt: now });
83:     return await ctx.db.insert("generalSettings", {
87:       createdAt: now,
88:       updatedAt: now,
127:       await ctx.db.patch(existing._id, { ...toPatch(args), projectId, updatedAt: now });
130:     return await ctx.db.insert("notificationSettings", {
133:       createdAt: now,
134:       updatedAt: now,
196:     if (existingWork) await ctx.db.patch(existingWork._id, work);
197:     else await ctx.db.insert("workSettings", work);
198:     const rateId = existingRates?._id ?? await ctx.db.insert("overtimeRates", {
202:     if (existingRates) await ctx.db.patch(existingRates._id, rate);
```

### convex/shiftPlans.ts

```text
110:     const departmentAssignmentId = await ctx.db.insert("departmentShiftAssignments", { ...row, createdAt: now, updatedAt: now });
137:     await ctx.db.patch(existing._id, { ...row, plan: row.plan, updatedAt: new Date().toISOString() });
151:     await ctx.db.delete(row._id);
```

### convex/shifts.ts

```text
37: function consumeRows<T>(rows: T[], state: AssignmentReadState): T[] {
42: async function readShift(ctx: ReadCtx, id: Id<"shifts">, state: AssignmentReadState): Promise<Doc<"shifts"> | null> {
50:   state: AssignmentReadState, forceConfirm = false, calendarConfirmed = false, excludeId?: string): Promise<AssignmentDecision> {
72:     if (!item.projectId) return { status: "skipped", reason: "Eski kayıt proje bilgisi içermiyor", occurrenceCount: 0, conflict: null, leave: null, holiday: null };
93:     throw new ConvexError({ code: "SHIFT_CALENDAR_CONFLICT", message: `CALENDAR: ${decision.reason}. İzin/tatil günlerinde atama için açık onay verin.`, status: decision.status });
196:     await ctx.db.patch(assignment._id, { ...range, updatedAt: new Date().toISOString() });
237:       results.push({ employeeId, employeeName, status: "skipped", reason: reason ?? "Çalışan bulunamadı", occurrenceCount: 0, conflict: null, leave: null, holiday: null });
261:   status: "assigned" | "skipped_conflict" | "skipped_leave" | "failed";
285:       let status: BulkApplyResult["status"] = "failed";
287:         assignmentId = await ctx.db.insert("shiftAssignments", {
291:           createdAt: now, updatedAt: now,
320:     await ctx.db.delete(args.assignmentId);
350: async function affectedEmployeeCount(ctx: ReadCtx, rows: Doc<"shiftAssignments">[], departments: Doc<"departmentShiftAssignments">[], projectId: Id<"projects"> | undefined, state: DefinitionEmployeeState = {}) {
516:     isActive: v.optional(v.boolean()),
533:     return await ctx.db.insert("shifts", {
535:       isActive: args.isActive ?? true,
537:       createdAt: now,
538:       updatedAt: now,
557:     isActive: v.optional(v.boolean()),
582:       const cosmetic = { ...(patch.scheduleMode !== undefined ? { scheduleMode: patch.scheduleMode } : {}), ...(patch.dayPlan !== undefined ? { dayPlan: patch.dayPlan } : {}), ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}) };
583:       await ctx.db.patch(shiftId, { ...cosmetic, updatedAt: now });
590:     await ctx.db.patch(shiftId, { ...patch, ...versionPatch, updatedAt: now });
614:   await ctx.db.insert("shiftVersions", { shiftId: shift._id, validUntil, rules: ruleSnapshot(shift), createdAt: now, createdBy: user._id });
633:     if (doc) shifts.set(id, { ...doc, isActive: true });
673:       await ctx.db.delete(ref._id);
682:     await Promise.all(eligible.map((a) => ctx.db.delete(a._id)));
684:     await Promise.all(versions.map(version => ctx.db.delete(version._id)));
685:     await ctx.db.delete(args.shiftId);
711:       for (const reference of references) await ctx.db.delete(reference._id);
712:       await ctx.db.delete(owner.id);
725:     return { deleted, isDone: remainingPersonal.length === 0 && remainingDepartments.length === 0 };
776:         await ctx.db.patch(row._id, { endDate: shiftDateOffset(args.startDate, -1), updatedAt });
777:         const assignmentId = await ctx.db.insert("shiftAssignments", {
780:           weekPattern: row.weekPattern, createdAt: row.createdAt, updatedAt,
784:         await ctx.db.patch(row._id, { endDate: shiftDateOffset(args.startDate, -1), updatedAt });
786:         await ctx.db.patch(row._id, { startDate: shiftDateOffset(args.endDate, 1), updatedAt });
789:         await ctx.db.delete(row._id);
```

### convex/users.ts

```text
80:     if (demotes) await ctx.db.patch(row._id, { role: legacyRoleToProjectRole(nextRole) });
81:     else if (nextRole === "super_admin" && row.role === undefined) await ctx.db.patch(row._id, { role: membershipRole(user, row) });
103:       isSelf: args.userId === ctx.user._id, isSuperAdmin: target.role === "super_admin",
122:           await ctx.db.delete(row._id);
126:         if (!memberships.some(row => row.projectId === projectId)) await ctx.db.insert("userProjects", { userId: args.userId, projectId, role: removesSuperAdmin ? legacyRoleToProjectRole(args.role) : "viewer", createdAt: new Date().toISOString() });
131:     await ctx.db.patch(args.userId, {
133:       updatedAt: new Date().toISOString(),
150:     const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
153:     await ctx.db.patch(ctx.user._id, updates);
214:     await ctx.db.patch(userId, {
216:       updatedAt: new Date().toISOString(),
235:       isSelf: args.userId === ctx.user._id, isSuperAdmin: target.role === "super_admin",
243:     await Promise.all(accounts.map((a) => ctx.db.delete(a._id)));
249:     await Promise.all(sessions.map((s) => ctx.db.delete(s._id)));
257:       await ctx.db.delete(row._id);
260:     await ctx.db.delete(args.userId);
290:     await ctx.db.patch(u._id, {
292:       updatedAt: new Date().toISOString(),
323:         await ctx.db.delete(a._id);
331:         await ctx.db.delete(s._id);
340:         await ctx.db.delete(up._id);
342:       await ctx.db.delete(user._id);
389:     const membershipCache = new Map<Id<"users">, Promise<{ _id: Id<"projects">; name: string; isActive: boolean; role: ProjectRole }[]>>();
404:             return { _id: p._id, name: p.name, isActive: p.isActive === true,
```

### convex/virtualReaders.ts

```text
26:       brand: "other", deviceType: VIRTUAL_READER_TYPE, status: "active",
30:     await ctx.db.patch(deviceId, { apiToken: readerToken, apiTokenCreatedAt: now, updatedAt: now });
47:     isActive: v.boolean(),
56:       await ctx.db.patch(device._id, { lastSeen: new Date(now).toISOString() });
61:       isActive: device.isActive !== false,
72:       status: v.literal("granted"),
78:       status: v.literal("denied"),
84:     v.object({ status: v.literal("reader_invalid") }),
88:     if (!device) return { status: "reader_invalid" as const };
89:     if (device.isActive === false) return { status: "denied" as const, reason: "READER_INACTIVE" as const };
91:     if (!READER_TOKEN_PATTERN.test(value)) return { status: "denied" as const, reason: "TOKEN_INVALID" as const };
93:     if (!outcome.granted) return { status: "denied" as const, reason: outcome.reason };
94:     await ctx.db.patch(device._id, { lastSeen: outcome.accessTime });
96:       status: "granted" as const,
```

### convex/visitorHosts.ts

```text
7: export type VisitorHostOption = Pick<Doc<"employees">, "_id" | "firstName" | "lastName"> & { isActive: boolean };
12:   returns: v.array(v.object({ _id: v.id("employees"), firstName: v.string(), lastName: v.string(), isActive: v.boolean() })),
36:       .map(({ _id, firstName, lastName, isActive }) => ({ _id, firstName, lastName, isActive: isActive === true }));
```

### convex/visitors.ts

```text
89:   const consentId = await ctx.db.insert("employeeConsents", {
94:     grantedAt: now,
103:     newValue: { consentType: "visitor_kvkk", grantedAt: now, documentVersion: notice.version, documentUrl: notice.url },
150:         endTime: r.endTime ?? null, days: r.days ?? [], isActive: r.isActive !== false,
196:     status: visitorStatus(visitor, now),
197:     lastSeenAt: presence?.lastReadingAt ?? null,
208:     status: v.optional(v.union(v.literal("active"), v.literal("checkedOut"), v.literal("expired"), v.literal("preRegistered"))),
247:       evaluatedAt: new Date(now).toISOString(),
296:       evaluatedAt: new Date(now).toISOString() };
321:       isActive: visitor.isActive ?? false,
326:       kvkkConsent: consent ? { grantedAt: consent.grantedAt, documentUrl: consent.documentUrl ?? null, version: consent.documentVersion ?? null } : null,
360:     accessExpiresAt: v.string(),
361:     accessStartsAt: v.optional(v.string()),
366:     isActive: v.optional(v.boolean()),
398:         await ctx.db.patch(dupCard._id, {
400:           updatedAt: new Date().toISOString(),
419:     const id = await ctx.db.insert("employees", {
427:       isVisitor: true,
429:       accessExpiresAt: new Date(visitorTime(args.accessExpiresAt)).toISOString(),
430:       accessStartsAt: args.accessStartsAt ?? now,
436:       createdAt: now,
437:       updatedAt: now,
472:     accessExpiresAt: v.optional(v.string()),
477:     isActive: v.optional(v.boolean()),
546:     const patch: Record<string, unknown> = { updatedAt: now };
564:     await ctx.db.patch(args.visitorId, patch);
614:     await ctx.db.patch(args.visitorId, {
615:       isActive: false,
617:       updatedAt: new Date().toISOString(),
636:     await ctx.db.patch(args.visitorId, {
638:       updatedAt: new Date().toISOString(),
662:       await ctx.db.patch(vz._id, {
663:         isActive: false,
665:         updatedAt: now,
```

### convex/zones.ts

```text
54:     return await ctx.db.insert("zones", { ...args, createdAt: now, updatedAt: now });
79:     await ctx.db.delete(args.zoneId);
```

### infra/hik-event-bridge/RUNBOOK.md

```text
8: token'ıyla `{devIndex, status: "online" | "offline", at}` olarak gönderir. `at` köprünün
```

### infra/hik-event-bridge/bridge.mjs

```text
168:         if (res.ok || (res.status < 500 && res.status !== 429)) return { status: res.status };
169:         log({ event: 'post_retry', attempt, status: res.status });
180:     return { status: 0 };
187:       const result = token ? await post(job.path, job.body, token) : { status: 0 };
191:         log({ event: 'forward', ...job.summary, status: result.status });
193:         log({ event: 'post_pending', ...job.summary, status: result.status });
236:       devIndex: alert.devIndex, status: alert.status, at, ...(source ? { source } : {}),
273:         log({ event: 'device_status', type: alert.eventType, devIndex: alert.devIndex, status: alert.status });
298:         const alert = { devIndex: device.devIndex, deviceID: device.EhomeParams?.EhomeID, status: device.devStatus, at };
```

### infra/hik-event-bridge/bridge.nodetest.mjs

```text
125:     ? new Response(null, { status: 429, headers: { 'Retry-After': '2' } }) : new Response(null, { status: 200 }));
128:   bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'online' });
137:   t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
140:   first.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline' });
147:   t.mock.method(globalThis, 'fetch', async (_url, options) => { calls.push(options); return new Response(null, { status: 200 }); });
162:     return new Response(null, { status: 200 });
167:   bridge.handlePart(JSON.stringify({ EventNotificationAlert: { eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline', dateTime: '2026-10-22T12:00:00Z' } }));
172:   assert.deepEqual(JSON.parse(calls[0].body), { devIndex: 'dev-1', status: 'offline', at: Date.parse('2026-10-22T12:00:00Z') });
174:   bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'online' });
178:     bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline', dateTime: new Date(receivedAt + skew * 3600_000).toISOString() });
189:   for (const eventType of ['heartBeat', 'addressChange']) bridge.handlePart(JSON.stringify({ EventNotificationAlert: { eventType, devIndex: 'dev-1', status: 'online' } }));
190:   bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'unknown', status: 'offline' });
191:   bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'invalid' });
203:   bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline' });
293:     return new Response(null, { status: calls.length === 1 ? 503 : 200 });
296:   bridge.enqueue({ eventType: 'devStatusChanged', devIndex: 'dev-1', status: 'offline' });
```

## Ek C — Web/mobil okuyan kopyalar ve düğme durumları

Yeniden üretim komutu: üretim adaylarında `rg -n 'status|state|phase|switch|case |isActive|disabled[=:]|canEdit|isSaving|isLoading|pending|verified|disabledAt|accessExpiresAt|ackedAt|resolvedAt' S_web_mobil...`; ekte eşdeğer Python satır filtresi kullanıldı. L10n dosyaları sayımlara dahildir; aşağıda büyük çeviri cümlelerinin tekrarı çıkarılmıştır. Bu ek tüm adaylardır; her UI state bağımsız domain yaşam döngüsü sayılmaz.

### mobile/lib/core/error_localizer.dart

```text
9:   return switch (error) {
17:     BusinessError business => switch (business.safeCode) {
```

### mobile/lib/core/errors.dart

```text
45:   const ServerError({required this.statusCode, this.body});
46:   final int statusCode;
51:       'Sunucu hatası ($statusCode). Lütfen biraz sonra tekrar deneyin.';
53:   String get debugMessage => 'ServerError: HTTP $statusCode';
108:       : switch (safeCode) {
176: /// Subtype preserves existing exhaustive AppError switches' BusinessError arm.
195: String? normalizeBusinessCode(String? code) => switch (code) {
258: String? legacyBusinessCode(String message) => switch (message.trim()) {
```

### mobile/lib/models/visitor.dart

```text
9: enum VisitorSyncStatus { pending, applied, failed, unknown }
42:     required this.status,
43:     required this.canEdit,
54:     final status = switch (json['status']) {
61:     final canEdit = json['canEdit'];
62:     if (canEdit is! bool) throw const ProtocolError();
63:     final presence = switch (json['presence']) {
89:       syncStatus = switch (sync['status']) {
90:         'pending' => VisitorSyncStatus.pending,
103:       status: status,
104:       canEdit: canEdit,
117:   final VisitorAccessStatus status;
120:   final bool canEdit;
205:     for (final status in VisitorAccessStatus.values) {
206:       final value = counts[status.name];
208:       mapped[status] = value;
```

### mobile/lib/providers/auth_provider.dart

```text
42:   AuthPhase _phase = AuthPhase.initializing;
48:   bool _isLoading = false;
58:   AuthPhase get phase => _phase;
61:   bool get isBootstrapping => _phase == AuthPhase.initializing;
65:   bool get isLoading => _isLoading;
70:       _phase == AuthPhase.authenticated &&
97:     if (_isInitialized && !force && _phase != AuthPhase.retryableFailure) {
101:     _phase = AuthPhase.initializing;
103:     _isLoading = true;
129:         _phase = AuthPhase.unauthenticated;
142:       _phase = AuthPhase.authenticated;
149:         _phase = AuthPhase.unauthenticated;
169:         _phase = AuthPhase.retryableFailure;
175:         _isLoading = false;
188:     if (_disposed || _isLoading || _isChangingPassword) return false;
191:     _isLoading = true;
192:     _phase = AuthPhase.unauthenticated;
243:       _phase = AuthPhase.authenticated;
252:       _phase = AuthPhase.unauthenticated;
261:         _isLoading = false;
330:     _phase = AuthPhase.unauthenticated;
331:     _isLoading = false;
368:     _phase = AuthPhase.unauthenticated;
369:     _isLoading = false;
```

### mobile/lib/providers/door_operation_provider.dart

```text
12: /// Independent command state. It never writes attendance or infers passage.
13: /// There are no automatic command retries or unbounded status timers.
28:   bool _isLoading = false;
47:   bool get isLoading => _isLoading;
50:       _isLoading || _restoreFailed || _intent != null;
52:   String? get pendingDeviceId => _intent?.deviceId;
53:   String? get pendingDoorId => _intent?.doorId;
55:       _intent != null && !_isLoading && !_restoreFailed;
56:   DateTime? get pendingExpiresAt => _operation?.pendingExpiresAt;
59:   /// Ownership/busy change before any await, including while restore is pending.
93:     _isLoading = scope != null;
186:         _isLoading = false;
196:     if (scope == null || !_owns(scope, generation) || _isLoading) return;
210:     _isLoading = true;
266:         _isLoading = false;
307:     if (scope == null || !_owns(scope, generation) || _isLoading) return;
308:     _isLoading = true;
322:         _isLoading = false;
354:         _isLoading ||
358:     _isLoading = true;
386:         _isLoading = false;
```

### mobile/lib/providers/visitor_provider.dart

```text
25:       _persistedRequestId != null || pendingCreate != null;
27:       _persistedRequestId ?? pendingCreate?.requestId;
57:   VisitorAccessStatus? status;
62:   PendingVisitorCreate? pendingCreate;
120:     status = null;
129:     pendingCreate = null;
130:     // Drop PII and visible recovery state on logout/account change. Outstanding
204:     VisitorAccessStatus? status,
210:     final nextStatus = resetStatus ? null : status ?? this.status;
211:     if (nextSearch == this.search && nextStatus == this.status) return;
213:     this.status = nextStatus;
262:         status: status,
397:       pendingCreate = null;
460:         final previous = pendingCreate;
461:         final pending =
473:         pendingCreate = pending;
476:           pending.draft,
477:           requestId: pending.requestId,
478:           notice: pending.notice,
479:           noticeReviewed: pending.noticeReviewed,
486:             await store.remove(scope, pending.requestId);
501:       if (id == null) pendingCreate = null;
510:           pendingCreate = null;
```

### mobile/lib/repositories/visitor_repository.dart

```text
28:     final status = json['status'];
31:         status is! String ||
32:         !VisitorAccessStatus.values.any((value) => value.name == status)) {
41:     VisitorAccessStatus? status,
47:         if (status != null) 'status': status.name,
148:     return switch (json['status']) {
```

### mobile/lib/router/app_router.dart

```text
40:   QrOpenIntent? qrIntent(GoRouterState state) {
41:     final intent = state.extra;
56:     redirect: (context, state) {
57:       final canonical = normalizeAppLocation(state.uri);
58:       if (canonical != state.uri.toString()) {
61:       final path = state.uri.path;
62:       final target = safeReturnTarget(state.uri.queryParameters['from']);
66:       if (authProvider.phase == AuthPhase.initializing ||
67:           authProvider.phase == AuthPhase.retryableFailure) {
95:               isFailure: authProvider.phase == AuthPhase.retryableFailure,
96:               message: switch (authProvider.bootstrapError) {
166:                 builder: (context, state) => Builder(
171:                       isActive: BranchVisibility.isActive(context, 2),
172:                       initialTab: qrIntent(state)?.tab ?? QrTab.code,
173:                       scanRequestRevision: qrIntent(state)?.revision ?? 0,
```

### mobile/lib/screens/auth/login_screen.dart

```text
80:     if (auth.isLoading) return;
106:     final busy = auth.isLoading || _submitting;
```

### mobile/lib/screens/home/home_screen.dart

```text
24: import '../../widgets/cards/attendance_status_card.dart';
25: import '../../widgets/cards/door_command_status_card.dart';
70:   void didChangeAppLifecycleState(AppLifecycleState state) {
71:     _isAppActive = state == AppLifecycleState.resumed;
158:       status: attendance.attendanceStatus,
159:       isLoading: attendance.isSummaryLoading,
215:             (commands.isLoading || preferred.isSaving));
217:         commands.operation?.status == DoorOperationStatus.unknown ||
220:             !commands.isLoading);
237:             isLoading: commands.isLoading,
238:             isSending: preparing && commands.isLoading,
254:                   ? (preparing && commands.isLoading
315:     if (commands.isLoading || preferred.isSaving) {
356:       if (!sameSelection() || preferred.isSaving) return;
```

### mobile/lib/screens/main_navigation_shell.dart

```text
72:   void didChangeAppLifecycleState(AppLifecycleState state) {
73:     _resumed = state == AppLifecycleState.resumed;
```

### mobile/lib/screens/profile/profile_screen.dart

```text
251:   String _themeLabel(AppLocalizations l10n, ThemeMode mode) => switch (mode) {
257:   String _localeLabel(AppLocalizations l10n, String? code) => switch (code) {
271:             busy: provider.isSaving,
281:                         leadingIcon: switch (mode) {
299:                         enabled: !provider.isSaving,
301:                           if (provider.isSaving) return;
331:             busy: provider.isSaving,
361:                         enabled: !provider.isSaving,
363:                           if (provider.isSaving) return;
425:     final (title, children) = switch (page) {
547:     final feedback = switch (_feedback) {
```

### mobile/lib/screens/qr_scan/qr_scan_screen.dart

```text
24:     this.isActive = true,
35:   final bool isActive;
70:   bool get _visible => widget.isActive && (_route?.isCurrent ?? true);
135:     if (oldWidget.isActive != widget.isActive) {
137:       if (!widget.isActive) _dismissDialog();
201:   void didChangeAppLifecycleState(AppLifecycleState state) {
202:     _resumed = state == AppLifecycleState.resumed;
214:       final status = request
218:                 Permission.camera.status);
220:       _permission = status;
316:     final statusError = tokens?.statusError;
317:     final status = tokens?.status ?? QrViewStatus.empty;
340:                     if (user.projectName case final project?)
374:                         status == QrViewStatus.consumed
399:                   if (token?.status == QrTokenStatus.consumed)
402:                       token.status != QrTokenStatus.consumed &&
404:                           token.status == QrTokenStatus.expired))
413:                   if (statusError != null)
415:                       key: const Key('qr-status-error'),
471:                             if (granted && _scanSelected && widget.isActive)
530:                             ? () => _cameraAction(_camera.switchCamera)
613:           // switchCamera can restart internally after an async platform call.
654:       final message = switch (payload) {
694:       if (navigator.mounted && route.isActive) navigator.removeRoute(route);
```

### mobile/lib/screens/visitor/visitor_form_screen.dart

```text
39:   VisitorDraft? _pending;
49:     final pending = visitor == null
50:         ? context.read<VisitorProvider>().pendingCreate
53:       text: pending?.draft.firstName ?? visitor?.firstName ?? '',
56:       text: pending?.draft.lastName ?? visitor?.lastName ?? '',
59:       text: pending?.draft.phone ?? visitor?.phone ?? '',
62:       text: pending?.draft.purpose ?? visitor?.purpose ?? '',
65:       text: pending?.draft.notes ?? visitor?.notes ?? '',
68:         pending?.draft.start.toUtc() ??
72:         pending?.draft.end.toUtc() ??
75:     _requestId = pending?.requestId ?? visitorRequestId();
76:     _pending = pending?.draft;
77:     _uncertain = pending != null;
78:     _notice = pending?.notice;
79:     _reviewed = pending?.noticeReviewed ?? false;
80:     if (pending != null) _noticeLoading = false;
88:   void didChangeAppLifecycleState(AppLifecycleState state) {
89:     if (state == AppLifecycleState.resumed) _refreshDefaultTimes(_now());
94:         _pending != null ||
120:     final state = context.read<VisitorProvider>();
123:         ? await state.reconcileCreate()
125:     if (!mounted || state.sessionEpoch != _sessionEpoch) return;
200:     final state = context.read<VisitorProvider>();
202:     if (state.busy ||
206:             (state.createRecoveryLoading ||
207:                 state.createRecoveryError != null))) {
240:         _pending ??
250:     final success = await state.save(
257:     if (!mounted || state.sessionEpoch != _sessionEpoch) return;
264:       final error = state.mutationError;
275:         _pending = ambiguous ? draft : null;
285:       builder: (context, state, _) {
286:         if (state.sessionEpoch != _sessionEpoch) {
294:             (widget.visitor == null && state.createRecoveryLoading);
295:         final locked = state.busy || _uncertain || recovering;
324:                                 state.hasUnresolvedCreate &&
330:                             if (state.createRecoveryError
331:                                 case final recoveryError?
334:                                 message: state.createRecoveryStorageFailed
339:                                 onAction: recovering || state.busy
348:                             if (state.mutationError case final error?) ...[
464:                             widget.visitor == null && state.hasUnresolvedCreate
467:                         busy: state.busy,
473:                                     state.createRecoveryError != null)
```

### mobile/lib/screens/visitor/visitor_screen.dart

```text
23: typedef _StatusFilter = ({VisitorAccessStatus? status});
38:     final state = context.read<VisitorProvider>();
42:           value: state,
49:   void _clearFilters(VisitorProvider state) {
52:     state.setFilters(search: '', resetStatus: true);
55:   Future<void> _openDetail(VisitorProvider state, Visitor visitor) async {
56:     unawaited(state.openDetail(visitor.id));
60:         value: state,
92:                   builder: (context, state, _) {
93:                     if (_searchEpoch != state.sessionEpoch) {
95:                       _searchEpoch = state.sessionEpoch;
96:                       final epoch = state.sessionEpoch;
99:                             state.sessionEpoch == epoch &&
101:                           _search.text = state.search;
105:                     final filterEpoch = state.sessionEpoch;
107:                         state.search.trim().isNotEmpty || state.status != null;
108:                     final summary = state.summary;
116:                         ] else if (state.summaryLoading) ...[
124:                         if (state.summaryError != null) ...[
132:                           key: ValueKey(('visitor-search', state.sessionEpoch)),
141:                             final epoch = state.sessionEpoch;
145:                                 if (mounted && state.sessionEpoch == epoch) {
146:                                   state.setFilters(search: value);
155:                           value: (status: state.status),
158:                               value: (status: null),
161:                             for (final status in VisitorAccessStatus.values)
163:                                 value: (status: status),
164:                                 label: visitorStatusLabel(l10n, status),
169:                                 state.sessionEpoch != filterEpoch) {
172:                             state.setFilters(
173:                               status: value.status,
174:                               resetStatus: value.status == null,
182:                               onPressed: () => _clearFilters(state),
187:                         if (state.error case final error?) ...[
189:                             title: state.loaded
193:                             tone: state.loaded
197:                             onAction: state.loading ? null : state.refresh,
198:                             busy: state.loading,
202:                         if (state.loading && state.visitors.isEmpty)
207:                         if (state.loaded &&
208:                             !state.loading &&
209:                             state.visitors.isEmpty &&
210:                             !state.hasMore &&
211:                             state.error == null)
224:                                 ? () => _clearFilters(state)
227:                         if (state.visitors.isNotEmpty)
241:                       onRefresh: state.refresh,
245:                         itemCount: state.visitors.length + 2,
248:                           if (index > state.visitors.length) {
249:                             if (state.loading && state.visitors.isNotEmpty) {
257:                             return state.hasMore
262:                                       busy: state.loading,
264:                                           state.refresh(more: true),
270:                           final last = index == state.visitors.length;
271:                           final visitor = state.visitors[index - 1];
302:                               onTap: () => _openDetail(state, visitor),
```

### mobile/lib/services/visitor_create_intent_store.dart

```text
93:     final temporary = File('${file.path}.pending');
120:         final temporary = File('${file.path}.pending');
141:         final temporary = File('${file.path}.pending');
```

### mobile/lib/widgets/visitor/visitor_cards.dart

```text
9:   const VisitorStatusBadge({super.key, required this.status});
10:   final VisitorAccessStatus status;
14:     label: visitorStatusLabel(AppLocalizations.of(context), status),
15:     tone: visitorStatusTone(status),
35:         VisitorStatusBadge(status: visitor.status),
93:         for (final status in [
97:           if ((summary.counts[status] ?? 0) > 0)
101:                 '${visitorStatusLabel(l10n, status)}: ${summary.counts[status]}${summary.overflow ? '+' : ''}',
```

### mobile/lib/widgets/visitor/visitor_detail.dart

```text
58:   Future<void> _cancel(VisitorProvider state, Visitor visitor) async {
59:     if (_confirming || _closingAfterCancel || state.busy) return;
99:         _cancelEpoch = state.sessionEpoch;
101:       final result = await state.cancel(visitor.id);
134:       builder: (context, state, _) {
135:         final selected = state.selected?.id == visitorId
136:             ? state.selected
141:                     state.detailError == null &&
142:                     state.sessionEpoch == _cancelEpoch
145:         final actions = visitor == null ? null : _actions(state, visitor);
149:           busy: state.busy,
154:               if (state.detailLoading)
156:               if (state.detailError case final error?) ...[
161:                   onAction: () => state.openDetail(visitorId),
166:                   !state.detailLoading &&
167:                   state.detailError == null &&
168:                   !state.busy &&
177:                       VisitorStatusBadge(status: visitor.status),
221:                 if (state.mutationError case final error?) ...[
238:   Widget _actions(VisitorProvider state, Visitor visitor) {
240:     final locked = state.busy || _confirming || _closingAfterCancel;
248:             if (visitor.canEdit) ...[
261:                                   value: state,
274:               onPressed: locked ? null : () => _cancel(state, visitor),
```

### mobile/lib/widgets/visitor/visitor_labels.dart

```text
8: String visitorStatusLabel(AppLocalizations l10n, VisitorAccessStatus status) =>
9:     switch (status) {
17:     switch (presence) {
33: AppStatusTone visitorStatusTone(VisitorAccessStatus status) => switch (status) {
54: String visitorSyncLabel(AppLocalizations l10n, VisitorSyncStatus status) =>
55:     switch (status) {
56:       VisitorSyncStatus.pending => l10n.visitorSyncPending,
```

### src/components/Layout.tsx

```text
30:   const ready = !loading && Boolean(session) && profile?.verified !== false && !(readingAccess !== null && permissionsLoading) && readingAccess !== false;
39:     let pending = target.position;
41:       if (!pending) current = { left: main.scrollLeft, top: main.scrollTop };
45:       pending = undefined;
51:       rememberMainPosition(location.key, pending ?? current);
56:   if (!session || profile?.verified === false) {
```

### src/components/access-control/CardReadings.tsx

```text
95:   const [pending, setPending] = useState(false);
109:     if (dirty || pending) {
111:       if (!pending) requestRouteClose(move);
113:   }, [reading, activeReading, dirty, pending, requestRouteClose, writeReading]);
```

### src/components/access-control/EditDoorDialog.tsx

```text
78:   const { run, pending: isSubmitting } = useAsyncAction(async (parsedDoorNo: number | undefined) => {
123:           <fieldset disabled={isSubmitting}>
130:             <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>
133:             <Button type="submit" disabled={isSubmitting}>
```

### src/components/access-control/door-dialog/DoorSaveResults.tsx

```text
8:             <div className="mb-4 space-y-2 rounded-md border p-3" role="status" aria-live="polite">
16:                     {result.key === "status" ? "Kapı durum planı" : "Doğrulama planı"}
```

### src/components/access-control/door-dialog/DoorStatusPlanSection.tsx

```text
4: import { Switch } from "@/components/ui/switch";
7:   statusPlan,
13:   statusPlan: DoorStatusPlan;
22:         <Label htmlFor="status-enabled" className="text-sm font-medium">
27:             {statusPlan.enabled ? "Açık" : "Kapalı"}
30:             disabled={isSubmitting || saved}
31:             id="status-enabled"
32:             checked={statusPlan.enabled}
39:       {statusPlan.enabled ? (
```

### src/components/access-control/door-dialog/DoorVerifyPlanSection.tsx

```text
3: import { Switch } from "@/components/ui/switch";
22:       disabled={isSubmitting || saved}
```

### src/components/access-control/door-dialog/weeklyPlan.tsx

```text
11: /** Shared by the door status and verify-mode plan editors; only the mode field differs. */
285:                   disabled={segments.length >= DOOR_STATUS_MAX_SEGMENTS}
```

### src/components/access-control/door-plans/CopyDoorPlansDialog.tsx

```text
48:     type === "status" ? source?.hikDoorStatusPlan : source?.hikVerifyPlan;
68:     "status",
74:   const [pending, setPending] = useState(false);
77:   const status = useAction(api.actions.hikGatewayDevice.applyDoorStatusPlan);
88:     type === "status"
106:       pending ||
129:           status: (doorId) => status({ doorId }),
146:           if (!open && !pending) guard.requestClose(onClose);
158:             disabled={pending || results.length > 0}
249:               <p role="status">
308:               disabled={pending}
317:                 disabled={
318:                   pending ||
326:                 {pending ? "Gönderiliyor…" : "Kaydet ve gönder"}
332:                   disabled={pending}
335:                   {pending ? "Gönderiliyor…" : "Hatalıları tekrar gönder"}
```

### src/components/access-control/door-plans/DoorPlanDialog.tsx

```text
57: // hikDoorStatusPlan form state tipi — schema shape ile birebir
86:   const [statusPlan, setStatusPlan] = useState<DoorStatusPlanState>(
107:   const statusChanged =
108:     JSON.stringify(statusPlan) !==
123:   const formDirty = statusChanged || verifyChanged || holidayChanged;
136:     persistedKeys.push("status");
145:   const pendingKeys = persistedSendPending ? door.pendingKeys ?? persistedKeys : [];
146:   const retryKeys = [...new Set([...failedKeys, ...pendingKeys])];
147:   const statusMessage =
152:         : door.pendingReason ?? "Kaydedildi ama cihaza gönderilmedi";
158:         status: () => applyDoorStatusPlan({ doorId: door.doorId }),
174:         ...(statusChanged
176:               hikDoorStatusPlan: normalizeDoorStatusPlan(statusPlan),
184:       const keysToSend = [...new Set([...keys, ...pendingKeys])];
218:   const isSubmitting = saveAction.pending || retryAction.pending;
230:         if (statusChanged) normalizeDoorStatusPlan(statusPlan);
232:         errors["status-plan"] = errorMessage(error);
241:         (statusChanged || holidayChanged) &&
268:         <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto min-w-0 p-4 sm:p-6 max-sm:[&_input:not([type=checkbox])]:min-h-11 [&_input]:min-w-0 [&_input]:max-w-full [&_label]:min-w-0 [&_select]:max-w-full max-sm:[&_select]:min-h-11 max-sm:[&_button:not([role=switch])]:min-h-11 max-sm:[&_label]:min-h-11 max-sm:[&_label]:content-center">
279:               <div role="status" className="mb-4 space-y-2 text-sm">
280:                 <p>{statusMessage}</p>
284:                   disabled={isSubmitting}
303:             <fieldset disabled={isSubmitting || saved}>
306:                   statusPlan={statusPlan}
312:                     id="status-plan"
316:                     aria-invalid={!!timeErrors["status-plan"]}
318:                       timeErrors["status-plan"]
319:                         ? "status-plan-error"
324:                       value={statusPlan}
326:                       invalid={!!timeErrors["status-plan"]}
328:                         timeErrors["status-plan"]
329:                           ? "status-plan-error"
333:                     {timeErrors["status-plan"] && (
335:                         id="status-plan-error"
338:                         {timeErrors["status-plan"]}
474:             {!saved && (statusChanged || verifyChanged || holidayChanged) && (
477:                 statusPlan={statusChanged ? statusPlan : undefined}
486:                 disabled={isSubmitting}
492:                 <Button type="submit" disabled={isSubmitting}>
```

### src/components/access-control/door-plans/DoorPlanImpactSummary.tsx

```text
66:   statusPlan,
71:   statusPlan?: DoorStatusPlan;
75:   const statusOpen =
76:     statusPlan?.enabled &&
77:     (statusPlan.weekly
78:       ? statusPlan.weekly.some((day) =>
81:       : statusPlan.mode === "remainOpen");
82:   const statusWeekly =
83:     statusPlan?.enabled && statusPlan.weekly
85:           statusPlan.weekly,
89:   const statusText =
90:     statusPlan &&
91:     (!statusPlan.enabled
93:       : (statusWeekly?.text ??
94:         `Her gün ${hours(statusPlan)} ${MODE_TEXT[statusPlan.mode]}`));
120:       {statusPlan && (
121:         <p className={statusOpen ? "text-warning" : undefined}>
122:           Durum planı: {statusText}
123:           {statusOpen && statusWeekly?.truncated
129:       {(statusWeekly?.truncated || verifyWeekly?.truncated) && (
134:           {statusWeekly && <p>Durum planı: {statusWeekly.fullText}</p>}
```

### src/components/access-control/door-plans/DoorPlansTab.tsx

```text
46: function statusSummary(plan: DoorPlanTarget["hikDoorStatusPlan"]) {
116:         <p role="status">Kapı planları yükleniyor…</p>
137:             disabled={!checked.length || checked.length > MAX_BULK_DOORS}
154:                   disabled={targets === undefined || visible.length === 0}
181:           {targets === undefined ? <TableStateRow colSpan={4} state="loading" label="Kapı planları yükleniyor…" /> : filtered.length === 0 ? <TableStateRow colSpan={4} state="empty" title={term ? "Aramaya uygun kapı bulunamadı" : "Plan kurulabilecek Hikvision kapısı yok"} description={term ? "Kapı, cihaz veya bölge adını değiştirin." : scopeDescription} action={term ? undefined : devicesAction} /> : null}
198:                     disabled={
234:                 <p className="line-clamp-1 md:line-clamp-none md:truncate" title={door.hikDoorStatusPlan?.enabled ? statusSummary(door.hikDoorStatusPlan) : door.hikVerifyPlan?.enabled ? "Doğrulama planı etkin" : door.hikDoorHolidayPlan?.enabled ? `${door.hikDoorHolidayPlan.year} tatil planı etkin` : "Plan etkin değil"}>
238:                       : statusSummary(door.hikDoorStatusPlan)
250:                   <p>Durum planı: {statusSummary(door.hikDoorStatusPlan)}</p>
297:                   door.pendingReason ?? "Kaydedildi, gönderilmedi"
```

### src/components/access-control/door-plans/bulk.ts

```text
10: export type CopyPlanType = "status" | "verify" | "holiday";
12:   status: "Durum planı",
31:     ...(types.includes("status") && source.hikDoorStatusPlan
86:         status: () => apply.status(doorId),
```

### src/components/access-control/doorPlanResult.ts

```text
14: export type PlanKey = "status" | "verify";
```

### src/components/access-control/unified/AccessRuleDetails.tsx

```text
14:   const { results, status, loadMore } = usePaginatedQuery(
28:       {status === "LoadingFirstPage" ? (
50:           {status !== "Exhausted" && (
53:               disabled={status !== "CanLoadMore"}
56:               {status === "LoadingMore" ? "Yükleniyor…" : "Daha fazla yükle"}
96:           <p role="status">
106:               role="status"
```

### src/components/access-control/unified/AccessRulesList.tsx

```text
14:   const { search, searchBy, status, type } = readRuleFilters(params);
32:   const queryKey = JSON.stringify([projectId, search, searchBy, status, type]);
47:             status={status}
61:               status={status}
```

### src/components/access-control/unified/CreateRuleDialog.tsx

```text
121:               <fieldset disabled={isSubmitting} className="space-y-5 min-w-0">
228:               disabled={isSubmitting}
236:               disabled={isSubmitting || projectChanged}
```

### src/components/access-control/unified/SyncRuns.tsx

```text
55:           <StatusBadge tone={targetTone(target.status)}>
56:             {targetLabels[target.status]}
72:   const display = runDisplay(run.status, run.counts);
75:       <div role="status">
85: /** Header row already shows status and counts; the dropdown only lists the devices. */
125:   "kind" | "startedAt" | "status" | "counts"
128:   const display = runDisplay(run.status, run.counts);
197:         target.status === "failed" ||
198:         target.status === "skipped" ||
199:         target.status === "unknown",
249:         disabled={!counts || counts.total === 0 || send.pending}
256:           if (!send.pending) setConfirm(open);
267:         pendingLabel="Başlatılıyor…"
297:       <p role="status" className="flex-1 min-w-0">
309:           disabled={retry.pending}
314:           {retry.pending ? "Başlatılıyor…" : "Cihazlara gönder"}
317:       <Button variant="ghost" disabled={retry.pending} onClick={onDismiss}>
```

### src/components/access-control/unified/UnifiedAccessControl.tsx

```text
11: import StatusPage from "./status/StatusPage";
24:     status: "Kişi yetkilerinin cihazlara ulaşıp ulaşmadığı",
33:       : params.get("tab") === "status" && canManage
34:       ? "status"
62:             if (value === "status" || value === "doors")
75:           {tab === "status" && headerAction && <Button variant="outline" className="min-h-11 md:min-h-9" disabled={headerAction.disabled} onClick={headerAction.onClick}>{headerAction.label}</Button>}
90:           {canManage && <TabsTrigger value="status">Yetki Durumu</TabsTrigger>}
96:           <TabsContent value="status">
```

### src/components/access-control/unified/hooks/useRuleForm.ts

```text
254:     isSubmitting: action.pending,
```

### src/components/access-control/unified/lib/presentation.ts

```text
6:   | "verified"
13:   verified: "Cihazda doğrulandı",
18: export function targetTone(status: TargetStatus) {
19:   return status === "verified"
21:     : status === "failed"
23:       : status === "unknown"
25:         : status === "queued"
30:   return `${counts.queued} kuyrukta · ${counts.sent} kayıt cihaza gönderildi · ${counts.verified} cihazda doğrulandı · ${counts.failed} başarısız · ${counts.skipped} atlandı · ${counts.unknown} bilinmiyor`;
35:     ["verified", "cihazda doğrulandı"],
43:     .filter(([status]) => counts[status] > 0)
44:     .map(([status, label]) => `${counts[status]} ${label}`);
61: export function runTone(status: keyof typeof runLabels) {
62:   return status === "done"
64:     : status === "failed"
66:       : status === "partial"
76:   status: keyof typeof runLabels,
77:   counts: Pick<Record<TargetStatus, number>, "sent" | "verified">,
79:   if (status === "partial" && counts.sent + counts.verified === 0) {
82:   return { label: runLabels[status], tone: runTone(status) } as const;
```

### src/components/access-control/unified/rules-list/RuleRow.tsx

```text
47:         updates: { isActive: !(rule.isActive ?? true) },
113:           <StatusBadge tone={(rule.isActive ?? true) ? "success" : "neutral"}>
114:             {(rule.isActive ?? true) ? "Aktif" : "Pasif"}
125:                   disabled={edit.pending}
131:                   disabled={toggle.pending}
134:                   {(rule.isActive ?? true) ? "Pasifleştir" : "Aktifleştir"}
137:                   disabled={deleteAccessRule.isPending}
158:                   disabled={edit.pending}
169:               · {(rule.isActive ?? true) ? "Aktif" : "Pasif"} ·{" "}
```

### src/components/access-control/unified/rules-list/RulesEmptyState.tsx

```text
5:   status,
10: }: Pick<ReturnType<typeof readRuleFilters>, "search" | "status" | "type"> & {
19:         search || status !== "all" || type !== "all"
30:           search || status !== "all" || type !== "all" ? clear : onCreateRule,
32:           search || status !== "all" || type !== "all"
```

### src/components/access-control/unified/rules-list/RulesFilters.tsx

```text
16:   status,
35:       hasFilters={status !== "all" || type !== "all" || searchBy !== "rule"}
41:           Number(status !== "all") +
60:             value: status,
```

### src/components/access-control/unified/rules-list/RulesPage.tsx

```text
22:   status,
31:   status: "all" | "active" | "inactive";
40:     status,
57:           status={status}
78:                 <TableHead columnId="status" className="w-28 whitespace-nowrap">Kural durumu</TableHead>
85:               {!result ? <TableStateRow colSpan={6} state="loading" label="Erişim kuralları yükleniyor" /> : result.searchLimited || rows.length === 0 ? <TableStateRow colSpan={6} state="custom">{emptyState}</TableStateRow> : null}
```

### src/components/access-control/unified/rules-list/accessRulesListModel.ts

```text
29:   const status =
41:   return { search, searchBy, status, type } as const;
```

### src/components/access-control/unified/status/StatusPage.tsx

```text
114:       <EmptyStatus unknownCount={filters.state === "unknown" ? 0 : (projectCounts?.unknown ?? 0)} />
115:       {busy && (rows.length > 0 || view === "device") && <p role="status">Yükleniyor…</p>}
```

### src/components/access-control/unified/status/model.ts

```text
18:   state?: GrantRow["state"];
24:   pending: "Bekliyor",
65:   row: Pick<EmployeeDetail["rows"][number], "state"> & Partial<Pick<GrantRow, "stale" | "lastError" | "doorUnresolved">>,
68:     label: labels[row.state],
71:       row.state === "failed"
73:         : row.state === "pending"
75:           : row.state === "effective"
78:     hint: row.state === "failed" ? shortFailureReason(row.lastError) : undefined,
```

### src/components/admin/AdminDeviceDialog.tsx

```text
105:   const { run: handleCreate, pending: creating } = useAsyncAction(
265:                     disabled={isEdit || registeredId !== null || submitting}
288:                 <div role="status" className="rounded-md border p-3 text-sm">
306:                   disabled={submitting || registeredId !== null}
318:                   disabled={(isHik && !!device?.assignedDeviceId) || submitting || projects === undefined}
355:                   disabled={submitting}
361:                   disabled={
```

### src/components/admin/AdminUsersPanel.tsx

```text
49:   const { run, pending } = useAsyncAction(
106:                 disabled={pending}
147:         <p role="status" className="text-sm text-muted-foreground">
151:         <p role="status" className="text-sm text-muted-foreground">
284:           isSaving={management.saving}
290:       <PasswordResetDialog target={resetTarget} onClose={() => setResetTarget(null)} onSend={management.handlePasswordReset} pending={management.resettingPassword} />
```

### src/components/admin/ProjectMembersContent.tsx

```text
22:   const { run, pending } = useAsyncAction(save, { success: "Proje rolü güncellendi", error: "Proje rolü değiştirilemedi" });
23:   return <label className="space-y-1"><span className="sr-only">{member.name ?? member.email ?? "Kullanıcı"} proje rolü</span><NativeSelect className="w-auto" value={member.role} disabled={pending || member.isSuperAdmin} onChange={async event => {
40:     <PasswordResetDialog target={resetTarget} onClose={() => setResetTarget(null)} onSend={management.handlePasswordReset} pending={management.resettingPassword} />
41:     {open && <UserFormDialog isOpen onClose={() => setOpen(false)} currentUser={null} formData={management.formData} baseline={management.baseline} onFormDataChange={management.setFormData} onSave={async () => { const ok = await management.handleSaveUser(); if (ok) setOpen(false); return ok; }} isSaving={management.saving} editReady={management.editReady} projects={management.projects} error={management.error} />}
```

### src/components/admin/components/AccountAccessActions.tsx

```text
18:   const disabledAt = "disabledAt" in user ? user.disabledAt : undefined;
19:   const expiry = "accessExpiresAt" in user ? user.accessExpiresAt : undefined;
21:     {disabledAt !== undefined && <StatusBadge tone="neutral">Donduruldu</StatusBadge>}
33:   const disabled = "disabledAt" in user && user.disabledAt !== undefined;
34:   const expiry = "accessExpiresAt" in user ? user.accessExpiresAt : undefined;
36:   const { run, pending } = useAsyncAction(async (clear = false) => {
39:       const accessExpiresAt = clear ? null : new Date(`${value}:00+03:00`).getTime();
40:       if (accessExpiresAt !== null && !Number.isFinite(accessExpiresAt)) throw new Error("Tarih ve saat seçin");
41:       await setExpiry({ userId: user._id, accessExpiresAt });
47:   return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
52:       {mode === "expiry" && <div className="space-y-2"><Label htmlFor="access-expiry">Tarih ve saat (İstanbul)</Label><div className="flex min-w-0 gap-2"><DateInput id="access-expiry" className="min-w-0 flex-1" required value={value.slice(0, 10)} disabled={pending} onChange={day => setValue(day ? `${day}T${value.slice(11, 16) || "00:00"}` : "")} /><Input type="time" className="w-28 shrink-0" aria-label="Erişim bitiş saati" value={value.slice(11, 16)} disabled={pending || !value} onChange={event => setValue(`${value.slice(0, 10)}T${event.target.value || "00:00"}`)} /></div></div>}
54:         <Button variant="outline" disabled={pending} onClick={onClose}>Vazgeç</Button>
55:         {mode === "expiry" && <Button variant="outline" disabled={pending || expiry === undefined} onClick={() => void save(true)}>Kaldır</Button>}
56:         <Button disabled={pending || (mode === "expiry" && !value)} onClick={() => void save()}>{pending ? "Kaydediliyor…" : mode === "expiry" ? "Kaydet" : disabled ? "Çöz" : "Dondur"}</Button>
64:   const disabled = "disabledAt" in user && user.disabledAt !== undefined;
67:     <DropdownMenuItem disabled={self} onSelect={() => onSelectMode("freeze")}>{disabled ? "Çöz" : "Dondur"}</DropdownMenuItem>
68:     <DropdownMenuItem disabled={self} onSelect={() => onSelectMode("expiry")}>Erişim bitişi</DropdownMenuItem>
```

### src/components/admin/components/UserFormDialog.tsx

```text
44:   isSaving = false,
56:   isSaving?: boolean;
65:   const guard = useAdminFormGuard("admin-user", dirty, isOpen && isSaving);
67:     if (!isSaving) guard.requestClose(onClose);
106:           aria-busy={isSaving}
142:                 disabled={isSaving}
156:                 disabled={
157:                   isSaving ||
214:                               disabled={isSaving}
235:                               {!project.isActive ? " · Pasif" : ""}
267:                     disabled={isSaving || !editReady || projects.length === 0}
282:                         {!project.isActive ? " · Pasif" : ""}
307:                 disabled={isSaving}
313:                 disabled={
314:                   isSaving ||
319:                 {isSaving
```

### src/components/admin/components/UserTable.tsx

```text
68:           disabled={"isSelf" in user && user.isSelf}
87:       {"pendingSetup" in user && user.pendingSetup && (
110:             {loading ? <TableStateRow colSpan={4} state="loading" label="Kullanıcılar yükleniyor" /> : users.length === 0 && emptyState ? <TableStateRow colSpan={4} state="custom">{emptyState}</TableStateRow> : null}
```

### src/components/admin/hooks/useUserManagement.ts

```text
93:   const { run: handleSaveUser, pending: saving } = useAsyncAction(saveUser, {
96:   const { run: handlePasswordReset, pending: resettingPassword } = useAsyncAction(
```

### src/components/alarms/AlarmEmailStatus.tsx

```text
4:   status?: "queued" | "sending" | "retryScheduled" | "sent" | "failed" | "skipped";
16:   const sendingAt = delivery?.status === "sending" ? delivery.at : undefined;
25:   if (!delivery?.status) return <p className="text-sm text-muted-foreground">Henüz gönderim kaydı yok.</p>;
26:   const interrupted = delivery.status === "sending" && delivery.at !== undefined
28:   return <div role="status" className="space-y-1 text-sm">
29:     <p className={interrupted || delivery.status === "failed" || delivery.status === "retryScheduled" ? "text-danger" : undefined}>{interrupted ? "Gönderim yarıda kaldı" : labels[delivery.status]}{delivery.at ? ` · ${time(delivery.at)}` : ""}</p>
```

### src/components/alarms/AlarmFilters.tsx

```text
12:   status: "open" | "acked" | "all";
19: export const DEFAULT_ALARM_FILTERS: AlarmFiltersValue = { status: "open", severity: "", deviceId: "", fromDay: "", toDay: "" };
24:     <FilterField label="Durum" htmlFor="alarm-status"><Select value={value.status} onValueChange={status => { if (status === "open" || status === "acked" || status === "all") onChange({ ...value, status }); }}><SelectTrigger id="alarm-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Açık</SelectItem><SelectItem value="acked">Onaylı</SelectItem><SelectItem value="all">Tüm durumlar</SelectItem></SelectContent></Select></FilterField>
38:   return { projectId, category, status: value.status, severity: value.severity || undefined, deviceId: value.deviceId || undefined, from: isoDay(value.fromDay), to: isoDay(value.toDay, true) };
```

### src/components/audit/AuditExportButton.tsx

```text
30:   return <div className="flex items-center gap-2">{progress === null ? <Button variant="outline" onClick={run}>Excel'e aktar</Button> : <><span role="status" className="text-sm">{progress.toLocaleString('tr-TR')} / ~? kayıt</span><Button variant="outline" onClick={() => controller.current?.abort()}>İptal</Button></>}</div>;
```

### src/components/audit/AuditFilters.tsx

```text
20:   const statuses = { active: 'Kayıtları yapan kişi', member: 'Proje üyesi', deleted: 'Silinmiş kullanıcı', removed: 'Mevcut üye listesinde yok' };
27:         {options?.actors.map(actor => <SelectItem key={actor.userId} value={actor.userId}><span className="block [overflow-wrap:anywhere]">{actor.label}<span className="block text-xs text-muted-foreground">{statuses[actor.status]}</span></span></SelectItem>)}
34: export function AuditFilters({ state, args, ready, rangeError, actions }: { state: ReturnType<typeof useAuditUrlState>; args: AuditArgs; ready: boolean; rangeError?: string; actions?: ReactNode }) {
35:   const count = ['user', 'action', 'target', 'start', 'end'].filter(key => state.params.get(key)).length;
37:     <FilterBar search={state.search} onSearchChange={value => state.setSearch(value.slice(0, 500))} searchLabel="Denetim kayıtlarında ara" placeholder="Kullanıcı, varlık veya not ara" onClear={state.clear} hasFilters={count > 0} end={actions}>
39:         {ready ? <QuerySectionBoundary className="contents" resetKey={`${args.projectId}-${args.allProjects}`} title="Kullanıcı seçenekleri yüklenemedi" description="Yeniden deneyebilirsiniz."><ActorFilter args={args} value={state.params.get('user') || ''} onChange={value => state.update('user', value)} /></QuerySectionBoundary> : <div className="text-sm text-muted-foreground">Kullanıcıları görmek için bir proje seçin.</div>}
40:         <FilterField label="Eylem" htmlFor="audit-action"><Select value={args.action || 'all'} onValueChange={value => state.update('action', value)}><SelectTrigger id="audit-action" className="w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent className="max-w-[calc(100vw-32px)]"><SelectItem value="all">Tüm eylemler</SelectItem>{Object.entries(actionLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></FilterField>
41:         <FilterField label="Varlık" htmlFor="audit-target"><Select value={args.targetTable || 'all'} onValueChange={value => state.update('target', value)}><SelectTrigger id="audit-target" className="w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent className="max-w-[calc(100vw-32px)]"><SelectItem value="all">Tüm varlıklar</SelectItem>{Object.entries(AUDIT_TARGET_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></FilterField>
42:         {[['start', 'Başlangıç'], ['end', 'Bitiş']].map(([key, label]) => { const value = state.params.get(key) || ''; const display = value && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? formatTrDate(new Date(`${value}T12:00:00Z`)) : 'Tarih seçin'; return <FilterField key={key} label={label} htmlFor={`audit-${key}`}><DateInput id={`audit-${key}`} className="min-w-0 w-full" value={value} trigger={<Button id={`audit-${key}`} type="button" variant="outline" className="h-9 w-full justify-between text-xs font-normal" aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'audit-range-error' : undefined}>{display}<CalendarIcon aria-hidden="true" className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>} onChange={value => state.update(key, value)} aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'audit-range-error' : undefined} /></FilterField>; })}
```

### src/components/audit/AuditResults.tsx

```text
10: type Snapshot = { rows: AuditRow[]; status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted'; loadMore: () => void };
14:   const { results, status, loadMore } = usePaginatedQuery(api.auditLog.list, args, { initialNumItems: 50 });
19:     if (status !== 'CanLoadMore') requesting.current = false;
21:       if (status !== 'CanLoadMore' || requesting.current) return;
25:     onSnapshot({ rows: results, status, loadMore: request });
26:     if (!results.length && status === 'CanLoadMore' && autoLoads.current < 5 && !requesting.current) {
30:   }, [results, status, loadMore, onSnapshot]);
31:   return status === 'LoadingFirstPage' && !hasRows ? <AuditTable rows={[]} allProjects={args.allProjects} loading onSelect={() => {}} /> : null;
39:   const receive = useCallback((next: Snapshot) => setSnapshot(previous => next.status === 'LoadingFirstPage' && previous?.rows.length ? previous : next), []);
42:   const firstLoading = !snapshot || snapshot.status === 'LoadingFirstPage';
43:   const more = snapshot?.status !== 'Exhausted';
48:     {!firstLoading && <AuditResultsContent rows={rows} more={more} filtered={filtered} active={active} status={snapshot?.status} loadMore={() => snapshot?.loadMore()} args={args} onSelect={(row, trigger) => { returnFocus.current = trigger; setSelected(row); }} />}
```

### src/components/audit/AuditTable.tsx

```text
16:     <TableBody>{message ? <TableStateRow colSpan={6 + (allProjects ? 1 : 0)} state="custom">{message}</TableStateRow> : loading ? <TableStateRow colSpan={6 + (allProjects ? 1 : 0)} state="loading" label="Denetim kayıtları yükleniyor…" /> : !rows.length ? <TableStateRow colSpan={6 + (allProjects ? 1 : 0)} state="empty" title={emptyTitle} description={emptyDescription} /> : rows.map(row => { const actor = row.userName ?? (row.userId ? 'Silinmiş kullanıcı' : 'Sistem'); return <TableRow key={row._id} className={`h-[42px] border-b last:border-0 hover:bg-muted/30 ${ROW_CLICK_CLASS}`} onClick={onRowActivate(event => { const trigger = event.currentTarget.querySelector('button'); if (trigger) onSelect(row, trigger); })}>
```

### src/components/audit/auditLabels.ts

```text
40:   ackedAt: "Onaylanma zamanı",
77:   status: "Durum",
113:   accessTransfers: { employeeId: "Kaynak kişi", targetEmployeeId: "Hedef kişi", sourceProjectId: "Kaynak proje", targetProjectId: "Hedef proje", targetDeviceCount: "Silme beklenen cihaz sayısı", deviceId: "Cihaz", state: "Hedef durumu", status: "Taşıma durumu" },
114:   accessTransferTargets: { transferId: "Taşıma", deviceId: "Cihaz", state: "Silme durumu", lastError: "Son hata" },
120:   mailSettings: { smtpHost: "SMTP sunucusu", smtpPort: "SMTP portu", smtpUsername: "SMTP kullanıcı adı", fromEmail: "Gönderen e-posta", isActive: "Raporlar bu hesaptan", passwordChanged: "Şifre değişti" },
125:     isActive: "Aktif",
262:     if ((key === 'consentType' || key === 'status' || key === 'minSeverity') && auditEnumLabels[value]) return auditEnumLabels[value];
```

### src/components/auth/AuthProvider.tsx

```text
38:   const { isAuthenticated, isLoading } = useConvexAuth();
51:   const loading = isLoading || (isAuthenticated && user === undefined);
54:   // verified=false kullanıcıyı bir kez signOut etmek için (effect döngüsünü önler)
68:     if (isLoading) return;
82:       // Eski kullanıcılar verified=undefined → engellenmez (yalnızca === false).
83:       if (profile.verified === false) {
125:       shouldSignOutOrphanedSession({ isLoading, isAuthenticated, user, deferred, signingOut: signingOutRef.current }) &&
155:   }, [isAuthenticated, isLoading, profile, user, location.pathname, location.search, location.hash, navigate, convexSignOut, ensureProject, signupPending, setupPhase]);
160:       // verified guard'ı ve yönlendirme useEffect'te yapılır
```

### src/components/dashboard/LiveFeed.tsx

```text
37:               <span className="absolute inline-flex h-full w-full animate-ping rounded-full status-success-bg opacity-60 motion-reduce:animate-none" />
38:               <span className="relative inline-flex h-2 w-2 rounded-full status-success-bg" />
```

### src/components/dashboard/QuickLinksGrid.tsx

```text
12:   { href: "/access-control", description: (stats) => stats?.pendingRequests ? `${stats.pendingRequests.toLocaleString("tr-TR")} pasif erişim kuralı` : "Erişim kurallarını yönetin" },
```

### src/components/dashboard/SetupChecklist.tsx

```text
34:   const status = useQuery(api.projects.getSetupStatus, !loading && canManage && projectId && !hidden && !completed ? { projectId } : "skip");
36:     if (!loading && canManage && projectId && !hidden && !completed && status?.complete) {
40:   }, [loading, canManage, projectId, hidden, completed, status?.complete, doneKey]);
41:   if (loading || !canManage || !projectId || hidden || completed || !status || status.complete) return null;
46:   return <DashboardPanel title="Kurulumu tamamlayın" context={`${status.steps.filter(step => step.done).length}/5 adım tamam`}
49:       {status.steps.map(step => <li key={step.key} className="min-w-0 py-3">
```

### src/components/devices/ClaimDeviceDialog.tsx

```text
113:     // IDE Smart paneller MQTT login için kullanıcı+şifre ister; boşsa sync sonsuza pending kalır.
118:   const { run: handleSubmit, pending: submitting } = useAsyncAction(async () => {
176:               <fieldset disabled={submitting} className="space-y-5">
401:                   <Button type="button" variant="outline" onClick={close} disabled={submitting}>İptal</Button>
402:                   <Button type="submit" disabled={submitting}>
```

### src/components/devices/DeviceActionsSection.tsx

```text
148:               disabled={!action.supported || busy !== null}
```

### src/components/devices/DeviceCommandCenter.tsx

```text
23:   onPendingChange?: (pending: boolean) => void;
36:   onPendingChange?: (pending: boolean) => void;
45:     (commands.pending && !commands.longRunning) || importPending;
51:     pending,
52:     pendingAction,
81:         <p role="status" className="py-2 text-sm">
86:         <p role="status" className="py-2 text-sm">
91:         <p role="status" className="py-2 text-sm text-warning">
106:         commandPending={pending}
111:         open={pendingAction?.destructive === true}
118:           pendingAction?.description ?? "",
125:         open={pendingAction !== null && !pendingAction.destructive}
127:           if (!open && !pending) setPendingAction(null);
129:         title={pendingAction?.title ?? "İşlem onayı"}
132:             {pendingAction?.description ?? ""}{" "}
```

### src/components/devices/DeviceDetailsPanel.tsx

```text
74:     Partial<Record<DeviceBrand, { dirty: boolean; pending: boolean }>>
77:     (brand: DeviceBrand, dirty: boolean, pending: boolean) => {
79:         current[brand]?.dirty === dirty && current[brand]?.pending === pending
81:           : { ...current, [brand]: { dirty, pending } },
102:   const pending =
103:     commandPending || tokenPending || gatewayPending || Object.values(formStates).some((state) => state?.pending);
104:   const dirty = Object.values(formStates).some((state) => state?.dirty);
105:   const guard = useGuardedFormNavigation({ active: open, dirty, pending });
116:     if (!pending) guard.requestClose(onClose);
130:         pending={pending}
151:           disabled={projectChanged || deviceUnavailable}
184:                 className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1 data-[state=inactive]:hidden"
206:                   className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden"
225:                       disabled={!canManage}
```

### src/components/devices/DeviceForm.tsx

```text
38:     pending: boolean,
79:     isLoading,
107:     onStateChange?.(formBrand, dirty, isLoading);
108:   }, [onStateChange, formBrand, dirty, isLoading]);
110:     if (!isLoading) {
157:         aria-busy={isLoading}
179:           disabled={disabled || isLoading || !!connectionError}
294:         {!disabled && embedded && !dirty && !isLoading && needsGatewayRegistration && (
295:           <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3 text-sm">
302:         {!disabled && embedded && (dirty || isLoading) && (
304:             isLoading={isLoading}
317:                 disabled={isLoading || !!connectionError}
330:                 disabled={isLoading}
334:               <Button type="submit" disabled={isLoading}>
335:                 {isLoading
```

### src/components/devices/DeviceHistoryImportCard.tsx

```text
26:   onPendingChange?: (pending: boolean) => void;
58:   onPendingChange?: (pending: boolean) => void;
115:         <p role="status" className="text-sm text-warning">
123:           disabled={disabled}
145:               disabled={disabled}
152:           disabled={disabled || (scope === "date" && (!date || date > today))}
160:           <p role="status" className="rounded-md bg-muted p-3 text-sm">
166:         <p role="status" className="text-sm">
```

### src/components/devices/LocationTree.tsx

```text
169:   const { run: sendOpen, pending: opening } = useAsyncAction(async () => {
275:                           <DropdownMenuItem disabled={zoneBlocked} className="text-destructive" onSelect={() => setDialog({ type: "deleteZone", zone })}>
320:                 <AlertDialogCancel disabled={opening}>Vazgeç</AlertDialogCancel>
321:                 <Button disabled={opening} onClick={() => void sendOpen()}>{opening ? "Gönderiliyor…" : "Komutu gönder"}</Button>
```

### src/components/devices/VirtualReaderDialog.tsx

```text
32:   state: VirtualReaderDialogState | null;
37: export function VirtualReaderDialog({ state, projectId, onClose }: VirtualReaderDialogProps) {
39:   const view = created ?? (state?.mode === "link" ? state : null);
46:     <Dialog open={state !== null} onOpenChange={open => !open && close()}>
66:   const { run, pending } = useAsyncAction(async (readerName: string) => {
104:         <Button type="submit" disabled={pending || !projectId}>
105:           {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
```

### src/components/devices/hooks/useDeviceFormLogic.ts

```text
72:   const { onSubmit, isLoading, connectionError } = useDeviceFormSubmission({
86:     isLoading,
```

### src/components/devices/hooks/useDeviceFormSubmission.ts

```text
75:           status: values.status,
134:           status: values.status,
215:                 status: values.status,
257:                 status: values.status,
287:   const { run, pending: isLoading } = useAsyncAction(async (values: FormValues) => {
295:   return { isLoading, onSubmit, connectionError };
```

### src/components/employees/EmployeeDetails.tsx

```text
167:                   tone={rule.isActive === false ? "neutral" : "success"}
169:                   {rule.isActive === false ? "Pasif" : "Aktif"}
```

### src/components/employees/EmployeeEmploymentActions.tsx

```text
13:   const reinstate = useMutation(api.employeeTermination.reinstate);
18:   const canAct = !employee.isVisitor && employee.terminationType !== "transfer" && !activeTransfer && transfer !== undefined && (!!employee.employmentEndDate || employee.isActive === true);
19:   const canTransfer = canAct && !employee.employmentEndDate && employee.isActive === true && !!employee.projectId &&
25:       {employee.employmentEndDate ? <ConfirmDestructive open={open} onOpenChange={setOpen} title="İşten ayrılma geri alınsın mı?" objectName={`${employee.firstName} ${employee.lastName}`} effects={["Kişi yeniden aktif olur; kartı cihazlara gönderilir."]} confirmLabel="Geri al" onConfirm={() => reinstate({ employeeId: employee._id })} /> : open && <EmployeeTerminateDialog employee={employee} open onOpenChange={setOpen} />}
```

### src/components/employees/EmployeeFingerprintCard.tsx

```text
35:   const [status, setStatus] = useState("");
41:   const { run, pending } = useAsyncAction(async () => {
76:           <NativeSelect id={deviceInputId} className="max-sm:min-h-11 min-w-0 flex-1" value={device?._id ?? ""} disabled={pending} onChange={event => setDeviceId(event.target.value)}>
80:           {pending
81:             ? <Button className="max-sm:min-h-11" type="button" variant="outline" disabled={!attempt || cancellation.pending} onClick={() => void cancellation.run()}>İptal</Button>
82:             : <Button className="max-sm:min-h-11" type="button" aria-describedby={reasonId} disabled={!!reason} onClick={() => setConfirmOpen(true)}>Kaydı başlat</Button>}
95:                 {missingOnDevice && <Button className="max-sm:min-h-11 h-7 w-7" size="icon" type="button" variant="ghost" title="Cihazlara yeniden gönder" aria-label={`${name} cihazlara yeniden gönder`} disabled={pending || !!reason || redistribution.pending} onClick={() => void redistribution.run(row.fingerNo)}><RefreshCw className="h-4 w-4" aria-hidden="true" /></Button>}
96:                 <Button className="max-sm:min-h-11 h-7 px-2" size="sm" type="button" variant="ghost" disabled={pending} aria-label={`${name} sistemden ve tüm cihazlardan sil`} onClick={() => setRemoveTarget(row.fingerNo)}>Sil</Button>
104:     <p role="status" aria-live="polite" className="text-xs">{status}</p>
107:       <DialogFooter><Button className="max-sm:min-h-11" type="button" variant="outline" onClick={() => setConfirmOpen(false)}>Vazgeç</Button><Button className="max-sm:min-h-11" type="button" disabled={pending || !!reason} onClick={() => void run()}>Kaydı başlat</Button></DialogFooter>
```

### src/components/employees/EmployeeForm.tsx

```text
37: /** onlyChangedFields ile aynı ölçüt: taslak açılırken de pasifse isActive gönderilmez, onay da açılmaz. */
38: export function sendsDeactivation(isActive: boolean | undefined, baseline: string | undefined): boolean {
39:   if (isActive) return false;
42:   return typeof parsed !== "object" || parsed === null || !("isActive" in parsed) || parsed.isActive !== false;
53:   onPendingChange?: (pending: boolean) => void;
88:   const { isLoading, handleSubmit, stages, serverError, savedResult } =
98:     isLoading: uploading,
115:   } = useEmployeeFormData(employee, { saving: isLoading || uploading, saved: stages.length > 0, draft });
126:     onPendingChange?.(isLoading || uploading);
127:   }, [isLoading, uploading, onPendingChange]);
138:   const wasActive = (currentEmployee ?? employee)?.isActive !== false;
139:   const deactivation = employee && wasActive && sendsDeactivation(formData.isActive, initialData)
164:     if (uploading || isLoading || stages.length > 0) return;
195:       aria-busy={isLoading}
211:         <div role="status" className="mb-3 text-sm">
216:       {isLoading && <p role="status" className="sr-only">Kaydediliyor</p>}
218:         disabled={!can("employees.manage") || isLoading || uploading || stages.length > 0}
227:             <p role="status" className="text-xs text-muted-foreground">
272:                           disabled={uploading || isLoading}
299:           role="status"
307:       {stages.length > 0 && !isLoading && savedResult ? (
318:           isLoading={isLoading || optionsLoading || uploading}
319:           busyLabel={isLoading ? "Kaydediliyor" : uploading ? "Fotoğraf yükleniyor" : "Yükleniyor"}
```

### src/components/employees/EmployeeFormFields.tsx

```text
36:   memberships?: { _id: string; name: string; isActive?: boolean }[];
45:   return isEditing && originalDepartmentId !== departmentId ? <p role="status" className="text-xs text-muted-foreground">Departman vardiya planı geçmiş günlere de uygulanır; kapanmış dönem için kişiye vardiya atayın.</p> : null;
168:         disabled={key === "accessRuleId" && !canManageAccessRules}
244:           <Label htmlFor="employee-isActive" className="flex min-h-11 items-center gap-2 text-sm">
246:               id="employee-isActive"
247:               name="isActive"
248:               checked={formData.isActive}
249:               onCheckedChange={(checked) => update("isActive", checked === true)}
277:                   <StatusBadge tone={rule.isActive === false ? "neutral" : "success"}>
278:                     {rule.isActive === false ? "Pasif" : "Aktif"}
```

### src/components/employees/EmployeeSyncConfirmDialog.tsx

```text
13:   const deviceIds = new Set(rules.filter(rule => rule.isActive && rule.groupMembers.some(member => employees.some(employee => employee._id === member.employeeId && !!employee.cardNumber))).flatMap(rule => rule.groupDevices.map(link => link.deviceId)));
14:   return new Set(devices.filter(device => deviceIds.has(device._id) && device.isActive && device.brand === "hikvision").flatMap(device => {
24:   const inactiveCount = employees.filter(employee => employee.isActive === false).length;
36:         <AlertDialogAction disabled={!can("employees.manage") || count === undefined || count === 0} onClick={onConfirm}>{inactiveCount ? "Cihaz kayıtlarını güncelle" : "Cihazlara gönder"}</AlertDialogAction>
```

### src/components/employees/EmployeeTable.tsx

```text
259:             if (!departmentPending && !isBulkSyncing && !syncAction.pending)
284:           isSyncing={isBulkSyncing || syncAction.pending}
285:           pending={departmentPending || isBulkSyncing || syncAction.pending}
291:           role="status"
309:               disabled={bulkSyncAction.pending}
328:               disabled={
334:                 syncAction.pending
361:             {column("status", "Durum", "w-[100px] min-[760px]:w-[180px]", 100)}
368:           {loading ? <TableStateRow colSpan={7 + Number(showCompany) + Number(showDepartment) + Number(canSeeBiometrics)} state="loading" label="Personel bilgileri yükleniyor…" /> : sortedEmployees.length === 0 ? (
369:             <TableStateRow colSpan={7 + Number(showCompany) + Number(showDepartment) + Number(canSeeBiometrics)} state="custom">{emptyState ?? <EmptyState title="Henüz personel eklenmedi" />}</TableStateRow>
377:               syncPending={syncAction.pending}
378:               bulkSyncPending={bulkSyncAction.pending}
```

### src/components/employees/EmployeeTransferDialog.tsx

```text
41:   const { run, pending } = useAsyncAction(async () => {
46:         departmentId, accessRuleIds: canManageRules ? ruleIds.filter(ruleId => rules?.some(rule => rule._id === ruleId && rule.isActive !== false)) : [] });
53:   useProjectChangeGuard(pending, () => {});
54:   return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
55:     <DialogContent className="max-h-[90dvh] overflow-y-auto" aria-busy={pending}
56:       onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
57:       onInteractOutside={event => { if (pending) event.preventDefault(); }}>
59:       {result ? <div className="space-y-4" role="status">
61:         <DialogFooter><Button className="max-sm:min-h-11" variant="outline" disabled={pending} onClick={() => { if (!pending) onOpenChange(false); }}>Kapat</Button><Button className="max-sm:min-h-11" disabled={pending} onClick={() => {
62:           if (pending || !targetId) return;
63:           navigate("/employees", { state: { transferEmployeeId: result.targetEmployeeId, transferProjectId: targetId } });
68:         if (!ready || pending || step !== 3) return;
72:         <fieldset disabled={pending} className="space-y-4">
81:             <div className="space-y-2"><Label htmlFor={`${id}-department`}>Departman (opsiyonel)</Label><Select value={departmentId ?? "none"} onValueChange={value => setDepartmentId(departments?.find(item => item._id === value)?._id)} disabled={departments === undefined}><SelectTrigger className="max-sm:min-h-11" id={`${id}-department`}><SelectValue placeholder="Departman seçin" /></SelectTrigger><SelectContent><SelectItem value="none">Departman atama</SelectItem>{departments?.map(department => <SelectItem key={department._id} value={department._id}>{department.name}</SelectItem>)}</SelectContent></Select></div>
83:               {!canManageRules ? <p className="text-sm text-muted-foreground">Hedef projede erişim kuralı yönetme yetkiniz yok. Taşıma sonrasında proje yöneticisi kural atayabilir.</p> : rules === undefined ? <p role="status">Kurallar yükleniyor…</p> : <>
84:                 {rules.filter(rule => rule.isActive !== false).map(rule => <Label className="flex min-h-11 items-center gap-2" key={rule._id}><Checkbox checked={ruleIds.includes(rule._id)} onCheckedChange={checked => setRuleIds(previous => checked === true ? [...previous, rule._id] : previous.filter(value => value !== rule._id))} />{rule.name}</Label>)}
85:                 {!rules.some(rule => rule.isActive !== false) && <p className="text-sm text-muted-foreground">Hedef projede aktif erişim kuralı yok.</p>}
91:             {preflight === undefined ? <p role="status">Taşıma engelleri kontrol ediliyor…</p> : preflight.reasons.length ? <div role="alert" className="space-y-2 text-sm"><p className="font-medium">Taşıma başlatılamıyor</p><ul className="list-disc space-y-1 pl-5">{preflight.reasons.filter(reason => reason.code !== "TRANSFER_DEVICE_OFFLINE").map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.message}{reason.code.includes("PERMISSION") && " Proje yöneticinizden gerekli yetkiyi isteyin."}</li>)}{preflight.offlineDevices.map(device => <li key={device.deviceId}>{device.name} çevrimdışı — cihaz açılınca tekrar deneyin.</li>)}{preflight.reasons.filter(reason => reason.code === "TRANSFER_DEVICE_OFFLINE" && preflight.offlineDevices.length === 0).map(reason => <li key={reason.code}>{reason.message}</li>)}</ul></div> : <p className="text-sm" role="status">Taşımaya engel bulunmadı. {preflight.targetDeviceCount} eski cihazdan silme onayı izlenecek.</p>}
104:         <DialogFooter><Button className="max-sm:min-h-11" type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Vazgeç</Button>
105:           {step > 1 && <Button className="max-sm:min-h-11" type="button" variant="outline" disabled={pending} onClick={() => { setFailure(undefined); setStep(previous => previous - 1); }}>Geri</Button>}
106:           {step < 3 ? <Button className="max-sm:min-h-11" type="button" disabled={!target || pending} onClick={() => { setFailure(undefined); setStep(previous => previous + 1); }}>Devam</Button> : <Button className="max-sm:min-h-11" type="submit" disabled={!ready || pending}>{pending ? "Taşınıyor…" : "Taşı"}</Button>}
```

### src/components/employees/SlideOverPanel.tsx

```text
31:   const [pending, setPending] = useState(false);
38:   const guard = useGuardedFormNavigation({ active: isOpen, dirty, pending });
40:     if (!pending) guard.requestClose(onClose);
70:         pending={pending}
```

### src/components/employees/hooks/useEmployeeFormData.ts

```text
29:   isActive: boolean;
53:     isActive: employee?.isActive ?? true,
115:     .filter((r: { isActive?: boolean }) => r.isActive !== false)
```

### src/components/employees/hooks/useEmployeeFormSubmit.ts

```text
15: const DIFFABLE = ["projectId", "firstName", "lastName", "email", "tcNo", "cardNumber", "payrollCode", "companyId", "departmentId", "positionId", "shiftId", "shift", "notes", "isActive", "hourlyRate", "monthlySalary", "accessStartsAt"] as const satisfies readonly (keyof EmployeeFormData & keyof UpdateArgs)[];
19:  * yapılan değişiklik (ör. aynı drawer'da "Geri al" ile isActive) eski taslak değeriyle ezilmez.
62:   // parent state temizlenirse closure'daki employee null olabilir.
65:   const { run: handleSubmit, pending: isLoading } = useAsyncAction(
93:         isActive: formData.isActive ?? true,
168:   return { isLoading, handleSubmit, stages, serverError, savedResult };
```

### src/components/employees/import/BatchCardAssignDialog.tsx

```text
15: type AssignResult = { employeeId: string; status: "assigned" | "error"; message: string };
86:     setRows((current) => current.map((row) => row.employeeId === employeeId ? { ...row, cardNumber, status: undefined, message: undefined } : row));
114:       {rows.length === 0 ? <p role="status">Seçili kişilerin hepsinde kart var.</p> : <>
121:           <Button type="button" variant="outline" disabled={!canCapture || !readerId || !!sinceTime || startingCapture} onClick={() => void beginCapture()}> {startingCapture ? "Okuma başlatılıyor…" : sinceTime ? "Kart bekleniyor…" : "Okut"}</Button>
125:           <div><Input aria-invalid={row.status === "error"} aria-describedby={row.message ? `batch-card-${row.employeeId}-message` : undefined} aria-label={`${row.employeeName} kart numarası`} value={row.cardNumber} disabled={busy || row.status === "assigned"} onChange={(event) => updateCard(row.employeeId, event.target.value)} onPaste={(event) => { const pasted = event.clipboardData.getData("text"); if (pasted.includes("\n")) { event.preventDefault(); pasteCards(pasted); } }} />{row.message && <p id={`batch-card-${row.employeeId}-message`} className={row.status === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{row.message}</p>}</div>
127:         {message && <p role="status" className="text-sm">{message}</p>}
128:         {saved && <p role="status">Atanan: {rows.filter((row) => row.status === "assigned").length} · Hatalı: {rows.filter((row) => row.status === "error").length}</p>}
131:           <Button disabled={busy || rows.every((row) => !row.cardNumber.trim() || row.status === "assigned")} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Kaydet"}</Button>
```

### src/components/employees/import/DevicePersonImportDialog.tsx

```text
51:   const pending = useRef(false);
56:     if (!pending.current) { if (!next) setSelectedId(""); onOpenChange(next); }
59:       onEscapeKeyDown={(event) => { if (pending.current) event.preventDefault(); }}
60:       onInteractOutside={(event) => { if (pending.current) event.preventDefault(); }}>
69:             <NativeSelect disabled={isPending} className="min-h-11" value={device?._id ?? ""} onChange={(event) => { if (!pending.current) setSelectedId(event.target.value); }}>
74:           {open && device && <PersonImport key={device._id} device={device} connected={deviceConnection(device, now) === "online"} canBiometrics={can("biometrics.manage")} canManageAccess={can("accessRules.manage")} onPendingChange={(value) => { pending.current = value; setIsPending(value); }}
77:               pending.current = false; setIsPending(false); setSelectedId("");
86: const statuses = {
99:   return `${format(dates.accessStartsAt)} – ${format(dates.accessExpiresAt)} (Türkiye saati)`;
103: device: ServerDevice; connected: boolean; canBiometrics: boolean; canManageAccess: boolean; onPendingChange: (pending: boolean) => void;
182:     {!connected && <p role="status" className="text-sm text-warning">Cihaz çevrimdışı — aktarım yapılamaz</p>}
185:           <Button variant="outline" disabled={disabled} onClick={showPreview}>
190:               <p role="status" className="text-sm">
203:                 <p role="status" className="text-sm text-warning">
218:                         disabled={disabled || newRows.length === 0}
235:                     <TableHead columnId="status">Durum</TableHead>
256:                           disabled={disabled || !isSelectablePerson(row)}
279:                           tone={statuses[row.status].tone}
281:                           {statuses[row.status].label}
283:                         {row.status === "matched" && isSelectablePerson(row) && (
307:                 <p role="status" className="text-sm text-warning">Bu projede biyometri modülü kapalı; parmak izleri aktarılmaz (Ayarlar → Gizlilik)</p>
316:                 <Checkbox aria-label="Tüm kapılara erişim ver" checked={grantFullDeviceAccess} disabled={disabled} onCheckedChange={checked => setGrantFullDeviceAccess(checked === true)} />
320:                 disabled={disabled || selectedNos.length === 0}
```

### src/components/employees/import/EmployeeExportDialog.tsx

```text
39:       <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>İptal</Button><Button disabled={busy} onClick={() => void exportFile()}>{busy ? "Hazırlanıyor…" : "Dışa aktar"}</Button></div>
```

### src/components/employees/import/EmployeeImportDialog.tsx

```text
83:   const validCount = results.filter((result) => result.status === "created").length;
84:   const duplicateCount = results.filter((result) => result.status === "skippedDuplicate").length;
85:   const errorResults = results.filter((result) => result.status === "error");
93:       {stage === "file" && <div className="space-y-3"><Input aria-label="Excel dosyası seç" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => void chooseFile(event.currentTarget.files?.[0])} />{busy && <p role="status">Dosya kontrol ediliyor ve önizleme hazırlanıyor…</p>}</div>}
97:         <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setStage("file"); setResults([]); setRows([]); }}>Başka dosya seç</Button><Button disabled={validCount === 0} onClick={() => void confirmImport()}>İçe aktarmayı başlat</Button></div>
101:         <p>{results.filter((result) => result.status === "created" && result.message === "Kişi oluşturuldu").length} kişi oluşturuldu · {duplicateCount} yinelenen · {errorResults.length} hatalı{wasCancelled ? " · İptal edildi" : ""}</p>
103:         {!canResync && <p role="status">Kişiler cihazlara otomatik gönderilecek</p>}
104:         {syncMessage && <p role="status" className="text-sm">{syncMessage}</p>}
```

### src/components/employees/lib/employment.ts

```text
19:   return transfer?.status === "requested" || transfer?.status === "revoking" || transfer?.status === "stuck" ||
20:     transfer?.status === "revoked" || transfer?.status === "provisioning";
```

### src/components/employees/table/EmployeeTableBulkSelection.tsx

```text
12:       {can("employees.manage") ? <EmployeeBulkActions {...props} onSyncToDevices={can("accessRules.manage") ? props.onSyncToDevices : undefined} /> : can("accessRules.manage") ? <BulkBar count={props.selectedCount} onClear={() => props.onClear?.()}><Button variant="outline" disabled={props.pending || props.isSyncing} onClick={props.onSyncToDevices}>Cihazlara gönder</Button></BulkBar> : null}
```

### src/components/employees/table/EmployeeTableRow.tsx

```text
57:           disabled={
132:                   disabled={syncPending || bulkSyncPending}
143:                   disabled={!employee.email?.trim()}
```

### src/components/layout/AppHeader.tsx

```text
21:   const [pending, setPending] = useState(false);
51:         <DropdownMenuItem disabled={pending} onSelect={event => { event.preventDefault(); void logout(); }} className="text-destructive focus:text-destructive">{pending ? "Çıkış yapılıyor…" : "Çıkış yap"}</DropdownMenuItem>
```

### src/components/layout/AppSidebarNav.tsx

```text
22:         return <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active} tooltip={item.name} className={item.badge ? "gap-2 px-2" : undefined}>
30:           return <SidebarMenuSubItem key={reportGroup.key}><SidebarMenuSubButton asChild isActive={subActive}>
```

### src/components/leaves/EmployeePicker.tsx

```text
24:       <ComboboxTrigger {...control} placeholder={!value && !allowAll} aria-expanded={open} aria-controls={`${control.id}-options`} disabled={disabled}>
33:           {data === undefined ? <p role="status" className="p-3 text-sm">Kişiler yükleniyor…</p> : <>
38:             {!data.options.length && <p role="status" className="p-3 text-sm">Eşleşen kişi yok.</p>}
```

### src/components/leaves/LeaveForm.tsx

```text
81:   const { run, pending } = useAsyncAction(
136:     dirty: form.formState.isDirty || pending,
137:     pending,
181:           disabled={pending}
182:           aria-busy={pending}
238:                     disabled={!latestRow || latestRow.updatedAt === version}
292:                     disabled={pending}
327:           {checkConflict && conflict === undefined && <p role="status" className="text-sm">İzin çakışması kontrol ediliyor…</p>}
339:           <p role="status" className="text-xs text-muted-foreground">
359:         <FormActions className="static shrink-0 gap-2 p-4" isLoading={pending} onClose={close} cancelLabel="İptal" busyLabel="Kaydediliyor…" submitDisabled={checkConflict && conflict !== null} />
364:     if (pending) event.preventDefault();
```

### src/components/leaves/LeaveRequestsPanel.tsx

```text
52:   const { run, pending: busy } = useAsyncAction(async (current: NonNullable<typeof decision>, decisionNote: string) => {
86:               <TableStateRow colSpan={7} state="loading" label="Talepler yükleniyor." />
88:               <TableStateRow colSpan={7} state="empty" title="Bekleyen izin talebi yok." />
114:                       disabled={busy}
122:                       disabled={busy}
137:             disabled={cursor === null || busy}
144:             disabled={result.isDone || result.page.length === 0 || busy}
181:                 disabled={busy}
188:                 disabled={busy}
195:                 disabled={busy || (!decision?.approve && !validNote)}
```

### src/components/live-monitoring/LiveStatus.tsx

```text
11:     {live && <><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${connected ? "animate-pulse bg-success" : "bg-danger"}`} /><span role="status" className="font-medium text-foreground">{connected ? "Canlı" : "Bağlantı kesildi"}</span></>}
```

### src/components/live-monitoring/MonitoringPersonPicker.tsx

```text
26:   return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><ComboboxTrigger ref={buttonRef} placeholder={!selected && !allowClear} id={id} aria-label={id ? undefined : "Kişi"} aria-expanded={open} disabled={disabled}>{selected ? `${selected.firstName} ${selected.lastName}` : allowClear ? "Tüm kişiler" : "Bir kişi seçin"}</ComboboxTrigger></PopoverTrigger><PopoverContent className={COMBOBOX_CONTENT_CLASS}><Command shouldFilter={false}><CommandInput value={search} onValueChange={setSearch} placeholder="Ad veya soyad ara…" aria-label="Projede kişi ara" /><CommandList>{people === undefined || term !== search ? <p role="status" className="py-6 text-center text-sm">Aranıyor…</p> : people.length === 0 ? <p role="status" className="py-6 text-center text-sm">Kişi bulunamadı</p> : null}
28:     {term === search && people?.map(person => <CommandItem key={person._id} disabled={!allowClear && person.isActive === false} value={person._id} onSelect={() => { onChange(person); setOpen(false); }}>{person.firstName} {person.lastName}{person.isActive === false ? " · Pasif" : ""}{value === person._id && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}</CommandItem>)}
```

### src/components/live-monitoring/ReadingDetailPanel.tsx

```text
30: export function ReadingDetailPanel({ readingId, onClose, trigger, onDirtyChange, onPendingChange }: { readingId: string; onClose: () => void; trigger: React.RefObject<HTMLElement | null>; onDirtyChange: (dirty: boolean) => void; onPendingChange: (pending: boolean) => void }) {
32:   const pending = useRef(false);
35:   const onPending = useCallback((value: boolean) => { pending.current = value; onPendingChange(value); }, [onPendingChange]);
36:   return <><Sheet open onOpenChange={open => { if (!open && !pending.current) guard.requestClose(onClose); }}><SheetContent size="full" className="flex w-full max-w-full flex-col p-4 sm:max-w-[480px] motion-reduce:animate-none motion-reduce:transition-none" onCloseAutoFocus={e => { if (trigger.current?.isConnected) { e.preventDefault(); trigger.current.focus(); } }}><SheetHeader className="shrink-0 pr-8 text-left"><SheetTitle>Okuma ayrıntısı</SheetTitle><SheetDescription>Erişim okuması · İstanbul saati</SheetDescription></SheetHeader><div className="-mx-1 min-w-0 flex-1 overflow-y-auto px-1 pt-5 pb-1"><QuerySectionBoundary resetKey={readingId} description="Bu okuma artık görüntülenemiyor"><Detail id={readingId as Id<"cardReadings">} onDirty={onDirty} onPending={onPending} onClose={onClose} /></QuerySectionBoundary></div></SheetContent></Sheet>{guard.dialog}</>;
```

### src/components/live-monitoring/useLiveReadings.ts

```text
9:   const [state, dispatch] = useReducer(feedReducer<Reading>, undefined, initialFeed<Reading>);
12:   const response = useQuery(api.cardReadings.listLiveSince, enabled ? { projectId, source: source === "all" ? undefined : source, limit: LIVE_LIMIT, afterCreationTime: state.watermark } : "skip");
19:   useEffect(() => { if (state.reloadRequired) reload(); }, [state.reloadRequired, reload]);
21:   return { rows: state.rows, initialized: state.initialized, truncated: state.truncated, day, loading: !state.initialized };
```

### src/components/pdks/CorrectionRequestsPanel.tsx

```text
54:   const { run, pending: busy } = useAsyncAction(async (current: NonNullable<typeof decision>, decisionNote: string) => {
124:                       disabled={busy}
132:                       disabled={busy}
148:             disabled={cursor === null || busy}
155:             disabled={result.isDone || result.page.length === 0 || busy}
198:                 disabled={busy}
205:                 disabled={busy}
212:                 disabled={busy || (!decision?.approve && !validNote)}
232:   const count = useQuery(api.leaveRequests.pendingCount, { projectId, kind: "corrections" });
```

### src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx

```text
20: import { statusMetaFor } from "../statusMeta";
43:   state: { error: string | null } = { error: null };
48:     if (!this.state.error) return this.props.children;
50:       this.state.error,
131:             <StatusBadge tone={statusMetaFor(day).tone}>
132:               {statusMetaFor(day).label}
148:             { key: "raw", label: "Brüt süre", value: displayDuration(day.rawTotalMinutes ?? day.totalMinutes, day.status, day.durationMeasured) },
149:             { key: "total", label: "Toplam süre (mola sonrası)", value: displayDuration(day.totalMinutes, day.status, day.durationMeasured) },
150:             { key: "overtime", label: "Fazla mesai", value: displayDuration(day.overtimeMinutes, day.status, day.durationMeasured) },
151:             { key: "night", label: "Gece süresi", value: displayDuration(day.nightMinutes ?? 0, day.status, day.durationMeasured) },
215:           {canManage && day.status !== "future" && (
218:           {editing === day.date && day.status !== "future" && (
```

### src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx

```text
85:     [pending, setPending] = useState(false),
159:           <DropdownMenuSubTrigger disabled={disabled}>Dışa aktar</DropdownMenuSubTrigger>
216:           {!monthly && type && <PDKSExportColumns records={records} preferences={preferences} canSeePay={canSeePay} disabled={pending} onChange={updatePreferences} />}
225:             <div role="status" className="border-y py-3 text-sm">
256:               disabled={pending}
262:               disabled={
263:                 pending || reviewBlocked || !projectId || (!monthly && records.length === 0)
267:               {pending
```

### src/components/pdks/dashboard/PDKSSmartPresets.tsx

```text
119:             disabled={Boolean(loadingKey) || !projectId}
```

### src/components/pdks/dashboard/PdksRowStatus.tsx

```text
4: import { statusMetaFor } from "../statusMeta";
9:   const meta = statusMetaFor(record);
```

### src/components/pdks/records/recordsView.ts

```text
8: import { STATUS_FILTER_LABELS, isPdksInProgress } from "@/components/pdks/statusMeta";
54:     filters.statusFilter !== "all" ||
70:       filters.statusFilter !== "all" &&
71:         STATUS_FILTER_LABELS[filters.statusFilter],
75:   const passive = (status: "weekend" | "holiday" | "noData" | "future") => allRecords.reduce((sum, row) => sum + (row.days.length ? row.days.filter(d => !d.noShift && d.status === status).length : Number(!row.noShift && row.status === status)), 0);
78:     { status: "present", value: summary.present },
79:     { status: "late", value: summary.late },
80:     { status: "absent", value: summary.absent },
81:     { status: "leave", value: summary.leave },
82:     { status: "weekend", value: passive("weekend") },
83:     { status: "holiday", value: passive("holiday") },
84:     { status: "noData", value: passive("noData") },
85:     { status: "future", value: passive("future") - inProgress },
```

### src/components/pdks/records/usePdksRecordsView.ts

```text
31:     isLoading,
44:   return { ...derived, filters, setFilters, navigate, projectId, activeProject, canManage, projectLoading, ai, setAi, importOpen, setImport, warningsOpen, setWarningsOpen, setSmartPreset, setSelection, setDrilldown, isLoading, selectedDate, dateRangeLabel, startDate, endDate, detailTrigger, openDetail };
```

### src/components/reports/ReportResults.tsx

```text
32:   const [state, setState] = useState<{ data?: PdksTableData; error?: unknown }>({});
42:   if (state.error !== undefined) throw state.error;
43:   return state.data;
```

### src/components/settings/SettingsSidebar.tsx

```text
26:       <NativeSelect id="settings-section" className="w-full" value={selected} disabled={disabled}
35:         return <a key={item.key} href={`/settings${next.size ? `?${next}` : ""}`} aria-current={selected === item.key ? "page" : undefined} aria-disabled={disabled}
```

### src/components/settings/sections/GeneralSettings.tsx

```text
34:     {!settings && <p role="status" className="text-sm text-muted-foreground">Henüz şirket bilgisi kaydedilmemiş. Bu proje için şirket bilgilerini girin.</p>}
36:     <fieldset disabled={saving} className="min-w-0 space-y-6">
```

### src/components/settings/sections/MailSettings.tsx

```text
19: import { Switch } from "@/components/ui/switch";
33:   isActive: z.boolean(),
53:     fromName: saved?.fromName ?? "", fromEmail: saved?.fromEmail ?? "", isActive: saved?.isActive ?? true,
67:   useSettingsFormState("mail", draft.dirty, action.pending);
75:     <p role="status" className="rounded border p-3 text-sm break-words">
76:       {saved?.isActive ? <>Rapor e-postaları <strong>{saved.fromEmail}</strong> hesabınızdan gönderiliyor.</>
85:       <fieldset disabled={action.pending} className="min-w-0 space-y-4">
121:           <Switch checked={values.isActive} onCheckedChange={isActive => draft.change({ isActive })} />
124:       <SettingsSaveBar dirty={draft.dirty} saving={action.pending} valid={parsed.success} label="Hesabı kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
128:       <Button type="button" variant="outline" disabled={action.pending} onClick={() => setConfirmRemove(true)}>Hesabı kaldır</Button>
172:         <Input type="email" value={to} disabled={action.pending} onChange={event => setTo(event.target.value)} />
174:       <Button type="submit" disabled={action.pending}>{action.pending ? "Gönderiliyor…" : "Test maili gönder"}</Button>
176:     {result && <p role={result.ok ? "status" : "alert"} className={`text-sm break-words ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
```

### src/components/settings/sections/NotificationSettings.tsx

```text
5: import { Switch } from "@/components/ui/switch";
11:   const { notificationSettings: saved, isLoading, saveNotificationSettings, isSaving } = useNotificationSettings();
15:   useSettingsFormState("notifications", draft.dirty, isSaving);
16:   if (isLoading) return <SectionSkeleton label="Bildirim ayarları yükleniyor" />;
25:     <fieldset disabled={isSaving} className="space-y-4">
34:     <SettingsSaveBar dirty={draft.dirty} saving={isSaving} label="Bildirim tercihlerini kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
```

### src/components/settings/sections/ReportsSettings.tsx

```text
107:   useSettingsFormState("report-download", false, excelAction.pending || pdfAction.pending);
109:   const isLoading =
138:           <p className="text-sm font-medium" role="status">Kapsam: {currentData?.scopeLabel ?? scopeLabel}</p>
139:           <fieldset disabled={excelAction.pending || pdfAction.pending} className="grid min-w-0 grid-cols-1 gap-4 min-[761px]:grid-cols-2">
168:               {[...new Set(attendanceData.rows.map((row) => row.reliabilityNote).filter(Boolean))].map((note) => <p key={note} role="status">{note}</p>)}
174:             <p role="status" className="text-sm text-muted-foreground">Rapor için geçerli bir ücret girin.</p>
175:           ) : isLoading ? (
210:                 <Button onClick={() => void excelAction.run()} disabled={!hasData || excelAction.pending || pdfAction.pending} variant="default">
216:                   disabled={!hasData || reportType !== "sgk" || pdfAction.pending || excelAction.pending}
```

### src/components/settings/sections/RolesSettings.tsx

```text
22:   const { run, pending } = useAsyncAction(save, { error: "Rol yetkileri kaydedilemedi" });
23:   useSettingsFormState("roles", false, pending);
28:   return <section className="space-y-4" aria-busy={pending || !roles}>
35:         <tbody>{!roles ? <TableStateRow colSpan={1 + PROJECT_ROLES.length} state="loading" label="Roller yükleniyor" /> : PERMISSIONS.map(permission => <tr key={permission} className="border-b"><th scope="row" className={`${STICKY_CELL} p-3 text-left font-normal`}>{PERMISSION_LABELS[permission]}</th>{PROJECT_ROLES.map(role => {
38:           return <td key={role} className="p-3 text-center"><label className="inline-flex min-h-9 min-w-9 items-center justify-center"><span className="sr-only">{ROLE_LABELS[role]}: {PERMISSION_LABELS[permission]}</span><input type="checkbox" checked={permissions.includes(permission)} disabled={locked || pending} aria-describedby={locked ? "roles-locked" : undefined} onChange={event => void update(role, event.target.checked ? PERMISSIONS.filter(p => p === permission || permissions.includes(p)) : permissions.filter(p => p !== permission))} /></label></td>;
40:         <tfoot><tr><th scope="row" className={`${STICKY_CELL} p-3 text-left font-normal`}>Varsayılan yetkiler</th>{PROJECT_ROLES.map(role => <td key={role} className="p-2 text-center"><Button size="sm" variant="outline" className="h-auto min-h-9 whitespace-normal py-1" disabled={!roles || pending || role === LOCKED_ROLE} aria-label={`${ROLE_LABELS[role]}: Varsayılana dön`} onClick={() => void update(role, ROLE_DEFAULTS[role])}>Varsayılana dön</Button></td>)}</tr></tfoot>
```

### src/components/settings/sections/components/HolidayCalendarManager.tsx

```text
73:   const pending = add.pending || seedAction.pending || deleting;
74:   useSettingsFormState("holidays", dirty, pending);
80:   const close = () => { if (!pending) guard.requestClose(() => { setOpen(false); setValues(empty); setErrors({}); setFailed(false); }); };
85:         <Button variant="outline" size="sm" disabled={pending || !projectId || holidays === undefined} onClick={() => setSeedOpen(true)}>{seedAction.pending ? "Yükleniyor…" : "Resmi tatilleri yükle"}</Button>
86:         <Button variant="outline" size="sm" disabled={pending || !projectId} onClick={() => setOpen(true)}>Tatil ekle</Button>
91:         <Input id="holiday-year" type="number" min={1900} max={2100} value={yearText} disabled={pending} className="w-full min-w-0" onChange={event => {
99:         <TableBody>{loading || holidays === undefined ? <TableStateRow colSpan={3} state="loading" label="Tatiller yükleniyor" /> : holidays.length === 0 ? <TableStateRow colSpan={3} state="empty" title={`${year} yılı için tanımlı tatil yok`} description="Bir tatil ekleyin veya resmi tatilleri yükleyin." /> : [...holidays].sort((a, b) => a.date.localeCompare(b.date)).map(holiday => <TableRow key={holiday._id} id={`holiday-${holiday.date}`} tabIndex={-1} className="h-[42px]">
102:           <TableCell className="w-12"><Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`${holiday.name} tatilini sil`} disabled={pending} onClick={() => { setDeleteHoliday(holiday); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
118:           <fieldset disabled={pending} className="space-y-4">
123:           <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={pending} onClick={close}>Vazgeç</Button><Button type="submit" disabled={pending}>{add.pending ? "Ekleniyor…" : "Tatili ekle"}</Button></div>
127:     <HolidaySeedConfirmation open={seedOpen} year={year} count={seedCount} pending={seedAction.pending} onOpenChange={setSeedOpen} onConfirm={async () => { if (await seedAction.run()) setSeedOpen(false); }} />
142: export function HolidaySeedConfirmation({ open, year, count, pending, onOpenChange, onConfirm }: {
143:   open: boolean; year: number; count: number; pending: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void;
145:   return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
147:       <div className="flex justify-end gap-3"><Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Vazgeç</Button><Button disabled={pending || count === 0} onClick={onConfirm}>Tatilleri yükle</Button></div>
```

### src/components/settings/sections/components/OvertimeSettingsForm.tsx

```text
65:   const { run, pending } = useAsyncAction(async (payload: Values) => {
70:   useSettingsFormState("overtime", draft.dirty, pending);
93:       <fieldset disabled={pending} className="grid grid-cols-1 gap-x-4 gap-y-3 min-[761px]:grid-cols-2 min-[1200px]:grid-cols-4">
95:           {(control) => <Select disabled={pending} value={values.overtimeBasis} onValueChange={basis => {
109:           {(control) => <Select disabled={pending} value={values.nightCombineMode} onValueChange={mode => {
121:           {(control) => <Select disabled={pending} value={values.nightShiftDayMode} onValueChange={mode => {
135:       <SettingsSaveBar dirty={draft.dirty} saving={pending} valid={parsed.success} label="Mesai ayarlarını kaydet" onCancel={() => { draft.reset(); setErrors({}); setFailed(false); }} />
```

### src/components/settings/sections/components/PdksRulesSettings.tsx

```text
53:       <section aria-label="PDKS devam kuralları" role="status">
86:   const [pending, setPending] = useState(false);
153:                     disabled={pending}
188:           if (pending) return;
213:         <fieldset disabled={pending} className="space-y-3">
223:             disabled={
224:               pending ||
229:             {pending ? "Yayınlanıyor…" : "Yeni sürümü yayınla"}
239:         <p role="status" className="text-sm">
246:         pending={pending}
251:           if (!confirmation || pending) return;
258:           if (confirmation?.kind !== "delete" || pending) return;
```

### src/components/settings/sections/general/SystemSettingsForm.tsx

```text
3: import { Switch } from "@/components/ui/switch";
```

### src/components/settings/sections/hooks/useGeneralSettings.ts

```text
17:   const { run: saveSettings, pending: saving } = useAsyncAction(async (data: {
```

### src/components/settings/sections/integrations/BridgeIntegrationCard.tsx

```text
36:   useSettingsFormState("bridge", false, create.pending || revoking);
43:         <Button onClick={() => void create.run()} disabled={!projectId || bridges === undefined || create.pending || revoking}>{create.pending ? "Oluşturuluyor…" : "Anahtar oluştur"}</Button></div>
55:             <Button variant="outline" size="icon" aria-label="Anahtarı kopyala" disabled={copy.pending} onClick={() => void copy.run(bridge.token)}><Copy className="h-4 w-4" /></Button>
56:             <Button variant="outline" disabled={create.pending || revoking} onClick={() => { setRevokeTarget({ id: bridge._id, label: `Anahtar ${mask()}` }); setRevokeOpen(true); }}>Anahtarı iptal et</Button>
```

### src/components/settings/sections/privacy/BiometricDestructionCard.tsx

```text
20: export function destructionStatusLabel(run: { status: string; deviceOperations: number; deviceFailures: number; deviceUnconfirmed: number }): string {
21:   if (run.status === "running") return "İmha sürüyor";
22:   if (run.status === "waitingDevices") return "Cihaz onayı bekleniyor";
23:   if (run.status === "failed") return "İşlem kesildi";
49:         <Textarea value={reason} onChange={event => onReason(event.target.value)} maxLength={500} disabled={busy} rows={3} />
52:         <Input value={confirmText} onChange={event => onConfirmText(event.target.value)} autoComplete="off" disabled={busy} />
55:     <Button type="button" variant="destructive" disabled={!valid || !hasTemplates || busy || moduleEnabled} onClick={onContinue}>İmha işlemini onayla</Button>
77:   const active = latestRun?.status === "running" || latestRun?.status === "waitingDevices";
78:   const { run: count, pending: counting } = useAsyncAction(async () => {
97:     {module.enabled && <p className="text-sm text-warning" role="status">Biyometri modülü açık. Devam etmek için önce modülü kapatın.</p>}
98:     <fieldset className="flex flex-wrap gap-x-6 gap-y-3" disabled={busy}>
105:     <Button variant="outline" type="button" disabled={busy || kinds.length === 0} onClick={() => void count()}>{counting ? "Sayılıyor…" : "Sayım göster"}</Button>
106:     {preview && <div className="space-y-2 text-sm" role="status">
120:         <StatusBadge className="max-w-full whitespace-normal break-words" tone={latestRun.status === "failed" || latestRun.deviceFailures || latestRun.deviceUnconfirmed ? "warning" : active ? "info" : "neutral"}>
125:       {latestRun.pendingDeviceChecks > 0 && <p>Cihaz sonuçları tek kontrol zincirinde izleniyor. Çevrimdışı veya uzun süredir bağlantı kurmayan cihazlar doğrulanamadı olarak kaydedilir. Bağlı cihazlarda en fazla 24 saat beklenir.</p>}
```

### src/components/settings/sections/privacy/BiometricModuleCard.tsx

```text
35:   const { run, pending } = useAsyncAction(save, { success: "Biyometri ayarı kaydedildi", error: "Biyometri ayarı kaydedilemedi" });
36:   const busy = pending || disabling;
55:     <Button variant="outline" disabled={busy} onClick={() => { setTarget(!data.enabled); setReason(""); }}>{data.enabled ? "Modülü kapat" : "Modülü aç"}</Button>
64:           <Textarea id={reasonId} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} required={target === true} maxLength={500} rows={4} />
67:           <Button variant="outline" disabled={busy} onClick={requestClose}>Vazgeç</Button>
68:           <Button disabled={!valid || busy} onClick={async () => {
```

### src/components/settings/sections/privacy/RetentionAssistantCard.tsx

```text
8: import { Switch } from "@/components/ui/switch";
41:   useSettingsFormState("privacy-retention", draft.dirty, save.pending || confirmPending);
53:       <fieldset disabled={save.pending || confirmPending} className="min-w-0 space-y-4">
63:       <SettingsSaveBar dirty={draft.dirty} saving={save.pending || confirmPending} valid={parsed.success} label="Saklama süresini kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
85:   const busy = save.pending || confirmPending;
94:         <Switch id="assistant-mask" checked={draft.values.enabled} disabled={busy} onCheckedChange={next => draft.change({ enabled: next })} />
```

### src/components/settings/sections/privacy/VisitorNoticeCard.tsx

```text
41:   useSettingsFormState("visitor-retention", draft.dirty, save.pending);
54:       <Input id="visitor-retention-days" type="number" min={30} max={3650} step={1} value={draft.values.days} disabled={save.pending}
57:     {needsPreview && <p role="status" className="text-sm text-muted-foreground">{preview === undefined
60:     <SettingsSaveBar dirty={draft.dirty} saving={save.pending} valid={parsed.success && (!needsPreview || preview !== undefined)}
71:   useSettingsFormState("visitor-notice", draft.dirty, action.pending);
82:       <fieldset disabled={action.pending} className="space-y-4">
87:       <SettingsSaveBar dirty={draft.dirty} saving={action.pending} valid={parsed.success} label="Ziyaretçi metni ayarını kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
```

### src/components/shared/PageTemplate.tsx

```text
24: /** Page composition only: the shell owns main/gutters; modules own state and permissions. */
```

### src/components/shifts/AssignShiftDialog.tsx

```text
60:     shiftId: shifts.some(s => s._id === initial?.shiftId && s.isActive !== false) ? initial?.shiftId ?? "" : "",
73:   const [pending, setPending] = useState(false);
106:       const remaining = response.results.filter(item => item.status !== "assigned");
126:   const unassigned = result?.results.filter(item => item.status !== "assigned") ?? [];
147:           <fieldset disabled={pending} className="space-y-4 min-w-0">
150:                 options={shifts.filter(shift => shift.isActive !== false).map(shift => ({ value: shift._id, label: `${shift.name} · ${shiftTimeLabel(shift)}` }))}
161:             <section role="status" className="space-y-3 rounded-md border p-3 text-sm">
169:                   <input type="checkbox" className="size-4 shrink-0 accent-primary" disabled={pending}
176:                   <input type="checkbox" className="size-4 shrink-0 accent-primary" disabled={pending}
184:             <Button variant="outline" disabled={pending} onClick={close}>
187:             <Button disabled={pending} onClick={() => void save()}>
188:               {pending ? "Atanıyor…" : "Vardiya ata"}
203:         tone={decisionTone(item.status)}
205:         {decisionLabels[item.status]}
```

### src/components/shifts/AssignmentEmployeeTree.tsx

```text
98:         <SelectionCheckbox label="Tümünü seç" checked={selectionState(visibleIds, selectedIds)} disabled={visible.length === 0 || departments === undefined}
134:     checked={checked === true} disabled={disabled}
```

### src/components/shifts/ClearAssignmentsDialog.tsx

```text
17:   const [pending, setPending] = useState(false);
52:         <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
53:         <Button variant="destructive" disabled={pending} onClick={() => void run()}>
54:           {pending ? "Temizleniyor…" : "Hepsini temizle"}
```

### src/components/shifts/ShiftDayDetails.tsx

```text
101:         {can("schedule.manage") && <DialogFooter className="flex-row justify-end"><Button aria-describedby={!canAssign ? "day-assign-help" : undefined} disabled={!canAssign} onClick={onAssign}>
```

### src/components/shifts/ShiftTree.tsx

```text
54:               {shift.isActive === false && <span className="text-[10px] text-muted-foreground">Pasif</span>}
60:             {shift.isActive !== false && <DropdownMenuItem onSelect={() => setAssigning(shift)}>Kişi ata</DropdownMenuItem>}
68:         editingShift={editing ? { ...editing, overtimeEnabled: editing.overtimeEnabled ?? true, isActive: editing.isActive ?? true } : null}
```

### src/components/shifts/calendar/CalendarHeader.tsx

```text
21:           <Button className="h-9 px-3 text-sm" disabled={loading}>
27:           <DropdownMenuItem onSelect={onAssign} disabled={activeCount === 0} className="gap-2 py-2">
48:             <DropdownMenuSubTrigger disabled={loading || exporting}><Download className="mr-2 size-4" aria-hidden="true" />Dışa aktar</DropdownMenuSubTrigger>
```

### src/components/shifts/calendar/ShiftCalendarPlan.tsx

```text
109:   const active = shifts.filter((s) => s.isActive !== false);
169:         <p role="status" className="text-sm text-muted-foreground">
198:           disabled={loading || !active.length}
```

### src/components/sync/SyncIssuesBanner.tsx

```text
109:           <Button type="submit" size="sm" disabled={!closeReason.trim() || dismiss.pending}>Gerekçeyle kapat</Button>
113:       {canManage && item.issue.canRetry && <Button size="sm" variant="outline" disabled={dismiss.pending}
117:     {((!isDeletion && canManage) || canDismissDeletion) && <Button ref={closeButton} size="icon" variant="ghost" className="shrink-0" disabled={dismiss.pending} aria-label={`${item.issue.deviceName} uyarısını kapat`}
172:       <Button variant="ghost" size="sm" disabled={refreshing} onClick={() => setRefreshing(true)}>
175:       {dismissibleItems.length > 0 && <Button variant="ghost" size="sm" disabled={!hik || !ide}
199:         const count = results.reduce((sum, result) => sum + (result.status === "fulfilled" ? result.value.count : 0), 0);
200:         const failure = results.find((result) => result.status === "rejected");
201:         if (failure?.status === "rejected") throw new Error(`${count} uyarı kapatıldı; kalan uyarılar kapatılamadı. ${errorMessage(failure.reason)}`);
202:         notify.success(`${count} uyarı kapatıldı`, results.some((result) => result.status === "fulfilled" && result.value.hasMore) ? "Kapsamda başka uyarılar var." : undefined);
```

### src/components/visitors/VisitorCardCapture.tsx

```text
157:             <StatusBadge tone="success" role="status">
162:             <span role="status" className="flex items-center gap-1.5 text-muted-foreground">
166:           ) : <span role="status" className="text-muted-foreground">{captureError ?? (starting ? "Okuma başlatılıyor…" : timedOut ? "30 saniyede kart okunmadı. Okuyucuyu kontrol edin veya numarayı elle girin." : "Dinleme kapalı")}</span>}
171:             disabled={starting || !canCapture}
```

### src/components/visitors/VisitorCombobox.tsx

```text
21:     <ComboboxTrigger wrap placeholder={!selectedName} id={id} aria-label={label} aria-controls={listId} aria-expanded={open} aria-invalid={!!error} aria-describedby={describedBy ?? (error ? `${id}-error` : undefined)} disabled={disabled}>
27:       {options.map(option => <CommandItem key={option.id} disabled={option.disabled} value={`${option.name} ${option.id}`} onSelect={() => { onChange(option.id); setOpen(false); }}>{option.name}{value === option.id && <><Check className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" /><span className="sr-only">Seçili</span></>}</CommandItem>)}
```

### src/components/visitors/VisitorFilters.tsx

```text
3: import { isVisitorStatus, visitorStatusInfo, type VisitorStatus } from "./lib/status";
6: export function VisitorFilters({ searchQuery, onSearchChange, statusFilter, onStatusFilterChange, onClear }: {
8:   statusFilter: VisitorStatusFilter; onStatusFilterChange: (value: VisitorStatusFilter) => void;
12:     <FilterBar search={searchQuery} onSearchChange={onSearchChange} searchLabel="Ziyaretçi ara" placeholder="Ad, şirket veya kart numarası" onClear={onClear} hasFilters={statusFilter !== "all"}>
13:       <FilterField label="Erişim durumu" htmlFor="visitor-status">
14:         <Select value={statusFilter} onValueChange={value => onStatusFilterChange(isVisitorStatus(value) ? value : "all")}>
15:           <SelectTrigger id="visitor-status" className="w-full min-w-0"><SelectValue /></SelectTrigger><SelectContent>
```

### src/components/visitors/VisitorForm.tsx

```text
14:   onStateChange: (dirty: boolean, pending: boolean) => void;
19:   const { isLoading, handleSubmit } = useVisitorFormSubmit(visitor, onSave);
21:   useEffect(() => { onStateChange(isDirty, isLoading); }, [isDirty, isLoading, onStateChange]);
24:     const result = visitorFormSchema.safeParse({ ...formData, isEditing: !!visitor, isPreRegistration, originalExpiry: visitor ? isoToLocalInput(visitor.visitEnd ?? "") : undefined, wasActive: visitor?.isActive });
32:       const ids: Record<string, string> = { firstName: "v_first_name", lastName: "v_last_name", cardNumber: "v_card", doors: "v_doors", accessExpiresAt: "v_expires" };
33:       const firstError = ["doors", "accessExpiresAt", "cardNumber", "firstName", "lastName"].find(key => errors[key]);
42:       <fieldset disabled={isLoading} className="min-w-0 space-y-5 p-5">
43:         <VisitorFormFields formData={formData} setFormData={setFormData} assignedDoors={visitor?.presetRuleName} hostEmployees={hostEmployees} hostSearch={hostSearch} onHostSearchChange={setHostSearch} hostsLoading={hostsLoading} isCurrentlyActive={visitor?.isActive === true} isEditing={!!visitor} isPreRegistration={isPreRegistration} kvkkConsentAt={visitor?.kvkkConsent?.grantedAt} errors={fieldErrors} />
46:       <FormActions isLoading={isLoading} onClose={onClose} busyLabel="Kaydediliyor…" submitLabel={isPreRegistration && formData.isActive ? "Erişimi etkinleştir" : visitor ? "Değişiklikleri kaydet" : "Ziyaretçiyi kaydet"} />
```

### src/components/visitors/VisitorFormFields.tsx

```text
42:     <FormFieldWrapper htmlFor="v_expires" label="Geçerlilik bitişi *" error={errors.accessExpiresAt} hint="Türkiye saati. Sürenin dolması fiziksel çıkış kaydı oluşturmaz; cihaz işlemlerini proje senkronizasyon şeridinden izleyin.">{control => <div className="flex min-w-0 gap-2"><DateInput {...control} required className="min-w-0 flex-1" value={formData.accessExpiresAt.slice(0, 10)} onChange={date => change("accessExpiresAt", `${date}T${formData.accessExpiresAt.slice(11, 16) || "00:00"}`)} /><Input id={`${control.id}-time`} type="time" className="w-28 shrink-0" aria-label="Geçerlilik bitiş saati" aria-invalid={control["aria-invalid"]} value={formData.accessExpiresAt.slice(11, 16)} onChange={e => change("accessExpiresAt", `${formData.accessExpiresAt.slice(0, 10)}T${e.target.value}`)} /></div>}</FormFieldWrapper>
45:     {isCurrentlyActive ? <p className="text-sm text-muted-foreground">Erişimi kapatmak için ayrıntıdaki 'Ziyareti sonlandır'ı kullanın.</p> : <div className="flex items-center gap-2"><Checkbox id="v_active" checked={formData.isActive} onCheckedChange={checked => change("isActive", checked === true)} /><Label htmlFor="v_active">Erişim izni ver</Label></div>}<p className="text-xs text-muted-foreground">Erişim geçerlilik bitişiyle sınırlıdır; süresi dolan kayıt aktif sayılmaz.</p>
57:     <div className="space-y-1 border-t pt-4"><div className="flex items-center gap-2"><Checkbox id="v_kvkk" checked={!!kvkkConsentAt || (formData.kvkkConsent && formData.kvkkDocumentVersion === notice?.version)} disabled={!!kvkkConsentAt || !notice?.version || !notice?.url} onCheckedChange={checked => setFormData({ ...formData, kvkkConsent: checked === true, kvkkDocumentVersion: checked === true ? notice?.version ?? undefined : undefined })} /><Label htmlFor="v_kvkk">KVKK rıza kaydı alındı</Label></div><p className="text-xs text-muted-foreground">{kvkkConsentAt ? `Kayıt tarihi: ${formatVisitorTime(kvkkConsentAt)}` : "Ziyaretçi aydınlatma metnini onayladıysa işaretleyin."}</p>{notice?.url && notice.version ? <a className="text-sm underline" href={notice.url} target="_blank" rel="noopener noreferrer">Aydınlatma metni · Sürüm {notice.version}</a> : <div className="space-y-1"><p className="text-xs text-muted-foreground">Aydınlatma metni tanımlı değil.</p>{can("admin.manage") && <Link className="text-sm underline" to="/settings?tab=privacy" target="_blank" rel="noopener noreferrer">Ayarlar › Gizlilik’te aydınlatma metni tanımlayın</Link>}</div>}</div>
```

### src/components/visitors/VisitorManagement.tsx

```text
15: import { displayVisitorStatus, isVisitorStatus } from "./lib/status";
30:   const rawStatus = params.get("status");
31:   const status: VisitorStatusFilter = isVisitorStatus(rawStatus) ? rawStatus : "all";
40:       if (nextStatus !== "all") next.set("status", nextStatus); else next.delete("status");
45:   const resetKey = `${projectId}:${search}:${status}:${pageSize}`;
50:     filters={ready && (<VisitorFilters searchQuery={search} onSearchChange={q => filter(q, status, true)} statusFilter={status} onStatusFilterChange={value => filter(search, value)} onClear={clear} />)}
55:         <VisitorList key={resetKey} search={search} status={status} pageSize={pageSize} onPageSizeChange={setPageSize} now={now} onOpen={visitor => setPanel({ visitor, projectId })} onClear={clear} />
61: export function VisitorList({ search, status, pageSize, onPageSizeChange, now, onOpen, onClear }: {
62:   search: string; status: VisitorStatusFilter; pageSize: number; onPageSizeChange: (value: number) => void; now: number;
67:   const result = useVisitors({ search, status: status === "all" ? undefined : status, cursor, pageSize, now });
69:   const page = useStableQuery(result.page, JSON.stringify([search, status, pageSize, cursor]));
71:   const visitors = page.page.map(visitor => ({ ...visitor, status: displayVisitorStatus(visitor, now) }));
72:   const filtered = !!search.trim() || status !== "all";
```

### src/components/visitors/VisitorSlideOverPanel.tsx

```text
17: import { displayVisitorStatus, visitorPresenceLabels, visitorStatusInfo } from "./lib/status";
28:   const [formState, setFormState] = useState({ dirty: false, pending: false });
30:   const close = () => { if (!formState.pending) guard.requestClose(onClose); };
31:   const onFormState = useCallback((dirty: boolean, pending: boolean) => setFormState({ dirty, pending }), []);
32:   return <><DetailSheet open={isOpen} onRequestClose={close} pending={formState.pending}
49:   visitor: Visitor; now: number; canManage: boolean; onClose: () => void; onSaved: () => void; onFormState: (dirty: boolean, pending: boolean) => void;
65:   const status = visitorStatusInfo[displayVisitorStatus(detail, now)];
78:     <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={status.tone}>{status.label}</StatusBadge>{canManage && <Button variant="outline" onClick={onEdit}>{canAssignVisitorPreset(detail) ? "Kart ve erişim ata" : "Düzenle"}</Button>}</div>
97:       {detail.isActive && <Button variant="outline" onClick={() => setConfirmation("checkout")}>Ziyareti sonlandır</Button>}
99:         {!detail.isActive && !detail.cardReleased && !needsCard && <DropdownMenuItem onSelect={() => setConfirmation("release")}>Kartı serbest bırak</DropdownMenuItem>}
```

### src/components/visitors/VisitorTable.tsx

```text
10: import { visitorPresenceLabels, visitorStatusInfo } from "./lib/status";
17:   const badge = (visitor: Visitor) => <StatusBadge tone={visitorStatusInfo[visitor.status].tone}>{visitorStatusInfo[visitor.status].label}</StatusBadge>;
29:       </TableRow></TableHeader><TableBody>{loading ? <TableStateRow colSpan={7} state="loading" label="Ziyaretçiler yükleniyor" /> : !visitors.length ? <TableStateRow colSpan={7} state="custom">{emptyState}</TableStateRow> : visitors.map(visitor => <TableRow key={visitor._id} className={ROW_CLICK_CLASS} onClick={onRowActivate(() => onOpen(visitor))}>
```

### src/components/visitors/hooks/useVisitorFormData.ts

```text
21:   accessExpiresAt: string; // datetime-local (TR saati)
22:   isActive: boolean;
39:   accessExpiresAt: defaultExpiryLocalInput(),
40:   isActive: true,
68:     name: `${e.firstName} ${e.lastName}${e.isActive ? "" : " (Pasif)"}`,
88:         accessExpiresAt: visitor.visitEnd
91:         isActive: visitor.isActive ?? true,
```

### src/components/visitors/hooks/useVisitorFormSchema.ts

```text
9:   isActive: z.boolean().optional(),
15:   accessExpiresAt: z.string(),
18:   if (!data.isEditing || data.accessExpiresAt !== data.originalExpiry || (data.isActive && !data.wasActive)) {
19:     const error = visitorExpiryValidation(data.accessExpiresAt);
20:     if (error) ctx.addIssue({ code: "custom", path: ["accessExpiresAt"], message: error });
22:   if (((!data.isEditing || data.isPreRegistration || data.isActive !== false) && !data.cardNumber) || isVisitorCardPlaceholder(data.cardNumber)) {
```

### src/components/visitors/hooks/useVisitorFormSubmit.ts

```text
18:   return { isLoading: action.pending, handleSubmit: action.run };
```

### src/components/visitors/lib/formPayload.ts

```text
14:   const parsed = visitorFormSchema.parse({ ...formData, isEditing: !!visitor, isPreRegistration, originalExpiry, wasActive: visitor?.isActive });
15:   const shared = { firstName: parsed.firstName, lastName: parsed.lastName, isActive: visitor?.isActive === true ? true : formData.isActive, kvkkConsent: formData.kvkkConsent, kvkkDocumentVersion: formData.kvkkDocumentVersion };
20:       ...(parsed.accessExpiresAt !== originalExpiry ? { accessExpiresAt: localInputToIso(parsed.accessExpiresAt) } : {}),
29:     ...shared, projectId: formData.projectId, accessExpiresAt: localInputToIso(parsed.accessExpiresAt),
```

### src/components/visitors/lib/preRegistration.ts

```text
5:   return visitor?.isActive === false && (visitor.status === "preRegistered" || visitor.status === "expired") &&
```

### src/components/visitors/lib/readerCapability.ts

```text
4: interface ReaderDevice { deviceType?: string; brand?: string; hikModel?: string; isActive?: boolean }
11:   if (device.isActive === false) return false;
```

### src/components/visitors/lib/status.ts

```text
3: export type VisitorStatus = Visitor["status"];
17: export function displayVisitorStatus(visitor: Pick<Visitor, "status" | "visitEnd">, now: number): VisitorStatus {
18:   return visitor.status !== "checkedOut" && visitor.visitEnd && Date.parse(visitor.visitEnd) <= now ? "expired" : visitor.status;
```

### src/components/visitors/visitorTime.ts

```text
4: // accessExpiresAt ISO UTC olarak saklanır; form <input type="datetime-local"> tarayıcı
```

### src/contexts/ActiveProjectContext.tsx

```text
77:     isAuthenticated && profile && profile.verified !== false && !isSuperAdmin ? {} : "skip"
```

### src/hooks/access-rules/useAccessRuleMutations.ts

```text
17:   isActive?: boolean;
21:   const pendingRef = useRef(new Map<string, "create" | "update" | "delete">());
22:   const [pending, setPending] = useState(
30:     if (pendingRef.current.has(key))
32:     pendingRef.current.set(key, kind);
33:     setPending(new Map(pendingRef.current));
37:       pendingRef.current.delete(key);
38:       setPending(new Map(pendingRef.current));
59:           isActive: true,
69:     isPending: [...pending.values()].includes("create"),
70:     isPendingFor: (id: Id<"accessRules">) => pending.has(id),
97:     isPending: [...pending.values()].includes("update"),
98:     isPendingFor: (id: Id<"accessRules">) => pending.has(id),
112:     isPending: [...pending.values()].includes("delete"),
113:     isPendingFor: (id: Id<"accessRules">) => pending.has(id),
```

### src/hooks/access-rules/useComplexAccessRuleMutations.ts

```text
39:     isActive?: boolean;
49:   const pendingRef = useRef(new Set<string>());
50:   const [pending, setPending] = useState<Set<string>>(new Set());
55:     if (pendingRef.current.has(key))
57:     pendingRef.current.add(key);
58:     setPending(new Set(pendingRef.current));
62:       pendingRef.current.delete(key);
63:       setPending(new Set(pendingRef.current));
98:     isPending: pending.has("create"),
126:     isPending: [...pending].some((key) => key !== "create"),
```

### src/hooks/useDepartments.ts

```text
78:     isLoading:
```

### src/hooks/useEmployees.ts

```text
20:     isLoading: projectLoading || permissionsLoading || Boolean(canView && projectId && employeesRaw === undefined),
```

### src/hooks/useNotificationSettings.ts

```text
24:   const { run: saveNotificationSettings, pending: isSaving } = useAsyncAction(async (settings: NotificationSettingsInput) => {
31:     isLoading:
34:     isSaving,
```

### src/hooks/usePdksTableData.ts

```text
39:   statusFilter?: PdksStatusFilter;
130:     tableRecords: filterPdksRows(tableData ?? [], filters?.statusFilter),
131:     isLoading:
```

### src/hooks/useVisitors.ts

```text
4: import type { VisitorStatus } from "@/components/visitors/lib/status";
7: export const useVisitors = (options: { search?: string; status?: VisitorStatus; cursor?: string | null; pageSize?: number; now?: number } = {}) => {
10:     projectId, search: options.search, status: options.status, now: options.now,
15:     isLoading: projectLoading || (!!projectId && page === undefined),
```

### src/pages/AdminSetup.tsx

```text
65:   const isLoading = setup.pending;
67:     if (formError && !isLoading) document.getElementById('password')?.focus();
68:   }, [formError, isLoading]);
81:           label: !user || user.verified === false ? 'Oturum hazırlanıyor…' : 'Yönetim alanına geç',
82:           disabled: !user || user.verified === false,
98:         tone={isLoading ? 'loading' : 'info'}
99:         title={isLoading ? 'Kurulum tamamlanıyor…' : 'İlk yönetici kurulumu tamamlanmış.'}
101:         primaryAction={{ label: 'Giriş yap', href: '/login', disabled: isLoading }}
114:         disabled={isLoading}
120:         <fieldset disabled={isLoading} className="space-y-4">
136:               disabled={isLoading}
154:               disabled={isLoading}
178:           <Button type="submit" className="w-full" disabled={isLoading}>
179:             {isLoading ? 'Kurulum tamamlanıyor…' : 'Yönetici hesabını etkinleştir'}
```

### src/pages/Alarms.tsx

```text
79:       <Button variant="outline" disabled={testing || saving || !current?.emailEnabled || !current.recipients.length} onClick={async () => {
86:     <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Kapat</Button><Button disabled={!values || saving} onClick={() => void handleSave()}>{saving ? "Kaydediliyor…" : "Kaydet"}</Button></DialogFooter>
96:   const { status } = filters;
110:     {canManage && status !== "acked" && <BulkBar count={selected.length} onClear={() => setSelected([])}><Button onClick={() => void acknowledgeRows(selected)}>Seçilenleri onayla ({selected.length})</Button></BulkBar>}
142:   const { results, status: pageStatus, loadMore } = usePaginatedQuery(api.alarms.list,
145:     <Table framed scrollLabel="Alarm kayıtları" resizeKey="alarms" className="w-full text-left text-sm"><TableHeader className="bg-subtle"><TableRow>{canManage && <TableHead columnId="select" resizable={false} className="p-3">Seç</TableHead>}<TableHead columnId="time" className="p-3">Zaman</TableHead><TableHead columnId="device" className="p-3">Cihaz</TableHead><TableHead columnId="event" className="p-3">Olay</TableHead><TableHead columnId="severity" className="p-3">Önem</TableHead><TableHead columnId="status" className="p-3">Durum</TableHead>{isAdmin && <TableHead columnId="email" className="p-3">E-posta</TableHead>}{canManage && <TableHead columnId="actions" resizable={false} className="p-3">İşlem</TableHead>}</TableRow></TableHeader><TableBody>{loading || pageStatus === "LoadingFirstPage" ? <TableStateRow colSpan={5 + (canManage ? 2 : 0) + (isAdmin ? 1 : 0)} state="loading" label="Olaylar yükleniyor." /> : !results.length ? <TableStateRow colSpan={5 + (canManage ? 2 : 0) + (isAdmin ? 1 : 0)} state="empty" title={pageStatus === "CanLoadMore" ? "Daha fazla yükle" : "Olay bulunamadı"} description={pageStatus === "CanLoadMore" ? "Tarama sınırına ulaşıldı. Daha fazla olay için aşağıdaki düğmeyi kullanın." : "Seçili filtrelerde gösterilecek olay yok."} /> : results.map(row => <TableRow key={row._id} className="border-t border-line">{canManage && <TableCell className="p-3">{!row.ackedAt && <input aria-label={`${row.label} seç`} type="checkbox" disabled={selected.length >= 50 && !selected.includes(row._id)} checked={selected.includes(row._id)} onChange={event => setSelected(current => event.target.checked ? (current.includes(row._id) || current.length >= 50 ? current : [...current, row._id]) : current.filter(id => id !== row._id))} />}</TableCell>}<TableCell className="p-3">{new Date(row.eventTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</TableCell><TableCell className="p-3 truncate" title={row.deviceName}>{row.deviceName}</TableCell><TableCell className="p-3"><span className="block truncate" title={row.label}>{row.label}</span>{row.resolvedAt && <p className="text-xs text-muted-foreground">Bağlantı geri geldi · {new Date(row.resolvedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}{row.resolvedAt && <OfflineDuration offlineDurationMs={row.offlineDurationMs} />}</TableCell><TableCell className="p-3"><StatusBadge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "neutral"}>{row.severity === "critical" ? "Kritik" : row.severity === "warning" ? "Uyarı" : "Bilgi"}</StatusBadge></TableCell><TableCell className="p-3">{row.ackedAt ? `Onaylandı · ${new Date(row.ackedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}` : "İnceleme bekliyor"}</TableCell>{isAdmin && <TableCell className="p-3"><AlarmEmailStatus delivery={{ status: row.alarmEmailStatus, attempts: row.alarmEmailAttempts, at: row.alarmEmailAttemptAt ?? row.alarmQueuedAt, error: row.alarmEmailError, retryAt: row.alarmEmailRetryAt }} /></TableCell>}{canManage && <TableCell className="p-3">{!row.ackedAt && <AlarmAcknowledgeButton onAcknowledge={() => void acknowledgeRows([row._id])} />}</TableCell>}</TableRow>)}</TableBody></Table>
```

### src/pages/AuditLog.tsx

```text
10: import { Switch } from '@/components/ui/switch';
23:   const state = useAuditUrlState(`${projectId ?? 'none'}:${allProjects}`, !loading);
24:   const args = auditArgs(state.params, projectId, allProjects);
28:       profile?.role === 'super_admin' && <label className="flex min-h-10 items-center gap-2 text-sm"><Switch checked={allProjects} onCheckedChange={checked => state.update('allProjects', checked ? 'true' : '')} />Tüm projeler</label>
29:     } summary={<AuditCoverage />} filters={<AuditFilters state={state} args={args} ready={ready && !state.changingScope} rangeError={rangeError}
30:       actions={ready && !state.changingScope && !rangeError && <AuditExportButton key={JSON.stringify(args)} args={args} projectName={activeProject?.name ?? "proje"} />} />}>
32:     {loading || state.changingScope ? <AuditTable rows={[]} allProjects={allProjects} loading onSelect={() => {}} /> : !ready ? <EmptyState title="Bir proje seçin" description="Denetim kayıtlarını görmek için üst çubuktan bir proje seçin." /> : rangeError ? <AuditTable rows={[]} allProjects={allProjects} onSelect={() => {}} message={<p className="text-xs text-muted-foreground">Geçerli bir tarih aralığı seçilince kayıtlar listelenir.</p>} /> : <AuditResults key={JSON.stringify(args)} args={args} />}
39:   if (!can("admin.manage")) return <PageTemplate title="Denetim Kaydı"><div role="status" className="space-y-3"><p className="text-base font-semibold">Denetim kaydını görüntüleme yetkiniz yok.</p><p className="text-sm text-muted-foreground">Bu sayfa yöneticiler içindir.</p><Button variant="outline" asChild><Link to="/">Ana Sayfa’ya dön</Link></Button></div></PageTemplate>;
```

### src/pages/Devices.tsx

```text
47:   const { devices, isLoading, hasProjectAccess } = useProjectFilteredDevices();
53:   // Device panel state: device=null → sıfırdan yeni cihaz (marka seçici), device=X → düzenleme.
66:   const consumeDeviceRequest = useDeviceDeepLink(requestedDeviceId, devices, isLoading, devicePanel.open,
137:     deviceUnavailable={devicePanel.open && !!devicePanel.device && !isLoading && !liveSelectedDevice}
144:   const unavailable = !projectLoading && !isLoading && !hasProjectAccess
165:           isLoading={projectLoading || isLoading}
189:         state={virtualReader}
```

### src/pages/EmployeeSetup.tsx

```text
55:   const isLoading = savePassword.pending;
57:     if (formError && !isLoading) document.getElementById('password')?.focus();
58:   }, [formError, isLoading]);
115:         <fieldset disabled={isLoading} className="space-y-4">
121:               disabled={isLoading}
162:               disabled={isLoading}
178:           <Button type="submit" className="w-full" disabled={isLoading}>
179:             {isLoading ? 'Kaydediliyor…' : 'Şifremi belirle'}
```

### src/pages/Employees.tsx

```text
65:   const { employees, isLoading, refetch, hasProjectAccess } = useEmployees();
73:   const status = ["active", "inactive", "terminated"].includes(params.get("status") ?? "")
74:     ? (params.get("status") ?? "all")
77:   const sort = /^(name|email|company|department|position|card|status):(asc|desc)$/.test(
104:     const state: unknown = location.state;
105:     if (!state || typeof state !== "object" || !("transferEmployeeId" in state) || !("transferProjectId" in state) || state.transferProjectId !== projectId || isLoading) return;
106:     const target = employees.find(item => item._id === state.transferEmployeeId);
108:     navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
109:   }, [location.state, location.pathname, location.search, projectId, isLoading, employees, navigate]);
112:     () => filterAndSortEmployees(employees, q, department, status, sort, { company }),
113:     [employees, q, department, status, sort, company],
143:       !isLoading &&
156:   }, [page, isLoading, params, setParams]);
174:   const hasFilters = !!q || !!department || !!company || status !== "all";
176:   const activeCount = employees.filter((employee) => employee.isActive).length;
177:   const statusCounts = {
180:     inactive: employees.filter(employee => !employee.isActive && !employee.employmentEndDate).length,
194:           {canExport && <DropdownMenuItem disabled={exportTooLarge} title={exportTooLarge ? `Dışa aktarma en fazla ${EMPLOYEE_EXPORT_MAX_ROWS} kişi içerebilir.` : undefined} onSelect={() => { setExportError(null); setExportDialogOpen(true); }}>Dışa aktar</DropdownMenuItem>}
212:           status={status}
213:           statusCounts={statusCounts}
214:           onStatusChange={(value) => update({ status: value })}
220:             update({ q: "", department: "", company: "", status: "" });
259:         key={`${projectId}/${q}/${department}/${company}/${status}/${sort}/${page}/${size}`}
260:         loading={isLoading}
272:                   : department && status === "all"
274:                     : company && status === "all"
283:                   status === "all"
292:                     status: "",
```

### src/pages/Leaves.tsx

```text
83:     api.leaveRequests.pendingCount,
92:     if (canManage && row.status === "approved" && !row.employeeMissing) {
```

### src/pages/Login.tsx

```text
25:   const savedEmail: unknown = location.state?.email;
65:   const resending = resend.pending;
88:   const submitting = login.pending;
113:   const verificationQueued: unknown = location.state?.verificationQueued;
148:               disabled={resending || cooldown > 0 || !email.trim()}
150:               className="inline-flex min-h-11 items-center text-left font-semibold text-primary underline underline-offset-4 disabled:opacity-50"
164:               <p role="status">
173:         <fieldset disabled={submitting} className="space-y-5">
216:         <Button type="submit" disabled={submitting} className="w-full">
```

### src/pages/PDKSRecords.tsx

```text
28:   statusFilter: "all",
68:     records, isLoading, setSmartPreset,
84:           disabled={isLoading || !projectId}
106:       primaryAction={<Button onClick={openPlan} disabled={!projectId} className="max-sm:min-h-11">
```

### src/pages/PdksSettings.tsx

```text
17:   const back = () => cameFromShiftPlan(location.state) ? navigate(-1) : navigate("/pdks-records/plan");
19:     : !can("schedule.manage") ? <div role="status" className="space-y-3 py-8"><p className="text-base font-semibold">PDKS ayarlarını görüntüleme yetkiniz yok.</p><p className="text-sm text-muted-foreground">Bu sayfa vardiya yönetme yetkisi olanlar içindir.</p><Button variant="outline" asChild><Link to="/pdks-records/plan">Vardiya planına dön</Link></Button></div>
```

### src/pages/Register.tsx

```text
77:     navigate('/login?confirmEmail=true', { state: { email: normalizedEmail, verificationQueued } });
79:   const submitting = registration.pending;
115:         <fieldset disabled={submitting} className="space-y-5">
170:         <Button type="submit" className="w-full" disabled={submitting}>
```

### src/pages/Settings.tsx

```text
33:   const { reportForm, pending, dialog } = useSettingsFormsGuard();
47:     if (pending || tab === activeTab) return;
55:     switch (activeTab) {
56:       case "roles": return <RolesSettings />;
57:       case "general": return <GeneralSettings />;
58:       case "users": return <div className="-mx-1 min-w-0 overflow-x-auto p-1"><AdminUsersPanel projectScoped /></div>;
59:       case "reports": return <ReportsSettings requestedReport={searchParams.get("report")} />;
60:       case "integrations": return <IntegrationsSettings />;
61:       case "privacy": return <PrivacySettings />;
62:       case "mail": return <MailSettings />;
63:       case "notifications": return <NotificationSettings />;
70:     aside={{ label: "Ayar bölümleri", breakpoint: 761, content: <SettingsSidebar selected={activeTab} onSelect={handleTabChange} disabled={pending} /> }}
```

### src/pages/ShiftPlan.tsx

```text
32:   }, { replace: true, state: location.state });
44:     const state: unknown = location.state;
45:     if (typeof state === "object" && state !== null && "fromRecords" in state && state.fromRecords === true) navigate(-1);
55:       <Link to={PDKS_SETTINGS_PATH} state={PDKS_SETTINGS_FROM_SHIFT_PLAN}>
```

### src/pages/UserSetup.tsx

```text
21:   switch (code) {
22:     case 'INVITE_AUTH_REQUIRED':
23:     case 'INVITE_AUTH_TIMEOUT':
25:     case 'INVITE_EMAIL_MISMATCH':
28:     case 'INVITE_WRONG_TYPE':
30:     case 'INVITE_INVALID':
32:     case 'INVITE_ACCOUNT_EXISTS':
35:     case 'INVITE_WEAK_PASSWORD':
138:   const isLoading = setup.pending;
140:     if (formError && !isLoading) document.getElementById('password')?.focus();
141:   }, [formError, isLoading]);
154:           label: resetCompleted ? 'Giriş yap' : !user || user.verified === false ? 'Oturum hazırlanıyor…' : 'Yönetim alanına geç',
155:           disabled: !resetCompleted && (!user || user.verified === false),
192:         disabled={isLoading}
198:         <fieldset disabled={isLoading} className="space-y-4">
208:               disabled={!!inviteData?.email}
217:               disabled={isLoading}
256:               disabled={isLoading}
274:           <Button type="submit" className="w-full" disabled={isLoading}>
275:             {isLoading ? (isReset ? 'Şifre yenileniyor…' : 'Davet kabul ediliyor…') : (isReset ? 'Şifreyi yenile' : 'Daveti kabul et')}
```

### src/pages/VerifyEmail.tsx

```text
24:   const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
73:   if (status === 'loading')
81:   if (status === 'success')
121:         <fieldset disabled={resend.pending} className="space-y-4">
131:           <Button disabled={resend.pending || cooldown > 0 || !email.trim()} type="submit" className="w-full">
132:             {resend.pending
```

### src/types/access-control.ts

```text
53:   status?: string;
106:   isActive?: boolean;
127:   isActive?: boolean;
```

### src/types/device.ts

```text
15:   status?: "online" | "offline" | "expired" | "active" | "inactive" | string;
18:   isActive?: boolean;
60:   isActive?: boolean;
73:   status?: "online" | "offline" | "expired" | "active" | "inactive" | string;
76:   isActive?: boolean;
```

### src/types/employee.ts

```text
19:   isActive?: boolean;
```

## Ek D — Tarama dosya manifesti

```text
bridge/windows/NgAccess.HikvisionBridge/README.md
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionNative.cs
bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionSdkRuntime.cs
bridge/windows/NgAccess.HikvisionBridge/Services/PanelWorker.cs
convex/__snapshots__/w5aLegacyEquivalence.test.ts.snap
convex/_generated/ai/guidelines.md
convex/_generated/api.d.ts
convex/_generated/dataModel.d.ts
convex/accessGrantStatus.test.ts
convex/accessGrantStatus.ts
convex/accessRuleMemberships.test.ts
convex/accessRules.formLimits.test.ts
convex/accessRules.ts
convex/accountAccess.test.ts
convex/accountAccess.ts
convex/actions/biometricDestruction.ts
convex/actions/getChatData.ts
convex/actions/hikDeviceImport.test.ts
convex/actions/hikDeviceImport.ts
convex/actions/hikFingerprint.ts
convex/actions/hikGatewayDevice.ts
convex/actions/hikQueueWorker.ts
convex/actions/hikvisionSync.ts
convex/actions/ideGatewayDevice.ts
convex/actions/openaiChat.ts
convex/actions/pdksImport.ts
convex/actions/projectMail.ts
convex/actions/sendAlarmEmail.test.ts
convex/actions/sendAlarmEmail.ts
convex/actions/sendEmail.ts
convex/actions/sendScheduledReports.ts
convex/actions/setPassword.ts
convex/adminDevices.reservation.test.ts
convex/adminDevices.ts
convex/adminSettingsGuards.test.ts
convex/akisFaz1.authz.test.ts
convex/alarmDelivery.test.ts
convex/alarms.test.ts
convex/alarms.ts
convex/attendanceCorrections.test.ts
convex/attendanceCorrections.ts
convex/auditLog.ts
convex/auditPrivacy.test.ts
convex/auth.ts
convex/biometricDestruction.ts
convex/cardReadings.readingAccess.test.ts
convex/cardReadings.test.ts
convex/cardReadings.ts
convex/companies.ts
convex/convex.config.ts
convex/crons.ts
convex/dashboard.ts
convex/dashboardPlans.review.test.ts
convex/dataMigrations.ts
convex/debugIde.ts
convex/departmentAccess.test.ts
convex/departmentAccess.ts
convex/departments.ts
convex/deviceCenter.test.ts
convex/deviceConnectivity.test.ts
convex/deviceEvents.ts
convex/deviceSyncRuns.ts
convex/devices.ts
convex/devicesMutations.characterization.test.ts
convex/doorPlanGateway.test.ts
convex/doorPlanInvalidation.ts
convex/doorPlanModels.test.ts
convex/doorPlans.test.ts
convex/doorRenameReaders.test.ts
convex/doorStatusPlan.integration.test.ts
convex/doorStatusPlan.queueErrors.test.ts
convex/doorTarget.test.ts
convex/doors.ts
convex/e1w4.test.ts
convex/emailVerification.test.ts
convex/emailVerification.ts
convex/employeeAuth.employmentEnded.test.ts
convex/employeeAuth.mobile.test.ts
convex/employeeAuth.test.ts
convex/employeeAuth.ts
convex/employeeBiometrics.test.ts
convex/employeeBiometrics.ts
convex/employeeCheckIn.test.ts
convex/employeeDepartmentHistory.test.ts
convex/employeeFaces.test.ts
convex/employeeFingerprints.ts
convex/employeeImport.test.ts
convex/employeeImport.ts
convex/employeeTermination.test.ts
convex/employeeTermination.ts
convex/employeeTransfer.test.ts
convex/employees.accessStart.test.ts
convex/employees.emailChange.test.ts
convex/employees.ts
convex/files.test.ts
convex/files.ts
convex/fingerprintEnrollment.test.ts
convex/fingerprintEnrollment.ts
convex/fixF0Devices.test.ts
convex/fixF0People.test.ts
convex/fixF0SideDoors.test.ts
convex/fixF1Requests.test.ts
convex/fixF2Cards.test.ts
convex/fixF2Hik.test.ts
convex/fixF2Ide.test.ts
convex/fixF2bEvents.test.ts
convex/fixF2bHikEnd.test.ts
convex/fixF2bIde.test.ts
convex/fixF4People.test.ts
convex/fixF4Resilience.test.ts
convex/fixF5Consistency.test.ts
convex/fixF5PasswordReset.test.ts
convex/fixF5People.test.ts
convex/hikBridge.ts
convex/hikDeviceImport.test.ts
convex/hikDeviceImport.ts
convex/hikIsupStatus.test.ts
convex/hikRevocation.test.ts
convex/hikvisionSync.test.ts
convex/hikvisionSync.ts
convex/holidays.ts
convex/ideDefaults.ts
convex/ideRoster.audit.test.ts
convex/ideSync.test.ts
convex/ideSync.ts
convex/invites.security.test.ts
convex/invites.test.ts
convex/invites.ts
convex/leaveRequests.test.ts
convex/leaveRequests.ts
convex/leaves.ts
convex/lib/accessDecision.test.ts
convex/lib/accessDecision.ts
convex/lib/accessEnd.test.ts
convex/lib/accessEnd.ts
convex/lib/accessGraph.ts
convex/lib/accessGraphPure.ts
convex/lib/accessRuleDiff.test.ts
convex/lib/accessRuleDiff.ts
convex/lib/accessRuleRead.ts
convex/lib/accessRuleSummary.test.ts
convex/lib/accessRuleSummary.ts
convex/lib/accessRuleUx.test.ts
convex/lib/accessRuleUx.ts
convex/lib/accessRuleWrite.ts
convex/lib/accessSchedule.test.ts
convex/lib/accessSchedule.ts
convex/lib/accessScopeRelations.ts
convex/lib/accessTransfer.ts
convex/lib/accountAccess.test.ts
convex/lib/accountAccess.ts
convex/lib/adminGuards.ts
convex/lib/adminLists.test.ts
convex/lib/adminLists.ts
convex/lib/alarmNotify.test.ts
convex/lib/alarmNotify.ts
convex/lib/audit.ts
convex/lib/auditActors.test.ts
convex/lib/auditActors.ts
convex/lib/auditLogQuery.test.ts
convex/lib/auditLogQuery.ts
convex/lib/auditPrivacy.ts
convex/lib/auditSearch.ts
convex/lib/auth.test.ts
convex/lib/auth.ts
convex/lib/biometricDestruction.test.ts
convex/lib/biometricDestructionState.ts
convex/lib/biometricGate.test.ts
convex/lib/biometricGate.ts
convex/lib/cardReaderAuth.ts
convex/lib/cardReaderParse.test.ts
convex/lib/cardReaderParse.ts
convex/lib/cardReadingList.ts
convex/lib/cardReadingProcess.direction.test.ts
convex/lib/cardReadingProcess.ts
convex/lib/cardReadingRetention.test.ts
convex/lib/cardReadingRetention.ts
convex/lib/chatMasking.test.ts
convex/lib/checkInUx.test.ts
convex/lib/customFunctions.ts
convex/lib/departmentAccess.ts
convex/lib/deviceAssignment.hik.test.ts
convex/lib/deviceAssignment.ts
convex/lib/deviceConnection.ts
convex/lib/deviceHelpers.test.ts
convex/lib/deviceHelpers.ts
convex/lib/devicePool.ts
convex/lib/deviceProvision.ehomeId.test.ts
convex/lib/deviceProvision.ts
convex/lib/deviceSync.ts
convex/lib/deviceSyncRun.test.ts
convex/lib/doorStatusPlan.test.ts
convex/lib/doorStatusPlan.ts
convex/lib/doorTargetSync.ts
convex/lib/emailVerification.test.ts
convex/lib/emailVerification.ts
convex/lib/employeeAuth.ts
convex/lib/employeeCardChange.ts
convex/lib/employeeCascade.ts
convex/lib/employeeDepartmentHistory.ts
convex/lib/employment.test.ts
convex/lib/employment.ts
convex/lib/gateway/capabilities.ts
convex/lib/gateway/devices.ts
convex/lib/gateway/isapiResult.test.ts
convex/lib/gateway/persons.test.ts
convex/lib/gateway/persons.ts
convex/lib/gateway/plans.ts
convex/lib/gateway/scheduling.ts
convex/lib/gatewayBackfill.recovery.test.ts
convex/lib/gatewayBackfill.resume.test.ts
convex/lib/gatewayBackfill.roster.test.ts
convex/lib/gatewayBackfill.ts
convex/lib/gatewayCommand.ts
convex/lib/gatewayReconcile.ts
convex/lib/grantStatus.test.ts
convex/lib/grantStatus.ts
convex/lib/hikDeviceImport.test.ts
convex/lib/hikDeviceImport.ts
convex/lib/hikEventCatalog.test.ts
convex/lib/hikEventCatalog.ts
convex/lib/hikEventCodes.test.ts
convex/lib/hikEventCodes.ts
convex/lib/hikSync.ts
convex/lib/hikSyncEmployee.ts
convex/lib/hikWake.test.ts
convex/lib/lateReading.ts
convex/lib/leaveRules.test.ts
convex/lib/leaveRules.ts
convex/lib/leaveValidation.test.ts
convex/lib/legacyOvertime.ts
convex/lib/liveReadings.test.ts
convex/lib/mailSecret.ts
convex/lib/mobileAccess.test.ts
convex/lib/mobileAccess.ts
convex/lib/mobileVisitors.ts
convex/lib/passwordPolicy.test.ts
convex/lib/payVisibility.test.ts
convex/lib/payVisibility.ts
convex/lib/pdksAvailability.test.ts
convex/lib/pdksAvailability.ts
convex/lib/pdksCalc.ts
convex/lib/pdksFixedRules.test.ts
convex/lib/pdksFlexible.test.ts
convex/lib/pdksHelpers.ts
convex/lib/pdksManualWrite.test.ts
convex/lib/pdksManualWrite.ts
convex/lib/pdksMultiShift.ts
convex/lib/pdksNight.handlers.test.ts
convex/lib/pdksNightSettings.test.ts
convex/lib/pdksPayroll.overtime.test.ts
convex/lib/pdksPayrollQuery.ts
convex/lib/pdksRules.test.ts
convex/lib/pdksRules.ts
convex/lib/pdksSource.test.ts
convex/lib/pdksTableQuery.ts
convex/lib/peopleHikSnapshot.ts
convex/lib/peoplePhoto.ts
convex/lib/peopleRelations.test.ts
convex/lib/peopleRelations.ts
convex/lib/permissions.ts
convex/lib/privacyFixes.test.ts
convex/lib/privacySettings.ts
convex/lib/processCardReadingCore.ts
convex/lib/projectMailer.ts
convex/lib/projectScope.test.ts
convex/lib/projectScope.ts
convex/lib/publicUser.test.ts
convex/lib/publicUser.ts
convex/lib/rateLimit.ts
convex/lib/readingAccess.test.ts
convex/lib/readingAccess.ts
convex/lib/reconcileMath.ts
convex/lib/reportAttendance.review.test.ts
convex/lib/reportAttendance.test.ts
convex/lib/reportAttendance.ts
convex/lib/reportScope.test.ts
convex/lib/reportScope.ts
convex/lib/requireEmployeeAccess.test.ts
convex/lib/roleCatalog.ts
convex/lib/ruleDevices.ts
convex/lib/sessionRevoke.test.ts
convex/lib/sessionRevoke.ts
convex/lib/settingsUx.test.ts
convex/lib/settingsUx.ts
convex/lib/shiftAssign.test.ts
convex/lib/shiftAssign.ts
convex/lib/shiftPlan.review.test.ts
convex/lib/shiftPlan.test.ts
convex/lib/shiftPlan.ts
convex/lib/shiftResolver.test.ts
convex/lib/shiftResolver.ts
convex/lib/smtpConfig.ts
convex/lib/syncStatusScope.ts
convex/lib/transferGuard.ts
convex/lib/visitorDoorRule.ts
convex/lib/visitorPresence.test.ts
convex/lib/visitorPresence.ts
convex/lib/visitorRetention.test.ts
convex/lib/visitorRetention.ts
convex/lib/visitorStatus.test.ts
convex/lib/visitorStatus.ts
convex/lib/weeklyRestDays.test.ts
convex/lib/workingDays.ts
convex/mailSettings.test.ts
convex/mailSettings.ts
convex/migrations.test.ts
convex/migrations.ts
convex/mobileAccess.handlers.test.ts
convex/mobileAccessGateway.test.ts
convex/mobileAttendance.test.ts
convex/mobileAttendance.ts
convex/mobileVisitors.test.ts
convex/mobileVisitors.ts
convex/noShift.test.ts
convex/onboarding.ts
convex/orgUnits.test.ts
convex/orphanGuards.test.ts
convex/payVisibility.handlers.test.ts
convex/pdksCheckpointTypes.test.ts
convex/pdksCheckpointWarnings.test.ts
convex/pdksEachPunch.test.ts
convex/pdksFixedRules.integration.test.ts
convex/pdksPlans.integration.test.ts
convex/pdksRecords.ts
convex/pdksRules.readerAddress.test.ts
convex/pdksRules.test.ts
convex/pdksRules.ts
convex/peopleActivity.ts
convex/positions.ts
convex/privacyBiometric.ts
convex/privacyRetention.settings.test.ts
convex/privacyRetention.ts
convex/processCardReading.characterization.test.ts
convex/projectSetup.test.ts
convex/projects.test.ts
convex/projects.ts
convex/readers.ts
convex/reports.attendance.test.ts
convex/reports.audit2.test.ts
convex/reports.ts
convex/retention.test.ts
convex/roles.admin.test.ts
convex/roles.devices.test.ts
convex/roles.fix1.test.ts
convex/roles.people.test.ts
convex/roles.test.ts
convex/roles.ts
convex/schema.ts
convex/seedCardReaderTest.ts
convex/seedHikvisionLanDevice.ts
convex/seedTestCardAccess.ts
convex/settings.ts
convex/sgkExport.test.ts
convex/sgkExport.ts
convex/shiftPlans.review.test.ts
convex/shiftPlans.test.ts
convex/shiftPlans.ts
convex/shiftSchedule.test.ts
convex/shiftVersions.integration.test.ts
convex/shifts.order.test.ts
convex/shifts.test.ts
convex/shifts.ts
convex/syncIssuesAuth.test.ts
convex/userProjects.ts
convex/users.settings.test.ts
convex/users.test.ts
convex/users.ts
convex/virtualReaders.test.ts
convex/virtualReaders.ts
convex/visitorCardCapture.test.ts
convex/visitorDoorRule.test.ts
convex/visitorHosts.test.ts
convex/visitorHosts.ts
convex/visitors.ts
convex/visitorsAudit2.test.ts
convex/w53Integration.test.ts
convex/w5aFix1.test.ts
convex/w5aFix2.test.ts
convex/w5aLegacyEquivalence.test.ts
convex/zones.ts
infra/hik-event-bridge/RUNBOOK.md
infra/hik-event-bridge/bridge.mjs
infra/hik-event-bridge/bridge.nodetest.mjs
infra/mqtt/RUNBOOK.md
mobile/lib/core/error_localizer.dart
mobile/lib/core/errors.dart
mobile/lib/l10n/app_en.arb
mobile/lib/l10n/app_localizations.dart
mobile/lib/l10n/app_localizations_en.dart
mobile/lib/l10n/app_localizations_tr.dart
mobile/lib/l10n/app_tr.arb
mobile/lib/main.dart
mobile/lib/models/visitor.dart
mobile/lib/providers/auth_provider.dart
mobile/lib/providers/door_operation_provider.dart
mobile/lib/providers/visitor_provider.dart
mobile/lib/repositories/device_repository.dart
mobile/lib/repositories/door_operation_repository.dart
mobile/lib/repositories/visitor_repository.dart
mobile/lib/router/app_router.dart
mobile/lib/router/route_paths.dart
mobile/lib/screens/auth/login_screen.dart
mobile/lib/screens/home/home_screen.dart
mobile/lib/screens/main_navigation_shell.dart
mobile/lib/screens/profile/profile_screen.dart
mobile/lib/screens/qr_scan/qr_scan_screen.dart
mobile/lib/screens/visitor/visitor_form_screen.dart
mobile/lib/screens/visitor/visitor_screen.dart
mobile/lib/services/visitor_create_intent_store.dart
mobile/lib/widgets/ui/app_bottom_navigation.dart
mobile/lib/widgets/visitor/visitor_cards.dart
mobile/lib/widgets/visitor/visitor_detail.dart
mobile/lib/widgets/visitor/visitor_labels.dart
src/App.tsx
src/components/Layout.tsx
src/components/access-control/CardReadings.tsx
src/components/access-control/CardReadingsFilters.tsx
src/components/access-control/DoorStatusPlanEditor.test.tsx
src/components/access-control/DoorStatusPlanEditor.tsx
src/components/access-control/EditDoorDialog.tsx
src/components/access-control/door-dialog/DoorSaveResults.tsx
src/components/access-control/door-dialog/DoorStatusPlanSection.tsx
src/components/access-control/door-dialog/DoorVerifyPlanEditor.test.tsx
src/components/access-control/door-dialog/DoorVerifyPlanEditor.tsx
src/components/access-control/door-dialog/DoorVerifyPlanSection.tsx
src/components/access-control/door-dialog/weeklyPlan.tsx
src/components/access-control/door-plans/CopyDoorPlansDialog.test.tsx
src/components/access-control/door-plans/CopyDoorPlansDialog.tsx
src/components/access-control/door-plans/DoorPlanDialog.test.tsx
src/components/access-control/door-plans/DoorPlanDialog.tsx
src/components/access-control/door-plans/DoorPlanImpactSummary.test.tsx
src/components/access-control/door-plans/DoorPlanImpactSummary.tsx
src/components/access-control/door-plans/DoorPlansTab.test.tsx
src/components/access-control/door-plans/DoorPlansTab.tsx
src/components/access-control/door-plans/bulk.ts
src/components/access-control/doorPlanResult.test.ts
src/components/access-control/doorPlanResult.ts
src/components/access-control/unified/AccessRuleDetails.tsx
src/components/access-control/unified/AccessRulesList.tsx
src/components/access-control/unified/CreateRuleDialog.tsx
src/components/access-control/unified/ProjectSyncButton.test.tsx
src/components/access-control/unified/SyncRuns.test.tsx
src/components/access-control/unified/SyncRuns.tsx
src/components/access-control/unified/UnifiedAccessControl.test.tsx
src/components/access-control/unified/UnifiedAccessControl.tsx
src/components/access-control/unified/audit.test.tsx
src/components/access-control/unified/hooks/useAccessRuleSchema.test.ts
src/components/access-control/unified/hooks/useAccessRuleSchema.ts
src/components/access-control/unified/hooks/useRuleForm.ts
src/components/access-control/unified/lib/loadRuleEditor.test.ts
src/components/access-control/unified/lib/loadRuleEditor.ts
src/components/access-control/unified/lib/presentation.test.ts
src/components/access-control/unified/lib/presentation.ts
src/components/access-control/unified/rules-list/RuleRow.test.tsx
src/components/access-control/unified/rules-list/RuleRow.tsx
src/components/access-control/unified/rules-list/RulesEmptyState.tsx
src/components/access-control/unified/rules-list/RulesFilters.test.tsx
src/components/access-control/unified/rules-list/RulesFilters.tsx
src/components/access-control/unified/rules-list/RulesHeader.test.tsx
src/components/access-control/unified/rules-list/RulesPage.test.tsx
src/components/access-control/unified/rules-list/RulesPage.tsx
src/components/access-control/unified/rules-list/accessRulesListModel.test.ts
src/components/access-control/unified/rules-list/accessRulesListModel.ts
src/components/access-control/unified/status/StatusInteractions.test.tsx
src/components/access-control/unified/status/StatusPage.tsx
src/components/access-control/unified/status/model.ts
src/components/access-control/unified/status/status.test.tsx
src/components/access-control/unified/status/useRedistribution.ts
src/components/access-control/unified/status/useStatusData.ts
src/components/admin/AdminDeviceDialog.test.tsx
src/components/admin/AdminDeviceDialog.tsx
src/components/admin/AdminUsersPanel.test.tsx
src/components/admin/AdminUsersPanel.tsx
src/components/admin/PasswordReset.test.tsx
src/components/admin/ProjectMembersContent.test.tsx
src/components/admin/ProjectMembersContent.tsx
src/components/admin/components/AccountAccessActions.test.tsx
src/components/admin/components/AccountAccessActions.tsx
src/components/admin/components/AdminListParts.test.tsx
src/components/admin/components/UserFormDialog.roles.test.tsx
src/components/admin/components/UserFormDialog.tsx
src/components/admin/components/UserTable.tsx
src/components/admin/components/settingsAudit.test.tsx
src/components/admin/hooks/useUserManagement.settings.test.tsx
src/components/admin/hooks/useUserManagement.ts
src/components/admin/types/user-types.ts
src/components/alarms/AlarmEmailStatus.test.tsx
src/components/alarms/AlarmEmailStatus.tsx
src/components/alarms/AlarmFilters.test.tsx
src/components/alarms/AlarmFilters.tsx
src/components/audit/AuditCoverage.tsx
src/components/audit/AuditDetailPanel.tsx
src/components/audit/AuditExportButton.tsx
src/components/audit/AuditFilters.tsx
src/components/audit/AuditResults.tsx
src/components/audit/AuditTable.tsx
src/components/audit/auditAudit.test.tsx
src/components/audit/auditLabels.test.ts
src/components/audit/auditLabels.ts
src/components/audit/auditState.test.tsx
src/components/audit/auditState.ts
src/components/auth/AuthProvider.tsx
src/components/auth/ProjectFilter.tsx
src/components/dashboard/LiveFeed.tsx
src/components/dashboard/QuickLinksGrid.tsx
src/components/dashboard/ReadingsTimeline.tsx
src/components/dashboard/SetupChecklist.test.tsx
src/components/dashboard/SetupChecklist.tsx
src/components/dashboard/TodayStrip.tsx
src/components/dashboard/dashboard.test.tsx
src/components/devices/ClaimDeviceDialog.tsx
src/components/devices/DeviceActionsSection.tsx
src/components/devices/DeviceAudit.test.tsx
src/components/devices/DeviceCommandCenter.test.tsx
src/components/devices/DeviceCommandCenter.tsx
src/components/devices/DeviceDetailsPanel.test.tsx
src/components/devices/DeviceDetailsPanel.tsx
src/components/devices/DeviceForm.tsx
src/components/devices/DeviceHistoryImportCard.test.tsx
src/components/devices/DeviceHistoryImportCard.tsx
src/components/devices/LocationTree.tsx
src/components/devices/VirtualReaderDialog.tsx
src/components/devices/hooks/useDeviceFormLogic.ts
src/components/devices/hooks/useDeviceFormSubmission.test.tsx
src/components/devices/hooks/useDeviceFormSubmission.ts
src/components/employees/EmployeeActivity.test.tsx
src/components/employees/EmployeeAddMenu.test.tsx
src/components/employees/EmployeeAddMenu.tsx
src/components/employees/EmployeeDetails.test.tsx
src/components/employees/EmployeeDetails.tsx
src/components/employees/EmployeeEmploymentActions.tsx
src/components/employees/EmployeeFingerprintCard.test.tsx
src/components/employees/EmployeeFingerprintCard.tsx
src/components/employees/EmployeeForm.test.tsx
src/components/employees/EmployeeForm.tsx
src/components/employees/EmployeeFormFields.test.tsx
src/components/employees/EmployeeFormFields.tsx
src/components/employees/EmployeeRecentReadings.tsx
src/components/employees/EmployeeSyncConfirmDialog.test.tsx
src/components/employees/EmployeeSyncConfirmDialog.tsx
src/components/employees/EmployeeTable.test.tsx
src/components/employees/EmployeeTable.tsx
src/components/employees/EmployeeTransferDialog.test.tsx
src/components/employees/EmployeeTransferDialog.tsx
src/components/employees/EmployeeTransferStatus.test.tsx
src/components/employees/EmployeesPage.test.tsx
src/components/employees/SlideOverPanel.tsx
src/components/employees/hooks/useEmployeeFormData.test.ts
src/components/employees/hooks/useEmployeeFormData.ts
src/components/employees/hooks/useEmployeeFormSubmit.roles.test.tsx
src/components/employees/hooks/useEmployeeFormSubmit.test.ts
src/components/employees/hooks/useEmployeeFormSubmit.ts
src/components/employees/import/BatchCardAssignDialog.test.tsx
src/components/employees/import/BatchCardAssignDialog.tsx
src/components/employees/import/DevicePersonImportDialog.test.tsx
src/components/employees/import/DevicePersonImportDialog.tsx
src/components/employees/import/EmployeeExportDialog.tsx
src/components/employees/import/EmployeeImportDialog.permissions.test.tsx
src/components/employees/import/EmployeeImportDialog.test.tsx
src/components/employees/import/EmployeeImportDialog.tsx
src/components/employees/import/devicePersonImportView.test.ts
src/components/employees/lib/employment.ts
src/components/employees/table/EmployeeTableBulkSelection.tsx
src/components/employees/table/EmployeeTableDialogs.tsx
src/components/employees/table/EmployeeTableRow.tsx
src/components/landing/SecuritySection.tsx
src/components/landing/marketingFacts.ts
src/components/layout/AppHeader.tsx
src/components/layout/AppSidebarNav.tsx
src/components/layout/CommandPalette.tsx
src/components/layout/Layout.scroll.test.tsx
src/components/layout/navigationSearch.test.ts
src/components/layout/routeMeta.test.ts
src/components/layout/shellAudit.test.tsx
src/components/layout/sidebarFocus.test.tsx
src/components/leaves/EmployeePicker.tsx
src/components/leaves/LeaveAudit.test.tsx
src/components/leaves/LeaveFilters.test.tsx
src/components/leaves/LeaveFilters.tsx
src/components/leaves/LeaveForm.tsx
src/components/leaves/LeaveRequestsPanel.test.tsx
src/components/leaves/LeaveRequestsPanel.tsx
src/components/leaves/leavesBackend.test.ts
src/components/leaves/lib/leaveState.test.tsx
src/components/live-monitoring/LiveStatus.tsx
src/components/live-monitoring/MonitoringPersonPicker.test.tsx
src/components/live-monitoring/MonitoringPersonPicker.tsx
src/components/live-monitoring/ReadingDetailPanel.tsx
src/components/live-monitoring/monitoringAudit.test.tsx
src/components/live-monitoring/useLiveReadings.ts
src/components/pdks/CorrectionRequestsPanel.test.tsx
src/components/pdks/CorrectionRequestsPanel.tsx
src/components/pdks/auditPage.test.tsx
src/components/pdks/dashboard/PDKSAuditTimeline.tsx
src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx
src/components/pdks/dashboard/PDKSEnhancedExportPanel.tsx
src/components/pdks/dashboard/PDKSOvertimeAlert.tsx
src/components/pdks/dashboard/PDKSSmartPresets.tsx
src/components/pdks/dashboard/PdksRowStatus.tsx
src/components/pdks/dashboard/noShift.test.tsx
src/components/pdks/dashboard/shiftPlans.test.tsx
src/components/pdks/records/recordsView.ts
src/components/pdks/records/usePdksRecordsView.ts
src/components/pdks/settings/CheckpointWarnings.test.tsx
src/components/pdks/settings/CheckpointWarnings.tsx
src/components/pdks/settings/PdksSettingsPanel.test.tsx
src/components/pdks/settings/PdksSettingsPanel.tsx
src/components/profile/UserProjectsCard.tsx
src/components/public/PublicFooter.tsx
src/components/public/public.css
src/components/reports/ReportPage.test.tsx
src/components/reports/ReportResults.tsx
src/components/reports/auditFixes.test.tsx
src/components/settings/SettingsSidebar.tsx
src/components/settings/auditFixes.test.tsx
src/components/settings/sections/GeneralSettings.tsx
src/components/settings/sections/MailSettings.tsx
src/components/settings/sections/NotificationSettings.tsx
src/components/settings/sections/PrivacySettings.tsx
src/components/settings/sections/ReportsSettings.tsx
src/components/settings/sections/RolesSettings.test.tsx
src/components/settings/sections/RolesSettings.tsx
src/components/settings/sections/components/HolidayCalendarManager.test.tsx
src/components/settings/sections/components/HolidayCalendarManager.tsx
src/components/settings/sections/components/OvertimeSettingsForm.test.tsx
src/components/settings/sections/components/OvertimeSettingsForm.tsx
src/components/settings/sections/components/PdksRulesSettings.test.tsx
src/components/settings/sections/components/PdksRulesSettings.tsx
src/components/settings/sections/components/pdksRulesCheckpointTypes.test.tsx
src/components/settings/sections/components/pdksRulesEachPunch.test.tsx
src/components/settings/sections/components/pdksRulesModel.ts
src/components/settings/sections/general/SystemSettingsForm.tsx
src/components/settings/sections/general/generalForm.ts
src/components/settings/sections/hooks/index.ts
src/components/settings/sections/hooks/useGeneralSettings.ts
src/components/settings/sections/integrations/BridgeIntegrationCard.tsx
src/components/settings/sections/privacy/BiometricDestructionCard.tsx
src/components/settings/sections/privacy/BiometricModuleCard.test.tsx
src/components/settings/sections/privacy/BiometricModuleCard.tsx
src/components/settings/sections/privacy/RetentionAssistantCard.test.tsx
src/components/settings/sections/privacy/RetentionAssistantCard.tsx
src/components/settings/sections/privacy/VisitorNoticeCard.test.tsx
src/components/settings/sections/privacy/VisitorNoticeCard.tsx
src/components/settings/sections/reports/exportReport.test.ts
src/components/settings/settings.test.tsx
src/components/shared/PageTemplate.tsx
src/components/shared/tableStates.test.tsx
src/components/shifts/AssignShiftDialog.tsx
src/components/shifts/AssignmentEmployeeTree.test.tsx
src/components/shifts/AssignmentEmployeeTree.tsx
src/components/shifts/ClearAssignmentsDialog.tsx
src/components/shifts/DepartmentAssignments.tsx
src/components/shifts/ShiftCalendarView.tsx
src/components/shifts/ShiftDayDetails.tsx
src/components/shifts/ShiftPlanPage.test.tsx
src/components/shifts/ShiftTree.test.tsx
src/components/shifts/ShiftTree.tsx
src/components/shifts/assignmentPlans.test.tsx
src/components/shifts/calendar/CalendarHeader.tsx
src/components/shifts/calendar/ShiftCalendarPlan.tsx
src/components/shifts/calendar/calendarControls.test.tsx
src/components/shifts/calendar/useShiftCalendarData.ts
src/components/shifts/lib/auditFixes.test.tsx
src/components/shifts/useShiftDefinitionActions.ts
src/components/sync/SyncIssuesBanner.revocation.test.tsx
src/components/sync/SyncIssuesBanner.tsx
src/components/visitors/VisitorCardCapture.tsx
src/components/visitors/VisitorCollapsible.tsx
src/components/visitors/VisitorCombobox.tsx
src/components/visitors/VisitorFilters.test.tsx
src/components/visitors/VisitorFilters.tsx
src/components/visitors/VisitorForm.tsx
src/components/visitors/VisitorFormFields.tsx
src/components/visitors/VisitorManagement.tsx
src/components/visitors/VisitorSlideOverPanel.tsx
src/components/visitors/VisitorStats.tsx
src/components/visitors/VisitorTable.tsx
src/components/visitors/cardCaptureSession.test.ts
src/components/visitors/hooks/useStableQuery.test.tsx
src/components/visitors/hooks/useVisitorClock.ts
src/components/visitors/hooks/useVisitorFormData.ts
src/components/visitors/hooks/useVisitorFormSchema.ts
src/components/visitors/hooks/useVisitorFormSubmit.ts
src/components/visitors/lib/doorsLabel.ts
src/components/visitors/lib/formPayload.ts
src/components/visitors/lib/preRegistration.ts
src/components/visitors/lib/readerCapability.test.ts
src/components/visitors/lib/readerCapability.ts
src/components/visitors/lib/status.test.ts
src/components/visitors/lib/status.ts
src/components/visitors/visitorActivation.test.tsx
src/components/visitors/visitorActivationData.test.tsx
src/components/visitors/visitorAudit.test.tsx
src/components/visitors/visitorTime.ts
src/components/visitors/visitors.test.tsx
src/contexts/ActiveProjectContext.tsx
src/hooks/access-rules/useAccessRuleMutations.ts
src/hooks/access-rules/useComplexAccessRuleMutations.ts
src/hooks/readingAccess.test.tsx
src/hooks/useDashboard.ts
src/hooks/useDepartments.ts
src/hooks/useEmployees.ts
src/hooks/useNotificationSettings.ts
src/hooks/usePdksAudit.test.tsx
src/hooks/usePdksTableData.ts
src/hooks/usePermissions.ts
src/hooks/useProjectAccess.ts
src/hooks/useVisitors.ts
src/lib/auditExport.test.ts
src/lib/auditExport.ts
src/lib/capabilities.test.ts
src/lib/capabilities.ts
src/lib/notify.test.ts
src/lib/permissionsUI.test.ts
src/lib/routeMeta.ts
src/lib/themeBootstrap.ts
src/pages/AdminSetup.tsx
src/pages/Alarms.selection.test.tsx
src/pages/Alarms.test.tsx
src/pages/Alarms.tsx
src/pages/AuditLog.tsx
src/pages/Devices.tsx
src/pages/DevicesPage.test.tsx
src/pages/EmployeeSetup.tsx
src/pages/Employees.tsx
src/pages/Leaves.tsx
src/pages/Login.tsx
src/pages/PDKSRecords.tsx
src/pages/PdksSettings.tsx
src/pages/Profile.tsx
src/pages/Register.tsx
src/pages/Reports.tsx
src/pages/Settings.tsx
src/pages/ShiftPlan.tsx
src/pages/SystemAdmin.tsx
src/pages/UserSetup.test.tsx
src/pages/UserSetup.tsx
src/pages/VerifyEmail.tsx
src/pages/Visitors.tsx
src/pages/managementLayout.test.tsx
src/services/authService.ts
src/types/access-control.ts
src/types/department.ts
src/types/device.ts
src/types/employee.ts
src/types/visitor.ts
```

## Çalışma ağacı doğrulaması

Başlangıç ve son `git diff --stat | tail -1` aynı: `211 files changed, 4049 insertions(+), 2058 deletions(-)`.
`git status --short docs/audits/2026-11-14-implicit-state-machines/access-visitor-account.md` sonucu: `?? docs/audits/2026-11-14-implicit-state-machines/access-visitor-account.md`.
Rapor yeni/untracked olduğu için diff --stat içine girmez. Bu oturum yalnız belirtilen raporu oluşturdu; kirli 211 kaynak dosyasına dokunmadı. Testler çalıştırılmadı.
