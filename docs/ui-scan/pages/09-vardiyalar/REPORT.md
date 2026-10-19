# 09 · Vardiyalar

## Özet

Vardiyalar, seçili projenin çalışanlarına tarih aralığı ve çalışma saati atamak, izin/tatil etkisini görmek ve vardiya tanımlarını yönetmek için kullanılır. En büyük üç açık sorun mobilde planın okunamaması, toplu/tekrarlı atamanın ekrana bağlı olmaması ve sabit yükseklikli hücrelerin çoklu atama ile gece devamını açıklayamamasıdır. Öneri A2 kabuğunu korur; tam genişlik takvim, mobil günlük ajanda, isteğe bağlı tanım paneli ve kapsamı açık ortak atama formu getirir.

## Kapsam ve kaynak gerçeği

17.10.2026 çalışma ağacı; commit edilmemiş Dalga 3a düzeltmeleri dahil incelendi. `src/pages/Shifts.tsx`, `src/components/shifts/**`, `ShiftSettings`, `AddShiftDialog`, `ShiftTable`, `shiftFormSchema`, `useActiveProjectScope`, `useAsyncAction`, `convex/shifts.ts`, `convex/lib/shiftUx.ts` ve ilgili şema okundu. Convex incelemesinden önce `convex/_generated/ai/guidelines.md` okundu. Uygulama kodu, canlı veri ve diğer sayfaların teslimleri değiştirilmedi.

`docs/ui-scan/current/09-vardiyalar.png`, `09-vardiyalar-mobil.png`, `09-vardiyalar-mobil-2.png` açılıp incelendi. Masaüstü `09-vardiyalar-2.png` mevcut değil. Mobil görseller 780 fiziksel piksel; 390 CSS piksel davranışının kaynaktaki kısıtları ayrıca incelendi. Görsellerin daha eski yakalanmış olabileceği durumlarda güncel kaynak esas alındı; görünmeyen diyaloglar için çalışma zamanı iddiası yapılmadı.

### Önceki audit ile karşılaştırma

| Önceki bulgu | Güncel durum; tekrar açılmayan kısım |
|---|---|
| PPL-02 | `Shifts.tsx:22`–`:29` aktif proje query argümanları; `:48`, `:58`, `:68` proje anahtarı; `convex/shifts.ts:14`, `:42` kapsam/eşleşme kontrolleri mevcut. |
| PPL-21/22 | `AddShiftDialog.tsx:136` null temizleme payload'ı; `:149` yalnız başarıda kapanma; `ShiftListSidebar.tsx:63` callback hatayı yutmuyor. Eski mola/tolerans temizlenmiyor ve hata halinde kapanıyor bulguları kapalı. |
| PPL-23/24 | `ShiftCalendarView.tsx:43` görünür hafta; `AssignShiftDialog.tsx:96` form aralığı sorguları ve yükleme kilidi; `AssignmentEditDialog.tsx:93` ortak schema; backend `validateAssignment` tarih/izin/tatil doğruluyor. |
| PPL-25 | `shiftUx.ts:48` ve `:56` saat, tekrar günü ve gece taşması hesabı ortak; çakışma onayları mevcut. Artık yalnız tarih kesişimini çakışma sayıyor denmez. Tekrar-günü/izin ayrışması aşağıda ayrı, dar kapsamlı bulgudur. |
| PPL-28 | Tüm seri etkisi artık başlıkta, açıklamada ve silme/güncelleme onayında açık (`AssignmentEditDialog.tsx:133`, `:238`). Tek gün istisnası hâlâ yok; bunu sessiz tüm seri silme hatası diye tekrar açmıyoruz. |
| PPL-29/42 | Tanım ve saat/mola doğrulaması, brüt/net süre, paylaşılan pending koruması mevcut (`shiftFormSchema.ts:42`, `AddShiftDialog.tsx:109`, `:149`). Kalan konu hata yerleşimi ve gece açıklamasıdır. |
| PPL-26/27/30/38 | Toplu yüzey bağlantısı, kısmi sonuç, mobil/erişilebilirlik ve sınırsız veri okuma açık; aşağıdaki somut karşılıklarla devam ediyor. |

## Mevcut durum taraması

Kanıt yolları `src/components/shifts/` altındaki kısa dosya adlarında bu klasöre; tanım dosyalarında `src/components/settings/sections/components/` altına aittir. Etki kullanıcı görevine göre verilmiştir; ölçülmemiş performans/kontrast iddiası yoktur.

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| SHF-UI-01 | Yerleşim / görsel hiyerarşi | Tanım paneli 260px, uygulama menüsüne ek ikinci kalıcı sütun; asıl takvim sıkışıyor. `ShiftListSidebar.tsx:103`; `src/pages/Shifts.tsx:47`; masaüstü soldaki tanım kartı. | Yüksek | Tanımları başlıktaki ikincil düğmeden 420px Sheet'e aç; takvim tam içerik genişliğini kullansın. |
| SHF-UI-02 | Responsive | Izgara en az 820px, kolonlar gerçekte 180+7×100=880px; mobil ajanda yok. `ShiftCalendarGrid.tsx:75`–`:77`; mobil iki görselde günler görünmüyor. Kabuk sıkışması 01 raporunun ortak işidir. | Yüksek | 760px altında günlük ajanda; kabuk modal menü sözleşmesine geçsin. Yatay kaydırma yalnız tercihe bağlı masaüstü aylık tablonun içinde. |
| SHF-UI-03 | AI arayüzü izi | Tanım kartı, iç içe kart satırları ve takvim başlığı ayrı gölgeli/rounded-xl yüzeyler; renkli ikon kutuları tekrar ediyor. `ShiftListSidebar.tsx:103`, `:106`, `:146`; `ShiftCalendarView.tsx:93`–`:100`. | Orta | Tek PageHeader, nötr filtre satırı, 1px çizgili takvim; ikon kutularını ve kart tekrarını kaldır. |
| SHF-UI-04 | Bileşen tutarlılığı / renk | Tanım ID hash'i sekiz renk paletine dönüyor; vardiya kimliği ile uyarı/izin renkleri yarışıyor. `lib/shiftColor.ts:1`; `ShiftCalendarCell.tsx:83`, `:133`. | Orta | Vardiya adı+saat nötr; yalnız gerçek çakışma danger, izin info, tatil warning. Renk tek gösterge olmasın. |
| SHF-UI-05 | Erişilebilirlik | Önceki/sonraki hafta ikonlarının adı yok, arama yalnız placeholder; boş hücrelerin hepsi aynı “Vardiya ata” adına sahip. `ShiftCalendarView.tsx:109`, `:120`, `:127`; `ShiftCalendarCell.tsx:61`. | Yüksek | Görünür arama etiketi; “Önceki hafta”; “Ayşe Demir, 19 Ekim 2026, vardiya ata”; kişi/gün başlık bağlantılı semantik tablo. |
| SHF-UI-06 | Yerleşim / durumlar | Dolu hücre sabit h-14 içinde bütün atamaları map ediyor; izin/tatil simgesi sağ üstte üstüne biniyor. `ShiftCalendarCell.tsx:74`, `:80`–`:81`, `:132`. Üç+ kayıtta taşma riski kaynak çıkarımıdır. | Yüksek | En çok iki atama özeti; “+N atama” ayrıntı diyaloğu; izin/tatil ayrı metin satırı, hücre minimum yüksekliği içerikle büyüsün. |
| SHF-UI-07 | Mikro-metin | Gece vardiyası ertesi gün hücresine de gelir fakat aynı 22:00–06:00 etiketi kullanılır; önceki günden devam mı yeni başlangıç mı belirsiz. `ShiftCalendarGrid.tsx:122`; `ShiftCalendarCell.tsx:85`. | Yüksek | Başlangıçta “22:00–06:00 (+1 gün)”; ertesi gün “Önceki günden · 00:00–06:00”, başlangıç tarihi erişilebilir adda. |
| SHF-UI-08 | Form-diyalog | Toplu/haftalık tekrar bileşeninin tüketicisi yok; takvim yalnız tekli formu açıyor. `ShiftCalendarView.tsx:12`, `:163`; `BulkAssignShiftDialog.tsx:73`, `:314`; repo `rg` sonucu yalnız tanımı. | Yüksek | Tek “Vardiya ata” formu, bir/çok kişi ve gün seçimi; mevcut toplu bileşeni SHF-UI-09 çözülmeden doğrudan bağlama. |
| SHF-UI-09 | Durumlar / form-diyalog | Bağlanmamış toplu form kısmi sonucu toast ile kapatıyor; `skipped` ad/gerekçesi kayboluyor, `calendarConfirmed` gönderilmiyor. `BulkAssignShiftDialog.tsx:161`–`:175`; `convex/shifts.ts:174`–`:210`. | Yüksek | Kalıcı sonuç listesi, yalnız atlanan hedefleri tekrar seç; izin/tatil onayı ve pending kapanma korumasını ortaklaştır. Canlı erişilebilir hata değil, bağlama önkoşulu. |
| SHF-UI-10 | Boş durum | `hasNoShifts` toplam tanım sayısını kontrol ediyor; hepsi pasifken CTA atama açıp kullanılamayan select gösteriyor. `ShiftCalendarView.tsx:39`, `:146`; `AssignShiftDialog.tsx:260`–`:267`. | Orta | “Atanabilir vardiya yok” + “Vardiya tanımlarını aç”; mevcut pasif atamaları takvimden gizleme. |
| SHF-UI-11 | Durumlar / mikro-metin | Arama eşleşmemesi ile projede hiç kişi olmaması aynı “Görüntülenecek çalışan yok” metni; boş normal gün tamamen boş buton. `ShiftCalendarGrid.tsx:66`; `ShiftCalendarCell.tsx:51`–`:66`. | Orta | “Aramayla eşleşen çalışan yok / Aramayı temizle”; personel yoksa Kişiler bağlantısı; gün için “Atama yok”. İzinli/izin günü/hafta sonu diye veri olmadan yorumlama. |
| SHF-UI-12 | Form-diyalog / erişilebilirlik | Tanım, atama ve düzenleme ilk schema hatasını yalnız toast'ta gösteriyor. `AddShiftDialog.tsx:125`–`:133`; `AssignShiftDialog.tsx:140`–`:148`; `AssignmentEditDialog.tsx:93`–`:96`. | Yüksek | Alan altında hata + aria-describedby/invalid, ilk hataya odak; sunucu hatası form üstünde kalıcı. |
| SHF-UI-13 | Erişilebilirlik | Tanım satırı düzenle/sil kontrolleri opacity-0, yalnız hover'da görünür, 24px; eski ShiftTable ikonlarında erişilebilir ad yok. `ShiftListSidebar.tsx:179`–`:196`; `ShiftTable.tsx:118`–`:132`. | Orta | Her satırda görünür 36px “işlemler” menüsü, tanım adını içeren erişilebilir ad; touch ve focus görünürlüğü. Eski ShiftTable etkin tüketici kontrolüyle emekliye ayrılabilir. |
| SHF-UI-14 | Mikro-metin / durumlar | Yan panel atama sayısı bütün dönemleri sayar; “1 atama” haftalık plan gibi okunabilir. Atamalar yüklenirken `[]` verilir ve silme etkisi geçici 0 olabilir. `ShiftListSidebar.tsx:44`, `:174`, `:223`; `src/pages/Shifts.tsx:50`. | Yüksek | “Tüm dönemlerde N atama serisi”; yüklemede sayı iskeleti ve silme kapalı, backend gerçek etkiyi yeniden doğrulasın. |
| SHF-UI-15 | Gezinme / yerleşim | Yalnız ±7 gün ve Bu Hafta var; uzak tarihe atlama veya aylık görünüm yok. `ShiftCalendarView.tsx:78`–`:80`, `:118`–`:129`; `lib/weekUtils.ts:10`. | Orta | Tarih seçici + Hafta/Ay; aylık 31 gün semantik kişi×gün tablo, gün ayrıntısı. Mevcut aylık görünüm varmış gibi sunulmaz. |
| SHF-UI-16 | Form-diyalog | Gün/seri uyarısı düzelmiş olsa da tıklanan gün üst bileşene taşınmıyor, tekrar günleri düzenlemede görünmüyor. `ShiftCalendarGrid.tsx:136`; `AssignmentEditDialog.tsx:42`–`:49`, `:164`. | Orta | Tıklanan günü salt bağlam olarak taşı, seri aralığı+uygulanan günleri göster. “Yalnız bu gün” backend istisna işlemi gelmeden etkinleştirilmesin. |
| SHF-UI-17 | Durumlar | Sayfa düzeyinde ErrorBoundary mevcut, fakat izin/tatil query hatası takvimle beraber bütün sayfayı düşürebilir; tanım paneli bağımsız kalamıyor. `src/components/Layout.tsx:34`; `ShiftCalendarView.tsx:44`–`:45`; `src/pages/Shifts.tsx:22`. | Orta | Query tüketimini bölüm sınırına taşı; “İzin ve tatiller kontrol edilemedi” ve yeniden dene; bilinmeyen katmanda atama kapalı, tanım okuma kullanılabilir. |
| SHF-UI-18 | Form-diyalog / mikro-metin | Toleranslar mola grubundan önce, placeholder “Global”; erken/geç alanlarında devralma açıklaması yok. Form değişmişken pending dışında kapanma serbest. `AddShiftDialog.tsx:211`–`:275`, `:310`, `:160`. | Orta | Ad/saat/mola/süre/mesai/durum → gelişmiş toleranslar; “Boş bırakılırsa genel ayar kullanılır”; dirty kapanma koruması. Etkin tolerans sayısı bağlanmadan uydurulmaz. |
| SHF-UI-19 | Durumlar / ölçek | Projedeki tüm kişiler/atamalar/tanımlar yüklenir; assignment query tarih aralığı almaz, tüm kişi×7 DOM üretilir. `convex/shifts.ts:35`–`:49`; `src/pages/Shifts.tsx:22`; `ShiftCalendarGrid.tsx:101`. | Orta | İlk faz kişi sayfalaması; sonraki faz tarih aralığı+cursor/bounded sorgu ve gerekirse sanallaştırma. Gecikme ölçülmedi. |
| SHF-UI-20 | Form-diyalog / doğruluk | Sunucuda izin çakışması tarih aralığı kesişimiyle; tatillerde `appliesOn` varken izinlerde hafta deseni uygulanmıyor. `convex/shifts.ts:20`–`:22`; istemci `lib/calendarOverlays.ts:68`–`:69`. | Yüksek | Toplu tekrar bağlanmadan izin çakışmasını fiili uygulama günleriyle birleştir. Örnek: yalnız Pzt/Cum ataması ve Çar izin aynı aralıkta olduğunda gereksiz izin onayı çıkarılmasın. |

## Kabuk sözleşmesi

`../01-ana-sayfa/REPORT.md` “Kabuk” bölümüne uyulur: 216px sidebar, 64px topbar, sabit 13 öğe sırası ve grup boşlukları, Vardiyalar aktif, tek h1, üstte “Ana Sayfa / Vardiyalar” breadcrumb. Mobilde 248px modal menü; proje seçici, arama ikonu ve hesap düğmesi aynı satırda. Yetkili menü alt kümesi, proje araması, hesap ve komut paleti ortak uygulamadan gelir; burada yeniden tasarlanmaz.

Mockup A2 `people.html` CSS'sini aynen taşır; 01 mockup'ındaki kabuk/diyalog CSS eklerini ve kabuk davranışını yeniden kullanır. Ek stil yalnız takvim, ajanda, form ve ilgili durum içindir. Sistem fontu, A2 token'ları, nötr yüzeyler, 6px kontroller ve 8px diyalog korunur; renkli vardiya paleti kaldırılır.

## Yeni tasarım

### Bilgi mimarisi ve eylemler

1. **PageHeader:** “Vardiyalar”; alt satırda seçili proje ve “Çalışma planı”. Tek birincil “Vardiya ata”; ikincil “Vardiya tanımları”.
2. **StatInline:** yalnız mevcut veriden “Görünen N çalışan · M aktif vardiya tanımı”. Planlanan saat/kapasite/uyum oranı yok. Aramayla N güncellenir; tanım sayısı proje genelinde etiketiyle kalır.
3. **FilterBar:** görünür “Çalışan ara” etiketi, “Vardiya” filtresi (Tümü/gerçek tanımlar), “Filtreleri temizle”. Ad araması Türkçe harf dönüşümüyle; ayrı departman filtresi bu ilk teslimde eklenmez.
4. **Dönem çubuğu:** önceki, görünür dönem, sonraki, Bu hafta, etiketli tarih seçici; Hafta/Ay. Tarih seçimi görünümü korur; gün/hafta/ay hesabı İstanbul tarihiyle. Mobilde gün ajandası için önceki/sonraki gün ve tarih.
5. **Seçim varsa BulkBar:** N çalışan seçildi, seçimleri temizle, “Seçilenlere ata”. Seçim hedefleri adlarıyla formda görünür; filtre/dönem/proje değişince seçim temizlenir. Mobilde seçim form içinde yapılabilir.
6. **Takvim veya ajanda:** tek nötr tablo yüzeyi. Boş gün “Atama yok”; hafta sonu olması izin/rest-day anlamına gelmez. “Bugün” metni tarih başlığında, bordo dekoratif sütun boyaması yok.
7. **Alt bilgi:** görünür kişi aralığı/sayfalama ve “İstanbul saati”. Mockup altındaki “Önizleme senaryoları” ürün arayüzü değildir.

### Kolonlar ve boyutlar

| Sıra | Hafta tablosu | Genişlik/öncelik | 390px karşılığı |
|---|---|---|---|
| 1 | Kişi seçimi | 36px; görünür checkbox, toplu için | Ajanda kişi başlığında checkbox |
| 2 | Çalışan adı; gerekirse e-posta | 180px; sticky; ad sarılabilir, e-posta ikincil | Kart görünümü değil, çizgiyle ayrılmış kişi bölümü; aynı kimlik |
| 3–9 | Pzt–Paz, tam tarih | Kalan alan yedi eşit sütun, min 112px | Seçili tek gün; hiçbir bilgi tooltip'e taşınmaz |
| Hücre | Vardiya adı, saat; izin/tatil, çakışma | Min 68px; 2 kayıt + “N atamayı gör”; içerik ile büyür | Aynı bilgi 2 satırlı liste; en az 36px hedef |

Aylık tablo kişi×ayın gerçek gün sayısıdır; kişi kolonu sabit, günler 92px; sadece tablo bölgesi yatay kayar ve “Diğer günler için takvimi yatay kaydırın” metni gösterilir. Satır/kolon başlıkları sticky, scroll bölgesi adlandırılmış ve klavye ile kaydırılabilir. Ay hücresinde vardiya adı ve başlangıç/bitiş özetlenir; ayrıntı aynı gün diyaloğunda, atama sayısı ve çakışma etiketi kaybolmaz. Mobilde ay ızgarası zorlanmaz; tarih seçiciyle seçilen gün ajandası gösterilir. Mockup hafta/ay ve günlük ajanda davranışını örnek verilerle uygular.

Tanım panelinde **ad (esnek), saat (110px), durum (70px), işlemler (36px)**; mobilde saat ad altına gelir, hiçbir bilgi kalıcı gizlenmez. “Tüm dönemlerde N atama serisi” ikincil satırdır, kişi-gün sayısı değildir. Nötr liste en az 42px; takvim 68px+ işlevsel yoğunluk istisnasıdır.

### Rozetler ve metinler

- Vardiya: nötr ad+saat. Pasif tanım: nötr “Pasif”; mevcut atama kalır. Aktif: success “Aktif”.
- İzin: info “Yıllık izin” vb. yalnız onaylı `leaves`; tatil: warning ve gerçek `holidays.name`. Birlikte varsa ikisi de görünür.
- Gerçek saat çakışması: danger “Çakışma”; bir günde iki farklı saat bulunması tek başına çakışma değildir. Ayrıntıda saatler ve seri aralıkları birlikte.
- Atama yok: muted metin; veri yükleniyor/hata ile karıştırılmaz. İzinli kişide vardiya yoksa “Yıllık izin · Atama yok”.

| Durum | Gösterilecek Türkçe metin ve eylem |
|---|---|
| Yükleniyor | “Vardiya planı yükleniyor”; sabit başlık ve bölüm içi iskelet, role=status/aria-busy; 0 kişi gösterilmez. |
| İzin/tatil kontrolü bekliyor | “İzin ve tatiller kontrol ediliyor”; atama kapalı. |
| Proje yok | “Bir proje seçin” / “Çalışma planını görmek için üst çubuktan bir proje seçin.” |
| Personel yok | “Bu projede çalışan yok” / “Plan oluşturmak için önce çalışan ekleyin.” / “Kişileri aç”. |
| Tanım yok | “Henüz vardiya tanımlanmamış” / “Atama yapabilmek için önce çalışma saatlerini tanımlayın.” / “Vardiya tanımla”. |
| Hepsi pasif | “Atanabilir vardiya yok” / “Bir vardiyayı etkinleştirin veya yeni tanım ekleyin.” / “Tanımları aç”. |
| Arama sonucu yok | “Aramayla eşleşen çalışan yok” / “Başka bir ad deneyin veya filtreleri temizleyin.” |
| Dönemde atama yok | Kişiler satırda kalır; “Bu dönemde atama yok” / “Boş bir gün seçerek plan oluşturabilirsiniz.” |
| Bölüm hatası | “Vardiya planı yüklenemedi” / “Tekrar deneyin. Vardiya tanımlarını görüntülemeye devam edebilirsiniz.” / “Tekrar dene”. |
| Overlay hatası | “İzin ve tatiller kontrol edilemedi” / “Atama yapmadan önce kontrolü yeniden deneyin.” |
| Kaydetme | “Atanıyor…” / “Kaydediliyor…”; tekrar gönderim ve kapanma kapalı, alanlar korunur. |
| Kısmi sonuç | “3 kişiden 2'sine atama yapıldı. 1 kişi atlandı.” + ad/gerekçe listesi + “Atlananları incele”. 0 başarılıysa başarı başlığı yok. |

### Atama formu: tekli ve toplu

560px dialog; mobilde 16px kenarlı, ekran yüksekliğine sığan kaydırılabilir form; alt eylemler görünür. Sıra: **çalışanlar → vardiya → başlangıç/bitiş → uygulanacak günler → kapsam özeti → çakışmalar → eylemler**. Hücreden kişi+tıklanan tarih önseçili, başlıktaki CTA görünür hafta aralığıyla açılır. Çalışan araması ve checkbox listesinde ad/e-posta; seçilenler filtreden bağımsız görünür özetle incelenir.

“Her gün” varsayılanı açık yazılır; “Belirli günler” seçildiğinde Pzt–Paz toggle/checkbox. `weekPattern` zaten mevcut; alan icat edilmez. Seçili kişi sayısı ve kişi başına uygulanacak gün sayısı yerel önizlemedir; “atama sayısı” olarak sunulmaz. Tarihler dahil aralık ve seçili günler özetlenir. Pasif vardiya yeni seçenek olmaz; hepsi pasifse form yerine tanımlara yönlendirilir.

Hatalar alan altında: “En az bir çalışan seçin”, “Vardiya seçin”, “Başlangıç tarihi seçin”, “Bitiş tarihi başlangıçtan önce olamaz”, “En az bir gün seçin”. Tarih farkı üst sınırı mevcut server sözleşmesiyle aynı tutulur; 365 gün farkının dahil gün sayısıyla karıştırılması ayrıca kararlaştırılmalı. Sunucu nihai otoritedir; istemci önizlemesi onay değildir.

Çakışmada aynı formda kişi+tarih+vardiya+saat, izin/tatil ayrı listeler; iki açık onay mevcut `forceConfirm` / `calendarConfirmed` anlamını korur. Metin: “Mevcut atamalar korunur. Bu işlem ek atama oluşturur.” Yerine koyma davranışı uydurulmaz. Toplu işlem sonrası `insertedCount` ve `skipped` kalıcı sonuç panelinde; yalnız başarısız ID'lerle yeniden dene. Mockup kaydetmede “Önizleme tamamlandı; gerçek kayıt oluşturulmadı” der; backend başarısı taklidi yapmaz.

### Atama ayrıntısı ve düzenleme

Gün hücresi önce **kişi + tıklanan gün + o günün atamaları/izinleri** ayrıntısını açar. Her atamada vardiya/saat, seri başlangıç–bitiş ve tekrar günleri görünür; “Tüm seriyi düzenle” eylemi bilinçli seçilir. Günlük hücre ile bütün seri arasındaki bağ bu adımla açıklanır. Düzenleme formu seçili kişiyi salt okunur tutar; vardiya, tarih aralığı ve tekrar günleri ardından “Tüm seriye uygulanır” özeti gösterir. Kaydetme ve silmede mevcut açık seri onayı korunur; silme kişi+tanım+tarih aralığını tekrar yazar.

Tek gün bölme/istisna mevcut API'de yok; temel öneri ve mockup bunu sunmaz. Ürün isterse atomik seri bölme endpoint'i gelmeli. “Yalnız bu gün” işlevsiz etkin buton olarak konmaz.

### Vardiya tanımları: önerilen sahiplik

**Tanımların ana yeri Vardiyalar sayfasındaki Sheet olsun.** Güncel `src/pages/Settings.tsx` aktif sekmeleri içinde ShiftSettings yok; eski `SettingsTabs.tsx:34` hâlâ import ediyor fakat repo içinde SettingsTabs tüketicisi yok. Bu nedenle iki aktif tanım ekranı var diye bulgu açılmadı. Mesai/tatil genel politikaları Ayarlar > Mesai & Tatil'de kalır; vardiyaya özgü saat/mola/tolerans formu ortak kullanılır. Eski sekme yeniden aktifleşirse aynı paneli açan bağlantı olmalı, ikinci CRUD düzeni olmamalı.

Form sırası: ad → başlangıç/bitiş (geceyse “Bitiş ertesi gün”) → mola aç/kapat ve saatleri → brüt/mola/net süre → mesai etkin → aktif/pasif → “Toleranslar” açılır bölümü. Üç toleransın tamamında “Boş bırakılırsa genel ayar kullanılır; 0 tolerans yok demektir” açıklaması; etkili genel sayı için mevcut workSettings query'si ayrıca bağlanmalı, mockup sayı uydurmaz. `null` temizleme payload'ı korunur. Pasifleştirme geçmiş atamaları silmez; silme bağlı seri sayısı yüklenmeden açılamaz. İkonlar yerine adlandırılmış satır işlemleri menüsü. Form dirty ise kapanma kararı, mutation sırasında kapatma kilidi.

## Bileşen eşlemesi

| Ortak parça | Kullanım ve değişecek dosyalar |
|---|---|
| PageHeader / StatInline | `Shifts.tsx`; tek başlık ve kapsam; `ShiftCalendarView.tsx` içindeki ikonlu kart başlığını kaldır. |
| FilterBar / BulkBar | `ShiftCalendarView.tsx`; Türkçe arama, vardiya filtresi, dönem/kişi seçimi; görünmeyen hedefleri temizle. |
| DataTable yoğunluğu / takvim | `ShiftCalendarGrid.tsx`, `ShiftCalendarCell.tsx`; semantik header, sticky kişi, açık gün, çoklu kayıt ayrıntısı; 42px liste / 68px+ takvim. |
| StatusBadge | `ShiftCalendarCell.tsx`, tanım listesi; `lib/shiftColor.ts` kullanımı kalkar, son tüketici yoksa dosya silinir. |
| Sheet / tanım listesi | `ShiftListSidebar.tsx` kalıcı sidebar'dan isteğe bağlı panele dönüşür; `ShiftSettings.tsx`/`ShiftTable.tsx` aktif tüketici yoksa emekliye ayrılır; AddShiftDialog ortak kalır. |
| Dialog / FormField | `AssignShiftDialog.tsx`, `BulkAssignShiftDialog.tsx`, `assignmentFormSchema.ts`; tek ortak form ve doğrulama; ayrı toplu bileşen ortak forma yönlenir veya kaldırılır. |
| Gün ayrıntısı / seri formu | `AssignmentEditDialog.tsx` ve yeni `ShiftDayDetails.tsx`; tıklanan gün+seri açık ayrımı, aynı API sınırı. |
| Mobil ajanda | Yeni `ShiftAgendaView.tsx`; aynı filtreli kişi ve gün verisi; hesap motoru kopyalanmaz. |
| EmptyState / ErrorState / SectionSkeleton | `Shifts.tsx`, `ShiftCalendarView.tsx`, tanım paneli; query tüketicileri bölüm sınırlarında, gerçek retry. Mevcut Layout ErrorBoundary korunur. |
| Tanım form alanları | `AddShiftDialog.tsx`, `shiftFormSchema.ts`; alan altı hata, mola/süre hiyerarşisi, tolerans açıklaması, dirty koruma. |
| Ortak kabuk | 01 raporunun uygulama paketi; bu sayfanın kabuk dosyalarını ayrıca değiştirmesi gerekmez. |

## Backend gereksinimi

**Temel görsel düzen, haftalık/aylık/ajanda sunumu, arama, tanım Sheet'i için yeni şema alanı gerekmez.** Alanlar `employees.firstName/lastName/email`, `shifts.name/startTime/endTime/isActive/breakStart/breakEnd/*ToleranceMinutes/overtimeEnabled`, `shiftAssignments.employeeId/shiftId/startDate/endDate/weekPattern`, onaylı leaves ve holidays'dir. Kişi/gün/aktif tanım sayıları bunlardan türetilir; talep, doluluk, fazla mesai saati veya personel kapasitesi tahmin edilmez.

1. **Toplu atama entegrasyonu önkoşulu:** mevcut `bulkAssignShift` sonucunu kalıcı göster; `calendarConfirmed` kontrolünü UI'ye bağla; SHF-UI-20 fiili gün/izin mantığını ortaklaştır. İşlem öncesi kesin sunucu önizlemesi için yeni read-only preview endpoint'i ve apply sırasında yeniden doğrulama gerekir; mevcut mutasyonu “kontrol” diye çağırma.
2. **Ölçek:** `listAssignments` için project+görünür aralık/kişi pagination; gerekirse uygun indeks. Gece taşması için bir önceki gün başlangıçları da kapsanmalı. Tüm dönemlerde silme etkisi sayacı ayrı doğru sorgu olmalı; keyfi take() ile seri sayısını eksiltme.
3. **İsteğe bağlı tek gün istisnası:** yetki+proje doğrulayan atomik seri bölme/update/delete; hafta desenleri ve gece devamı korunmalı. Temel teslim bu endpoint'e bağımlı değil.
4. **Tanım değişikliğinin kapsamı:** mevcut assignment yalnız shiftId referansı taşır; saat değişimi eski atamaların görünümünü de etkiler. Dondurulmuş tarihsel saat istenirse effective-date/version veri tasarımı gerekir; bu mockup böyle bir garanti vermez.

## Açık sorular (4)

1. Tanım yönetiminin Vardiyalar Sheet'inde tekleşmesi onaylanıyor mu? Öneri: evet; genel mesai/tatil politikası Ayarlar'da kalır, mevcut rol yetkisi genişletilmez.
2. Tek gün istisnası ilk uygulama dalgasına alınacak mı? Öneri: seri düzenleme güvenli kapsamıyla çık; bölme ayrı backend işi olsun.
3. Toplu atamada çakışanları atlayıp diğerlerini kaydetme mevcut politikası korunsun mu? Öneri: önizleme+kalıcı kısmi sonuçla koru; sessiz tümünü tekrar deneme yok.
4. Vardiya tanımı değişikliği geçmiş atamaları da yeni saatlerle göstermeye devam etsin mi? Öneri: mevcut davranışı açıklayan etki özeti; tarihsel sürümleme ayrı ürün kararı.

## Uygulama tahmini

**L · 32–44 saat:** görünüm/ajanda/tanım Sheet'i 10–14; ortak tekli-toplu form/sonuç ve seri ayrıntısı 10–14; erişilebilirlik/durumlar 4–6; gerçek Convex ve responsive doğrulama 8–10. Ortak kabuk bu tahmine dahil değil; 01 paketi önkoşul. Kesin preview endpoint'i ve bounded sorgular ek **8–16 saat**; tek gün atomik bölme ek **8–16 saat**. Riskler gece vardiyasının iki güne dağılması, tekrar/izin eşleşmesi, kısmi toplu sonucun mükerrer tekrar edilmesi ve tanım değişikliğinin geçmişe etkisi.

## Teslim ve doğrulama

`mockup.html` tek dosya, ağ bağımsız ve temsili Türkçe veriler içerir. Ana hafta görünümü, ay görünümü, mobil günlük ajanda, arama/seçim, tanım paneli, tekli/toplu atama ve gün→tüm seri düzenleme etkileşimleri aynı dosyadadır. Önizleme senaryoları üretim UI'sinden ayrı etiketlenmiştir; gerçek kayıt işlemi yapılmaz. Mockup seri formunda tekrar günlerini salt okunur gösterir; tekrar günlerini değiştirme ve kısmi toplu sonucun kalıcı paneli Faz C sözleşmesidir. Sunucu doğrulaması, dirty taslak koruması ve gerçek yazma akışı bu statik görsel prototipte uygulanmış ürün davranışı olarak iddia edilmez.

### Doğrulama sonucu

- Yerel kurulu Playwright Node API + Chrome, **file://** üzerinden kullanıldı; paket kurulmadı, canlı uygulamaya giriş yapılmadı. Kontrol dosyası `verify.mjs`, makine sonucu `VERIFY.json`.
- **9 durum × 2 genişlik = 18 kombinasyon:** 1440px belge scrollWidth=1440; 390px scrollWidth=390. Aylık tablonun iç kaydırması belgeyi taşırmıyor; mobil atama diyaloğu clientWidth=scrollWidth=356px.
- Konsol/pageerror **0**; harici HTTP(S) isteği **0**. `html.parser` ile dengeli etiketler ve **123 benzersiz id** doğrulandı; 20 bulgunun her birinde kaynak/satır kanıtı var.
- Arama boş sonucu/temizleme, çoklu kişi seçimi, eksik alan hatası, saat çakışması onayı, atama örnek sonucu, gün ayrıntısı→seri düzenleme→açık onay, gece tanımı/molasız süre, mobil menü odağı ve Escape dönüş odağı, Ctrl+K Türkçe sayfa araması kontrol edildi.
- `desktop.png`, `mobile.png`, `assignment.png`, `mobile-assignment.png`, `definitions.png` yerel prototipin görsel kanıtlarıdır; ana görünüm 1440×900 / 390×900 viewport ile alındı. Kaynak görseller ile öneri görselleri ayrıdır.
- Uygulama kodu değişmediği için tsc/eslint ve gerçek Convex mutation testleri çalıştırılmadı. Gerçek screen reader turu, backend concurrency/izin/gece hesabı ve canlı performans bu statik mockup doğrulamasının kapsamı dışındadır.
