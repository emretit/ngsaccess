# 12 · Admin

## Özet

Admin, yalnız süper adminin sistem kullanıcılarını, proje üyeliklerini, projeleri ve fiziksel cihaz envanterini yönettiği küresel alandır. En büyük üç sorun kullanıcı yönetiminin Admin rotasında bulunmaması, önerilen proje pasife alma işleminin arayüzde olmaması ve cihaz kimliği/ataması ile yıkıcı işlem sonuçlarının yeterince açık sunulmamasıdır. Öneri A2 kabuğunu koruyarak Kullanıcılar, Projeler ve Cihaz havuzu sekmelerini; bağlama uygun tek birincil eylemi, sade tabloları ve nesne/etki odaklı onayları birleştirir.

## Kapsam ve korunacak düzeltmeler

17.10.2026 çalışma ağacının güncel dosyaları, commit edilmemiş Dalga 3a dahil incelendi; eski audit tek başına kaynak sayılmadı. `12-admin.png`, `12-admin-mobil.png`, `12-admin-mobil-2.png` açılarak incelendi; `12-admin-2.png` yok. Görseller mevcut Projeler sekmesini gösterir; Kullanıcılar, Cihazlar ve IDE değerlendirmeleri kaynak incelemesine dayanır, canlı oturum/DB/yerel cihaz servisi çalıştırılmadı.

`docs/ux-audit/04_AYARLAR_ADMIN.md` §5 UX-1'in ADM-1A/1B işleri bu öneriye dahildir. Şunlar **çözülmüş kabul edildi, yeni açık hata olarak tekrarlanmadı**:

- Yetki kapısı query alt ağacının önünde; Admin yalnız `capabilities.systemAdmin` (`SystemAdmin.tsx:25–35`). Ayarlar kullanıcı paneli proje yöneticisine davet, süper admine rol/üyelik/silme sunmaya devam eder (`capabilities.ts:8`).
- Mevcut üyelik okunur, rol+üyelik tek `users.updateRole` mutation'ında değişir; kendi/son süper admin koruması vardır (`useUserManagement.ts:18–27`, `convex/users.ts:70–98`, `convex/lib/adminGuards.ts:1`).
- Başarısız davet tekrar gönderimi başarı sayılmaz; gerçek pending kullanılır (`AdminUsersPanel.tsx:30–37,109`). Kullanıcı silme ve cihaz işlemleri ortak ConfirmDestructive kullanır.
- Proje silme iş verisinde engellenir; ayar/üyelik/davet/sohbet temizlenir, audit geçmişi korunur (`convex/projects.ts:94–117`). Cihaz durumu `useNow` ile yaşlanır; kayıt başarılı/atama başarısız durumu tekrar UUID kaydı yaratmadan sürdürülür (`AdminDevicesPanel.tsx:30,103–132`, `AdminDeviceDialog.tsx:105–141,231–243`).
- Parola sıfırlama disabled ve açıklamalıdır; tekrar “işlevsiz aktif eylem” bulgusu açılmadı (`UserTable.tsx:63–71`).

Kanıt tablosunda kısa dosya adları `src/components/admin/` altındadır; `components/` ve `hooks/` önekleri ilgili alt klasörleri gösterir. Başka kaynaklar tam göreli yolla yazılmıştır.

## Mevcut durum taraması

| ID | Kategori | Kanıt ve bulgu | Etki | Öneri |
|---|---|---|---|---|
| ADM-UI-01 | Yerleşim / görev akışı | `src/components/settings/sections/AdminDashboard.tsx:44–54` yalnız Proje & Kullanıcı ve Cihaz Yönetimi render eder; kullanıcı tablosu `src/pages/Settings.tsx:76` içindedir. Proje üyeleri listesi salt okunur (`AdminProjectsPanel.tsx:234–258`). | Yüksek | Kullanıcılar ayrı sekme; proje üye sayısından aynı panelin proje filtresine git. Ayarlar'daki ortak paneli ve rol sınırını koru. |
| ADM-UI-02 | Mikro-metin / form-diyalog | Proje silme metni pasife almayı önerir (`AdminProjectsPanel.tsx:321`), form yalnız ad/açıklama içerir (`:290–299`); `isActive` state'te ve mutation'da var (`:94,112`). | Yüksek | Düzenleme formuna Durum: Aktif/Pasif; silme engelinden “Proje durumunu düzenle” bağlantısı. Pasifin tüm erişimi iptal ettiği iddia edilmez. |
| ADM-UI-03 | Görsel hiyerarşi / AI arayüzü izi | `src/components/settings/sections/AdminDashboard.tsx:21–40` üç kart, uppercase etiket ve ikon; `12-admin.png` üst üçte kartlar. | Orta | Sekmeye ait tek satır StatInline; rol dağılımı rol filtresiyle okunur, sistem yöneticisi kartı kalkar. |
| ADM-UI-04 | Yerleşim / kapsam | `src/pages/SystemAdmin.tsx:40–44` genel açıklama/rol rozeti, gövdede h1 yok; global listeler `src/components/settings/sections/AdminDashboard.tsx:12–13` seçili proje argümanı almıyor. | Yüksek | h1 “Admin”, altı “Tüm projeler · Sistem yönetimi”; üst proje seçicisinin bu listeleri daraltmadığını açıkla. |
| ADM-UI-05 | Bileşen tutarlılığı | `src/components/settings/sections/AdminDashboard.tsx:44` kontrolsüz `defaultValue`; yenileme tekrar projects açar (önceki ADM-21). | Orta | `?tab=users|projects|devices`; geçersizde users. Filtreleri aynı URL'de tut, geri/ileri ve dirty form koruması. |
| ADM-UI-06 | Responsive | `AdminProjectsPanel.tsx:148–156`, `AdminDevicesPanel.tsx:57–77`, `components/UserTableHeader.tsx:19–32` tek yatay başlık, kullanıcı araması w-80. `12-admin-mobil-2.png` Yeni Proje kesiliyor. | Yüksek | Ortak PageHeader, arama tam genişlik; üç sekme 390px'e sığar. Kabuk daralma hatasını HOME sözleşmesi çözer, ayrıca yeniden tasarlanmaz. |
| ADM-UI-07 | Tipografi / tablo | `AdminProjectsPanel.tsx:163–169,195–209` ilk kolon kısa ID, ayrı açıklama ve tarih; görselde ad ikincil ve satırlar yüksek. | Orta | Proje adı ilk kolon; açıklama detayda; tarih düşük öncelik; ID kopyalama detayda, 42px ritim. |
| ADM-UI-08 | Bileşen tutarlılığı / renk | `AdminProjectsPanel.tsx:34–37` süper admin danger, yönetici info, üye success; `components/UserTable.tsx:33` tüm roller secondary. | Orta | Rol nötr metin/rozet; başarı/tehlike yalnız iş durumu. `roleLabel` korunur. |
| ADM-UI-09 | Form-diyalog | `AdminProjectsPanel.tsx:104–106,275–280,291–302` boşluk adı geçebilir; pending sırasında kapanış/alanlar korunmuyor; hata toast'ta. | Orta | Trim + alan altı hata; native form submit; dirty çıkış onayı; pending tüm kontroller ve kapanış kilitli. Backend de trim doğrulamalı. |
| ADM-UI-10 | Form-diyalog / erişilebilirlik | `components/UserFormDialog.tsx:71,78,115,122` label for ile SelectTrigger ID eşleşmiyor; `:58,138` form yerine div/click. | Orta | Bağlı id, fieldset/legend üyelik, Enter submit, ilk hataya odak ve alan altı mesaj. |
| ADM-UI-11 | Durumlar: yükleniyor | `AdminUsersPanel.tsx:109` `saving || !editReady` aynı prop; `UserFormDialog.tsx:139–140` üyelik sorgusunda “Kaydediliyor” yazar; kapat da engellenir. | Orta | “Üyelikler yükleniyor” ayrı iskelet; yalnız submit kapalı, yüklemede vazgeçilebilir; saving ayrı. |
| ADM-UI-12 | Mikro-metin / form | `UserFormDialog.tsx:53–55,142` “Yeni Kullanıcı/Oluştur”, gerçekte davet e-postası (`hooks/useUserManagement.ts:33`). Düzenlemede çıkarılan projelerin toplu özeti yok (`:93–111`). | Yüksek | “Kullanıcı davet et / Davet gönder”; düzenlemede rol tüm projelerde + eklenecek/kaldırılacak üyelik özeti, erişim azaltmada ConfirmDestructive. |
| ADM-UI-13 | Yerleşim / görünür veri | `components/UserTable.tsx:42–44,57–60` yalnız e-posta/rol; üyelik görünmez; arama sadece e-posta (`AdminUsersPanel.tsx:52–54`). | Orta | Ad/e-posta, rol, projeler; e-posta/ad arama, rol/proje filtresi. Üyelik `getAll` + projects ile, sunucu ölçeği ayrıca. |
| ADM-UI-14 | Durumlar: hata | `components/AdminDataBoundary.tsx:14–18` reset/retry yok, global Admin için “proje seçimini kontrol edin” yanıltıcı; `src/components/settings/sections/AdminDashboard.tsx:61` projeler hatası tüm dashboard'u düşürür. | Orta | Her panel ve özet kendi boundary'si; “Projeler yüklenemedi / Tekrar dene”; reset gerçek yeniden deneme sağlar. |
| ADM-UI-15 | Durumlar: boş-yükleniyor | `AdminUsersPanel.tsx:27,120` expired undefined → [] ve bölüm kaybolur; `:125–139` satırda proje/rol yok, yatay eylem sıkışır. | Orta | Ayrı Süresi dolan davetler bölümü; e-posta, proje, rol, bitiş; kendi skeleton/boş/hata ve yeniden gönder pending. Bekleyen davet statüsü uydurma. |
| ADM-UI-16 | Erişilebilirlik | `AdminDevicesPanel.tsx:107–110` tıklanabilir tr, klavye düğmesi yok; tek görünen düğme silme. | Yüksek | Cihaz adı gerçek button ve erişilebilir “işlemler” menüsü; aynı menü düzenle/ata/taşı/kaldır sunar. |
| ADM-UI-17 | Mikro-metin / veri doğruluğu | `AdminDevicesPanel.tsx:93,114,118,122,141` UUID başlığı altında seri no fallback, ham marka enum'u, eksik kapı 4 ve atanmamış “—”. | Orta | Kimlik altında açık UUID/Seri no türü; marka sözlüğü; eksik kapı “Bilinmiyor”; proje “Havuzda”. Null çevrimdışı yerine “Henüz görülmedi” ayrımı. |
| ADM-UI-18 | Mikro-metin / akış | `AdminDevicesPanel.tsx:59–61` atama için Cihazlar'a gönderirken `AdminDeviceDialog.tsx:257–280` yerinde atama var. “Senkronize Et” gerçek backfill'i saklar (`AdminDevicesPanel.tsx:38–47`, `convex/adminDevices.ts:116–143`). | Orta | Havuzdan doğrudan projeye ata; ikincil araç “Mevcut proje cihazlarını envantere al”, kısa etki açıklaması; bağlantı yenileme olarak sunma. |
| ADM-UI-19 | Form-diyalog / yıkıcı işlem | `AdminDeviceDialog.tsx:82–93` device prop değişince taslak resetlenir; `:322–327` taşıma kapı/geçmişi söyler, okuyucu/grup bağlantısı etkisini atlar. Gerçek silme `convex/lib/deviceHelpers.ts:24–49`. | Yüksek | Edit snapshot ve dirty koruması; kaynak→hedef, kapılar/okuyucular/grup cihaz bağlantıları ve bekleyen köprü işleri açıklanır. Geçmiş okuma korunur; eski yorum satırı sözleşme sayılmaz. |
| ADM-UI-20 | Durumlar / ölçek | `convex/users.ts:136`, `projects.ts:10`, `userProjects.ts:105`, `adminDevices.ts:16` collect; `AdminProjectsPanel.tsx:51–57` bütün üyelikleri açılmadan ister; cihaz/proje filtre yok. | Orta | İlk dalga mevcut veriyle yerel filtre ve sayfa boyutu; uzun vadede server search/cursor/özet ve talepte üyeler. Yerel pagination okunan belge yükünü azaltmaz. |
| ADM-UI-21 | Yerleşim / atıl yüzey | `IdeProvisioningCard.tsx:54` export; `src` aramasında import/render yok; `src/components/settings/sections/AdminDashboard.tsx:49–54` yalnız iki panel. | Orta | Cihaz havuzunda ikincil “IDE panel kurulumu” girişi önerilir; şu an erişilebilir özellik diye sunulmaz, ayrı UX-2 teslimi. |
| ADM-UI-22 | Durumlar / form-diyalog | Atıl IDE: `:109–112` sahte yüzde; `:298,315` IP değişir, `:175–182` güncel IP readback'i önceki result UUID'ye eklenir; `:345` configError gate değil. | Yüksek | Bağlamı IP+UUID ile sabitle; seçimde sonucu temizle; belirsiz ilerleme, timeout/iptal ve configError engeli; gerçek bağlantı doğrulanmadan başarı yok. Yayına bağlamadan çöz. |

## Yeni tasarım

### Bilgi mimarisi ve kabuk

Kabuk `../01-ana-sayfa/REPORT.md` “Kabuk” sözleşmesidir: 216px bordo sidebar, sabit 13 öğe sırası, Admin aktif, 64px üst bar, proje seçici her genişlikte, Ana Sayfa / Admin breadcrumb, sayfa paleti ve hesap menüsü. 760px altında 248px modal menü; 390px'te içerik 16px kenarla tam genişlik. Bu sayfa kabuğu değiştirmez. Üst proje seçimi global Admin listelerini değiştirmez; davet/cihaz formlarında hedef proje açık seçilir ve açık taslak sessiz değişmez.

Yukarıdan aşağıya: PageHeader “Admin” ve global kapsam; Kullanıcılar / Projeler / Cihaz havuzu sekmeleri; sekme içi StatInline; FilterBar; DataTable ve sayfa altı; kullanıcılarda ayrı süresi dolan davetler. Uzun tek sayfa önerilmez: üç farklı varlığın filtresi ve tehlikeli eylemleri birbirine karışır. Her sekmenin URL'si kalır; kullanıcı varsayılanı birleşik yönetim amacına uygundur.

Birincil eylem sekmeye göre yalnız bir tane: Kullanıcı davet et / Yeni proje / Cihaz kaydet. İkincil eylemler menülerde; IDE kurulumu ve envanter backfill'i yalnız cihaz bölümünde. Toplu silme/rol/taşıma yok: mevcut backend sözleşmesi ve yüksek etki nedeniyle BulkBar kullanılmaz.

### Kolonlar, filtre ve gerçek veri

| Sekme | Kolon sırası ve genişlik önceliği (masaüstü) | 390px davranışı |
|---|---|---|
| Kullanıcılar | Kullanıcı %38 (`fullName`, alt satır email; ad boşsa email); rol %20; projeler %34; işlemler 48px | Kullanıcı+rol+işlemler; üyelik bilgisi kimliğin altına taşınır, ayrı proje kolonu gizli. E-posta sarılır, tam metin detayda. |
| Projeler | Ad %42; durum %14; üyeler %16; oluşturulma %20; işlemler 48px | Ad altında tarih ve üye bağlantısı; durum ve menü kalır. Açıklama/ID form detayı, hover'a bağımlı değil. |
| Cihazlar | Ad/kimlik %29; marka %12; kapı %7; bağlantı/son görülme %22; proje %22; işlemler 48px | Ad, bağlantı, menü; marka/kimlik/proje ad hücresinde alt satır, kapı detayda. |
| Süresi dolan davetler | E-posta %35; rol %18; proje %22; dolma zamanı %15; yeniden gönder %10 | E-posta altında rol/proje/tarih; eylem kendi satırına sarılır. |

Masaüstü temel satır 42px, iki satırlı hücre 58px; başlık 36px, 12px veri metni. Tablo gölgesiz, zebra yok; tarih/sayı tabular-nums ve `tr-TR`, Europe/Istanbul. Mobil hücre yüksekliği içeriğe göre artar, dokunma hedefleri en az 36px; belge yatay taşmaz.

Kullanıcı filtreleri ad/e-posta, rol, proje (Tümü / Ataması yok dahil); proje filtreleri ad/açıklama ve durum; cihaz filtreleri ad/kimlik, proje (Havuzda dahil), bağlantı. Filtreleri temizle; 10/25/50 sayfa boyutu ve sonuç aralığı. Küçük örnekte bütün veri yerel; sayılar filtrelenmiş/gösterilen/toplam ayrımıyla yazılır. Sayfa değişince filtre korunur, filtre değişince ilk sayfaya dönülür. Kullanıcı rolü tüm projelerde geçerlidir, proje bazlı rol alanı eklenmez.

Rozetler: proje Aktif success/Pasif nötr; cihaz Çevrimiçi success/Çevrimdışı nötr/Henüz görülmedi nötr; havuz nötr; Süresi doldu warning. Roller nötr; super_admin “Tüm projeler” efektif erişimidir ve üyelik sayısı değildir. Kullanıcı Aktif/Pasif, son giriş, davet kabul oranı gibi doğrulanmamış metrikler eklenmez. Cihaz son görülme `lastSeen`, kimlik `ideUuid` veya `deviceSerial`, atama `assignedDeviceId/assignedProjectId/assignedProjectName`; `ideDoorCount` null ise tahmin edilmez. Sayılar listelerden türetilir, örnek veriler canlı ölçüm değildir.

### Durumlar ve Türkçe metinler

| Durum | Metin / eylem |
|---|---|
| Yetki yükleniyor / yetkisiz | “Yetkiler yükleniyor” status; sonra “Bu sayfa için süper admin yetkisi gerekli.” Admin sorguları yetki öncesi çalışmaz. |
| Liste yükleniyor | “Kullanıcılar yükleniyor” / “Projeler yükleniyor” / “Cihaz havuzu yükleniyor”; bölüm içi skeleton, aria-busy; sayaçta 0 gösterme. |
| Kullanıcı yok | “Henüz kullanıcı yok. Erişim vermek için bir kullanıcı davet edin.” / “Kullanıcı davet et”. Kendi hesabını listeleyen gerçek global kümede olağan durum değildir, savunmacı fallback. |
| Proje yok | “Henüz proje yok. Kullanıcı ve cihaz atamak için önce bir proje oluşturun.” / “Yeni proje”. Global Admin çalışmaya devam eder; davet hedefi kapalı ve proje oluştur bağlantısı. |
| Cihaz yok | “Envanterde cihaz yok. Panel UUID'si ile bir cihaz kaydedin.” / “Cihaz kaydet”. |
| Filtre sonucu yok | “Filtrelere uygun kayıt yok. Aramayı veya filtreleri değiştirin.” / “Filtreleri temizle”. |
| Bölüm hatası | “Cihaz havuzu yüklenemedi. Tekrar deneyin; diğer yönetim bölümlerini kullanabilirsiniz.” / “Tekrar dene”; yalnız ilgili query alt ağacı resetlenir. |
| Üyelik/davet sorgusu | “Üyelikler yükleniyor”; “Süresi dolan davetler yükleniyor”; “Süresi dolan davet yok”; hata halinde aynı bölümde yeniden dene. |
| Kayıt + atama kısmi başarı | “Cihaz kaydedildi, projeye atanamadı. Cihaz havuzda tutuluyor.” / “Tekrar ata” ve “Havuzda bırak”. Yeni register yapılmaz. |
| Proje silme engeli | Backend'in gerçek Türkçe bağlı veri mesajı dialog içinde; “Proje durumunu düzenle” ile forma geç. Önceden bilmediğimiz bağlı veri sayısı gösterilmez; 101 sınırında “en az” korunur. |
| IDE servis/işlem | “Yerel kurulum servisine ulaşılamadı”; “Ağ taranıyor”; “Panel bulunamadı”; “Ayarlar kısmen yazıldı”; “Bağlantı doğrulaması bekleniyor”. Yüzde ve çevrimiçi başarı ancak gerçek veriden. |

### Form ve onay sözleşmeleri

**Kullanıcı daveti:** E-posta → rol (Üye/Proje yöneticisi) → zorunlu proje. Süper admin daveti yok; “Davet gönder” e-posta işlemini anlatır. Trim/format hata metni e-posta altında “Geçerli bir e-posta adresi girin.”; “Bir proje seçin.” proje altında. Hata formu kapatmaz, başarı yalnız action.success sonrası.

**Kullanıcı düzenle:** kimlik salt okunur → rol ve “Bu rol tüm projelerde geçerlidir” → aramalı üyelik checklist'i → değişiklik özeti (eklenen ve kaldırılan proje adları) → Kaydet. Üyelik yüklenene kadar checklist yerine iskelet, kaydet disabled; vazgeç çalışır. Süper admin rolünde “Tüm projelere erişir” açıklaması; saklanan üyelikler sonraki rol düşüşündeki erişim olarak ayrıca açıklanır. Rol düşürme/üyelik kaldırmada onaydan sonra **tek** updateRole; onay öncesi hiçbir mutation yok. Kendi rol düşüşü/silmesi arayüzde gerekçeyle kapalı, backend son-admin koruması nihai otorite. Dirty taslak sekme/route/proje değişiminde uyarılır; reaktif query yeni değerle formu ezmez.

**Proje formu:** Ad zorunlu → açıklama opsiyonel → durum (düzenlemede Aktif/Pasif). Ad whitespace reddedilir; “Proje adını girin.” alan altında. 4 kolon label düzeni kalkar, bütün label'lar alan üstünde. Pasif “sistemden silindi” veya “erişim tamamen durdu” diye tanımlanmaz; mevcut `isActive` semantiği ile aktif proje seçicisinde listelenmeme anlatılır, global Admin'de görünür.

**Cihaz Sheet:** Panel UUID → ad opsiyonel → hedef proje (Havuzda kalsın seçeneği) → mevcut atama ve etkiler. UUID 15 rakam doğrulaması, düzenlemede salt okunur; kimlik türü seri no olan eski kayıtta seri no açık gösterilir, boş UUID gibi sunulmaz. Atanmamış cihazın sahiplenmesi `claimDevice`; atanmışın taşınması/boşaltılması `reassignDevice`, envanter silme `adminDevices.remove`. Proje listesi yüklenirken yalnız hedef seçimi/ona bağlı submit engellenir; havuz kaydı mümkündür. Kayıt/atama iki aşaması ve tekrar deneme korunur. Sheet masaüstü en çok 560px, mobil tam genişlik, alanlar dikey kaydırılır ve footer görünür; hata ilk alan yanında veya submit üstünde.

| ConfirmDestructive | Başlık / nesne | Etkiler ve onay metni |
|---|---|---|
| Kullanıcı silme | “Kullanıcı silinsin mi?” / ad + e-posta | Hesap ve kimlik doğrulama oturumları silinir; tüm proje üyelikleri kaldırılır; geri alınamaz. “Kullanıcıyı sil”. Personel kayıtlarını silme sözü verilmez. |
| Erişim azaltma | “Erişim değişikliği kaydedilsin mi?” / e-posta | Eski→yeni rol, kaldırılan proje adları, kalan erişim; “Erişimi güncelle”. Atomik kayıttan önce. |
| Proje silme | “Proje silinsin mi?” / tam proje adı | İş verisi varsa engellenir; ayarlar, üyelikler, davetler ve sohbetler silinir; denetim geçmişi korunur; geri alınamaz. “Projeyi sil”. Hata açık kalır, pasife alma formuna bağlantı. |
| Cihaz taşıma/havuza alma | “Cihazın proje ataması değiştirilsin mi?” / ad + kimlik | Kaynak→hedef veya Havuz; mevcut kapılar, okuyucular, grup cihaz bağlantıları ve bekleyen köprü işleri kaldırılır; bölge ve kart okuma geçmişi korunur; hedefte kapı/bölge kurulum akışı çalışır. “Atamayı değiştir”. |
| Envanterden silme | “Cihaz envanterden kaldırılsın mı?” / ad + kimlik | Atanmışsa yukarıdaki söküm ve proje adı; envanter kaydı da silinir; okuma geçmişi korunur. Atanmamışta yalnız envanter etkisi. “Envanterden kaldır”. |

Ortak onayda başlangıç odağı Vazgeç, Escape/dış tık kuralları, pending `İşlem sürüyor…`, çift submit engeli, başarısızlıkta nesnenin ve mesajın korunması, kapanışta tetikleyiciye odak. Kaynak satır kalkmışsa bölüm başlığına dönüş. `ConfirmDestructive` mevcut; silmelerde ikinci paralel confirm bileşeni oluşturulmaz. Proje formuna dirty guard ve onay hata alanı eklenmesi ortak sahip ile koordine edilir.

**IDE provizyon:** Cihaz havuzundaki ikincil girişten açılan kurulum paneli; mevcut atıl kart doğrudan yayınlanmaz. Önkoşul yerel servis + configError olmaması → alt ağ/manual IP → açık panel seçimi → L3 parola opsiyonel → paneli yeniden başlatacak işlem onayı → yazma sonucu → aynı IP+UUID için bağlantı doğrulama → UUID ile Cihaz kaydet formuna geçiş. Gizli parola log/özet/tabloya taşınmaz. Teknik servis başlatma komutu yalnız kurulum yardımı altında kalır; broker/readback teknik ayrıntıları açılır detaydadır. Kurulum sonucu kendiliğinden DB envanter kaydı veya proje ataması sayılmaz. Mockup yalnız servis yok halini ve girişini gösterir, localhost'a dahi ağ isteği atmaz.

## Bileşen eşlemesi ve Faz C sınırı

| Ortak bileşen | Değişecek tüketici | İş |
|---|---|---|
| PageHeader, StatInline | `SystemAdmin.tsx`, `settings/sections/AdminDashboard.tsx` | h1/global kapsam, üç URL sekmesi, kart sayaçlarını kaldır. |
| FilterBar, DataTable, StatusBadge | `AdminUsersPanel.tsx`, `components/UserTableHeader.tsx`, `components/UserTable.tsx`, `AdminProjectsPanel.tsx`, `AdminDevicesPanel.tsx` | Filtre, kolonlar, satır menüsü, rol/marka sözlüğü, mobil ikincil alanlar. UserTableHeader büyük başlık gövdesi kaldırılıp ortak header tüketilir. |
| EmptyState, SectionSkeleton, ErrorState | Aynı paneller + `components/AdminDataBoundary.tsx` | Bağımsız query state ve gerçek retry; sıfır ile bilinmeyeni ayır. |
| Dialog/Sheet, FormFieldWrapper | `components/UserFormDialog.tsx`, `hooks/useUserManagement.ts`, `AdminProjectsPanel.tsx`, `AdminDeviceDialog.tsx` | Native form, ayrı loading/saving, inline validation, dirty guard, erişim özeti. |
| ConfirmDestructive | `components/DeleteUserDialog.tsx`, projeler ve cihaz panelleri | Projedeki yerel AlertDialog yerine ortak onay; kapsam/etki metinleri; mevcut pending/focus korunur. |
| Kurulum bölümü | `IdeProvisioningCard.tsx` | UX-2'de atıl Card kabuğu yerine Sheet içerik; bağlam sabitleme ve gerçek durumlar tamamlanmadan aktive edilmez. |
| BulkBar | Kullanılmaz | Toplu yıkıcı endpoint ve ürün kararı yok. |
| Tipler / yetki | `types/user-types.ts`, `capabilities.ts`, ilgili Convex dosyaları | `FunctionReturnType`, schema `z.infer`, camelCase; frontend/backend rol sınırını koru. Yeni `any`, snake_case mapping yok. |

Silinmesi zorunlu bileşen dosyası yok. `UserPasswordResetDialog` atıl ve açık unavailable olarak kalabilir; auth işi olmadan aktif menüye dönmez. Settings ortak AdminUsersPanel tükettiğinden aynı dosyaya ADM-1A ve bu iş için iki bağımsız implementasyon atanmaz.

## Backend gereksinimi

- **Temel görsel/IA geçişi:** Yeni kalıcı alan gerekmiyor. Kullanıcı üyelik kolonları mevcut `userProjects.getAll` ve `projects.list` ile eşleştirilebilir; `users.updateRole` atomikliği korunur. Pasife alma mevcut `projects.update({isActive})` kullanır.
- **Doğrulama:** Proje create/update adını server tarafında trim edip boşluğu reddetmeli; frontend validasyon tek otorite değildir.
- **Ölçek:** Sunucuda kullanıcı/proje/cihaz arama-filtre-cursor ve doğru toplamlar için API işi gerekir (önceki ADM-22/UX-2C). Sadece frontend sayfalama bunun çözümü değildir; satırlar keyfi take ile eksiltilmez.
- **Silme önizlemesi opsiyonel:** Önceden bağlı veri dökümü istenirse salt okunur `getDeletionImpact` ve mutation içinde yeniden kontrol gerekir. Temel tasarım mevcut mutation hatasını gösterir; mockup sunucu sonucu örnekler, yeni bir bağlı-veri alanını varmış gibi listelemez.
- **IDE:** IP+UUID eşleşmesi/readback güveni ve gerçek doğrulama için yerel servis yanıt sözleşmesi gözden geçirilmeli; kalıcı envanter/atama ayrı mevcut mutation akışıdır. Servis bu taramada test edilmedi.
- Kullanıcı/proje atama veya silme için backend yetkileri gevşetilmez. `projects.remove` mevcut owner-or-super_admin izni Admin rotası dışında ayrı davranıştır; bu tasarım Admin görünürlüğünü değiştirmez.

## Açık sorular (3)

1. Admin'de Kullanıcılar varsayılanı ve Ayarlar'daki ortak kullanıcı panelinin korunması onaylanıyor mu? Öneri: super_admin Admin'den yönetir, proje yöneticisi Ayarlar'dan davet etmeye devam eder; tek bileşen.
2. Pasif proje sadece aktif seçici listesinden kalkmalı mı, yoksa tüm işlemler de sunucuda engellenmeli mi? Öneri: bu dalgada mevcut isActive sözleşmesi; tam arşiv/erişim iptali ayrı ürün kararı ve backend işi.
3. Atıl IDE kurulumu UX-2 güvenilirlik paketi tamamlanınca mı görünür olacak? Öneri: evet; A2 tasarımında giriş ve servis yok örneği bulunur, gerçek yayına alma bu taramanın kabulü değildir.

## Uygulama tahmini

**L · 28–38 saat:** ortak kabuk hazır varsayımıyla üç sekme/filtre/tablo 10–14s, form ve onay uyumu 8–10s, durum/erişilebilirlik/responsive ve regresyon 10–14s. IDE canlı akış ayrı **L · 12–16s**, server pagination/arama ayrı **L · 12–20s**. En büyük riskler ortak Settings kullanıcı tüketicisi, reaktif form snapshot'ı, çok projeli erişim düşüşü ve cihaz taşımanın gerçek cascade kapsamıdır; mevcut atomiklik ve geçmiş koruma testleri korunmalı.

## Teslim ve doğrulama

`mockup.html` tek dosya offline A2 önizlemesidir; kabuk/style temel olarak A2 referanslarını koruyan 01 mockup'ından alınmıştır. Üç sekme, filtreler, kullanıcı üyelik düzenleme/davet, proje düzenleme/silme engeli, cihaz atama/taşıma onayı ve IDE servis yok örneği içerir. Mutasyonlar yalnız örnek veride çalışır ve bu durum footer/form notlarında belirtilir; canlı başarı taklidi yapılmaz.

Yerel kurulu Playwright/Chrome ile `file://` üzerinden doğrulandı; paket kurulmadı. **3 sekme × 4 durum × 2 genişlik = 24 kombinasyonda** belge genişliği viewport ile eşit (1440/390px); toplam **64 kontrol geçti**, konsol/pageerror **0**, HTTP isteği **0**. Arama/filtre temizleme, bölüm retry, erişim azaltma özeti ve onayı, Escape ile forma dönüş, cihaz taşıma etkileri, proje silme engeli→durum formu, davet formu, URL sekmesinin yenilemede korunması, kabuk proje seçimi/paleti, mobil menü dönüş odağı ve dialog/Sheet sınırları kontrol edildi. Python `html.parser` ile etiket dengesi ve 80 benzersiz id doğrulandı.

`VERIFY.json` kontrol kayıtlarını; `users-1440.png`, `users-390.png`, `projects-*.png`, `devices-*.png`, `user-edit-*.png`, `move-confirm-*.png`, `mobile-menu.png` görsel kanıtları içerir. Ana görünümler ve taşıma onayı açılarak incelendi; dar filtre yazıları ve mobil Sheet sınırı düzeltilip ilgili kontroller yeniden çalıştırıldı. Örnek veri 10 kayıttan az olduğundan sayfalama kontrolleri tek sayfalı/disabled gösterilir; üretim sunucu pagination, dirty-route guard, gerçek e-posta/DB/cihaz ve ekran okuyucu doğrulaması bu statik teslimde yapılmadı.

Kaynak kod değişmediği için uygulama tsc/eslint çalıştırılmadı; kabul kapısı HTML, offline davranış ve responsive kontrollerdir. Yalnız `docs/ui-scan/pages/12-admin/` altına yazıldı; commit/push/deploy/migration yapılmadı.
