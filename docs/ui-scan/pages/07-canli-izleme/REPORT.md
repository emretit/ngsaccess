# 07 · Canlı İzleme

## Özet
Canlı İzleme seçili projenin erişim okumalarını, sonuçlarını ve olay ayrıntılarını operatöre sunar. En büyük üç sorun reaktif listeyi duraklatamama, ret nedeni ve doğrulama kaynağının gizlenmesi, bilinmeyen kart için inceleme/atama yolunun bulunmamasıdır. Öneri A2 ortak kabuğunda sakin ve sık bir olay tablosu, görüntüyü durdur/devam ettir kontrolü ve güvenli kart atama adımı içeren bir ayrıntı panelidir.

## Kapsam ve kaynak gerçeği
17.10.2026 çalışma ağacı, commit edilmemiş Dalga 3a dahil incelendi; uygulama kodu değiştirilmedi. `docs/ui-scan/current/07-canli-izleme.png`, `07-canli-izleme-2.png`, `07-canli-izleme-mobil.png`, `07-canli-izleme-mobil-2.png` açılıp incelendi. Mobil görseller 780 fiziksel piksel genişliğinde; 390 CSS piksel davranışı yeni mockup'ta ayrıca doğrulanır. Canlı uygulamaya giriş yapılmadı.

`DESIGN_DIRECTION.md`, A2 `home.html`/`people.html`, Ana Sayfa raporunun **Kabuk** sözleşmesi ve `convex/_generated/ai/guidelines.md` okundu. Mockup A2 CSS sınıflarını ve token'larını, 01 mockup'ındaki sözleşmeye uyarlanmış kabuk ve katman davranışlarını kullanır; kabuk yeniden tasarlanmaz. Kullanıcının “biyometrik olaylar PDKS değildir (KVKK 2026/921)” ifadesi ürün kısıtı olarak uygulanmıştır; burada hukuki kararın kapsamı hakkında yeni bir görüş veya uygunluk onayı verilmez.

### Önceki audit'ten kapananlar

| Önceki bulgu | Güncel kanıt / korunacak davranış |
|---|---|
| ACC-10, ACC-17 | `src/hooks/useCardReadings.ts:20` date-only yerel gün; `convex/lib/cardReadingList.ts:5` TR sınırları; `CardReadingsTable.tsx:15` açık Europe/Istanbul. Gün kayması ve tarayıcı saat dilimi sorunu yeniden açılmadı. |
| ACC-11'in yanlış toplam ve 5000 sınırı | `convex/cardReadings.ts:101` cursor paginate; `convex/lib/cardReadingList.ts:32` cihaz/sonuç/tarih index'leri; `CardReadingsFilters.tsx:23` yüklenen kayıt sayısı. Arama halen yerel fakat artık açıkça etiketli. |
| ACC-13 | `CardReadingsTable.tsx:31` bilinmeyen karar ve yön ayrı; yön nötr. Eksik değer artık giriş/ret gibi gösterilmiyor. |
| ACC-14'ün sahte yenilemesi | Güncel `CardReadings.tsx:23` ve filtre bileşeninde no-op yenileme yok. Canlı durum bilgisi eksikliği ayrı bulgu. |
| ACC-30'un liste kapsamı | `useProjectFilteredCardReadings.ts:2` ortak hook alias'ı; `useCardReadings.ts:10`, `:26` aktif proje, `cardReadings.ts:111` sunucu scope kontrolü. |
| ACC-12'nin tip kısmı | `CardReadingsTable.tsx:3` query dönüşünden tip türetiliyor; ret nedenini görünür kılma halen açık. |

## Mevcut durum taraması

Kaynak kısaltmaları: **UI** = `src/components/access-control/`, **H** = `src/hooks/`, **C** = `convex/`. Her satırdaki yollar bu öneklerle gerçek dosyalara karşılık gelir.

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| LIVE-UI-01 | Görsel hiyerarşi / mikro-metin | `src/pages/LiveMonitoring.tsx:4` yalnız liste; UI/CardReadingsFilters.tsx:21 “Kart Okutma Geçmişi”; ilk ekran üstü. Sayfa gövdesinde h1 ve proje kapsamı yok. | Orta | PageHeader “Canlı İzleme”, proje + İstanbul saati, Canlı/Geçmiş görünümü. |
| LIVE-UI-02 | AI arayüzü izi / bileşen tutarlılığı | UI/CardReadings.tsx:29 ve UI/CardReadingsFilters.tsx:17 ayrı rounded-xl gölgeli kartlar; başlıkta bordo ScanLine (:19). | Orta | Kartları kaldır; tek FilterBar, 1px çizgi ve 6px tablo kabı; A2 CSS. |
| LIVE-UI-03 | Durumlar / erişilebilirlik | H/useCardReadings.ts:23 reaktif results doğrudan tabloya; UI/CardReadingsTable.tsx:99 sıralı map; duraklatma/yeni kayıt kontrolü yok. Yoğun akışta odak ve incelenen satır yer değiştirebilir; canlı yük testi yapılmadı. | Yüksek | Görüntü snapshot'ı, durdur/devam, yeni kayıt tamponu; inceleme/scroll sırasında listeyi sabitle. |
| LIVE-UI-04 | Durumlar / mikro-metin | UI/CardReadingsFilters.tsx:22 yalnız yüklenen sayı; bağlantı ve son olay ayrımı yok. | Orta | Abonelik bağlantısını ayrı göster; “Son olay” cihaz olay zamanı, “son güncelleme” yerine kullanılmasın. Cihazın çevrimiçi olduğunu iddia etme. |
| LIVE-UI-05 | Yerleşim / tipografi | UI/CardReadingsTable.tsx:74–81 sekiz kolon, zaman üçüncü, departman dördüncü; ilk görselde yaklaşık 73px satırlar, ikinci görselde uzun kart kimliği iki satıra taşıyor. | Orta | Zaman → kişi/kart → kapı/cihaz → sonuç → kaynak → işlem; masaüstü 42px ritim, tabular-nums; departman ayrıntıda. |
| LIVE-UI-06 | Mikro-metin / form-diyalog | UI/CardReadingsTable.tsx:110 yalnız sonuç; C/schema.ts:478 hikDenialReason var, C/lib/cardReadingAudit.ts:80 ham alanları yayıyor. | Yüksek | Ret yanında kısa sebep; yoksa “Neden bilinmiyor”; ayrıntıda tam metin ve teknik kod. |
| LIVE-UI-07 | Form-diyalog | UI/CardReadingsTable.tsx:100–111 eylemsiz satır; olay ayrıntısı yok. | Yüksek | Adlandırılmış “Okuma ayrıntısı” eylemi; sabit _id ile panel, tam kart/kapı/yön/kaynak; odağı geri döndür. |
| LIVE-UI-08 | Form-diyalog / mikro-metin | UI/CardReadingsTable.tsx:101 “Bilinmeyen”, hiçbir takip eylemi yok. C/employees.ts:238 update adminMutation ve :281 kart çakışma kontrolü var. | Yüksek | “Kişi eşleşmedi”; uygun fiziksel kart olayında yetkili kullanıcıya “Kartı kişiye ata”; mevcut kartın üzerine yazmayı açıklaştır. |
| LIVE-UI-09 | Bileşen tutarlılığı / veri anlamı | UI/CardReadingsTable.tsx:74–81 kaynak yok; C/schema.ts:465–467 Hik olay/verify alanları; C/lib/hikEventCatalog.ts:66,99 biyometrik doğrulamalar da okuma olabilir. | Yüksek | Kanıt varsa “Kart”, “Biyometrik · PDKS dışı”; yoksa “Kaynak bilinmiyor”. Kart numarasının varlığı biyometrik olayı kart olayı yapmaz. |
| LIVE-UI-10 | Form / filtreler | UI/CardReadingsFilters.tsx:45–53 cihaz/izin/ret var; kapı, kişi kimliği ve “Sonuç bilinmiyor” yok. C/cardReadings.ts:102 aynı sınırlı argümanlar. | Orta | Cihaz, sonuç ve arama ana satır; kapı/kişi/tarih ek filtreler; sunucuda filtre desteği gelmeden tüm geçmişi filtrelediğini iddia etme. |
| LIVE-UI-11 | Yerleşim / mikro-metin | UI/CardReadings.tsx:31 temizleme yalnız boş tablonun içinde; filtreyle sonuç varsa filtreler tek tek sıfırlanıyor. | Orta | Her zaman ulaşılabilir “Filtreleri temizle”; etkin filtre sayısı ve tüm tarihler/tek gün/aralık özeti. |
| LIVE-UI-12 | Durumlar / ölçek | H/useCardReadings.ts:31 arama yalnız results'ta; :36 sayaç filtre öncesi loadedCount. Etiket dürüst ama arama eşleşmesi sayısı görünmüyor. | Orta | “100 kayıt yüklendi · 3 eşleşme · Daha eski kayıtlar var”; yükleme aramayı korur. Genel kişi araması ayrı backend işi. |
| LIVE-UI-13 | Responsive | UI/CardReadingsFilters.tsx:28 minimum 200px; UI/CardReadingsTable.tsx:70 geniş sekiz kolon. Mobil görsellerde görünür alan kişi/kartla sınırlı; kabuk daralması SHELL-UI-01'in sorumluluğunda. | Yüksek | Ortak mobil kabuğu tüket; kendi filtrelerinde min-width:0, tek sütun; olayları kişi/saat/sonuç/kapı okunur mobil listeye dönüştür. |
| LIVE-UI-14 | Durumlar: hata | UI/CardReadings.tsx:26–33 projesiz/tarih/yükleniyor var ama query hatası yerel değil; H/useCardReadings.ts:17 ve :23 iki abonelik aynı tüketicide. | Orta | Olay ve cihaz seçeneklerinin hata sınırını ayır; filtre taslağı kalsın; gerçek yeniden deneme. |
| LIVE-UI-15 | Gezinme | H/useCardReadings.ts:11–16 yalnız useState; rotaya dönünce filtreler sıfırlanır (ACC-16 açık). | Orta | Projeye bağlı URL filtreleri; geçersiz cihaz/kapıyı temizle; canlı tamponu URL'ye yazma. |
| LIVE-UI-16 | Mikro-metin / eksik veri | UI/CardReadingsTable.tsx:56 readerName kapı adının önüne geçiyor, :66 yalnız “-”; :101 whitespace kişi adı normalize edilmiyor. | Orta | Kapı + okuyucu ayrı açıklanır; “Kapı eşleşmedi”, “Kişi bilgisi yok”; eksik adı eşleşmemiş kişiyle karıştırma. |

## Yeni tasarım

### Bilgi mimarisi ve eylemler
1. Ortak kabuk: 216px bordo sidebar, 64px üst çubuk, Canlı İzleme aktif; 13 öğe sırası ve rol filtresi aynen 01/Kabuk. 390px'te proje seçici görünür, 248px modal menü. H1 yalnız içerikte.
2. PageHeader: **Canlı İzleme**, “Merkez Ofis · Erişim okumaları · İstanbul saati (UTC+3)”. İşlem yaratma butonu yok.
3. Canlı/Geçmiş görünüm seçimi; canlıda **Görüntüyü durdur**, durunca **Devam et**. Bağlantı metni ve son olay saati ayrı. “Görüntü durduruldu; kayıt alımı sürüyor” açık metin.
4. FilterBar: “Yüklenen kayıtlarda kişi/kart ara”, Cihaz, Sonuç; “Diğer filtreler” içinde kapı, kişi seçimi, tarih aralığı. Tarih seçimi geçmişe geçirir. Dışarıda etkin kapsam özeti ve temizle. Ana satırda en fazla üç select.
5. StatInline: sadece “N kayıt yüklendi · M eşleşme”; başarılı/ret yüzdesi, günlük toplam, içeride kişi sayısı yok. Canlı yeni kayıt düğmesi aynı bölgede.
6. Tablo ve sonundaki **Daha eski kayıtları yükle**; kesin son sayfa veya sayfa N/M yok. Bitince “Seçili kapsamın tüm kayıtları yüklendi”. Mockup küçük örnek kümesinin tamamını gösterir.
7. Ayrıntı Sheet: seçili okuma, olay zamanı, kişi/kart, kapı/cihaz/yön, sonuç/neden, doğrulama kaynağı, açılabilir teknik ayrıntı; uygun durumda kart atama adımı.

Ana görünümde zorunlu bordo birincil buton yok; atama panelindeki **Atamayı onayla** birincildir. Duraklatma, ayrıntı ve filtre temizleme nötrdür. Toplu seçim, silme ve BulkBar yok; olaylar denetim kaydı niteliğindedir.

### Tablo kolonları

| Sıra | Kolon / yaklaşık genişlik | Kaynak ve gösterim | 390px |
|---|---|---|---|
| 1 | Saat / 90px, yüksek | accessTime, saniyeli TR saati; seçili gün üstte, birden fazla günse tarih de hücrede | Her olayın başında |
| 2 | Kişi / kart / 200px, yüksek | employeeName + cardNo; boşsa “Kişi eşleşmedi”, employeeId var ama ad yoksa “Kişi bilgisi yok” | Tam ad sarılır, kart alt satır |
| 3 | Kapı / cihaz / 185px, yüksek | door.name + devices.name; readerName ayrı ayrıntı | Kapı görünür; cihaz ayrıntıda |
| 4 | Yön / 85px, düşük | direction: Giriş / Çıkış / Bilinmiyor | Ayrıntıda |
| 5 | Sonuç / 200px, yüksek | accessStatus; ret sebebi hikDenialReason, yoksa “Neden bilinmiyor” | Rozet + sebep görünür |
| 6 | Kaynak / 150px, orta | Kanıtlı olay kodu/verify sınıflaması; ham alanı kullanıcıya dayatma | Görünür; biyometrikse PDKS dışı metni korunur |
| 7 | İşlem / 44px | Tek ⋯ düğmesi → okuma ayrıntısı; erişilebilir ad saat ve kişiyi içerir | Görünür |

Tablo başlığı 36px, satır 42px; ikinci satır gereken veri için sabit yükseklikle kesme yok. Uzun teknik değer ayrıntıda kırılır, tablo içinde kısaltma + erişilebilir tam ad. Zebra, animasyonlu parıltı, renkli sol kenarlık yok. Mobilde kart içinde kart yerine 1px ayırıcılı olay listesi; yatay belge kaydırması yok.

### Canlı akış sözleşmesi
- Canlı listenin ilk yüklenmesi yeni olay sayılmaz. Yeni _id'ler 1 saniyelik gruplarla işlenir; kullanıcı aşağı kaydırdığında, tablo içinde odak varken veya ayrıntı açıkken otomatik ekleme durur, **N yeni kaydı göster** oluşur. Satırlar odak altından kaymaz.
- Kullanıcı durdurunca o görünüm ve seçili _id sabit kalır; abonelik kayıt almayı sürdürür. Yeni sayaç yalnız aynı proje/filtre kapsamı için, tekilleştirilmiş olaylardan oluşur. Devam düğmesi tamponu uygular; liste başına atlamayı kullanıcı başlatır. Ayrıntı kapanınca otomatik devam edilmez.
- Yeni eklenen satır en fazla 2 saniye `--info-bg` zemin ve “Yeni” metni taşır; bounce/stagger yok. `prefers-reduced-motion: reduce` altında geçiş/animasyon sıfır, sabit metin ipucu korunur. Mockup yeni olay eklemeyi ayrı “Önizleme” kontrolüyle canlandırır, zamanlayıcıyla sahte canlı veri üretmez.
- `aria-live=polite` yalnız özet bölgede; saniyede her satır okunmaz. Tampon özeti en fazla 5 saniyede bir duyurulur; Tab sırası değişmez. Tablo başlığı yapışkan olabilir; kendi bölgesinde sayfa boyu büyümeyi sınırlamak için sanallaştırma ancak erişilebilirlik doğrulamasıyla.
- “Bağlı” yalnız abonelik bağlantısıdır; cihaz sağlık bilgisi değildir. Kopmada “Bağlantı kesildi · Gösterilen kayıtlar güncel olmayabilir”; yeniden bağlanınca kaçırılan olaylar yeniden sorgulanır. Olay yokluğu bağlantı kesintisi sayılmaz.
- Geçmiş modunda üst sınır/snapshot sabitlenir. Cursor mevcut kazanımdır; geç gelen eski olayların ve _creationTime/accessTime ayrımının eksiksiz yakalanması yeni watermark sözleşmesi gerektirir. Tarayıcı belleğindeki sayaç için eksiksiz geçmiş garantisi verilmez; taşmada “Yeni kayıtlar var · Yeniden yükle” kullanılır.

### Kaynak ayrımı: erişim izleme ile PDKS
Mevcut cardReadings tek başına “kart kullanıldı” veya “PDKS'ye uygundur” demek değildir. `hikMajorEventType`/`hikSubEventType` katalogda kesin yöntem gösteriyorsa etiket türetilebilir (örneğin major 5/minor 1 kart; major 5/minor 75 yüz); `hikCurrentVerifyMode` çelişkisi varsa “Kaynak doğrulanamadı”. IDE kaydında yalnız cihaz adı veya cardNo varlığından biyometri/kart sonucu çıkarılmaz; yeterli kanıt yoksa **Kaynak bilinmiyor**.

Biyometrik ve kart+biyometri karma olaylar yalnız bu erişim izleme bağlamında **Biyometrik · PDKS dışı** olarak işaretlenir; ayrıntı metni “Bu olay erişim izleme içindir; PDKS hesabına dahil edilmez.” olur. Bu ifade üretimde ancak ingest/query/hesap/export katmanındaki dışlama gerçekten sağlanınca kullanılır; mockup hedef davranışı gösterir. Kart olayında otomatik “PDKS'ye dahil” etiketi verilmez. Bilinmeyen kaynak güvenli sınıflandırma yapılmadan PDKS'ye uygun sayılmaz. Fotoğraf, yüz şablonu, parmak izi veya sıcaklık bu sayfaya taşınmaz. `deviceEvents` alarm/kapı durumu akışını sessizce bu listeye katma; birleşik olay akışı ayrıca ürün ve backend kararıdır.

### Okuma ayrıntısı ve bilinmeyen kart → kişiye ata
Ayrıntı paneli masaüstünde 480px, mobilde tam genişlik; başlık ve Kapat sabit, gövde kayar. Esc kapatır, odak açan düğmeye döner; görünüm panel açılırken dondurulur. Kayıt yok/silinmiş/erişim kaybolmuşsa “Bu okuma artık görüntülenemiyor” ve Kapat; başka olayın verisi gösterilmez.

Atama yalnız `employeeId` yok, doğrulama kaynağı fiziksel kart olarak kanıtlı, kart değeri geçerli ve yazma yetkisi var ise açılır. Ham QR/token/biyometrik personel numarası fiziksel kart sanılmaz. Üye için salt ayrıntı; `employees.update` adminMutation sınırı korunur. Alan sırası: salt okunur **Kart numarası**, **Olay/cihaz/proje**, projede aranan **Kişi**, kişinin **Mevcut kartı**, etkilerin özeti, gerekli ise **Mevcut kartı değiştireceğimi onaylıyorum**. Başında sıfır bulunan kart numarası string olarak aynen saklanır; yeni olay gelince formdaki kart değişmez.

“Bir kişi seçin” kişi alanının altında; çakışmada “Bu kart başka bir kişiye atanmış”; mevcut kart onayı yoksa checkbox altında; sunucu hatasında footer üzerinde metin. Kaydederken tek submit, “Atanıyor…”, tekrar tıklama kapalı. Başarı DB kaydını ve cihaz senkron sonucunu ayrı söyler; cihaz onayı yoksa “Kart kişiye atandı; cihaz uygulama durumu bekleniyor/bilinmiyor”. Eski okumanın kişi ilişkisini otomatik yeniden yazma; geçmiş olay snapshot'ını koru. Kirli form kapanışında Vazgeç/Devam et onayı. Mockup **Atamayı önizle** ile etki özetini gösterir, kayıt başarısı taklidi yapmaz.

### Durum metinleri ve 390px
- İlk yükleme: “Erişim okumaları yükleniyor…” (`role=status`, altı satır iskelet; hareket yok).
- Gerçek boş: “Henüz erişim okuması yok. İlk okuma geldiğinde burada görünecek.”; “Cihazları görüntüle”.
- Yerel arama boş + devam var: “Yüklenen kayıtlarda eşleşme yok. Daha eski kayıtlarda olabilir.”; “Daha eski kayıtları yükle” ve “Filtreleri temizle”. Tümü yüklüyse yalnız seçili kapsamda eşleşme olmadığı söylenir.
- Query hatası: “Okumalar yüklenemedi. Filtreleriniz korunuyor.”; gerçek yeniden abonelik için “Tekrar dene”. Eski veri tutuluyorsa “Son alınan kayıtlar” ve güncel olmayabileceği açıklaması.
- Proje seçilmemiş: “Okumaları görmek için bir proje seçin”; üst çubuk seçiciyi aç. Yetkisiz projeye erişim: “Bu projeyi görüntüleme yetkiniz yok”; “Proje seç”. Proje ataması hiç yoksa 01/Kabuk rol metinleri.
- Tarih: “Bitiş tarihi başlangıçtan önce olamaz.” bitiş alanı altında; `aria-describedby`. Başlangıç tekse “17.10.2026 · Tek gün”; iki boşsa “Tüm tarihler”.
- Mobil: 16px kenar, 24px h1, filtreler tek sütun/ek filtre paneli; olay kimliği, saat, sonuç ve kaynak daima görünür; minimum 36px ve aralıklı eylemler. Sheet içinde uzun kart/seri `overflow-wrap:anywhere`; %200 zoom'da düğmeler sarılır.

## Bileşen eşlemesi

| Ortak bileşen | Yer / mevcut dosya |
|---|---|
| PageHeader | LiveMonitoring.tsx; gövde başlığı/proje kapsamı eklenecek |
| StatInline | CardReadings.tsx; yüklenen/gösterilen sayısı, günlük toplam yok |
| FilterBar + Form alanları | CardReadingsFilters.tsx; kart kabı kalkar, temizle/ek filtre/URL sözleşmesi |
| DataTable + StatusBadge | CardReadingsTable.tsx; masaüstü kolonları ve mobil liste; yön nötr metin, yalnız sonuç semantik renk |
| EmptyState / SectionSkeleton | CardReadings.tsx; mevcut bileşenler korunur, query hata sınırı eklenir |
| Dialog/Sheet | Yeni ReadingDetailPanel ve AssignReadingCardForm; ortak Radix odak/kapanış davranışı |
| LiveFeedControls | Yeni yerel kontrol; useCardReadings snapshot/tampon state'i; alias hook korunur |
| BulkBar | Kullanılmaz; olaylara toplu değişiklik yok |

Mevcut dosyaların hiçbiri salt stil için silinmek zorunda değil. A2 ortak kabuk/tema uygulamasını kabuk sahibi yapar; bu sayfa AppHeader/Sidebar'ı ayrı değiştirmez. FunctionReturnType korunur; yeni veri `unknown` + narrowing, yeni sözleşmeler camelCase.

## Backend gereksinimi
1. **Kaynak güvenliği:** doğrulama yöntemi sınıflamasını tek sunucu kaynağından döndür; Hik kodu/verify-mode çelişkisi ve karma biyometri dahil. Mevcut alanlardan kesin sınıflanabilenler kullanılabilir; IDE/legacy verinin eksikleri ayrı inceleme. PDKS dışlaması yalnız UI rozetiyle çözülmez; ingest, geçmiş okumaları tüketen hesap/query/export birlikte ele alınmalı (08 raporuyla ortak sahiplik).
2. **Canlı watermark ve geçmiş snapshot:** olay kimliği + sunucu alım sırası ile kaçırılanları tamamlayan sınırlandırılmış subscription/cursor sözleşmesi. accessTime geç teslim olaylarında tek başına yeterli değil; createdAt eski backfill'de olay zamanına eşit (`cardReadings.ts:1542`).
3. **Tam kapsam filtreleri:** kişi kimliği, kapı kimliği/IO eşlemesi, bilinmeyen sonuç ve gerekirse kaynak filtresi; index/cursor planı. Mevcut `door` enrichment ID döndürmüyor (`cardReadingAudit.ts:84`), yalnız IDE IO eşliyor. Tam kişi/kart araması ayrıca sunucu arama gereksinimi; mevcut yerel arama dürüst etiketi korunabilir.
4. **Güvenli atama:** mevcut update kart değiştirir ve duplicate kontrolü yapar; okuma→kişi bağlamı, aynı proje, geçerli fiziksel credential ve form açıldıktan sonra eski kartın değişmediğini atomik doğrulayan dar mutation gerekir. Beklenen önceki kart/okuma ID'si ile yarış kontrolü; eski okumanın denetim geçmişini değiştirmeme. Sunucu yetkilendirmesi zorunlu.
5. Ayrıntı ilk etapta yüklü listeden mevcut alanları kullanabilir. Doğrudan URL/_id açılışı için yetkili tek okuma query'si gerekebilir. “İlgili kuralı aç” mevcut kayıtta karar anındaki ruleId olmadığı için şimdilik eklenmez.

## Açık sorular
1. Canlı görünümün gün kapsamı ve tampon limiti ne olmalı; limit aşımında yeniden yükleme kabul mü? Öneri bugün + sınırlı tampon, geçmiş ayrı.
2. Bilinmeyen kart atanırken mevcut kartın değiştirilmesi bu ekranda onayla yapılabilir mi, yalnız Kişiler formuna mı taşınmalı? Öneri yetkili admin + açık onay + atomik yarış kontrolü.
3. Kapı/kişi/kaynak tam kapsam filtreleri ilk uygulamaya dahil mi? Öneri mevcut cihaz/sonuç ve dürüst yerel arama önce; yeni filtreler backend ile birlikte.
4. Biyometrik kaynak sınıflandırması ve PDKS dışlama için 07/08 ortak backend sahibi kim olacak? Bu kapı tamamlanmadan hedef rozeti üretimde garanti metnine dönüştürülmemeli.

## Uygulama tahmini
**L · 32–44 saat**: A2 sayfa/filtre/tablo/mobil 8–10s; ayrıntı/atama 6–8s; canlı snapshot/tampon/bağlantı 8–12s; backend filtre/sınıflama/yetki ve hedefli kontroller 10–14s. Ortak kabuk bu tahmine dahil değil; geçmiş veri göçü ve tüm PDKS hesap/export hattında biyometri ayrıştırması ayrı ortak iş olarak ayrıca tahminlenmeli. Ana riskler geç gelen olaylar, büyük akışta tampon doğruluğu, kart değiştirme yarışı ve kaynak verisinin belirsizliği.

## Doğrulama
Yalnız bu klasörde rapor ve HTML üretildi; uygulama lint/TS çalıştırılmadı çünkü kaynak değişmedi. HTML Python `html.parser` yığın denetiminden geçti: kapanmamış veya uyumsuz etiket 0. Yerel kurulu Playwright/Chromium ile `file://` üzerinden 1440×900 ve 390×900 açıldı; belge scrollWidth sırasıyla 1440 ve 390, konsol/pageerror 0. Yeni paket veya ağ bağımlılığı kullanılmadı.

Duraklatmada 10 görünür kayıt sabit kaldı ve “1 yeni kaydı göster” oluştu; devamda 11 oldu. Cihaz filtresi 2 eşleşme verdi; arama boşluğu, hata/tekrar dene, geçersiz tarih, atamada zorunlu kişi ve kart değişimi onayı, kirli taslak kapanış onayı, 390px modal menü/ayrıntı ve reduced-motion (0s) kontrol edildi. Mockup'ın filtreleri örnek küme üzerinde çalışır; gerçek backend filtre desteği iddia edilmez.

Görsel kanıtlar: `preview-1440.png`, `preview-390.png`, `preview-390-detail.png`. Ana görünüm ve mobil ayrıntı görselleri açılıp incelendi; masaüstü tabloda alan içi dikey kaydırma var, belge yatay taşmıyor. Gerçek zamanlı sunucu yükü, kart mutation'ı ve cihaz senkronu bu tasarım çalışmasında test edilmedi.
