# Uygulama kabuğu, Dashboard ve Giriş/Kayıt — UX/UI Audit (2026-10-16)

> Kapsam: `/home`, `/`, `/login`, `/register`, `/verify-email`, `/auth`, `/check-in`, `/demo-request`, `/user-setup`, `/admin-setup`, `/employee-setup`, `*`; Layout/Header, `layout/**`, `dashboard/**`, `auth/**`, `landing/**`, `demo/**`, `shared/**`, tema dosyaları ve UI varyant kullanımları. Ek tarama: tüm `src/`.
> Sayım: 🔴 5 · 🟠 19 · 🟡 14 · ⚪ 1 — toplam 39 bulgu.
> Yöntem: salt okunur kaynak incelemesi, çağrılan sorguların kod takibi, `rg` + TypeScript AST sayımı ve token renklerinden matematiksel kontrast hesabı. Canlı DB, dev server, tarayıcı oturumu veya e-posta servisi kullanılmadı; piksel görünümü, ağ yarışı ve gerçek veri hacminde süreler **doğrulanmadı**. PDKS Kayıtları ekranına yeni audit yapılmadı; yalnız istenen tüm-src envanterinde sayıldı. Başlangıçtaki kirli kaynak dosyalarına dokunulmadı.

## 1. Özet

Bu ekran grubu yöneticinin ürünü keşfetmesi, hesap açması, doğru projeye girip günlük durumu anlaması için ana giriş kapısıdır. Dashboard seçilen projeyi kullanmıyor, gerçek verilerin yanında sabit aktivite rakamları gösteriyor ve pasif erişim kurallarını “bekleyen istek” diye adlandırıyor. Demo formunda üç alan sessizce kayboluyor; doğrulama kurtarma yolları ve tokensız personel kurulumu kullanıcıyı çıkmaza sokuyor. Ortak bileşenler mevcut olsa da kullanım çok düşük; Sonner sağlayıcısının eksikliği ve tema kontrastları uygulama genelinde geri bildirim kalitesini etkiliyor. Öncelik doğru veri ve tamamlanabilir akışlar, ardından erişilebilir formlar ve tutarlı kabuk olmalı.

## 2. Ana görevler

Adım = kullanıcının anlamlı eylemi veya ekran geçişi; alanların tek tek tuşlanması dahil değildir.

| Görev | Bugünkü akış (adım sayısı) | Takıldığı yer |
|---|---|---|
| Projenin günlük durumunu görmek | Giriş → logo/Ana Sayfa → proje menüsü → proje seçimi (4) | Menüde proje değişir, dashboard verisi değişmez; aktivite kartı sabittir. |
| Bir geçişi incelemek | `/home` → son okumalar → Tümünü Görüntüle (3) | Tarihsiz saat ve seçili projeden bağımsız veri; satırdan kayda doğrudan bağlantı yok. |
| Yeni yönetici hesabı açmak | Kayıt → form → e-posta → doğrulama → giriş (5) | Mail ulaşmazsa yeniden gönderme yolu güvenilir değil; kayıt ile e-posta talebi iki ayrı işlem. |
| Davetle katılmak | Davet bağlantısı → şifre → aktifleştir (3) | Mevcut hesap için ayrı giriş yolu yok; doğrulama guard'ı ile yarış ihtimali var. |
| Personel mobil hesabını etkinleştirmek | Bağlantı → şifre/tekrar → kaydet → mobil uygulama (4) | Token yoksa sonsuz yükleme; başarıda uygulama aç/indir bağlantısı yok. |
| Kurumsal demo istemek | Fiyatlandırma → Satış Ekibiyle Görüş → üç tanıtım bölümü → form → kayıt/doğrulama (5+) | Talep yerine hesap açılıyor; telefon/not/personel sayısı gönderilmiyor. |
| QR ile giriş yapmak | QR bağlantısı → konum izni → sonuç (3) | 10 saniyelik token içinde 5 saniye konum bekleniyor; hata ekranında kurtarma yok. |
| Yasal bilgi veya destek bulmak | Footer → Gizlilik/KVKK (2) | Rota yok; oturumsuz kişi 404 yerine giriş sayfasına sürüklenebilir. |

### Kapsam ve rubrik kontrol matrisi

Tüm aktif ekranlarda rubriğin 1–10 başlıkları incelendi; tabloda yalnız sorunlar ve olumlu mevcut davranışlar özetlenir. Form/veri listesi olmayan ekranlarda form/pagination maddesi uygulanamaz.

| Ekran/akış | Kontrol sonucu ve mevcut iyi davranış | İlgili bulgular |
|---|---|---|
| Kabuk + korumalı rotalar | Sidebar ve profil menüsü standart bileşen; route başlığı merkezi fakat eksik; oturum kontrolü var, dönüş URL'si yok. | SHL-09–15 |
| `/home` | Son okumalar 10 kayıtla sınırlı; tablo yatay kaydırılabilir; KPI yükleme, veri anlamı ve proje kapsamı sorunlu. | SHL-01–08 |
| `/login`, `/register` | `autocomplete`, required, pending/disabled ve kayıt için 8 karakter kontrolü var; kalıcı label ve kurtarma eksik. | SHL-16–20 |
| `/verify-email` | Yükleme/başarı/hata dalları var; süresi dolan link için yeniden gönderme mevcut ama yalnız bir hata türünde. | SHL-21 |
| `/user-setup` | E-posta dolduruluyor, şifre şartları görünür; mevcut hesap ve geçersiz davet akışı zayıf. | SHL-20, SHL-23–24 |
| `/admin-setup` | Yönetici varlığı bekleniyor ve form kapatılıyor; gizli kod alanı maskeli; teknik kopya ve ara durum yönetimi sorunlu. | SHL-24, SHL-33 |
| `/employee-setup` | Geçerli/expired/başarı ekranları ve şifre tekrarı var; tokensız dal yüklemede kalıyor. | SHL-20, SHL-22, SHL-34 |
| `/check-in` | Sonuç için ayrı başarı/hata görünümü var; konumun anlamı, token ömrü ve yeniden deneme eksik. | SHL-25–26 |
| `/` | Semantik bölüm başlıkları, accordion, responsive grid ve menü etiketi var; tablet navigasyonu ve bağlantı hedefleri sorunlu. | SHL-29–32, SHL-38 |
| `/demo-request` | Etiketli form ve pending submit var; form sayfanın dördüncü bölümü, CTA çalışmıyor, üç alan kayboluyor. | SHL-27–29, SHL-31–32 |
| `*` / NotFound | Türkçe 404 var; auth yönlendirmesi ve ana sayfa hedefi akışa uymuyor, sabit renk kullanıyor. | SHL-12, SHL-30, SHL-37 |
| `/auth` ve eski Header/Calendar/Chart | `/auth` Login'e yönlendirme; eski Auth ekranı ve eski Header/Calendar/Chart aktif rotada render edilmiyor. | SHL-39 |
| Tasarım sistemi | Shared state/form/stat bileşenleri, focus-visible ve semantik renkler mevcut; ortak tüketim ve bildirim sağlayıcısı eksik. | SHL-35–38, bölüm 7 |

## 3. Bulgular

Önem: 🔴 Kritik (yanlış veri/kırık akış/veri kaybı) · 🟠 Yüksek · 🟡 Orta · ⚪ Düşük. Efor: S <2 saat, M yaklaşık yarım gün, L 1+ gün. Kategori numaraları görev rubriğine karşılık gelir.

### Dashboard: veri doğruluğu ve algılanan performans

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| SHL-01 | 🔴 Kritik | 1,2 | **Seçilen proje dashboard'a uygulanmıyor.** Hook yalnız erişim yüklemesini alıyor; sorguya aktif proje gitmiyor. Backend tüm yetkili projeleri/super admin için tüm sistemi sayıyor. Kullanıcı alt menüde gördüğü projenin sayıları sandığı başka kapsamı okuyor. | `src/hooks/useDashboard.ts:10`, `src/hooks/useDashboard.ts:14`, `convex/dashboard.ts:35`, `convex/dashboard.ts:63`, `convex/dashboard.ts:767` | Aktif proje ID'sini iki sorguya ilet; sunucuda üyeliği doğrula; KPI ve listede aynı kapsamı başlıkta belirt. “Tüm projeler” gerekiyorsa açık ayrı seçim olsun. | L |
| SHL-02 | 🔴 Kritik | 1 | **Aktivite Özeti gerçek operasyonel veri gibi sabit 08:00–18:00, 08:32, 17:45 ve 3 geç kalan gösteriyor.** Bileşen prop veya sorgu almıyor ve `/home` üzerinde aktif. | `src/components/dashboard/ActivitySummaryCard.tsx:19`, `src/components/dashboard/ActivitySummaryCard.tsx:31`, `src/pages/Index.tsx:41` | Veri bağlanana kadar kartı kaldır; sonrasında seçili proje/gün için hesaplanan ve “veri yok” ayrımı olan özet göster. | S / veri bağlama L |
| SHL-03 | 🔴 Kritik | 1,8 | **“Bekleyen İstekler” gerçekte `isActive=false` erişim kuralları sayısı.** Pasif kuralın onay bekleyen talep olarak yorumlanması yanlış işe yönlendiriyor. | `src/components/dashboard/StatsGrid.tsx:30`, `convex/dashboard.ts:58`, `convex/dashboard.ts:98`, `convex/dashboard.ts:113` | Gerçek talep modeli yoksa “Pasif erişim kuralları” olarak adlandır veya kartı kaldır; talep sayısı tasarlanırsa hangi durumları saydığı açık olsun. | S |
| SHL-04 | 🟠 Yüksek | 1,9 | Proje kullanıcısında son 10 okuma `by_project` ile oluşturulma sırasından alınıp sonra `accessTime` ile sıralanıyor. Sonradan gelen eski cihaz kayıtları, gerçek son geçişleri ilk 10 dışında bırakabilir. | `convex/dashboard.ts:770`, `convex/dashboard.ts:777`, `convex/schema.ts:472` | `by_project_access_time` üzerinde desc/take yap; geç gelen eski olay ile test et. Bu koşulun canlı veride görülmesi doğrulanmadı, sıralama sözleşmesi kodda açık. | M |
| SHL-05 | 🟡 Orta | 1,3 | “Verileri Yenile” iki boş fonksiyonu çağırıyor; işlem ve geri bildirim yok. | `src/components/dashboard/DashboardHeader.tsx:20`, `src/hooks/useDashboard.ts:35`, `src/hooks/useDashboard.ts:36` | Butonu kaldırıp gerçek abonelik durumuna bağlı “Canlı” bilgisi göster; bağlantı hatasında işlevli yeniden bağlanma sun. | S |
| SHL-06 | 🟡 Orta | 3,9 | İlk sorgu/proje değişiminde KPI'lar yüklenme yerine **0** oluyor; tablo da kendi sorgusu hazır olsa bile stats yüklemesine bağlı bekliyor. Sıfır gerçek sonuçla ayırt edilmiyor. | `src/hooks/useDashboard.ts:29`, `src/pages/Index.tsx:22`, `src/pages/Index.tsx:38`, `src/pages/Index.tsx:46` | Her bölüm kendi iskeletini kullansın; proje değişiminde eski veri gösterilirse kapsamı belirt; sıfır yalnız kesin sonuç için gösterilsin. | M |
| SHL-07 | 🟡 Orta | 1,3,8 | Son kayıtlar tarih sınırı olmayan sorgudan geliyor, tabloda yalnız saat var; önceki günün kaydı bugünkü sanılabilir. Boş durum tek cümle, sonraki adım yok. | `convex/dashboard.ts:760`, `src/components/dashboard/RecentReadingsTable.tsx:68`, `src/components/dashboard/RecentReadingsTable.tsx:79` | İstanbul saat diliminde “Bugün 09:12 / 15 Eki 09:12” göster; shared EmptyState ile yetkili kullanıcıya cihaz/personel kurulum bağlantısı ver. | M |
| SHL-08 | 🟠 Yüksek | 9 | Dört sayaç için koleksiyonlar tamamen okunuyor; geçişlerin tarih koşulu index aralığı yerine `filter`. Büyük projede geçmiş büyüdükçe dashboard gecikebilir. Canlı süre ölçülmedi. | `convex/dashboard.ts:46`, `convex/dashboard.ts:50`, `convex/dashboard.ts:83`, `convex/dashboard.ts:110` | Önce tarih/proje index aralığı; büyüyen sayılar için gün/proje sayaç veya aggregate. Rastgele `take()` ile sayaç kesme yapılmamalı. Son kayıtların cihaz lookup'ı en çok 10 olduğundan ana darboğaz diye sunulmamalı. | L |

### Kabuk, navigasyon ve oturum sınırları

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| SHL-09 | 🟡 Orta | 1,10 | Üst çubuk profil tipini `photo_url` olarak kopyalayıp cast ediyor; gerçek alan `photoUrl`. Yüklenen profil fotoğrafı burada görünmez. | `src/components/layout/AppHeader.tsx:23`, `src/components/layout/AppHeader.tsx:39`, `src/components/layout/AppHeader.tsx:70`, `convex/schema.ts:26` | Doğrudan `useAuth` sonucunu kullan; `photoUrl`; profil menüsüne “Hesap menüsü” adı ver. | S |
| SHL-10 | 🟡 Orta | 1,3 | Bildirim zili daima kırmızı noktalı fakat `onClick`, menü veya veri kaynağı yok. Erişilebilir adı `sr-only` ile mevcut; sorun aria-label eksikliği değil işlevsizliği. | `src/components/layout/AppHeader.tsx:60` | İşlev hazır değilse kaldır; hazır olduğunda gerçek okunmamış sayısı ve boş durumlu panel bağla. | S |
| SHL-11 | 🟠 Yüksek | 2,6 | Sidebar daraltılınca **proje seçici tamamen gizleniyor**, yalnız etiket değil düğme de kayboluyor. Şube bağlamı görünmez. Ayrıca ilk yüklemede proje sorguları henüz undefined iken boş `projectIds` effect’i saklanan proje seçimini silebilir (soğuk açılış davranışı çalışma zamanında doğrulanmadı). | `src/components/layout/ProjectSwitcher.tsx:36`, `src/components/layout/ProjectSwitcher.tsx:65`, `src/components/layout/AppSidebar.tsx:15`, `src/contexts/ActiveProjectContext.tsx:88` | Proje seçiciyi üst çubukta kalıcı tut veya dar menüde etiketli ikon tetikleyicisi bırak; saklanan seçimi ancak proje sorgusu tamamlanınca doğrula. | M |
| SHL-12 | 🟡 Orta | 1,2 | Oturumsuz derin bağlantı Login'e gidiyor, giriş sonrası daima `/home`; aranan rota/filtreler kayboluyor. Layout ve AuthProvider aynı yönlendirmeyi tekrar ediyor. | `src/components/Layout.tsx:39`, `src/components/auth/AuthProvider.tsx:104`, `src/components/auth/AuthProvider.tsx:111`, `src/pages/Login.tsx:39` | Tek korumalı rota sınırı; güvenli göreli `returnTo` içinde pathname+search+hash; başarılı girişte restore ve replace. | M |
| SHL-13 | 🟠 Yüksek | 3,9 | Suspense tüm Routes'u, ErrorBoundary bütün uygulamayı sarıyor. Yeni lazy rota veya bir sorgu hatası kabuğu da kaldırabilir; hata ekranında iki tekrar deneme var ama uygulama içinde başka sayfaya kaçış yok. | `src/App.tsx:51`, `src/App.tsx:88`, `src/components/ErrorBoundary.tsx:38`, `src/components/ErrorBoundary.tsx:55` | Kalıcı kabuk içinde Outlet düzeyinde Suspense/ErrorBoundary; sayfa iskeleti, shared ErrorState, Ana Sayfa ve gerçek retry. Global boundary son savunma olarak kalsın. | M |
| SHL-14 | 🟡 Orta | 2,3,8 | Projesiz kullanıcıda seçici `null`, ana sayfa sıfırlar; atanma/kurulum durumunun açıklaması yok. Menüde Ana Sayfa ve Sanal Okuyucular yok; audit/engineering/virtual-readers için routeTitle boş. | `src/components/layout/ProjectSwitcher.tsx:28`, `src/components/Layout.tsx:10`, `src/components/layout/AppSidebarNav.tsx:30`, `src/hooks/useDashboard.ts:29` | Ortak rota meta tablosu; Ana Sayfa ve uygun cihaz alt rotası; “Proje hazırlanıyor / atama bekleniyor” ile sonraki adım. Marka logosu tek keşif yolu olmamalı. | M |
| SHL-15 | 🟠 Yüksek | 1,3 | `ProjectFilter requiredRole="admin"` rol yerine **proje üyeliğine** bakıyor. Proje kullanıcısına yönetici ekranı açılabilir, işlemde backend reddiyle karşılaşır; diğer role değerleri de gerçek role göre kontrol edilmiyor. Bu bulgu backend yetki aşımı iddiası değildir. | `src/components/auth/ProjectFilter.tsx:25`, `src/components/auth/ProjectFilter.tsx:26`, `src/components/admin/AdminUsersPanel.tsx:85` | Context'teki `isAdmin` ve açık rol matrisi; shared AccessDenied; rota/aksiyon uygunluğunu aynı kaynaktan türet. | M |

### Giriş, kayıt ve doğrulama

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| SHL-16 | 🟠 Yüksek | 1,2 | Giriş ekranında “Şifremi unuttum” veya yöneticiden yardım yolu yok; Auth yalnız Password sağlayıcısı tanımlıyor. Davet backend'i reset türünün henüz uygulanmadığını belirtiyor. | `src/pages/Login.tsx:233`, `convex/auth.ts:6`, `convex/invites.ts:11` | Önce görünür yardım; sonra e-posta tabanlı sıfırlama, tek kullanımlık süreli token ve yeni şifre akışı. Davet oluşturmayı parola sıfırlama diye sunma. | L |
| SHL-17 | 🟠 Yüksek | 1,3 | Doğrulanmamış girişte “Tekrar gönder” yalnız `signInError` metninde `doğrula` bulunursa açılıyor. Provider doğrulanmamış kullanıcıyı sonradan effect ile çıkarıyor, `signIn` ise başarı döndürüyor; bu dal banner state'ini set etmiyor. Kayıt sonrası banner da resend içermiyor. | `src/pages/Login.tsx:73`, `src/pages/Login.tsx:132`, `src/pages/Login.tsx:145`, `src/components/auth/AuthProvider.tsx:68`, `src/components/auth/AuthProvider.tsx:121` | Yapısal `verificationRequired` durumu veya ayrı doğrulama bekleme ekranı; e-posta korunsun; yeniden gönderme görünür, bekleme süreli ve değişen e-postada reset olsun. | M |
| SHL-18 | 🟠 Yüksek | 1,3 | Hesap oluşturma başarılı olup doğrulama talebi başarısız olursa tek “kayıt hatası” dönüyor; kullanıcı mevcut hesabına rağmen yeniden kayıt denemeye yöneliyor. Bu iki işlem atomik değil. | `src/components/auth/AuthProvider.tsx:150`, `src/components/auth/AuthProvider.tsx:158`, `src/components/auth/AuthProvider.tsx:169`, `src/pages/Register.tsx:61` | “Hesabınız oluşturuldu, e-postayı gönderemedik” ara durumu; yeniden kayıt yerine resend; alanları ve e-postayı koru. Ağ hatası senaryosunu izole test et. | M |
| SHL-19 | 🟠 Yüksek | 4,7 | Aktif Login/Register alanları yalnız placeholder ile tanımlı; kalıcı label/id bağı yok. Form geneli hata metni alanlara bağlı değil ve `role=alert` değil. Browser required mesajının dili tarayıcıya bağlı. | `src/pages/Login.tsx:172`, `src/pages/Login.tsx:212`, `src/pages/Register.tsx:176`, `src/pages/Register.tsx:217` | Shared FormFieldWrapper, görünür etiket, zod Türkçe alan hataları, aria-invalid/describedby; ilk hataya odak. Şifre alanında helper ayrı kalsın. | M |
| SHL-20 | 🟡 Orta | 4,6,7 | Login/Register şifre göster düğmesi `tabIndex=-1`; UserSetup/EmployeeSetup göz düğmeleri adsız ve ikon büyüklüğünde hedef. Setup alanları submit sırasında düzenlenebilir; kullanıcı ekranda yeni değer görürken önceki payload kaydolabilir. | `src/pages/Login.tsx:199`, `src/pages/Register.tsx:204`, `src/pages/UserSetup.tsx:156`, `src/pages/EmployeeSetup.tsx:152`, `src/pages/EmployeeSetup.tsx:168` | Ortak PasswordField: klavyeyle erişim, değişen Türkçe aria-label, aria-pressed, en az 44px ürün hedefi; beklerken ilgili formu kilitle. | M |
| SHL-21 | 🟠 Yüksek | 1,3,8 | VerifyEmail ham exception'ı gösteriyor (`EXPIRED:` dahil); yalnız expired durumda resend var, geçersiz/tüketilmiş bağlantıda **“Yeniden kayıt ol”** sunuluyor. Token URL değişse bile `ranRef` ikinci doğrulamayı engelliyor. | `src/pages/VerifyEmail.tsx:28`, `src/pages/VerifyEmail.tsx:42`, `src/pages/VerifyEmail.tsx:117`, `src/pages/VerifyEmail.tsx:150`, `convex/emailVerification.ts:94` | Hata kodlarını Türkçe duruma map et; giriş + güvenli resend seçenekleri; token başına çalışma ve state reset. Resend formunda etiket ve geçerli e-posta kontrolü olsun. | M |

### Kurulum ve QR giriş

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| SHL-22 | 🔴 Kritik | 1,3 | **`/employee-setup` tokensız açıldığında sorgu skip → undefined; yükleme dalı geçersiz bağlantı dalından önce dönüyor.** Toast sonrası ekran süresiz “Yükleniyor...” kalır. | `src/pages/EmployeeSetup.tsx:25`, `src/pages/EmployeeSetup.tsx:83`, `src/pages/EmployeeSetup.tsx:116` | Token yokluğunu loading'den önce ele al; eksik/geçersiz/süresi dolmuş token durumlarını ayrı test et. | S |
| SHL-23 | 🟠 Yüksek | 1,2,4 | Davet ekranı her kullanıcıya yeni şifre belirletiyor; mevcut hesap için ancak exception `already/mevcut` içerirse signIn deniyor. Mevcut şifre farklı gereksinimdeyse form girişi engelleyebilir. `inviteData.type` reset/invite ayrımı UI'da kullanılmıyor; geçersiz davet Login'e toast ile kayboluyor. | `src/pages/UserSetup.tsx:61`, `src/pages/UserSetup.tsx:84`, `src/pages/UserSetup.tsx:94`, `src/pages/UserSetup.tsx:51`, `convex/invites.ts:105` | “Mevcut hesabımla giriş / yeni hesap” açık yolları; davetin hedef proje/rolünü anlaşılır isimle göster; expired ekranını koru; reset türünü desteklenene kadar açıkça reddet. | L |
| SHL-24 | 🟠 Yüksek | 1,3 | **Kurulumda doğrulama yarışı riski (doğrulanmadı).** UserSetup/AdminSetup doğrudan auth signUp çağırıyor; yeni kullanıcı `verified=false`, global effect signOut edebilir. `signingUpRef` yalnız Provider.signUp içinde set ediliyor; invite tüketimi/admin initialize bitmeden logout olabilir. | `src/pages/UserSetup.tsx:84`, `src/pages/AdminSetup.tsx:39`, `src/components/auth/AuthProvider.tsx:63`, `src/components/auth/AuthProvider.tsx:68`, `convex/auth.ts:38` | Kurulum durum makinesiyle yalnız ilgili akışta yönlendirmeyi ertele; backend doğrulama korumasını gevşetme. Profil aboneliği hızlı, mutation yavaş senaryosunda test ederek yarışı doğrula. | L |
| SHL-25 | 🟠 Yüksek | 1,8 | QR ekranı GPS koordinatı alınmasını “Konum doğrulaması yapıldı” diye sunuyor. Backend yalnız koordinatı rawData'ya yazıyor; izinli alan/mesafe kontrolü yok. Bu mesaj güvenlik sonucunu olduğundan güçlü gösteriyor. | `src/pages/CheckIn.tsx:38`, `src/pages/CheckIn.tsx:85`, `convex/employeeCheckIn.ts:70` | “Konum bilgisi kayda eklendi” de; gerçekten doğrulama istenirse sunucu tarafı politika ve açık ret nedeni tasarla. | S |
| SHL-26 | 🟠 Yüksek | 1,3,8 | QR token 10 saniye geçerli; sayfa mutation öncesi 5 saniye GPS bekliyor. Konum beklenirken “Giriş kaydediliyor” deniyor; hata sonrası yeniden tarama talimatı/eylemi yok; başarı ham ISO zaman yazıyor. Tekrar mount edilen mutation kullanılmış token hatasıyla başarıyı örtebilir (çalışma zamanı doğrulanmadı). | `convex/employeeCheckIn.ts:16`, `src/pages/CheckIn.tsx:32`, `src/pages/CheckIn.tsx:44`, `src/pages/CheckIn.tsx:51`, `src/pages/CheckIn.tsx:90` | Konum alma/kaydetme durumlarını ayır; token ömrüyle bütçeyi uzlaştır; aynı token için idempotent sonuç; expired durumda “Yeni QR kodu açıp tekrar tarayın”; Türkçe İstanbul zamanı. | L |
| SHL-33 | 🟡 Orta | 4,8 | İlk yönetici kurulumu `ADMIN_SETUP_SECRET`, “Convex env” ve altyapı menülerini kullanıcı arayüzüne koyuyor; şifre şartı formda açıklanmıyor. Bütün signUp hatalarında kör signIn denenmesi ilk hatayı gizliyor. | `src/pages/AdminSetup.tsx:40`, `src/pages/AdminSetup.tsx:75`, `src/pages/AdminSetup.tsx:99`, `src/pages/AdminSetup.tsx:113` | “Kurulum kodu” ve operatör destek metni; teknik talimat ayrı kurulum belgesinde; ortak parola şartları ve yapılandırılmış hata ayrımı. | M |
| SHL-34 | 🟡 Orta | 2,3 | Personel kurulumu başarıda “mobil uygulamaya giriş yapın/sekme kapatılabilir” diyor; uygulama aç/indir veya kurulum yardımına geçiş yok. Landing'de mağazalar “Yakında”. Başarılı kurulumdan sonraki görev tamamlanamıyor. | `src/pages/EmployeeSetup.tsx:104`, `src/components/landing/MobileAppSection.tsx:46`, `src/components/landing/MobileAppSection.tsx:59` | Dağıtım gerçekliğine göre uygulama açma + kurulum talimatı/İK desteği; mağaza URL'si doğrulanmadan sahte indirme düğmesi ekleme. | M |

### Public sayfalar ve demo

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| SHL-27 | 🔴 Kritik | 1,4 | **Demo formu telefon, personel sayısı ve not topluyor fakat submit yalnız e-posta/şifre/ad/firma gönderiyor.** Başarı mesajı sonrası girilen üç alan hiçbir yere yazılmadan kayboluyor. “Satış Ekibiyle Görüş” de hesap açmaya dönüşüyor. | `src/components/demo/EnhancedDemoRequestForm.tsx:19`, `src/components/demo/EnhancedDemoRequestForm.tsx:53`, `src/components/demo/EnhancedDemoRequestForm.tsx:150`, `src/components/landing/PricingSection.tsx:66` | UX-0'da gönderilmeyen alanları kaldırıp akışı açık “Deneme hesabı oluştur” yap; gerçek satış talebi istenirse UX-2'de alanları saklayan backend + talep onayı ekle. | M / backend L |
| SHL-28 | 🟠 Yüksek | 1,2 | Demo hero “Demo Talep Et” düğmesi hiçbir yere gitmiyor; gerçek form hero, özellikler ve istatistiklerden sonra. | `src/components/demo/DemoRequestHero.tsx:38`, `src/pages/DemoRequest.tsx:31`, `src/pages/DemoRequest.tsx:34` | Formu ilk ekran seviyesine getir; CTA form id'sine kaydırıp başlık/ilk alana odaklasın. | S |
| SHL-29 | 🟠 Yüksek | 1,6,7 | LandingHeader masaüstü nav `lg:flex`, mobil tetikleyici `md:hidden`: 768–1023px aralığında bölüm menüsü yok. Demo sayfasında hash hedefleri bulunmadığı için aynı nav sessizce boşa çalışıyor; skip-link `#main`, demo main'de id yok. | `src/components/landing/LandingHeader.tsx:59`, `src/components/landing/LandingHeader.tsx:93`, `src/components/landing/LandingHeader.tsx:38`, `src/pages/DemoRequest.tsx:30` | Breakpoint'leri hizala; farklı sayfada `/#features` gibi gerçek gezinme; main id ve odak hedefini iki public sayfada da ver. | M |
| SHL-30 | 🟠 Yüksek | 1,2 | Footer `/about`, `/blog`, dört `/legal/*` rotasına gidiyor ama App'te yok; sosyal linkler `#`. AuthProvider public whitelist dışında Login'e yönlendirerek 404'ü de örtebilir. NotFound ana sayfa diye oturumlu yöneticiyi landing'e gönderir. | `src/components/landing/LandingFooter.tsx:36`, `src/components/landing/LandingFooter.tsx:45`, `src/components/landing/LandingFooter.tsx:54`, `src/App.tsx:80`, `src/components/auth/AuthProvider.tsx:110`, `src/pages/NotFound.tsx:19` | Hazır içerik için gerçek public rotalar; onaylı hedefi olmayan navigasyonu kaldır; yasal metinleri ürün sahibinden al. 404 korunan rota guard'ı dışında kalsın, bağlama göre `/home` veya `/` önerilsin. | M / içerik bağımlılığı |
| SHL-31 | 🟡 Orta | 1,8 | Tek ürün için 14 gün/30 gün deneme, 5 dakika/15 dakika kurulum çelişiyor. FAQ “ücretsiz 5 çalışan” derken fiyat tablosu ücretli Başlangıç 10 çalışan gösteriyor. Demo 500+ müşteri, landing 200+ şirket sunuyor; gerçek ticari iddialar doğrulanmadı. | `src/components/landing/HeroSection.tsx:51`, `src/components/landing/HeroSection.tsx:62`, `src/components/demo/DemoRequestHero.tsx:20`, `src/components/demo/DemoRequestHero.tsx:26`, `src/components/landing/FAQSection.tsx:23`, `src/components/landing/PricingSection.tsx:28`, `src/components/demo/DemoStats.tsx:6`, `src/components/landing/StatsSection.tsx:4` | Tek ürün/plan metin kaynağı ve ürün sahibinin onayladığı değerler. Gerçekliği doğrulanmayan referans, barındırma ve uyumluluk iddialarını ayrıca içerik kontrolüne ver; audit bunların doğru/yanlış olduğunu kanıtlamaz. | M |
| SHL-32 | 🟡 Orta | 1,2 | Fiyatlandırmada plan ve yıllık/aylık seçim kayıt ekranına taşınmıyor. Kurumsal URL `plan=enterprise` taşıyor ama DemoRequest/form okumuyor; kullanıcı seçimini tekrar anlatmak zorunda. | `src/components/landing/PricingSection.tsx:82`, `src/components/landing/PricingSection.tsx:185`, `src/components/landing/PricingSection.tsx:32`, `src/components/demo/EnhancedDemoRequestForm.tsx:15` | Plan+billing state'ini URL/form özeti üzerinden koru; backend ürün planını gerçekten uygulamıyorsa satın alınmış plan izlenimi yaratma. | M |

### Tasarım sistemi ve ortak durumlar

| ID | Önem | Kat. | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| SHL-35 | 🟠 Yüksek | 1,3 | Uygulamada yalnız eski `ui/toaster` render ediliyor; cihaz komutları ve rapor ayarları Sonner toast kullanıyor. Sonner sağlayıcısı olmadan bu başarı/hata geri bildirimleri görünmez. | `src/App.tsx:3`, `src/App.tsx:94`, `src/components/devices/DeviceCommandCenter.tsx:266`, `src/components/settings/sections/ReportsSettings.tsx:130`, `src/components/ui/sonner.tsx:6` | Önce Sonner Toaster mount et; eski çağrıları kontrollü taşı; çift bildirim üretmeden tek toast API'sine geç. | M |
| SHL-36 | 🟠 Yüksek | 5,7 | Token kullanımı tek başına kontrastı garanti etmiyor: açık temada success badge beyaz metin ≈2,30:1; koyu temada primary/beyaz ≈3,18:1; koyu kart üstünde destructive metin ≈2,00:1. Küçük durum metinleri zor okunuyor. | `src/index.css:34`, `src/index.css:61`, `src/index.css:69`, `src/components/ui/badge.tsx:20`, `src/components/dashboard/RecentReadingsTable.tsx:28`, `src/pages/Login.tsx:212` | Dolgu/ön plan çiftlerini birlikte düzelt; badge için semantik subtle varyant; danger için koyu temada açık foreground. Rakamlar HSL→sRGB luminans hesabı; gerçek browser compositing/odak durumu doğrulanmadı. | M |
| SHL-37 | 🟡 Orta | 3,5 | Renk/durum standardı parçalı: body components katmanında gray, base katmanında semantik; colors.css yalnız burgundy ve src'de import yok. Shared bileşenler az kullanılıyor; dashboard ayrı StatusCard, auth emoji kilit ve yerel hata/boş durum kullanıyor. | `src/index.css:103`, `src/index.css:130`, `src/styles/colors.css:7`, `src/components/StatusCard.tsx:11`, `src/components/auth/ProjectFilter.tsx:34`, `src/components/shared/AccessDenied.tsx:21` | Bölüm 7'deki standardı uygula; token tanımını tek kaynağa indir; shared bileşenin kendisindeki amber sabitlerini de temizle. Kullanıcı alanları için form schema isimlerini değiştirme. | L |
| SHL-38 | 🟡 Orta | 6,7,9 | Landing animasyonları reduced-motion tercihine bağlanmıyor; global scroll-smooth da koşulsuz. Tek reduced-motion media sorgusu eski App.css logo animasyonuyla sınırlı. | `src/components/landing/HeroSection.tsx:35`, `src/components/landing/FeaturesSection.tsx:164`, `src/index.css:133`, `src/App.css:28` | Ortak MotionConfig/useReducedMotion ve CSS motion-reduce; hareket azaldığında içerik görünür kalsın. 320/768/1024px ve %200 zoom turu yap. | M |
| SHL-39 | ⚪ Düşük | 5,8 | Eski Auth/LoginForm/RegisterForm, Header, CalendarCard, AttendanceChart ve DemoRequestForm aktif rotadan kullanılmıyor. Biri “projeniz oluşturuldu” derken güncel akış doğrulama istiyor; grafik İngilizce ve sabit veri içeriyor. Bunlar aktif ekran hatası diye sayılmamalı, yeniden kullanılırsa tutarsızlığı geri getirir. | `src/App.tsx:57`, `src/pages/Auth.tsx:37`, `src/components/auth/RegisterForm.tsx:47`, `src/components/dashboard/CalendarCard.tsx:25`, `src/components/AttendanceChart.tsx:5`, `src/components/demo/DemoRequestForm.tsx:9`, `src/components/Layout.tsx:5` | Kullanım aramasından sonra ölü varyantları kaldır veya açık örnek/story alanına taşı; aktif giriş ve dashboard için tek uygulama kalsın. | M |

## 4. Hedef tasarım

### Kabuk + Dashboard (`/home`)

```text
┌ NGS+ | [Proje: İstanbul Merkez v] | Ana Sayfa           [Hesap] ┐
│ Ana Sayfa      │ Bugün · 16 Ekim 2026 · İstanbul saati         │
│ Personel       │ [Personel] [Aktif cihaz] [Bugünkü geçiş]       │
│ Cihazlar >     │ [Gerçek durum / ayrı ayrı iskelet]             │
│ Geçiş kontrol │ Aktivite özeti (yalnız veri varsa)             │
│ PDKS / İzinler │ Son geçişler                                  │
│ Ayarlar        │ Tarih-saat | Personel | Cihaz | Sonuç          │
│                │ [Tüm geçişleri gör]                           │
└────────────────┴──────────────────────────────────────────────┘
Mobil: [Menü] [Proje adı v] [Hesap]; KPI 2 kolon; aynı veri kapsamı.
```

1. Proje her ekran boyutunda görünür; istatistik ve liste aynı scope kullanır.
2. Gerçek veri, yükleniyor, erişim yok ve boş veri birbirine karışmaz.
3. Alt sorgu/lazy rota kabuğu sökmez; hatalı bölüm kendi ErrorState'ini gösterir.
4. Ana Sayfa, Sanal Okuyucular ve başlıklar ortak rota metadatasından beslenir; “Personel” terimi tutarlı olur.

### Giriş (`/login`) ve kayıt (`/register`)

```text
GİRİŞ                              KAYIT
[NGS+]                             [NGS+]
Hesabınıza giriş yapın              Yönetici hesabı oluşturun
E-posta * [________________]        Ad * [____] Soyad * [____]
Şifre *   [____________][Göster]    Firma * [________________]
[alan hatası]                      E-posta * [______________]
[Şifremi unuttum]                   Şifre * [________][Göster]
[Giriş yap]                        En az ... / alan hatası
[Hesap oluştur]                    [Hesap oluştur]
                                   [Giriş yap]
```

1. Etiket görünür, helper/hata input'a bağlı; ilk hata odaklanır.
2. Şifre gösterme klavye ve dokunmayla çalışır; submit sırasında payload sabittir.
3. Kayıt, doğrulama bekleme ve oturum ayrı açık durumlar; redirect tek otoritededir.
4. Giriş tamamlandığında güvenli dönüş URL'sine gidilir; teknik hata Türkçe kullanıcı metnine çevrilir.

### Doğrulama (`/verify-email` ve kayıt sonrası bekleme)

```text
[NGS+]  E-postanızı doğrulayın
adres@firma.com adresine bağlantı gönderdik.
[Gelen kutunuzu kontrol edin]   [Yeniden gönder (00:45)]
[E-postayı değiştir]            [Girişe dön]
--- link açıldığında ---
[Doğrulanıyor] / [Hesabınız hazır → Giriş yap]
[Link geçersiz veya süresi dolmuş → Yeni link iste / Giriş yap]
```

1. Kullanıcının hesabı dururken yeniden kayıt önerilmez.
2. Token değişimi yeni doğrulama başlatır; her durumun kurtarma adımı vardır.
3. Yeniden gönderme hesabın varlığını ifşa etmeyen nötr sonuç ve bekleme süresi kullanır.

### Kullanıcı daveti (`/user-setup`)

```text
[NGS+]  İstanbul Merkez projesine davet edildiniz
E-posta: adres@firma.com · Rol: Proje kullanıcısı
[Yeni hesap oluştur] [Mevcut hesabımla giriş]
Şifre [________][Göster]   (yeni hesapta şartlar + tekrar)
[Daveti kabul et]
Geçersiz davet: neden + [Yöneticiden yeni davet isteyin] [Girişe dön]
```

1. Kimlik kurma ve davet kabulü kullanıcıya açıkça ayrılır.
2. Başarı yalnız üyelik uygulandıktan sonra gösterilir; geçersiz davet sayfadan kaçırılmaz.
3. Global auth guard ile kurulum koordine edilir; backend doğrulanmış kullanıcı sınırı korunur.

### İlk yönetici (`/admin-setup`)

```text
[NGS+]  İlk yönetici kurulumu
E-posta * [________]
Şifre * [________][Göster] + gereksinimler
Kurulum kodu * [________]
Kodu sistem kurulum sorumlusundan alın.
[Yönetici hesabını oluştur] [Girişe dön]
```

1. Teknik env isimleri kullanıcı formuna taşınmaz.
2. Kod/hesap/rol atama aşamaları için anlaşılır hatalar ve tekrar güvenliği vardır.
3. Zaten kurulmuş sistemde açıklama ve giriş bağlantısı gösterilir; form anlık parlamaz.

### Personel kurulumu (`/employee-setup`)

```text
[NGS+] Personel hesabınızı etkinleştirin
E-posta: ...
Yeni şifre [________][Göster]
Şifre tekrar [_______][Göster]  [alan hatası]
[Şifremi belirle]
Başarılı: [Mobil uygulamayı aç] [Kurulum yardımı]
Token yok/expired: Yeni bağlantı için İK yöneticinizle görüşün.
```

1. Tokensız giriş yükleme değildir; sonlu hata görünümüdür.
2. Şifre gereksinimi ve uyuşmazlık aynı formda görünür.
3. Başarı sonraki gerçek dağıtım kanalına bağlanır; mevcut olmayan mağaza bağlantısı üretilmez.

### QR giriş (`/check-in`)

```text
[NGS+] QR ile giriş
[Konum bilgisi alınıyor...] → [Giriş kaydediliyor...]
Başarılı: Ayşe Demir · 16 Ekim 2026, 09:12
Konum bilgisi kayda eklendi.
Hata: Kodun süresi doldu. Yeni QR kodunu açıp yeniden tarayın.
[Tarama yardımını göster]
```

1. GPS almak ile konum politikasını doğrulamak ayrı anlamlardır.
2. Token tek işlem üretir; aynı işlemin tekrarı çelişen sonuca dönüşmez.
3. Kullanıcı teknik ISO metni yerine yerel tarih/saat ve açık sonraki adım görür.

### Landing (`/`)

```text
[NGS+] [Özellikler] [Fiyatlar] [SSS] [Giriş] [Deneme hesabı]
Tek değer önerisi + onaylı deneme süresi [Ücretsiz dene]
Ürün örneği (örnek veri etiketi)
Özellikler → Nasıl çalışır → Mobil dağıtım durumu
Planlar [Aylık/Yıllık] → seçili planla kayıt / gerçek satış talebi
Doğrulanmış referanslar → SSS → gerçek iletişim/yasal bağlantılar
```

1. Aynı plan/deneme bilgisi tüm sayfalarda tek kaynaktır.
2. Her navigasyon hedefi vardır; tablet menüsüz kalmaz.
3. Örnek ürün verisi ile gerçek müşteri/operasyon iddiası ayrılır.
4. Hareket tercihe uyar; klavye odağı ve bölüm atlama her boyutta korunur.

### Demo (`/demo-request`)

```text
[NGS+] [Giriş]
Satış ekibiyle görüşün                 Ne beklemelisiniz?
Seçili plan: Kurumsal                  Onaylı yanıt süresi
Ad Soyad * [________]                  Kısa ürün özeti
Firma * [________] E-posta * [_______]
Telefon [_______] Personel sayısı [__]
İhtiyacınız [________________________]
[Talebi gönder]
Başarı: Talebiniz alındı + referans / kopya / sonraki adım
```

1. Bu hedef gerçek satış talebi backend'i geldiğinde uygulanır; UX-0 geçici akış açıkça “deneme hesabı”dır.
2. Satış talebi parola istemez; görünen her alan gerçekten gönderilir.
3. Form ilk bölümde; hata girilen veriyi korur ve alanlara bağlanır.
4. Oturumlu kullanıcı da satış talebine erişebilir; mevcut müşteri formu gereksiz yere home'a atılmaz.

### Bulunamayan sayfa (`*`) ve eski `/auth`

```text
[NGS+] Sayfa bulunamadı
Bağlantı değişmiş veya hatalı olabilir.
[Önceki sayfa] [Ana Sayfa / Giriş] [Destek]
/auth → aynı giriş ekranı (güvenli returnTo korunur)
```

1. 404 doğru görünür; auth guard bilinmeyen public rotayı yutmaz.
2. Geri dönüş oturum bağlamına göre seçilir; tam sayfa reload gerekmez.
3. Ayrı eski Auth UI'si yerine tek giriş uygulaması korunur.

## 5. Fazlar

Süreler tek implementasyon worker'ının net geliştirme+hedefli doğrulama süresidir; içerik onayı ve dış servis beklemesi hariçtir. Aşağıdaki OWNERSHIP listeleri gelecekteki uygulama görevleri içindir; bu audit hiçbir kaynak dosyayı değiştirmez. Aynı dosyayı paylaşan paketler sıralı alınmalıdır.

### UX-0 — Veri ve kırık akış düzeltmeleri (toplam yaklaşık 4–5 gün)

**UX-0A — Dashboard gerçeği, ilk önerilen paket (1–1,5 gün, backend).**

- Bulgular: SHL-01, SHL-02, SHL-03, SHL-04, SHL-05, SHL-06, SHL-07; SHL-08'in tarih index kısmı.
- OWNERSHIP: `src/hooks/useDashboard.ts`, `src/pages/Index.tsx`, `src/components/dashboard/{ActivitySummaryCard,DashboardHeader,StatsGrid,RecentReadingsTable}.tsx`, `convex/dashboard.ts` yalnız `getStats/getRecentReadings`, yeni `convex/dashboard.test.ts`.
- Aktif projeyi sorgu sözleşmesine ekle; yetkisiz projeyi server reddetsin; mevcut PDKS fonksiyonlarına dokunma. Sabit özeti kaldır, pasif kuralları doğru adlandır, no-op yenilemeyi kaldır. Tarih aralığını mevcut index'lere taşı; sayacı `take()` ile kırpma.
- Kabul: farklı rakamları olan A/B projede başlık/KPI/liste birlikte değişir; başka proje verisi görünmez; eski tarihli geç gelen kayıt son 10 gerçek geçişi bozmaz; gecikmiş sorguda 0 yazmaz; boş proje anlamlı durum gösterir.

**UX-0B — Hesap doğrulama ve kurulum (1–1,5 gün).**

- Bulgular: SHL-17, SHL-18, SHL-21, SHL-22, SHL-24, SHL-33.
- OWNERSHIP: `src/components/auth/AuthProvider.tsx`, `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup}.tsx`, ilgili yeni auth/kurulum akış testleri.
- Önce tokensız EmployeeSetup ve görünür resend; sonra kısmi kayıt başarısı ve token başına doğrulama. Kurulum yarışı testle doğrulanırsa tek akış durumu ile çözülür. Backend `verified` kontrolü kaldırılmaz.
- Kabul: tokensız/geçersiz/expired/tüketilmiş token sonlu ekran; mail talebi hata verdiğinde mevcut hesapla devam; profil erken geldiğinde kurulum logout ile yarıda kesilmez; ham EXPIRED/Convex hata metni görünmez.

**UX-0C — Public akış ve bağlantılar (yaklaşık 1 gün).**

- Bulgular: SHL-27, SHL-28, SHL-29, SHL-30; SHL-31'in çelişen kesin metinleri.
- OWNERSHIP: `src/pages/{DemoRequest,NotFound}.tsx`, `src/components/demo/{EnhancedDemoRequestForm,DemoRequestHero,DemoStats}.tsx`, `src/components/landing/{LandingHeader,LandingFooter,HeroSection,PricingSection,FAQSection,StatsSection}.tsx`, `src/App.tsx`, `src/components/auth/AuthProvider.tsx` yalnız public/404 guard. AuthProvider sahipliği UX-0B sonrası alınır.
- Gönderilmeyen alanları kaldır ve geçici hesabı doğru adlandır; hero CTA'yı bağla; tablet/nav/skip hedeflerini düzelt. Hazır olmayan about/blog/sosyal hedefleri kaldır; yasal içerik üretme görevi ürün sahibine bağımlı, onaylı içerik geldiğinde gerçek public rotaya bağla.
- Kabul: 320/768/1024px gezinme; her görünür CTA'nın gerçek hedefi; demo alanlarının gönderim payload'ıyla birebir eşleşmesi; oturumsuz bilinmeyen URL gerçek 404; ticari süreler tek değer.

**UX-0D — Ortak geri bildirim ve QR (yaklaşık 1 gün, QR idempotency için backend).**

- Bulgular: SHL-09, SHL-10, SHL-15, SHL-25, SHL-26, SHL-35.
- OWNERSHIP: `src/components/layout/AppHeader.tsx`, `src/components/auth/ProjectFilter.tsx`, `src/pages/CheckIn.tsx`, `src/App.tsx` toast mount, `src/components/ui/sonner.tsx`, `convex/employeeCheckIn.ts` token/sonuç sözleşmesi, yeni `convex/employeeCheckIn.test.ts`.
- Sonner sağlayıcısını ekle; aktif eski toast çağrıları geçiş süresince çalışsın. Sahte bildirim kaldır; fotoğraf alanını düzelt; rol kontrolünü context'e bağla. QR mesajını hemen düzelt, token ömrü/konum süresi/idempotent sonuç tasarımını aynı pakette test et.
- Kabul: cihaz/rapor örnek Sonner mesajları görünür, çift toast yok; gerçek profile photo gösterilir; project_user yönetici görünümüne sokulmaz; GPS ret/zaman aşımı, expired token ve çift istek net tek sonuç verir.

### UX-1 — Sadeleştirme, erişilebilirlik ve tutarlılık (yaklaşık 3 gün)

**UX-1A — Kalıcı kabuk ve rota durumu (1 gün).**

- Bulgular: SHL-11, SHL-12, SHL-13, SHL-14.
- OWNERSHIP: `src/App.tsx`, `src/components/{Layout,ErrorBoundary}.tsx`, `src/components/layout/{AppHeader,AppSidebar,AppSidebarNav,ProjectSwitcher}.tsx`, `src/components/auth/AuthProvider.tsx`, `src/pages/Login.tsx`, `src/contexts/ActiveProjectContext.tsx`, yeni `src/lib/routeMeta.ts`.
- Proje üst çubukta; route meta; tek protected-route guard ve güvenli dönüş hedefi; Outlet seviyesinde yükleme/hata; sıfır projeye açıklamalı state.
- Kabul: derin linkte query/hash korunur; sidebar kapalıyken proje değiştirilebilir ve soğuk yenilemede seçili proje korunur; lazy/sorgu hatasında menü kullanılabilir; projesiz hesaba sahte sıfır dashboard gösterilmez.

**UX-1B — Form ve durum bileşenleri (1 gün).**

- Bulgular: SHL-19, SHL-20, SHL-23'ün görünür davet/hata durumları, SHL-34.
- OWNERSHIP: `src/pages/{Login,Register,VerifyEmail,UserSetup,AdminSetup,EmployeeSetup}.tsx`, `src/components/shared/{FormFieldWrapper,ErrorState,EmptyState}.tsx`, yeni `src/components/shared/PasswordField.tsx`.
- Alan bağlarını ortak bileşenle kur; wrapper doğrudan input'a veya açık control slot'una ARIA iletsin (div sarmalayıcıya aria-invalid eklemek yeterli değildir). Pending formu kilitle. Mevcut uygulama dağıtım kanalı belirlenince personel başarı adımını bağla.
- Kabul: yalnız klavyeyle tamamlanabilir; göz düğmeleri adlandırılmış; hataya odak; Türkçe alan hataları; 320px ve %200 zoom'da form/geri dönüş sabit düğmeyle örtüşmez (görsel doğrulama gerekir).

**UX-1C — Tema, hareket ve tekrarların kaldırılması (1 gün).**

- Bulgular: SHL-31, SHL-36, SHL-37, SHL-38, SHL-39.
- OWNERSHIP: `src/index.css`, `src/styles/colors.css`, `src/App.css`, `src/components/ui/badge.tsx` yalnız semantik varyantlar, `src/components/shared/{StatCard,AccessDenied}.tsx`, `src/components/dashboard/StatsGrid.tsx`, `src/components/StatusCard.tsx`, `src/components/landing/**`, `src/components/demo/{DemoStats,DemoRequestHero}.tsx`; kullanım doğrulaması sonrası eski `src/pages/Auth.tsx`, `src/components/{Header,AttendanceChart}.tsx`, `src/components/dashboard/CalendarCard.tsx`, `src/components/auth/{LoginForm,RegisterForm}.tsx`, `src/components/demo/DemoRequestForm.tsx`.
- Ortak renkleri ve public metinlerini tek kaynağa indir; standart badge/stat/state; reduced motion. Kullanılmayan varyantları aktif bağımlılık olmadığını doğrulayarak kaldır.
- Kabul: açık/koyu temada normal metin hedef kontrastı ≥4,5:1; hareket tercihi; bu kapsamda yeni hardcoded status rengi/emoji yok; active ekranlarda başarı/hata/boş state aynı sistemden.

### UX-2 — Yeni yetenekler ve ölçek (yaklaşık 3–4 gün, backend)

**UX-2A — Tam hesap kurtarma ve davet kabulü (1–1,5 gün, backend).**

- Bulgular: SHL-16, SHL-23'ün mevcut hesap/reset akışı; SHL-17/21 ile aynı state sözleşmesini kullanır.
- OWNERSHIP: `src/pages/Login.tsx`, `src/pages/UserSetup.tsx`, yeni parola kurtarma sayfaları, `src/components/auth/AuthProvider.tsx`, `src/App.tsx`, `convex/auth.ts`, `convex/invites.ts`, gerekli e-posta action/template ve testleri.
- Yeni backend dosyaları worker başlangıcında dar listeyle belirlenmeli; reset token'ı davet üyelik token'ından ayrı olsun. Var olan hesabın parola politikasını yeni kayıt formuyla zorlamadan signIn akışı sun.
- Kabul: kullanılan/süresi dolan reset token'ı güvenli sonuca gider; mail adresi değişiminde durum sıfırlanır; yeni ve mevcut kullanıcı daveti bir kez uygular.

**UX-2B — Gerçek satış talebi ve plan devamlılığı (1 gün, backend).**

- Bulgular: SHL-27'nin kalıcı çözümü, SHL-32; SHL-34 dağıtım bağlantısı ürün girdisine bağlı.
- OWNERSHIP: `src/pages/DemoRequest.tsx`, `src/components/demo/EnhancedDemoRequestForm.tsx`, `src/components/landing/PricingSection.tsx`, `src/pages/Register.tsx`, yeni `convex/demoRequests.ts`, yalnız gereken tablo için `convex/schema.ts`, ilgili testler.
- Telefon/not/personel sayısını kaydeden gerçek talep; şifresiz satış formu; oturumlu kullanıcıyı home'a atma; plan+billing özetini koru. Kullanıcıya verilen yanıt süresi ürün sahibi tarafından sağlanmalı.
- Kabul: gönderilen tüm alanlar fixture'da saklanır; başarısızlık formu korur; mükerrer submit tek talep; plan seçimi bağlantılar boyunca korunur.

**UX-2C — Ölçekli özetler (1–1,5 gün, backend).**

- Bulgular: SHL-08'in aggregate/sayaç kısmı; SHL-02 için gerçek aktivite geri getirme isteğe bağlı ürün yeteneği.
- OWNERSHIP: `convex/dashboard.ts` yalnız home sorguları, gerekli aggregate/sayaç yardımcıları ve `convex/schema.ts` ilgili yeni alanlar, `src/hooks/useDashboard.ts`, `src/components/dashboard/ActivitySummaryCard.tsx`, test fixture'ları.
- Gerçekleşen geçiş/aktif personel gibi tanımları ürünle sabitle; geçmişteki kayıt düzeltmeleri ve geç olaylar sayaç doğruluğunu bozmasın. PDKS hesap motorunu kopyalama; aktif PDKS audit/implementasyon planıyla koordine et.
- Kabul: büyük fixture'da tarih dışı geçmiş okumaları artarken home read maliyeti sınırlı; mevcut küçük fixture sonuçlarıyla aynı sayılar; düzeltme/geriye tarihli olay tutarlılığı.

**Ortak doğrulama kapısı:** uygulama değişikliklerinde `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`, `node_modules/.bin/eslint src convex`; backend sözleşmesi değişen paketlerde anlamlı fixture testleri. Ayrıca iki rol, iki proje, sıfır proje, yavaş/başarısız ağ, 320/768/1024px, klavye ve açık/koyu tema turu. Bu audit sırasında kaynak değiştirilmediğinden build/lint/test koşturulmadı; rapor referansları ve kapsam kapıları doğrulandı.

## 6. Modüller arası adaylar

- **Durum sözleşmesi:** loading / no-access / empty / error ayrımı; EmptyState, ErrorState, AccessDenied ve bölüm iskeleti tüm veri sayfalarında aynı anlamı taşımalı. Liste içinde compact varyant gerekli.
- **Rota ve rol metadatası:** menü görünürlüğü, route başlığı, erişim ekranı ve hızlı bağlantılar aynı tablodan; frontend rol filtresi backend yetkilendirmenin yerini almaz.
- **Proje bağlamı:** bütün query hook'ları “aktif proje” ile “tüm erişilen projeler” ayrımını açık isimlendirmeli; dashboard bulgusu başka modüllerde de kontrol edilmeli.
- **PasswordField / alan hatası:** giriş, kayıt, davet, personel ve ilk-admin formlarında aynı etiket/şifre gösterme/hata/pending davranışı.
- **StatusBadge / StatCard:** anlam→token eşlemesi; yerel kırmızı/yeşil haritaları kaldır; StatCard yükleme değeri ve meta kontrastı standardı.
- **Toast ve onay:** tek Sonner API; yıkıcı işlemlerde AlertDialog + pending; native confirm tespitleri ilgili modül sahibine verilmeli.
- **Tarih/saat:** ürün genelinde açık İstanbul saat dilimi; “saat” gösterirken gün bağlamı kaybolmamalı.
- **İçerik kaynağı:** deneme/plan limitleri, ürün adı ve terimler tek veri kaynağından. İddiaların ticari/teknik doğruluğu ayrı içerik onayı gerektirir.

## 7. Tasarım sistemi taraması

### Yöntem ve sınırlar

Tarama 398 adet `src/**/*.{ts,tsx,js,jsx,css}` dosyasını kapsar; bağımlılıklar/Convex/mobile hariç. Test, ölü bileşen ve UI tanımları dahil **kaynak envanteridir**, ekran başına render sayısı değildir. UI iç koduna yeni kalite bulgusu açılmadı; envanter satırında sayıldı. PDKS dahil tüm-src sayımı ayrıca istenmiş olduğu için PDKS envanterde vardır, bulgular yeniden audit edilmemiştir.

- **Renk:** `rg -o '(bg|text|border)-(red|green|blue|yellow|orange|gray|slate)-[0-9]+' src` eşleşme sayısı; tekrarlar ve `dark:/hover:` varyantları ayrı sayılır. Emerald/amber/purple, hex ve `fill/stroke` bu talep edilen regex'e dahil değildir; 0 “token uyumlu” demek değildir.
- **Emoji:** TSX içinde yorumlar hariç JSXText ve string/template literal düğümlerinde Unicode `Extended_Pictographic`; aynı satır tek sayılır. Doğrudan JSX ve JSX'e taşınabilecek veri string'leri dahil; runtime görünürlük kanıtı değildir. Alt sınır niteliğindedir; dinamik dış kaynak dahil değil.
- **Native:** AST CallExpression `alert`, `window.alert`, `confirm`, `window.confirm`. Sonuç **0 alert / 4 confirm**.
- **Tam spinner:** `LoadingSpinner` kullanıp `inline` prop'u vermeyen dosyalar; ayrıca CheckIn/VerifyEmail tam sayfa animate-spin durumları. Dosya sayısıdır, tüm loading türleri değildir. Toplam 16 default LoadingSpinner çağrısı 15 dosyada; iki açık tam sayfa spinner ile **17 tüketici dosya**. Spinner bileşeninin tanımı ayrıca sayılmadı. `min-h-screen` ve `animate-spin` aynı dosyada diye bulunan ShiftSettings yanlış pozitifti: buton içi pending olduğundan çıkarıldı.
- **E/H/S:** gerçek JSX açılışları `<EmptyState> / <ErrorState> / <StatCard>`; import/deklarasyon sayılmaz. StatCard map ile bir çağrıdan birden çok kart üretilebilir. Ek: AccessDenied **2 çağrı**, FormFieldWrapper **0 çağrı**.
- **Yerel:** JSXText üzerinde `henüz|bulunamadı|bulunmuyor|kayıt yok|veri yok|bir hata|hata oluştu|yüklenemedi|erişimi yok|geçersiz|başarısız` taraması, shared tanımları hariç; **35 aday metin satırı**. Bunların Login'deki “henüz doğrulanmamış”, “henüz yönetici yok” ve AdminSetup'taki “henüz yönetici yok” satırları state kopyası değildir: manuel elemeden sonra **32 boş/hata/erişim durumu metin satırı** kalır. Bu sayı komponent adedi değildir; aynı panelin başlık+açıklaması iki satır olabilir. `{error}` gibi dinamik metinler ve toast string'leri bu metrikte yoktur; toplam yerel kopya adedi bu taramayla kesinleşmez.
- **İkon Button:** `size="icon"` veya çocukları yalnız büyük harfle başlayan self-closing JSX olan `<Button>`; `aria-label`, `aria-labelledby`, `sr-only` olmayan adaylar. **51 literal aria-label'sız adaydan 2 sr-only örneği çıkarılınca 49 inceleme adayı**. Gerçek erişilebilir isim hesaplanmadı; dinamik label, asChild, tooltip ilişkisi elle incelenmeli. Native `<button>` ve koşullu ikon içerikleri kapsamı dışında; auth göz düğmeleri SHL-20'de ayrıca incelendi. AppHeader zili ve UI SidebarTrigger sr-only nedeniyle erişilebilirlik hatası sayılmadı.

Modül eşlemesi: `components/<modül>` + karşılık gelen page; Index/StatusCard/AttendanceChart dashboard'a, Login/Register/VerifyEmail/Auth/*Setup auth'a, EngineeringDepartment departments'a, SystemAdmin admin'e, VirtualReaders devices'a dahil. `shell` = Layout/Header/ErrorBoundary/NotFound; `foundation` = App/main/index CSS/App CSS/styles; kalan hooks/lib/contexts/services/types/utils = infrastructure. Satırlar birbirini dışlar.

| Modül | Dosya | Sabit renk | Emoji satırı | Native | Tam spinner dosyası | E/H/S | Yerel aday satır | Adsız ikon Button adayı |
|---|---:|---:|---:|---:|---:|---|---:|---:|
| access-control | 29 | 17 | 0 | 0 | 1 | 2/1/0 | 5 | 9 |
| admin | 13 | 20 | 0 | 2 | 0 | 0/0/0 | 3 | 5 |
| audit-log | 1 | 7 | 0 | 0 | 0 | 0/0/0 | 1 | 0 |
| auth | 11 | 36 | 2 | 0 | 4 | 0/0/0 | 8 | 0 |
| check-in | 1 | 2 | 0 | 0 | 1 | 0/0/0 | 0 | 0 |
| dashboard | 9 | 0 | 0 | 0 | 1 | 0/0/0 | 1 | 0 |
| demo | 6 | 4 | 0 | 0 | 1 | 0/0/0 | 0 | 0 |
| departments | 5 | 1 | 0 | 0 | 0 | 0/0/0 | 0 | 4 |
| devices | 43 | 8 | 0 | 1 | 1 | 0/0/1 | 4 | 6 |
| employees | 21 | 13 | 0 | 0 | 1 | 0/0/3 | 2 | 4 |
| foundation | 5 | 5 | 0 | 0 | 1 | 0/0/0 | 0 | 0 |
| infrastructure | 60 | 0 | 0 | 0 | 0 | 0/0/0 | 0 | 0 |
| landing | 12 | 7 | 0 | 0 | 0 | 0/0/0 | 0 | 0 |
| layout | 4 | 0 | 0 | 0 | 0 | 0/0/0 | 0 | 0 |
| leaves | 1 | 8 | 0 | 0 | 1 | 0/0/0 | 1 | 2 |
| monitoring | 1 | 0 | 0 | 0 | 0 | 0/0/0 | 0 | 0 |
| pdks (yalnız envanter) | 51 | 81 | 20 | 0 | 0 | 0/0/0 | 4 | 9 |
| profile | 5 | 4 | 0 | 0 | 1 | 0/0/0 | 1 | 0 |
| settings | 31 | 4 | 4 | 1 | 1 | 1/0/0 | 2 | 3 |
| shared | 5 | 0 | 0 | 0 | 0 | 0/0/0 | 0 | 0 |
| shell | 4 | 10 | 0 | 0 | 1 | 0/0/0 | 2 | 0 |
| shifts | 12 | 16 | 0 | 0 | 1 | 0/0/0 | 0 | 2 |
| sync | 2 | 4 | 0 | 0 | 0 | 0/0/0 | 0 | 1 |
| ui (yalnız envanter) | 52 | 4 | 0 | 0 | 0 | 0/0/0 | 0 | 0 |
| visitors | 14 | 1 | 0 | 0 | 1 | 0/0/1 | 1 | 4 |
| **Toplam** | **398** | **252** | **26** | **4** | **17** | **3/1/5** | **35 (manuel: 32)** | **49 aday** |

### Kanıt örnekleri ve uygulanacak standart

| Pattern | Doğrudan kanıt | Zorunlu standart önerisi |
|---|---|---|
| Sabit durum renkleri | `src/pages/VerifyEmail.tsx:90`, `src/pages/CheckIn.tsx:80`, `src/components/auth/ProjectFilter.tsx:33` | `status-success/warning/danger/info` eşlemeli StatusBadge; yüzey/metin token çiftleri açık+koyu birlikte test edilir. Marka illüstrasyonlarında kontrollü istisna, iş durumu renginde istisna yok. |
| Emoji | `src/components/auth/ProjectFilter.tsx:34`, `src/components/settings/sections/general/FormSubmitButton.tsx:16` | Lucide ikon + görünür Türkçe ad; dekoratif ikon aria-hidden; anlam yalnız renk/emojiyle verilmez. |
| Native onayların tamamı | `src/components/devices/form-sections/DeviceHikvisionSection.tsx:267`, `src/components/admin/AdminDevicesPanel.tsx:50`, `src/components/admin/AdminDeviceDialog.tsx:108`, `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:59` | shadcn AlertDialog; nesne adı + etki + iptal/eylem; beklerken çift işlem engeli; tamamlanınca Sonner. |
| Tam ekran spinner | `src/components/ui/loading-spinner.tsx:27`, `src/pages/Index.tsx:27`, `src/components/auth/ProjectFilter.tsx:21` | Kabuk ilk oturum çözümü dışında bölüm iskeleti; token doğrulamada kompakt durum kartı; `role=status` / aria-live; içerik yüksekliği sabit. |
| Shared kullanım açığı | `src/components/dashboard/RecentReadingsTable.tsx:68`, `src/components/profile/UserProjectsCard.tsx:36`, `src/components/access-control/GroupMembersManager.tsx:117` | EmptyState/ErrorState/AccessDenied compact ve tam bölüm varyantları; boş neden + uygun sonraki adım; sorgu hatası ayrı retry. |
| Yerel KPI | `src/components/dashboard/StatsGrid.tsx:14`, `src/components/StatusCard.tsx:11` | Shared StatCard; yükleme ve bilinmiyor sıfırdan ayrılır; kapsam/tarih kısa metni; tek biçimlendirme. |
| İkon Button adayları | `src/components/employees/EmployeeTable.tsx:293`, `src/components/devices/DeviceTableRow.tsx:126`, `src/components/shifts/ShiftCalendarView.tsx:111` | IconButton API'sinde Türkçe erişilebilir ad zorunlu; tooltip yardımcıdır; native şifre düğmeleri dahil tüm etkileşimleri klavye ile doğrula. |
| Form/hata bağları | `src/components/shared/FormFieldWrapper.tsx:27`, `src/pages/Login.tsx:172` | FormFieldWrapper veya shadcn FormField sözleşmesi; görünür label, zorunluluk, helper, aria-invalid/describedby, alan hatası; aria doğrudan control'e gider. |
| Toast | `src/App.tsx:94`, `src/components/settings/sections/ReportsSettings.tsx:130` | Tek mount edilmiş Sonner Toaster + tek çağrı API'si; kritik form hatası yalnız toast'ta kalmaz. |

Kabul politikası: yeni/değiştirilen iş ekranlarında yerel status rengi, emoji ikon, native alert/confirm ve isimsiz ikon düğmesi eklenmez; kalan borç modül sahibine parça parça verilir. Grep/AST sayımı CI için aday listesi üretir, erişilebilirlik veya görsel doğruluğun yerine geçmez. İlk hedef mevcut 49 ikon adayını elle isim hesabıyla ayırmak, bu rapor kapsamındaki durum kopyalarını shared bileşenlere taşımak ve Sonner görünürlüğünü doğrulamaktır.
