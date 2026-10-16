# Ayarlar, Sistem Admin, Denetim Kaydı ve Profil — UX/UI Audit (2026-10-16)

> Kapsam: `/settings`, `/system-admin`, `/audit-log`, `/profile`; `src/components/settings/**`, `src/components/admin/**`, `src/components/profile/**`; bunları besleyen hook, yetki ve Convex fonksiyonlarının salt okunur incelemesi.
> Sayım: 🔴 9 · 🟠 20 · 🟡 12 · ⚪ 0 — 41 bulgu. Önem: kritik / yüksek / orta / düşük. Efor: S <2 saat, M yaklaşık yarım gün, L 1+ gün.
> Yöntem: mevcut çalışma ağacında statik kaynak incelemesi; canlı DB, e-posta, cihaz, provisioning servisi veya dev server çalıştırılmadı. Satırlar bu tarihteki kaynak ağacına aittir. Süreler kişi-gün tahminidir; kaynak dosyalar değiştirilmedi.

## 1. Özet

Bu modüller şirketin kurulmasını, erişim yetkilerinin yönetilmesini, cihazların projelere bağlanmasını ve değişikliklerin izlenmesini sağlıyor. En büyük sorunlar **rol ve proje bağlamının işlemle uyuşmaması**, **başarı veya kapalı durumunun gerçekte kaydedilmemesi** ve **denetim/rapor ekranlarının eksik veriyi tamamlanmış sonuç gibi sunması**. Proje yöneticisinin kullanıcı ekranı yetki hatasına düşüyor; kullanıcı düzenleme seçili projeye sessiz atama yapabiliyor; proje silme bağlı kayıtları sahipsiz bırakıyor. Pafta entegrasyonu simülasyon olduğu halde gerçek bağlantı iddiasında bulunuyor, zamanlanmış rapor kapatılamıyor ve denetim araması son 200 kayıtla sınırlı. Mevcut olumlu temeller — Ayarlar sekmesinin URL'de tutulması, cihaz taşıma uyarısı, tatil doğrulaması, fotoğraf boyut/tür kontrolü ve bazı erişilebilir ikonlar — korunarak önce veri ve yetki hataları giderilmeli.

### İncelenen yüzeyler ve erişilebilirlik sınırı

| Yüzey | İnceleme kapsamı / mevcut olumlu özellik | Bulgular |
|---|---|---|
| Genel / şirket / sistem | Şirket formu, tema, dil, tarih, saat ve bildirim tercihi; şirket adı zorunlu, alanların çoğu label ile bağlı | ADM-05, 15–18, 36–37 |
| Kullanıcı yönetimi | Arama, davet, düzenleme, silme, süresi dolmuş davet, parola sıfırlama; silme onayı var | ADM-01–08, 22, 32 |
| Mesai & Tatil | Limit ve çarpanlar, yıl filtresi, otomatik doldurma, ekleme/silme; tatil şeması ve silme onayı var | ADM-14–15, 17–18, 27, 39 |
| Raporlar | SGK, fazla mesai, devam, departman maliyeti; Excel/PDF, kişisel zamanlama; uygun olmayan PDF düğmesi disabled | ADM-11–13, 15, 22, 41 |
| Entegrasyonlar / e-posta / bildirim | Pafta, Hikvision köprüsü, SMTP formu ve bildirim tercihleri; köprü token kopyalama hatası ele alınıyor | ADM-01, 05, 09–10, 15–18, 37–38 |
| İlk kurulum ve eski vardiya bileşenleri | `OnboardingProgress`, `StepNavigation`, `CompanySettings`, `WorkScheduleSettings`, `SettingsTabs`, `ShiftSettings`, `ShiftTable`, `AddShiftDialog`, şemalar ve hook/type dosyaları okundu | ADM-19, 40; atıl yüzeylerdeki kusurlar canlı akış hatası olarak sayılmadı |
| Sistem Admin | Proje/kullanıcı listesi, proje ekle/düzenle/sil; cihaz havuzu, kayıt/atama/taşıma/silme/senkronizasyon | ADM-20–27, 30, 32, 37 |
| IDE provisioning | Bileşen, sağlık/tarama/provision/durum akışı okundu; `src` içinde import/render bulunmadı | ADM-25–26; gerçek cihaz sonucu **(doğrulanmadı)** |
| Denetim Kaydı | Yetki, proje, tablo ve tarih filtreleri, satır detayı; backend liste ve hedef tablo seçenekleri | ADM-28–32, 37 |
| Profil | Ad, rol, fotoğraf, proje yetkileri, çıkış, parola/2FA kartı | ADM-06, 08, 17, 33–35, 37 |

Rubriğin 1–10 maddesi tüm yüzeylerde tarandı. Responsive ve kontrast bulguları CSS/DOM kanıtına dayanır; piksel ölçümü, ekran okuyucu ve gerçek tarayıcı davranışı **(doğrulanmadı)**. Bağımsız auth kurulum rotaları (`/user-setup`, `/admin-setup`, `/employee-setup`) bu rapordaki şirket onboarding'i ile aynı akış olarak değerlendirilmedi. `/shifts` ve `/pdks-records` ekranları yeniden audit edilmedi; yalnız kapsamda belirtilen ortak ayar bileşenleri ve Raporlar sekmesinin kendi sorguları incelendi.

## 2. Ana görevler

Adım sayıları rotaya geldikten sonraki anlamlı kullanıcı eylemleridir; serbest metin alanlarının her tuş vuruşu sayılmaz.

| Görev | Bugünkü akış (adım sayısı) | Takıldığı yer |
|---|---|---|
| Şirketi ilk kez kurmak | Genel form → kaydet → kullanıcı → davet → mesai/tatil → kaydet → entegrasyon; en az 7, rehberli bitiş yok | Kurulum bileşenleri bağlanmamış; tamamlanma göstergesi ve kaldığı yerden devam yok |
| Kullanıcı davet etmek / yetkisini değiştirmek | Kullanıcılar → yeni/düzenle → e-posta/rol/proje → kaydet; 4 | Proje yöneticisi daha liste yüklenirken super admin sorgusunda hata; düzenlemede mevcut üyelik yerine aktif proje |
| Mesai ve tatil ayarlamak | Mesai & Tatil → değerler → kaydet; takvimde yıl → doldur/ekle; 3 + 2 | Sorgular gelmeden varsayılanlar kaydedilebilir; iki mutation tek işlem görünümünde |
| Rapor almak / e-postayı durdurmak | Raporlar → tür/dönem → indir; zamanlama → anahtar kapat; 3 / 2 | Çok projeli kapsam görünmüyor; kapatınca kaydet kayboluyor; devam raporu eksik/yanlış devamsızlık |
| Proje ve üyeleri yönetmek | Proje & Kullanıcı → listeyi aç → düzenle; üyelik değiştirmek için Ayarlar'a git; 3–5 | Kullanıcı yönetimi burada yapılmıyor; pasife alma kontrolü yok; silmede ilişkiler korunmuyor |
| Cihazı kaydetmek / taşımak | Cihaz Yönetimi → ekle/satır → UUID/ad/proje → kaydet → taşımada onay; 4–5 | Kayıt ve atama ayrı işlemler; canlı durum zamanı donmuş; provisioning için erişilebilir giriş yok |
| Kimin neyi değiştirdiğini bulmak | Denetim → proje/tablo/tarih → satır aç; 3 | Kullanıcı/metin araması yok; eski kayıtlar son 200 dışında; değişiklik ham JSON |
| Kendi profilini güncellemek | Profil → ad/fotoğraf → kaydet; 3 | Ad formu ilk boş prop'u saklayabiliyor; klavyeyle fotoğraf yükleme erişilemiyor; parola düğmesi işlevsiz |

## 3. Bulgular

### A. Kullanıcı ve rol yönetimi

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ADM-01 | 🔴 Kritik | 1,3,8 | **Rol görünürlüğü backend ile çelişiyor.** Kullanıcı paneli `listExpired` sorgusunu koşulsuz çalıştırıyor; bu sorgu yalnız süper admin. Proje yöneticisi için panel hata üretir; `ProjectFilter admin` ayrıca yönetici rolü yerine yalnız proje varlığını kontrol ediyor ve parent hook'larını korumuyor. Üye Ayarlar menüsünden kullanıcı/entegrasyon sekmelerine de ulaşabilir; Hikvision sorgusu admin gerektirir. Denetim sayfasında yetki kontrolü sorgulardan sonra gelir. | `src/components/admin/AdminUsersPanel.tsx:23`, `convex/invites.ts:182`, `src/components/auth/ProjectFilter.tsx:26`, `src/components/settings/SettingsSidebar.tsx:67`, `convex/hikBridge.ts:321`, `src/pages/AuditLog.tsx:74`, `src/pages/AuditLog.tsx:92` | Rol yüklenene kadar `skip`; yetki sınırını veri çeken bileşenin üstüne taşı; izinli sekmeler ve eylemler ortak yetenek haritasından gelsin. Proje yöneticisine davet, süper admine rol/üyelik/silme; reddedilen URL için `AccessDenied`. Backend yetkisini gevşetme. | L |
| ADM-02 | 🔴 Kritik | 1,2,10 | **Kullanıcı düzenlemek yanlış projeye erişim ekleyebilir.** Form mevcut üyelikleri okumak yerine `activeProjectId` ile açılır. Kaydet her zaman `assign` çağırır; eski üyeliği kaldırmaz. Tekli “Proje” seçimi değiştirme izlenimi verirken yeni erişim ekler; tablo projeleri göstermediğinden kullanıcı sonucu göremez. Rol ve üyelik iki ayrı mutation olduğundan ikinci hata ilkini geri almaz. | `src/components/admin/hooks/useUserManagement.ts:38`, `src/components/admin/hooks/useUserManagement.ts:47`, `convex/userProjects.ts:70`, `src/components/admin/components/UserFormDialog.tsx:90`, `src/components/admin/components/UserTable.tsx:57` | Mevcut üyelikleri yükle; ekleme/kaldırmayı açık çoklu seçim ve değişiklik özetiyle göster; rol kapsamını “tüm projelerde” diye açıkla. Tek atomik mutation; query'den türetilen tipler kullan. | L |
| ADM-03 | 🔴 Kritik | 1,3 | **Süper admin kendi/son süper admin rolünü düşürebilir.** `updateRole` sadece patch yapar; kendini veya son yöneticiyi korumaz. Kendini düşürünce hemen sonraki proje ataması super admin gerektirdiğinden hata verir, fakat rol çoktan değişmiştir; yönetim erişimi kaybolabilir. | `convex/users.ts:56`, `convex/users.ts:67`, `src/components/admin/hooks/useUserManagement.ts:47`, `convex/userProjects.ts:63` | Backend'de son süper admin ve kendini yetkisiz bırakma kontrolü; rol düşürmede etki özeti/onay; ADM-02 atomik işlemine dahil et. | M |
| ADM-04 | 🟠 Yüksek | 1,3 | **Davet tekrar gönderimi başarısızken başarılı görünüyor.** Action `{success:false,error}` dönebilir; tekrar gönder handler'ı sonucu incelemeden “Davet yeniden gönderildi” toast'ı gösterir. İlk davet akışı aynı sonucu doğru kontrol ediyor. | `src/components/admin/AdminUsersPanel.tsx:29`, `convex/actions/sendEmail.ts:221`, `convex/actions/sendEmail.ts:263`, `src/components/admin/hooks/useUserManagement.ts:89` | Ortak sonuç işleyici; yalnız `success` ise başarı, hata halinde satırda tekrar deneme ve Türkçe açıklama. | S |
| ADM-05 | 🟠 Yüksek | 1,3 | **Bekleyen kayıt görünümü işlevsiz.** Genel/mail/bildirim hook'ları `saving/isSaving:false` döndürür. Kullanıcı dialog'una mevcut `isSaving` prop'u hiç verilmez; silme de kilitlenmez. Tekrarlı tıklamalar birden fazla davet veya değişiklik isteği gönderebilir; silme hatasında parent dialog'u yine kapatır. | `src/components/settings/sections/hooks/useGeneralSettings.ts:63`, `src/hooks/useMailSettings.ts:55`, `src/hooks/useNotificationSettings.ts:52`, `src/components/admin/AdminUsersPanel.tsx:99`, `src/components/admin/AdminUsersPanel.tsx:76`, `src/components/admin/components/DeleteUserDialog.tsx:38` | Gerçek async pending durumu; başlatılan işlem boyunca gönder/kapat denetimi; silme sonucu boolean/typed result olsun, hata halinde seçimi koru. | M |
| ADM-06 | 🟠 Yüksek | 1,2,8 | **Parola işleri tamamlanamıyor.** Profilde etkin “Şifre Değiştir” düğmesinde handler yok. Admin satırındaki e-posta ikonu ise yalnız “hazırlanıyor” dialog'u açıyor. 2FA açıkça “Yakında” ve disabled; parola işlerinde aynı dürüstlük yok. | `src/components/profile/SecurityCard.tsx:22`, `src/components/profile/SecurityCard.tsx:32`, `src/components/admin/components/UserTable.tsx:86`, `src/components/admin/components/UserPasswordResetDialog.tsx:41` | UX-0'da işlevsiz aktif düğmeleri açıklamalı unavailable durumuna al; UX-2'de gerçek parola değiştirme/sıfırlama akışı ve yeniden kimlik doğrulama ekle. | L |
| ADM-07 | 🟠 Yüksek | 6,7 | Kullanıcı başlığı tek yatay flex, arama `w-80`; dar ekranda başlık + arama + yeni kullanıcı düğmesi yerleşimi esnemiyor. Satırdaki üç ikon düğmesinde erişilebilir ad yok; rol/proje label'larının trigger ID'leri yok. | `src/components/admin/components/UserTableHeader.tsx:19`, `src/components/admin/components/UserTableHeader.tsx:32`, `src/components/admin/components/UserTable.tsx:83`, `src/components/admin/components/UserFormDialog.tsx:69`, `src/components/admin/components/UserFormDialog.tsx:98` | Mobilde başlık/arama/eylem alt alta, arama `w-full`; ikonlara kayıt adı içeren `aria-label`; label-trigger bağları; klavye turu. | M |
| ADM-08 | 🟡 Orta | 8 | Aynı rol profil formunda ham `project_user`, erişim kartında “Üye”, admin tabloları ve davette “Kullanıcı”; sistem başlığında “Super Admin”. Yetkinin farklı olduğu izlenimini veriyor. | `src/lib/roleLabels.ts:1`, `src/components/profile/ProfileForm.tsx:103`, `src/components/profile/UserProjectsCard.tsx:11`, `src/components/admin/components/UserTable.tsx:44`, `src/components/admin/components/UserFormDialog.tsx:84`, `src/components/admin/AdminProjectsPanel.tsx:34`, `src/pages/SystemAdmin.tsx:43` | Bütün görünür roller `roleLabel` üzerinden; kod enum'u yalnız API sınırında. Tek rol açıklaması ve yetki kapsamı kullan. | S |

### B. Ayarlar, raporlar ve ilk kurulum

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ADM-09 | 🔴 Kritik | 1,3,8 | **Pafta entegrasyonu gerçekmiş gibi sunulan simülasyon.** Anahtar `Math.random` ile üretiliyor; test sonucu rastgele; bağlantı ve son senkronizasyon timer ile başarılı oluyor. Kart aktif Ayarlar rotasında render ediliyor; gerçek istek/persist yok. Kullanıcı bordro verisinin aktarıldığını sanabilir. | `src/components/settings/sections/integrations/PaftaIntegrationCard.tsx:37`, `src/components/settings/sections/integrations/PaftaIntegrationCard.tsx:106`, `src/components/settings/sections/integrations/PaftaIntegrationCard.tsx:125`, `src/components/settings/sections/IntegrationsSettings.tsx:25` | UX-0'da açık “Henüz kullanılamıyor” durumu, sahte anahtar/test/senkronizasyonu kaldır. Gerçek backend entegrasyonu ayrı ürün işi; simülasyonu canlı akış olarak yayımlama. | S |
| ADM-10 | 🟠 Yüksek | 1,2,8 | SMTP host/port/parola ve “Mail Gönderimi Aktif” kaydediliyor fakat incelenen davet gönderimi bu ayarları okumadan ortam değişkenli Resend kullanıyor. Kullanıcı SMTP'yi düzeltip davet sorununu çözdüğünü veya anahtarı kapatıp gönderimi durdurduğunu sanabilir. Formda bağlantı testi de yok. | `src/components/settings/sections/MailSettings.tsx:68`, `src/components/settings/sections/MailSettings.tsx:140`, `convex/settings.ts:97`, `convex/actions/sendEmail.ts:9`, `convex/actions/sendEmail.ts:31`, `convex/actions/sendEmail.ts:263` | Kullanılan sağlayıcı ve kapsama ilişkin doğru açıklama; etkisiz SMTP kontrollerini gizle. Sağlayıcı yönetimi yapılacaksa backend sözleşmesi, kaydet/test ayrımı ve sonucu ekle. Diğer olası dış göndericiler **(doğrulanmadı)**. | M |
| ADM-11 | 🔴 Kritik | 1,3 | **Zamanlanmış rapor kapatılamıyor.** Switch yalnız local state değiştirir; Kaydet `scheduledEnabled` koşulunun içinde. Kapatınca kaydet kaybolur; backend `enabled:true` kalır, otomatik e-posta devam edebilir. | `src/components/settings/sections/ReportsSettings.tsx:334`, `src/components/settings/sections/ReportsSettings.tsx:340`, `src/components/settings/sections/ReportsSettings.tsx:349`, `convex/reports.ts:616` | Kaydet her iki durumda görünür; disable işleminde gizli e-posta alanını zorunlu kılma; pending ve yeniden açılışta persisted durum doğrulaması. | S |
| ADM-12 | 🟠 Yüksek | 1,2 | **Raporun proje kapsamı görünür bağlamdan farklı.** Raporlar tüm erişilebilir `projectIds` dizisini yollar; üstte seçili aktif projeyi kullanmaz. Super admin dalı tüm projeleri okur. Ekranda bu kapsamı anlatan seçim/etiket yok. Backend ayrıca gelen `isSuperAdmin` ve proje dizisini sorgu dallarında kullanıyor; görünür kapsamı sunucu kimliğiyle sınırlandırmak gerekli. | `src/components/settings/sections/ReportsSettings.tsx:49`, `src/components/settings/sections/ReportsSettings.tsx:61`, `src/contexts/ActiveProjectContext.tsx:82`, `convex/reports.ts:41`, `convex/reports.ts:51` | Varsayılan aktif proje; yetkili kullanıcıya açık “Tüm erişilebilir projeler” seçimi; dosya başlığı ve zamanlama kapsamı aynı olsun. Backend rolü `ctx.user` üzerinden, talep edilen projeleri izinli kümeyle doğrulasın. | L |
| ADM-13 | 🟡 Orta | 1,2,4 | İndirilecek rapor türü ile e-posta aboneliğinin türü tek `reportType` state'ini paylaşır; schedule sorgusu gelince kullanıcı seçimini değiştirir. Abonelikte ayrı tür/kapsam özeti yok; “Kaydet” mevcut indirme türünü aboneliğe yazar. E-posta yalnız boşluk kontrolüyle doğrulanır, form submit kullanılmaz. | `src/components/settings/sections/ReportsSettings.tsx:91`, `src/components/settings/sections/ReportsSettings.tsx:119`, `src/components/settings/sections/ReportsSettings.tsx:126`, `convex/reports.ts:591` | İndirme ve abonelik state'lerini ayır; abonelik türünü/alıcıyı/gönderim dönemini tek özet olarak göster; e-posta schema doğrulaması ve pending ekle. | M |
| ADM-14 | 🟠 Yüksek | 1,3,4 | **Mesai formu yüklenmeden kaydedilebilir ve kısmi kayıt yaratır.** Başlangıç değerleri 270/225 vb.; alt sorgular için loading kapısı yok, Kaydet sadece saving/proje kontrol eder. İki ayrı mutation `Promise.all` ile yürür: biri başarılı, diğeri başarısızsa tek “Kayıt başarısız” mesajına rağmen veri değişmiştir. Üye için `upsertWork` authed, oran mutation'ı admin olduğundan kısmi kayıt için somut yetki uyumsuzluğu da var. | `src/components/settings/sections/components/OvertimeSettingsForm.tsx:27`, `src/components/settings/sections/components/OvertimeSettingsForm.tsx:68`, `src/components/settings/sections/components/OvertimeSettingsForm.tsx:233`, `convex/settings.ts:191`, `convex/holidays.ts:184` | Sorgular çözülene ve düzenleme yetkisi kesinleşene kadar iskelet/disabled; tek atomik backend mutation ve alan bazlı doğrulama. Proje değişince taslağı proje kimliğiyle sıfırla. | L |
| ADM-15 | 🟠 Yüksek | 1,4 | Kritik ayar sayıları browser `min` değerine bırakılıyor ama form submit yok: mesai tabanı 0/negatif, çarpan <1 ve SMTP portu boşken `NaN` gönderilebilir. Backend `v.number()` yalnız tip doğruluyor. Şirket/proje/ad alanlarında trim ve Türkçe alan hataları da tutarsız. | `src/components/settings/sections/components/OvertimeSettingsForm.tsx:150`, `src/components/settings/sections/components/OvertimeSettingsForm.tsx:233`, `convex/settings.ts:204`, `convex/holidays.ts:187`, `src/components/settings/sections/MailSettings.tsx:83`, `src/components/admin/AdminProjectsPanel.tsx:99`, `src/components/profile/ProfileForm.tsx:35` | Zod + `z.infer`, boş sayıyı sayıya çevirmeden ayır; geçerli aralık/finite kontrolünü backend'de tekrarla. `FormFieldWrapper` ile alan altında Türkçe hata, ilk hataya focus; port 1–65535, saat tabanı >0. | M |
| ADM-16 | 🟠 Yüksek | 1,4 | **Kapalı sistem bildirimi yeniden açık gösteriliyor.** `defaultChecked={saved || true}` ifadesi kayıtlı `false` değerini `true` yapar. Kullanıcı başka alanı kaydederken bildirim tercihini de yeniden açabilir. Genel ve Bildirimler sekmesinde benzer adlı iki ayrı tercih olması kapsamı belirsizleştiriyor. | `src/components/settings/sections/general/SystemSettingsForm.tsx:126`, `src/components/settings/sections/GeneralSettings.tsx:52`, `src/components/settings/sections/NotificationSettings.tsx:85` | `?? true` ve kontrollü form reset; bildirim tercihlerini tek yerde topla, hangi kanal/olayı etkilediğini belirt. Kapalı → yeniden aç → başka alan kaydet senaryosu. | S |
| ADM-17 | 🟠 Yüksek | 1,4 | Kaydedilmemiş ayarlar sekme değişince unmount olur; uyarı/taslak yok. Mail/bildirim/mesai effect'leri her yeni sorgu sonucu geldiğinde dirty alanları ezebilir. Profilde çıkış düğmesi düzenleme sırasında kullanılabilir. Kayıt devam ederken veya reaktif güncellemede kullanıcının emeği kaybolabilir. | `src/pages/Settings.tsx:63`, `src/pages/Settings.tsx:116`, `src/components/settings/sections/MailSettings.tsx:27`, `src/components/settings/sections/NotificationSettings.tsx:22`, `src/components/settings/sections/components/OvertimeSettingsForm.tsx:40`, `src/components/profile/ProfileForm.tsx:109` | Dirty/pristine ayrımı; veri yüklemesini sadece ilk kayıt/proje değişimiyle reset et; proje/sekme/çıkışta “Kaydet / Vazgeç / Burada kal”. Kayıtlı tema ile anlık önizlemeyi ayır. | L |
| ADM-18 | 🟡 Orta | 2,3,9 | Ayarlar bütün sekmeleri genel ayar sorgusunun tam sayfa spinner'ına bağlıyor. Mobilde yedi maddeli dikey menü içeriğin üstüne yerleşiyor; seçili madde yalnız renkle belirtiliyor. Kullanıcı kaydetmek için içerik ve sayfa sonu arasında gidip geliyor. | `src/pages/Settings.tsx:47`, `src/pages/Settings.tsx:59`, `src/pages/Settings.tsx:112`, `src/components/settings/SettingsSidebar.tsx:57`, `src/components/settings/SettingsSidebar.tsx:72` | Sayfa kabuğunu sabit tut, bölüm bazlı yükleme; mobil bölüm select'i; `aria-current`; görünür kayıt çubuğu. URL sekmesini koru, geri/ileri beklentisi için replace kullanımını değerlendir. | M |
| ADM-19 | 🟠 Yüksek | 1,2,3 | **Şirket ilk kurulum akışı yok.** Ayarlar renderer'ı yalnız sekmeleri açıyor; onboarding progress/navigation ve eski Company/WorkSchedule bileşenlerinin `src` içinde tüketicisi bulunmadı. Eski navigation'da “Kurulumu Tamamla” son adımda disabled; eski şirket/vardiya kaydet düğmeleri işlevsiz; mail/bildirim `onComplete` callback'i kayıt sonucu beklenmeden çağrılır. Bunlar bugün görünmeyen, yeniden bağlama öncesi giderilecek kusurlardır. | `src/pages/Settings.tsx:63`, `src/components/settings/OnboardingProgress.tsx:17`, `src/components/settings/StepNavigation.tsx:47`, `src/components/settings/sections/CompanySettings.tsx:39`, `src/components/settings/sections/WorkScheduleSettings.tsx:38`, `src/components/settings/sections/MailSettings.tsx:42`, `src/components/settings/sections/NotificationSettings.tsx:33` | Mevcut gerçek formlarla 4 adımlı proje kurulum kontrol listesi; tamamlanma yalnız başarılı kayıtla; son adım etkin bitiş eylemi; opsiyonel entegrasyonu atla. Eski iskeletleri doğrudan bağlama. | L |

### C. Sistem Admin, proje ve cihazlar

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ADM-20 | 🔴 Kritik | 1,3 | **Proje silme ilişkileri sahipsiz bırakıyor.** Mutation sadece `projects` kaydını siler; üyelik/cihaz/personel/ayar ilişkilerine yönelik kontrol veya politika yok. Üyelik sorgusu silinen projeyi filtrelemeyip “Proje” adıyla geri verir. UI “başarıyla silindi” der; onay bağlı kaynak etkisini anlatmaz. | `convex/projects.ts:82`, `convex/projects.ts:93`, `convex/userProjects.ts:17`, `src/components/admin/AdminProjectsPanel.tsx:123`, `src/components/admin/AdminProjectsPanel.tsx:305` | İlk güvenli düzeltme: bağlı kayıt varsa silmeyi backend'de engelle, sayıları/çözüm adımını göster. Arşivleme/pasife alma tercih et; veri temizleme gerekiyorsa ayrıca tasarlanmış politika, bu audit migration önermez. | L |
| ADM-21 | 🟡 Orta | 1,2 | Projede Aktif/Pasif rozeti ve mutation desteği var, düzenleme formunda kontrol yok. “Proje & Kullanıcı” sekmesi üyeleri sadece gösteriyor; ekle/kaldır bağlantısı yok. Admin sekmesi URL'de tutulmadığı için yenileme cihazlar görünümünden projelere döner. | `src/components/admin/AdminProjectsPanel.tsx:199`, `src/components/admin/AdminProjectsPanel.tsx:277`, `src/components/admin/AdminProjectsPanel.tsx:243`, `src/components/settings/sections/AdminDashboard.tsx:42` | Aktif/pasif kontrolü + etki özeti; proje üyelerinden kullanıcı yönetimine seçili proje ile bağlantı; `?tab=devices` kalıcı state. | M |
| ADM-22 | 🟠 Yüksek | 2,9 | Büyük listeler tamamıyla yüklenip client'ta işleniyor. Proje paneli tüm projeler/kullanıcılar/üyelikleri alıp her proje için tekrar filtreler; cihazlar `.collect()` + cihaz başına proje okuması; arama/pagination yok. Rapor sorguları tarih index aralığı yerine `.filter().collect()`, SGK/devam ayrıca tüm onaylı izinleri topluyor. Büyük müşteri açılışını ve export'u geciktirebilir; gerçek süre **(doğrulanmadı)**. | `src/components/admin/AdminProjectsPanel.tsx:46`, `src/components/admin/AdminProjectsPanel.tsx:71`, `convex/users.ts:109`, `convex/userProjects.ts:105`, `convex/adminDevices.ts:15`, `convex/adminDevices.ts:19`, `convex/reports.ts:44`, `convex/reports.ts:96`, `convex/reports.ts:379` | Cursor pagination + sunucu araması; proje üyelerini açılınca getir, kart sayılarını ayrı özetle; cihaz proje adlarını tekrar kullan. Raporlarda proje+tarih index aralığı ve sınırlı/batch export; performans için doğruluğu sağlayan kapsamı daraltma. | L |
| ADM-23 | 🟠 Yüksek | 1,3 | **Cihaz çevrimiçi durumu zamanla bayatlıyor.** `nowMs` modül yüklenirken bir kez hesaplanıyor. Cihaz sonradan susunca beş dakikalık eşik ilerlemiyor; başka render olsa bile aynı zamanla “Online” kalabilir. | `src/components/admin/AdminDevicesPanel.tsx:22`, `src/components/admin/AdminDevicesPanel.tsx:105`, `src/lib/deviceStatus.ts:14` | Görünürken periyodik saat hook'u ve son görülme metni; TR Çevrimiçi/Çevrimdışı; eşik testi fake timer ile. | S |
| ADM-24 | 🟠 Yüksek | 1,3,4 | Cihaz oluşturma ve projeye atama ayrı mutation. Kayıt başarılı, atama başarısızsa form genel hata gösterip açık kalır; yeniden deneme `register` ile başlar ve “UUID zaten kayıtlı” hatası üretir. UI 15 haneli UUID isterken frontend/backend yalnız boşluk kontrolü yapıyor. | `src/components/admin/AdminDeviceDialog.tsx:73`, `src/components/admin/AdminDeviceDialog.tsx:80`, `src/components/admin/AdminDeviceDialog.tsx:90`, `src/components/admin/AdminDeviceDialog.tsx:156`, `convex/adminDevices.ts:75`, `convex/adminDevices.ts:81` | Tek atomik kayıt+atama veya kayıt sonucunu tutup “Kaydedildi, atama başarısız — tekrar ata” akışı; gerçek cihaz kimliği sözleşmesine göre frontend/backend doğrulama. | L |
| ADM-25 | 🟠 Yüksek | 1,2 | **IDE provisioning ekranına giriş yok.** Bileşen tanımlı fakat `src` içinde import/render yok; sistem cihaz sekmesi yalnız `AdminDevicesPanel` açıyor. UUID kayıt formu cihazın ağ/broker kurulumunu yapmıyor; yönetici bu işi mevcut rotadan tamamlayamaz. | `src/components/admin/IdeProvisioningCard.tsx:54`, `src/components/settings/sections/AdminDashboard.tsx:50`, `src/components/admin/AdminDevicesPanel.tsx:164` | Yetkili cihaz sekmesinde “Cihazı ağa bağla” alt akışı; yerel köprü gereksinimi, keşif, doğrulama, envantere ekleme ve proje atama ardışık olsun. Gerçek cihaz testi ayrı kabul kapısı. | L |
| ADM-26 | 🟡 Orta | 1,3,7,8 | **Atıl provisioning yeniden bağlanmadan düzeltilmeli.** Tarama yüzdesi simüle; isteklerde timeout/iptal yok. Panel seçimi değişirken eski `result` korunur; durum sorgusu yeni `ip` ile okur ama eski UUID'nin `readback` alanına yazar. Provision sürerken tarama/panel seçimi kilitli değil. “Broker/reboot/read-back/L3” kullanıcının ana dili yerine teknik çıktıyı öne çıkarıyor. | `src/components/admin/IdeProvisioningCard.tsx:109`, `src/components/admin/IdeProvisioningCard.tsx:144`, `src/components/admin/IdeProvisioningCard.tsx:175`, `src/components/admin/IdeProvisioningCard.tsx:182`, `src/components/admin/IdeProvisioningCard.tsx:298`, `src/components/admin/IdeProvisioningCard.tsx:359` | Sonucu işlemdeki IP/UUID'ye bağla; seçim değişince temizle, işlemleri karşılıklı kilitle; timeout/abort ve belirsiz progress; “Bağlantı kuruluyor / Yeniden başlatılıyor / Doğrulanıyor” adımları; ham teknik alanları detayda tut. | L |
| ADM-27 | 🟡 Orta | 3,7 | Yıkıcı işlem onayları var ancak tutarsız: cihaz taşıma/silme ve bridge iptali native confirm; proje/tatil shadcn dialog. Cihaz sil/senkronize, proje sil, tatil sil için pending kilidi yok; tatil AlertDialogAction istek sonucu beklemeden kapanır. | `src/components/admin/AdminDevicesPanel.tsx:50`, `src/components/admin/AdminDevicesPanel.tsx:70`, `src/components/admin/AdminDeviceDialog.tsx:108`, `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:59`, `src/components/admin/AdminProjectsPanel.tsx:310`, `src/components/settings/sections/components/HolidayCalendarManager.tsx:283` | Tek onay deseni: kaynak adı + etkilenen proje/geçmiş + sonuç; pending, hata halinde açık kalma, tamamlanınca focus'u kaynak satıra döndürme. Cihaz taşımanın mevcut veri kaybı uyarısını koru. | M |

### D. Denetim Kaydı

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ADM-28 | 🔴 Kritik | 1,9 | **Eski tarih/tablo araması yanlış “kayıt yok” sonucu verebilir.** Backend önce son 200 kaydı alır, tarih/hedef filtrelerini sonra uygular. Pagination veya kesilme bilgisi yok. Hedef tablo seçenekleri de global ilk 500 kayıttan türetilir; seçili proje/yeni hedeflerle uyumlu olmayabilir. | `convex/auditLog.ts:82`, `convex/auditLog.ts:110`, `convex/auditLog.ts:115`, `convex/auditLog.ts:132`, `src/pages/AuditLog.tsx:115` | Filtreyi index sorgusuna uygula, sonra cursor paginate; tarih+proje+hedef bileşik index gerektiğinde backend/schema işi. Seçenekler yetkili kapsamdan veya sabit desteklenen hedef sözlüğünden gelsin; “gösterilen” ile toplamı ayır. | L |
| ADM-29 | 🟠 Yüksek | 1,2,4 | “Kim neyi değiştirdi?” için kullanıcı, işlem türü, hedef/ad/metin araması yok; sadece tablo ve tarih var. Filtreler local state, paylaşım/yenilemede kaybolur. Tarih tarayıcının saat diliminde epoch'a çevrilir; Türkiye günü başka saat diliminde farklı olur. Bitiş seçildikten sonra başlangıcın ileri taşınmasına çapraz validasyon yok; temizle tüm-projeler anahtarını sıfırlamaz. | `src/pages/AuditLog.tsx:59`, `src/pages/AuditLog.tsx:65`, `src/pages/AuditLog.tsx:130`, `src/pages/AuditLog.tsx:159`, `convex/auditLog.ts:76` | Kullanıcı/işlem/arama + URL state; etkin kapsam çipi ve açık “tüm filtreleri temizle”; tarih aralığı schema doğrulaması; Europe/Istanbul günü ve gösterim saat dilimi etiketi. | L |
| ADM-30 | 🟡 Orta | 3,9 | Yükleme boş sonuç gibi görünüyor: denetimde `rows ?? []` → “Kayıt bulunamadı”, kullanıcı panelinde hook'un loading değeri kullanılmıyor, tatillerde `?? []`, admin kartlarında başlangıç 0. Bölüm bazlı hata/yeniden dene durumu yok; kullanıcı yüklemeyi gerçek sıfır sonuç sanabilir. | `src/pages/AuditLog.tsx:90`, `src/pages/AuditLog.tsx:186`, `src/components/admin/AdminUsersPanel.tsx:38`, `src/components/admin/hooks/useUserManagement.ts:35`, `src/components/settings/sections/components/HolidayCalendarManager.tsx:144`, `src/components/settings/sections/AdminDashboard.tsx:13` | Undefined/loading, null/no-project, empty, filtered-empty ve error ayrı; `EmptyState`, `ErrorState`, `StatCard` ve bölüm iskeleti. Query hatası için yerel error boundary; fake “yenile” eylemi ekleme. | M |
| ADM-31 | 🟠 Yüksek | 2,6,7,8 | Denetim satırı yalnız `onClick` ile açılıyor; klavye düğmesi/expanded semantiği yok. Detay sabit iki sütun ham JSON, hedef kimliği kısaltılmış ve kopyalama yok. Tüm projeler görünümünde proje sütunu da yok; aynı adlı kullanıcı/hedefleri ayırmak zor. | `src/pages/AuditLog.tsx:204`, `src/pages/AuditLog.tsx:230`, `src/pages/AuditLog.tsx:239`, `src/pages/AuditLog.tsx:244`, `src/pages/AuditLog.tsx:178` | Adlandırılmış aç/kapat düğmesi + `aria-expanded`; “Alan / Önce / Sonra” Türkçe diff; ham JSON ikincil görünüm; tam ID kopyala, proje adı; mobil tek sütun veya drawer. | L |
| ADM-32 | 🟠 Yüksek | 1,2 | Denetim ekranı bu grubun temel değişikliklerini kapsamıyor: kullanıcı rolü/üyeliği, proje, genel/mail/bildirim/çalışma ayarı mutation'ları audit yazmıyor. Tatil ve oranlarda `writeAudit` var. Dolayısıyla “kim erişim verdi / ayarı değiştirdi?” sorusu UI iyileşse de yanıtsız. | `convex/users.ts:67`, `convex/userProjects.ts:76`, `convex/projects.ts:77`, `convex/settings.ts:71`, `convex/settings.ts:120`, `convex/settings.ts:165`, `convex/settings.ts:217`, `convex/holidays.ts:84`, `convex/lib/audit.ts:24` | Backend mutation'ları audit helper ile aynı transaction'da yazsın; actor/proje/hedef/önce-sonra kaydı. SMTP parolası, bridge token ve diğer sırları audit payload'ına koyma; yalnız “değişti” bilgisi. Kayıt kapsamını ekranda belirt. | L |

### E. Profil ve ortak sunum

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ADM-33 | 🔴 Kritik | 1,4,10 | **Profil adı ilk açılışta boş kalıp mevcut adı silebilir.** `useProfileUtils` state'i boş başlatır, profili effect'te kopyalar. User/profile zaten yüklüyken sayfa formu hemen render eder; `ProfileForm` o ilk boş `fullName` prop'unu yalnız `useState(fullName)` ile alır, sonraki prop'u senkronlamaz. Boş değer kabul edilerek backend'e yazılır. Kaynak akışından çıkarım; tarayıcı tekrarı **(doğrulanmadı)**. | `src/hooks/useProfileUtils.ts:27`, `src/hooks/useProfileUtils.ts:33`, `src/pages/Profile.tsx:18`, `src/pages/Profile.tsx:36`, `src/components/profile/ProfileForm.tsx:25`, `convex/users.ts:98` | Tek form veri kaynağı; yüklenen profilden ilk değerleri doğrudan türet, pristine formu kontrollü reset et; trim/min doğrulaması backend'de de olsun. Dolu profil ile doğrudan navigasyon testi. | M |
| ADM-34 | 🟠 Yüksek | 4,7 | Fotoğraf değiştirme kontrolü yalnız ikonlu label; input `display:none`, label focus almaz. Klavyeyle upload başlatılamaz, erişilebilir ad yok. `accept=image/*` seçtirir ama yalnız JPEG/PNG/WebP kabul edilir; seçilebilir tür ile hata metni uyuşmuyor. Boyut/tür kontrolü ve pending mevcut, korunmalı. | `src/components/profile/ProfilePhoto.tsx:34`, `src/components/profile/ProfilePhoto.tsx:105`, `src/components/profile/ProfilePhoto.tsx:118`, `src/components/profile/ProfilePhoto.tsx:119` | “Fotoğrafı değiştir” button + file input ref veya erişilebilir input; tam MIME listesi; yükleme durumunu duyur. Silme/kırpma yeni yetenek olarak ayrı değerlendirilebilir. | S |
| ADM-35 | 🟡 Orta | 1,10 | Profil fotoğrafı başarıyla `photoUrl` alanına kaydolurken ortak başlık yerel type cast ile `photo_url` okuyor; yüklenen avatar profil dışındaki üst menüde görünmüyor. Ad da üst menüde sadece e-postadan türetiliyor. Bu, “güncelleme olmadı” algısı yaratır. | `convex/files.ts:44`, `src/components/layout/AppHeader.tsx:23`, `src/components/layout/AppHeader.tsx:39`, `src/components/layout/AppHeader.tsx:70`, `src/components/layout/AppHeader.tsx:25` | AuthProvider'ın gerçek tipini koru; `photoUrl`, `fullName/name` fallback'i; yerel snake_case kopyasını kaldır. Ortak kabuk sahipliği koordinatörle paylaşılmalı. | S |
| ADM-36 | 🟠 Yüksek | 1,2,8 | Genel sekme sistem dili/tarih formatı/saat dilimi ve çalışma saatlerinin sistemi yönettiği izlenimini veriyor; incelenen denetim görünümü sabit Türkçe format ve tarayıcı saatini kullanıyor, Mesai & Tatil metni çalışma saatlerinin vardiyada yönetildiğini söylüyor. `systemLanguage`/`dateFormat` için `src` taramasında kayıt/form dışında tüketim bulunmadı. | `src/components/settings/sections/general/SystemSettingsForm.tsx:27`, `src/components/settings/sections/general/SystemSettingsForm.tsx:57`, `src/components/settings/sections/general/SystemSettingsForm.tsx:74`, `src/pages/AuditLog.tsx:216`, `src/components/settings/sections/WorkAndPayrollSettings.tsx:10` | Desteklenmeyen tercihleri işlevliymiş gibi sunma; mevcut uygulama kapsamını açıkla. Vardiya saatine bağlantı, kişisel görünüm tercihi ile şirket kurallarını ayır; yerelleştirme gerçekten uygulanacaksa ortak formatter ile ayrı iş. | M |
| ADM-37 | 🟡 Orta | 5,7,8 | Semantik status tokenları varken denetimde `bg-green-100/text-green-800` vb. sabit map, profilde `text-gray-500`, atıl onboarding'de hex renk kullanılıyor. Kaydet düğmesinde disk emojisi; dil/para birimi seçeneklerinde bayraklar ve karışık İngilizce; toast'ların çoğu eski hook, Raporlar sonner. Select label bağlantıları Genel formda da eksik. Gerçek kontrast oranı **(doğrulanmadı)**. | `src/pages/AuditLog.tsx:32`, `src/components/profile/ProfileForm.tsx:80`, `src/components/settings/OnboardingProgress.tsx:52`, `src/components/settings/sections/general/FormSubmitButton.tsx:16`, `src/components/settings/sections/general/SystemSettingsForm.tsx:29`, `src/components/settings/sections/general/CompanyInfoForm.tsx:104`, `src/components/settings/sections/ReportsSettings.tsx:21`, `src/index.css:158` | `status-*`/Badge tokenları, lucide Save, Türkçe terimler ve sonner; mevcut shared bileşenleri kullan. Her label'a control ID; açık/koyu tema ve klavye kontrolü. | M |
| ADM-38 | 🟡 Orta | 2,3,8 | Hikvision köprüsü token üretir/kopyalar/iptal eder ama kuruluma geçiş düz metin localhost adresi ve EXE jargonundan oluşur. Kullanıcı token'ı ürettikten sonra cihazın nereden ekleneceğini ve bağlantının çalıştığını tamamlanmış görev olarak izleyemez; sadece son bağlantı tarihi var. | `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:94`, `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:139`, `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx:180` | Üç adımlı kısa yönerge: köprüyü kur → anahtarı gir → cihazı ekle; yerel ayar ekranına açık bağlantı, Cihazlar'a CTA, son bağlantı/bağlantı bekleniyor durumu. Token gizleme/kopyalama aria-label'larını koru. | M |
| ADM-39 | 🟡 Orta | 1,3,4,7 | Tatil ekleme tarihi yıl filtresinden bağımsız. Örneğin 2026 listesinde 2027 tarihi eklenir, “Tatil eklendi” görülür ama satır görünmez. Yıl alanı boşken 0 sorgulanabilir; tarih label'ı `hol-date` ile ilişkili bir control ID'ye bağlanmıyor; silme ikonu adsız. | `src/components/settings/sections/components/HolidayCalendarManager.tsx:48`, `src/components/settings/sections/components/HolidayCalendarManager.tsx:83`, `src/components/settings/sections/components/HolidayCalendarManager.tsx:160`, `src/components/settings/sections/components/HolidayCalendarManager.tsx:182`, `src/components/settings/sections/components/HolidayCalendarManager.tsx:270` | Eklenen tarihin yılına geç veya görünür liste dışı kaydı bağlantıyla belirt; yıl aralığı/boşluk validasyonu; tarih trigger ID ve silme aria-label; eksik dini tatil verisini yalnız toast yerine kalıcı uyarıda göster. | M |
| ADM-40 | 🟡 Orta | 1,3,4 | **Atıl ShiftSettings tüketicisi form hatasında taslağı siliyor.** `handleAdd/handleUpdate` hatayı yakalayıp yutar; `AddShiftDialog` resolved callback sonrası koşulsuz kapanıp formu sıfırlar. Callback sözleşmesi `void`, başarıyı ayıramıyor. Bu eski ayar tüketicisi aktif Settings rotasına bağlı değil; ortak dialog `/shifts` tarafından da kullanılıyor, oradaki davranış ayrı rapor konusu. | `src/components/settings/sections/ShiftSettings.tsx:72`, `src/components/settings/sections/ShiftSettings.tsx:85`, `src/components/settings/sections/components/AddShiftDialog.tsx:39`, `src/components/settings/sections/components/AddShiftDialog.tsx:142`, `src/components/settings/sections/components/AddShiftDialog.tsx:149` | Yeniden kullanım öncesi callback'e typed success sonucu veya error propagation; yalnız başarılı kayıtta kapat. Ortak dialog değişikliği vardiya worker'ıyla koordine edilmeli; form hatası alan altında gösterilmeli. | M |

### F. Ayarlar içindeki rapor verisinin doğruluğu

| ID | Önem | Kat.(1-10) | Bulgu | Yer (file:line) | Öneri | Efor |
|---|---|---|---|---|---|---|
| ADM-41 | 🔴 Kritik | 1,8 | **Devam Özet yanlış devamsızlık bildiriyor.** Satırlar personel listesinden değil okumalardan oluşuyor: ay boyunca hiç okutması olmayan personel hiç görünmüyor. `workDaysInMonth = lastDay` takvim gününü iş günü sayıyor; hafta tatili/resmi tatil/vardiya günü dikkate alınmadan devamsızlık hesaplanıyor. Ay ortasında mevcut ay indirildiğinde gelecekteki günler de paydaya giriyor. | `src/components/settings/sections/ReportsSettings.tsx:75`, `convex/reports.ts:384`, `convex/reports.ts:391`, `convex/reports.ts:393`, `convex/reports.ts:416` | Personel + istihdam/vardiya takvimi temelli kapsam; yalnız tamamlanmış ve çalışılması beklenen günler; sıfır okuma personelini dahil et. PDKS ortak hesap motorunu yeniden kullan, paralel hesap yazma; doğrulanana kadar raporun güvenilirlik sınırını açık göster. | L |

## 4. Hedef tasarım

### Ayarlar ve ilk kurulum

```text
+ Ayarlar                         Proje: Ankara Ofis                  +
| Kurulum: 2/4 tamamlandı                         [Kuruluma devam et] |
| Genel | Kullanıcılar | Mesai & Tatil | Raporlar | Entegrasyonlar     |
| E-posta | Bildirimler           (mobil: Bölüm seçimi)               |
|                                                                   |
| Genel > Şirket bilgileri                                          |
| Şirket adı* [................]  Vergi no [..............]           |
| İletişim [...................]  Adres [................]            |
| Görünüm tercihleri              Çalışma saatleri: [Vardiyalara git] |
| Alan hatası / yükleniyor / erişim yok burada gösterilir             |
| Kaydedilmemiş değişiklikler                  [Vazgeç] [Kaydet]      |
+-------------------------------------------------------------------+
| Kurulum: Şirket -> Yetkili kullanıcı -> Mesai/tatil -> Bağlantı      |
| [Önceki] [Bu adımı atla: yalnız opsiyonel] [Kaydet ve devam et]      |
+-------------------------------------------------------------------+
```

1. Aktif proje, rolün izin verdiği sekmeler ve kayıt kapsamı sürekli görünür; boş projede doldurulabilir sahte form yerine yönlendirme vardır.
2. Aynı gerçek formlar kurulumda ve ayarlarda kullanılır; kurulumun bitişi başarılı, kalıcı kayda bağlıdır.
3. Taslaklar proje kimliğine bağlıdır; dirty guard, alan hataları ve kayıt çubuğu her bölümde aynı davranır.
4. Kişisel görünüm, şirket verisi ve operasyon kuralları ayrılır; desteklenmeyen ayar açık unavailable olur.

### Kullanıcılar / davet / rol ve üyelik

```text
+ Kullanıcılar       Proje: Ankara [Kapsam]              [Davet et] +
| [Ad veya e-posta ara] [Rol] [Durum: Aktif / Davet bekliyor]       |
| Ad / E-posta      Rol             Projeler           [Islemler] |
| Ayşe ...          Üye             Ankara, Bursa      [Düzenle]  |
| [Önceki] Gösterilen 25                            [Sonraki]     |
+ Kullanıcı düzenle ---------------------------------------------+
| Hesap rolü: [Üye]       Bu rol tüm üyeliklerde geçerlidir        |
| Proje erişimleri: [x] Ankara [ ] Bursa                          |
| Değişiklik: Bursa erişimi kaldırılacak                          |
| Alan/işlem hatası                           [İptal] [Kaydet]    |
+---------------------------------------------------------------+
```

1. Davet ile hesap oluşturmayı terim olarak ayır; bekleyen/süresi dolmuş/gönderilememiş durumlarını göster.
2. Mevcut üyelikler okunur; proje değiştirme ile erişim ekleme/kaldırma açık ve atomiktir.
3. Rol kapsamı ve kritik yetki düşürmenin etkisi işlemden önce görünür.
4. Proje yöneticisine yalnız gerçekten çalıştırabildiği eylemler sunulur; mobilde eylemler adlandırılmış menüdedir.

### Mesai & Tatil, Raporlar, entegrasyon ve e-posta

```text
+ Mesai & Tatil / Ankara ----------------------------------------+
| Mesai limitleri [alanlar]  Ücret çarpanları [alanlar]             |
| [Hata özeti]                                [Vazgeç] [Kaydet]   |
| Resmi tatiller [2026] [Otomatik doldur] [+ Tatil]                 |
| Tarih / Ad / Tam-yarım gün / İşlemler                            |
+ Raporlar ------------------------------------------------------+
| Kapsam: [Ankara]  Tür: [Devam]  Dönem: [Eylül 2026]              |
| Hesap kapsamı + satır önizlemesi               [Excel] [PDF]     |
| E-posta aboneliği: [Açık/Kapalı]                                 |
| Tür [SGK] Kapsam [Ankara] Alıcı [............] [Kaydet]           |
+ Entegrasyonlar ------------------------------------------------+
| Hikvision köprüsü: [Kur] -> [Anahtarı gir] -> [Cihaz ekle]        |
| Bağlantı: Bekleniyor / Son görüldü ...       [Detaylar]          |
| Pafta: Henüz kullanılamıyor                                     |
| E-posta sağlayıcısı: kullanılan servis ve gerçek durum           |
+---------------------------------------------------------------+
```

1. Mesai kaydı tek transaction; eklenen tatil görünür listede bulunur veya o yıla geçiş gösterilir.
2. Rapor önizlemesi, dosya ve abonelik aynı açık proje/tarih sözleşmesini kullanır; abonelik türü bağımsızdır.
3. Bağlı, test edildi, kaydedildi ve senkronize edildi birbirinin yerine kullanılmaz.
4. Teknik kurulum detayları kısa adımlarla ve gerektiğinde açılan detayla sunulur; çalışmayan özellikte başarı gösterilmez.

### Sistem Admin / proje / cihaz / provisioning

```text
+ Sistem Yönetimi     [Projeler] [Cihazlar]                       +
| [Proje ara] [Aktif/Pasif]                        [+ Proje]      |
| Proje / Durum / Kullanıcı sayısı / Cihaz sayısı / İşlemler       |
| Proje detayı: [Üyeleri yönet] [Pasife al] [Silme etkisini gör]    |
+ Cihazlar ------------------------------------------------------+
| [Ad / UUID ara] [Proje] [Bağlantı] [+ Kaydet] [Ağa bağla]        |
| Cihaz / UUID / Proje / Son görülme / Durum / [Düzenle]            |
+ Cihazı ağa bağla -----------------------------------------------+
| 1 Köprü hazır -> 2 Panel seç -> 3 Yapılandır -> 4 Doğrula         |
| Seçili: IP ... / UUID ...       İşlem durumu: Doğrulanıyor       |
| [Teknik detaylar]                     [İptal] [Envantere ekle]  |
+---------------------------------------------------------------+
```

1. Proje ve cihaz listeleri aranabilir/sayfalanır; özetler yüklenirken 0 göstermez.
2. Silme/taşıma, hangi kayıtların etkileneceğini ve alternatif pasife almayı gösterir.
3. Cihaz durumu zamanla yenilenir; provisioning sonucu işlemdeki panel kimliğinden ayrılmaz.
4. Kurulum sonunda envanter/proje ataması görünür tamamlanma adımıdır; yerel servis hata halinde nasıl devam edileceği bellidir.

### Denetim Kaydı

```text
+ Denetim Kaydı              Proje: [Ankara / Tümü]               +
| [Kullanıcı] [İşlem] [Hedef] [Tarih aralığı] [Metin / kimlik ara]  |
| Etkin filtreler ... [Temizle]   Saat dilimi: Türkiye             |
| Zaman / Proje / Kullanıcı / İşlem / Hedef adı / [Detayı aç]       |
| [Önceki] 25 kayıt gösteriliyor                    [Daha fazla]   |
+ Değişiklik detayı ---------------------------------------------+
| Rol değişti: Ayşe ... / Ankara    Tam kayıt kimliği [Kopyala]    |
| Alan              Önce              Sonra                     |
| Rol               Üye               Proje Yöneticisi            |
| [Ham veri]                                                     |
+---------------------------------------------------------------+
```

1. Filtre bütün kayıt kümesine uygulanır; ilk sayfa tam sonuç gibi sunulmaz.
2. Kim/ne/zaman/hangi proje soruları tek satırda cevaplanır; arama ve filtre URL'de yaşar.
3. Diff Türkçe alan adlarıyla, klavyeyle açılabilir; mobilde tek sütun.
4. Denetlenen işlem kapsamı ve varsa geçmiş kayıt eksikleri açıkça belirtilir.

### Profil

```text
+ Profilim ------------------------------------------------------+
| [Avatar] [Fotoğrafı değiştir]   Ad Soyad* [................]     |
| JPEG / PNG / WebP, en çok 2MB   E-posta: ... (değiştirilemez)     |
| Rol: Üye                       [Vazgeç] [Bilgileri kaydet]      |
| Erişimim: Ankara, Bursa                                        |
| Güvenlik: Parola [Durum / çalışan eylem]  2FA: Henüz yok         |
| [Çıkış yap]                                                    |
+---------------------------------------------------------------+
```

1. Profil kaydı ile form başlangıcı tek kaynaktan gelir; boş placeholder gerçek ad olarak kaydedilemez.
2. Fotoğraf düğmesi klavye ve ekran okuyucuyla çalışır; upload sonucu üst menüye de yansır.
3. Rol adları ortak sözlükten; proje yetkileri hesap rolüyle tutarlı gösterilir.
4. Kaydet, çıkış ve güvenlik eylemleri birbirinden ayrılır; çalışmayan parola eylemi etkin düğme görünmez.

## 5. Fazlar

Süreler doğrulama dahil yaklaşık kişi-gündür. Bu rapor **implementasyon izni veya kaynak değişikliği değildir**; aşağıdaki OWNERSHIP listeleri sonraki görevlendirme içindir. Aynı dosyayı içeren paketler eşzamanlı aynı çalışma ağacına verilmemeli; özellikle `convex/users.ts`, `convex/reports.ts`, `src/pages/Settings.tsx` ve ortak vardiya dialog'u için tek sahibi olmalı. Her paket sonunda app/Convex tip kontrolleri, `node_modules/.bin/eslint src convex` ve ilgili davranış testleri; görsel işlerde 360px/768px/masaüstü, açık/koyu tema ve yalnız klavye kabul turu gerekir. Bu salt okunur audit sırasında tsc/eslint çalıştırılmadı.

### UX-0 — Yanlış veri, kırık görev ve sahte başarı (toplam yaklaşık 6–9 kişi-gün)

| Paket / süre | Bulgular | OWNERSHIP | İş ve test edilebilir kabul |
|---|---|---|---|
| 0A Yetki ve üyelik / 1,5–2 gün — **backend** | ADM-01, ADM-02, ADM-03, ADM-04, ADM-05 (kullanıcı), ADM-08 | `src/components/admin/AdminUsersPanel.tsx`; `src/components/admin/hooks/useUserManagement.ts`; `src/components/admin/types/user-types.ts`; `src/components/admin/components/UserFormDialog.tsx`; `src/components/admin/components/UserTable.tsx`; `src/components/admin/components/DeleteUserDialog.tsx`; `src/components/auth/ProjectFilter.tsx`; `src/components/settings/SettingsSidebar.tsx`; `src/pages/Settings.tsx`; `src/pages/AuditLog.tsx` (yalnız query yetki kapısı); `src/lib/roleLabels.ts`; `convex/users.ts`; `convex/userProjects.ts`; `convex/invites.ts`; yeni `convex/adminUserManagement.test.ts` | Üç rol için sayfa/doğrudan URL matrisi; üye yetkisiz query çalıştırmaz, proje yöneticisi davet edebilir; düzenleme aktif projeye sessiz atamaz; son admin düşürülemez; ikinci işlem hatası kısmi rol bırakmaz; başarısız resend başarı göstermez; çift tıklama tek istek. Profil/admin rol tüketicileri 0D/1A'da aynı sözlüğe bağlanır. |
| 0B Gerçek ayar durumu / 1–1,5 gün — **backend** | ADM-05 (ayar), ADM-09, ADM-10, ADM-11, ADM-14, ADM-15, ADM-16 | `src/components/settings/sections/hooks/useGeneralSettings.ts`; `src/hooks/useMailSettings.ts`; `src/hooks/useNotificationSettings.ts`; `src/components/settings/sections/GeneralSettings.tsx`; `src/components/settings/sections/general/SystemSettingsForm.tsx`; `src/components/settings/sections/MailSettings.tsx`; `src/components/settings/sections/components/OvertimeSettingsForm.tsx`; `src/components/settings/sections/integrations/PaftaIntegrationCard.tsx`; `src/components/settings/sections/ReportsSettings.tsx`; `convex/settings.ts`; `convex/holidays.ts`; yeni `convex/settingsUx.test.ts` | Pafta hiçbir sahte anahtar/başarı üretmez; SMTP'nin gerçek etkisi doğru anlatılır; rapor aboneliği açık→kapalı→yeniden yükleme kapalı kalır; kaydedilmiş false korunur; geç gelen sorguda form kaydedilemez; mesai iki tabloya ya tümü ya hiç yazar; sıfır/negatif/NaN reddedilir. Parola/provider gerçek entegrasyonu burada yapılmaz. |
| 0C Proje/cihaz bütünlüğü / 1–1,5 gün — **backend** | ADM-20, ADM-23, ADM-24 | `src/components/admin/AdminProjectsPanel.tsx`; `src/components/admin/AdminDevicesPanel.tsx`; `src/components/admin/AdminDeviceDialog.tsx`; `src/lib/deviceStatus.ts`; `convex/projects.ts`; `convex/userProjects.ts` (0A sonrası); `convex/adminDevices.ts`; `convex/devices.ts` (`claimDevice` sözleşmesi); yeni `convex/adminProjectDeviceUx.test.ts` | Bağlı kayıtlı proje silinemez ve çözüm anlatılır; boş proje temiz silinir; fake timer ile cihaz 5 dakika sonra çevrimdışı; atama hatasında tekrar kayıt denemesi UUID duvarına çarpmaz. Cihaz geçmişini koruma/silme mevcut politika açıkça doğrulanır. |
| 0D Profil ve parola doğruluğu / 0,5–1 gün — **backend** (ad validasyonu) | ADM-06 (dürüst unavailable), ADM-33, ADM-34, ADM-35 | `src/pages/Profile.tsx`; `src/hooks/useProfileUtils.ts`; `src/components/profile/ProfileForm.tsx`; `src/components/profile/ProfilePhoto.tsx`; `src/components/profile/SecurityCard.tsx`; `src/components/admin/components/UserPasswordResetDialog.tsx`; `src/components/admin/components/UserTable.tsx` (0A sonrası); `src/components/layout/AppHeader.tsx`; `convex/users.ts` (`updateProfile`, 0A sonrası) | Yüklü profil ile açılınca ad dolu, boş/boşluk ad yazılamaz; fotoğraf Tab/Enter ile yüklenir, başlıkta görünür; işlevsiz parola düğmesi etkin görünmez. |
| 0E Denetim doğruluğu / 1–1,5 gün — **backend** | ADM-28, ADM-29 (tarih sınırı), ADM-30 (denetim loading) | `src/pages/AuditLog.tsx` (0A sonrası); `convex/auditLog.ts`; `convex/schema.ts` (gerekli bileşik indexler); yeni `convex/auditLogUx.test.ts` | 250+ kayıt fixture'ında eski tarihteki eşleşme bulunur; filtre sayfalama sonrası da doğru; tarihler Türkiye sınırında; seçili proje dışı kayıt/seçenek yok; ters aralık Türkçe hata; loading boş görünmez. |
| 0F Rapor verisi / 1–1,5 gün — **backend** | ADM-12, ADM-41 | `src/components/settings/sections/ReportsSettings.tsx` (0B sonrası); `convex/reports.ts`; yeni `convex/reportsUx.test.ts`; gerekiyorsa yeni `convex/lib/reportAttendance.ts` (mevcut hesap helper'larını çağıran adaptör) | Seçili proje dosya içeriğiyle aynı; server yetkisiz kapsamı reddeder; sıfır okuma çalışanı görünür; hafta tatili/resmi tatil/gelecek gün devamsız sayılmaz; istihdam başlangıç/bitiş sınırı korunur. PDKS hesap motoru worker'ıyla sözleşme eşleştirilmeden alternatif hesap yazılmaz. |

İlk uygulanacak dalga: **0A + 0B + 0D'nin profil başlangıcı düzeltmesi**, yaklaşık 2–3 kişi-gün; ardından 0C/0E/0F. Paylaşılan dosyaları ayırmadan paralel worker başlatılmamalı. Özellikle ADM-09 ve ADM-11 küçük, bağımsız acil düzeltmelerdir.

### UX-1 — Sadeleştirme, durumlar ve erişilebilirlik (toplam yaklaşık 4–6 kişi-gün)

| Paket / süre | Bulgular | OWNERSHIP | İş ve kabul |
|---|---|---|---|
| 1A Ayar kabuğu/form tutarlılığı / 1,5–2 gün | ADM-07, ADM-08 (kalan tüketiciler), ADM-13, ADM-17, ADM-18, ADM-36, ADM-37, ADM-39 | `src/pages/Settings.tsx`; `src/components/settings/SettingsSidebar.tsx`; `src/components/settings/sections/GeneralSettings.tsx`; `src/components/settings/sections/general/CompanyInfoForm.tsx`; `src/components/settings/sections/general/SystemSettingsForm.tsx`; `src/components/settings/sections/general/FormSubmitButton.tsx`; `src/components/settings/sections/NotificationSettings.tsx`; `src/components/settings/sections/MailSettings.tsx`; `src/components/settings/sections/ReportsSettings.tsx`; `src/components/settings/sections/components/OvertimeSettingsForm.tsx`; `src/components/settings/sections/components/HolidayCalendarManager.tsx`; `src/components/admin/components/UserTableHeader.tsx`; `src/components/admin/components/UserTable.tsx`; `src/components/admin/components/UserFormDialog.tsx`; `src/components/admin/AdminProjectsPanel.tsx`; `src/components/profile/ProfileForm.tsx`; `src/pages/SystemAdmin.tsx`; yeni `src/components/settings/SettingsSaveBar.tsx` | Dirty taslak sekme/proje geçişinde uyarılır; reaktif veri dirty alanı ezmez; mobil başlık taşmaz; rol/label/ikon isimleri ortak; tema renkleri token; abonelik türü indirme türünden bağımsız; farklı yılda tatil görünür. Mevcut shared bileşenler tüketilir, gereksiz yeni kopya yapılmaz. |
| 1B Listeler ve işlem durumları / 1–1,5 gün | ADM-21, ADM-27, ADM-30, ADM-37 (liste), ADM-38 | `src/components/settings/sections/AdminDashboard.tsx`; `src/components/admin/AdminProjectsPanel.tsx`; `src/components/admin/AdminDevicesPanel.tsx`; `src/components/admin/AdminDeviceDialog.tsx`; `src/components/admin/AdminUsersPanel.tsx`; `src/components/settings/sections/components/HolidayCalendarManager.tsx`; `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx`; `src/components/profile/UserProjectsCard.tsx` | URL ile admin sekmesi kalır; pasife alma ve üyeler bağlantısı; ortak onay/pending/focus; loading/empty/no-project/error ayrımı; köprü kurulumu sonraki adımı açık gösterir. |
| 1C Denetim arama ve okuma / 1–1,5 gün — **backend** (arama/filtre) | ADM-29 (arama/URL), ADM-31, ADM-37 (denetim) | `src/pages/AuditLog.tsx`; `convex/auditLog.ts`; `convex/schema.ts` (arama/index gerekiyorsa); yeni `src/components/audit/AuditChangeDetail.tsx`; yeni `src/components/audit/auditLabels.ts` | Kullanıcı/işlem/hedef araması bütün yetkili veri kümesinde; yenileme filtreyi korur; tam ID kopyalanır; klavye aç/kapat, Türkçe diff ve mobil tek sütun; ham JSON ikincil. |
| 1D Atıl vardiya sözleşmesi / 0,5 gün | ADM-40 | `src/components/settings/sections/ShiftSettings.tsx`; `src/components/settings/sections/components/AddShiftDialog.tsx`; `src/components/settings/sections/components/ShiftTable.tsx`; `src/components/settings/sections/components/shiftFormSchema.ts` | Eski tüketici yeniden bağlanacaksa başarısız mutation formu kapatmaz; form değerleri korunur. Aktif `/shifts` tüketicilerinin callback uyumluluğu vardiya worker'ı tarafından kabul edilir; atıl tüketici kaldırılacaksa bu karar açıkça belgelenir. |

### UX-2 — Yeni yetenekler ve ölçek (toplam yaklaşık 6–10 kişi-gün; dış servis işleri hariç)

| Paket / süre | Bulgular | OWNERSHIP | İş ve kabul |
|---|---|---|---|
| 2A İlk kurulum / 1–2 gün — **backend** (kalıcı ilerleme gerekiyorsa) | ADM-19 | `src/pages/Settings.tsx`; `src/components/settings/OnboardingProgress.tsx`; `src/components/settings/StepNavigation.tsx`; `src/components/settings/sections/MailSettings.tsx`; `src/components/settings/sections/NotificationSettings.tsx`; `src/components/settings/SettingsTabs.tsx`; `src/components/settings/sections/CompanySettings.tsx`; `src/components/settings/sections/WorkScheduleSettings.tsx`; yeni `src/components/settings/OnboardingChecklist.tsx`; gerekirse `convex/settings.ts` ve `convex/schema.ts` | Dört adım aynı gerçek formları kullanır; başarısız kayıtta ilerlemez; yeniden açılış kaldığı yer; opsiyonel adım atlanır; son adım bitir çalışır. Eski sahte formların üretime bağlanması yasak. |
| 2B IDE kurulum / 1,5–2 gün | ADM-25, ADM-26 | `src/components/settings/sections/AdminDashboard.tsx`; `src/components/admin/AdminDevicesPanel.tsx`; `src/components/admin/IdeProvisioningCard.tsx`; `src/components/admin/AdminDeviceDialog.tsx` | Yetkili rotadan kurulum erişilir; servis yok/timeout/kısmi hata/çok panel/yanlış IP durumları; A panelinin UUID'si B panel readback'iyle birleşmez; bağlantı doğrulanınca envanter/atamaya geçer. Yerel agent API değişikliği gerekirse `scripts/ide-provision-agent.mjs` için ayrı görevlendirme; canlı cihaz çalıştırma bu audit'in parçası değil. |
| 2C Ölçek / 1,5–2 gün — **backend** | ADM-22 | `convex/users.ts`; `convex/projects.ts`; `convex/userProjects.ts`; `convex/adminDevices.ts`; `convex/reports.ts`; `convex/holidays.ts`; `convex/schema.ts`; `src/components/admin/AdminProjectsPanel.tsx`; `src/components/admin/AdminDevicesPanel.tsx`; `src/components/admin/AdminUsersPanel.tsx`; `src/components/admin/hooks/useUserManagement.ts`; `src/components/settings/sections/AdminDashboard.tsx` | Sunucu araması + cursor pagination; kullanıcı/cihaz/proje satırları limitli; üyeler açılınca yüklenir; sayılar gerçek özetten; rapor index aralığı/batch. Büyük sentetik fixture ile okunan belge sayısı ve render maliyeti ölçülür, sonuç kaybı olmaz. |
| 2D Denetim kapsamı / 1–2 gün — **backend** | ADM-32 | `convex/lib/audit.ts`; `convex/users.ts`; `convex/userProjects.ts`; `convex/projects.ts`; `convex/settings.ts`; `convex/adminDevices.ts`; `convex/devices.ts` (ilgili yönetim mutation'ları); `convex/hikBridge.ts`; `convex/reports.ts` (zamanlama); `src/pages/AuditLog.tsx`; `src/components/audit/auditLabels.ts` | Her başarılı yönetim değişimi tek audit olayı; başarısız mutation olay üretmez; actor/proje ve önce/sonra doğru; sırlar bulunmaz. Geçmişte hiç yazılmamış olaylar geriye dönük uydurulmaz. |
| 2E Parola akışı / 1–2 gün — **backend** | ADM-06 (tam yetenek) | `src/components/profile/SecurityCard.tsx`; `src/components/admin/components/UserPasswordResetDialog.tsx`; `src/components/admin/components/UserTable.tsx`; `convex/auth.ts`; `convex/actions/sendEmail.ts`; yeni `src/components/profile/ChangePasswordDialog.tsx`; yeni reset callback sayfası ve `src/App.tsx` rotası (auth sahibiyle netleştirilecek) | Kullanılan auth sağlayıcısının desteklediği gerçek reset/change protokolü; mevcut parola/oturum koşulları, token süresi/tek kullanım, e-posta hatası ve başarı testleri. İsim/route kesinleşmesi implementasyon öncesi auth sözleşmesi incelemesine bağlı; salt davet token'ını reset olarak kullanma. |

**Kapsam dışında kalan yeni ürün işleri:** Pafta'nın gerçek API entegrasyonu, özel SMTP gönderici altyapısı ve uygulama çapında İngilizce yerelleştirme bu faz sürelerine dahil değildir. ADM-09/10/36'nın ilk kabulü mevcut ürünün doğru yetenek durumunu göstermesidir; dış servis sözleşmesi olmadan gerçek entegrasyon tamamlandı sayılmaz.

### Bağımlılıklar ve doğrulanamayan noktalar

- 0A → 0C/0D ortak kullanıcı dosyaları; 0B → 0F ortak Raporlar; 0A → 0E → 1C ortak Denetim. UX-1 aynı formları değiştirdiğinden UX-0 tamamlanmadan o dosyalara başlanmamalı.
- ADM-41, PDKS hesap motoru ve vardiya/tatil sözleşmesiyle birlikte doğrulanmalı; `/pdks-records` audit'i bu raporda tekrarlanmadı. ADM-40 ortak dialog'u nedeniyle vardiya modülü sahibiyle paylaşılır; ADM-35 kabuk sahibiyle paylaşılır.
- Tarayıcıda profil ilk-render tekrarı, breakpoint taşma ölçümü, açık/koyu kontrast, ekran okuyucu duyuruları, gerçek ağ gecikmesi, SMTP/Resend gönderimi, yerel köprü ve fiziksel IDE cihaz davranışı **(doğrulanmadı)**. Bunlar statik kanıtı olmayan “çalışıyor/bozuk” iddialarına dönüştürülmedi.
- Proje silme sonrasında gerçek mevcut tenant verisinin etkisi ve atıl bileşenlerin tarihsel kullanımı **(doğrulanmadı)**; rapor yalnız mevcut kaynak akışını esas alır.

## 6. Modüller arası adaylar

- **Yetenek matrisi:** rol + aktif proje → izinli query/sekme/eylem; `AccessDenied` ve sorgu `skip` davranışı aynı sözleşmede. Menü gizlemek veri sorgusunu korumaz.
- **Form yaşam döngüsü:** initial/pristine/dirty/pending/error; proje değişimi, reaktif sorgu ve kaydetmeden çıkış için ortak desen; `FormFieldWrapper` ve sonner.
- **Liste durumları:** undefined/empty/filtered-empty/no-project/error ayrımı; `EmptyState`, `ErrorState`, `StatCard`; görünür sayının toplam sanılmaması.
- **Atomik yönetim işlemleri:** rol+üyelik, mesai+oran, cihaz kayıt+atama tek kullanıcı işi olarak tek sonuç verir; kısmi başarı açıkça modellenir.
- **Kimlik ve durum sözlükleri:** `roleLabels`, marka etiketleri, denetim alanları ve semantik status tokenları; gerçek query tipini örten yerel cast kopyaları kaldırılır.
- **Audit diff + ortak onay:** kaynak adı, proje ve etki özeti; sırların maskelenmesi; klavyeyle açılan detay; pending ve focus dönüşü.
- **Zaman ve rapor kapsamı:** Türkiye gün sınırları, aktif proje ve rapor döneminin tek sözleşmesi; tüm raporların aynı PDKS hesap sonuçlarını tüketmesi.

