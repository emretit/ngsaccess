# 02 · Kişiler — UI taraması ve A2 tasarım önerisi

## Özet

Kişiler ekranı aktif projenin personel kimliklerini, organizasyonunu ve erişimle ilişkili işlemlerini yönetir. En büyük üç açık sorun mobilde kullanılabilir alanın kaybolması, kişi ayrıntısının listeden açılamaması ve sıralama/özet/sayfalama kapsamlarının birbirinden ayrılmasıdır. Öneri A2 kabuğu içinde kartsız özet, çok seviyeli departman filtresi, sıkı personel tablosu, gerçek veri alanlarıyla gruplanmış form ve erişim/cihaz/geçiş ayrıntı panelidir.

## Kapsam ve kaynak gerçeği

17.10.2026 tarihinde **çalışma ağacındaki güncel dosyalar** incelendi; commit edilmemiş Dalga 3a değişiklikleri esas alındı. Uygulama kodu değiştirilmedi, canlı uygulamaya giriş yapılmadı, DB işlemi çalıştırılmadı. İncelenen görseller: `docs/ui-scan/current/02-kisiler.png`, `02-kisiler-mobil.png`, `02-kisiler-mobil-2.png`; masaüstü `02-kisiler-2.png` bulunmuyor. Görseller mevcut görsel yerleşime kanıttır; son kaynak değişikliklerinin çalıştığına dair canlı doğrulama sayılmaz.

A2 kaynakları `docs/ui-scan/DESIGN_DIRECTION.md`, `directions/A2-sade-bordo-sidebar/home.html` ve `people.html` okundu. Mockup'ın ortak CSS'i ve sidebar/üst çubuğu `people.html` üzerinden aynen alındı; modül yerleşimi ayrı CSS ile eklendi, avatar/tablo yüzeyi A2 tokenlarına bağlandı. Ana görünüm ve bütün örnek kayıtlar temsili; hiçbir ad, e-posta veya senkron sonucu canlı veri diye sunulmaz.

### Eski audit ile güncel kod arasındaki fark

`docs/ux-audit/03_KISILER_VARDIYA_IZIN.md` tarihsel bağlam olarak kullanıldı. Aşağıdaki eski iddialar yeni açık bulgu olarak tekrar edilmedi:

| Eski bulgu | Güncel kaynakta durum |
|---|---|
| PPL-01 REST toplu güncelleme | `src/hooks/useEmployeeTable.ts:24` artık `api.employees.bulkUpdateDepartment` kullanıyor; başarıdan sonra seçim temizleniyor. |
| PPL-02 proje kapsamı | Ana liste `src/hooks/useEmployees.ts:8`, ağaç `src/hooks/useDepartments.ts:24`, form seçenekleri `src/components/employees/hooks/useEmployeeFormData.ts:58` aktif proje ile sorgulanıyor. İstisna kalan toplu departman seçicisi aşağıdaki UI-14'tür. |
| PPL-04 erişim kuralı değiştirme izlenimi | `src/components/employees/EmployeeFormFields.tsx:178` eklemeli semantiği açıklıyor; mevcut üyelikler `src/components/employees/EmployeeForm.tsx:72` gösteriliyor. |
| PPL-06 fotoğraf yarışı | `src/components/employees/EmployeeForm.tsx:46` fonksiyonel state güncellemesi, `:53` yükleme kontrolü, `:90` Kaydet kilidi mevcut; eski yarış iddiası tekrar edilmedi. |
| PPL-07 servis sonucu tamamen gizli | `src/components/employees/hooks/useEmployeeFormSubmit.ts:132` mail başarısızlığını kontrol ediyor; `src/components/employees/EmployeeTable.tsx:196` kalıcı manuel senkron sonucu ve yeniden deneme sunuyor. Form kapandıktan sonraki sonuç sunumu hâlâ UI-13. |
| PPL-08 silme sözleşmeleri farklı | `convex/employees.ts:344` ortak `removeEmployeeWithDependencies` yolu var; eski fark iddiası tekrar edilmedi. |
| PPL-09 görünmeyen seçim | `src/hooks/useEmployeeTable.ts:21` proje ve `:27` görünür ID değişiminde seçim temizleniyor; başlık checkbox üyelik kontrolü `src/components/employees/EmployeeTable.tsx:204`. |
| PPL-12 alanları temizleme / negatif ücret | `src/components/employees/hooks/useEmployeeFormSubmit.ts:93` nullable temizleme, `src/components/employees/EmployeeFormFields.tsx:128` Atanmamış, schema `src/components/employees/hooks/useEmployeeFormSchema.ts:12` ücret doğrulaması mevcut. Hatanın görünür sunumu UI-09. |
| PPL-16/17 departman silme/ekleme | `convex/departments.ts:94` bağımlı kayıt engeli; `DepartmentTree.tsx:121` etki onayı; `src/components/departments/AddDepartmentDialog.tsx:22` pending ve `:36` alan hatası mevcut. |
| PPL-41/42 rol ve silme onayı | `src/pages/Employees.tsx:125`, `src/components/employees/EmployeeTable.tsx:288`, `src/components/employees/EmployeeDeleteDialog.tsx:10` rol, ad/etki ve ortak ConfirmDestructive kullanımını içeriyor. |

Bunlar kaynak incelemesi sonuçlarıdır; bu taramada backend davranış testleri yeniden çalıştırılmadı. PPL-13'teki “İptal pending sırasında açık” kısmı da `src/components/employees/FormActions.tsx:15` ile çözülmüş; Sheet dışından kapanma ve dirty koruması ayrı açık kalır.

## Mevcut durum taraması

Kanıt yolları repository köküne göredir. Satırlar tarama anındaki çalışma ağacını ifade eder.

| ID | Kategori | Kanıt | Etki | Öneri |
|---|---|---|---|---|
| PPL-UI-01 | responsive | `docs/ui-scan/current/02-kisiler-mobil.png` tüm ekran: sidebar yaklaşık yarı genişliği kaplıyor, Yeni Personel ve tablo sağdan kesiliyor; `02-kisiler-mobil-2.png` yalnız ilk kolonlar görünür. `src/components/employees/EmployeeTable.tsx:198` 800px minimum tablo. | yüksek | 390px'te sidebar katman, departmanlar kapalı açılır bölüm; ad/durum/menü kalan dar tablo. Sayfa yatay kaymaz. |
| PPL-UI-02 | görsel hiyerarşi / AI arayüzü izi | `src/components/employees/EmployeeFilters.tsx:27` gölgeli başlık kartı ve `:31` renkli ikon kutusu; `src/components/employees/EmployeeStats.tsx:20` üç StatCard; `src/pages/Employees.tsx:141` ek gölgeli tablo kabı. Masaüstü görselin üst üçte biri. | orta | Tek h1, kapsam alt satırı, kartsız Toplam/Aktif/Pasif; 1px ayırıcı ve A2 yüzeyleri. |
| PPL-UI-03 | bileşen tutarlılığı | `src/components/employees/EmployeeTable.tsx:38` detay callback kullanılmıyor; `:244` satır yalnız admin için düzenleme açıyor; `src/components/employees/EmployeeDetails.tsx:93` veri/rıza yüzeyi yalnız detayda. | yüksek | Ad gerçek butonla ayrıntı açar; Düzenle ayrı eylemdir. Salt okunur kullanıcı aynı detaya erişir, yazma eylemleri rol bazlıdır. |
| PPL-UI-04 | yerleşim / renk-kontrast | `src/components/employees/EmployeeTable.tsx:208` ayrı foto kolonu, `:268` mavi departman etiketi, `:278` monospace kart, `:288` dört satır ikonu. Masaüstü görselde eylemler sağ sınırın dışında. | orta | Avatarı ad kolonuna al; departman düz metin; kart tabular-nums; eylemleri tek adlandırılmış menüde birleştir; 42px satır. |
| PPL-UI-05 | erişilebilirlik | `src/components/employees/EmployeeTable.tsx:209`–`:227` sıralama tıklanabilir th; `:202` ve `:250` seçim checkbox'larında ad yok. | yüksek | Başlıkta button + aria-sort; “Ayşe Demir seç” ve “Bu sayfadaki tüm personeli seç”; indeterminate korunsun. Mevcut satır ikonlarına eklenen aria-label'lar kaybedilmesin. |
| PPL-UI-06 | bileşen tutarlılığı | `src/pages/Employees.tsx:62` liste önce dilimleniyor, `src/hooks/useEmployeeTable.ts:69` yalnız dilim sıralanıyor; `src/components/employees/EmployeeTable.tsx:215` departman ID'si sıralıyor. | yüksek | Filtre → görünen adlarla Türkçe sıralama → sayfalama; büyük veri için sorgu sözleşmesine taşı. |
| PPL-UI-07 | mikro-metin / durumlar | `src/pages/Employees.tsx:139` stats tüm çalışanları kullanıyor; `:67` totalPages ve `:151` koşullu pagination; `:22` yerel filtre state'i. | orta | “Projede toplam 10” ile “3 sonuç · Montaj” ayrı; filtre/sıra URL'de; veri azalınca geçerli sayfaya clamp. Sıfır sonuçta Temizle. |
| PPL-UI-08 | form-diyalog | `src/components/employees/EmployeeFormFields.tsx:36` iki uzun sütun; kimlik/iletişim/kart solda, organizasyon/erişim/vardiya/ücret/not sağda; `src/components/employees/EmployeeForm.tsx:71` fotoğraf üstte baskın. | orta | Ardışık kısa fieldset'ler: kimlik → iletişim → organizasyon → kart/kimlik → fotoğraf → isteğe bağlı ücret/not. Form footer sabit. |
| PPL-UI-09 | erişilebilirlik / form-diyalog | `src/components/employees/EmployeeFormFields.tsx:119` label ile `:124` trigger id eşleşmiyor; departman/pozisyon/kural da aynı; `:210` ve `:228` ücretler için FieldError yok; `src/components/employees/EmployeeForm.tsx:55` ilk hataya odak yok. | yüksek | Her select trigger'a bağlı id; tüm schema hataları alan altında; aria-invalid/describedby; özet ilk geçersiz alanı odaklar. |
| PPL-UI-10 | form-diyalog | `src/components/employees/SlideOverPanel.tsx:39` dış tıklama/Escape doğrudan onClose; `src/pages/Employees.tsx:30` proje değişimi formu kapatıyor; `src/components/employees/FormActions.tsx:14` footer akışta. | yüksek | Dirty koruması, kaydetmede bütün kapatma yollarını denetleme; proje değiştirmeden taslak kararı; görünür sabit alt eylemler. |
| PPL-UI-11 | mikro-metin | `src/components/employees/EmployeeFormFields.tsx:200` serbest “Vardiya”; `src/components/employees/EmployeeDetails.tsx:61` aynı metni gerçek atama gibi gösteriyor. | yüksek | “Eski vardiya notu — atama oluşturmaz”; gerçek tarihli atamalar Vardiyalar üzerinden yönetilir. Atama verisi yokken planlanmış gibi gösterme. |
| PPL-UI-12 | erişilebilirlik / yerleşim | `src/components/departments/DepartmentTreeItem.tsx:47` seçili semantiği yok; `:63` adsız 20px expand; `:80` yalnız hover eylemler; `:112` 1000px dal sınırı; `src/components/departments/DepartmentProjectHeader.tsx:18` tıklanabilir div. | yüksek | Çok seviyeli doğal yükseklikli liste, ayrı adlandırılmış expand/selection düğmeleri; tüm personel gerçek buton; yaprakta expand yok; yönetim eylemleri dokunma/klavyede görünür. |
| PPL-UI-13 | durumlar: hata / mikro-metin | `src/components/employees/hooks/useEmployeeFormSubmit.ts:105`–`:115`, `:132`–`:150` gerçek mail/senkron hataları toast ile sunulup form kapanıyor; manuel tablonun kalıcı sonucu `src/components/employees/EmployeeTable.tsx:196`. | orta | Form sonucu da kalıcı işlem özetine bağlansın; kayıt/e-posta/cihaz aşamaları ayrı ve yeniden deneme açık. Kısmi başarı tek yeşil mesaj olmasın. |
| PPL-UI-14 | form-diyalog / bileşen tutarlılığı | `src/components/employees/EmployeeTable.tsx:52` toplu departman dropdown'u `departments.list({})`; ana ağaç aktif proje kapsamlı. `:185` yalnız ad gösteriliyor. | yüksek | Aynı projectId ile sorgula, aynı adlı alt birimleri tam yoluyla göster; yüklenmede işlem kapalı. Backend proje doğrulaması korunur. |
| PPL-UI-15 | durumlar: boş-yükleniyor-hata | `src/hooks/useEmployees.ts:18` error sabit null ve `:19` refetch no-op; `src/pages/Employees.tsx:116` yerel ErrorState bu hook'tan çalışmaz. `src/components/employees/EmployeeTable.tsx:237` filtre boşluğu ile ilk kayıt boşluğu tek mesaj. | orta | Query error boundary ve gerçekten aboneliği yeniden kuran retry; ilk kayıt/filtre boşluğu/proje seçilmedi/erişim yok ayrı metin ve eylem. Loading skeleton zaten var, kaldırılmasın. |
| PPL-UI-16 | mikro-metin / form-diyalog | `src/components/employees/EmployeeConsentsCard.tsx:28`, `:132`, `:193`, `:213` biyometri açıklaması amaç ayrımı taşımıyor, “Rıza Al” tıklamasını beyan gibi sunuyor; `src/components/employees/PhotoUpload.tsx:27` yükleme ikonu adsız. | yüksek | Profil fotoğrafını biyometriden ayıran KVKK notu ve adlandırılmış dosya alanı; yalnız mevcut beyanın kaydını ifade eden dil. Amaç/kanıt/rol kararı alınmadan bu eylemleri detay paneline taşımama. Bu rapor hukuki uygunluk hükmü vermez. |
| PPL-UI-17 | mikro-metin / bileşen tutarlılığı | `src/components/employees/EmployeeFilters.tsx:70` sadece Yeni Personel; `EmployeeBulkActions.tsx` departman/senkron/sil; `convex/employees.ts:107` listLightForImport yazma/import akışı değil. | orta | Personel import'u mevcut yetenek diye göstermeden ayrı gelecek akış olarak tasarla; backend tamamlanmadan etkin üretim butonu yok. |
| PPL-UI-18 | bileşen tutarlılığı / durumlar | `src/components/employees/EmployeeDetails.tsx:50`–`:96` yalnız profil/sistem/not/rıza; `convex/syncStatus.ts:7` sorgu sadece projectId alıyor. Kişi yetkileri, cihaz teslimi ve son geçişler aynı yüzeyde yok. | yüksek | Ayrıntıda üyelikler + cihaz durumu + son geçişler. Proje kuyruğu kişi teslimi sayılmaz; veri yoksa “Bilinmiyor”, backend gereksinimi aşağıda. |

## Yeni tasarım

### Bilgi mimarisi ve eylemler

1. **Kabuk:** A2'nin 216px bordo sidebar'ı, 13 sabit menü, Kişiler aktif; 64px üst çubuk, sürekli görünür Merkez Ofis proje seçimi, sayfa adı, komut alanı, hesap menüsü.
2. **PageHeader:** “Kişiler”; alt satır “Merkez Ofis · Personel ve organizasyon”; tek birincil eylem **Personel ekle**. İçe aktarma ancak backend tamamlandığında ikincil eylem olur. Mockup'taki İçe aktarma öneri adımlarını açıklayan diyalogdur, dosya yüklemez.
3. **StatInline:** “Projede toplam 10 · Aktif 8 · Pasif 2”; isActive ve mevcut proje kapsamından hesaplanır. Filtreli sonuç sayacı tabloya aittir.
4. **Proje cihaz kuyruğu:** mevcut DeviceSyncStatusBanner semantiği; bekleyen yok / işleniyor / başarısız / tarama bilinmiyor. Son doğrulanmış onay varsa TR saati, asla “tüm kişiler senkron” çıkarımı yapılmaz.
5. **Organizasyon + liste:** 208px departman filtresi ve kalan esnek alan; mobilde departman seçici açılır bölüm. Çok seviyeli `parentId` ağacı, örnekte Operasyon → Üretim → Montaj. “Tüm personel” ve “Atanmamış” açık filtreler; şirket departman ağacının yerine geçmez.
6. **FilterBar:** arama, durum, Temizle, sayfa boyutu; ardından “N sonuç · seçilen departman” ve “Seçim yalnız bu sayfayı kapsar”.
7. **BulkBar → DataTable → sayfalama:** seçim varken çubuk; ad ayrıntı açar; menüde Ayrıntı, Düzenle, Cihazlara gönder, Mobil giriş bağlantısı gönder, Sil. Önceki/Sonraki gerçek disabled button; clamp sonrası en az bir sayfa, sıfır sonuçta 0 kişi.

Yazma eylemleri mevcut admin yetkisine bağlıdır. Salt okunur kullanıcı detay okuyabilir; Personel ekle/düzenle/toplu yazma/şifre/sil görünmez veya gerekçeli disabled; boş durum eylemi de role göre değişir. Departman yönetim rolü personelle aynı kabul edilmez: mevcut backend authedMutation, aşağıdaki ürün sorusunda karara bağlanır.

### Tablo kolonları

| Sıra | Kolon / alan | 1440px genişlik önceliği | 390px |
|---|---|---|---|
| 1 | Seçim `_id` | 36px sabit | 34px, 44px dokunma alanı |
| 2 | Ad soyad `firstName`, `lastName`; baş harf avatarı | kalan alanın yaklaşık %21'i, en yüksek öncelik | Ana içerik; alt satırda departman + `payrollCode`; avatar gizli |
| 3 | E-posta `email` | yaklaşık %23, uzun değer satır kırar | Gizli; ayrıntıda |
| 4 | Departman `departments.name` | yaklaşık %16 | Adın alt satırında |
| 5 | Pozisyon `positions.name` | yaklaşık %12 | Gizli; ayrıntıda |
| 6 | Kart no `cardNumber` | yaklaşık %12; tabular-nums, baştaki sıfırlar korunur | Gizli; ayrıntıda |
| 7 | Durum `isActive` | 68–80px | 68px görünür |
| 8 | İşlem menüsü | 40px | 42px; hedef 44px yüksek |

Masaüstü 42px satır, 36px başlık; çok uzun içerikte kırpılmış bilgi için ayrıntı yolu bulunur. 1100px altında e-posta ve pozisyon gizlenir; 760px altında departman/kart kolonları da kapanır. Bordro kodu ayrı yoğun kolon yerine mobil alt satır/ayrıntı/formda bulunur. TC kimlik listede gösterilmez; arama önerisinde de varsayılan yoktur.

### Filtre ve seçim sözleşmesi

- Arama adı, soyadı, e-posta, kart ve bordro kodunu kapsar; Türkçe küçük/büyük harf (`toLocaleLowerCase('tr')`). Bordro araması var olan alanı kullanır, yeni veri alanı değildir. TC ile aramayı koruma gereği ürün kararıdır.
- Departman seçiminde **yalnız doğrudan bağlı kişiler**; mevcut kodun davranışı korunur ve açıklanır. Alt departmanları dahil etme ileride açık bir kontrol olabilir; örnekte örtülü alt dal toplamı verilmez.
- Durum: tümü/aktif/pasif. İlk üretim diliminde şirket filtresi gerekmez; eklenirse var olan companyId ve proje kapsamlı şirket listesi kullanılır.
- Arama/departman/durum değişimi sayfayı 1'e, seçimleri sıfıra alır; sıralama tüm filtreli kümeye uygulanır. Veri azalınca currentPage sınırlandırılır. URL parametreleri `q`, `department`, `status`, `sort`, `page`, `size`; hassas TC araması seçilirse URL'ye yazılmaz.
- BulkBar: **N kişi seçili**, Departman değiştir, Cihazlara gönder, Sil, Seçimi kaldır. Onayda ad + bordro kodu görünür; sadece seçili sayıyı göstermek yetmez.
- Departman değişimi mevcut bulkUpdateDepartment; hedef tam yol ve proje ile gösterilir. İşlem sürerken tekrar gönderim kapalı, hata halinde seçim/target korunur. Cihaz sonucu kişi ve hedef bazlı gösterilir; bu sorgu tamamlanana kadar mevcut manuel sonuç raporu kullanılır.
- Silme: mevcut ConfirmDestructive etkileri korunur; kayıt/üyelik/vardiya/mobil oturum temizliği ile cihaz kuyruğu ayrıdır. Önizleme canlı silme yapmaz.

### Form ve diyalog düzenleri

**Personel ekle / düzenle:** aynı 700px Sheet, 390px'te tam genişlik; içerik kayar, başlık ve alt eylemler sabit kalır. Sıra ve gerçek veri eşlemesi:

| Bölüm | Alan sırası | Davranış |
|---|---|---|
| Kimlik | `firstName` Ad*, `lastName` Soyad* | İki sütun; mobil tek sütun; trim sonrası zorunluluk. |
| İletişim | `email` E-posta* | Kurulum bağlantısı açıklaması. Mevcut modelde telefon yok; telefon alanı eklenmez. |
| Organizasyon | `companyId`, `departmentId`, `positionId`, `isActive` | Hepsi aynı proje; nullable ilişkilerde Atanmamış; departman tam yolu seçenek etiketidir, yeni kayıt alanı değildir. |
| Kart / kimlik | `cardNumber`*, `tcNo`, `payrollCode`, `accessRuleId` | TC isteğe bağlı; 11 rakam ve ilk rakam 0 değil. Kart string, baştaki sıfır korunur. Kural “ekle” işlemidir; mevcut üyelikler ayrıntıdan incelenir. |
| Fotoğraf | `photoUrl`, `photoStorageId` | JPEG/PNG/WebP, 5 MB; yükleniyor/hata/önizleme; Kaydet yükleme sırasında kilitli. Profil medyası ve rıza/biyometri ayrı. |
| İsteğe bağlı diğer alanlar | `hourlyRate`, `monthlySalary`, `shift`, `notes` | Katlanır bölüm; iki ücret boşsa TL hesaplanmaz; shift “Eski vardiya notu”, atama değildir. `shiftId` yeni serbest metne bağlanmaz. |

Her label bağlı control id kullanır. Alan hatası hemen altında `aria-describedby`, `aria-invalid`; sunucu duplicate hatası ilgili kart/e-posta/TC alanına bağlanır; diğer hata footer üstü kalıcı özet olur. Örnekler: “Ad alanı zorunludur.”, “Geçerli bir e-posta adresi girin.”, “Kart numarası zorunludur.”, “Ücret negatif olamaz.” ve backend'deki “Bu kart numarası başka bir personelde kullanılıyor”. İlk hata odaklanır; katlanmış alandaysa bölüm açılır.

Kaydet / Vazgeç görünür; pending “Kaydediliyor…” ve bütün kapatma yolları kilitlidir. Dirty durumda “Değişikliklerden vazgeçilsin mi?” → “Düzenlemeye devam et” / “Vazgeç”. Proje değişimi aynı korumadan geçer; otomatik başka projeye taslak taşımaz. Kayıt sonrası kalıcı özet ayrı satırlarda “Personel kaydedildi”, “Kurulum e-postası gönderilemedi”, “Cihaz gönderimi bekliyor” gibi gerçek aşamaları gösterir; işlem başarısızsa başarı taklidi yapmaz.

**Departman:** doğal yükseklikli nested list; her expand butonu `aria-controls` + `aria-expanded`, seçim butonu `aria-pressed`; yaprakta expand yok. Mockup native buton/list semantiğini kullanır, eksik ARIA tree klavye modeli vaat etmez. İleride gerçek tree component seçilirse Up/Down/Home/End ve roving tabindex birlikte uygulanır. “Departman ekle” formunda proje sabit, üst departman yolu ve ad zorunlu; başarılı sonuçtan önce kapanmaz. Yönetim menüsü Yeniden adlandır / Alt departman ekle / Sil; silme mevcut backend engeline uygun, bağlı kişi/alt birim varsa engel ve taşıma yönlendirmesi. Drag-and-drop/üst seviye taşıma bu tasarımın ilk uygulama dilimine dahil değildir.

### Kişi ayrıntısı

Başlık: ad soyad, bordro kodu, aktif/pasif; ardından Düzenle. Bölümler sırasıyla Genel bilgiler (e-posta, departman, pozisyon, kart, bordro, TC), Erişim yetkileri (gerçek groupMembers üyelikleri ve kural durumu; Geçiş Kontrol bağlantısı), Cihaz senkron durumu (bilinmiyor/bekliyor/başarısız/doğrulanmış teslim; kanıt zamanı), Son geçişler (accessTime, deviceId çözümü, accessStatus, varsa direction), Fotoğraf ve veri kayıtları.

Mockup senkronu **Bilinmiyor** gösterir; kişi bazında 2/3 gibi olmayan metrik uydurmaz. Son geçiş örnekleri `cardReadings` modelindeki alanlardır; mevcut EmployeeDetails'a bağlı değildir ve bounded sorgu gerekir. Üyelik “aktif” rozeti cihaz teslimi anlamına gelmez. Formdaki erişim tek seçimli “ekle” semantiğini aynen korur; kaldırma Geçiş Kontrol'de yapılır. Rıza verme ekranı amaç/kanıt/rol kararı alınana kadar açılmaz; fotoğraf notu kesin hukuki sonuç ileri sürmez.

### Durumlar ve Türkçe metinler

| Durum | Metin ve eylem |
|---|---|
| Proje seçilmemiş | “Personelleri görmek için proje seçin.” → üst çubuk proje seçici. |
| İlk kayıt boş | “Henüz personel eklenmedi” / “Merkez Ofis için ilk personel kaydını oluşturun.” → yetkiliye Personel ekle. |
| Filtre boş | “Aramanızla eşleşen personel yok” / “Aramayı veya departman seçimini değiştirin.” → Filtreleri temizle. |
| Yükleniyor | “Personel bilgileri yükleniyor…” + bölüm içi iskelet, role=status; geçici 0 sayacı yok. |
| Liste hatası | “Personel listesi yüklenemedi” / “Bağlantınızı kontrol edip yeniden deneyin.” → gerçek Yeniden dene. |
| Erişim yok | “Bu projenin personel kayıtlarını görüntüleme yetkiniz yok.” → erişilebilir proje seçimi. |
| Ayrıntı silinmiş | “Personel kaydı artık bulunamıyor.” → Listeye dön; eski formdan yazma kapalı. |
| Erişim üyeliği yok | “Bu kişiye erişim kuralı atanmamış.” → yetkiliye Üyelikleri yönet. |
| Senkron verisi yok | “Bu kişi için doğrulanmış cihaz teslim bilgisi yok.”; Bilinmiyor rozeti. |
| Geçiş yok | “Bu kişi için seçili dönemde geçiş kaydı yok.”; hata ile karıştırılmaz. |
| Fotoğraf hata | “JPEG, PNG veya WebP biçiminde, en çok 5 MB bir dosya seçin.”; mevcut fotoğraf korunur. |
| Toplu kısmi hata | “İşlem bazı kişiler için tamamlanamadı.” + ad/cihaz/hata listesi + yalnız başarısızları yeniden dene. |

Durum rozetleri A2 StatusBadge: aktif/izin verildi success; pasif nötr; bekliyor info; bilinmiyor warning; başarısız/reddedildi danger. Departman dekoratif renk almaz. Metin + durum birlikte, yalnız renkle anlatım yok.

### 390px davranışı

Sidebar kapalı başlar, menü düğmesi katman açar; proje seçici görünür. Ağaç varsayılan kapalıdır ve listeyi aşağı itmeden kullanıcının açmasıyla gösterilir; kapatınca seçili departman düğmede kalır. Form alanları tek sütun, eylemler alt sırada, uzun e-posta/metin kırılabilir; dialog viewport'u aşmaz. Liste ad/departman/bordro, seçim, durum ve menüyü korur; kalan bilgi ayrıntıdadır. Sadece veri tablosu içinde gerekirse scroll kullanılabilir, belge yatay taşamaz. Üretim kabuğunda mobil menü için focus trap/inert arka plan ve Escape dönüşü ortak shell sahibine aittir; mockup Escape ve kapatma odağını gösterir.

### İçe aktarma — mevcut değil, gelecek akış

Kişiler için import entry/parse/apply uygulaması bulunmadı; `listLightForImport` personel yazma akışı değildir. Önerilen akış: **Dosya/şablon → kolon eşleme → satır doğrulama → değişiklik özeti → uygula → satır sonuçları**. İlk sürüm yalnız yeni personel ekler; mevcut kayıtları sessiz güncellemez. Örneğin “12 satır: 10 hazır, 2 düzeltme gerekli”; hatalar dosya satırı + alan + gerçek backend doğrulamasıyla gösterilir. Ad/soyad/e-posta/kart zorunlu; proje sabit, departman/şirket/pozisyon isimleri ID'lere yalnız aynı proje içinde çözülür; belirsiz adlar tam yol seçimi ister. Kart/e-posta/TC çakışması import öncesi işaretlenir; düzeltmeden uygulama engellenir. Sonuçta kayıt, e-posta ve cihaz aşamaları ayrıdır; aynı dosyayı tekrar deneme mükerrer kayıt üretmemelidir. Mockup bu adımları bilgi diyaloğunda gösterir; tam import wizard'ı uygulanmış gibi davranmaz.

## Bileşen eşlemesi

| Ortak bileşen | Kullanım / mevcut dosya değişimi |
|---|---|
| PageHeader | `EmployeeFilters.tsx` içindeki kart başlığını `Employees.tsx` sayfa başlığına ayır; mevcut ikon kutusu ve tekrarlanan açıklama kaldırılır. |
| StatInline | `EmployeeStats.tsx` StatCard kullanımını kartsız proje kapsamı sayacına dönüştür. StatCard ortak bileşeni başka sayfalar için silinmez. |
| FilterBar | `EmployeeFilters.tsx`: label'lı arama/durum/size/temizle; URL state'i `Employees.tsx`. |
| BulkBar | `EmployeeBulkActions.tsx`: seçim kapsamı, hedef inceleme; mevcut mutation ve pending korunur. |
| DataTable / StatusBadge | `EmployeeTable.tsx`: ad butonu, birleşik avatar, menü, sıralama semantiği; `useEmployeeTable.ts` sıralaması parent/sorguya taşınır. `EmployeePagination.tsx` button sınırları ve clamp. |
| EmptyState / SectionSkeleton / ErrorState | Mevcut shared bileşenler korunur; `Employees.tsx` ve `useEmployees.ts` gerçek error/retry sınırına bağlanır. |
| Dialog / Sheet | `SlideOverPanel.tsx` dirty/pending kontrolü ve başlık/footer; `EmployeeDetails.tsx` section düzeni; `EmployeeDeleteDialog.tsx` mevcut ConfirmDestructive korunur. |
| Form alanları | `EmployeeForm.tsx`, `EmployeeFormFields.tsx`, `FormActions.tsx`, `PhotoUpload.tsx`: fieldset/id/hata/başarı özeti. `useEmployeeFormSubmit.ts` UI sonuç sözleşmesi, `useEmployeeFormData.ts` tam departman yolu seçenekleri. Form alanı adlarını zod bağına aykırı yeniden adlandırma yok. |
| Organizasyon | `DepartmentTree.tsx`, `DepartmentTreeItem.tsx`, `DepartmentProjectHeader.tsx`, `AddDepartmentDialog.tsx`: A2 görünümü, nested seçim, dokunma/klavye, mobil bölüm. |
| Veri kayıtları | `EmployeeConsentsCard.tsx`: amaç/kanıt/rol kararı sonrası sunum; mevcut “Rıza Al” akışı aynen görünürleştirilmez. |
| Yeni opsiyonel bileşenler | Kişi senkron/geçiş bölümü ve EmployeeImportDialog backend hazır olduğunda ayrıştırılabilir; mevcut dosyaları bu rapor silmez. Kullanılmayan FormFields dosyası import referansı doğrulanmadan silinmez. |

`src/index.css`, shell/sidebar ve ortak UI dosyaları Faz C ortak sahibinin alanıdır; bu teslim yalnız bu klasördeki HTML/rapor/kanıtları içerir.

## Backend gereksinimi

1. **Kişi bazlı senkron geçmişi:** mevcut `syncStatus.deviceSyncStatus({projectId})` yalnız proje özeti (`convex/syncStatus.ts:7`). Kişi + proje + hedef cihaz bazlı bounded sorgu ve açık sonuç sözleşmesi gerekir: queued/processing/failed/verified/unknown; verified yalnız gerçek cihaz onayı ve zaman kanıtı ile. Hik “done” teslim kanıtı sayılmaz (`convex/syncStatus.ts:19`). Kişi bazlı sayaç/teslim alanı modelde hazırmış gibi varsayılmadı.
2. **Son geçişler:** `cardReadings` gerçek alanları `convex/schema.ts:447`; `getEmployeeAttendanceDetail` kişi ve dönem alıyor (`convex/cardReadings.ts:1276`) fakat bütün PDKS hesabını ve collect'i getiriyor (`:1298`). Bu panel için yetkili proje/personel doğrulaması yapan, son N okumayı tarih sırasıyla getiren bounded hafif sorgu tercih edilir. Yeni event alanı gerekmez; deviceId → cihaz adı çözümü yapılır.
3. **Liste ölçeği:** `employees.list` proje index'iyle collect ve kişi başına ilişkiler okuyor (`convex/employees.ts:80`); `departments.list` collect (`convex/departments.ts:15`). İlk küçük veri diliminde frontend filtre/sıra düzeltilebilir; büyük projede filtre/sıra/cursor pagination ve kapsamlı sayaç API'si planlanmalı. Sayfalanmış N kişiden proje toplamı türetilmemeli.
4. **Personel import:** preview/apply, satır doğrulama, ilişki/proje ve duplicate kontrolleri, yeniden denemeye dayanıklı batch kimliği ve sonuç geçmişi yeni iş gerektirir. Mevcut create invariantları korunur; e-posta/cihaz süreçleri sonuçtan ayrı tutulur. Bu sayfa tasarımına hazır backend diye dahil edilmez.
5. **Erişim üyelikleri:** mevcut `accessRules.list({projectId})` + groupMembers kullanılabilir (`convex/accessRules.ts:46`); form zaten bunu yapıyor. Sırf detay için yeni üyelik alanı gerekmez; ölçek için kişi odaklı bounded okuma tercih edilir. Üst seviye departmana taşıma ileride istenirse `departments.update` nullable parent temizleme sözleşmesi ayrıca gerektirir; ilk dilimde sadece yeniden adlandır/ekle/sil.

Yeni telefon, işe giriş tarihi, personel numarası, senkron yüzdesi, onay skoru veya varsayılan biyometri durumu eklenmedi. Kullanılan “P-001” örnekleri var olan payrollCode'dur; türetilmiş departman yolu parentId/name'den gelir. TC maskeleme ve fotoğraf amaç metni sunum kararıdır, bu rapor hukuki uygunluk onayı değildir.

## Açık ürün soruları

1. Departman seçimi mevcut davranış gibi yalnız doğrudan bağlı kişileri mi kapsamalı, yoksa açık bir “Alt departmanları dahil et” seçeneği mi sunulmalı? Varsayım: doğrudan bağlı.
2. Departman yazma yetkisi personel admin yetkisiyle eşitlenecek mi? Mevcut departman backend'i authedMutation; UI bunu varsayımla daraltmamalı/genişletmemeli.
3. Fotoğraf/biyometri amaç ayrımı, rıza kaydı kanıtı ve bu kaydı görebilen/değiştirebilen roller nasıl tanımlanacak? Karar gelene kadar detayda biyometri eylemi açılmayacak.
4. İlk import yalnız yeni kişi ekleme mi, yoksa mevcut kişiyi güncelleme de içerecek mi? Varsayım: yalnız ekleme; güncelleme ayrı kapsam ve etki önizlemesi ister.

## Uygulama tahmini ve risk

**L · yaklaşık 40–56 saat** (ortak A2 kabuk/token bileşenleri hazır kabulüyle): liste/ağaç/responsive 12–16 saat, form/dirty/doğrulama/rol 10–14 saat, ayrıntı/sonuç sunumu ve mevcut sorgu bağlama 10–14 saat, 390/1440/klavye/durum doğrulama 8–12 saat. Yeni kişi bazlı senkron ve bounded geçiş API'si **+12–20 saat**, import **+20–32 saat**; bu backend işleri temel görsel dönüşüm tahminine dahil değildir.

Riskler: commit edilmemiş veri doğruluğu düzeltmelerini görsel refactor sırasında geriye almak; proje değişiminde taslak/seçim kaybı; backend yetkisiyle UI rolünün uyuşmaması; kuyruk başarısını cihaz teslimi sanmak; rıza yüzeyini amaç kararı olmadan görünürleştirmek; tüm veriyi alan sorguyu sayfalı sanmak. Kabulte mevcut nullable/duplicate/proje/yetki testleri korunmalı; son sayfa silme, iki aynı adlı departman, boş/uzun alan, kısmi cihaz sonucu, pending kapatma ve salt okunur detay denenmeli.

## Önizleme ve doğrulama

`mockup.html` ağ bağımlılığı olmayan tek dosyadır; inline SVG, yerel sistem fontu ve A2 tokenlarını kullanır. Ana etkileşimler: departman dal aç/kapat ve filtre, Türkçe isim sırası, arama/durum/temizle, sayfa seçimi/toplu etki özeti, kişi ayrıntısı, ekle/düzenle formu, alan doğrulama, fotoğraf yerel önizleme, dirty koruması; import yalnız öneri diyaloğudur. Kaydet ve toplu doğrulama canlı başarı mesajı taklit etmez.

### Son kontrol — 17.10.2026

- Chrome/Playwright CLI ile doğrudan `file://` açıldı; paket kurulmadı. Konsol: **0 hata, 0 uyarı**. Harici ağ isteği yok; yalnız yerel HTML dosyası yüklendi.
- 1440 × 1000: `documentElement.scrollWidth = 1440`; 390 × 844: `scrollWidth = 390`. Mobil ayrıntı ve form iç genişlik/scrollWidth: **389 / 389**; panel içinde de yatay taşma yok.
- Montaj filtresi **2 sonuç**; tümünü seç **2 kişi**; etki özeti Burak Yılmaz / P-002 ve Elif Şahin / P-006. Filtre temizlenince seçim çubuğu kapandı; eşleşmeyen aramada boş durum göründü.
- Mobil departman aç/kapat, alt dal kapanması, sidebar aç/kapat, kişi ayrıntısı ve Düzenle geçişi kontrol edildi. Yeni personel formu boş, düzenleme formu mevcut örnek kişiyle açılıyor.
- Boş Ad gönderiminde “Ad alanı zorunludur.” ve focus=`firstName`; Escape dirty diyaloğu açıyor, “Düzenlemeye devam et” taslağı koruyor. Geçerli form yalnız önizleme doğrulama mesajı veriyor; canlı kayıt/e-posta/cihaz sonucu üretilmiyor.
- Python `html.parser` ile tag stack dengesi ve yinelenen id kontrolü: **0 açık tag, 0 uyuşmazlık, 0 yinelenen id**. 18 bulgunun her biri mevcut kaynak satırı ve/veya incelenmiş ekran bölgesi içeriyor.
- Uygulama `src/**` / `convex/**` değiştirilmediği için TypeScript/lint/backend testleri çalıştırılmadı; HTML kapıları ve etkileşim kontrolleri uygulandı. Bu önizleme tam üretim erişilebilirlik sertifikasyonu veya canlı backend testi değildir.

Görsel kanıtlar: [Masaüstü liste](desktop-1440.png), [Mobil liste](mobile-390.png), [Masaüstü ayrıntı](detail-1440.png), [Mobil ayrıntı](detail-390.png), [Masaüstü form](form-1440.png), [Mobil form](form-390.png).
