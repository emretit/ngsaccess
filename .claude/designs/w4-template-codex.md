# W4 — Haftalık erişim şablonları ve kişi × kapı yetki durumu

Salt okunur tasarım; 21 Ekim 2026 çalışma ağacı esas alınmıştır. Kod, cihaz ve canlı veri değiştirilmedi; diğer modelin tasarımı okunmadı.
Öneri: sürümlü ortak zaman şablonu + tek cihaz derleyicisi + plan/kullanıcı düzeyinde sürümlü teslim kanıtı; kişi×kapı matrisi okuma anında, sınırlı kapsamda türetilsin.
**[teyit]** işaretleri uygulama öncesi cihaz/firmware deneyi gerektirir; belgelenmiş bir kapasite bütün filoya genellenmez.

## 1. Veri modeli ve geri uyumluluk

### Bugünkü durum
- `accessRules` tek `startTime/endTime/days`, `hikWeekPlanNo`, `idePermissionNo` taşıyor; `isTemplate/templateName` yalnız alan, ayrı zaman şablonu ilişkisi değil (`convex/schema.ts:436`).
- Üyelik, cihaz ve kapı kapsamı ayrı ilişkiler; seçili panel kapıları varsa bunlar kapsamı daraltır, yoksa eski cihaz kapsamı geçerlidir (`convex/schema.ts:464`, `convex/schema.ts:486`).
- Aynı proje zorunluluğu mevcut; yeni template bağlantıları da aynı kontrolden geçmeli (`convex/lib/accessScope.ts:2`, `convex/lib/accessScopeRelations.ts:5`).

### Önerilen eklemeler — yalnız yeni tablolar ve opsiyonel alanlar
| Yer | Alanlar / amaç |
|---|---|
| `accessScheduleTemplates` | `projectId`, `name`, `description?`, `currentRevision`, `archivedAt?`, `createdBy`, `createdAt`, `updatedAt`; indeks `by_projectId`. |
| `accessScheduleTemplateVersions` | `projectId`, `templateId`, `revision`, `timezone: "Europe/Istanbul"`, `week`, `holidayPolicy`, `contentHash`, `createdBy`, `createdAt`; değişmez sürümler; `by_templateId_and_revision`. |
| `accessRules` ekleri | `scheduleTemplateId?`, `scheduleSchemaVersion?`; `by_projectId_and_scheduleTemplateId`. Şablonlu kural güncel yayımlanmış sürümü izler; kural başına sürüm kopyalanmaz. |
| `deviceAccessArtifacts` | Cihazdaki haftalık plan/template/IDE permission slotu başına `projectId`, `deviceId`, `resourceKind`, `slotNo`, `logicalKey`, `desiredHash`, `appliedHash?`, `runId?`, `generation`, `evidence`, `error?`, `confirmedAt?`; fiziksel cihaz kimliği ve derleyici sürümü hash'e katılır. |
| `employeeDeviceAccess` | Kişi×cihaz başına istenen/uygulanan kullanıcı payload hash'i, credential fingerprint, nesil, son işlem/kanıt, kaldırma durumu; `by_projectId_and_employeeId_and_deviceId`, `by_projectId_and_deviceId_and_employeeId`. |
| `deviceAccessBindings` | Kullanıcı cihaz kaydının kapı→artifact ilişkileri ayrı satırlar; büyük kapı listesi kullanıcı belgesine gömülmez. `by_employeeDeviceAccessId`, `by_deviceAccessArtifactId`. |
| `accessSyncIntents` | Proje başına açık birleştirilmiş iş, hedef nesil, çalışma/planlama cursor'u; ayrıntılı kural/cihaz iş kalemleri ayrı çocuk tabloda. |
| `deviceSyncRuns` / kuyruklar | Opsiyonel `scheduleTemplateId`, `scheduleRevision`, `generation`, `payloadHash`, `artifactId` gibi metadata; mevcut run `kind: rule_sync` korunur, yeni enum zorunlu değildir. |

- `week`: tam yedi gün, ISO gün numarası `1..7`; her gün sıralı `{startMinute,endMinute}` listesi; aralıklar **[başlangıç,bitiş)**, `0 ≤ start < end ≤ 1440`, tam sayı, en fazla 8 aralık/gün (56 toplam).
- Aynı günde çakışma reddedilir; bitişi diğerinin başlangıcı olan aralıklar normalleştirilerek birleşebilir. Boş gün kapalı; yedi boş gün bütünüyle kapalıdır, hiçbir zaman “tüm gün”e dönüşmez.
- Geceyi aşan giriş kullanıcıya iki gün olarak gösterilir: Pazartesi 22:00–Salı 02:00 → Pazartesi `[1320,1440)`, Salı `[0,120)`; bölmeden sonra gün sınırları yeniden kontrol edilir.
- Sunucu validator'ları ve Zod aynı saf doğrulama çekirdeğini kullanır; sürüm çakışmasına karşı `expectedRevision`, semantik no-op için hash kontrolü; ad değişikliği cihaz senkronu gerektirmez.
- Öncelik: `scheduleTemplateId` varsa **yalnız şablon**; yoksa mevcut gömülü program. İkisi birlikte gelirse legacy alanlar gölge veri olarak kalır, yeni yazıcı bunları değiştirmeyi reddeder; eksik/başka projeye ait şablonda legacy fallback yoktur.
- Şablondan ayırma açık bir işlemdir: yeni şablon kopyası veya açıkça seçilen legacy program; eski gölge alanlara kendiliğinden dönülmez. Kullanımdaki şablon silinmez; arşiv mevcut bağları çalıştırır, yeni bağ kurdurmaz.
- Mevcut kayıtlar topluca dönüştürülmez. Şablonsuz kuralların tarihsel davranışı korunur; eski serializer'ın bitişe `:59` eklemesi yeni `[start,end)` semantiğiyle karıştırılmaz (`convex/lib/hikSync.ts:45`). Eski kuralı şablona bağlarken sınır dakikasındaki fark önizlemede gösterilir.
- Bütün create/update/WithGroups/Tracked girişleri bu ilişkiyi doğrulamalı; tek UI yolunu güncellemek yetmez (`convex/accessRules.ts:673`, `convex/accessRules.ts:861`, `convex/accessRules.ts:1216`). Formdaki mevcut `start_time/end_time` adları backend camelCase kuralı gerekçesiyle değiştirilmez (`src/components/access-control/unified/components/TimeSchedule.tsx:6`).

## 2. Cihaza çeviri, sınırlar ve tatiller

### Önkoşul: aynı efektif yetkiyi derlemek
- Önerilen yetki: kişi aktif/geçerli + aynı proje + aktif kural üyeliği + kapı kapsamı; bir kapı için geçerli kuralların zaman aralıkları **birleşim** oluşturur. `priority` sessiz bir “deny override” anlamına getirilmez; mevcut saf karar da aktif kural kesişiminde en az bir izin arıyor (`convex/lib/accessDecision.ts:14`).
- Kapı bacağı ve cihaz bacağı birlikte çözülür; seçili kapılar tüm-cihaz iznini daraltır. Taşınmış/silinmiş/yanlış projeli kapı ilişkisi tüm kapılara genişletilmez. Mobilde bu daraltma ve bozuk bağlantıda reddetme örneği var (`convex/lib/mobileAccess.ts:79`).
- **Mevcut Hik kritik açığı:** kişi senkronu cihazı ilk karşılaştığı kuralla tekilleştiriyor; gateway kişi payload'ı bütün kapılara aynı planı yazıyor (`convex/actions/hikvisionSync.ts:139`, `convex/lib/gateway/persons.ts:54`). Buna Overview'de “kuralların birleşimi uygulanmış” denemez.
- Yeni derleyici kişi×kapı için bütün izinleri toplamalı; Hik'te kapı başına plan listesi desteği doğrulanırsa onu, aksi halde birleşik haftalık planı kullanmalı. Birleşim 8 segmenti aşıyorsa veya firmware temsil edemiyorsa dağıtım reddedilir; ilk/son kuralı seçmek çözüm değildir.
- Backend kart kararı zaman/tatil parametresi almıyor; mobil karar gün/saat bakıyor ve bitişi dışlıyor (`convex/lib/accessDecision.ts:14`, `convex/lib/mobileAccess.ts:29`, `convex/cardReadings.ts:1178`). Yeni şablonlu akışlar ortak zaman çözücüsüne taşınmalı; raporlanmış eski kart olayları yeniden yorumlanmamalı.

### Hikvision
- Gateway serializer günde **8** slot gönderiyor; kullanılmayanları kapatıyor, fazlasını fiilen yok sayıyor; `23:59:59 → 24:00:00` dönüşümü var (`convex/lib/gateway/scheduling.ts:23`, `convex/lib/gateway/scheduling.ts:60`). Yeni doğrulama serializer'dan önce sınır aşımını hata yapmalı.
- Yeni dakika modelinden `start:00`, bitiş için firmware'in dahil/dışlayan sınır davranışına göre tam dönüşüm yapılır; `[480,720)` 12:00'de izin vermemelidir. **[teyit]** Dakika/son saniye davranışı gateway ve yerel bridge'de ayrı sınanmalı.
- Yerel Windows bridge aynı sekiz segmenti kullanıyor fakat `week` sayısal; gateway `Monday` metni kullanıyor. Bridge tatil bağını atlıyor (`bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:184`, `bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:194`). Tek JSON payload biçimi iki taşıyıcıya körlemesine uygulanamaz.
- Uygulamadaki `1..65535` plan numarası kontrolü cihaz kapasitesi değildir (`convex/deviceSyncRuns.ts:236`). Örneğin üreticinin DS-K2700 belgesi **255 week plan / 255 template / 255 holiday group / 1024 holiday schedule** bildiriyor; filodaki terminallerin kapasitesi **[teyit]**: [üretici teknik föyü, s.4](https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000080/S000000108/S000000110/OFR000144/M000001518/Data_Sheet/Spec-of-DS-K2700-Series-Main-and-Distributed-Access-Controller_20201119.pdf).
- Cihaz/model/firmware/transport için bir defalık capability profili ve dolu slot envanteri alınmalı; yeni kayıt/firmware değişimi veya operatör isteğinde yenilenmeli. Yeni periyodik tarama yok. Bilinmeyen kapasitede yeni şablon yayını engellenir; mevcut cihaz programı çalışmaya devam eder.
- Yeni slotlar cihaz başına atomik ayrılır; cihazın varsayılan/dışarıdan yönetilen slotlarına yazılmaz. Mevcut `hikWeekPlanNo` korunur; yeni bağlarda aynı içerik bir hafta planını paylaşabilir, fakat eski kişi bağlarını sırf optimizasyon için topluca değiştirmeyiz.

### IDE Smart
- Repo sözleşmesi tek permission için **tek** `start/end + week_days`, 8 IO (`0..7`), permission ID `1..65535`; kişi başına varsayılan 16 referanstır (`docs/ide-smart/05-crud-data-models-validation.md:25`, `convex/ideSync.ts:64`). ID aralığı fiziksel kayıt kapasitesi demek değildir; toplam permission kapasitesi **[teyit]**.
- Aynı saat aralığını kullanan günleri birleştir: Pzt–Cum 08–12 ve 13–17 → iki permission; her gün farklı 8 aralık → en kötü 56 permission. IO kapsamı farklı kurallar farklı artifact gerektirir; **kişinin paneldeki bütün kuralları** birlikte 16 sınırına sığmalıdır.
- Şu an `capPermissionNos` sessizce 16'ya kesiyor, çağıran uyarı ekliyor (`convex/ideSync.ts:98`, `convex/actions/ideGatewayDevice.ts:160`). Yeni akışta kesme yasak: kapasite aşımında yayın öncesi kural/kişi/cihaz adıyla hata, hiçbir kısmi izin yükleme yok.
- `AC.MAX_PERMS_PER_USER` belgede 1–255 ayarlanabilir ama boot-only ve değişmesi `users.bin` geçerliliğini bozuyor; kapasite artırma otomatik çözüm değildir (`docs/ide-smart/09-access-control-logic.md:126`).
- **[teyit]** IDE bitiş dakika dahilse yeni `[start,end)` için `end-1`, dışlıyorsa `end` gerekir; `1440` desteklenmediğinden tam gün/son dakika fixture'ı zorunlu. Boş program için boş `week_days` belirsizliğine yaslanmak yerine ilgili izin referansı kaldırılır.
- Zaman bölgesi v1 Türkiye saati: IDE `NTP.TIMEZONE=3` sözleşmesi var, `DAY-WEEK` ile permission gün numaraları çelişkili olabilir (`docs/ide-smart/10-full-parameter-reference.md:125`). Pazartesi/Pazar testi **[teyit]**; yanlış eşlemede yayın kapalıdır. Başka saat dilimi/DST v1 kapsamı dışında, UI bunu açıkça söyler.
- Yeni/artan izin setinde önce permission ACK, sonra tam kullanıcı referans seti ACK, en son kullanılmayan permission temizliği; yalnız kuyruğa önce yazmak bağımlılık garantisi değildir (mevcut enqueue sırası: `convex/actions/ideGatewayDevice.ts:127`).

### Tatiller
- **Teyit edildi:** mevcut kural programı tatil okumuyor; Hik/IDE yalnız `startTime/endTime/days` alıyor, tatil create/remove senkron tetiklemiyor (`convex/actions/hikvisionSync.ts:538`, `convex/actions/ideGatewayDevice.ts:303`, `convex/holidays.ts:60`, `convex/holidays.ts:96`). `cardReadings` içindeki tatiller PDKS hesaplarıyla ilgilidir (`convex/cardReadings.ts:480`).
- Model: `holidayPolicy = weekly | deny | custom`; varsayılan `weekly` mevcut davranıştır. `custom` en fazla 8 aralık, `deny` boş tatil programı; tatil haftalık programın yerine geçer. Üretici şablon UI'sı da tatili haftalıktan öncelikli tanımlar: [Hikvision şablon rehberi](https://enpinfo.hikvision.com/hkwsen/unzip/20230830144955_12918_doc/GUID-D3B3020F-1EFD-4359-99FB-ED362553F8D7.html).
- Takvim kaynağı proje + global tatiller, aynı tarihte proje kaydı öncelikli; tarih bazında tekilleştirilir. `isHalfDay` saat taşımıyor (`convex/schema.ts:1156`); yarım gün için açık `halfDayStartMinute` olmadan yayın reddedilir, bordro anlamından erişim saati çıkarılmaz.
- Hik yardımcılarında tatil grubu/planı var, grup için 16 dönem notu ve plan için 8'e kırpma var; mevcut retry `syncHoliday` desteklemiyor (`convex/lib/gateway/scheduling.ts:120`, `convex/lib/gateway/scheduling.ts:155`, `convex/actions/hikQueueWorker.ts:289`). HolidayPlan→HolidayGroup→Template bağının gerçek payload'ı ve readback'i **[teyit]**; sadece bu yardımcıları çağırmak tamamlanmış destek sayılmaz.
- IDE sözleşmesinde haftalık/monthly/yearly seçiciler alternatif; haftalık izin üstünden tarih istisnasıyla “deny” yok (`docs/ide-smart/05-crud-data-models-validation.md:55`). Ek bir tatil izni eklemek mevcut haftalık izni iptal etmez; IDE bağlı şablonda `deny/custom` yayınını destek doğrulanana kadar engelle.
- Önerilen ilk teslim: bütün cihazlarda haftalık şablon; tatil ayarını taslak sakla, yalnız doğrulanmış Hik taşıyıcısında yayımla. Tatil değişikliği aynı birleştirme hattını tetikler; sadece takvim değişimi/operatörün ileri yıl yüklemesiyle çalışır, günlük senkron/cron yok. Yüklü takvim son tarihi gösterilir; cihaz kapasitesini aşan tarihler sessiz kesilmez.

## 3. Değişiklik yayılımı ve fonksiyon çağrısı bütçesi

- Mevcut her kuralı `update` ile dolaşmak fırtına üretir: iki marka schedule edilir; bazı yollar kişi başına da iş açar (`convex/accessRules.ts:736`, `convex/accessRules.ts:934`). Tracked update de tek kural için proje cihazlarını dolaşıyor (`convex/deviceSyncRuns.ts:402`). Şablon yayını bu public mutation'ları döngüyle çağırmamalı.
- Yeni yayın akışı: (1) sürümü doğrula/taslak oluştur; (2) bağlı kuralları indeksle 100'lük, ilişkileri 100'lük sayfalarla derle ve kapasiteyi kontrol et; (3) kontrol edilen grafik nesli değişmediyse tek transaction'da güncel sürümü ve **tek run/intenti** yayımla; değiştiyse yeniden önizleme iste. Taslak hatası etkin sürümü değiştirmez.
- Etkilenen cihazlar = kural cihazları ∪ canlı kapı cihazları ∪ kaldırılacak eski bağ cihazları; `groupDoors.deviceId` snapshot'ına tek başına güvenilmez (`convex/lib/accessGraph.ts:101`). Hedef cihaz/iş kalemi indeksli tekil satır; aynı cihaz bir kez run hedefine girer.
- Hızlı peş peşe değişiklikler açık proje intentinde en son desired nesilde birleşir; sadece ilk değişiklik bir defalık kısa gecikmeli dispatcher açar. Çalışırken gelen değişiklik aynı run altında en fazla bir sonraki geçiş olur; eski ACK güncel nesli tamamlayamaz. Fiziksel ağda “tam bir kez” garanti edilemez; tekrar güvenli payload + tekilleştirme gerekir.
- Cihaz başına işler seri, cihazlar arasında en fazla 2–4 paralel worker; plan/permission artifact'i bir kez, kullanıcı yalnız bağ/referans seti değiştiyse bir kez. Mevcut Hik `targetEmployeeIds: []` kişi tekrarını önleyebilir, fakat alttaki query yine bütün üyeleri okuyor; yeni plan-only yükleyici şart (`convex/actions/hikvisionSync.ts:493`, `convex/actions/hikvisionSync.ts:626`, `convex/hikvisionSync.ts:177`).
- IDE segment sayısı/slot referansları değişmezse yalnız permission payload'ları güncellenir; değişirse bütün etkilenen kullanıcıların tam referans seti bir kez yazılır. Birleşik Hik planı değiştiğinde ilgili artifact yeniden derlenir; kişi bağının aynı kalması tek başına bütün bağımlı planların aynı kaldığı anlamına gelmez.
- Yeni run'larda sonuçlar mevcut send/ACK transaction'ında işlenip sayaçlar güncellenir; yeni `refreshSummary` polling zinciri açılmaz. Mevcut run'lar zaten 5/15/30/60 sn geri çekilmeli timer kullanıyor (`convex/deviceSyncRuns.ts:346`, `convex/lib/deviceSyncRun.ts:62`); şablon işi buna cihaz/kişi timer'ı eklememeli. Tek run timeout görevi yeterli.
- Mevcut IDE dedupe anahtarı runId içeriyor ve `sent` işin payload'ını yeniden yazabiliyor (`convex/ideSync.ts:234`); yeni işler `(device,resource,generation,hash)` ile tekilleşir, gönderilmiş payload değişmez, ACK tam op+msxId+nesille eşleşir. Eski kuyruğun gecikmiş yazısı yeni programın üstüne basmamalı.
- Şablona ilk geçiş yapılan cihazda bütün ilgili kullanıcı/plan yazıcıları aynı seri derleyiciye yönlendirilir; eski kural, kişi, W2 işten ayrılma veya manuel yeniden dağıt eski serializer ile yarışılamaz. Eski kayıtları migrate etmeden eski programları giriş olarak okumak yeterlidir.

### Sayısal tahmin (tasarım hedefi; ölçülmüş kota sonucu değildir)
- `D`: etkilenen cihaz; `P`: değişen derlenmiş artifact; `U`: değişen kişi×cihaz bağ kaydı; `O`: gerçek kuyruk op sayısı (`P+U+silme`); `F`: planlama sayfaları; `B`: op başına 50'lik enqueue sayfaları.
- Önerilen orchestration çağrısı yaklaşık `C = 1 yayın + F + D action + Q contextQuery + B enqueueMutation + D finishMutation + 1 timeout`; küçük contextlerde `Q=D`, dolayısıyla `2+F+3D+B`. Preview çağrıları, büyük graph sayfaları, capability keşfi, retry ve UI reaktif tekrarlar ayrıca eklenir.
- Örnek: 20 kural × 10 IDE panel, kuralların üyeleri ayrık, slot yapısı değişmeyen birer permission: `P=200,U=0,F=4,B=4,Q=10` → **40 orchestration çağrısı**, 200 MQTT op. İsim değişikliği: 1 kayıt, 0 cihaz op. Aynı planı paylaşma uygulanırsa P azalabilir; bunu bütçede garanti etmiyoruz.
- IDE `/sent` ve `/ack` ayrı HTTP action + mutation çağırıyor (`convex/http.ts:368`, `convex/http.ts:392`): örnekte yaklaşık **800 ek çağrı**; 10 op'luk 20 dolu `/poll` için yaklaşık 40 daha, toplam **880**. Mevcut boş polling trafiği, auth yardımcı çağrıları ve retry dahil değil; billing sayımı **[teyit]**.
- Örneğe 1000 değişen kişi×panel bağı eklenirse O=1200 olur; tek run olmasına rağmen sadece sent/ACK yaklaşık 4800 çağrı eder. Önizleme bu artışı gösterir; dakika düzenlemesinde bağ setini korumak kotanın temel kazancıdır. HTTP cihaz PUT sayısı Convex fonksiyon çağrısıyla aynı metrik değildir.
- Mevcut guard'lar 200 cihaz/100 kural/500 üye/2000 op ve 10 dk timeout (`convex/deviceSyncRuns.ts:13`); yeni akış bunları kaldırıp sınırsız collect yapmaz. Önizleme kapasitesini aşan iş yayımlanmaz veya aynı mantıksal run altında cursor'lu küçük iş kalemlerine bölünür; her transaction için belge ve byte bütçesi ölçülür.

## 4. Yetki durumu kaynağı, sorgular ve sayaçlar

### Bugün ne var, ne yok?
- Kişi×kapı×cihaz uygulama durumu **yok**: `deviceSyncRunTargets` run×cihaz; Hik `done=sent`, IDE `acked=verified` (`convex/schema.ts:778`, `convex/lib/deviceSyncRun.ts:34`). Cihaz run'ının başarı durumu tek bir kişinin bütün izinlerinin doğru olduğunu kanıtlamaz.
- `idePanelUsers` yalnız kartın panelde bulunduğunu ve son zamanı tutuyor; permission/kapı/program sürümü yok (`convex/schema.ts:810`). `debugIde.panelRosterDiff` bunu beklenen kart kümesiyle karşılaştırıyor, fiziksel cihazdan anlık program okumuyor ve sınırsız roster collect ediyor (`convex/debugIde.ts:30`). Overview'nin her render'ında çağrılmamalı.
- En ucuz güvenilir kaynak: zaten işlenen op sonucu üzerine **artifact kanıtı + kişi cihaz bağ kanıtı** yazmak; ek ağ sorgusu/kişi×kapı tam matris yazımı yok. Legacy satır başlangıçta “doğrulanmadı”; mevcut run/roster'dan yeşil durum backfill edilmez.
- Kanıt için desired/applied payload hash, compilerVersion, fiziksel cihaz kimliği, credential fingerprint ve ACK nesli eşleşmeli. Sonradan cihaz reseti, kart değişimi, kapı taşınması veya uygulama dışı değişiklik kanıtı geçersiz kılar; elle “doğrula” snapshot'ı alınabilir, sürekli audit polling yok.

### Görünen durum sözleşmesi
| Ana durum | Kesin anlamı |
|---|---|
| **Etkin** | İstenen kişi-kapı bağı ve bağlı programların güncel sürümleri cihaz kanıtıyla eşleşiyor; dışarıda kalmış eski yetki olmadığı da doğrulanmış. Fiziksel kapının şimdi açık olduğu anlamına gelmez. |
| **Bekliyor** | İstenen yetki var; işlem sırada/gönderilmiş veya güncel teslim kanıtı yok. Alt metin “Kuyrukta”, “Gönderildi — doğrulanmadı”, “Eski sürüm” ayrımını verir. |
| **Hata** | Derleme/kapasite/teslim hatası, kısmi dağıtım veya zaman aşımı; uygulanmış son sürüm ve etkilenen kapılar ayrıntıda gösterilir. |
| **Yetkisiz** | Mevcut politika kapsamında yetki yok; iptal cihaza ulaşmamışsa ayrıca kırmızı **“Cihazdan kaldırılmayı bekliyor / kaldırma hatası”** uyarısı. “Cihazda kesin engelli” iddiası değildir. |

- Hik mevcut `sent` sonucu Etkin'e çevrilmez. Tek seferlik hedefli UserInfo/RightPlan + bağlı plan readback eşleşmesi Etkin yapabilir; okuyamayan model Bekliyor/doğrulanmadı kalır. IDE'de yalnız upsertUser ACK yetmez; bütün bağlı permission ACK'leri gerekir (`convex/lib/deviceSyncRun.ts:7`, `convex/ideSync.ts:397`).
- Kural/şablon ataması ile **“Şu an zaman açısından izinli”** ayrı kolonlardır. İkincisi tatil+saat+kişi geçerliliğini hesaplar; APB, cihaz saati, offline davranışı, kapı kilit modu nedeniyle fiziksel geçiş garantisi değildir (`docs/ide-smart/09-access-control-logic.md:23`, `docs/ide-smart/09-access-control-logic.md:47`).
- Birden çok kural varsa tüm gerekçeler satır ayrıntısında gösterilir; yalnız bir kural başarılıyken bütün dağıtıma Etkin denmez. Eski uygulanan daha geniş izin özellikle görünür olmalı.

### Okuma maliyeti
- V1 ana liste kişi görünümünde departmanla filtrelenmiş 25 kişi; seçilen kişinin kapıları 25'lik sayfalanır. Cihaz görünümünde seçilen cihazın kapıları, seçilen kapıda 25 kişi sayfalanır; tüm proje kişi×kapı çarpımı başlangıçta hesaplanmaz.
- “Tümü” görünümü aynı çift uzayını composite `(personCursor,doorCursor)` ile tarayabilir; bir çağrıda en fazla 25 sonuç / 200 aday çift / 1000 graph-belge okuması, ayrıca byte sınırı. Boş filtre sonucu bile ilerleyen cursor döner; truncation hiçbir zaman “Yetkisiz” diye yorumlanmaz.
- Kişi sayfası: indexed üyelikler + tekilleştirilmiş kurallar/şablonlar + kapı bağları + kullanıcı kanıtı; maliyet yaklaşık `O(görünen çift + ziyaret edilen ilişkiler + artifact sayısı)`. Tek kişi binlerce ilişki taşıyorsa da cursor/bütçe uygulanır, 25 satır seçmek tek başına ucuzluk garantisi değildir.
- Cihaz görünümünde kişi evreni departman indeksinden **önce** sayfalanır, sonra grant kontrol edilir; böylece Yetkisiz kişiler de görünür. Gerekirse employees'a proje+departman indeksi eklenir; search ve departman parametreleri cursor imzasına katılır, her okumada proje yetkisi kontrol edilir.
- Sayaçlar varsayılan **görünen kapsamın** çift sayıları: “Tümü / Etkin / Bekliyor / Hata / Yetkisiz”; Hik-Connect Invalid karşılığı hata, eski sürüm ve iptal sorununu ayrı tooltip'te açıklar. Tümü kişi sayısı değildir.
- Kesin tüm-filtre sayaçları istenirse kullanıcı tetiklemeli, generation'a bağlı `accessOverviewSnapshots` + 100'lük devam işleriyle hesaplanır; sonuç gelene kadar “Hesaplanıyor”, kısmi sayı toplam diye sunulmaz. Örn. 5000 çift en az 50 hesap sayfası, graph bütçesine göre daha fazla; global E×D sayacı varsayılan yapılmaz.
- Snapshot bitmeden nesil değişirse eski sonuç yalnız tarihli snapshot'tır; güncel toplam diye yayımlanmaz. Şablon, üyelik, departman, topoloji ve kanıt değişiklikleri snapshot'ı geçersiz kılar; tekrar hesap otomatik döngü değildir.
- Sadece açık sayfanın tek dar `useQuery` aboneliği ve açık run detayı; kapalı sekme sorguları `skip`. Bütün tabloya per-satır subscription yok; benzer mevcut sayfalı liste `listSummaries` kullanıyor (`src/components/access-control/unified/AccessRulesList.tsx:235`). Saat göstergesi sabit `asOf` ile sunulur; istemcide yerel zaman geçişi güncellenebilir, backend dakika polling'i yapılmaz.

## 5. UI akışı

- `/access-control` içine **Kurallar / Zaman şablonları / Yetki durumu** sekmeleri; mevcut sayfa sade wrapper, kural alanı list/dialog/run bildirimini barındırıyor (`src/pages/AccessControl.tsx:1`, `src/components/access-control/unified/UnifiedAccessControl.tsx:28`).
- Şablon listesi: ad, haftalık küçük çizelge, bağlı kural/cihaz sayısı, sürüm, dağıtım özeti; “Yeni şablon”, “Kopyala”, “Arşivle”. Kullanım sayıları bounded projection/counter; satır başına bütün kural ilişkileri okunmaz.
- Düzenleyici: 7 gün × 24 saat, sürükleme yanında klavye erişimli başlangıç/bitiş kutuları; aralık ekle/sil, günü kopyala, hafta içine uygula, tüm gün/kapalı. “Türkiye saati”, kapalı günler, 8 aralık sınırı açık görünür.
- Kaydetmeden önce eski/yeni aralık farkı + etkilenen kural/cihaz/kişi sayıları + cihaz uyumluluğu + yaklaşık op sayısı. “Taslağı kaydet” ve **“Kaydet ve bağlı cihazlara dağıt”** ayrılır; kapasite engelinde uygulanmış sürüm değişmez.
- Kural sihirbazı Zaman adımı: “Bu kurala özel mevcut program” / “Zaman şablonu kullan”; seçili şablon okunur önizleme. Ortak şablon değişikliği ayrı editöre gider, “N kural etkilenir” gösterir; çok-aralıklı program eski iki input'a geri yazılmaz.
- Overview: kişi/cihaz görünümü, departman, kişi araması, kapı, şablon ve dağıtım durumu filtreleri; kişi, departman, kapı, cihaz, kural(lar), şablon/sürüm, dağıtım, zaman uygunluğu, son doğrulama kolonları. Kural ayrıntısında nedenler ve hangi artifact'in eksik olduğu gösterilir.
- **“Yeniden dağıt”** admin yetkili, yalnız seçilen başarısız/eski hedefler; yeni kural oluşturmaz ve Yetkisiz kişiye izin vermez. Açık run varsa birleştirir; çift tık aynı istektir. Offline cihazda bekleyen iş görünür, her UI açılışında yeni run oluşturulmaz.
- Devices drawer yeniden tasarlanmaz; var olan `?deviceId=` ile cihaz ayrıntısına link verilir (`src/pages/Devices.tsx:28`). `hikDoorStatusPlan` ayrı kapı açık/kapalı modu olarak kalır; erişim zaman şablonu bunu değiştirmez (`src/components/access-control/EditDoorDialog.tsx:151`).

## 6. Riskler ve geri dönüş

1. **Fazla yetki / kapalı kalma:** Hik ilk-kural/tüm-kapılar davranışı, farklı gün kodları, bitiş sınırı ve sessiz segment kırpma en büyük risk. Önce ortak resolver + saf compiler fixture'ları; yayın öncesi tüm hedefleri kontrol et, geçersiz programda 7/24 fallback yapma.
2. **Kısmi dağıtım / eski işin üstüne yazması:** plan ve kullanıcı bağı atomik değil. Cihaz seri kuyruğu, immutable op payload, nesil kontrolü, izin→kullanıcı→temizlik bağımlılığı; eksik adımda Etkin yok. Çevrimdışı cihazda eski geniş izin sürebilir; bunu hata ayrıntısında açık göster, otomatik “kapandı” deme.
3. **Kota / kapasite:** IDE segment artışı kullanıcı yeniden bağlamayı gerektirebilir; kişi başına 16, Hik fiziksel slot sayısı ve readback sınırları önizlemeye dahil. Kural başına run/poll veya günlük tatil yeniden dağıtımı yok.
- W2 ile uyum: `employmentEndDate` son çalışma günü dahil; geçmiş tarih hemen pasife çekip Hik sync/IDE delete açıyor, gelecekteki bitiş mevcut 50'lik kapatma işiyle kapanıyor (`convex/employeeTermination.ts:22`, `convex/employeeTermination.ts:63`, `convex/employeeTermination.ts:87`). Yeni writer bu iptali öncelikli aynı nesil hattına almalı, eski template işi çalışanı yeniden eklememeli.
- `employedOn` rapor helper'ı tarih varsa `isActive` kontrolünden önce dönüyor; canlı erişim için doğrudan tek otorite yapılamaz (`convex/lib/employment.ts:8`). Erişimde `isActive !== false`, mevcut accessStartsAt/accessExpiresAt ve son çalışma günü birlikte değerlendirilir; rapor/SGK kapsamı değiştirilmez (`convex/lib/mobileAccess.ts:42`, `convex/lib/reportAttendance.ts:26`, `convex/sgkExport.ts:89`).
- IDE roster hesaplayıcısı çalışan aktifliğini filtrelemeksizin kartı topluyor; onun kart varlığı sonucunu yetki kanıtı saymama gerekçelerinden biri budur (`convex/lib/accessGraph.ts:195`). W2'nin yeni UI alanları ve çalışan dosyaları bu tasarımda değiştirilmedi.
- Geri dönüş: yeni yayın feature flag'i kapatılır, yeni intentler durur; bilinen iyi şablon içeriği **yeni revision/generation** olarak aynı hedeflere gönderilir. Eski ACK kabul edilmez; kişi aktifliği/iptali güncel haliyle yeniden çözülür, eski snapshot'tan ayrılan personel geri yüklenmez.
- Slotları ancak hiçbir kişi bağının kullanmadığı doğrulanınca serbest bırak; rollback için son iyi payload ve slot bağı sakla. DB alanlarını silme/geri migrate etme yok. Offline hedeflerde rollback de bekler; başarılı cihazların tamamını otomatik geri alma yerine operatör seçimi ve açık etki önizlemesi kullan.

## Uygulama adımları

1. **Sözleşme ve cihaz fixture'ları — 1–2 gün:** ortak yetki semantiği, slot/capability envanteri; test cihazında Pzt/Pazar, 00:00/24:00, 12:00 sınırı, çok kapı, iki kural. Kabul: her desteklenen model/transport için kayıtlı beklenen payload/readback; belirsiz cihaz yayını engelleniyor.
2. **Model + CRUD + resolver — 1,5–2 gün:** yalnız ek tablo/opsiyonel alan; legacy boş saat/gün, şablon önceliği, proje izolasyonu, revision yarışı, arşiv ve gece bölme unit/Convex testleri. Kabul: mevcut şablonsuz kayıt fixture'ları aynı sonuçta.
3. **Hik/IDE derleyicileri — 2–3 gün:** kişi×kapı birleşimi, slot ayırma, IDE segment gruplama ve 16 sınırı; 9 segment/17 permission/tatil uyumsuzluğu hiçbir op üretmiyor. Kabul: farklı kapılar yanlışlıkla genişlemiyor; gateway ve bridge sözleşme testleri geçiyor.
4. **Birleştirilmiş run ve kanıt — 2–3 gün:** cursor'lu planlama, batch enqueue, cihaz serileştirme, ACK nesli, timeout; W2 iptal entegrasyonu. Kabul: 20 kural/10 cihaz fixture'ında tek run, değişmeyen kullanıcıya 0 upsert; çift ACK/eski ACK etkisiz, ayrılan kişi yeniden eklenmiyor; çağrı sayısı ölçülüyor.
5. **Şablon editörü ve sihirbaz — 1,5–2 gün:** klavye+mobil 7×24, etki/kapasite önizlemesi, eski form uyumu. Kabul: bağlı iki kural tek şablon değişikliğiyle tek run'a gidiyor; başarısız yayın etkin sürümü bozmuyor.
6. **Overview — 2–3 gün:** dar sayfalama, departman/cihaz görünümleri, dört durum + iptal uyarısı, snapshot sayaçları. Kabul: 5000 çiftte her sorgu bütçeli, tenant sızıntısı yok; legacy/Hik sent yeşil olmuyor; kapalı sekmede sorgu yok.
7. **Kademeli saha doğrulama ve geri dönüş — 1 gün:** bir IDE ve her Hik taşıyıcısından bir test hedefi, sonra sınırlı proje; eski geniş izin, offline, restart ve rollback senaryoları. Kabul: readback ve gerçek test kartı zaman sınırları tutarlı; `tsc --noEmit -p tsconfig.app.json` ve `eslint src convex` gerekli kurallarda temiz.
8. **İsteğe bağlı Hik tatil fazı — ayrıca 1–2 gün:** holiday grup/plan/template ve retry/readback, yarım gün ve yıl sınırı; capability doğrulanmayan IDE/bridge için yayın engeli korunur. Toplam çekirdek tahmin **11–16 iş günü**, cihaz belirsizliği çözüm süresi hariç.

## Emre'ye açık kararlar

1. **Etkin ne demek?** Önerim: güncel cihaz kanıtı; Hik yalnız “gönderildi” ise Bekliyor/doğrulanmadı. Saat uygunluğu ayrı kolon olsun.
2. **IDE kapasitesi aşılınca?** Önerim: yayın bloklansın; saat kesme, 24/7 genişletme veya otomatik `AC.MAX_PERMS_PER_USER` değişimi yapılmasın.
3. **Tatil ilk sürümde?** Önerim: haftalık çekirdek önce; tatil yalnız doğrulanmış Hik modeli/taşıyıcısında, yarım gün başlangıcı açık seçilerek açılsın; karma hedefte desteklenmeyen davranış yayımlanmasın.
4. **Sayaç kapsamı?** Önerim: seçili kişi/kapı/filtre kapsamı ve zaman damgası; bütün proje kişi×kapı sayacı yalnız kullanıcı isterse hesaplanan snapshot olsun.
