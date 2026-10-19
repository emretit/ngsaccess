# 11 · Denetim Kaydı

## Özet

Denetim Kaydı, yetkili yöneticinin seçili proje kapsamındaki kayıtlı değişiklikleri kullanıcı, eylem, varlık ve tarihle incelemesini sağlar. En büyük üç sorun filtre temizlemenin proje kapsamını da değiştirmesi, eski/silinmiş aktörlerin kullanıcı seçeneklerinde eksik kalabilmesi ve uzun kimliklerle teknik notların olay okumayı zorlaştırmasıdır. Öneri A2 ortak kabuğu korur; açık kapsam, etiketli filtreler, sakin bir olay tablosu ve erişilebilir önce/sonra paneliyle mevcut cursor ve yetki sözleşmesini görünür kılar.

## Kapsam ve kaynak gerçeği

17.10.2026 tarihli çalışma ağacı, commit edilmemiş Dalga 3a değişiklikleri dahil incelendi. `src/**` ve `convex/**` değiştirilmedi. `docs/ui-scan/current/11-denetim-kaydi.png`, `11-denetim-kaydi-mobil.png`, `11-denetim-kaydi-mobil-2.png` açılıp incelendi; masaüstü `-2.png` mevcut değil. Görseller mevcut ekranın yalnız iki kayıtlı durumunu gösteriyor; diğer durumların bulguları kaynak incelemesine dayanıyor, canlı uygulama çalıştırılmadı.

A2 tasarım kaynağı `docs/ui-scan/DESIGN_DIRECTION.md` ve `directions/A2-sade-bordo-sidebar/{home,people}.html`; ortak kabuk sözleşmesi `pages/01-ana-sayfa/REPORT.md` “Kabuk” bölümü. Mockup ortak ana sayfa teslimindeki A2 kabuk CSS/markup ve etkileşimlerini devralır; filtre, tablo ve rozet sınıfları referansla aynıdır. Statik örnek olaylar gerçek alanlardan üretilmiştir; canlı veri veya gerçek toplam değildir.

### Önceki ADM bulgularının durumu

| Önceki bulgu | Güncel durum / kanıt |
|---|---|
| ADM-28 | Son 200 kayda kesme ana liste için kapanmış: `convex/auditLog.ts:97` tarihli index, `:120` cursor pagination; `src/pages/AuditLog.tsx:82` yüklenen eşleşme ile toplamı ayırıyor. Boş cursor sayfası sonuç sonu sayılmıyor (`:93`, `:227`). Yeniden veri kaybı bulgusu açılmadı. |
| ADM-29 | Kullanıcı/eylem/metin filtreleri, URL state, 300ms debounce mevcut (`AuditLog.tsx:276`, `:282`, `:327`); İstanbul tarih sınırları ve ters aralık doğrulaması mevcut (`auditLogQuery.ts:11`, `AuditLog.tsx:39`). Önceki “tüm filtreleri temizle kapsamı da sıfırlasın” önerisi uygulanmış; aşağıdaki AUD-UI-05 yeni kapsam/filtre ayrımı tasarım kararıdır, uygulanmamış eski hata değildir. |
| ADM-30 | İlk yükleme iskeleti, boş/filtreli boş, proje yok ve bölüm hata sınırları mevcut (`AuditLog.tsx:77`, `:93`, `:484`). Hata sonrası eylem ve devam yüklemesi duyurusu aşağıda kalan iyileştirmelerdir. |
| ADM-31 | Klavyeyle açılan adlandırılmış düğme, expanded/controls, tam kimlik kopyalama, Türkçe alan diff'i, ikincil ham JSON ve tüm projelerde proje kolonu mevcut (`AuditLog.tsx:140`, `:164`; `AuditChangeDetail.tsx:24`, `:47`, `:88`). Bunlar yokmuş gibi yeniden bulgu yazılmadı. |
| ADM-32 | Yönetim değişikliklerinin kapsamı halen sınırlı; kullanıcı/üyelik/proje yazımlarında audit çağrısı yok, `settings.ts:271` mesai oranı yazımı var. AUD-UI-17 bu açık borcu kapsar. |
| ADM-36/37, denetim kısmı | Tarih artık Europe/Istanbul, eylemler ortak StatusBadge kullanıyor (`AuditLog.tsx:39`, `:177`). Sabit eski yeşil/mavi sınıflar yeniden bulgu yapılmadı. |

## Mevcut durum taraması

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| AUD-UI-01 | Görsel hiyerarşi | Başlık, kapsam, saat dilimi, kapsam anahtarı ve tüm filtreler tek yuvarlak kartta; gövdede h2 kullanılıyor: `src/pages/AuditLog.tsx:359`; masaüstü üst blok. | Orta | Kartı kaldır; tek PageHeader h1, kapsam satırı ve ayrı FilterBar. Ortak header breadcrumb sözleşmesine uy. |
| AUD-UI-02 | Yerleşim / responsive | Üç select aramadan önce geliyor; altı kontrol + temizle tek wrap satırında, mobilde her biri ayrı uzun satır: `AuditLog.tsx:380`, `:425`, `:433`; iki mobil görselde liste ilk ekranın altında. Kabuk sıkışması SHELL-UI-01'dir, burada yeniden sahiplenilmez. | Yüksek | Arama önce, ardından kullanıcı/eylem/varlık; tarih ikinci satırda. 390px'te arama ve “Filtreler” düğmesi, kalanlar açılan panelde. |
| AUD-UI-03 | Erişilebilirlik / form | Tarih adı kapsayıcı div'e verilmiş, gerçek DatePicker düğmesi yalnız seçili tarih metnini taşıyor; hatayla bağlantısı yok: `AuditLog.tsx:433`, `:441`, `:479`; `src/components/ui/date-picker.tsx:13`, `:322`. | Orta | Görünür Başlangıç/Bitiş etiketleri; trigger id/aria-labelledby/aria-describedby; hata alan altında, iki alanla ilişkilendirilsin. |
| AUD-UI-04 | Mikro-metin | Proje yöneticisine “tek cursor altında birleştirilmez” teknik gerekçesi gösteriliyor: `AuditLog.tsx:472`. | Düşük | “Seçili projenin kayıtları gösteriliyor. Projeyi üst çubuktan değiştirebilirsiniz.” |
| AUD-UI-05 | Bileşen tutarlılığı / kapsam | Temizle eylemi `allProjects` parametresini de siliyor: `AuditLog.tsx:455`. Süper admin filtre temizleyince tüm-projeler kapsamından seçili projeye döner. | Yüksek | Kapsamı ayrı kontrol say; “Filtreleri temizle” yalnız q/user/action/target/start/end silsin. Kapsam değişimini kullanıcı açıkça yapsın. Bu önceki ADM tercihinin revizyonudur. |
| AUD-UI-06 | Durumlar: yükleniyor | Kullanıcı seçenekleri `undefined` iken etkin select ve “Tüm kullanıcılar” gösteriliyor; seçili değer varsa geçici “Bilinmeyen kullanıcı” çıkabilir: `AuditLog.tsx:249`, `:260`. | Orta | Ayrı “Kullanıcılar yükleniyor” disabled durumu; sonuç geldikten sonra gerçek boş/erişilemeyen aktör fallback'i. |
| AUD-UI-07 | Filtre / veri kapsamı | Seçenekler tarihsel audit aktörlerinden değil mevcut üyeler + sorgulayan kişiden geliyor; tüm projelerde yalnız mevcut users: `convex/auditLog.ts:144`. Eski üye, silinmiş aktör ve bazı dış süper admin olayları listede görünse de select'ten seçilemeyebilir; Sistem için seçenek yok. | Yüksek | Yetkili audit kapsamından tarihsel aktör seçenekleri ve Sistem filtresi; backend işi. Ara sürümde “Mevcut proje kullanıcıları” açıklamasıyla kapsamı dürüst göster. |
| AUD-UI-08 | Mikro-metin / arama | Arama açıklaması her zaman uzun ve sonuç üstünde; payload'dan ad/unvan arandığını ve e-posta/kimlik/kart araması olmadığını açıklamıyor: `AuditLog.tsx:88`, `:428`; `convex/lib/auditSearch.ts:3`, `:22`. İndeks eski kayıtlarda olmayabilir. | Orta | Arama altında kısa sınır açıklaması; açılır “Arama kapsamı” içinde eski kayıt ve 500 karakter sınırı. “Kimlik ara” vaat etme. |
| AUD-UI-09 | Yerleşim / tipografi | 6/7 eşit grid kolonunda tam ID ve uzun not yer alıyor; zaman dar, satırlar not uzunluğuna göre büyüyor: `AuditLog.tsx:116`, `:137`, `:193`, `:202`; masaüstü iki satır. | Orta | Zaman/kullanıcı/eylem/varlık/not/ayrıntı önceliği; tam kimliği ayrıntıda tut. Notu tek satır kısalt, tam metni panelde göster. |
| AUD-UI-10 | Mikro-metin | Geçmiş olaylar “Oluştur / Güncelle / Sil” emirleriyle etiketleniyor: `AuditLog.tsx:38`, `:186`; ekran rozetleri. | Orta | “Oluşturuldu / Güncellendi / Silindi”; bunlar olay türü, kaydı düzenleme/silme eylemi değil. |
| AUD-UI-11 | Durumlar: boş | Filtreli boş durumun açıklaması sadece proje kapsamını tekrar ediyor, içeride temizle eylemi yok: `AuditLog.tsx:93`. Tüm projelerde de “Seçili proje” diyor. | Orta | Filtreli boşta “Aramayı veya filtreleri değiştirin” + kapsamı koruyan temizle; gerçek boşta “Bu kapsamda henüz kayıtlı olay yok”. |
| AUD-UI-12 | Durumlar: yükleniyor / erişilebilirlik | Daha fazla yüklerken yalnız düğme metni değişiyor; yüklenen sayı p'sinde live/status yok: `AuditLog.tsx:81`, `:227`. Yeni sayfa sıfır eşleşme getirebilir (`convex/auditLog.ts:128`), kullanıcı ilerlemeyi fark etmeyebilir. | Orta | `aria-live=polite` sonuç durumu; listeyi koru, düğmeyi disabled/pending yap; “Yeni eşleşme bulunamadı; taranacak kayıtlar var” ile exhausted ayrımını koru. |
| AUD-UI-13 | Durumlar: hata | Yerel sınır var fakat fallback tekrar dene veya sıfırla eylemi sunmuyor: `src/components/admin/components/AdminDataBoundary.tsx:13`, `AuditLog.tsx:494`. | Orta | Sınırı gerçekten resetleyen “Tekrar dene”; filtreler ve kapsam kalır. Ek sayfa hatasında önceden yüklenmiş satırların korunması için pagination hata davranışı ayrıca doğrulansın. |
| AUD-UI-14 | Bileşen tutarlılığı | Diff'in her alanı ayrı border/rounded-lg kartı; ana satır, detay ve alan kutuları üst üste: `AuditChangeDetail.tsx:48`, `:61`; `AuditLog.tsx:133`. | Orta | Tek panel içinde 1px ayırıcılı Alan/Önce/Sonra tablosu; mobilde alan başlığı altında Önce/Sonra. Kartsız A2 ritmi. |
| AUD-UI-15 | Mikro-metin / veri anlamı | Diff yalnız boolean/null'u biçimliyor; ISO zamanlar, enum'lar ve sayısal timestamp'ler düz string oluyor: `src/components/audit/auditLabels.ts:113`; rıza ISO değerleri `convex/employeeConsents.ts:87`, `:112`. | Orta | Alan + varlık temelli formatter; TR tarih/saat ve bilinen enum sözlüğü. “—” için “Kaydedilmedi” açıklaması; eksik before değerini “hiç yoktu” diye yorumlama. |
| AUD-UI-16 | Mikro-metin / veri gizliliği | Arama allowlist'i görüntü maskelemesi değil: helper old/new/note'u aynen saklıyor, query aynen dönüyor, teknik JSON aynen render ediliyor (`convex/lib/audit.ts:25`, `convex/auditLog.ts:130`, `AuditChangeDetail.tsx:99`). KVKK cascade olayı yalnız sayılar içeriyor (`convex/lib/employeeCascade.ts:78`), dolayısıyla bu bir doğrulanmış sır sızıntısı iddiası değildir. | Orta | “Tüm kişisel veriler maskelenir” vaadi verme; izinli arama alanlarını anlat. Yeni hassas alan/aktarımı eklemeden sunucuda payload allowlist ve gösterim politikası tanımla; maskelenmiş değeri UI'da yeniden açma. |
| AUD-UI-17 | Mikro-metin / kapsam | Sayfa tüm yönetim eylemlerinin günlüğü gibi algılanabilir; hedef sözlüğü beş modül, yönetim mutasyonlarında kapsama açıkları sürüyor: `convex/lib/auditLogQuery.ts:3`, `convex/users.ts:67`, `convex/userProjects.ts:76`, `convex/settings.ts:271`. Önceki ADM-32 açık. | Yüksek | “Kayıt kapsamı” açıklaması: PDKS, tatil, mesai oranı, çalışan silme, rıza işlemlerinin mevcut audit yazımları; tüm eylemler vaadi yok. Kapsam genişletme ayrı backend işi. |

## Yeni tasarım

### Bilgi mimarisi ve eylemler

1. Ortak 216px sidebar / 64px üst bar, aktif Denetim Kaydı; Ana Sayfa / Denetim Kaydı breadcrumb. 760px altında ortak 248px menü Sheet'i. Kabuk yeniden tasarlanmaz.
2. PageHeader: “Denetim Kaydı”; “Merkez Ofis · İstanbul saati (UTC+3)”. Süper admin için ayrı “Tüm projeler” kapsam anahtarı; açıkken “Tüm projeler · Projesiz kayıtlar dahil”. Üst çubuk proje seçimini tutar ama bu görünümde listeyi daraltmadığını sayfa kapsamı açıklar.
3. FilterBar: görünür “Kayıtlarda ara”, kullanıcı, eylem, varlık; ikinci satır başlangıç/bitiş, temizle. Arama placeholder “Ad, varlık veya not”; 300ms debounce + URL `q` korunur. “Arama ve kayıt kapsamı” açılır açıklaması kısa yardımcı metnin altında.
4. Sonuç çizgisi: “6 eşleşen kayıt yüklendi · Daha fazla kayıt olabilir”, sağda “En yeni önce” veya metin ararken “Uygunluk sırası”. Toplam kayıt sayısı, başarı oranı veya KPI eklenmez.
5. Sakin olay tablosu; satırın tek işlemi “Ayrıntı”. Tıklanınca 720px modal yan panel, mobilde tam genişlik. Form/mutasyon yok; BulkBar, checkbox, ekle/sil düğmesi yok.
6. Alt bilgi: yüklenen sayı, 50'şer cursor devamı, “Daha fazla yükle”. `Exhausted` olduğunda “Bu kapsamdaki tüm eşleşmeler yüklendi”. Sayfa numarası/toplam sayfa uydurulmaz.

Salt okunur ekranın normal durumunda bordo birincil mutasyon yok. Liste ayrıntısı ve filtre temizleme ikincil eylemdir; hata halinde “Tekrar dene”, proje yok halinde “Proje seç” birincil olabilir. CSV/XLSX dışa aktarma mevcut kaynakta yok: mockup'a etkin buton eklenmedi, ayrı ürün kararı aşağıda.

### Kolon sözleşmesi

| Sıra | Kolon / kaynak | Masaüstü genişlik önceliği | 390px |
|---|---|---|---|
| 1 | Zaman / `timestamp` | 160px, TR gün ve saniyeli saat; tabular-nums | Ayrı kolon gizli, varlık hücresinde ikinci satır |
| 2 | Kullanıcı / `userName` | 160px; boş ise Sistem/Bilinmeyen ayrımı backend'den | Ayrı kolon gizli, varlık altında |
| 3 | Eylem / `action` | 116px | 104px, metin rozeti görünür |
| 4 | Varlık / `targetTable` | 150px, sözlük etiketi; isim yeni alan değil | Esnek ana hücre, zaman + kullanıcı taşınır |
| 5 | Proje / `projectName` | Yalnız allProjects, 140px | Ayrı kolon gizli, varlık altında görünür |
| 6 | Not / `note` | Kalan alan; tek satır ellipsis | Gizli, ayrıntıda tam metin |
| 7 | Ayrıntı | 80px | 40px adlandırılmış SVG düğme |

1440px'te 42px satır/36px başlık; tüm projeler kolonuyla not daralır. Uzun adlar detayda tam ve sarılabilir; ana tabloda kesilen değer tooltip'e bağımlı kalmadan panelde görülebilir. `targetId` bağımsız liste kolonu değildir, ayrıntıda tam değer ve Kopyala korunur. `userName` olay anı snapshot varsa onu kullanır; mevcut kullanıcı adıyla geçmişi yeniden yazma.

Mobil başlık 24px ve 16px kenar; arama görünür, “Filtreler (n)” diğer alanları açar. Panelde select'ler tek kolon, tarihler alan genişliği elverdiğinde iki kolon; temizle satıra sığar. Sonuç ve yükleme düğmesi alt alta; tüm içerik belge genişliğini aşmaz. Mobilde tabloya çevrilen olay satırları çerçeveli ayrı kartlar değildir.

### Filtre ve cursor davranışı

- Kullanıcı filtresi kimlik bazlıdır; aynı adlı farklı aktörler için güvenli ayırt edici etiket gereksinimi backend/ürün kararıdır. Mevcut seçeneklere olmayan Sistem/silinmiş kullanıcı seçeneği temel mockup'ta eklenmez.
- Eylem üç enum: create/update/delete → Oluşturuldu/Güncellendi/Silindi. Varlık seçenekleri mevcut beş `AUDIT_TARGET_LABELS`; yeni cihaz/ayar/üyelik seçeneği eklenmez.
- Başlangıç dahil İstanbul 00:00, bitiş dahil gün sonu; tek uç boş olabilir. Hata: “Başlangıç tarihi bitiş tarihinden sonra olamaz.” İki alana `aria-describedby`; geçersiz aralıkta query atılmaz ve sıfır sonuç gösterilmez.
- Filtre temizle kapsamı korur. Proje/kapsam değişiminde kullanıcı filtresi ve cursor sıfırlanır; diğer filtreler mevcut ürün davranışı gibi kalır. Yeni query sırasında eski projenin satırları yeni kapsam altında gösterilmez.
- Liste tarihli index'te en yeni önce; full-text aramada uygunluk sırası. Sunucu arama tarih filtresini paginate sonrası uyguluyor; diğer bileşik filtreler de sayfa sonrasında elenebiliyor. Bu nedenle “50 kayıt yükle” = 50 eşleşme garantisi değildir. İlk sıfır eşleşmede mevcut en çok beş otomatik deneme korunabilir; sonunda hâlâ `CanLoadMore` ise devam eylemi görünür kalır.
- `LoadingMore` mevcut satırları korur, çift isteği engeller; sayaç güncellemesi live bölgede. Normal listenin kullanıcı tetiklemeli cursor devamı “sonsuz otomatik scroll”a çevrilmez.

### Arama, maskeleme ve rol

Gerçek `searchText` üretimi: aktörün `fullName/name` değeri, hedef sözlüğü, not, old/new payload üst seviyesindeki `firstName`, `lastName`, `name`, `title`, `userName`; normalize edilmiş birleşik metin en çok 500 karakter (`convex/lib/auditSearch.ts:18`). E-posta fallback'i listede bulunabilir fakat aktör aramasına eklenmez (`convex/lib/audit.ts:23`, `:28`). Kimlik, kart/TC/telefon, derin JSON ve biyometrik içerik için arama vaadi yok; not alanı bütünüyle indekslendiğinden “yalnız adlar aranır” da doğru değildir. Hassas verilerin nota taşınmasını istememek, sadece payload allowlist'ine güvenmemek gerekir.

Eski `searchText` bulunmayan olaylar metin aramasına katılmaz; `q` temizlenince tarih/eylem/varlık filtreleriyle incelenebilir. UI arama kapsamı bu sınırlamayı görünür açıklar. Sunucuda gerçekten maskelenen/silinmiş değerler aynen kalır; detay panelinde “maskeyi aç” yeteneği yok. KVKK hukuki uygunluk değerlendirmesi yapılmadı; burada mevcut veri akışı ve önerilen ürün sözleşmesi belgelenir.

| Rol | Erişim ve kapsam |
|---|---|
| super_admin | Menü ve rota görünür; seçili erişilebilir proje veya açıkça Tüm projeler; global sorguda projesiz ve eski proje olayları bulunabilir. |
| project_admin | Menü ve rota görünür; tek seçili yetkili proje. Tüm projeler anahtarı yok; backend de reddeder. |
| project_user | Menü/palette öğesi yok; doğrudan URL'de “Denetim kaydını görüntüleme yetkiniz yok.” Veri query'si mount edilmez. |

Kaynak: `src/lib/capabilities.ts:4`, `AuditLog.tsx:354`, `convex/lib/customFunctions.ts:47`, `convex/auditLog.ts:88`, `convex/lib/projectScope.ts:6`. Frontend gizleme sunucu kontrolünün yerine geçmez. Mockup rol seçicisi yalnız önizleme aracıdır; ürüne rol değiştirme kontrolü eklenmez.

### Durum metinleri

| Durum | Metin / eylem |
|---|---|
| İlk yükleme | “Denetim kayıtları yükleniyor…” + 5 satır statik skeleton, `role=status`; 0 yazılmaz. |
| Devam yükleme | “Diğer kayıtlar yükleniyor…”; mevcut satırlar korunur; düğme disabled. |
| Sıfır eşleşmeli ara sayfa | “Taranan kayıtlarda eşleşme yok” / “Taranacak kayıtlar var; aramayı sürdürebilirsiniz.” / “Daha fazla yükle”. |
| Filtreli kesin boş | “Filtrelere uygun kayıt yok” / “Aramayı veya filtreleri değiştirin.” / “Filtreleri temizle”. |
| Gerçek boş | “Henüz denetim kaydı yok” / “Bu kapsamda kaydedilen olaylar burada görünür.” Kayıt oluştur CTA'sı yok. |
| Geçersiz tarih | Alan altı doğrulama; liste yerinde “Tarih aralığını düzeltin.” Aynı hatayı iki büyük kartta tekrar etme. |
| İlk sayfa hata | “Denetim kayıtları yüklenemedi” / “Filtreleriniz korunuyor. Yeniden deneyebilirsiniz.” / “Tekrar dene”. |
| Ek sayfa hata | “Diğer kayıtlar yüklenemedi” / “Yüklenen kayıtlar aşağıda korunuyor.” / “Tekrar dene”; bunun üretimde sınır/hook düzeniyle doğrulanması gerekir. |
| Proje yok/seçilmemiş | “Bir proje seçin” / “Denetim kayıtlarını görmek için üst çubuktan bir proje seçin.” Proje erişimi hiç yoksa atama açıklaması; süper admin tüm projeleri ayrıca açabilir. |
| Yetkisiz | “Denetim kaydını görüntüleme yetkiniz yok.” / “Ana Sayfa'ya dön”. |

### Ayrıntı paneli

Sıra: “Olay ayrıntısı” başlığı + Kapat; eylem, varlık, tarih/saat; kullanıcı ve proje; tam hedef kimliği + Kopyala; tam not; “Değişen alanlar” tablosu; ikincil kapalı “Teknik ayrıntı (JSON)”. `oldValue/newValue` dışında yeni event özeti backend alanı uydurulmaz. Kopyalama yalnız clipboard başarıyla tamamlanırsa “Hedef kimliği kopyalandı”, hata halinde “Kopyalanamadı; kimliği seçip kopyalayabilirsiniz.”

Alan/Önce/Sonra üçlüsü masaüstünde; 390px'te her alan altında iki etiketli değer. Eksik snapshot “Kaydedilmedi”; yaratma/silmede eksik taraf olayın semantiğiyle anlatılır. `cascade.*` gibi sayımlar korunur, 0 kaybolmaz; bool Evet/Hayır, ISO zaman TR, bilinen enum Türkçe; bilinmeyenler ham değer fallback'i. Ham JSON gerçek payload'dır, yeni türetilmiş veri veya gizli alan açıcı değildir. Diff yoksa “Alan düzeyinde değişiklik kaydedilmemiş.” Odak modal içinde kalır, Esc/kapat/dış alanla kapanır, açan satır düğmesine döner; başlık erişilebilir adıdır. Panel açıkken filtre değiştirilemez, böylece olayın bağlamı kaybolmaz.

## Bileşen eşlemesi

| Ortak bileşen | Değişecek yer (Faz C) | Uygulama |
|---|---|---|
| PageHeader | `src/pages/AuditLog.tsx` | Kart başlığını kaldır; h1, kapsam, rol ve saat dilimi. |
| FilterBar / FormField | `AuditLog.tsx`, `ui/date-picker.tsx` | Etiketli filtreler, mobil açılır panel, tarih trigger a11y prop'ları; URL/debounce korunur. |
| DataTable / StatusBadge | `AuditLog.tsx` içindeki AuditRows | Eşit grid yerine kolon önceliği, geçmiş zaman etiketleri, inline yükleme durumu. |
| Dialog/Sheet | `AuditLog.tsx`, `AuditChangeDetail.tsx` | Tek seçili olay paneli; row expansion state'i seçili event state'ine dönüşür. |
| Diff tablosu | `AuditChangeDetail.tsx`, `auditLabels.ts` | Alan kartlarını kaldır; tip/alan bazlı değer formatter, tam ID ve gerçek kopyalama. |
| EmptyState / ErrorState / SectionSkeleton | AuditRows, `AdminDataBoundary.tsx` | Sebebe uygun CTA, tekrar dene; ortak boundary değişikliği Admin/Ayarlar tüketicileriyle koordine edilir. |
| StatInline | Sonuç satırı | Yalnız yüklenen eşleşme sayısı; yeni aggregate değil. |
| BulkBar | Kullanılmaz | Denetim olayları salt okunur. |
| Shell | Ortak 01 teslimi | Sidebar/header/palette/proje/hesap aynen paylaşılır; sayfa paketi kabuğu yeniden değiştirmez. |

Dosya silmek gerekmiyor; eski inline satır expansion markup'ı panelle değiştirilir. AuditChanges diff algoritması ve tipler korunur.

## Backend gereksinimi

Temel A2 görünümü ve panel için yeni alan/endpoint gerekmiyor. Ayrı işler:

- AUD-UI-07: scope kontrollü tarihsel aktör seçenekleri; silinmiş aktör snapshot'ı, Sistem filtresi ve seçeneklerin arama/sayfalaması. `userId` optional olduğu için Sistem için ayrı discriminator gerekir; UI'nın sahte ID göndermesi uygun değil.
- ADM-32/AUD-UI-17: kullanıcı rolü, üyelik, proje ve ayar audit kapsamı genişletilecekse yazan mutasyonlarla aynı transaction; sırlar/kişisel alanlar için payload allowlist. Geçmişte yazılmayan olaylar geriye dönük icat edilmez.
- Arama geçmişi genişletilecekse yalnız güvenli alanlarla batch backfill; mevcut beyanı sessizce tüm JSON'a genişletme. 500 karakterlik birleşik kesmenin not sonrası adları dışarıda bırakabilmesi ayrı iyileştirme; ölçüm olmadan performans sorunu iddia edilmedi.
- İsteğe bağlı dışa aktarma: tüm filtreli kapsam mı yalnız yüklenen olaylar mı netleşmeli. Tam kapsam için yetkili server export/pagination, tarih/sıralama/kapsam metadata'sı, güvenli payload ve CSV formül kaçışı gerekir; tarayıcıdaki `results` listesini “tüm kayıtlar” diye indirmek yanlış olur. Bu teslimde uygulanmadı.

## Açık sorular (3)

1. “Filtreleri temizle” kapsamı korusun mu? Öneri evet; önceki ADM-29 kararının bilinçli revizyonu.
2. Tarihsel aktörler ve Sistem filtresi bu dalgada mı? Öneri araştırma iş akışına doğrudan etkisi nedeniyle dahil et; temel mockup mevcut kullanıcı seçeneklerini gösterir.
3. Dışa aktarma gerekli mi; gerekiyorsa tam filtreli kapsam ve hangi alanlar? Öneri ayrı backend işi onaylanana kadar etkin dışa aktar butonu gösterme.

## Uygulama tahmini

**M · 14–20 saat** (ortak A2 kabuk hazır varsayımı): başlık/filtre/tablo 5–7, panel/formatter/durumlar 5–7, rol/URL/cursor/mobil/klavye regresyonu 4–6 saat. Tarihsel aktör backend işi ayrıca 6–10 saat; kapsam genişletme ve export kapsam kararı olmadan bu tahmine dahil değil. Riskler: seyrek eşleşen cursor sayfalarını yanlış boş saymak, eksik before snapshot'ı yanlış yorumlamak, maskelenmiş değerleri yeniden üretmek, global kapsamı yanlış proje etiketi altında göstermek ve ortak DatePicker/boundary değişikliklerinin diğer ekranlara etkisi.

## Teslim ve doğrulama

`mockup.html` ağ bağımsız tek dosya: filtre/arama/tarih doğrulaması, olay paneli ve JSON, cursor benzetimi, rol/kapsam ve durum önizlemeleri içerir. Önizleme kontrolleri ürünün parçası değildir; arama yerel örneklerle işlev gösterir, Convex full-text sıralaması veya cursor doğruluğunu kanıtlamaz. Filtre URL sözleşmesi raporda üretim uygulaması için tanımlıdır; statik önizleme filtreleri URL’ye yazmaz.


- Yerel kurulu Playwright + Chrome ile `file://` üzerinden doğrulandı; ağdan paket kurulmadı. Ortak 01 tesliminde belgelenen CLI file protokolü kısıtı nedeniyle aynı kurulu Playwright'ın Node API'si kullanıldı.
- **3 rol × 7 durum × 2 genişlik = 42 kombinasyon** geçti; 1440px belge genişliği 1440, 390px belge genişliği 390. Konsol/pageerror **0**, harici HTTP isteği **0**.
- Eylem filtresi, kapsamı koruyan temizle, aramada kesin boş ve temizleme, ters tarih aralığı, önce/sonra paneli + JSON, modal Tab döngüsü ve Escape dönüş odağı, cursor devamı/tükenme, hata retry, klavye komut paleti, mobil menü ve proje değişimi kontrol edildi. Panel içi yatay taşma da yok.
- HTMLParser ile etiket dengesi ve 51 benzersiz id doğrulandı. `VERIFY.json` sonuçları ve `verify.cjs` yerel doğrulama betiğini içerir; `build_mockup.py` kabuktan üretimi tekrarlar.
- `desktop.png`, `mobile.png`, `detail-desktop.png`, `detail-mobile.png` açılarak görsel inceleme yapıldı. Panel kendi içinde dikey kayar; görüntüler viewport'taki bölümünü gösterir.
- Kod değiştirilmediği için tsc/eslint çalıştırılmadı. Gerçek Convex index/cursor, clipboard izinleri, ekran okuyucu ve dışa aktarma üretim testleri bu statik doğrulamanın kapsamında değildir.
