# Geçiş Kontrol + Canlı İzleme + Ziyaretçiler — UX/UI Audit (2026-10-16)

> Kapsam: `/access-control`, `/live-monitoring`, `/visitors`; `src/pages/{AccessControl,LiveMonitoring,Visitors}.tsx`; `src/components/access-control/**` (28 dosya), `src/components/visitors/**` (13 dosya), bağlı hook ve tipler; `convex/accessRules.ts`, `convex/cardReadings.ts` liste/kart yakalama sorguları, `convex/visitors.ts`, bölge/kapı/okuyucu sorgu ve mutasyonları (yalnız okuma).
> Sayım: 🔴 7 · 🟠 23 · 🟡 9 · ⚪ 0 — toplam 39 bulgu.
> Yöntem: çalışma ağacındaki kaynak kod ve çağrı zinciri incelemesi; üretim verisine, cihazlara veya canlı DB'ye erişilmedi. Tarayıcıda görsel/klavye testi yapılmadı; ölçülmemiş kontrast, gerçek cihaz davranışı ve gecikme süreleri **(doğrulanmadı)**. Rapor mevcut kirli çalışma ağacını esas alır; özellikle `convex/cardReadings.ts` ve `convex/lib/cardReadingAudit.ts` başka çalışmalarla değişmekte olduğundan implementasyondan önce yeniden okunmalı.

## 1. Özet

Bu üç ekran birlikte “kim, hangi kapıdan, ne zaman geçebilir; geçiş gerçekleşti mi; ziyaretçinin erişimi ne zaman biter?” işini taşıyor. En büyük sorunlar seçili proje ile veri kapsamının ayrışması, canlı izleme tarih/arama sonuçlarının yanlış kapsam göstermesi ve ziyaretçinin fiziksel konumunu erişim izniyle karıştıran “Şu an binada” hesabı. Yetki formunda saatleri temizlemek eski saatleri kaldırmıyor; bekleme durumları sabit `false` olduğundan tekrar kaydetme engellenmiyor. Ziyaretçi kartını yakalama başarılı okumadan sonra durmadığı için form başka bir kişinin kartına kayabiliyor. Mevcut Türkçe alanlar, ziyaretçi `StatCard` kullanımı, kart numarası çakışma kontrolü, TR saatli ziyaretçi tarih yardımcıları ve cihaz senkronizasyon şeritleri korunmalı; öncelik bu temelin üzerinde doğru veri ve güvenilir işlem durumları olmalı.

### İncelenen yüzeyler ve erişilebilirlik sınırı

| Yüzey | İncelenen dosyalar / akış | Rubrik sonucu |
|---|---|---|
| Kural listesi ve oluştur/düzenle | `UnifiedAccessControl`, `AccessRulesList`, `CreateRuleDialog`, `useRuleForm`, `useAccessRuleSchema`, `RuleBasicInfo`, `TimeSchedule`, `DepartmentTree`, `ZoneDeviceTree`, `weekdays`, `selectionHelpers` | 1–10 tarandı; ACC-01–09, ACC-30–34. |
| Canlı izleme | `CardReadings`, `CardReadingsFilters`, `CardReadingsTable`, **aktif hook `useProjectFilteredCardReadings`** | 1–10 tarandı; ACC-10–17, ACC-30–33. `useCardReadings` alternatifindeki debounce/tarih düzeltmesi bu rotada kullanılmıyor. |
| Ziyaretçi liste/filtre/istatistik/çıkış | `VisitorManagement`, `VisitorFilters`, `VisitorStats`, `VisitorTable`, `visitorTime` | 1–10 tarandı; ACC-18, ACC-24, ACC-28–33. |
| Ziyaretçi oluştur/düzenle/kart/bölge | `VisitorForm`, `VisitorFormFields`, `VisitorCardCapture`, `VisitorSlideOverPanel`, `VisitorZoneDialog`, üç form hook'u | 1–10 tarandı; ACC-19–23, ACC-25–27, ACC-29–34. QR verme bu yüzeylerde bulunmuyor. |
| Fiziksel bölge/kapı/okuyucu | `ZoneDoorTreePanel`, `ZoneDoorTree`, `AddZoneDialog`, `AddDoorDialog`, `AddReaderDialog`, `EditDoorDialog`, `MoveReaderDialog`, `EditReaderDialog` | Klasör kapsamı nedeniyle incelendi; aktif giriş `/devices`, `src/pages/Devices.tsx:118`. ACC-35–39, ACC-33–34; cihaz audit worker'ıyla sahiplik çakışması önlenmeli. |
| Aktif rotaya bağlanmayan eski yüzeyler | `AccessControlSidebar`, `UnifiedAccess`, `ZonesAndDoors`, `GroupMembersManager`, `GroupDevicesManager`, `UnifiedRuleTable` | Tüm içerikleri okundu, `src` import/kullanım taramasında tüketici bulunmadı. `ZonesAndDoors.tsx:26` ve `UnifiedRuleTable.tsx:6` işlevsiz buton içeriyor; erişilemeyen kodu mevcut kullanıcı hatası diye saymadık. Yeniden bağlanacaksa önce kaldır/onar kararı verilmeli. |

`convex/accessControl*` adıyla dosya yok; gerçek backend `convex/accessRules.ts`. `EditReaderDialog` da tanımlı fakat tüketicisi yok; bunun **aktif ağaçtaki eksik düzenleme girişine** etkisi ACC-36'da ayrıca ele alındı. Adım sayıları kod üzerinden anlamlı kullanıcı eylemlerinin yaklaşık sayısıdır; kullanılabilirlik ölçümü değildir.

## 2. Ana görevler

| Görev | Bugünkü akış (adım sayısı) | Takıldığı yer |
|---|---|---|
| Bir personele belirli kapı/saat yetkisi vermek | Yeni Kural → ad → gün/saat → departman aç/personel seç → bölge aç/cihaz aç/kapı seç → Oluştur (6–9) | Arama yok; kapı yetkisinin özeti cihaz sayısına indirgeniyor; geçersiz saat/gün kaydedilebiliyor. |
| Mevcut yetkiyi tüm güne açmak veya kapatmak | Kuralı bul → düzenle → saatleri temizle → Güncelle (4); kapatmak için switch (1) | Temizlenen saatler backend'de korunuyor; switch ve kaydetme bekleme sırasında kilitlenmiyor. |
| Belirli günün reddedilen geçişini açıklamak | Tarih → Reddedilenler → kişi/kart ara → satırı oku (4) | TR tarih bir gün kayıyor; kısmi tarama “kayıt yok” üretebiliyor; ret sebebi gösterilmiyor. |
| Yeni ziyaretçiye fiziksel kart vermek | Yeni Ziyaretçi → kişi → kart okut/elle gir → bölge → bitiş → Kaydet (6–7) | Bölge yoksa çıkmaz; kart sonraki okumayla değişebilir; kaydedildi/cihaza işlendi ayrımı satırda yok. |
| Ziyaretçi bölgesi hazırlamak | Bölge Ekle → ad → saat/gün → cihaz/kapı seç → Oluştur (5–7) | “Bölge” fiziksel bölge değil erişim kuralı; sonradan genel kural formunda boş üyeli şablon düzenlenemiyor. |
| İçerideki ziyaretçiyi bulup çıkış/kart iadesi yapmak | Şu an binada → ziyaretçiyi bul → çıkış ikonu → kart iade ikonu (4) | Reddedilen giriş içeride sayılıyor; süre dolan içeride kişi kayboluyor; çıkış erişim iptali ama tek tık. |
| Ziyaretçiye QR vermek | Bu ekranlarda tamamlanabilir akış yok | Kart zorunlu; QR üret/göster/iptal eylemleri yok; donanım desteği ayrıca doğrulanmalı. |
| Okuyucu yönünü düzeltmek / kapı planını güncellemek | Cihazlar → bölge → cihaz → kapı ayarı (4+); okuyucu taşıma ayrı diyalog | Yerinde okuyucu düzenleme yok; taşıma varsayılan yönü değiştiriyor; plan hatasında diyalog kapanıyor. |

## 3. Bulgular

Önem: 🔴 kritik (yanlış veri/kırık akış/veri kaybı), 🟠 yüksek (ana görevi ciddi zorlaştırır), 🟡 orta (tutarlılık/kullanılabilirlik), ⚪ düşük. Efor: S <2 saat, M yaklaşık yarım gün, L 1+ gün. Kategoriler görevdeki 1–10 rubriğiyle aynıdır. Aynı kök neden farklı ekranlarda bir kez sayılmıştır.

### 3.1 Geçiş Kontrol — kural listesi, kişi/kapı seçimi ve zaman planı

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ACC-01 | 🔴 | 1,4 | **Saat sınırı kaldırılamıyor.** Düzenlemede 09:00–18:00 alanlarını silmek `undefined` gönderiyor; backend undefined alanları atlayıp eski değeri tutuyor. Başarı mesajına rağmen erişim planı değişmiyor. | `src/components/access-control/unified/hooks/useRuleForm.ts:120`, `convex/accessRules.ts:438` | “Tüm gün” seçeneği ve açık temizleme sözleşmesi (`null`/ayrı flag) ekle; kayıttan sonra okunan özetle doğrula. | M |
| ACC-02 | 🟠 | 1,4,10 | Zod zaman/gün şeması tanımlı ama kullanılan submit yalnız ad/personel/cihaz kontrol ediyor. Hiç gün seçmeden veya yalnız tek saat girerek kayıt yapılabiliyor; listede tek saatli plan da “24 saat” yazıyor. Geceye taşan planın davranışı açıklanmıyor. | `src/components/access-control/unified/hooks/useAccessRuleSchema.ts:34`, `src/components/access-control/unified/hooks/useRuleForm.ts:92`, `src/components/access-control/unified/AccessRulesList.tsx:370`, `src/components/visitors/VisitorZoneDialog.tsx:62`, `convex/accessRules.ts:318` | Kullanılan form shape'ini doğrulayan tek şema; alan altında Türkçe hata ve ilk hataya odak. Boş/tek taraflı/gece aşan saatler için açık sözleşme; backend'de aynı kontrol. Form alanlarının isimlerini keyfi değiştirme. | M |
| ACC-03 | 🔴 | 1,3 | **Kaydetme pending değeri gerçek değil.** Create/update hook'larında `isPending:false`; diyalog buna güveniyor. Çift tıklama aynı kuralı iki kez oluşturabilir. Silme pending'i de sabit, aktif/pasif switch'inde uçuşta kilit yok. | `src/hooks/access-rules/useComplexAccessRuleMutations.ts:146`, `src/hooks/access-rules/useComplexAccessRuleMutations.ts:162`, `src/components/access-control/unified/CreateRuleDialog.tsx:47`, `src/hooks/access-rules/useAccessRuleMutations.ts:92`, `src/components/access-control/unified/AccessRulesList.tsx:287` | Gerçek işlem state'i ve submit guard; kural bazında pending; hata halinde form korunmalı. Gerekirse oluşturma için idempotency anahtarı ayrıca değerlendir. | M |
| ACC-04 | 🟠 | 1,2,10 | **Boş ziyaretçi bölgesini düzenlemek bloke.** Bölge `targetType:visitor` ve üyesiz oluşturuluyor; genel liste aynı düzenleme formunu açıyor, form her türde en az bir çalışan istiyor. Üyesi olan ziyaretçi kuralında ise ziyaretçiler personel ağacında görünmüyor; “Tümünü Seç” mevcut ziyaretçi üyelerini değiştirebilir. | `src/components/visitors/VisitorZoneDialog.tsx:68`, `src/components/access-control/unified/hooks/useRuleForm.ts:101`, `src/components/access-control/unified/components/DepartmentTree.tsx:43`, `convex/employees.ts:93` | Ziyaretçi bölgesini türüne uygun editöre yönlendir; şablon düzenlemesi ziyaretçi üyeliklerine dokunmasın. Türü cast ile saklama; ayrık form tipleri kullan. | M |
| ACC-05 | 🟠 | 2,8 | “Hangi kapıya yetkili?” sorusu listeden cevaplanamıyor: özet ve açılan ayrıntı yalnız cihazları gösteriyor, `groupDoors` görüntülenmiyor. Bir panelde tek kapı ve tüm kapılar aynı “1 cihaz” özetiyle sunuluyor. | `src/components/access-control/unified/AccessRulesList.tsx:193`, `src/components/access-control/unified/AccessRulesList.tsx:414`, `convex/accessRules.ts:130` | Bölge → kapı adlarını ve “tüm kapılar” kapsamını görünür özetle; dar kapı seçimini cihaz sayısından ayır. Kapı adlarını backend özetine veya mevcut lookup'a ekle. | M |
| ACC-06 | 🟠 | 2,4 | Departman seçimi yalnız doğrudan çalışanları seçiyor, alt departmanlar dahil değil; sonradan katılanlar otomatik kapsanmıyor. Bölge checkbox'ı cihaz üyeliğine baktığı için cihazın tek kapısı seçiliyken bile bölge tam seçili görünebilir. 192px ağaçlarda arama ve kısmi personel seçimi göstergesi yok. | `src/components/access-control/unified/components/DepartmentTree.tsx:47`, `src/components/access-control/unified/components/DepartmentTree.tsx:95`, `src/components/access-control/unified/components/DepartmentTree.tsx:187`, `src/components/access-control/unified/components/ZoneDeviceTree.tsx:177` | Alt ağaç/kısmi seçim kurallarını tutarlı yap; “mevcut N kişi seçilir” açıklaması, kişi/kapı arama ve seçili özet ekle. Dinamik departman grubu ayrı UX-2 yeteneği olsun. | M |
| ACC-07 | 🟠 | 2,9 | Kural listesi arama/durum filtresi/sayfalama olmadan bütün kartları ve üyeleri indiriyor. Backend her kural için üç ilişki listesi, ardından üye ve cihaz okumaları yapıyor; kartlar kapalı olsa da maliyet ödeniyor. | `src/components/access-control/unified/AccessRulesList.tsx:266`, `convex/accessRules.ts:51`, `convex/accessRules.ts:70`, `convex/accessRules.ts:79`, `convex/accessRules.ts:103` | Sayfalı özet sorgusu, sunucuda ad/kişi/kapı filtresi ve açıldığında detay sorgusu; toplam/ilişki sayıları sınırlı maliyetle sunulsun. | L |
| ACC-08 | 🟡 | 7 | Kural switch'i ve düzenle/sil/aç ikonları erişilebilir ada sahip değil. Açma trigger'ı ve içerik iki farklı `Collapsible` kökünde; aria-controls gerçek ayrıntıyı hedeflemiyor. Ağaç açma butonları 20px ve adsız. | `src/components/access-control/unified/AccessRulesList.tsx:287`, `src/components/access-control/unified/AccessRulesList.tsx:338`, `src/components/access-control/unified/AccessRulesList.tsx:393`, `src/components/access-control/unified/components/DepartmentTree.tsx:103` | Kural adı içeren aria-label, tek kontrollü Collapsible; geniş dokunma alanı ve ağaç düğümlerinde expanded/controls. | M |
| ACC-09 | 🟠 | 1,10 | Düzenleme formu geçerli `priority:0` değerini `editingRule.priority || 100` ile 100'e çeviriyor; öncelik alanı formda görünmediği için kullanıcı yalnız adı değiştirirken gizli veriyi de değiştiriyor. | `src/components/access-control/unified/hooks/useRuleForm.ts:68`, `src/components/access-control/unified/hooks/useRuleForm.ts:132`, `src/components/access-control/unified/CreateRuleDialog.tsx:33` | `??` ile değeri koru; değişmeyen gizli alanları payload'dan çıkar. Önceliğin gerçek karar etkisi bu audit'te doğrulanmadı, veri değişikliği kodda kesin. | S |

### 3.2 Canlı İzleme — tarih, geçmiş, ret açıklaması

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ACC-10 | 🔴 | 1 | **Seçilen gün bir önceki güne kayıyor.** Aktif hook takvim Date'ini UTC ISO'ya çevirip gün parçasını alıyor; İstanbul gece yarısı 16 Ekim → `2026-10-15`. Backend gönderilen günü TR sınırına dönüştürdüğü için yanlış gün sorgulanıyor. | `src/hooks/useProjectFilteredCardReadings.ts:26`, `convex/cardReadings.ts:74`, `src/components/access-control/CardReadings.tsx:24` | Takvim seçimini date-only anahtar olarak sakla/gönder; TR gün sınırını sunucu oluştursun. Alternatif kullanılmayan hook'u düzeltmekle yetinme. | S |
| ACC-11 | 🔴 | 1,9 | **Kayıt toplamı ve arama yanıltıcı.** Sayfa 1 yalnız son 300 kaydı tarayıp bunu toplam sayıyor, arama/durum filtresi sonra çalışıyor; 301. kayıttan eski tek eşleşme “yok” olur. Sayfa ilerledikçe toplam artar; üst sınır 5000'den eski veri erişilemez, sınır UI'da yazmaz. | `convex/cardReadings.ts:61`, `convex/cardReadings.ts:189`, `convex/cardReadings.ts:202`, `convex/cardReadings.ts:214`, `src/components/access-control/CardReadingsFilters.tsx:60` | Filtreyi indeks/sunucu aramasıyla sayfalamadan önce uygula, cursor kullan. Kesin toplam yoksa “yüklenen kayıt” + devam bilgisi göster; mevcut durum indekslerinden yararlan. | L |
| ACC-12 | 🟠 | 2,8,10 | Ret sebebi saklanıyor ve liste ham kaydı yayıyor, fakat yerel `CardReading` tipi bunu taşımıyor; tablo yalnız “Reddedildi” gösteriyor. Kullanıcı kart tanımsız mı, saat mi, yetki mi ayıramıyor. | `convex/schema.ts:464`, `convex/lib/cardReadingAudit.ts:80`, `src/types/access-control.ts:3`, `src/components/access-control/CardReadingsTable.tsx:29` | Query dönüşünden tip türet; Türkçe sebep ve “neden bilinmiyor” durumu; olay detayı/ilgili kural bağlantısı. Ham cihaz kodunu ikincil teknik ayrıntıya koy. | M |
| ACC-13 | 🟠 | 1,8 | Eksik `direction` “Giriş”, eksik `accessStatus` “Reddedildi” oluyor; şema ikisini de optional tutuyor. Bilinmeyen kayıttan kesin sonuç türetiliyor; normal çıkış da kırmızı hata rengiyle sunuluyor. | `src/components/access-control/CardReadingsTable.tsx:30`, `src/components/access-control/CardReadingsTable.tsx:38`, `convex/schema.ts:440` | Giriş/çıkış/bilinmiyor ve izin/ret/bilinmiyor ayrı durumları; yön nötr, karar semantik renk kullansın. | S |
| ACC-14 | 🟡 | 1,3 | Yenile butonu hiçbir işlem yapmıyor (`handleRefresh = () => {}`). Reaktif abonelik var ama kullanıcıya canlı bağlantı durumu veya son veri zamanı verilmediği için düğmenin etkisizliği anlaşılamıyor. | `src/components/access-control/CardReadings.tsx:26`, `src/components/access-control/CardReadingsFilters.tsx:132` | Sahte düğmeyi kaldır; bağlantı ve son olay zamanını göster. Yeniden bağlanma gerekiyorsa gerçek recovery eylemi sun. | S |
| ACC-15 | 🟠 | 2,3 | “Canlı İzleme” ekranı içeride “Kart Okutma Geçmişi”; canlı/geçmiş ayrımı, görüntüyü durdurma ve yeni olay sayacı yok. Reaktif offset listeye kayıt eklenmesi incelenen satırların yerini/sayfa sınırını değiştirebilir. | `src/pages/LiveMonitoring.tsx:4`, `src/components/access-control/CardReadingsFilters.tsx:56`, `src/components/access-control/CardReadings.tsx:79`, `convex/cardReadings.ts:215` | Canlı/Geçmiş modu; canlıda “yeni N kayıt” biriktirme ve görüntüyü durdurma; geçmişte sabit cursor/üst zaman sınırı. Yoğun akıştaki kayma kullanıcı testiyle ölçülmedi. | L |
| ACC-16 | 🟡 | 1,2 | Canlı izleme arama/tarih/durum/sayfası ve ziyaretçi arama/durumu yalnız component state; rotadan çıkış/yenileme ile kaybolur, filtreli görünüm paylaşılmaz. | `src/hooks/useProjectFilteredCardReadings.ts:8`, `src/components/visitors/VisitorManagement.tsx:13` | Projeye bağlı URL parametreleri; değişimde sayfayı resetle, geri tuşunda görünümü koru. Canlı mod ve geçmiş tarihi birlikte belirsiz kalmasın. | M |
| ACC-17 | 🟠 | 1,8 | Canlı geçiş zamanı `date-fns format(new Date(...))` ile tarayıcı saat diliminde gösteriliyor; ziyaretçi bitiş zamanı açıkça İstanbul. Türkiye dışındaki operatör aynı anı iki ekranda farklı saatle görür. | `src/components/access-control/CardReadingsTable.tsx:109`, `src/components/visitors/visitorTime.ts:37` | Ortak İstanbul zaman biçimleyicisi ve görünür “TR saati” etiketi; tarih filtresi ACC-10 ile aynı sözleşme. | S |

### 3.3 Ziyaretçiler — kayıt, kart, bölge, durum ve çıkış

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ACC-18 | 🔴 | 1 | **“Şu an binada” fiziksel konumu yanlış anlatıyor.** Son okumanın izin/ret durumu kontrol edilmiyor; reddedilen giriş içeride, reddedilen çıkış dışarıda sayılır. İçerideyken süresi dolup pasifleşen kişi de listeden/sayaçtan düşer. Son okuma `by_employee` creation sırasındadır, olay zamanına göre değildir. | `convex/visitors.ts:127`, `convex/visitors.ts:146`, `src/types/visitor.ts:13`, `src/components/visitors/VisitorStats.tsx:15` | Yetki durumunu fiziksel varlıktan ayır; son **başarılı** yönlü olayın olay zamanı üzerinden içeride/dışarıda/bilinmiyor üret. İptal/süre dolumu çıkış sayılmamalı; manuel çıkış ayrıca izlenmeli. | L |
| ACC-19 | 🔴 | 1,3 | **Kart yakalama tek seferlik değil.** İlk okumada “Kart okundu” yazsa da query açık kalıyor; başka numara geldiğinde tekrar `onCapture` çalışıyor. Formdaki kart habersiz değişebilir; kayıt okuyucusu hatırlandığında düzenleme açılışında da otomatik dinleme başlıyor. | `src/components/visitors/VisitorCardCapture.tsx:44`, `src/components/visitors/VisitorCardCapture.tsx:50`, `src/components/visitors/VisitorFormFields.tsx:127` | İlk kartta dinlemeyi kilitle; yalnız açık “Yeniden oku” ile yeni oturum başlat. Kart değiştirirken eski/yeni numarayı onaylat; düzenleme ekranında dinleme kullanıcı eylemiyle başlasın. | M |
| ACC-20 | 🟠 | 1,4 | Telefon/şirket/amaç/not temizlenip kaydedilince boş değer `undefined` olur; backend bu alanları güncellemez, eski veri geri gelir. Ev sahibi seçimini temizleyecek seçenek de yok; null silme sözleşmesi desteklenmiyor. | `src/components/visitors/hooks/useVisitorFormSubmit.ts:71`, `convex/visitors.ts:317`, `src/components/visitors/VisitorFormFields.tsx:112` | Metinlerde açık boş string, ilişkide açık null/temizle sözleşmesi; “değişmedi” ile “silindi” ayrılmalı. Ev sahibi için “Seçilmedi” seçeneği. | M |
| ACC-21 | 🟠 | 1,4,7 | Form `noValidate`; Zod bölge ve bitiş hatası üretiyor ama bu iki alanda `FieldError` yok, submit sessiz kalıyor. Bölge başlangıçta null olduğundan z.string tip hatası Türkçe min mesajına da ulaşmaz. Ad/soyad boşlukla geçiyor, bitiş yalnız boş olmama kontrolü; geçmiş tarih kabul ediliyor. | `src/components/visitors/VisitorForm.tsx:25`, `src/components/visitors/VisitorForm.tsx:40`, `src/components/visitors/hooks/useVisitorFormSchema.ts:4`, `src/components/visitors/VisitorFormFields.tsx:143`, `src/components/visitors/VisitorFormFields.tsx:175`, `convex/visitors.ts:236` | Şemada trim, nullable seçim için Türkçe required, geçerli/gelecek tarih kontrolü; her hatayı alanla bağla ve ilk hataya odaklan. Backend aynı kuralları uygulasın. | M |
| ACC-22 | 🟠 | 2,8 | Bölge bulunmayınca form “Erişim Yönetimi'nde hedef türü Ziyaretçi kuralı oluşturun” diyor; genel formda hedef türü seçimi yok. Gerçek “Bölge Ekle” yalnız liste başlığında; kullanıcı doldurduğu formdan çıkmak zorunda. | `src/components/visitors/VisitorFormFields.tsx:166`, `src/components/access-control/unified/CreateRuleDialog.tsx:33`, `src/components/visitors/VisitorFilters.tsx:79` | Formda “Ziyaretçi erişim bölgesi oluştur” bağlantısı; taslağı koruyarak oluştur, dönüşte yeni bölgeyi seç. Fiziksel bölgeyle terimi ayır. | M |
| ACC-23 | 🟠 | 1,3,8 | “Bu zamandan sonra erişim otomatik iptal edilir” kesinliği ile beş dakikalık expire cron'u/senkronizasyon kuyruğu farklı. Etiket ve aktif sayısı bitiş zamanına değil `isActive`'e bakıyor; bitiş geçtiğinde hâlâ Aktif görünebilir. Cihazın o anda fiilen geçiş vermesi **(doğrulanmadı)**. | `src/components/visitors/VisitorFormFields.tsx:184`, `convex/crons.ts:68`, `convex/visitors.ts:434`, `src/types/visitor.ts:21` | UI'da süresi doldu + cihaz iptali bekliyor ayrımı; süreyi aşan kayda yeni izin verme. Kesin saatli cihaz iptali gereksinimini donanım sözleşmesiyle doğrula; yalnız cron hızını değiştirmekle tamamlandı sayma. | L |
| ACC-24 | 🟠 | 2,3 | Çıkış tek ikon tıkıyla `isActive=false` yapıp erişimi geri alıyor; isim/sonuç onayı yok. Kart iadesi ayrı ve yalnız pasifte görünür, pending yok; silme onayı isim içermez ve silinirken kilitlenmez. “Çıkış yaptı” fiziksel olayı kesinleştiriyor, işlem aslında manuel erişim iptali. | `src/components/visitors/VisitorTable.tsx:75`, `src/components/visitors/VisitorTable.tsx:153`, `src/components/visitors/VisitorTable.tsx:165`, `src/components/visitors/VisitorTable.tsx:213`, `convex/visitors.ts:376` | İsimli “Ziyareti sonlandır” onayı, erişim iptali ve fiziksel kart iadesini ayrı seçenekler; satır bazında pending/hata. Fiziksel çıkış beyanını açık işaretle. | M |
| ACC-25 | 🟠 | 3 | Ziyaretçi kaydı sonrası doğrudan sync action exception'ları sessizce yutuluyor; panel kapanıp başarı kalıyor. Global sync banner mevcut, fakat action çağrısının hata vermesi veya kayıt bazında hangi cihazın beklediği formda açıklanmıyor. Backend zaten sync schedule ederken frontend tekrar action çağırıyor. | `src/components/visitors/hooks/useVisitorFormSubmit.ts:82`, `src/components/visitors/hooks/useVisitorFormSubmit.ts:98`, `convex/visitors.ts:251`, `src/pages/Visitors.tsx:7` | Kaydetme ve cihaza uygulamayı ayrı sonuçlar göster; tek sync başlatma sahibi; ziyaretçi satırından kalıcı işlem durumuna/yeniden denemeye erişim. Genel banner'ı yokmuş gibi yeniden kurma. | M |
| ACC-26 | 🟠 | 2 | Ziyaretçinin erişim bölgesi düzenlemede kilitli; farklı bölge için yeni ziyaretçi isteniyor. Aktif kart yeni kayıtta çakışır; operatör çıkış/kart iadesi/yeni kayıt döngüsüne zorlanır. | `src/components/visitors/VisitorFormFields.tsx:149`, `src/components/visitors/VisitorFormFields.tsx:164`, `convex/visitors.ts:196`, `convex/visitors.ts:269` | Aynı ziyaret kaydında bölge değişimi; eski yetkiyi kaldırıp yenisini tanımlayan atomik mutasyon ve sync sonucu; geçmiş kayıt korunmalı. | L |
| ACC-27 | 🟡 | 2 | İstenen “kart/QR verme” işinin QR kolu bu modülde yok: kart alanı zorunlu, kayıt sonrasında QR göster/indir/iptal eylemi bulunmuyor. Sistem genelindeki QR uyumluluğu **(doğrulanmadı)**; mevcut buton hatası değil ürün yeteneği boşluğu. | `src/components/visitors/hooks/useVisitorFormSchema.ts:6`, `src/components/visitors/VisitorFormFields.tsx:130`, `src/components/visitors/VisitorTable.tsx:152` | Önce desteklenen okuyucu ve geçici kimlik sözleşmesini belirle; sonra Kart/QR tercihi, süresi sınırlı credential, göster/iptal akışı. Donanım desteklemiyorsa kullanılabilir seçenek olarak sunma. | L |
| ACC-28 | 🟠 | 9 | Ziyaretçi listesi bütün ziyaretçileri collect edip proje filtresini sonra uygular; kişi başına ev sahibi/kural/son okuma/rıza sorguları çalışır. UI tüm satırları render eder, arama yereldir; ziyaret geçmişi büyüdükçe liste ve sayaçlar birlikte ağırlaşır. | `convex/visitors.ts:112`, `convex/visitors.ts:123`, `convex/visitors.ts:133`, `src/components/visitors/VisitorTable.tsx:115`, `src/components/visitors/VisitorManagement.tsx:19` | Proje/durum/tarih indeksli sayfalama; özet istatistikler ayrı sınırlı sorgu; son başarılı geçiş özeti ve rıza ayrıntısı ihtiyaca göre. Gerçek latency ölçülmedi. | L |
| ACC-29 | 🟠 | 1,8 | İade edilmiş kart listede gizleniyor ama düzenleme formuna `IADE:<kart>:<id>` ham sentinel taşınıyor. “Erişim aktif” tekrar açılabilir; geçerli yeni kart istemeden kayıt aktifleşir ve teknik değer kart numarası olarak tutulur. | `src/components/visitors/VisitorTable.tsx:139`, `src/components/visitors/hooks/useVisitorFormData.ts:73`, `src/components/visitors/VisitorFormFields.tsx:199`, `convex/visitors.ts:411`, `convex/visitors.ts:324` | Kart iadesini ayrı veri durumu olarak modelle; formda ham sentinel gösterme. Yeniden aktivasyon için yeni/geçerli kart ve bitiş zamanı doğrula. | M |

### 3.4 Ortak durumlar, proje bağlamı, görsel dil ve form davranışı

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ACC-30 | 🔴 | 1,2 | **Aktif proje ile ekran kapsamı ayrışıyor.** Context'teki `projectIds` tüm yetkili projeler; canlı okuma ve ziyaretçi backend'i aktif proje parametresini uygulamıyor. Kural/cihaz seçimi aktif projedeyken personel ve ziyaretçi bölgesi seçenekleri tüm yetkili projelerden gelebiliyor. Ziyaretçi create, seçilen kuralın projesiyle `args.projectId` eşitliğini kontrol etmeden üyelik yazıyor. Bu yetkisiz veri sızıntısı iddiası değil, yetkili projeler arasında yanlış kapsam/kayıt riski. | `src/contexts/ActiveProjectContext.tsx:82`, `src/hooks/useProjectFilteredCardReadings.ts:21`, `convex/cardReadings.ts:92`, `convex/visitors.ts:118`, `src/components/visitors/hooks/useVisitorFormData.ts:48`, `convex/visitors.ts:227`, `convex/visitors.ts:247` | Tek açık aktif proje kapsamı; sunucu rol yetkisiyle kesişim. Kişi/kural/kapı/ev sahibi ilişkileri aynı projede doğrulansın; tüm projeler görünümü varsa ayrı açık seçim olsun. | L |
| ACC-31 | 🟠 | 3,9 | Sayfa/form seçenekleri undefined iken tam içerik spinner'a dönüyor; canlı arama her tuşta sorgu değiştiriyor. Hook'lar `error:null` döndürdüğünden yerel hata panelleri query exception'ını yakalamıyor; üst seviye ErrorBoundary tüm uygulamayı değiştirebilir. Proje erişimi olmayan boş liste “veri yok”tan ayrılmıyor. | `src/pages/AccessControl.tsx:14`, `src/components/access-control/CardReadings.tsx:33`, `src/hooks/useProjectFilteredCardReadings.ts:25`, `src/hooks/useProjectFilteredCardReadings.ts:38`, `src/hooks/access-rules/useAccessRulesQuery.ts:18`, `src/components/visitors/VisitorManagement.tsx:59`, `src/hooks/useVisitors.ts:16`, `src/App.tsx:88` | Başlık/filtreyi sabit tutan bölüm iskeleti, debounce ve önceki sonuç; sayfa/sorgu sınırında ErrorState; erişimsiz için AccessDenied, ilk kurulum/filtre boşluğu için ayrı EmptyState. | L |
| ACC-32 | 🟡 | 6,7 | Ziyaretçi tablo min-width 820px; yatay kaydırma var ama temel çıkış eylemi sağ uçta. Başlıkların iç eylem grupları wrap olmuyor; kural günleri 7×40px + aralıklarla dar diyaloga sığmayabilir. Ziyaretçi sheet'i en çok 512px iken viewport md olduğunda iç form iki kolona ayrılıyor. Görsel taşma **(doğrulanmadı)**, CSS kısıtları kesin. | `src/components/visitors/VisitorTable.tsx:94`, `src/components/visitors/VisitorFilters.tsx:62`, `src/components/access-control/CardReadingsFilters.tsx:77`, `src/components/access-control/unified/components/TimeSchedule.tsx:48`, `src/components/visitors/VisitorFormFields.tsx:42`, `src/components/ui/sheet.tsx:59` | Mobil kişi/olay kartı, görünür ana eylem, wrap; panel genişliğine göre tek kolon; 320/375/768px ve %200 zoom kontrolü. | M |
| ACC-33 | 🟡 | 5,7,8 | Kural detayında `bg-blue-50/bg-green-50`, ağaçlarda sabit renkler; boş/hata halinde emoji; standart sonner yerine legacy toast; “Cihazlara Push Et” ve “Push başarısız” teknik dil. Arama input'ları yalnız placeholder ile adlandırılıyor. | `src/components/access-control/unified/AccessRulesList.tsx:150`, `src/components/access-control/unified/AccessRulesList.tsx:255`, `src/components/access-control/unified/AccessRulesList.tsx:402`, `src/components/visitors/VisitorCardCapture.tsx:101`, `src/components/visitors/VisitorFilters.tsx:53`, `src/components/visitors/VisitorTable.tsx:28`, `src/index.css:158` | Shared EmptyState/ErrorState, lucide, semantik status tokenları; “Cihazlara gönder” ve “Personel” terminolojisi; input erişilebilir adları. Toast taşımasını uygulama düzeyindeki sonner sahibiyle koordine et. | M |
| ACC-34 | 🟡 | 3,4 | Kural diyalogu ve ziyaretçi sheet'i dışarı tıklama/Escape/İptal ile dirty kontrolsüz kapanıyor; yeniden açıldığında form sıfırlanıyor. İşlem sürerken de kapanabilir. Ziyaretçi bölge diyalogunda tersine iptal edilen taslak state'te kalıyor; davranış tutarsız. | `src/components/access-control/unified/CreateRuleDialog.tsx:25`, `src/components/access-control/unified/hooks/useRuleForm.ts:47`, `src/components/visitors/VisitorSlideOverPanel.tsx:22`, `src/components/visitors/VisitorZoneDialog.tsx:52`, `src/components/visitors/VisitorZoneDialog.tsx:94` | Ortak dirty/pending kapanış politikası; kaydedilmemiş değişiklik onayı ve taslak koruma. Yeni kayıt açıldığında eski iptal taslağının kullanılacağı açık olsun. | M |

### 3.5 Kapsam klasöründeki fiziksel bölge/kapı/okuyucu yönetimi

Bu yüzeyler `/devices` içinde kullanılır; aşağıdaki işler cihaz audit planıyla birleştirilerek tek worker'a verilmelidir.

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ACC-35 | 🟠 | 1,3 | Ağaçtaki bölge/kapı/okuyucu silme düğmeleri doğrudan mutation çağırıyor; onay ve pending yok. Kapı silme okuyucuları da siler. Bölge doluysa backend engelliyor, boş bölge için de UI sonuç açıklaması yok. | `src/components/access-control/ZoneDoorTree.tsx:183`, `src/components/access-control/ZoneDoorTree.tsx:357`, `src/components/access-control/ZoneDoorTree.tsx:456`, `src/components/access-control/ZoneDoorTree.tsx:545`, `convex/doors.ts:274`, `convex/zones.ts:78` | Nesne adı, etkilenen okuyucu sayısı ve erişim etkisini içeren onay; işlem kilidi; bağımlılığı olan bölge için taşıma bağlantısı. | M |
| ACC-36 | 🟠 | 1,2 | Okuyucunun mevcut kapısında ad/yön/sensör düzenleme yolu yok: `EditReaderDialog` tüketilmiyor, ağaç yalnız taşı/ayar oku/sil sunuyor. Kapı editörü bu alanları sunmuyor. Yanlış yönü düzeltmek için taşıma veya silip ekleme gerekir. | `src/components/access-control/EditReaderDialog.tsx:35`, `src/components/access-control/ZoneDoorTree.tsx:310`, `src/components/access-control/ZoneDoorTree.tsx:639`, `src/components/access-control/EditDoorDialog.tsx:256` | Ağaçta “Okuyucuyu düzenle” eylemi; mevcut okuyucu ID'siyle çalışan editor. Kapı sensörü kapıya ait olduğundan ayrı bölümde tek sahiplik; kısmi iki mutasyon hatasını görünür yönet. | M |
| ACC-37 | 🟡 | 6,7,9 | Okuyucu eylemleri sadece hover'da görünür, focus-within yok ve 20px. Katlanan alt ağaçlar yalnız max-height/opacity ile gizleniyor; butonlar DOM'da kaldığından gizli odak hedefleri oluşur. Açık ağaç 1500/2000px ile kesiliyor; büyük ağaçta son kapılar kaybolabilir. | `src/components/access-control/ZoneDoorTree.tsx:314`, `src/components/access-control/ZoneDoorTree.tsx:552`, `src/components/access-control/ZoneDoorTree.tsx:587`, `src/components/access-control/ZoneDoorTreePanel.tsx:42` | Gerçek hidden/unmount veya erişilebilir Collapsible; sınırsız yükseklik yerine kontrollü scroll; dokunmada görünür menü ve focus-within; proje başlığını button yap. | M |
| ACC-38 | 🟠 | 3,4 | Kapı ayarı DB'ye yazıldıktan sonra planlardan biri cihaza uygulanamazsa hata toast'ı atılıp diyalog yine kapanır. Kaydedilen ve cihazdaki değerler ayrılmaz, tekrar deneme yok; zaman planı input ve switch'lerinde label bağı eksik. | `src/components/access-control/EditDoorDialog.tsx:185`, `src/components/access-control/EditDoorDialog.tsx:211`, `src/components/access-control/EditDoorDialog.tsx:232`, `src/components/access-control/EditDoorDialog.tsx:318`, `src/components/access-control/EditDoorDialog.tsx:327` | “Kaydedildi / cihaza uygulanamadı” kalıcı sonuç; başarısız planı tekrar gönder, kullanıcıyı diyalogda tut veya iş kaydına götür. Alan/switch adlarını bağla, saat aralığını doğrula. | M |
| ACC-39 | 🟡 | 1,4 | Okuyucu taşıma ilk uygun kapıyı otomatik seçip mevcut yönü hedefin okuyucu sayısına göre değiştiriyor. Hedefte yalnız çıkış varsa da yeni yön çıkış olur; “taşı” eylemi beklenmeyen yön değişikliği yapar. | `src/components/access-control/MoveReaderDialog.tsx:37`, `src/components/access-control/MoveReaderDialog.tsx:63`, `src/components/access-control/MoveReaderDialog.tsx:73` | Hedefi açık seçtir, mevcut yönü koru veya hedefteki gerçek yönlere göre öner; önce/sonra özetinde yön değişikliğini göster. | S |

### Kanıt kontrolü ve sınırlar

- DB kullanmadan yerel Node hesabı: `TZ=Europe/Istanbul`, `new Date(2026,9,16).toISOString().split("T")[0]` sonucu `2026-10-15`; ACC-10 doğrudan yeniden üretildi.
- ACC-11 algoritma örneği: 1000 kayıt, 501. kayıtta tek arama eşleşmesi, sayfa boyu 100 → ilk 300'lük taramada UI toplamı 300, eşleşme 0; gerçek eşleşme 1. Bu sorgu mantığı canlandırmasıdır, canlı veri testi değildir.
- Cihaz uygulama/ACK süresi, fiziksel kapıdan geçiş, QR donanım uyumluluğu, mobil viewport ve gerçek kontrast ölçülmedi. Kaynakta eksik fallback doğrulandı; gerçek veri içinde kaç eksik yön/durum bulunduğu bilinmiyor.
- `CardReading` yerel tipi, kullanılmayan Zod şeması ve `targetType` cast'i yalnız somut kullanıcı etkileriyle raporlandı; sırf stil/type ihlali için ayrı kota doldurulmadı. PDKS kayıtları kapsam dışı tutuldu.

## 4. Hedef tasarım

### Geçiş Kontrol — liste ve yetki formu

```text
Geçiş Kontrol                         Proje: Merkez       [+ Yeni kural]
[Kişi, kural veya kapı ara]  [Tür] [Aktif/Pasif]  [Cihaz işlemleri]
Kural           Kişiler       Kapılar             Zaman          Durum
Ofis gündüz     24 personel    Lobi giriş, Kat 1   Pzt–Cum 09–18  Uygulandı
Ziyaretçi lobi  Şablon         Lobi giriş          Her gün        Bekliyor
                                      [Ayrıntı] [Düzenle] [Diğer]

Yeni/Düzenle: Kural adı                   Kaydedilmemiş değişiklikler
Kim?  [Personel ara] [Seçili 24]           Nerede? [Kapı ara] [Seçili 2]
[ ] Departman (mevcut kişiler)            [-] Merkez / Panel A
    [x] Ayşe                                 [x] Lobi giriş
                                             [ ] Depo
Ne zaman? [Tüm gün / Saat aralığı] [Günler]   TR saati
Özet: 24 personel → 2 kapı → Pzt–Cum 09:00–18:00
                                      [Vazgeç] [Kaydet ve uygula]
```

1. Kural türü personel yetkisi/ziyaretçi şablonu olarak açık; aynı editör ziyaretçi üyeliğini değiştirmez.
2. Kişi ve gerçek kapı kapsamı görünür; kısmi seçim ile tüm kapsam aynı görünmez.
3. Saatin kaldırılması, gece planı ve gün seçimi açık sözleşmedir; özet sunucudan geri okunan veriyi yansıtır.
4. Kaydetme tek işlem; kayıt durumu ve cihaz uygulama durumu ayrı, kalıcıdır.
5. Arama ve sayfalama veri büyüdüğünde de çalışır; uzun ilişkiler yalnız ayrıntıda yüklenir.

### Canlı İzleme — canlı akış / geçmiş / olay ayrıntısı

```text
Canlı İzleme       Proje: Merkez       [Canlı | Geçmiş]    TR saati
[Bağlı · Son olay 14:32:08]             [Görüntüyü durdur]
[Kişi/kart ara] [Kapı] [İzin/Ret/Bilinmiyor] [Tarih: 16 Eki]
                          [Yeni 8 kaydı göster]
Saat       Kişi          Kapı        Yön       Sonuç / Sebep
14:32:08   Ayşe          Lobi        Giriş     Ret · Saat dışında [Detay]
14:31:56   Kart ...123   Kat 1       Bilinmiyor  Karar bilinmiyor

Olay detayı: kişi/kart · kapı · olay zamanı · kararın kaynağı
Ret: Saat aralığı dışında          [İlgili kuralı aç]
[Teknik ayrıntılar]                 [Önceki / Sonraki]
```

1. Canlı ve geçmiş ayrı modlar; canlı akış kullanıcı satır incelerken odağı kaydırmaz.
2. Tarih date-only, saat İstanbul; UI ile backend aynı gün ve proje kapsamını kullanır.
3. Bilinmeyen bilgi kesin giriş veya ret gibi gösterilmez; ret sebebi ilk satırda anlaşılır.
4. Cursor sayfalama ve gerçek filtre kapsamı; kesin olmayan toplam kesin sayı gibi sunulmaz.

### Ziyaretçiler — liste ve ziyaret kaydı

```text
Ziyaretçiler       Proje: Merkez      [Erişim bölgeleri] [+ Yeni ziyaret]
[Kişi/şirket/kart ara] [İçeride] [Yetki durumu] [Tarih]    [Filtreyi temizle]
İçeride 8 · Konumu bilinmiyor 2 · Erişimi süren 12 · İptali bekleyen 1
Kişi       Ev sahibi   Erişim bölgesi   Bitiş(TR)   Konum / Yetki   [İşlemler]
Ayşe       Mehmet      Lobi            18:00      İçeride / Aktif
Fatma      Elif        Lobi            14:00      İçeride / Süresi doldu

Yeni ziyaret [tek kolon, bölümler]
1 Kişi       Ad* / Soyad* / Şirket / Ev sahibi [Ara, seç, temizle]
2 Yetki      Erişim bölgesi* [Ara] [+ Oluştur]  Kapılar ve saat özeti
             Bitiş* [Bugün 18:00 / +8 saat / Özel]   TR saati
3 Kimlik     [Fiziksel kart | QR (destekleniyorsa)]
             [Kart oku] → Kart ...123 yakalandı [Değiştir]
4 Not / bilgilendirme durumu
                         [Taslağı bırak] [Ziyareti kaydet]
Sonuç: Kayıt tamamlandı · 2 cihaz uyguladı, 1 bekliyor [Ayrıntı]

Ziyareti sonlandır: Ayşe Yılmaz
[ ] Fiziksel çıkışı teyit ediyorum     [ ] Kart teslim alındı
Erişim iptali cihazlara gönderilecek.  [Vazgeç] [Sonlandır]
```

1. Fiziksel konum, ziyaret yaşam döngüsü, kart iadesi ve erişim izni ayrı bilgiler olarak sunulur.
2. Kart yakalama tek oturum ve tek değer; kayıt düzenleme kendiliğinden kart dinlemez.
3. Bölge yokluğu taslak kaybettirmez; aynı ziyaretin bölgesi güvenli biçimde değiştirilebilir.
4. Hatalar alan altında, kaydetme durumu sabit footer'da; başarı cihaz sonucunu da açıklar.
5. QR yalnız destek doğrulandıktan sonra etkinleşir; paylaşılabilir kalıcı kart numarası QR diye sunulmaz.

### Fiziksel bölge/kapı/okuyucu — ortak cihaz yüzeyi

```text
Konumlar [Ara] [+ Bölge]
v Merkez
  v Panel A
    Lobi [Kapı ayarları] [Diğer]
      Giriş okuyucu · Giriş · Son olay 14:32 · Durum açıklaması [Diğer]
      [Diğer → Düzenle / Taşı / Sil]

Okuyucu düzenle: Ad / Yön             [İptal] [Kaydet]
Taşı: Kaynak kapı → [Hedef seç]  Yön: Giriş → Giriş
Kapı planı: [Temel] [Zaman planları]
Kaydedildi · Durum planı uygulanamadı [Tekrar gönder]
Silme: Lobi ve 2 okuyucu kaldırılacak [Vazgeç] [Sil]
```

1. Cihaz mühendisliği seçenekleri ayrı ayrıntıda; gündelik operatör gerçek kapı/okuyucu adını görür.
2. Mobil ve klavyede aynı işlemler görünür; kapalı ağaç odaklanamaz ve yükseklikle içerik kesilmez.
3. Taşıma yönü sessizce değiştirmez; yıkıcı işlemler isim ve etkiyi açıklar.
4. DB kaydı ile cihaz planı sonucu ayrılır; tekrar deneme mevcut kaydı çoğaltmaz.

## 5. Fazlar

Süreler tek implementasyon worker'ının yaklaşık kişi-günüdür; cihaz/entegrasyon doğrulaması dahil tahminlerdir, üretim gecikme ölçümü değildir. Aşağıdaki OWNERSHIP listeleri **ilerideki implementasyon için**; bu audit sadece bu raporu yazar. Aynı dosyayı kullanan paketler ardışık atanmalı; ortak UI ve cihaz yüzeyleri koordinatör tarafından tek sahibine bağlanmalı. Backend işlerinde önce `convex/_generated/ai/guidelines.md` okunmalı; API değişikliği diğer tüketicileri korumalı.

### UX-0 — Veri doğruluğu ve kırık akışlar (yaklaşık 6–8 kişi-gün)

**0A — Yetki formu kayıt sözleşmesi (1–1,5 gün, backend).** ACC-01, ACC-02, ACC-03, ACC-04, ACC-09.

- OWNERSHIP: `src/components/access-control/unified/hooks/useRuleForm.ts`, `src/components/access-control/unified/hooks/useAccessRuleSchema.ts`, `src/components/access-control/unified/CreateRuleDialog.tsx`, `src/components/access-control/unified/UnifiedAccessControl.tsx`, `src/components/access-control/unified/AccessRulesList.tsx`, `src/components/access-control/unified/components/TimeSchedule.tsx`, `src/components/visitors/VisitorZoneDialog.tsx`, `src/hooks/access-rules/useComplexAccessRuleMutations.ts`, `src/hooks/access-rules/useAccessRuleMutations.ts`, `convex/accessRules.ts`; yeni hedefli test `convex/accessRules.ux.test.ts`.
- Teslim: gerçek pending; açık saat temizleme; kullanılan şema; türüne göre ziyaretçi şablonu düzenleme; sıfır öncelik korunması.
- Kabul: çift submit tek kayıt; 09–18 → tüm gün yeniden açıldığında boş saatler; boş gün/tek saat açık hata; sıfır üyeli ziyaretçi bölgesi güncellenebilir; mevcut ziyaretçi üyeleri aynen kalır; priority 0 yalnız ad düzenlemede 0 kalır.

**0B — Aktif proje, tarih ve geçmiş doğruluğu (2–2,5 gün, backend).** ACC-10, ACC-11, ACC-13, ACC-17, ACC-30.

- OWNERSHIP: `src/hooks/useProjectFilteredCardReadings.ts`, `src/hooks/useVisitors.ts`, `src/hooks/useEmployees.ts`, `src/components/access-control/CardReadings.tsx`, `src/components/access-control/CardReadingsFilters.tsx`, `src/components/access-control/CardReadingsTable.tsx`, `src/components/visitors/hooks/useVisitorFormData.ts`, `convex/cardReadings.ts`, `convex/visitors.ts`, `convex/accessRules.ts`, `convex/employees.ts`, `convex/schema.ts`; gerekirse yeni `src/lib/accessTime.ts`, yeni `convex/accessScope.ux.test.ts`, `convex/cardReadings.list.ux.test.ts`.
- Teslim: sunucuda aktif proje ∩ izinli proje; ilişki eş-proje doğrulaması; date-only gün; TR zaman gösterimi; indeksli/cursor filtreleme ve dürüst toplam.
- Kabul: iki yetkili projesi olan kullanıcı A seçince A kişileri/kuralları/ziyaretçileri/okumaları görür; B ilişkisiyle A kaydı reddedilir; İstanbul ve UTC tarayıcıda aynı gün/saat; 5000'i aşan geçmişte aranan kayıt bulunur veya açık ürün sınırı gösterilir; eksik yön/karar “bilinmiyor”. `useEmployees` ortak tüketicileri için isteğe bağlı proje filtresi ile geriye uyum korunmalı.
- Bağımlılık: 0A ile `convex/accessRules.ts` çakışır; aynı worker veya sıralı teslim. `cardReadings.ts` mevcut kirli dosya olduğu için sahibinden güncel sürüm alınmadan değiştirilmemeli.

**0C — Ziyaretçi kimliği ve içeride durumu (2–3 gün, backend).** ACC-18, ACC-19, ACC-20, ACC-21, ACC-29.

- OWNERSHIP: `src/components/visitors/VisitorCardCapture.tsx`, `src/components/visitors/VisitorForm.tsx`, `src/components/visitors/VisitorFormFields.tsx`, `src/components/visitors/hooks/useVisitorFormData.ts`, `src/components/visitors/hooks/useVisitorFormSchema.ts`, `src/components/visitors/hooks/useVisitorFormSubmit.ts`, `src/types/visitor.ts`, `src/components/visitors/VisitorStats.tsx`, `src/components/visitors/VisitorTable.tsx`, `src/components/visitors/VisitorManagement.tsx`, `convex/visitors.ts`, `convex/schema.ts`; yeni `convex/visitors.ux.test.ts`, yeni `src/components/visitors/VisitorCardCapture.test.tsx`.
- Teslim: tek seferlik kart yakalama; boş alanları temizleme; tam Türkçe alan hataları; başarılı olaydan konum; iade kartıyla aktivasyon engeli. Veri modeli değişirse mevcut sentinel verisinin okunması için uyum yolu planlanmalı; migration bu audit kapsamında yapılmaz.
- Kabul: A kartı yakalandıktan sonra B okutulunca kayıt A kalır; edit dinlemeye kendiliğinden başlamaz; telefon/not silinip tekrar açılınca boş; boş bölge ve geçmiş bitişte görünür hata; reddedilen giriş/çıkış konumu değiştirmez; içerideyken süresi dolan içeride kalır; olaylar geç teslim edilirse `accessTime` sırası belirleyicidir.

**0D — Geri alınması güç işlemler ve kısmi sonuçlar (1 gün, frontend; cihaz sahibiyle).** ACC-24, ACC-25, ACC-35, ACC-38.

- OWNERSHIP: `src/components/visitors/VisitorTable.tsx`, `src/components/visitors/hooks/useVisitorFormSubmit.ts`, `src/components/access-control/ZoneDoorTree.tsx`, `src/components/access-control/EditDoorDialog.tsx`; mevcut sync şeridi yalnız tüketilir, backend mevcut API yeterliyse değiştirilmez.
- Kabul: isimli çıkış/silme onayı, işlem sırasında tekrar tıklama engeli, iptalde mutation yok; sync exception'ı görünür; kapı DB kaydı başarılı/plan uygulaması başarısız sonucu kalıcı ve tekrar denenebilir.

### UX-1 — Sadeleştirme, erişilebilirlik ve ölçek (yaklaşık 5–7 kişi-gün)

**1A — Kural arama ve kapsam özeti (1,5–2 gün, backend).** ACC-05, ACC-06, ACC-07, ACC-08.

- OWNERSHIP: `src/components/access-control/unified/AccessRulesList.tsx`, `src/components/access-control/unified/components/DepartmentTree.tsx`, `src/components/access-control/unified/components/ZoneDeviceTree.tsx`, `src/components/access-control/unified/components/selectionHelpers.ts`, `src/types/access-control.ts`, `src/hooks/access-rules/useAccessRulesQuery.ts`, `convex/accessRules.ts`; yeni `src/components/access-control/unified/AccessRuleDetails.tsx`.
- Kabul: tek kapı/tüm panel açıkça ayrılır; alt departman ve kısmi seçim doğru; kural/kişi/kapı aranır; büyük listede detay yalnız açıldığında gelir; tüm ikonlar erişilebilir adlı ve tek Collapsible çalışır.

**1B — Canlı olay okunabilirliği ve ortak durumlar (1,5–2 gün, frontend; ortak UI koordinasyonu).** ACC-12, ACC-14, ACC-16, ACC-31, ACC-32, ACC-33, ACC-34.

- OWNERSHIP: `src/pages/AccessControl.tsx`, `src/pages/LiveMonitoring.tsx`, `src/pages/Visitors.tsx`, `src/hooks/useProjectFilteredCardReadings.ts`, `src/components/access-control/CardReadings.tsx`, `src/components/access-control/CardReadingsFilters.tsx`, `src/components/access-control/CardReadingsTable.tsx`, `src/types/access-control.ts`, `src/components/access-control/unified/CreateRuleDialog.tsx`, `src/components/access-control/unified/AccessRulesList.tsx`, `src/components/access-control/unified/components/TimeSchedule.tsx`, `src/components/visitors/VisitorManagement.tsx`, `src/components/visitors/VisitorFilters.tsx`, `src/components/visitors/VisitorTable.tsx`, `src/components/visitors/VisitorFormFields.tsx`, `src/components/visitors/VisitorSlideOverPanel.tsx`, `src/components/visitors/VisitorZoneDialog.tsx`, `src/components/visitors/VisitorCardCapture.tsx`; yeni `src/components/access-control/ReadingDetailPanel.tsx`.
- Ortak altyapı adayları: yeni `src/components/shared/UnsavedChangesDialog.tsx`, yeni `src/components/shared/QuerySectionBoundary.tsx`; bunları ortak bileşen sahibi oluşturduktan sonra tüket. Sonner kurulumu/Toaster değişimi bu worker'ın kapsamını aşar; `src/App.tsx` değişikliğini ortak sahibi yapsın, ardından modül toast import'ları taşınsın.
- Kabul: ret sebebi veya “neden bilinmiyor”; sahte yenileme yok; URL geri/yenileme durumunu korur; hata yalnız ilgili bölümü kapatır; filtre yazarken odak korunur; boş/erişimsiz/filtre sonucu yok ayrılır; 320–768px, dark mode, klavye ve %200 zoom; dirty kapanış onayı. Kaydetme başarı/hata fixture'larıyla doğrulanmalı.

**1C — Ziyaretçi liste/kurulum ve süresi dolan erişim (1,5–2 gün, backend).** ACC-22, ACC-23, ACC-28.

- OWNERSHIP: `src/components/visitors/VisitorManagement.tsx`, `src/components/visitors/VisitorForm.tsx`, `src/components/visitors/VisitorFormFields.tsx`, `src/components/visitors/VisitorZoneDialog.tsx`, `src/components/visitors/VisitorStats.tsx`, `src/components/visitors/VisitorTable.tsx`, `src/types/visitor.ts`, `src/hooks/useVisitors.ts`, `convex/visitors.ts`, `convex/schema.ts`. Kesin cihaz bitişi gerekiyorsa ayrıca `convex/crons.ts`, `convex/actions/hikvisionSync.ts`, `convex/actions/ideGatewayDevice.ts` sahipleriyle entegrasyon görevi açılmalı.
- Kabul: bölge oluşturmaya gidip dönünce ziyaret taslağı korunur ve yeni bölge seçilir; sayfalı listede filtre gerçek kapsamda, sayaçlar aynı projede; bitiş anından sonra aktif etiketi kalmaz ve cihaz iptali bekleme durumu görünür. Gerçek cihaz iptal garantisi donanım testinden geçmeden kesin ifade kullanılmaz.

**1D — Ağaç/okuyucu iş akışı (yarım–1 gün, frontend; cihaz worker'ı).** ACC-36, ACC-37, ACC-39.

- OWNERSHIP: `src/components/access-control/ZoneDoorTree.tsx`, `src/components/access-control/ZoneDoorTreePanel.tsx`, `src/components/access-control/EditReaderDialog.tsx`, `src/components/access-control/MoveReaderDialog.tsx`.
- Kabul: yerinde okuyucu adı/yönü düzenlenir; taşıma yönü korunur; hover gerekmeksizin tüm eylemler bulunur; kapalı ağaçta tab odağı yok; 2000px'i geçen içerik kesilmez. Backend yön/kapı güncellemesi için mevcut mutasyonlar kullanılır, cihaz eşleşmesi ayrıca regresyonla kontrol edilir.

### UX-2 — Yeni yetenekler (yaklaşık 5–8+ kişi-gün; donanım kapsamına bağlı)

**2A — Operatör canlı izleme modu (1–2 gün, backend).** ACC-15; ACC-11 cursor altyapısından sonra.

- OWNERSHIP: `src/pages/LiveMonitoring.tsx`, `src/components/access-control/CardReadings.tsx`, `src/components/access-control/CardReadingsFilters.tsx`, `src/hooks/useProjectFilteredCardReadings.ts`, `convex/cardReadings.ts`; yeni `src/components/access-control/LiveFeedControls.tsx`.
- Kabul: görüntü durduğunda satırlar sabit kalır, yeni olay sayacı artar; devamda olaylar eksiksiz gelir; geçmiş sayfada yeni kayıt gelmesi satır tekrarına/atlamasına yol açmaz.

**2B — Ziyaret bölgesi değişimi (1–2 gün, backend).** ACC-26; 0C ve 1C tamamlandıktan sonra.

- OWNERSHIP: `src/components/visitors/VisitorFormFields.tsx`, `src/components/visitors/hooks/useVisitorFormSubmit.ts`, `convex/visitors.ts`, `convex/visitors.ux.test.ts`; mevcut accessGraph reconcile yardımcıları tüketilir.
- Kabul: aynı ziyaret/kart korunur; eski kapı yetkisi kaldırılır, yeni bölge uygulanır; yanlış projeye geçiş reddedilir; kısmi cihaz hatası açıkça izlenir.

**2C — QR ziyaretçi kimliği (2–4+ gün, backend; destek kararı önkoşulu).** ACC-27.

- OWNERSHIP: `src/components/visitors/VisitorFormFields.tsx`, `src/components/visitors/VisitorTable.tsx`, `src/components/visitors/hooks/useVisitorFormSchema.ts`, `src/components/visitors/hooks/useVisitorFormSubmit.ts`; yeni `src/components/visitors/VisitorCredentialPanel.tsx`, yeni `convex/visitorCredentials.ts`, `convex/schema.ts`. Okuyucu doğrulama entegrasyon dosyaları donanım yetenek incelemesinden sonra ayrıca atanmalı; bu paket doğrulanmadan cihaz action'larını değiştirme yetkisi vermez.
- Kabul: destekli okuyucuda süresi sınırlı QR üretme/gösterme/iptal etme, ziyaret ve proje bağı; desteklenmeyende açık gerekçe; süresi biten/iptal edilen QR geçmez. Sistem desteği bilinmediğinden bu paket koşullu yeni ürün işi olarak tutulur.

Dinamik departman üyeliği ACC-06 için ek adaydır; ilk faz yalnız açık “mevcut kişiler” seçim sözleşmesi sağlar. Gerçek dinamik grup istenirse yeni üyelik modeli ve üyelik değişikliği sync'i ayrı kapsamlandırılmalıdır.

### Implementasyon doğrulama kapıları

1. Hata senaryoları hedefli komponent testleri ve `convex-test` ile yerel fixture'larda doğrulansın; canlı DB gerekmiyor.
2. Kaynak kod implementasyonu sonunda `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/eslint src convex`; TS hata ve `no-explicit-any` 0. Bu salt rapor değişikliğinde uygulama testleri/lint çalıştırılmadı.
3. UI implementasyonunda klavye, dar ekran, dark mode, loading/error/empty ve cihazda kısmi başarısızlık senaryoları ayrıca gözden geçirilsin. Sadece mutasyonun başarılı dönmesi fiziksel kapı yetkisinin uygulandığını kanıtlamaz.

## 6. Modüller arası adaylar

- **Proje kapsamı:** context'in tüm yetkili projeleriyle seçili proje kavramı farklı. Ortak query argümanı ve ilişki doğrulaması; ACC-30 başka liste/formlarda da aranmalı.
- **Mutasyon adaptörleri:** `isPending:false` ve boş refetch legacy dönüşlerinin diğer hook'lardaki tüketicileri incelenmeli; tek gerçek async state modeli.
- **İşlem sonucu:** kayıt tamamlandı / kuyrukta / cihaza uygulandı / kısmi hata sözlüğü ve kayıt bazında ayrıntı bağlantısı; mevcut SyncIssuesBanner ve DeviceSyncStatusBanner üzerine kurulmalı.
- **Zaman:** date-only anahtar, İstanbul an gösterimi ve süre sonu durumu ortaklaştırılmalı; PDKS worker'ıyla sözleşme paylaşılmalı, bu rapor PDKS koduna sahiplik vermez.
- **Form kabuğu:** dirty çıkış, ilk hataya odak, sabit footer, nullable temizleme ve FormFieldWrapper aynı davranış sağlamalı.
- **Liste/ağaç:** ortak arama, cursor sayfalama, mobil satır/kart, erişilebilir eylem menüsü; tek başına her şeyi yapan yeni bir dev bileşen yerine küçük parçalar.
- **Tasarım sistemi:** sonner geçişi uygulama düzeyinde tek sahibin işi; yerel renk/emoji/boş durum kopyaları mevcut shared bileşenlere taşınmalı. Eski kullanılmayan erişim bileşenleri yeniden bağlanmadan önce kaldır/onar kararı alınmalı.
