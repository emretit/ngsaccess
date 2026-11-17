# Dalga 3c — Ölü durum değerleri envanteri

14 Kasım 2026. Yalnız kaynak okuması ve yerel kontroller yapıldı; kod, schema, test ve canlı veri değiştirilmedi. Bu oturumun tek yazımı bu rapordur. `npx convex run`, migration, deploy ve git yazma komutları çalıştırılmadı.

Kaynak bulgular: [özet](README.md), [cihaz/senkron](device-sync.md), [personel/PDKS](people-pdks.md), [erişim/ziyaretçi/hesap](access-visitor-account.md). Aşağıdaki satırlar bu rapor hazırlanırken okunan çalışma ağacına aittir; diğer oturumlar aynı dosyaları değiştirebildiğinden satırlar kayabilir. “Yazar yok” ifadesi repo içindeki üretim kodunu anlatır; test fixture'ı, geçmiş sürüm ve repo dışı veri yazımı ayrı tutuldu. Canlı tablonun boş olduğu iddia edilmiyor.

## Karar özeti

| Bulgu | Öneri | Koşul / gerekçe |
|---|---|---|
| A-06 | Union'a daralt | `active` / `inactive` + mevcut opsiyonellik; önce canlı değer sayımı ve gerekiyorsa normalizasyon. |
| A-07 | Union'a daralt | `requested` ve `ide_panel` için yazar yok; canlıda sıfır oldukları doğrulanmadan çıkarmayın. |
| A-08 | Belgele | `lastSeenAt` imha kararında okunuyor; token/uyandırma akışı da canlı kodda var. Toplu kaldırma güvenli değil. |
| B-06 | Kaldır, veri kontrolünden sonra | Bakiye tablosunun üretim yazarı ve ürün okuyucusu yok; yalnız proje temizliği var. |
| B-07 | Legacy olarak belgele | Eski dört rıza türü yazılmıyor ama geçmiş ve dosya koruma okuyucuları var; `visitor_kvkk` aktif. |
| C-07 | Belgele | Ölü değer değil, yanlış schema yorumu; gerçek yeni proje varsayılanı `true`. |
| C-08 | Kaldır, veri kontrolünden sonra | Sohbet React belleğinde tutuluyor; tabloya üretim insert/query yolu yok, proje temizliği var. |

## A-06 — `doors.status`, `readers.status`

Bulgu geçerli. Schema her iki alanı serbest, opsiyonel string olarak kabul ediyor (`convex/schema.ts:317,384`). Ancak kaynak rapordaki “arayüz active/inactive seçimi” gerekçesi güncel kapı/okuyucu düzenleme ekranlarında doğrulanmadı: `EditDoorDialog` kimlik/kapı numarası, `EditReaderDialog` ad/sensör düzenliyor; status seçimi yok.

### Yazılan değerlerin tam kümesi

| Kaynak | Yazım | Değer |
|---|---|---|
| `convex/doors.ts:173,226,230` | create argümanı → insert | Argüman varsa **her string**; yoksa `active`. |
| `convex/doors.ts:266,326` | update argümanı → spread patch | Gönderilen **her string**; verilmezse alan korunur. |
| `convex/doors.ts:238,247` | Kapıyla otomatik okuyucu oluşturma | `active`. |
| `convex/readers.ts:67,98,109` | create argümanı → insert | Argüman varsa **her string**; yoksa `active`. |
| `convex/readers.ts:172,183` | update argümanı → spread patch | Gönderilen **her string**; verilmezse alan korunur. |
| `convex/readers.ts:274,283` | Eski kapıya okuyucu backfill'i | `active`. |
| `convex/lib/deviceHelpers.ts:152,161` | Ortak okuyucu oluşturucu | `active`. |
| `convex/lib/deviceHelpers.ts:200,206,263,269` | IDE/Hik kapı oluşturucuları | `active`. |
| `src/components/access-control/AddDoorDialog.tsx:25` | Web create çağrısı | `active`. |

Üretim kapı/okuyucu yazıcılarının sabit literal kümesi yalnız **`active`**. `inactive` schema yorumunda amaçlanan ikinci değer; güncel web'de onu gönderen bir kapı/okuyucu akışı bulunmadı. API'nin gerçek kabul kümesi tüm stringlerdir: `inactive`, yazım hatası, `""`, `online` gibi değerler de kabul edilir; bunların canlıda bulunduğu doğrulanmadı. `devices.status` için yazılan active/inactive ve online/offline geçmişi bu iki tabloya taşınmamalı.

**Okuma ve görünürlük:** `convex/doors.ts:119` liste sorgusu, `:581` iç sorgusu ve `convex/readers.ts:190` iç tekil sorgusu ham kayıt döndürür; alanın taşınması ürün kararıyla okunmasıyla aynı değildir. `convex/deviceCenter.ts:20,24,51–63` kapı/okuyucu okur ama status'u yanıtına almaz. İşlevsel kapı kontrolü `convex/lib/mobileAccess.ts:132`: dolu ve `active` dışındaki değer `DOOR_INACTIVE` üretir. Boş string/yok alan bu koşuldan geçer. `convex/doors.ts:420,559` okuyucu görünümü `online` değerini son olay/panel heartbeat'inden türetir, iki status alanını sonuca koymaz. Web kapı/okuyucu status rozeti veya düzenleme seçimi saptanmadı; cihaz bağlantı göstergesi bu alanlardan farklıdır. Mobil ham `doors.status`/`readers.status` kullanmıyor; dolaylı sonucu işler (`mobile/lib/screens/settings/select_device_screen.dart:313`, `core/errors.dart:95,226`, `providers/preferred_device_provider.dart:170`, `providers/door_operation_provider.dart:279`). Okuyucu status'u için davranışsal bir tüketici bulunmadı.

**Kaldır:** `doors.status` mobil kapıyı pasifleştirme semantiği taşıdığı için güvenli değil. `readers.status` ayrı sadeleştirme adayıdır; önce canlı değerler ve dış API tüketicileri incelenmeli. İlgili yerler schema, `readers.ts` create/update/backfill, `doors.ts` otomatik okuyucu insert'i ve `deviceHelpers.ts`; yalnız web'de görünmüyor diye silinmemeli.

**Belgeleme metni:** “Mantıksal etkinlik: active veya inactive. Boş eski alan mevcut davranışta etkin kabul edilir. Cihazın çevrimiçi/çevrimdışı durumunu temsil etmez.” Bu yorum mevcut veri garantisi olarak sunulmamalı; union geçişinden sonra sözleşme olur.

**Önerilen daraltma:** Widen: schema mevcut geniş string kabulünü korurken create/update argümanlarını opsiyonel `active | inactive` ile sınırla; okuma fallback'ini koru. Migrate: aşağıdaki salt okuma sayımında bilinmeyen/boş değerleri çıkar; anlamı onaylanmış eşlemelerle sayfalı, idempotent temizlik planla. Bilinmeyen kapıyı otomatik `active` yapmak erişim açabileceğinden bunu varsayma. Narrow: schema alanlarını `v.optional(v.union(v.literal("active"), v.literal("inactive")))` yap. Alanı zorunlu yapma, bu ayrı bir davranış değişikliğidir. Eski değerler yalnız active/inactive/yok ise veri migration'ı gerekmez; başka string varsa gerekir. Boş stringi kaldırmak veya active yapmak da kararlaştırılmalıdır.

### Koordinatör için salt okuma sayımı — burada çalıştırılmadı

Yerel CLI'nin yalnız `data --help` çıktısı ve `node_modules/convex/src/cli/lib/data.ts:93–120` okundu: `--prod`, `--limit` ve `--format json` destekleniyor. Aşağıdaki komut kod yayımlamaz, fonksiyon çağırmaz ve DB'ye yazmaz; yalnız toplam/değer sayısını basar. Varsayılan üretim deployment'ı yerine belirli bir hedef istenirse `--prod` yerine `--deployment <ad>` kullanılmalı.

```sh
python3 - <<'PY'
import collections
import json
import subprocess

limit = 100000
for table in ("doors", "readers"):
    result = subprocess.run(
        ["node_modules/.bin/convex", "data", table, "--prod",
         "--limit", str(limit), "--format", "json"],
        check=True, capture_output=True, text=True,
    )
    rows = json.loads(result.stdout) if result.stdout.strip() else []
    counts = collections.Counter(
        json.dumps(row["status"], ensure_ascii=False) if "status" in row else "<alan yok>"
        for row in rows
    )
    print(json.dumps({
        "table": table, "okunan": len(rows), "status": dict(counts),
        "tamSayim": len(rows) < limit,
    }, ensure_ascii=False))
PY
```

`tamSayim=false` ise yalnız örneklem vardır; sıfır anomali sonucu daraltmaya kanıt olamaz. Limit artırılarak tam tarama veya salt okuma export/sayfalama yapılmalı; JSON biçimi limit uyarısını ayrıca yazmayabilir. İki tablo farklı anlarda okunur; son daraltma öncesinde yeni geçersiz yazımı engelleyen API sınırı devrede olmalı ve sayım tekrarlanmalı.

## A-07 — `accessTransfers.requested`, `kind=ide_panel`

Bulgu geçerli. `convex/schema.ts:515–516` iki değeri kabul ediyor; üretim insert'i yalnız `convex/employeeTermination.ts:199–204` içinde `kind: "employee", status: "revoking"` yazıyor. Aynı akış `:219,240,243,252,269,304,322` ile revoked/stuck/provisioning/done/cancelled/revoking yazar; `convex/lib/transferGuard.ts:114,126` revoked/stuck'a geçer. `requested` veya `ide_panel` yazan üretim yolu bulunmadı.

**Okuma ve görünürlük:** `convex/lib/transferGuard.ts:10,111` requested'ı etkin/silme bekleyen sayar. `convex/employeeTermination.ts:150,228` employee dışını işlemeye almaz; `ide_panel` için işleyen bir geçiş zinciri yok. Web `src/components/employees/lib/employment.ts:19` requested'ı etkin sayar, `EmployeeTransferStatus.tsx:31–38` bunu “taşınıyor” gösterimine taşır; özel requested etiketi yok. kind UI'ye bağımsız etiket olarak taşınmıyor. Mobilde bu transfer enumları veya bu API için tüketici bulunmadı.

**Kaldır / daralt önerisi:** Canlıda `status=requested` ve `kind=ide_panel` sayıları sıfırsa enum üyelerini ve requested dallarını birlikte kaldırmak güvenli adaydır: `convex/schema.ts`, `convex/lib/transferGuard.ts`, `src/components/employees/lib/employment.ts`. `kind` alanını tamamen kaldırmak bu karardan daha geniştir; employee literal'ını ve mevcut kontrolleri korumak yeterli. İlgili regresyonlar `convex/employeeTransfer.test.ts`, `src/components/employees/EmployeeTransferStatus.test.tsx`.

**Belgeleme alternatifi:** “requested ve ide_panel eski/rezerve değerlerdir; güncel oluşturma yalnız employee/revoking üretir. Bu değerler yeni bir desteklenen akış anlamına gelmez.”

**Widen–migrate–narrow:** Widen zaten mevcut (geniş enum); üreticilerin bu değerleri yazmadığını sabitle. Migrate: canlı envanterde satır yoksa gerekmez. Satır varsa requested'ı körlemesine revoking'e veya ide_panel'i employee'ye çevirmeyin; eski erişim silme kanıtı ve kişi/hedef eşleşmesini inceleyip tamamla/iptal et/arşivle kararını ayrı verin. Narrow: canlıda iki değer kalmadığı doğrulandıktan sonra enum ve okuma dallarını daraltın. Repo taraması tek başına hemen schema değişikliğini güvenli kılmaz.

## A-08 — Köprü son görülme ve claim alanları

Bulgu geçerli, fakat **“okunmuyor” sonucu yanlış olur**. `convex/hikBridge.ts:45–50` token kaydı oluşturur; lastSeenAt/lastClientInfo yazmaz. Bunlara üretim güncellemesi bulunmadı. `claimedBy` için yalnız temizleme yazımları var (`convex/hikvisionSync.ts:487,1154`, değer `undefined`); yeni bridge kimliği damgalayan yol yok. `convex/hikBridge.ts:12–14` eski roster/ACK yollarının kaldırıldığını zaten belgeliyor.

**Okuma ve görünürlük:** `convex/hikBridge.ts:66–67` lastSeenAt/lastClientInfo döndürür; web `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:58–59` son görülmeyi ve istemci bilgisini gösterir, ayrıca bilginin güncel çevrimiçi durumunu göstermediğini söyler. **Ek tüketici:** `convex/biometricDestruction.ts:315,340–341` lastSeenAt'ten bridgeOnline hesaplar; localBridge imha doğrulamasında eski/yok değer işlemi doğrulanmamış saydırabilir. `convex/lib/biometricDestruction.test.ts:227,233` bu alanı fixture olarak besler. claimedBy için sahiplik kontrolü okuyucusu bulunmadı; schema'daki cross-bridge koruma yorumu (`convex/schema.ts:831–836`) güncel uygulamayı anlatmıyor. Mobilde bu üç alanı kullanan akış bulunmadı.

**Öneri: belgele.** Yorum metni: “lastSeenAt/lastClientInfo eski roster protokolünden kalan bilgilerdir; güncel protokol bunları yenilemez. lastSeenAt imha doğrulamasında hâlâ okunur; canlı bağlantı kanıtı sayılmadan protokol yenilenmelidir.” claimedBy için: “Legacy claim kimliği; mevcut enqueue/retry yalnız temizler, ACK sahiplik kontrolü sağlamaz.” Hedefler `convex/schema.ts`, `convex/hikBridge.ts`; mevcut açıklama korunarak netleştirilmeli.

**Kaldır seçeneği:** lastSeenAt'i doğrudan kaldırmak güvenli değil; önce `biometricDestruction.ts` için gerçek bağlantı/cihaz ACK sözleşmesi kurulmalı. lastClientInfo/claimedBy kaldırılacaksa schema, hikBridge query/web gösterimi ve hikvisionSync temizleme patch'leri birlikte ele alınmalı; mevcut alanlar sayfalı temizlenmeden schema'dan çıkarılmamalı. Token tablosu ve `nextWakeAt` bu bulgunun kaldırma kapsamına girmez: `convex/hikBridge.ts:29` nextWakeAt yazar ve `:30` relay uyandırmasını planlar.

**Daraltma:** Enum değildir; union çözümü uygun değil. Belgeleme için migration gerekmez. Alan kaldırılacaksa geniş/opsiyonel şemayı tut → tüketiciyi değiştir ve eski alanı temizle → schema alanını çıkar sırası gerekir; dolu eski alanlar varsa veri migration'ı gerekir. Yeni protokol için attempt/claim kimliği tasarlamak bu envanterin dışında kalır.

## B-06 — `leaveBalances`

Bulgu geçerli. `convex/schema.ts:1299` totalDays/usedDays/remainingDays içeren tabloyu tanımlar. Üretim insert/patch/replace veya izin onayında bakiye güncellemesi bulunmadı. `convex/leaves.ts` ve mobil talep akışı bu tabloya bağlanmıyor.

**Okuma ve görünürlük:** `convex/lib/adminGuards.ts:73` proje silme matrisi içinde delete politikası tanımlar; `convex/projects.ts:121–126` bu tabloları okuyup siler. Ürün bakiyesi okuyucusu, web/mobil bakiye gösterimi veya bakiye enumu bulunmadı. `convex/orphanGuards.test.ts:59` eski bakiye satırını test verisi olarak kullanır; üretim yazarı değildir.

**Öneri: kaldır, canlı tablo boşsa.** İlgili dosyalar `convex/schema.ts`, `convex/lib/adminGuards.ts`, `convex/orphanGuards.test.ts`; schema kapsamını doğrulayan `convex/adminSettingsGuards.test.ts` de kontrol edilmeli. İzin talebi/onay tablolarını veya gerçek izin hesaplarını kaldırma kapsamına almayın. Veri varsa bakiyenin tarihî/muhasebesel anlamı incelenmeden silmek güvenli değildir; arşiv/koruma kararı gerekir.

**Belgeleme alternatifi:** “Legacy izin bakiyesi deposu; güncel izin onayları bu tabloyu güncellemez. totalDays/usedDays/remainingDays güncel hak ediş veya kullanılabilir izin hesabı değildir.”

**Daraltma / migration:** Durum union'ı yok; leaveType'ı daraltmak tabloyu etkin bir bakiye sistemine dönüştürmez. Widen mevcut tabloyu tutmak; migrate eski satırları karar verilen hedefe aktarmak/temizlemek; narrow boş tabloyu ve temizlik kaydını kaldırmaktır. Boş tablo için veri migration'ı gerekmez, yalnız schema/kod temizliği gerekir. Doluysa kontrollü veri migration'ı gerekir. Burada sayım veya silme yapılmadı.

## B-07 — Eski `employeeConsents.consentType` değerleri

Bulgu geçerli: `biometric_face`, `biometric_fingerprint`, `card`, `photo` için üretim insert'i bulunmadı. Aktif yazar `convex/visitors.ts:89–96` yalnız **visitor_kvkk** oluşturur; `:65–72` bu türün aktif kaydını okur. Schema enumu `convex/schema.ts:1352` ile başlar.

**Diğer yazan/okuyan yollar:** `convex/lib/employeeCascade.ts:167–174` tüm türleri okur ve revokedAt yazar; consentType değiştirmez. `convex/files.ts:25,80` documentStorageId üzerinden türden bağımsız okur, bağlı rıza dosyasının yeniden sahiplenilmesini/silinmesini önler. Testlerde eski değerler gerçekten yazılır: `convex/employeeFaces.test.ts:15–16` biometric_face, `convex/fingerprintEnrollment.test.ts:345` biometric_fingerprint, `convex/files.test.ts:24,31,40` photo. Bunlar aktif üretim yazarı kanıtı değildir ama schema daraltılınca testlerin de ele alınacağını gösterir.

**Web/mobil:** Web audit `src/components/audit/auditLabels.ts:90,253,262` consentType alanını ve biyometrik tür etiketlerini gösterir; bu rıza oluşturma formu değildir. Ziyaretçi KVKK kaydı aktif ziyaretçi akışıdır. Mobilde eski dört consentType literal'ına veya employeeConsents tablosuna doğrudan kullanım bulunmadı; mobil ziyaretçi davranışı bu legacy türlerin desteklendiğini göstermez.

**Öneri: belgele, geçmişi koru.** Yorum metni: “biometric_face, biometric_fingerprint, card ve photo yalnız eski rıza kayıtlarını okumak içindir; güncel personel akışı bunları üretmez. visitor_kvkk aktif ziyaretçi onay türüdür. Legacy kayıtlar ve bağlı belgeleri silinmez.” Hedef `convex/schema.ts`; gerekiyorsa audit alan açıklaması. Belgeleme migration gerektirmez.

**Kaldır:** Tabloyu kaldırmak güvenli değil; visitor_kvkk, audit izi ve dosya koruması kullanılıyor. Eski enum üyeleri de canlı dağılım ve belgeler incelenmeden güvenle kaldırılamaz. Eski rızayı visitor_kvkk'ya çevirmek anlamı değiştirir, önerilmez.

**Union'a daraltma alternatifi:** Widen geniş enumu koru ve yalnız visitor_kvkk üreten mevcut yolları koru. Migrate: tür başına sayı/bağlı belge envanteri çıkar; legacy kayıtlar varsa anlamını ve belge referanslarını koruyan ayrı arşiv modelini ürün kararıyla tasarla. Narrow: eski türler mevcut tablodan tamamen çıktıysa visitor_kvkk literal'ına daralt; dosya korumasını ve cascade'i yeni arşive de bağla, yukarıdaki testleri gerçek yeni sözleşmeye göre güncelle. Canlıda eski tür sıfırsa veri migration'ı gerekmez; fixture değişikliği yine gerekir. Tarihî rızayı yalnız schema daralsın diye silmeyin.

## C-07 — Yeni projede biyometri varsayılanı

Bulgu geçerli; ölü bir değer değil, yanlış açıklamadır. `convex/schema.ts:1501` “Yeni projeler biyometri KAPALI başlar” der. Gerçekte `convex/lib/privacySettings.ts:13–16,31` default/fallback olarak true kullanır; `convex/projects.ts:77`, `convex/onboarding.ts:56,141` yeni projeye açıkça true yazar. `convex/privacyBiometric.ts:44–46` yönetici seçimini gerçek boolean olarak kaydeder; false da desteklenen aktif durumdur.

**Okuma ve görünürlük:** `convex/privacyBiometric.ts:26,72` ayarı ve kişi modül bayrağını döndürür; `convex/lib/privacySettings.ts:55–62` biyometrik kapı kontrollerine taşır. Web `src/components/settings/sections/privacy/BiometricModuleCard.tsx:45–55` açık/kapalı durumunu ve değiştirme eylemini gösterir. `mobile/lib` içinde biometricEnabled/getEmployeeBiometricModule veya bu modüle ait doğrudan tüketici saptanmadı; kaynak raporun “mobil modül flag” ifadesi bu taramada doğrulanmadı. Bu sonuç backend'in uyguladığı biyometri kapısını kaldırma gerekçesi değildir.

**Öneri: belgele.** Schema yorumunu şu metinle eşitleyin: “Satır/alan yoksa biyometri varsayılan olarak açıktır. Yeni projeler de biometricEnabled=true ile oluşturulur; yönetici Ayarlar → Gizlilik üzerinden kapatabilir.” Bu, mevcut davranışın açıklamasıdır; varsayılanı değiştirme kararı değildir.

**Kaldır / daraltma:** boolean alanı, true/false değerlerinden birini veya fallback'i kaldırmak güvenli değil. Union gerekmiyor; boolean zaten iki değere dar. Widen–migrate–narrow uygulanacak veri değişikliği yok; yalnız yorum düzeltmesi, migration yok. Yeni projelerin kapalı başlaması istenirse bu ayrı ürün/politika değişikliği olur ve buradan otomatik çıkarılamaz.

## C-08 — `chatConversations`

Bulgu geçerli. `convex/schema.ts:1215` messages[].role için user/assistant union'lı tabloyu tanımlar; repo genelinde üretim insert/patch/replace veya sohbeti listeleyen sorgu bulunmadı.

**Okuma ve görünürlük:** `convex/lib/adminGuards.ts:74` tabloyu proje silme listesine alır; `convex/projects.ts:121–126` kayıtları okuyup siler. `convex/adminSettingsGuards.test.ts:42` bu temizliği test eder. Web sohbeti gerçekten vardır ama `src/components/pdks/chat/hooks/useMessages.ts:6,15,19` React useState ile mesaj ekler/sıfırlar. `hooks/useMessageHandler.ts:13–15` sohbet verisi ve OpenAI action'ları çağırır; bu tabloyu kullanmaz. `src/components/pdks/PDKSAiChat.tsx:14` bu hook'u gösterir. Mobilde chatConversations/user-assistant kalıcılık akışı bulunmadı.

**Öneri: kaldır, canlı tablo boşsa.** Dosyalar `convex/schema.ts`, `convex/lib/adminGuards.ts`, `convex/projects.ts` içindeki eski sohbet yorumu ve `convex/adminSettingsGuards.test.ts`. Web sohbet hook'larını kaldırmak kapsam dışıdır; bunlar kullanılmaktadır. Canlı eski sohbet varsa sahiplik, saklama ve arşiv kararı verilmeden tabloyu silmek güvenli değildir.

**Belgeleme alternatifi:** “Legacy sohbet kalıcılığı tablosu; güncel PDKS sohbeti yalnız istemci belleğinde tutulur. Bu tabloya güncel üretim yazımı yoktur; varsa eski kayıtlar yalnız proje temizliği kapsamındadır.”

**Union / migration:** user/assistant enumunu daraltmak için gerekçe yok; mesele ölü tablodur. Widen mevcut schema'yı koru; migrate varsa eski konuşmaları kararlaştırılmış biçimde arşivle/temizle; narrow boş tabloyu ve temizlik kaydını çıkar. Canlıda boşsa veri migration'ı gerekmez. Sohbete kalıcılık eklemek ise yeni sahiplik ve okuma/yazma API'si tasarımıdır, bu bulgunun basit temizliği değildir.

## Doğrulama kaydı

- Kaynak okumaları: `rg` ile convex/src/mobile ve scripts/infra/bridge yazım/okuma taraması; adaylar satır numaralı kaynak okumalarıyla doğrulandı. B-06/C-08 için tablo adları repo genelinde, üretilmiş dosyalar/bağımlılıklar/build çıktıları hariç tekrar tarandı.
- Canlı dağılım kontrolü yapılmadı; A-06 komutu yalnız önerildi. A-07/B-06/B-07/C-08 için de canlı sıfır veri sonucu çıkarılmadı.
- Yeni test eklenmedi; kod değiştirilmedi. Seçili regresyon komutu: `npx vitest run convex/adminSettingsGuards.test.ts convex/files.test.ts convex/lib/privacyFixes.test.ts convex/employeeTransfer.test.ts convex/fingerprintEnrollment.test.ts` → **5 dosya, 142 test geçti**, çıkış 0. Vite mevcut `__dirname` yapılandırması hakkında uyarı verdi.
- A-08'in ek imha okuyucusu için `npx vitest run convex/lib/biometricDestruction.test.ts` → **1 dosya, 25 test geçti**, çıkış 0. Toplam seçili doğrulama: **6 dosya, 167 test**; tam vitest çalıştırılmadı.
- `node_modules/.bin/eslint docs/audits/2026-11-14-implicit-state-machines/dalga3c-olu-degerler.md` → çıkış **0**, **0 hata / 1 uyarı**: Markdown için eşleşen ESLint yapılandırması olmadığından dosya yok sayıldı. Kod değişikliği olmadığından bu sonuç TypeScript lint doğrulaması diye sunulmuyor; `no-explicit-any` ihlali üretecek kod eklenmedi.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` → **başarısız, çıkış 2; 1 hata**: `convex/lib/pdksNightFixes.test.ts:147:59` TS2345. `targets` içindeki `readonly PdksCheckpoint[]`, mutation argümanının mutable hedef dizisine atanamıyor. Bu dosyaya bu görevde dokunulmadı; ortak çalışma ağacındaki hata nedeniyle “TS 0 hata” kapısı geçmedi. Ownership dışındaki test düzeltilmedi; koordinatörün ilgili worker ile çözmesi gerekir.
- Son `git status --short` kontrolünde rapor yolu yeni (`??`) dosyadır; bu oturum yalnız bu dosyaya yazdı. Canlı değer sayımı ve yukarıdaki TypeScript hatası açık kalıyor; önerilen kod/schema temizliği bu görevde uygulanmadı.
