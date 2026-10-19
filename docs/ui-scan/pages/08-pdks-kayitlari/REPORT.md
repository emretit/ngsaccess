# 08 · PDKS Kayıtları — A2 tarama ve uygulama taslağı

## Özet
PDKS Kayıtları, personelin seçili gün veya dönemdeki devamını inceleme, puantajı düzeltme ve rapor alma çalışma alanıdır. En büyük üç sorun, tekrar kontrollerin kayıtları ekranın altına itmesi, dönem tablosunun gün ayrımını kaybetmesi ve gün detayından manuel düzeltmenin tamamlanmamış olmasıdır. Öneri, A2 kabuğunda tek dönem ve filtre kaynağıyla günlük tabloyu ve haftalık/aylık puantajı birleştirir; düzeltme gün bağlamında, dışa aktarma tek menüde açılır.

## Kapsam ve kaynak gerçeği

17.10.2026 çalışma ağacı okundu; commit edilmemiş değişiklikler korundu. `src/**` ve `convex/**` değiştirilmedi. Dört mevcut ekran görüntüsü açıldı: `docs/ui-scan/current/08-pdks-kayitlari{,-2,-mobil,-mobil-2}.png`. Mobil görüntüler 780 fiziksel piksel genişliktedir; açık sidebar'ın içerik alanını daralttığı ve ikinci görüntüde sekmelerin üst üste geldiği gözlenir; bunlardan kesin CSS viewport ölçüsü çıkarılmamıştır.

`DESIGN_DIRECTION.md`, A2 `home.html` / `people.html`, `PDKS_KAYITLARI_UX_PLANI_2026-10-16.md`, `PDKS_AUDIT_VE_PLAN_2026-10-16.md` ve Convex AI rehberi okundu. Hukuki bir yeniden değerlendirme yapılmadı; biyometrik kaynakların PDKS dışında tutulması görevdeki ürün kısıtı olarak uygulandı.

**Çözülmüş olanlar tekrar bulgu değildir:** başlık artık PDKS Kayıtları; tarih gezgini var (`PDKSRecords.tsx:115–120`), dönem aralıkları anchorDate üzerinden hesaplanıyor (`usePdksTableData.ts:26–68`), manuel düzeltme günlük `editDate` ile sınırlandırılıyor (`PDKSRecords.tsx:208`, `PDKSTableView.tsx:79–80`), özetler tablo verisinden geliyor (`PDKSRecords.tsx:85`), mola sorgusu seçili günü kullanıyor (`PDKSSmartPresets.tsx:43–45`), tam sayfa stats bekleme ve sahte yenileme kaldırılmış. UX-4 indeks aralığı iyileştirmesi mevcut (`cardReadings.ts:168–184`, `279–285`). Grafik artık tarih alıyor; filtre kapsamı ve günlük son yedi gün davranışı ise hâlâ ayrı (aşağıda).

## Mevcut durum taraması

Kaynak kısaltmaları: **P** = `src/pages/PDKSRecords.tsx`; **D/** = `src/components/pdks/dashboard/`; **H/** = `src/hooks/`; **C/** = `convex/`. Satırlar çalışma ağacındaki konumlardır.

| ID | Kategori | Kanıt | Etki | Bulgu ve öneri |
|---|---|---|---|---|
| PDKS-UI-01 | görsel hiyerarşi | P:145–178; masaüstü ilk ekran tablo başlığı y≈760 | yüksek | Filtre kutusu, iki preset bandı, özet ve asistan tabloyu aşağı itiyor. Başlık → dönem → tek filtre → tek satır özet → tablo; asistan ve uyarılar isteğe bağlı açılır. |
| PDKS-UI-02 | bileşen tutarlılığı | D/PDKSTableView.tsx:72–73,168–175,204–230; D/PDKSFilterBar.tsx:73–108 | yüksek | İki arama ve bağımsız durum filtresi birbiriyle kesişiyor. Tek `filters.person/statusFilter` sahibi; tablodaki yerel kontroller kaldırılır. Arama yalnız ad/soyad vaat eder; server bugün kart no aramıyor (C/cardReadings.ts:218–222). |
| PDKS-UI-03 | yerleşim | P:181–208; H/usePdksTableData.ts:29–40; D/PDKSTableView.tsx:313–321 | yüksek | Haftalık/aylık veri matrix olsa da Tablo sekmesi hâlâ dönemin ilk/son saatini tek gün gibi gösteriyor. Günlük = tablo; Haftalık/Aylık = puantaj, ayrı Heatmap sekmesi kaldırılır. |
| PDKS-UI-04 | form-diyalog | D/PDKSEmployeeDetailDrawer.tsx:259–261; P:208 | yüksek | Yanlış güne yazma engellenmiş fakat dönem hücresinde “Manuel düzenle (yakında)” pasif. Hücre employeeId+date taşır; aynı günün formunu yetkili kullanıcıya açar. |
| PDKS-UI-05 | erişilebilirlik | D/PDKSHeatmapView.tsx:134–181 | yüksek | Boş renk düğmeleri ve hover tooltip saat/durumun tek taşıyıcısı; erişilebilir hücre adı yok. Hücrede metin kodu+süre; tam ad/tarih/durum ARIA etiketi; Enter/Space ile detay. |
| PDKS-UI-06 | mikro-metin | C/lib/pdksTable.ts:27–46,378–405,431; D/PDKSTableView.tsx:134–137 | yüksek | Günlük status yalnız dört türken matrix hafta sonu/tatili ayırıyor; “Yok” operasyonel olarak belirsiz. Tek gün de gün sınıflandırması döndürmeli; Devamsız/İzinli/Hafta tatili/Resmî tatil açıkça ayrılmalı. |
| PDKS-UI-07 | bileşen tutarlılığı | D/PDKSTableView.tsx:132–145; D/PDKSMobileCardList.tsx:22–30; D/PDKSEmployeeDetailDrawer.tsx:24–31; src/components/pdks/statusMeta.ts:61–67 | orta | Aynı statü farklı sabit renklerde; ortak meta bile fazla mesaiyi mor tanımlıyor. A2 semantik token'larıyla tek StatusBadge; fazla mesai nötr süre, erken çıkış uyarı. |
| PDKS-UI-08 | AI arayüzü izi | D/PDKSTableView.tsx:192–196,335,379,386,441–450; masaüstü -2 | orta | Kart içinde kart, gradyan, blur, gölge, zebra, emoji ve dekoratif departman rozeti. A2'nin 42px satırı, yatay çizgi, düz metin departman ve nötr yüzeyi kullanılır. |
| PDKS-UI-09 | tipografi | D/PDKSTableView.tsx:390–394; C/lib/pdksTable.ts:423–424; D/PDKSHeatmapView.tsx:164–175 | orta | 0h 0m / 125m / dk birimleri karışık ve süreler gereksiz renkli. Saat 08:30, süre 08 sa 30 dk; matrixte 08:30 + “süre sa:dk” açıklaması; tabular-nums. Net çalışma adı motor doğrulanmadan kullanılmaz. |
| PDKS-UI-10 | erişilebilirlik | D/PDKSTableView.tsx:313–321,332–352 | orta | Başlıklar sıralanamıyor; satır genişletme yalnız onClick. Başlık düğmeleri+aria-sort; isim düğmesi detay açar; satır işlemleri tek “İşlemler” menüsünde. |
| PDKS-UI-11 | durumlar: boş-yükleniyor-hata | D/PDKSTableView.tsx:178–187,329–330; H/usePdksTableData.ts:103–107 | yüksek | Masaüstü sıfır satırda açıklama/sonraki adım yok; bölüm spinner'ı var ve hook hata değerini sabit null veriyor. Bölüm iskeleti, filtre boşluğu ve gerçek sorgu hata sınırı eklenir. |
| PDKS-UI-12 | responsive | mobil ve mobil-2: açık sidebar, kırpılmış preset ve çakışan sekmeler; P:181,266–272 | yüksek | Dar görünümde yoğun kontroller ve sabit asistan düğmesi veriyi kapatıyor. Kapalı başlayıp modal açılan sidebar, tek kolon kontrol akışı, günlük personel listesi ve dönem içinde kontrollü yatay puantaj; floating asistan kaldırılır. |
| PDKS-UI-13 | form-diyalog | src/components/pdks/ManualPdksEditDialog.tsx:68–90,124,159 | orta | Saat doğrulaması sadece toast, tarih ISO, gerekçe isteğe bağlı. Tarih Türkçe okunur ve sabit; alan altı hata + form özeti; boş çift saat engellenir. Zorunlu gerekçe ürün kararı ve backend doğrulaması gerektirir. |
| PDKS-UI-14 | yerleşim | P:194–197; D/PDKSTableView.tsx:84–108,161–165; D/PDKSEnhancedExportPanel.tsx:43–45,100–111,179–195 | yüksek | Export üç yerde; paneldeki zaman seçimi export verisine hiç uygulanmıyor. Başlıkta tek menü, dönem ve satır kapsamını gösteren önizleme; seçim çubuğu yalnız kapsamı değiştirir. |
| PDKS-UI-15 | mikro-metin | C/lib/pdksTable.ts:414; D/PDKSTableView.tsx:314,384 | orta | “ID” gerçekte kart numarası, yoksa internal empKey. “Kart no” detaya taşınır, iç kimlik kullanıcıya basılmaz; listeyi isim/departman ile sadeleştir. |
| PDKS-UI-16 | bileşen tutarlılığı | P:225–227; H/usePdksChartData.ts:5–14; C/cardReadings.ts:339–343 | yüksek | Grafiklere şirket/departman/vardiya/kişi filtreleri gitmiyor; günlükte tarih 7 güne genişliyor. Analiz aynı kapsam sözleşmesini kullanmalı; günlük trend genişletilecekse ayrıca açık bir dönem kontrolü gerektirir. |
| PDKS-UI-17 | mikro-metin | D/PDKSOvertimeAlert.tsx:12–13; D/PDKSSmartPresets.tsx:31–45; P:79–85 | orta | Yıllık/son30g uyarı kapsamı seçili dönemle aynı değil; akıllı filtre tablosu daralırken özet allRecords kalıyor. Uyarı içinde kapsam etiketi; aktif uyarı filtrelenmiş satırlara ve özetlere birlikte uygulanır. |
| PDKS-UI-18 | mikro-metin | C/lib/pdksTable.ts:437–440; D/PDKSEmployeeDetailDrawer.tsx:247–249 | yüksek | Tablo ayrıntısı her izinli hareketi Giriş, konumu Bilinmiyor yazıyor; drawer belirsiz direction'ı Giriş sayıyor. Kaynak yönü kesin değilse “Yön belirtilmemiş”; eşleştirilmiş zaman çizelgesi backend düzeltmesine bağlı. |
| PDKS-UI-19 | bileşen tutarlılığı | C/cardReadings.ts:162–233,1455–1461; C/lib/hikEventCatalog.ts:66,99,198–204,238–247 | yüksek | PDKS sorgusu cardReadings'i kaynak ayrımı olmadan tüketiyor; olay kataloğu biyometrik izin olaylarını okumaya çevirebiliyor. UI'da biyometrik kaynak seçeneği/rozeti olmaz; güvenli kaynak ayrımı ingest + sorgu + export katmanında tamamlanmalı. |
| PDKS-UI-20 | durumlar: boş-yükleniyor-hata | D/PDKSHeatmapView.tsx:134–136; src/lib/pdksSummary.ts:25; C/lib/pdksTable.ts:328–405 | yüksek | Eksik hücre absent rengi alırken özet geleceği atlıyor; gelecek gün ile devamsızlık karışabiliyor. Bugünden sonraki gün “Henüz gelmedi”; veri dönmeyen geçmiş hücre “Veri yok”; devamsız ancak backend sınıflandırması varsa. |
| PDKS-UI-21 | form-diyalog | D/PDKSEnhancedExportPanel.tsx:55–85; C/cardReadings.ts:432–436 | yüksek | APHB uyarıları dosya indirildikten sonra toast'ta; aylık cetvel API'si yalnız yıl/ay alıyor. Aylık proje kapsamı ve warnings indirmeden önce görünür; kişi filtresinin uygulanmadığı aylık çıktılar açıkça belirtilir. |

## Yeni tasarım

### Bilgi mimarisi ve eylemler

1. A2 kabuk: 216px bordo sidebar, sabit 13 öğe, PDKS Kayıtları aktif; proje seçici her genişlikte görünür. Referans CSS ve kabuk HTML'i mockup'a doğrudan kopyalandı; yalnız aktif rota ve sayfa adı değiştirildi.
2. PageHeader: “PDKS Kayıtları”, “Merkez Ofis · 16 Ekim 2026 Cuma”; sağda tek birincil “Dışa aktar”, ikincil “Diğer” içinde İçe aktar ve Asistan. Manuel kayıt ana listeye rastgele kişi/gün ekleme düğmesi değildir; kişi/gün detayında birincil eylemdir.
3. Dönem: Günlük / Haftalık / Aylık seçimi, önceki/sonraki dönem, tarih alanı ve Bugün. Haftalık Pazartesi–Pazar, aylık takvim ayı; URL'deki anchorDate/reportType korunur. Özel aralık mevcut yetenek olarak tarih popover'ına taşınır; mockup üç ana modu örnekler.
4. FilterBar: ad/soyad arama; departman; “Diğer filtreler” sheet'i (şirket, pozisyon, vardiya); temizleme. Kayıtlı görünüm ve uyarılar ikincil menüye taşınır. Tarih ve proje filtre temizlemede korunur.
5. Kartsız sayaç: görünen personel sayısı, durum adetleri, fazla mesai toplamı; tek durum filtresi bu satırda. Günlük sayılar kişi, dönem sayıları **kişi-gün** diye etiketlenir. Durum adetleri arama/organizasyon filtresinden sonra, durum filtresinden önce hesaplanır; tablo sonucu ayrıca “gösterilen” olarak belirtilir. Mevcut ve Geç ayrı kümelerdir; fazla mesai bunlarla örtüşen özelliktir.
6. Uyarılar kapalı bir detay satırı; yıllık fazla mesai kapsamı “2026 yılı”, tekrar geç “son 30 gün”, mola “16 Ekim” olarak açık yazılır. Eksik okutma sayacı doğrulanmış motor alanı gelmeden gösterilmez.
7. Günlük DataTable veya dönem puantajı; liste üstünde yalnız seçim varsa BulkBar. Alt satırda sonuç/sayfa aralığı ve İstanbul saati. Analiz ikincil görünüm olarak aynı dönemi alır (mockup ana operasyonu kapsar).

### Günlük kolonlar

| Sıra | Kolon / kaynak | Genişlik önceliği | 390px karşılığı |
|---|---|---|---|
| 1 | Seçim | sabit 36px | personel satırında checkbox |
| 2 | Çalışan: name | esnek, min 180px; ilk öncelik | tam isim; detay düğmesi |
| 3 | Departman: department | 120px; ikinci | ismin altında |
| 4 | İlk giriş: firstEntry | 88px; yüksek | Giriş alanı |
| 5 | Son çıkış: lastExit | 88px; yüksek | Çıkış alanı |
| 6 | Toplam süre: totalHours | 104px; yüksek | Toplam alanı |
| 7 | Fazla mesai: overtimeHours | 100px; orta | varsa düz metin; sıfırsa detayda |
| 8 | Durum + izin türü: status, leaveType, isEarlyExit | min 135px; yüksek | metin rozet; izin türü alt metin |
| 9 | İşlemler | sabit 44px | isimli menü düğmesi |

Kart no (`employeeId`), bordro kodu (`payrollEmployeeCode`), manuel not/yapan detayda. “Manuel” nötr rozet ayrı metadata; durumun yerine geçmez. Sıralama ad Türkçe locale, ilk/son saat dakika, toplam/fazla mesai sayısal; bilinmeyen saatler sonda. Günlük toplam dakikası bugün string olduğundan tipli numeric alan tercih edilir; string `8h 5m` alfabetik sıralanmaz. Başlık 36px, satır 42px, sticky başlık, zebra yok. Çoklu rozet ikinci satır gerekirse minimum 42px üzerinde büyür; erişilebilirlik için metin kesilmez.

### Puantaj

Haftalık ve aylık aynı bileşendir: ilk sütun çalışan (192–220px sticky), gün başlıkları 72px; hücrede “M · 08:30”, “G · 08:15”, “İ · —”, “D · —”, “HT · —”, “RT · —”. Legend: Mevcut, Geç, İzinli, Devamsız, Hafta tatili, Resmî tatil; sürelerin saat:dakika olduğu görünür. Hücre bir düğmedir: `aria-label="Ayşe Demir, 16 Ekim 2026, Geç, 8 saat 15 dakika"`; tooltip yardımcı olabilir ama zorunlu bilgi saklanmaz. Dönem toplamları `days[].totalMinutes/overtimeMinutes` üzerinden hesaplanır; ilk/son hareketten dönem çalışma süresi çıkarılmaz.

Hücre → çalışan+gün detayı → aynı güne manuel düzeltme. Dönem değişince detay kapanır veya bağlamı açıkça sabit kalır; sessizce başka güne kaymaz. Gelecek günlerden devamsızlık üretilmez; saat/durum yoksa “Veri yok”, sıfır çalışma ise 00:00. Mobilde yalnız puantaj konteyneri yatay kayar, çalışan adı sticky kalır; sayfa yatay kaymaz. Daha uzun özel aralık için ay bazlı bölümleme/virtualizasyon gerekir.

### Durumlar ve renk

Mevcut success, Geç ve Erken çıkış warning, Devamsız danger, İzinli info; Hafta tatili/Resmî tatil/Manuel/Fazla mesai nötr. Her renk metinle eşleşir. İzin türü “Yıllık izin”, “Hastalık izni” gibi mevcut leaveType'tan gelir; puantaj hücresindeki izin türü sorguda yoksa detaydan okunur. Hafta tatili ile resmî tatil yalnız bordro kodunun anlamına bakarak tüm UI'a gelişigüzel uygulanmaz; sınıflandırma tek kaynaktan alınır. Biyometrik kaynak, filtre, rozet, zaman çizelgesi veya export sütunu eklenmez; kaynak şeması doğrulanmadan mevcut tüm hareketlere “Kart” etiketi basılmaz.

### Gün detayı ve manuel form

Detay: çalışan adı → okunur gün → durum/departman → giriş, çıkış, toplam, fazla mesai → izin türü/bordro bilgisi → varsa manuel not/yapan → hareketler ve değişiklik geçmişi → yetkili kullanıcıya “Manuel düzelt”. Gün detayı loading, bulunamadı ve erişim reddini ayırır; Drawer'daki `!detail` sonsuz yüklenme olarak kullanılmaz.

Form sırası: sabit çalışan+tarih, “Kart okumaları korunur; değişiklik denetim kaydına işlenir” açıklaması, mevcut/yeni giriş ve çıkış (yan yana masaüstü; mobil tek kolon), açıklama, hata özeti, Vazgeç/Kaydet. Saat alanı altında “Geçerli bir saat girin (08:30).”; çıkış altında “Çıkış saati girişten sonra olmalı.”; boş çift saat için “En az bir saat girin.” Gece yarısını aşan düzeltme mevcut endpoint'te desteklenmediğinden ertesi gün seçeneği taklit edilmez; backend işi olarak ayrılır. Açıklama mevcut API sözleşmesine uygun isteğe bağlı; zorunlu gerekçe kararı açık sorudur. Kayıtta buton “Kaydediliyor…”, tekrar gönderim engellenir; sunucu hatası formda kalır, değerler korunur. Başarılı gerçek mutation sonrası kapanır; mockup kalıcı kayıt yapmadığını açık yazar.

### Dışa aktarma

Tek başlık menüsü: Excel, CSV, PDF; ayraçtan sonra Aylık bordro cetveli, SGK aylık bildirim (APHB). Genel çıktının önizlemesi proje+dönem+filtre özeti+seçili/tüm filtreli satır sayısını gösterir. Seçim varken BulkBar “3 seçili · Seçimi kaldır”; indirme yine aynı menüden, kapsam seçili kişilerdir. Aylık çıktılar ayrıca ay/yıl ve proje ister; aynı ayı varsayar fakat kullanıcıya gösterir. APHB bütün proje/ay içindir, kişi filtresi uygulanmaz; mevcut warning'ler dosya indirmeden önce liste halinde sunulur. Cetvel API'si proje/filtre kapsamı kazanana kadar “ekrandaki filtrelerle aynı” sözü verilmez. Mockup kapsam paneli ve menü etkileşimini gösterir, dosya üretmez.

### Türkçe durum metinleri

- İlk kullanım: “Bu projede personel bulunamadı.” / “Personel ekleyerek PDKS kayıtlarını izlemeye başlayın.” / Kişilere git.
- Filtre sonucu boş: “Bu filtrelerle eşleşen personel yok.” / “Aramayı değiştirin veya filtreleri temizleyin.” / Filtreleri temizle (tarih korunur).
- Seçili günde hareket yok: “Bu gün için hareket kaydı yok.”; personelin devamsız/izinli sınıflandırması ayrı gösterilir.
- Yükleniyor: bölüm içi 6 satır iskelet; `role=status` “PDKS kayıtları yükleniyor.” Sayaçlar 0'a çevrilmez.
- Hata: `role=alert` “PDKS kayıtları yüklenemedi.” / “Bağlantınızı kontrol edip yeniden deneyin.” / Yeniden dene; gerçek query boundary yeniden kurulur.
- Dışa aktarma: “Rapor hazırlanıyor…”; hata “Rapor oluşturulamadı. Seçiminiz korundu.”; başarı yalnız dosya üretimi tamamlandığında.

### 390px davranışı

16px kenar, 24px h1. Sidebar başlangıçta kapalı; açılınca modal katman, Escape, odak kapanınca menü düğmesine dönüş. Proje seçici ve kullanıcı korunur; komut araması referanstaki gibi ikinci satır. Başlık eylemleri sarılır; mod seçimi ve tarih ayrı satırlar. Arama tam genişlik, gelişmiş filtreler sheet. Durum kontrolleri sarılır. Günlük liste kart içinde kart değildir: çizgiyle ayrılmış çalışan satırları. Günlük tablonun ayrı kart no ve departman kolonları gizlenir; departman alt satırda, saatler üçlü grupta görünür. Puantajın kontrollü yatay kaydırması etiketlenir. Dialog ekran kenarından 16px içeride, max-height ve kendi dikey scroll'u ile açılır.

## Bileşen eşlemesi

| Ortak bileşen | Uygulama / mevcut dosya |
|---|---|
| PageHeader | PDKSRecords: tek başlık ve ExportMenu; mevcut dört görünüm sekmesi kaldırılır |
| StatInline / StatusBadge | PDKSSummaryCards yerine kartsız sayaç; statusMeta A2 token'larına taşınır; üç kopya renk haritası kaldırılır |
| FilterBar | PDKSFilterBar sadeleşir; tarih PDKSDateNavigator'da; PDKSMobileDrawer aynı filter state'i kullanır |
| BulkBar | PDKSTableView seçim durumu; ayrı export implementasyonu silinir |
| DataTable | PDKSTableView tipleri FunctionReturnType; sort, sticky, günlük kolonlar; PDKSMobileCardList aynı veri tipini kullanır |
| DataTable / puantaj | PDKSHeatmapView evrilir; ayrı Heatmap sekmesi ve gereksiz tekrar takvim gösterimi kaldırılır |
| Dialog/Sheet + Form alanları | PDKSEmployeeDetailDrawer → gün bağlamı; ManualPdksEditDialog aynı endpoint ile gün bazında açılır |
| EmptyState / ErrorState | Liste, detay ve export'a bölüm bazında ortak durumlar; usePdksTableData sabit error:null sözleşmesi kaldırılır |
| ExportMenu | PDKSEnhancedExportPanel'in kartları/bağımsız report select'i kaldırılır; mevcut utils/pdksExport fonksiyonları korunur |
| İkincil araçlar | PDKSQuickPresets, PDKSSmartPresets ve PDKSOvertimeAlert bilgileri tarih/uyarı menüsüne; PDKSInlineQuery sayfa bandı kaldırılır, asistan isteğe bağlı Sheet'te |

## Veri sözleşmesi ve backend gereksinimi

Mockup'taki kişiler kurgusal örneklerdir; alanlar `PdksTableRow`, `PdksTableDayCell`, mevcut employee detail ve `upsertManual` sözleşmesinden alınmıştır. Yeni bir net süre, mola, onay veya dönem kilidi metriği uydurulmamıştır. Mockup gün seçimi için üretilen örnek dataset gerçek sunucu verisi değildir.

1. **Kaynak ayrımı zorunlu kapı:** PDKS'ye uygun kart/PIN/izinli mobil/QR/manuel kaynakların açık sınıflandırması; biyometrik olayları ingest'te PDKS üretiminden ayırma, eski cardReadings'in query/hesap/export katmanlarında dışlanması. Canlı erişim olayları ayrı bağlamda kalır. Mevcut rawData yeterliliği ve geçmiş ayrıştırma ayrı veri incelemesi ister; bu tarama göç yapmaz.
2. **Gün durumunun tek sözleşmesi:** günlük de holiday/weekend döndürmeli; gelecekte absent ve eksik hücrede absent varsayımı yapılmamalı. Sıralama için numeric totalMinutes; kaynak yönü kesin değilse unknown. İzin türü gün detayına açık alanla eklenebilir. Geçen süre ile net süre arasındaki motor farkı çözülmeden “Net çalışma” kolonu açılmaz.
3. **Ortak kapsam:** getPdksTableData şu an aktif projectId argümanı almıyor; super_admin tüm projeleri okuyor (C/cardReadings.ts:130–175). Header'daki proje ile sonuç uyumu için yetki kontrolü korunarak projectId kapsamı eklensin; chart, uyarı, detay, export aynı kapsamı paylaşsın. getMonthlyPayrollSheet yalnız year/month alıyor; filtreli cetvel gerekiyorsa proje/çalışan sözleşmesi gerekir. APHB mevcut projectId desteğini korur.
4. **Detay ve düzeltme:** upsertManual zaten var; UI bağlantısı frontend işi. Zorunlu gerekçe, gece vardiyası ertesi gün çıkışı, dönem kilidi ve düzeltme talebi yeni backend kurallarıdır; UX-3'e bırakılır. İki boş saatin kaydının anlamı da backend'de netleşmeli.
5. **Ölçek:** bugün sorgu tüm çalışanları döndürüyor; mockup'taki sayfa boyutu yalnız client pagination örneğidir. Büyük veri için server pagination + total/status aggregate birlikte tasarlanır; sayfa satırlarından global sayaç hesaplanmaz.

## Plan uyumu ve açık sorular

UX-1 sadeleştirme ve UX-2 sıralanabilir tablo/puantaj aynen korunur. UX-0'da yapılan tarih ve güvenli editDate kazanımları geriye alınmaz. Önceki planın “Gün/Dönem” iki seçeneği, görevin günlük/haftalık/aylık beklentisini görünür kılmak için üç mod düğmesi olarak açılmıştır; tek dönem state'i değişmez. Önceki UX-3 kaynak rozetindeki biyometri ifadesi PDKS içinde uygulanmaz; kullanıcının açık kısıtı gereği PDKS kaydına hiç dahil edilmez. Net çalışma/mola, doğrulanmış eksik okutma ve dönem kilidi backend gelene kadar sunulmaz.

1. Manuel düzeltmede gerekçe zorunlu olacak mı? Varsayım: mevcut opsiyonel davranış korunur; öneri zorunlu olmasıdır.
2. Dönem durum filtresi “en az bir eşleşen günü olan çalışan” mı, yalnız eşleşen hücreler mi? Varsayım: çalışan seçilir, diğer günler bağlam için görünür kalır.
3. Aylık bordro cetveli organizasyon/kişi filtresini uygulayacak mı? Varsayım: açıkça belirtilmiş proje/ay kapsamı; APHB her zaman tüm proje/ay.

## Uygulama tahmini

**L · 36–48 saat** (ortak A2 kabuk bileşenleri hazır varsayımıyla): sadeleştirme/export 8–10; tablo+puantaj+mobil 14–18; düzeltme/durum/erişilebilirlik 8–10; doğrulama 6–10. Kaynak ayrımı, geçmiş veri, kapsam API'leri ve hesap motoru işleri ayrı **16–32+ saat**, veri durumuna bağlıdır. Riskler: farklı hesap motoru toplamları; geç/izin/tatil filtrelerinin kişi-gün anlamı; super_admin proje sınırı; tarih/saat dilimi ve gece vardiyası; büyük matrislerde odak ve scroll performansı. Uygulama kapıları mevcut tsc/eslint ve anlamlı gün/dönem/manuel kayıt testleridir; bu teslim yalnız HTML ve rapordur.

## Mockup ve doğrulama

`mockup.html` ağ kullanmayan tek dosyadır; A2 referans CSS/kabuk kopyası üzerine PDKS stilleri eklenmiştir. Günlük/haftalık/aylık geçiş, tarih gezinme, arama/departman/durum filtresi, seçim, ad sıralama, gün detayı, manuel form doğrulaması, export kapsam paneli, mobil menü ve boş/hata/yükleniyor örnekleri aynı dosyada çalışır. Kalıcı kayıt ve dosya indirme taklit edilmez; önizleme mesajı gösterilir. Teknik doğrulama sonuçları teslim öncesi aşağıya kaydedilir.

### Doğrulama sonucu — 17.10.2026

- Python `html.parser`: eşleşmeyen/kapanmamış etiket **0**; yinelenen id **0**.
- Yerel Chrome + önceden kurulu Playwright, `file://` üzerinden: 1440×900 ve 390×900; günlük/haftalık/aylık modların tamamında `document.scrollWidth === viewport` (1440 / 390). Aylık tablo genişliği 2425 / 2365px; taşma yalnız `.table-scroll` içinde.
- Sayfa/konsol hatası **0**, HTTP(S) isteği **0**. Ağ paketi kurulmadı, canlı uygulamaya giriş yapılmadı.
- Gün detayından manuel forma geçişte “Can Yılmaz · 16 Ekim 2026 Cuma” korundu; ters saat sırası reddedildi; geçerli form yalnız açık önizleme bildirimi verdi. Gerçek kayıt yapılmadı.
- Arama ile boş durum, temizleme, yükleniyor/hata örnekleri, CSV kapsam panelinde “1 seçili personel”, mobil sidebar açma/Escape/odağın menüye dönmesi kontrol edildi. Mobil ikincil menü x=16, genişlik=240px; görünür alan içinde.
- Masaüstü/mobil ekranlar ve mobil aylık matris/form görsel olarak açılıp incelendi. Kanıtlar: `check-1440.png`, `check-390.png`, `check-monthly-1440.png`, `check-monthly-390.png`, `check-edit-1440.png`, `check-edit-390.png`.
- Uygulama kaynakları değişmediğinden tsc/eslint/Convex testleri çalıştırılmadı. Mockup entegrasyon değildir; API kapsamı, tarihsel veri ayrımı ve hesap doğruluğu backend kapıları açık kalır.
