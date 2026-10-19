# 13 · Ayarlar

## Özet

Ayarlar, yetkili yöneticilerin seçili projenin şirket bilgilerini, mesai politikasını, tatillerini ve entegrasyonlarını yönetmesini; kullanıcı daveti ve rapor işlemlerine ulaşmasını sağlar. En büyük üç sorun bölüm/proje geçişinde taslak kaybı, mobilde formun önüne geçen uzun ikinci menü ve proje ayarı ile kişisel/sistem kapsamının birbirine karışmasıdır. Öneri A2 ortak kabuğu altında tek bölüm navigasyonu, açık kapsam etiketleri, bölüm başına tutarlı kayıt ve ortak kaydedilmemiş değişiklik koruması kullanır.

## Kaynak ve sınır

17.10.2026 çalışma ağacındaki güncel dosyalar, commit edilmemiş Dalga 3a değişiklikleri dahil incelendi. `13-ayarlar.png`, `13-ayarlar-2.png`, `13-ayarlar-mobil.png`, `13-ayarlar-mobil-2.png` açıldı; ekranlar Genel bölümünü gösteriyor, diğer bölümler kaynak üzerinden değerlendirildi. Mobil görseller 780 fiziksel piksel genişliğinde; 390 CSS piksel davranışı yeni mockup'ta ayrıca kontrol edildi, mevcut uygulamanın canlı ölçümü yapılmadı.

Zorunlu kaynaklar: `DESIGN_DIRECTION.md`, A2 `home.html` ve `people.html`, `01-ana-sayfa/REPORT.md` Kabuk bölümü, `09-vardiyalar/REPORT.md`, `docs/ux-audit/04_AYARLAR_ADMIN.md` özellikle §5 UX-1. Kaynak kod, DB, canlı servis ve diğer sayfa klasörleri değiştirilmedi. Renk/ölçü ve kabuk CSS'si A2 ile 01 mockup'ından korundu; ek CSS yalnız ayar yerleşimi ve form davranışıdır.

### Önceki audit'te kapananlar — yeniden açılmadı

| Önceki bulgu | Güncel kanıt ve korunacak düzeltme |
|---|---|
| ADM-01 | `Settings.tsx:69`, `capabilities.ts:8`: üye tüm ayar sekmelerinde AccessDenied; proje yöneticisinde mail yok. `AdminUsersPanel.tsx:27` expired sorgusunu süper admin için çalıştırıyor. |
| ADM-02/03/04 | `useUserManagement.ts:18`, `:27` üyelikleri yükler, rol+üyeliği aynı endpoint'e yollar; resend sonuç kontrolü `AdminUsersPanel.tsx:30`. Bu rapor eski yanlış proje ataması/sahte resend iddiasını tekrar etmez. |
| ADM-05/15/16 | `useGeneralSettings.ts:15`, `:33`; `useNotificationSettings.ts:22`; `GeneralSettings.tsx:42`: gerçek pending, yüklenmeden kayıt engeli, nullable alan temizleme; `SystemSettingsForm.tsx:127` kayıtlı false'u korur. |
| ADM-09/10 | `PaftaIntegrationCard.tsx:14` geliştiriliyor ve sahte bağlantı yok; `MailSettings.tsx:3` gerçek Resend açıklaması, etkisiz SMTP formu yok. |
| ADM-11/12/14 | `ReportsSettings.tsx:55`, `:127`, `:359`: açık proje kapsamı ve kapalı aboneliği kaydetme mevcut; `OvertimeSettingsForm.tsx:49`, `convex/settings.ts:253` tek atomik mesai kaydı ve sayısal doğrulama. Rapor hesap motorunun eski hataları yeniden varsayılmadı. |
| ADM-27/30/38'in bir kısmı | `HolidayCalendarManager.tsx:181`, `:255`, `:278`: yükleme/boş/projesiz/hata ve ortak silme onayı; `BridgeIntegrationCard.tsx:184` iptal onayı artık var. |
| ADM-33/34/35/06 | `ProfileForm.tsx:25` draft+güncel ad; alan hatası ve gerçek pending; `SecurityCard.tsx:22` parola unavailable. Fotoğraf ve kabuk düzeltmelerini yeniden iş listesine almadık. |

## Mevcut durum taraması

Aşağıdaki kısa yollar: `S/` = `src/components/settings/`, `P/` = `src/pages/`, `A/` = `src/components/admin/`. Her kanıt güncel çalışma ağacına aittir; etki önceliği görsel veya görev etkisidir, canlı hata ölçümü değildir.

| ID | Kategori | Bulgu ve kanıt | Etki | Öneri |
|---|---|---|---|---|
| SET-UI-01 | Form-diyalog | Sekme değişimi doğrudan URL'yi değiştirir; proje değişimi içerik key'ini değiştirerek formu unmount eder. Dirty kontrol yok: `P/Settings.tsx:55`, `:124`; mevcut `src/components/shared/UnsavedChangesDialog.tsx:32` tüketilmiyor. | Yüksek | Bölüm, proje, breadcrumb, rota ve tarayıcı çıkışını aynı guard'a bağla; hedef işlemi onaydan önce uygulama. |
| SET-UI-02 | Responsive / yerleşim | İkinci sidebar mobilde tam genişlikte 7 satır+başlık olarak formun üstüne geliyor: `S/SettingsSidebar.tsx:61`, `:69`; mobil ilk ekranın çoğu menü. Global sidebar taşması ayrıca SHELL-UI-01 kapsamındadır. | Yüksek | Desktop 184px sade bölüm listesi; 760px altında etiketli native bölüm select'i. Global kabuğu 01 paketi çözer. |
| SET-UI-03 | Görsel hiyerarşi | Ayarlar başlığı menü içindeki h2, Genel içerik şirket kartından başlıyor; Mesai ayrıca h1 açıyor: `P/Settings.tsx:91`, `S/SettingsSidebar.tsx:65`, `S/sections/WorkAndPayrollSettings.tsx:8`. | Orta | Gövdede tek h1 Ayarlar, proje/kapsam satırı; bölüm h2. Breadcrumb ortak üst çubukta. |
| SET-UI-04 | Erişilebilirlik | Seçili bölüm yalnız CSS rengiyle belirtilmiş; nav adı ve aria-current yok: `S/SettingsSidebar.tsx:69`, `:76`. | Orta | `nav aria-label="Ayar bölümleri"`; URL linkleri + `aria-current="page"`; seçim sonrası bölüm başlığına odak. |
| SET-UI-05 | Bileşen tutarlılığı / AI arayüzü izi | Menünün kartı, şirket/sistem kartları, ikonlu başlıklar ve gölgeler; kaydet ve seçimlerde emoji: `S/SettingsSidebar.tsx:61`, `S/sections/general/CompanyInfoForm.tsx:16`, `:104`, `FormSubmitButton.tsx:16`. Ekranların tamamında tekrar ediyor. | Orta | Kart yerine tipografi ve 1px ayırıcı; sistem fontu; tek SVG gerektiğinde; emoji kaldır. |
| SET-UI-06 | Form-diyalog | Genel altta sağda büyük Kaydet, bildirim solda kart içinde Kaydet, mesai farklı yoğunlukta; pristine halde de etkin: `FormSubmitButton.tsx:9`, `NotificationSettings.tsx:93`, `components/OvertimeSettingsForm.tsx:78` (üçü de S/sections altında). | Orta | Ortak SettingsSaveBar: durum, Vazgeç, bölüme özgü Kaydet; yalnız dirty ve validken etkin; pending/hata aynı yerde. |
| SET-UI-07 | Form-diyalog | Bildirim query'si her değiştiğinde bütün taslağı setFormData ile değiştirir: `S/sections/NotificationSettings.tsx:23`. Mesai ise alan bazlı draft tutarak bunu zaten engelliyor (`components/OvertimeSettingsForm.tsx:34`). | Yüksek | Tüm formlarda başlangıç snapshot'ı + dirty alanlar; reaktif yeni veri dirty alanı ezmesin; pristine güncellenebilir. |
| SET-UI-08 | Mikro-metin / kapsam | Dil, saat dilimi, tarih formatı Genel'de etkin seçenekler, fakat aktif UI tüketicileri görünmüyor; PDKS İstanbul sözleşmesini kullanıyor: `S/sections/general/SystemSettingsForm.tsx:28`, `:41`, `:58`; `ReportsSettings.tsx:22`; kaynak aramasında alanlar ayar yazımı/şema ile sınırlı. | Yüksek | Türkçe ve İstanbul işlem zamanını salt açıklama olarak göster; işlevsiz seçenek sunma. Yerelleştirme ürün işi; saklı değerleri silme/değiştirme. |
| SET-UI-09 | Form-diyalog / kapsam | Tema anahtarı kaydetmeden DOM'u değiştiriyor, kayıt payload'ı proje generalSettings.darkMode'a yazıyor: `GeneralSettings.tsx:25`, `:38`; `hooks/useDarkMode.ts:6`; `convex/settings.ts:55`. | Yüksek | Tema kişisel tercih olarak Profil'e taşınmalı; geçiş kararı/API tüketicileri tamamlanmadan proje alanını sessiz kişisel alan gibi sunma. |
| SET-UI-10 | Mikro-metin / veri anlamı | Genel çalışma saatleri generalSettings alanlarına yazılıyor; Mesai açıklaması saatlerin vardiyada olduğunu söylüyor. İki farklı model aynı iş gibi görünüyor: `GeneralSettings.tsx:26`, `SystemSettingsForm.tsx:75`, `WorkAndPayrollSettings.tsx:10`; `convex/settings.ts:202`. | Yüksek | Genel'de etkin olmayan saat düzenleyicisini kaldır, mevcut veriyi koru; tanım ve atamalar Vardiyalar'da, genel politika burada. 09 raporuyla aynı sahiplik. |
| SET-UI-11 | Erişilebilirlik / form | Currency/language/timezone/dateFormat label hedefleri SelectTrigger id'sine bağlanmıyor; bitiş saatinin kendi etiketi yok: `CompanyInfoForm.tsx:96`, `:100`; `SystemSettingsForm.tsx:28`, `:30`, `:85`. | Orta | Her kontrolün görünür etiketi/id'si; açıklama+hata aria-describedby; saatleri ayrı başlangıç/bitiş etiketle. |
| SET-UI-12 | Form-diyalog | İndirme tipi ile abonelik tipi aynı reportType state'ini kullanıyor; kayıtlı abonelik ilk açılışta indirme seçimini de değiştiriyor: `S/sections/ReportsSettings.tsx:61`, `:113`, `:127`, `:336`. | Yüksek | İndirme ve kişisel hatırlatma ayrı form/state; abonelik türünü ayrı select, kapsamı açık ve bağımsız göster. |
| SET-UI-13 | Mikro-metin / kapsam | Bildirimlerin yalnız başlıkları var; genel notificationsEnabled ile özel systemNotifications iki ayrı proje alanı: `GeneralSettings.tsx:28`, `NotificationSettings.tsx:56`, `convex/settings.ts:154`. | Orta | Bildirim bölümüne proje kapsamı ve “tercih kaydı gönderim testi değildir” açıklaması; iki sistem anahtarını backend tüketimi doğrulanmadan birleştirme. |
| SET-UI-14 | Responsive / mikro-metin | Kullanıcı başlığı kırılmayan yatay flex, arama w-80; “Yeni Kullanıcı” gerçekte davet gönderir, arama yalnız e-posta eşleştirir: `A/components/UserTableHeader.tsx:19`, `:32`, `:43`; `A/AdminUsersPanel.tsx:52`. | Yüksek | Sarılan başlık, tam genişlik arama, “E-posta ara”, “Kullanıcı davet et”; proje yöneticisinde davet odaklı metin. |
| SET-UI-15 | Mikro-metin / kapsam | Kullanıcı listesi aktif projectId almaz; ana kabukta proje seçiliyken “seçili proje kullanıcıları” sanılabilir: `A/hooks/useUserManagement.ts:16`. Backend yetki kapsamı korunarak tüm erişilebilir kullanıcılar gelir. | Yüksek | Kullanıcılar bölümünde “Yetkiniz kapsamındaki kullanıcılar”; davet formunda hedef proje ayrıca açık. Kişileri kullanıcı hesabıyla karıştırma. |
| SET-UI-16 | Form-diyalog / durumlar | Farklı yılda tatil eklenince filtre yılı değişmez, eklenen kayıt görünmez: `S/sections/components/HolidayCalendarManager.tsx:49`, `:74`. Form hatası exception/toast; alan altı bağ yok (`:69`). | Orta | Başarıda eklenen tarihin yılına geç ve satırı odakla; alan altında hata, ilk hataya odak. |
| SET-UI-17 | Responsive | Tatil başlığı+Yıl+Otomatik Doldur kırılmayan satır, tablo silme hedefi 24px: `S/sections/components/HolidayCalendarManager.tsx:102`, `:239`. | Orta | Sarılan araç çubuğu, mobil tek sütun form; 36px adlandırılmış işlem menüsü; gün bilgisini tarih altına taşı. |
| SET-UI-18 | Görsel hiyerarşi / mikro-metin | Hikvision'da gradyan ikon kutusu, teknik açıklama ve ham kurulum adresi aynı ağırlıkta; readonly token alanı etiketsiz: `S/sections/integrations/BridgeIntegrationCard.tsx:79`, `:124`, `:177`. | Orta | Nötr entegrasyon satırı; “Kurulum ayrıntıları” dialog'unda 3 adım, etiketli maskeli anahtar, gerçek lastSeenAt; bağlantı kanıtı olmayan başarı rozeti yok. |
| SET-UI-19 | Mikro-metin / AI arayüzü izi | Pafta dürüst unavailable olsa da “Bağlı değil” + iki disabled işlem kullanıcı çözebilecekmiş izlenimi verir; Yakında üst başlığı ve dört ürün etiketi dikkat çeker: `PaftaIntegrationCard.tsx:11`, `:23`; `IntegrationsSettings.tsx:28`. | Düşük | Pafta nötr “Geliştiriliyor” etiketi + aktarım yok açıklaması; sahte CTA ve vaat listesi kaldırılır. |
| SET-UI-20 | Durumlar: hata | Kullanıcı/tatil bölümlerinde bölüm boundary var; Genel/Bildirim/Bridge query'leri doğrudan ana içerikte, hata tüm Outlet'e çıkabilir: `P/Settings.tsx:71`; `S/sections/hooks/useGeneralSettings.ts:9`; `src/hooks/useNotificationSettings.ts:16`; `BridgeIntegrationCard.tsx:29`. | Orta | Query tüketen alt bileşen çevresinde bölüm hata sınırı; navigasyon ve diğer bölümlere erişim kalır, gerçek retry. |

## Yeni tasarım

### Kabuk ve bilgi mimarisi

01 Kabuk sözleşmesi aynen geçerli: 216px bordo sidebar, 64px üst çubuk, 32px içerik kenarı, 13 menünün yetkili alt kümesi ve Ayarlar aktif; 390px'te 248px modal ana menü. Üstte proje seçici, Ana Sayfa / Ayarlar breadcrumb, komut paleti ve hesap menüsü; gövdede tek h1. Bu sayfa ortak kabuğu yeniden tasarlamaz.

1. **PageHeader:** Ayarlar; seçili proje ve bölüm kapsamı. Sağda mutasyon yok; ihtiyaç olmayan KPI, toplam bölüm sayısı ve kurulum yüzdesi eklenmez.
2. **Bölüm navigasyonu:** desktop 184px çizgisiz dikey liste, içerikle 48px boşluk; Genel, Kullanıcılar ve davetler, Mesai ve tatil, Raporlar, Entegrasyonlar, E-posta gönderimi (süper admin), Bildirimler. Mobilde “Ayar bölümü” etiketli select, aynı sıra ve izinler; ayrı yatay Tabs yok.
3. **İçerik:** h2 + kapsam açıklaması, max 800px form; iki sütun yalnız ilişkili kısa alanlar; 1px ayırıcıyla alt gruplar. Bölümler URL `?tab=` sözleşmesini korur. Geçersiz tab Genel'e normalize, yetkisiz geçerli tab AccessDenied olur; kullanıcının yetkisi genişletilmez.
4. **Kayıt alanı:** her kalıcı formun sonunda ortak SaveBar. “Kaydedilmemiş değişiklikler”, ikincil “Vazgeç”, birincil “Genel ayarları kaydet” gibi açık etiket; pristine'de kapalı. Mobilde sarılır, alt yapışkan çubuk kullanılıyorsa safe-area/padding ile son alanı örtmez; bu mockup normal belge akışındadır.
5. **Profil bağlantısı:** ad/fotoğraf/güvenlik için kısa “Profilimi aç”; Profil tüm rollere açık, Ayarlar'ın alt sekmesi değildir. Proje değiştirmek kimlik bilgisini değiştirmez.

### Yetki ve kapsam matrisi

| İş | Üye | Proje yöneticisi | Süper admin |
|---|---|---|---|
| /settings + doğrudan tab | AccessDenied, ayar query'si çalışmaz | Genel/davet/mesai/rapor/entegrasyon/bildirim | Aynısı + e-posta |
| Kullanıcı daveti | Yok | Yetkili proje; mevcut rol seçenekleri korunur | Yetkili proje; süper admin davet edilmez |
| Rol/üyelik/silme | Yok | Yok | Mevcut atomik endpoint ve son/kendi admin korumaları korunur |
| /system-admin | Yok | Yok | Ortak kabuktan erişilir; ayar sekmesi olarak kopyalanmaz |
| /profile | Kendi profili | Kendi profili | Kendi profili |

Şirket/mesai/tatil/entegrasyon/bildirim ayarları seçili projeye aittir. Kullanıcı listesi aktif proje filtresi olmayan mevcut yetki kapsamını açık yazar. Rapor indirmede aktif proje veya tüm erişilebilir projeler mevcut sözleşmedir; hatırlatma oturumdaki kullanıcı+kapsama aittir (`convex/reports.ts:395`), proje genelindeki herkese gönderim sayılmaz. Mail görünümü bilgi ekranıdır, proje seçimi Resend sağlayıcısını değiştirmez. `userPreferences` kullanıcı+key string deposudur (`convex/userPreferences.ts:4`); bugün tema/bildirim API'si olarak kullanılmıyor, yalnız PDKS saved views tüketimi var.

### Bölüm formları ve eylemler

| Bölüm | Alan sırası ve gruplama | Kayıt modeli |
|---|---|---|
| Genel | Şirket adı* + vergi no; adres tam satır; e-posta + telefon; web sitesi + para birimi. Sonra salt açıklama: işlem zamanı İstanbul, arayüz Türkçe; Vardiyalar ve Profil bağlantısı. | Mevcut upsertGeneral; boş isteğe bağlı alan null, şirket adı trim ve zorunlu. İşlevsiz dil/tarih/saat ve tema kontrolleri kaldırılırken saklı alanlar payload'a yazılmaz; veriler silinmez. |
| Kullanıcılar ve davetler | E-posta arama → kullanıcı listesi → ayrı süresi dolmuş davet listesi (yalnız süper admin). Davet dialog: e-posta* → hesap rolü* → hedef proje* → kapsam özeti. Düzenle dialog: e-posta salt okunur → global rol → mevcut proje üyelikleri çoklu → ekleme/çıkarma özeti. | Davet “Davet gönder”, düzenle “Değişiklikleri kaydet”; gerçek success kontrolü ve pending. Silme ayrı ConfirmDestructive; mevcut korumalar gevşetilmez. |
| Mesai ve tatil | Mesai: yıllık sınır, başlangıç toleransı, aylık saat tabanı; çarpanlar hafta içi/hafta tatili/resmi tatil/gece; gece başlangıç/bitiş. Sonra ayrı tatil listesi: yıl, resmi tatilleri yükle, tatil ekle dialog. | Mesai saveOvertime tek transaction. Tatil Ekle/Sil/Yükle bağımsız işlemlerdir; mesai Kaydet tatilleri kaydetmez. Tatil ekle: tarih* → ad* → yarım gün; başarıda tarih yılı görünür. |
| Raporlar | İndirme: kapsam → tür → yıl/ay; fazla mesaide aylık/yıllık; maliyette “Ücret bilgisi olmayanlar için saatlik ücret (₺)”. Query güvenilirlik notları ve kayıt sayısı korunur. Ayrı kişisel hatırlatma: açık/kapalı → kapsam → abonelik türü → alıcı. | Excel indir birincil, PDF yalnız SGK'da; e-posta hatırlatması ayrı Kaydet. Dosya eki vaat edilmez: her ayın ilk günü hatırlatma, dosya bu ekrandan indirilir. Kapatınca Kaydet görünür kalır. |
| Entegrasyonlar | Hikvision: açıklama + anahtar kaydı durumu + son bağlantı zamanı varsa; Kurulum ayrıntıları. Pafta: “Geliştiriliyor”, veri aktarımı yok. | Anahtar üret/iptal hemen çalışan ayrı işlemler; genel Kaydet yok. Token kopyalama yalnız clipboard promise success'inden sonra bildirilir. Son görülme güncel online göstergesi sayılmaz. |
| E-posta gönderimi | Resend kullanıldığı, yapılandırmanın sunucuda olduğu, özel SMTP'nin bağlı olmadığı bilgisi. | Form/Kaydet/Test yok; yalnız süper admin. Yeni SMTP altyapısı bu tasarıma dahil değil. |
| Bildirimler | Proje kapsamı; e-posta, geç kalma, rapor, sistem tercihleri ve her birinin kısa açıklaması. Genel notificationsEnabled ayrı legacy kayıt olarak salt bilgilendirmede gösterilebilir. | Mevcut upsertNotification; true/false korunur; genel notificationsEnabled ile otomatik senkron yapılmaz. Kaydet teslimat testi/garantisi değildir. |

**Vardiya sahipliği:** 09 raporuna göre tanım CRUD'u Vardiyalar Sheet'inde kalır; Ayarlar'da yalnız bağlantı. `SettingsTabs.tsx` → `ShiftSettings` eski zinciri aktif Settings rotasınca kullanılmıyor; iki aktif vardiya ekranı iddia edilmez. `AddShiftDialog` / schema aktif Vardiyalar tarafından paylaşıldığından körlemesine silinmez. Tolerans devralma ve gece vardiyası kuralları 09 sözleşmesinden gelir.

**Onboarding:** bu ekrana zorunlu wizard veya kurulum yüzdesi eklenmez. `OnboardingProgress` ve `StepNavigation` aktif tüketiciye bağlı değil; şirket/adım kaydı kurulum tamamlandığının kanıtı değildir. İlk kurulum ihtiyacı doğrulanırsa gerçek şirket kaydı, cihaz ve köprü koşullarından türeyen isteğe bağlı checklist ayrı UX-2 işi; mevcut atıl CompanySettings/WorkScheduleSettings sahte formları bağlanmaz.

### Taslak ve doğrulama sözleşmesi

- İlk query gelmeden input/kayıt yok; null sonuç “Henüz şirket bilgisi kaydedilmemiş” olarak yeni kayıt formunu açar. `undefined` loading ile null/boş ayrılır.
- Dirty başlangıç değerlerine göre hesaplanır, kullanıcı alanı ilk değerine geri getirirse pristine olur. Reaktif veri dirty alanı ezmez; daha yeni uzak sürüm varsa “Bu bölüm başka bir oturumda değişti” bilgisi, incelemeden otomatik kayıt yok.
- Bölüm/proje/rota değişimi **önce** shared `useUnsavedChangesGuard.requestClose` üzerinden geçer. Üst çubuk proje değişikliği provider state yazmadan önce merkezi guard'a danışmalıdır; child unmount sonrası uyarı geç kalır. Browser Back için router blocker, refresh/sekme kapama için beforeunload gerekir; mevcut hook tek başına router/proje değişimini izlemez.
- Mevcut `UnsavedChangesDialog` iki eylemi korunur: “Vazgeç” formda kalır, “Çık” taslağı bırakıp bekleyen hedefi uygular; bağlam açıklaması bölüm adını içerebilir. Kaydet ve çık eklenirse yeni async sözleşme gerekir; bu ilk tasarımda yok. Pending sırasında tekrarlı gönderme ve kapsam geçişi kapalıdır.
- Alan altında hata ve `aria-invalid`/`aria-describedby`; form başında sunucu hatası, değerler korunur; ilk hataya odak. Örnekler: “Şirket adı boş bırakılamaz”, “Geçerli bir e-posta adresi girin”, “Negatif olamaz”, “Saat tabanı sıfırdan büyük olmalıdır”, “Çarpan en az 1 olmalıdır”, “Geçerli bir saat girin”, “Tatil adı zorunlu”.
- Tema kişisel tercihe taşınmadan önce kaynak/öncelik/migrasyon kararı gerekir; mockup tema toggle'ı veya yeni kişisel alan üretmez. Yeni başarı timestamp'ı icat edilmez; varsa generalSettings.updatedAt kullanılabilir, mockup böyle bir metrik göstermez.

### Listeler, filtreler ve 390px

| Liste | Kolon sırası / genişlik önceliği | Mobil davranış |
|---|---|---|
| Kullanıcı | E-posta esnek %60, rol %30, işlemler 44px | E-posta sarılır, rol e-posta altına; yetkisiz işlem kolonu hiç yok. Proje üyeliklerini liste verisinde yokken uydurma. |
| Süresi dolmuş davet | E-posta esnek, son tarih 120px, yeniden gönder 140px | Dikey 2 satır; buton e-posta altında; gerçek expiresAt. |
| Tatil | Tarih 120px, ad esnek, tip 90px, işlemler 44px | Tarih altında gün; ad ve tip birlikte, silme 36px; günün ayrı kolonu yok. |
| Köprü anahtarları | Maskeli anahtar esnek, son bağlantı 160px, işlemler 108px | Etiketli satırlar, maskeli anahtar taşmaz; göster/kopyala/iptal alt satıra. |

Tablo satırı 42px, başlık 36px; uzun e-posta/ad sarılınca yükseklik büyür. Formlarda 390px tek sütun, 16px sayfa kenarı; input/select width 100%, alan grid min-width 0. Dialog max genişliği 560px, mobil 16px kenar ve max-height ile içerik içten dikey kayar; eylemler sarılır. Filtre yalnız listelerde e-posta/yıl ve rapor kapsam/dönemdir; Ayarlar'a genel arama veya BulkBar eklenmez. Rozetler rol için nötr, Pafta için nötr Geliştiriliyor, köprü için nötr Henüz bağlanmadı; son bağlantı varsa tarih metni, sahte Bağlı rozeti yok. Tatil tipi tam/yarım gün nötr etiket; güvenilir uyarı/hata semantik token kullanır.

### Durum metinleri

| Durum | Türkçe metin ve eylem |
|---|---|
| Bölüm yükleniyor | “Genel ayarlar yükleniyor” / bölüm ismi; role=status, aria-busy; form varsayılanıyla yanlış kayıt yok. |
| Query hatası | “Bu bölüm yüklenemedi” / “Diğer ayar bölümlerine geçebilir veya tekrar deneyebilirsiniz.” / Tekrar dene. |
| Kayıt hatası | “Değişiklikler kaydedilemedi. Bilgilerinizi koruduk; yeniden deneyin.”; gerçek hata gerekçesi kısa alan/sunucu mesajıyla. |
| Proje yok | Süper admin: “Henüz aktif proje yok” + Admin sayfasını aç; diğer yönetici: “Proje ataması bekleniyor” + Profilimi aç. |
| Proje seçilmemiş | “Bir proje seçin” / “Bu bölüm için üst çubuktan bir proje seçin.” |
| Yetkisiz | “Bu ayar bölümünü görüntüleme yetkiniz yok” + Profilimi aç; üye için ayar navigasyonu render edilmez. |
| Yeni Genel kayıt | “Henüz şirket bilgisi kaydedilmemiş” / “Bu proje için şirket bilgilerini girin.”; boş şirket adı, örnekler placeholder. |
| Tatil yok | “2026 yılı için tanımlı tatil yok” / “Bir tatil ekleyin veya resmi tatilleri yükleyin.” |
| Kullanıcı araması boş | “Bu e-postayla eşleşen kullanıcı yok” / “Aramayı değiştirin veya temizleyin.” |
| Rapor boş | “Seçilen dönem için kayıt bulunamadı” / “Dönemi ve proje kapsamını kontrol edin.”; indir kapalı. |
| Köprü yok | “Henüz köprü anahtarı oluşturulmadı” / “Windows köprüsünü kurmak için anahtar oluşturun.” |
| Pending / başarı | “Kaydediliyor…”; yalnız gerçek mutation başarısında “Genel ayarlar kaydedildi”. Offline mockup bunun yerine “Önizleme: değişiklikler yalnız bu dosyada uygulandı; sunucuya kaydedilmedi” der. |

## Bileşen eşlemesi ve uygulama sınırı

| Ortak bileşen | Değişecek kaynak / kullanım |
|---|---|
| PageHeader | `Settings.tsx`; tek h1, kapsam. `WorkAndPayrollSettings.tsx` iç h1 kaldırılır. |
| SettingsSectionNav | `SettingsSidebar.tsx`; aynı dosya sade liste/mobil select; aktif `SettingsTabs` yeniden devreye sokulmaz. |
| FormFieldWrapper + SettingsSaveBar | General/CompanyInfo/SystemSettings/Notification/Overtime/Reports; FormSubmitButton ortak barı tüketir veya son tüketici kontrolüyle kalkar. RHF alan isimleri schema bağları korunur. |
| UnsavedChangesDialog + mevcut guard | Settings ve form dirty callback'leri; ortak proje/rota navigasyon köprüsü foundation sahibiyle tek paket. Yeni kopya confirm component yazılmaz. |
| DataTable / StatusBadge / FilterBar | UserTable/Header, HolidayCalendarManager ve BridgeIntegrationCard; e-posta/yıl filtresi, 42px satır. StatInline ve BulkBar gerekmiyor. |
| Dialog / Sheet | Davet/düzenle, tatil ekle, köprü kurulum ayrıntısı; ConfirmDestructive mevcut silme/iptal davranışı korunur. |
| EmptyState / SectionSkeleton / ErrorState | Genel, mesai, rapor, bildirim, entegrasyonların query tüketen bölüm sınırı. AdminDataBoundary'deki desen yeniden kullanılır. |
| Profil | Profile.tsx/ProfileForm: kişisel kimlik ve erişim ayrı rota, ortak Form/SaveBar/guard; görünümde ağır kartlar sadeleşir. Tema tercihi ancak ürün kararı ve tüketici entegrasyonundan sonra. |
| Emekliye ayrılabilecek atıl dosyalar | SettingsTabs, OnboardingProgress, StepNavigation, CompanySettings, WorkScheduleSettings, ShiftSettings/ShiftTable: repo genelinde tüketici doğrulaması sonrası kaldırma; aktif AddShiftDialog/schema korunur. |

## Backend gereksinimi

Temel A2 görsel geçiş, bölüm navigasyonu, yerel dirty koruması, iki rapor state'inin ayrılması, mevcut anahtar/tatil işlemleri için yeni tablo/alan gerekmiyor. Mevcut gerçek alanlar: generalSettings şirket/iletişim/currency; workSettings üç politika alanı; overtimeRates çarpan/gece alanları; holidays tarih/ad/isHalfDay; hikBridges token/lastSeenAt/lastClientInfo; notificationSettings dört boolean; reports schedule reportType/email/enabled/projectId. Yeni online durumu, kurulum yüzdesi, gönderilmiş rapor sayısı veya kullanıcı-proje kolonları uydurulmadı.

1. Tema kişiselleştirilecekse mevcut `userPreferences` deposuna typed bir key ve validasyon, tema başlangıç tüketicisi, kullanıcı tercihi → eski proje default'u önceliği ve üyelerin erişimi tasarlanmalı. Mevcut generalSettings.darkMode alanını yalnız UI taşıyarak değiştirmek yeterli değil; migrasyon/geriye uyum ayrı iştir.
2. Dil/tarih formatını gerçekten işletmek ayrı uygulama çapı yerelleştirme işidir; İstanbul PDKS gün sınırları görüntü tercihiyle değiştirilmez. Bu teslim etkin olmayan seçenekleri göstermeyerek bu işi bloklayıcı yapmaz.
3. Bildirim anahtarlarının hangi gerçek gönderenlerce tüketildiği ürün/backend incelemesiyle kesinleşmeli; iki alanı tekleştirme ve gönderim iddiası bu tasarımda yok. Yeni kanal/test e-postası endpoint'i önerilmedi.
4. Aynı ayarın eşzamanlı düzenlenmesinde kesin çatışma önleme istenirse expectedUpdatedAt/version kontrolü gerekir; UI dirty koruması tek başına sunucu last-write-wins davranışını değiştirmez.

## Açık sorular (4)

1. Tema kişisel tercih olarak Profil'e taşınsın mı? Öneri evet; mevcut proje default'u geriye uyumlu devralınsın, bu karara kadar mockup'taki gibi yeni toggle açılmasın.
2. Genel sistem bildirimleri alanıyla özel bildirim sistemNotifications alanının amaçları farklı mı? Öneri tüketici haritası çıkarılana kadar mevcut kayıtları birleştirmeyin; etkisi doğrulanmayan teslimat vaadi vermeyin.
3. Günlük rapor indirme Ayarlar içinde kalmalı mı? Öneri ilk fazda URL/yer korunur; daha sonra ayrı Raporlar rotası ürün kararı olarak ele alınır.
4. İlk kurulum rehberi gerekli mi? Öneri sık kullanılan Ayarlar'da zorunlu wizard yok; kullanım araştırması doğrularsa gerçek veriye dayalı isteğe bağlı checklist UX-2'ye alınır.

## Uygulama tahmini

**L · 28–40 saat:** bölüm kabuğu ve mobil davranış 4–6; formlar/SaveBar/dirty navigasyon 10–14; rapor state ayrımı ve entegrasyon/tatil/kullanıcı yüzeyleri 8–12; üç rol, proje geçişi, hata/pending ve klavye doğrulaması 6–8. Ortak global kabuk 01 paketinde; tema migrasyonu, yerelleştirme ve yeni bildirim servisleri bu tahmine dahil değil. Riskler provider proje değişimi ile form unmount sırası, kullanıcı listesinin proje filtresi sanılması, reaktif query'nin taslağı ezmesi ve atıl vardiya dosyaları silinirken aktif ortak dialog'un etkilenmesidir.

## Teslim ve doğrulama

`mockup.html` ağ bağımsız tek dosya; Genel ana görünümü, yedi bölüm, üç rol ve durum seçicisi; gerçek olmayan kayıt açıkça önizleme olarak etiketlidir. Etkileşim önceliği: alan düzenleme → başka bölüm/proje → shared dialog davranışı ve Hikvision kurulum ayrıntısı; ek olarak tatil/davet form örnekleri bulunur. `VERIFY.json` ve tarayıcı görselleri bu klasördeki kontrol kanıtıdır; gerçek Convex yazımı, gönderim, clipboard veya cihaz bağlantısı denenmedi.

- Yerel kurulu Playwright + Chrome, **file://** üzerinden kullanıldı; yeni paket kurulmadı. Aynı proje taramalarındaki doğrudan Node API yaklaşımı kullanıldı; CLI'nin file protokolü kısıtı aşılmış oldu.
- **7 bölüm × 2 genişlik + 3 rol × 5 durum × 2 genişlik = 44 kontrol**: 1440/390px belge genişliği viewport'u aşmıyor; konsol/pageerror **0**, dış HTTP isteği **0**.
- Bölüm/proje değişiminde taslak uyarısı, Vazgeç ile değer ve eski projenin korunması, Çık ile hedefe geçiş, şirket adı doğrulaması, yalnız önizleme kayıt metni, bağımsız rapor tipleri, anahtar gösterme/iptal onayı, mobil menü Escape ve dönüş odağı, Türkçe Ctrl+K araması kontrol edildi.
- Python HTMLParser: etiketler dengeli, **111 benzersiz id**, tekrar eden id yok. `desktop.png`, `mobile.png`, `mobile-unsaved.png`, `bridge.png`, `mobile-bridge.png` görsel olarak incelendi.
- Mockup gerçek sunucu pending/çatışma denetimi, Back yönlendirme engeli ve davet/tatil dialog'larının dirty kapanma korumasını uygulamaz; bunlar yukarıdaki Faz C sözleşmesidir. Tatil/davet örnekleri doğrulama sonucunu gösterir, listeye sahte sunucu kaydı eklemez; token kopyalama da açıkça simülasyondur.
- Kaynak kod değişmediği için uygulama tsc/eslint çalıştırılmadı. Gerçek ekran okuyucu turu, auth, ağ hatası ve Convex entegrasyon testleri uygulama fazına aittir.
