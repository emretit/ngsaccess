# 12 — Çalışanın kendi ziyaretçi davetleri

19 Ekim 2026. Uygulama kodu, gerçek Convex wrapper testleri ve mobil regresyon testleri teslim edildi. Önceden kirli web/Convex dosyaları korunarak yalnız atanan kapsam değiştirildi; koordinatör ayrıca `visitorPresence` kart koruması, `visitors.update` ilk operatör bölgesi ataması VIS-F03 kart doğrulaması, VIS-W04 arama/filtre/özet ve VIS-W06 senkronizasyon kanıtı/bounded expiry için sahipliği genişletti. `visitorStatus.test.ts` fixture ve tek cron argüman uyarlaması ayrıca açıkça onaylandı.

## Uygulanan davranış

- Mobil placeholder yerine Türkçe ad araması ve dört idari durum filtresi olan gerçek sayfalı liste, detay, oluşturma ve düzenleme formu, onaylı iptal akışı vardır. Liste ilk yükleme, başarılı boş, hata, önceki veriyle yenileme hatası, sayfalama ve her durumda pull-to-refresh sunar. Detayda idari erişim ile son fiziksel konum ayrı gösterilir.
- `mobileVisitors` endpoint'leri gerçek `employeeAuthedQuery/Mutation` wrapper'larını kullanır. Host ve proje oturum çalışanından türetilir; mobil argümanlar proje/host/kart/preset/aktivasyon yetkisi kabul etmez. Kendi mobil oluşturduğu kayıt dışında detay veya yazma yapılamaz; aynı projedeki başka çalışanın daveti de reddedilir.
- Oluşturma, web ziyaretçi listesinde görülen gerçek `employees` kaydı üretir: `isVisitor:true`, `hostEmployeeId:caller`, `projectId:caller`, `isActive:false`, `visitorStatus:preRegistered`, `PRE:<crypto.randomUUID()>` ayrılmış kartı. Grup üyeliği, gerçek kart veya cihaz işi oluşturulmaz. Zorunlu ad/soyad/amaç, isteğe bağlı telefon/not ve açık ofsetli ziyaret başlangıç/bitiş anları doğrulanır; dönem en fazla 31 gündür.
- Mobil düzenleme ve iptal yalnız henüz operatör kartı/bölgesi atanmamış pasif ön kayıtlara uygulanır. İptal `checkedOut` idari durumunu yazar, fiziksel çıkış üretmez. Operatör atanmış/aktif kayıtta iptal `{status:operatorRequired}` döner; kullanıcıya operatörle iletişim kurması gerektiği gösterilir. Bir operatör isteği gönderildiği veya cihazdan erişim kaldırıldığı söylenmez.
- İlk operatör ataması için `visitors.update` opsiyonel `presetRuleId` kabul eder. Yalnız mobil işaretli, pasif, ham durumu ön kayıt, `PRE:` kartlı, henüz bölgesiz kayıtta kullanılabilir. Gerçek kart ve aynı projedeki ziyaretçi bölgesi doğrulanır; aktivasyon, üyelik ve mevcut senkronizasyon işlerinin kuyruğa alınması tek transaction içindedir. Mevcut ziyaretçilerin sabit bölge davranışı korunur. Süresi geçmiş pasif ön kayıt, gelecekteki bitiş verilerek düzeltilebilir; iptal edilmiş kayıt bu yolla yeniden açılamaz.
- `PRE:` kartlar web kart doğrulamasından geçmez. IDE hedefi olan preset/çalışan için gerçek kart, yazma/kuyruk öncesi canonical ondalık `1..9007199254740991` olmalıdır. Sıfır, negatif, NaN, hex, exponent, kesir ve başında sıfır olan alias reddedilir; farklı DB kartlarının aynı Number-normalized IDE kullanıcı ID'sine dönüşmesi önlenir. Doğrudan cihaz ve kapı üzerinden IDE panel ilişkileri incelenir. IDE olmayan taşımalara bu yeni sayısal kural uygulanmaz. Sınırın kaynağı repo içindeki üretici referansı `docs/ide-smart/05-crud-data-models-validation.md` §5.1 ve mevcut IDE taşıma kodudur; firmware sürümü hakkında yeni iddia eklenmedi.
- Web `checkOut/releaseCard`, merkezi `requireEmployeeAccess` kullanır. Yabancı proje, projesiz ziyaretçi ve hiçbir projeye üye olmayan project admin için patch/scheduler yapılmadan ret vardır; merkezi super admin politikası korunur.

Telefon ve not alanları isteğe bağlıdır; telefon en fazla 40, not en fazla 1000 karakterdir. Notta satır sonuna izin verilir, kontrol karakterleri sınırlandırılır. Güncellemede alanın gönderilmemesi eski değeri korur; açık `null` veya boş/whitespace gönderilmesi DB alanını gerçekten kaldırır. Mobil form boş alanları açık null serileştirir. Notlar mevcut `employees.notes` alanındadır, yeni schema alanı eklenmedi. Yeni alanların null/boş idempotency niyeti canonical'dır; not gönderilmemiş eski istemcilerin fingerprint biçimi korunur. Kendi olmayan kaydın notuna/telefonuna ulaşma veya düzenleme mümkün değildir.

## Veri, yaşam döngüsü ve belirsiz sonuç

Liste proje+host+ziyaretçi indeksinde cursor kullanır; backend sayfa boyutu en fazla 30, mobil 20'dir. Türkçe harf kurallı ad/soyad araması ve active/preRegistered/checkedOut/expired filtresi sayfalama öncesi uygulanır; fiziksel içeride/dışarıda bu durumlara karıştırılmaz. Filtrelenmiş stream çağrısı 200 kaynak satırı ve 128 KB okuma bütçesiyle sınırlıdır (byte bütçesi belge granülerliğindedir). Nadir eşleşmede boş ara sayfa ve devam cursor'ı döner; UI devam yüklemeyi sunar, kesin boş toplam iddiası yapmaz. Cursor host/proje/normalize arama/durum ve değerlendirme anına bağlıdır; filtre değişiminde cursor/liste sıfırlanır, eski sayfa yeni filtreyi ezemez. Eski web-host kayıtları aynı bounded taramada elenir.

Ayrı `mobileVisitors:summary` sorgusu yüklü sayfalardan ve seçili filtreden bağımsız dört idari durum sayısı döndürür. 1000 kayıt/512 KB bütçe aşılırsa `overflow:true` ve alt sınır sayıları gösterilir; UI her toplamın yanında `+` ve açık alt sınır metni kullanır. Arşiv sayfası yüklemek toplamları büyütmez. Sayaç hatası listeyi silmez. Liste DTO'sunda kart, TC, e-posta, telefon, not, amaç ve idempotency fingerprint yoktur. İletişim/amaç yalnız sahipliği doğrulanan detaydan döner.

Provider yalnız görünür ve resumed visitor branch için 30 saniyede sınırlı ilk sayfayı ve açık detayı yeniler. Gizlenme, logout ve dispose timer'ı durdurur. Auth state/epoch ve istemci token'ı birlikte izlenir; `AuthProvider.signOut` istemci token'ını temizlemeden önce bildirim verse de PII ve bekleyen işlem hemen temizlenir. Eski hesabın list/detail/mutation/error/finally sonuçları yeni hesabı değiştiremez.

Oluşturma UUID request ID'si backend host+request indeksinde transaction içi tekillik ve payload tutarlılığı sağlar. Yanıt kaybından sonra aynı istek mevcut kaydı döndürür, değişen payload çatışması yeni kayıt üretmez. Mobil bilinmeyen sonuçta aynı niyeti ve request ID'yi provider'da saklar; alanları kilitler ve aynı işlem yeniden denenir. Bu niyet aynı oturumda ekran kapanıp açılınca korunur; süreç ölümü/uygulama yeniden kurulumu boyunca yerel taslak kalıcılığı eklenmedi. Taslak ve ziyaretçi PII'si diske yazılmıyor; belirsiz işlemden sonra uygulama süreci öldürülürse sunucudaki gerçek liste üzerinden uzlaşma saha QA'sında ayrıca doğrulanmalıdır.

Projenin mevcut ziyaretçi notice URL/sürümü gösterilir. Yapılandırılmış metin varsa güncel sürümün host tarafından incelenmesi doğrulanır, yeni kayda URL/sürüm snapshot'ı yazılır. Ziyaretçi adına rıza verilmiş sayılmaz ve sahte `employeeConsents` kaydı oluşturulmaz. Yeni hukuki metin veya rıza politikası uydurulmadı. SMS/e-posta gönderimi yoktur; başarı metni ön kayıt ve operatör aktivasyonu gerekliliğini açıklar.

## Cihaz kanıtı ve expiry

Sahipliği doğrulanan detayın `sync` DTO'su yalnız `{status,observedAt,bounded}` içerir. Ham payload, kart, cihaz kimliği/adı, özel hata veya başka ziyaretçi işlemi dönmez. Okuyucu en fazla 10 grup, 16 hedef ve her hedef/durum için 8 güncel kuyruk satırını değerlendirir; sınır/eksik ilişkilerde kesin uygulama iddiası yerine unknown döner.

- Pending/sent IDE veya pending/processing Hikvision işi gerçek kuyruk kanıtıyla pending'dir; ilgili terminal hata failed'dır.
- Applied yalnız güncel revizyonun bütün hedefleri IDE ise ve kullanıcı işlemi ile referans verdiği permission işlemlerinin tümü gerçek `acked` + geçerli ack zamanı taşıyorsa gösterilir.
- Hikvision done mevcut pipeline'da gönderim kanıtıdır; applied üretilmez. Salt DB isActive, eksik/eskimiş kuyruk, başka kart/çalışan/proje işlemi veya expired durumundaki eski grant ack'i uygulanmış erişim iptali sayılmaz.
- Bu kanıt cihazın ilgili veriyi onayladığını ifade eder; fiziksel giriş/çıkış veya kapı açılması değildir. Mobil yeniden senkronizasyon yetkisi eklenmedi.

`expireVisitorAccess` tüm adayları collect etmek yerine 50 kayıtlık native cursor batch işler ve kalan sayfa için kendisini internal scheduler ile devam ettirir. Ofsetsiz eski TR tarihleri için mevcut geniş indeks penceresi ve gerçek an karşılaştırması korundu. Cron aynı beş dakikalık periyotta `{}` argümanıyla başlar; bir batch'in sonucu bütün kuyruğun bittiği gibi sunulmaz. 55 kayıtlı testte ilk mutation yalnız 50 kişiyi işler ve devam işi kalan 5'i tamamlar.

## Audit kapanışı

| Kimlik | Teslim / sınır |
|---|---|
| MOB-18, VIS-F01, VIS-W01/W04/W05 | Çalışan-host kapsamlı gerçek mobil liste/detay/form/düzenleme/iptal, Türkçe arama/durum filtreleri ve bounded bağımsız özet; operatör rolüne genişleme yok. |
| MOB-05 ziyaretçi alt işi, VIS-F02/W02 | Merkezi orphan guard ve gerçek web auth wrapper'lı yetkisiz no-write regresyonları. |
| VIS-F03/W03 | IDE hedefinden türetilen senkron kart uyumluluğu ve doğrudan cihaz/kapı hedefli wrapper testleri. |
| VIS-F04/W07 | Sabit Türkçe placeholder kaldırıldı; tüm yeni görünür metinler mevcut TR/EN l10n altyapısından. İlk ARB/generated sahibi 08, son optional not/telefon etiketlerinin sahibi 22; final gen-l10n koordinatörde. |
| VIS-W06 | Gerçek ve minimize kuyruk/ack kanıtından pending/applied/failed/unknown, idari erişim/fiziksel konum ayrımı ve 50 kayıtlık expiry devam işleri uygulandı. Fiziksel cihaz teslim onayı bu worker tarafından kanıtlanmadı. |
| MOB-03/MOB-09 ilgili alt kapsam | Hesap/istek nesli izolasyonu, görünürlük polling'i, request ID tekilliği ve belirsiz sonuçta aynı niyetin tekrar denenmesi. |

## Dosyalar ve entegrasyon

Bu worker'ın değiştirdiği dosyalar:

- `convex/mobileVisitors.ts`, `convex/lib/mobileVisitors.ts`, `convex/mobileVisitors.test.ts`
- `convex/visitors.ts` — yalnız orphan guard, onaylı ilk preset ataması ve IDE ön doğrulama bağlantıları; önceden mevcut değişiklikler korundu.
- `convex/lib/visitorPresence.ts`, `convex/lib/visitorPresence.test.ts` — onaylı kart korumaları/regresyonlar.
- `convex/lib/visitorStatus.test.ts` — yalnız onaylı expiry mock paginate uyarlaması.
- `convex/crons.ts` — yalnız onaylı expireVisitorAccess dördüncü `{}` argümanı.
- `mobile/lib/models/visitor.dart`, `mobile/lib/repositories/visitor_repository.dart`, `mobile/lib/providers/visitor_provider.dart`
- `mobile/lib/screens/visitor/visitor_screen.dart`, `mobile/lib/screens/visitor/visitor_form_screen.dart`
- `mobile/lib/widgets/visitor/visitor_labels.dart`, `mobile/lib/widgets/visitor/visitor_detail.dart`
- `mobile/test/visitor_provider_test.dart`, `mobile/test/visitor_widgets_test.dart`
- Bu rapor.

Yeni bağımlılık eklenmedi. Schema sahibi `mobileVisitorRequestId`, `mobileVisitorRequestFingerprint`, `mobileVisitorNoticeUrl`, `mobileVisitorNoticeVersion` optional alanlarını ve `by_project_host_visitor`, `by_host_mobile_visitor_request` indekslerini ekledi; wrapper testlerinde gerçek schema kullanıldı. Son iki etiket `visitorNotes` ve `visitorOptionalHint` sahibi 22 tarafından eklendi. Root sahibi `VisitorRepository(client)`, `VisitorProvider(repository:repo)`, `synchronizeSession(auth)` ve branch/app-lifecycle `setVisible(bool)` entegrasyonunu üstlendi. Web form sahibi 16, dondurulmuş `visitors.update.presetRuleId` sözleşmesini uyguladı; kendi teslimi `16-visitor-web-activation.md` içindedir. Bu worker main/root, pubspec, ARB/generated veya schema dosyalarını değiştirmedi.

## Kontroller

Bu worker tarafından çalıştırıldı:

```text
node_modules/.bin/vitest run convex/mobileVisitors.test.ts convex/lib/visitorPresence.test.ts convex/lib/visitorStatus.test.ts --reporter=dot
3 dosya, 75 test başarılı.

node_modules/.bin/eslint convex/mobileVisitors.ts convex/lib/mobileVisitors.ts convex/mobileVisitors.test.ts convex/lib/visitorPresence.ts convex/lib/visitorPresence.test.ts convex/lib/visitorStatus.test.ts convex/visitors.ts convex/crons.ts
0 hata, 0 uyarı.

git diff --check -- <atanan dosyalar>
Başarılı.
```

Backend testleri gerçek employee/web oturum wrapper'larını ve kalıcı test DB transaction'larını kullanır; kimlik/proje guard'ları mock'lanmadı. Sekiz eşzamanlı aynı create çağrısının tek kayıt üretmesi; payload conflict; tenant/host izolasyonu; pasif düzenleme; aktif iptal talebinin no-write operatorRequired sonucu; tekrarlı iptal; notice değişimi ve snapshot; orphan/foreign/projesiz admin retleri; PRE aktivasyon reddi; başarılı kart+preset üyeliği; süresi geçmiş ön kayıt yenileme; IDE kart biçimi/range ve non-IDE biçim korunması sınandı. Optional alan testleri telefonsuz oluşturmayı, null/boş aynı request replay'ini, gönderilmeyen alanın korunmasını, açık null ile DB alanlarının kaldırılmasını, sınır aşımında rollback ve başka host'un not/telefon erişiminin reddini doğrular. Ek testler ilk 200 satırın ötesinde Türkçe eşleşmeyi, host/filtreye bağlı cursor reddini, dört lifecycle sayımını, 1002 kayıtta açık özet alt sınırını, IDE user+permission ack kanıtını, Hikvision done/başka kişi/proje/eskimiş op durumunda unknown sonucunu ve 50+5 expiry devamını doğrular. Test cihaz işleri ya tamamlandı ya test DB içinde iptal edildi; fiziksel panele erişilmedi.

Yazılan 18 mobil test: A→B geciken liste/detail/mutation, stale refresh, sahiplik retinde PII temizleme, belirsiz create request ID'si, görünürlük/logout/dispose polling, anlık auth logout/istemci temizleme sırası, dispose sonrası completion; boş durumda refresh/retry, aktif iptal için operatör mesajı, iptal onayını reddetme, yabancı detayın gizlenmesi, belirsiz create alan kilidi/aynı ID ile retry; filtre değişiminde eski cursor sayfasını reddetme, sayfalardan bağımsız özet, A→B geciken özet izolasyonu arama debounce/alt sınır özeti görünümü ve telefon/not temizlemenin açık null payload üretmesi. Flutter komutlarını bu worker SDK kilidi nedeniyle çalıştırmadı. Koordinatör son kaynağı SDK kilidi altında `test/visitor_provider_test.dart` ve `test/visitor_widgets_test.dart` ile çalıştırdı: **18/18 başarılı**. Kanıt: [flutter-visitor-final.txt](../evidence/flutter-visitor-final.txt); 11 provider ve 7 widget testi, belirsiz create retry ve nullable telefon/not temizleme dahil geçti. Son çalışma çıktısı bu worker tarafından da okundu. Global final gen-l10n, format, tam mobil suite ve release build doğrulaması koordinatörün bütünleşik teslimindedir.

## Açık dış doğrulamalar

Release build/signing, gerçek backend deployment/migration, gerçek çalışan/operatör staging akışı ve fiziksel Android/iOS testleri bu worker tarafından yapılmadı. Hikvision/IDE offline, gecikmiş/kayıp ack ve cihaz roster kaldırma/aktivasyon sonuçları gerçek panelde sınanmalıdır; DB/kuyruk testi fiziksel geçiş kanıtı değildir. Mobil host aktif kart erişimini doğrudan kaldıramaz; mevcut operatör sonlandırma pipeline'ı gerekir. Notice içeriği/politikası ve eski IDE kart alias kayıtlarının olası veri düzeltmesi proje sahiplerince değerlendirilmelidir. Commit, push, deploy, production mutation, mağaza gönderimi veya dış mesaj gönderilmedi.
