Öneri: proje kapsamlı, adlandırılmış ve sürümlenen erişim zaman şablonları; kurallarda doğrulanmış haftalık kopya.
Eski kurallar yerinde çalışır; zorunlu veri backfill'i yoktur, eklemeli schema dağıtımı gerekir.
Cihazlarda önce mevcut kural başına plan kimlikleri korunur; hiçbir cihaz kişisi otomatik silinmez.
Yayınlama önizlemeli ve topludur; cihaz onayı alınmadan “uygulandı” denmez, yeni polling açılmaz.
Plan: 5 faz, 23–31 mühendis-gün; ana belirsizlik Hik/IDE/DS-K2804 firmware sınırları ve dağıtım tutarlılığıdır.

# Erişim zaman şablonu — K3 tasarımı / Codex / 2026-11-25

## 1. Kapsam ve kaynakların gösterdiği durum

- İstenen eksik P1 #5'tir: `docs/hikconnect-audit/PARITY_2026-11-25.md:28`; bağımsız haftalık katalog gereği `docs/hikconnect-audit/PARITY_2026-11-25_A.md:28`.
- Hik'te erişim seviyesi kapı kümesi + şablondur; şablon ekranı 7×24 çizelgedir, kişi dağıtımı ayrıca gösterilir: `docs/hikconnect-audit/HIKCONNECT_SAYFALAR.md:36`, `:37`, `:45`. Bunlar portal gözlem notudur; cihaz kapasitesi kanıtı değildir.
- Kapı planı kişi erişim şablonunun eşdeğeri değildir: `docs/hikconnect-audit/KIYAS.md:28`; P5 için önce K3 ve senkron denetimi istenir: `docs/hikconnect-audit/UYGULAMA_PLANI.md:26`.
- Eski kural `days/startTime/endTime` tutar (`convex/schema.ts:599`); UI bunu tek aralık olarak kaydeder (`src/components/access-control/unified/hooks/useRuleForm.ts:155`).
- Saf yardımcıda 7 gün, gün başına 8 aralık, birleştirme ve gece yarısı bölme hazırdır (`convex/lib/accessSchedule.ts:17`, `:35`); fakat `effectiveSchedule` halen tek aralıktan üretir (`:46`).
- Kaynak düzeltmesi: `convex/lib/ruleSchedule.ts:13` AC tatili değil, TR saatinde kural uygunluğudur. Gerçek tatil tablosu `convex/schema.ts:1429`, kapı tatili okuması `convex/doors.ts:727`.
- Bu çalışma yalnız repo kanıtına dayanır; kod/DB/cihaz/portal değiştirilmedi, diğer bağımsız tasarım okunmadı. Aşağıdaki yeni alanlar ve davranışlar öneridir.

## 2. Veri modeli ve geçiş

Yeni tablolar `convex/schema.ts` içinde tanımlanır. Tüm alanlar camelCase; `Id<...>`, `unknown` + daraltma, argüman validator'ları zorunlu; proje + `accessRules.manage` kontrolü her genel uçta yapılır (`CLAUDE.md:5`, `convex/accessGrantStatus.ts:254`).

| Tablo / değişiklik | Alanlar ve indeksler |
| --- | --- |
| `accessTimeTemplates` | `projectId`, `name`, `normalizedName`, `description?`, `isArchived`, `draftVersionId?`, `publishedVersionId?`, `boundRuleCount`, `createdBy`, `createdAt`, `updatedAt`; `by_projectId_and_isArchived`, `by_projectId_and_normalizedName`; ad araması için proje/arşiv filtreli search index |
| `accessTimeTemplateVersions` | `projectId`, `templateId`, `revision`, `weekSchedule`, `timeZone: "Europe/Istanbul"`, `holidayPolicy: "ignore"`, `contentHash`, `createdBy`, `createdAt`; `by_templateId_and_revision`, `by_projectId_and_templateId` |
| `accessRules` ekleri | Opsiyonel `accessTimeTemplateId`, `accessTimeTemplateVersionId`, `weekSchedule`, `scheduleGeneration`; `by_projectId_and_accessTimeTemplateId`. Mevcut saat/gün alanları ve cihaz numaraları korunur. |
| `accessTimePublications` | `projectId`, `templateId`, `versionId`, `previousVersionId?`, `state`, `scopeHash`, `cursor?`, `rulesTotal`, `rulesPrepared`, `deviceTotal`, `appliedCount`, `failedCount`, `requestedBy`, `createdAt`, `updatedAt`; `by_projectId_and_state`, `by_templateId_and_createdAt` |
| `accessTimeDeviceStates` | `projectId`, `ruleId`, `deviceId`, `desiredVersionId`, `appliedVersionId?`, `generation`, `desiredHash`, `appliedHash?`, `status`, `lastError?`, `lastOperationId?`, `updatedAt`; `by_ruleId_and_deviceId`, `by_projectId_and_status`, `by_deviceId_and_status` |
| `accessTimeCapabilities` | `projectId`, `deviceId`, `firmware`, `transport`, `state`, `maxDailySegments?`, `maxWeekPlans?`, `maxTemplates?`, `maxHolidayGroups?`, `maxHolidayPlans?`, `maxUserPlanRefs?`, `maxUserPermissionRefs?`, `verifiedAt`, `evidence`; `by_deviceId` |

- `weekSchedule`: mevcut `WeekSchedule` ile aynı 7 sabit gün anahtarı, her gün `{start,end}[]`; en fazla 56 segment. Büyüyen kural/cihaz/kişi ID listeleri template dokümanında tutulmaz; ters indeks ve sayfalama kullanılır (`convex/_generated/ai/guidelines.md:157`).
- Yayın `state`: `preflight/preparing/applying/partial/applied/failed/paused`; cihaz `status`: `pending/applied/failed/unsupported`. Durum geçişleri validator union ile sınırlanır; aynı template için aynı anda tek aktif yayın tutulur. Bağlı kural sayacı atama/ayırma/silmede aynı transaction'da güncellenir.
- Sürümler değişmezdir: taslak kaydetmek yeni revision üretir, yayın eski revision'ı değiştirmez. Ad tekilliği aynı mutation içinde normalize ad indeksiyle sağlanır; indeks tek başına unique constraint değildir.
- Kuraldaki `weekSchedule` yayın sürümünün materyalize kopyasıdır: `versionId` ile birlikte tek mutation'da yazılır; istemciden gelen bağımsız kopya kabul edilmez. Bu sınırlı tekrar, her mobil karar/senkron için ilave şablon sorgusu ve satır başına Convex çağrısı gerektirmez.
- Tek saf çözücü: `weekSchedule` varsa validate/normalize et, yoksa mevcut `effectiveSchedule` davranışına dön. Boş hafta erişim vermez; bozuk yeni kopya eski saat alanlarına düşüp erişimi genişletmez, hata verir.
- `isTemplate/templateName` eski kalıntıları yeni katalog olarak kullanılmaz (`convex/schema.ts:608`); şablon erişim kuralı değildir, kişi/kapı üyeliği taşımaz.
- Aynı şablon farklı kapıları hedefleyen sınırsız sayıda kurala bağlanabilir; liste ve fanout sınırlı sayfalarla ilerler. Projesiz eski kurala bağlama, önce projesi açıkça düzeltilmeden reddedilir.

**Geçiş:** zorunlu veri migration/backfill'i gerekmez. Önce opsiyonel schema alanları ve çift okuyucu dağıtılır, ardından yazıcılar ve UI açılır. Kullanıcı “Bu kuraldan şablon oluştur” dediğinde o kuralın eski semantiğiyle hafta üretilir ve açık atama yapılır; tüm eski kurallar kendiliğinden dönüştürülmez.

**Geri dönüş:** feature flag yeni atama/yayınlamayı kapatır; yeni okuyucu kalır. Önceki immutable sürüm yeni generation ile yeniden yayınlanır, sadece ACK alınan hedefler geri döndü sayılır; kuyruğun eski generation işleri iptal/supersede edilir. Eski binary'ye dönüş, çok aralıklı kurallar varken güvenli değildir; eski tek aralık alanları yeni haftayı temsil edemez. Fiziksel çok cihaz geri dönüşü atomik değildir, başarısız hedefler görünür kalır.

## 3. Zaman sözleşmesi ve kapı/tatil ilişkisi

- Dakika hassasiyeti korunur: başlangıç dahil, bitiş dakikasının tamamı dahil. “18:00” = 18:00:59'a kadar; UI bunu açıklamalıdır. Bu mevcut bulut/Hik davranışıdır (`convex/lib/accessSchedule.ts:63`, `convex/lib/ruleSchedule.ts:25`); sessizce yarı açık aralığa geçilmez.
- `24:00` yalnız bitişte, gün sonu anlamındadır. Tam gün 00:00–24:00; boş gün kapalıdır. 22:00–06:00 girişte aynı gün 22:00–24:00 + ertesi gün 00:00–06:00 yapılır; Pazar→Pazartesi de bölünür. Eşit saat reddedilir; tam gün ayrı seçenek. Birleşimden sonra kapasite kontrol edilir.
- TR için `Europe/Istanbul` kullanılır; haftalık saatler UTC'ye çevrilip saklanmaz, iş olayları epoch/UTC tutulur. Cihaz yerel saatinin TR ve NTP durumunun doğrulanamadığı hedef “saat doğrulanmadı” sayılır; yayınlamaya uygun değildir. Sabit UTC+3 bugünkü ürün kapsamıdır, çok zaman dilimi bu fazların dışındadır (`convex/lib/accessSchedule.ts:54`).
- Bir kişinin aynı kapıya birden fazla aktif kuralı varsa **izin veren aralıkların birleşimi** geçerlidir; priority ile yeni bir deny/override semantiği eklenmez. Cihaz derlemesi ve bulut aynı kapı kapsamını kullanır; tüm kuralların birleşimini koruma gereği mevcut kodda var (`convex/lib/hikSyncEmployee.ts:578`).
- Şablon kapı planının yanında durur. Şablon “kim, ne zaman doğrulanabilir”; DoorStatus “kapı herkes için açık/kilitli/normal”; Verify plan “hangi kimlik yöntemi”dir (`convex/lib/gateway/plans.ts:9`, `:124`). Ayrı cihaz namespace'leri ve slotları kullanılır, birinin yayını diğerini yazmaz.
- Fiziksel öncelik: acil durum/manuel donanım davranışı ayrıca cihaz sorumluluğudur; doğrulanmış remainClosed normal kimlik geçişini engeller, remainOpen kişi takviminden bağımsız serbest geçiş yaratır. UI bu çakışmayı gösterir; remainOpen varken “bu kişi kesin geçemez” yazmaz. Firmware davranışı doğrulanmadan kesin fiziksel sonuç iddia edilmez.
- İlk sürümde `holidayPolicy="ignore"`: mevcut kişi takvimi davranışı korunur. PDKS tatili eklemek/silmek kişi yetkisini kendiliğinden değiştirmez; kapı tatili ayrı uygulanır. Kaynak: `docs/hikconnect-audit/PARITY_2026-11-25_A.md:31`, `:139`.
- Sonraki tatil genişlemesi: proje+genel `holidays` tarihlerini yayımlanan sürüme dondurup tarih bazlı kişi istisnası üretmeli; yarım gün için açık saat sınırı gerekir (`holidays` yalnız `isHalfDay` tutuyor: `convex/schema.ts:1433`). Gece aralığı bölündükten sonra her takvim gününün tatil istisnası uygulanır; önceki günden taşan izin tatili delmez.
- Kapı tatili bugün tam gün ve 8 slot gönderir (`convex/lib/gateway/plans.ts:293`); kişi tatili buna bağlanarak çözülemez. Tatil desteği doğrulanmayan markada şablonun tatilli sürümü etkinleştirilemez; gece başına cron ile izin aç/kapat emülasyonu yapılmaz.

## 4. Cihaz eşlemesi: kanıt, sınırlar, bilinmeyenler

| Hedef | Bilinen | Tasarım / henüz doğrulanması gereken |
| --- | --- | --- |
| Hik gateway | `UserRightWeekPlanCfg`→`UserRightPlanTemplate`→kişinin `RightPlan` referansı. 7×8 slot; boşlar disable; DS-K1T8 için string gün ve 24:00 sonu gözlemi: `convex/lib/gateway/scheduling.ts:23`, `:42`, `:95`. | İlk uygulamada her kuralın `hikWeekPlanNo`'su korunur; aynı mantıksal şablon R kuralda R cihaz planına derlenir. Böylece yeni ortak cihaz slotu sahipliği gerekmiyor. |
| Hik tatil | Yardımcıda holiday group ve holiday plan var; “16 tatil/cihaza göre” yorumu ve 8'e kesme mevcut: `convex/lib/gateway/scheduling.ts:121`, `:156`. | Gerçek UserRight tatil plan↔grup bağlantısı, slot boşaltma, yarım gün ve firmware sınırı doğrulanmış değil. DoorStatus kapasite okuması (`convex/lib/gateway/plans.ts:252`) UserRight kapasitesi sayılmaz. |
| IDE Smart MQTT | Tek permission tek saat aralığı+günler; max IO=8; kişi varsayılan max 16 permission; ID 1–65535: `docs/ide-smart/05-crud-data-models-validation.md:27`, `convex/ideSync.ts:79`. Aynı saatli günleri birleştiren derleyici var (`convex/lib/accessSchedule.ts:70`). | Kural başına en fazla 8 farklı aralık yardımcı sınırı, firmware toplam kapasitesi değildir. Her aralık ayrı permission; tüm kuralların kişi×panel referans sayısı preflight edilir. |
| DS-K2804 local SDK | Bridge `syncWeekPlan` içinde STDXML ile hafta+template yazar, 7×8 üretir; gün sayısal; fazlalığı `Take(8)` keser: `bridge/windows/NgAccess.HikvisionBridge/Sdk/HikvisionClient.cs:157`, `:194`. | Gateway'in string-gün formatı kopyalanmaz. Sessiz kırpma hata olmalı; template JSON/holiday alanı firmware belirsizliği README'de açık (`bridge/windows/NgAccess.HikvisionBridge/README.md:74`). |

- Hik cihaz başına toplam week plan/template sayısı ve kişi×kapı plan referans limiti bu incelemedeki kod/belgelerde model bazlı güvenilir sayı olarak yoktur. Global max+1 atayıcı kapasite kanıtı değildir (`convex/hikvisionSync.ts:292`). Kapasite, boş/NGS sahipli slotlar ve mevcut numaranın uygunluğu kontrollü testte ölçülmeden yayın açılmaz; slot dolunca hata, rastgele üstüne yazma yok.
- IDE kodunda segment permission numaraları ve fazladan ID'ler zaten var (`convex/ideSync.ts:776`); mevcut user overflow yolu kırpma uygulayabiliyor (`convex/actions/ideGatewayDevice.ts:202`). Yeni yayın yolunda preflight ile **tamamen reddet**, eski çalışan izinleri daraltma/genişletme; değişen kuralların toplamını kişi×panel düzeyinde ölç.
- IDE gün numarası için permission docs 0=Pazar der; NTP parametresi farklı konvansiyon gösterebilir (`docs/ide-smart/10-full-parameter-reference.md:129`). Haftanın yedi günü ve gece geçişi firmware kabul testi ister.
- DS-K2804'te aynı cihazdaki çoklu plan birleşimi şu an sınırlı (`convex/lib/hikSyncEmployee.ts:249`); tek şablona bağlı kurallar aynı plan olsa bile otomatik “destekli” sayılmaz. Desteklenmeyen çoklu yetki açık blokerdir; tek plana birleştirmek ancak kapı kapsamı bozulmadığı ispatlanan ayrı adaptör çalışmasıyla yapılır.
- Desteklenmeyen/kapasitesi bilinmeyen cihaz varsa taslak kaydedilebilir, etkilenen kapsamın yayını başlamaz. Operatör bu cihazı hedefleyen kuralı ürün kararıyla ayrı ele alır; 7/24'e düşme veya bulutta denetleyip cihazda geniş izin bırakma yoktur.

## 5. Yayınlama, kuyruk, kota ve güvenlik

1. “Yayınla” önizlemesi indeksle bağlı kuralları, `groupDevices` + `groupDoors` üzerinden hedefleri ve etkilenen kişileri sınırlı sayfalarla çıkarır (`convex/lib/ruleDevices.ts:8`). Proje/cihaz kapsamı doğrulanır; artan/azalan izinler, çakışmalar ve cihaz maliyeti gösterilir.
2. Önizleme `versionId + scopeHash` ile sabitlenir. Yetki/üyelik/kapı bağlantısı değişmişse devam etmeden yeniden hesaplanır. Önce tüm hedeflerin doğrulaması bitirilir; tek uyumsuzlukta cihaz yazımı başlamaz.
3. Yayın kaydı ve başlatma tek mutation'dır; kural haftası/sürümü/generation, cihaz desired kayıtları ve iş sayfaları transaction içinde oluşturulur. Büyük fanout cursor'la sürer; UI “dağıtım hazırlanıyor / kısmi / tamamlandı” ayırır. Her sayfada kapsam değişimi yeniden kontrol edilir, değişmiş hedefe eski sonuç yazılmaz.
4. Yeni atamalar ve normal kural senkronları aynı doğrulanmış hafta kopyasını kullanır. Template düzenlemek tek başına hiçbir cihazı değiştirmez; yayınlama bağlı kuralları yeni sürüme taşır. Devre dışı kurala snapshot yazılabilir ama cihaz grant'i oluşturulmaz.
5. Hik hedefi için week plan→template başarılı olmadan kişi referansı değiştirilmez. Mevcut plan numarası aynıysa salt saat değişiminde kişi yazımı gerekmeyebilir; ancak ACK durumu yeni sürüme yükseltilir. İlk atama/numara/kapsam değişiminde tam kişi×kapı kural birleşimi yeniden yazılır.
6. IDE'de permission upsert ACK'leri→kişi referansları ACK→artık referanslanmayan NGS permission emekliliği sırası zorunludur; enqueue sırası teslim kanıtı değildir. Permission sayısı değişince tüm etkilenen kişilerin birleşimi yeniden hesaplanır. Paylaşılan aralığın yerinde değişmesi o permission'ı kullanan herkesi etkiler; önizleme bunu kapsar.
7. Local bridge kuyruğa alındığında “queued”, gerçek bridge ACK'inde “applied” olur. Bugünkü enqueue başarısı (`convex/lib/hikSyncEmployee.ts:527`) fiziksel başarı kabul edilmez. Timeout/çevrimdışı “bekliyor”; hata “başarısız”; yalnız aynı generation/hash ACK'i appliedVersion'ı ilerletir.
8. İdempotency `(ruleId, deviceId, generation, operation, part)`; her cihazda seri sıra/lease; yeni generation eski retry'ı supersede eder. En çok 5 retry ve jitter/backoff, sonra manuel yeniden deneme. Tek cihaz hatası global başarı yazmaz; başka cihazların başarısı kaybolmaz.

**Kota bütçesi:** yeni sabit cron, UI polling veya satır başına `runQuery/runMutation` yok. Bir liste sayfası bir abonelik; kişi ayrıntısı yalnız açıldığında tek toplu sorgu. Saf hesaplama fonksiyonları aynı invocation içinde çağrılır; Convex rehberi de action→query/mutation sayısını azaltır (`convex/_generated/ai/guidelines.md:92`).

- Yayın işçisi sayfa başına en fazla 50 kural veya 100 cihaz işlemiyle başlar; transaction/payload limitine göre daha küçük parçalar. Bir toplu claim/load, bounded HTTP/MQTT işlemleri, bir toplu finish; ACK'ler köprüde kısa süre/maksimum adetle gruplanır. Hiçbir dış çağrı DB mutation içinde yapılmaz.
- D = değişen kural×cihaz çifti, P = yeniden referanslanacak kişi×cihaz, S = IDE permission parçası toplamı, B = batch boyu. Hik salt zaman değişimi yaklaşık 2D dış PUT; ilk atama ek P kişi yazımı. IDE yaklaşık S permission yazımı + referans değişirse P user yazımı + emekli permission işlemleri. Mantıksal şablonun yeniden kullanımı ilk fazda cihaz slot tasarrufu sağlamaz.
- Hedef ilave Convex çağrısı satır sayısı değil sayfa sayısı ile büyür: yaklaşık yayın 1 + keşif sayfaları + 3×iş batch'i + ACK batch'leri; retry ayrıca bütçelenir. 100 hedeflik tek batch için yaklaşık 1 başlangıç + 1 keşif + 3 iş + 1 ACK = 6 çağrı bir ölçüm hedefidir, mevcut sistem vaadi değildir; gateway/bridge taşıma farkları ayrıca ölçülür.
- Mevcut Hik worker'ın satır başına mark done/retry çağrıları (`convex/actions/hikQueueWorker.ts:89`) bu yeni iş yolu için kullanılmadan önce toplulaştırılmalı. Mevcut IDE bridge adaptive poll yapıyor (`scripts/ide-mqtt-bridge.mjs:238`, `:318`); yeni yayınlar poll hızını artırmaz. Hedef: mevcut wake/uzun bağlantı üstünden olayla drain; bu taşıma yoksa önce eklenir, yeni hızlı poll kurulmaz.
- Yayın önizlemesi tahmini dış işlem/Convex çağrı sayısını gösterir; gözlenen batch/call/retry sayaçları run'a yazılır. Günlük yapılandırılabilir yayın bütçesi aşılırsa sonraki batch duraklar, otomatik sonsuz yeniden deneme yoktur. Boş kuyrukta bu özellik sıfır ilave çağrı üretmelidir.

**Kişi güvenliği:** şablon değiştirme/arşivleme/boş hafta/geri alma hiçbir `deletePerson`, `deleteCard`, `deleteUser`, roster cleanup üretmez. Erişim çekilecekse mevcut kişinin yalnız NGS'nin yönettiği izinleri daraltılır; diğer kapılar/kurallar/harici izinler korunur. Tam güvenli daraltma desteklenmiyorsa işlem başarısızdır, kişi silme fallback'i yoktur. Kişi ve biyometri yeniden yaratılarak senkron yapılmaz.

**Kesinti riski:** yerinde plan PUT hemen geçerli olabilir; iki cihaza atomik yayın yoktur. Eski izin cihazda kalabildiğinden bekleyen bir daraltma güvenli uygulanmış sayılmaz; “cihaz hâlâ önceki sürümde” belirgin gösterilir. Önceki doğrulanmış payload saklanır, kısmi hata otomatik kapı açma/kilitleme komutu üretmez; operator kontrollü yeniden deneme/geri alma vardır.

## 6. UI ve “şu an erişebilir mi?”

- `/access-control?tab=templates`: mevcut Kurallar / Yetki Durumu / Kapı Planları yanına “Zaman Şablonları” sekmesi (`src/components/access-control/unified/UnifiedAccessControl.tsx:88`). Proje seçilmeden query çalışmaz.
- Liste: ad, hafta özeti, bağlı kural sayısı, yayın sürümü, dağıtım durumu, son değişiklik; arama ve aktif/arşiv filtresi. Sayımlar mutation ile tutarlı güncellenir veya bounded sayfa özeti verilir, `.collect().length` yok.
- `FilterBar` ile arama/temizleme (`src/components/shared/FilterBar.tsx:33`); başlıklar yüklenirken korunarak `TableStateRow` (`src/components/shared/TableStateRow.tsx:7`); satır açılışı `onRowActivate` ve işlem düğmesi ayrımı (`src/lib/tableRowClick.ts:13`). Bu ortak dosyalar değiştirilmez.
- Editör: 7 satırlı 24 saat ızgarası + erişilebilir başlangıç/bitiş alanları, gün kopyalama, aralık ekle/sil, “Tam gün” ve “Kapalı”; sürükleme tek giriş yolu olamaz. Klavye, görünür odak, mobilde gün kartları; renk yanında metin vardır. Gece taşması ve limit hatası kaydetmeden görünür.
- “Taslağı kaydet” cihazlara gitmez; “Değişiklikleri yayınla” etkilenen kural/kişi/kapı sayısını, farkı ve uyumsuz cihazları gösterir. Kullanımda şablon arşivlenebilir, yeni atamaya kapanır; mevcut bağlar çalışır. Fiziksel silme yok, kopyalayarak yeni şablon oluşturma var.
- Kural formu: “Bu kurala özel gün/saat” veya adlandırılmış şablon seçimi; seçili yayın sürümü ve salt okunur hafta özeti; “Şablonu düzenle” açık ayrı eylem. Mevcut react-hook-form isimleri yeniden adlandırılmaz; yeni alan Zod'a bağlanır (`src/components/access-control/unified/hooks/useRuleForm.ts:139`).
- Kişi görünümü mevcut `EmployeeGrantSheet` üstüne eklenir (`src/components/access-control/unified/status/EmployeeGrantSheet.tsx:12`). Mevcut `byEmployee` zaten schedule/validity teşhisi döndürüyor (`convex/accessGrantStatus.ts:250`); cihaz düzeyindeki `some(rule)` yerine **kapı düzeyinde** değerlendirme gerekir: başka kapıya ait kural bu kapıyı açık gösteremez.
- Her kapıda ayrı: “Politikaya göre izinli/izinli değil”, açıklayan kural+şablon+sürüm, sonraki değişim zamanı; ayrıca “cihaza uygulandı/bekliyor/hata/bilinmiyor” ve kapı açık/kilitli planı. Kişi pasifliği/başlangıç/bitiş, üyelik, kapı kapsamı ve haftalık birleşim birlikte hesaplanır.
- “Şu an kesin geçebilir” sözü verilmez: çevrimdışı cihaz, bilinmeyen saat, uygulanmamış sürüm, manuel/fiziksel durum varken sonuç bilinmiyor olabilir. Yeni saat sorgusu her dakika gönderilmez: sorgudan politika snapshot'ı + server `checkedAt` gelir; istemci zaman sınırında yerel yeniden hesaplar, görünür yeniden doğrula eylemi vardır. Query'de `Date.now()` geçmesi tek başına aboneliği zamanla yenilemez.

## 7. Uygulama fazları, tek dosya sahipliği ve kabul

Efor mühendis-gündür; kontrollü cihaz laboratuvarı sağlanması takvim beklemesi ayrıca olabilir. Aşağıdaki worker rolleri gelecek uygulama planıdır; bu tasarım sırasında worker açılmadı.

| Faz / efor | Tek sahip ve yazacağı dosyalar | Kabul ve geçiş kapısı |
| --- | --- | --- |
| F1 — sözleşme + uyumluluk, 3–4 gün | **A/core**: `convex/lib/accessTimePolicy.ts`, `convex/lib/accessTimePolicy.test.ts`, `docs/access-schedule-template/CAPABILITY_MATRIX.md`; yalnız mock/fixture | 7 gün, iki aralık, boş hafta, tam gün, Pazar gece taşması, bitiş dakikası testleri; Hik/IDE/SDK bilinmeyenleri isimlendirilmiş. Canlı doğrulama ayrıca yetkilendirilir. |
| F2 — schema + katalog + okuyucu, 5–7 gün | **B/backend**: `convex/schema.ts`, `convex/accessTimeTemplates.ts`, `convex/accessTimeTemplates.test.ts`, `convex/lib/accessSchedule.ts`, `convex/lib/ruleSchedule.ts`, `convex/lib/accessRuleUx.ts`, `convex/accessRules.ts`, `convex/lib/mobileAccess.ts`, `convex/lib/cardReadingProcess.ts` ve bu dosyaların testleri | Proje izolasyonu; bozuk hafta ret; legacy çıktısı birebir; immutable sürüm; kopya+version atomik; kart/mobil/teşhis aynı zaman sonucu; eski kurala zorunlu backfill yok. |
| F3 — dağıtım + taşıma, 8–11 gün | **C/sync**: `convex/accessTimePublications.ts`, `convex/lib/accessTimeFanout.ts`, `convex/lib/hikSyncEmployee.ts`, `convex/lib/hikSync.ts`, `convex/hikvisionSync.ts`, `convex/actions/hikQueueWorker.ts`, `convex/ideSync.ts`, `convex/actions/ideGatewayDevice.ts`, `convex/lib/gateway/scheduling.ts`, `convex/lib/grantStatus.ts`, ilgili testler; `scripts/ide-mqtt-bridge.mjs`; `bridge/windows/NgAccess.HikvisionBridge/{Models.cs,Sdk/HikvisionClient.cs}` ve bridge self-testleri | Tüm hedef preflight; limitte ret, kırpma yok; plan ACK→referans; iki sürümün ters ACK'i; offline/retry; 0 kişi silme; farklı kapıya izin sızıntısı yok; üç adaptörde kontrollü haftalık test. Idle ek çağrı 0, toplu call sayacı bütçede. |
| F4 — UI + kişi teşhisi, 5–6 gün | **D/UI**: `src/components/access-control/time-templates/**`, `src/components/access-control/unified/UnifiedAccessControl.tsx`, `unified/hooks/{useRuleForm.ts,useAccessRuleSchema.ts}`, `unified/components/TimeSchedule.tsx`, `unified/CreateRuleDialog.tsx`, `unified/status/{EmployeeGrantSheet.tsx,StatusViews.tsx,model.ts}`, `src/hooks/access-rules/useComplexAccessRuleMutations.ts`, `src/types/access-control.ts`; **B/backend** yalnız `convex/accessGrantStatus.ts` ve testi | Haftalık editör klavye/mobil; filtre/boş durum; iki kurala aynı şablon; taslak cihaza gitmez; yanlış kapıya olumlu teşhis yok; pending fiziksel başarı sayılmaz; satır başına query yok. |
| F5 — pilot + geri dönüş, 2–3 gün | **E/entegrasyon**: `docs/access-schedule-template/ROLLOUT.md`, `docs/access-schedule-template/ACCEPTANCE.md`; kaynak düzeltmelerini yalnız önceki dosya sahibi yapar | Pilot proje, destekli her taşıma; kısmi yayın ve önceki sürüme dönüş; dış kişi/biometri sayısı değişmez; kota raporu; tsc 0 + eslint no-explicit-any 0 + ilgili Vitest/bridge testleri yeşil. |

- Bağımlılık: F1→F2→F3; F4, F2 API sözleşmesi sabitlenince fixture ile F3'e paralel başlayabilir; F5 ikisini bekler. Ortak `schema.ts` yalnız B'dedir; C gerekli alanı B'ye talep eder. D Convex yazmaz; B kişi teşhisini sağlar. F3/F4 birleşmeden F2 eski okuyucu desteği kaldırılmaz.
- Ownership tablolarındaki `unified/...` yolları `src/components/access-control/` altındadır. Yeni test fixture dosyaları ilgili sahibin klasöründedir; ortak dosyada eşzamanlı yazım yoktur. Yeni ihtiyaç çıktığında önce sahiplik atanır.
- Dağıtım sırası: eklemeli schema/çift okuyucu → kapalı feature flag ile katalog → kota güvenli taşıma/adaptörler → UI → açıkça seçilmiş pilot → genel açılış. Bu belge uygulama/cihaz erişimi yetkisi değildir.

## 8. Emre'ye en fazla üç ürün kararı

1. **Bir şablon değişikliği bağlı tüm kurallara nasıl yansısın?** Öneri: taslak ayrı kalsın, etki önizlemeli tek “Yayınla” tüm bağlı kuralları güncellesin; cihazlardaki kısmi sonuç görünür olsun. Tek kurala farklı saat gerekiyorsa şablonun kopyası oluşturulsun.
2. **Resmî/yarım gün tatiller kişi geçişini otomatik değiştirsin mi?** Öneri: ilk sürümde değiştirmesin; kapı tatili ayrı kalsın. Tatilli kişi erişimi ayrıca istendiğinde kapanış saati ve uyumlu cihaz kapsamı açık bir sonraki paket olsun.
3. **Bir hedef cihaz şablonu uygulayamıyorsa yayın diğerlerine devam etsin mi?** Öneri: önizlemede bilinen uyumsuzluk tüm yayını başlatmasın; operatör kapsamı düzeltsin. Başladıktan sonraki bağlantı arızasında başarılı hedefler korunsun, bekleyen daraltmalar belirgin gösterilsin ve yeniden deneme/geri alma seçilsin.
