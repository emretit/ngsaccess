# W2 — Cihazlar, Ayarlar, Admin input border audit

Tarih: 27 Ekim 2026. Salt okunur kaynak kod incelemesi; uygulamada ekran görüntüsü veya etkileşim testi yapılmadı. Altı dizinde testler hariç **118 TypeScript dosyası** tarandı (devices 48, settings 34, admin 22, sync 1, live-monitoring 9, profile 4); **46 dosyada** input benzeri kontrol veya arama wrapper'ı bulundu. **35 bulgu: Y=3, O=32, D=0**.

En sık kök sebep, hata metni/ARIA üreten formların input üzerinde hata border'ı tanımlamaması ve native select'lerin ortak focus stilini atlamasıdır. Ring kırpılması için iki FormDialog tüketicisi ve yatay boşluksuz iki başka ata zinciri bulundu; shared wrapper çözümünün ayrıntıları W1 kapsamındadır.

Sayım birimi tablo satırıdır; aynı dosyanın farklı kategorileri ayrı sayılır, aynı formun tekrarlayan alanları birleştirilir. Y: sık kullanılan akışta ring kırpılması; O: ekrana/koşula bağlı tutarsızlık; D: yalnız kozmetik. A bulguları belirtilen DOM/class zincirinden doğrulanmıştır; tarayıcıdaki piksel görünümü ayrıca doğrulanmadı.

## Bulgular

Aşağıdaki göreli yollar `src/components/` altındadır; `src/pages/` ve primitive kanıtları açık tam proje yolu ile yazılmıştır.

| # | Önem | Kat. | file:line | Öğe | Kanıt (class / ata container file:line) | Ekran (kullanıcının gördüğü yer) | Öneri (tek satır) |
|---|---|---|---|---|---|---|---|
| 1 | Y | A | devices/AssignLocationForm.tsx:153 | Bölge ve kapı SelectTrigger (:184) | FormDialog :116 içinde; iç grid :140 yalnız `py-4`, yatay boşluk yok; görevde doğrulanan FormDialog.tsx:91 scroll gövdesi | Cihaz → Konum Ata | W1 FormDialog gövdesine ring payı eklesin. |
| 2 | Y | A | admin/projects/ProjectEditor.tsx:94 | Proje adı Input, açıklama Textarea (:104) | FormDialog :69 içinde, alanlarda yatay ring payı yok; FormDialog.tsx:91 ortak neden | Admin → Projeler → Ekle/Düzenle | W1 FormDialog düzeltmesini bu forma da uygulasın. |
| 3 | Y | A | admin/AdminUsersPanel.tsx:162 | Kullanıcı araması ve rol/proje filtreleri | `src/pages/Settings.tsx:58` → `overflow-x-auto`, px yok → AdminUsersPanel :144 `space-y-5` → FilterBar :162; arama `src/components/shared/FilterBar.tsx:29–34` yatay boşluksuz | Ayarlar → Kullanıcılar ve davetler | Ayarlar users sarmalayıcısında ring için yatay iç boşluk bırakın. |
| 4 | O | A | live-monitoring/AssignReadingCardForm.tsx:40 | Kişi combobox tetikleyicisi | ReadingDetailPanel.tsx:36 scroll gövdesi `overflow-y-auto pt-5`, px yok → Detail :24 `space-y-5` → form :37 → MonitoringPersonPicker.tsx:25 `w-full` combobox; portal arama alanı bu scroll atasının dışında | Canlı İzleme → Okuma ayrıntısı → Kartı kişiye ata | Scroll içeriğine ring payı sağlayın. |
| 5 | O | D | settings/SettingsSidebar.tsx:25 | Mobil ayar bölümü select | Ham select: `h-9 ... border border-input bg-background px-3`; ortak focus ring sınıfları yok | Dar ekran Ayarlar menüsü | Ortak select stilini kullanın. |
| 6 | O | D | settings/sections/general/CompanyInfoForm.tsx:20 | Para birimi | Ham select `border-input bg-background`; Input kardeşleri :17 | Ayarlar → Genel | Native select'e ortak border/focus stilini verin. |
| 7 | O | D | settings/sections/MailSettings.tsx:96 | SMTP portu | Ham select; selectStyle :22 `h-9 ... border-input bg-background`, focus sınıfı yok | Ayarlar → E-posta gönderimi | Port seçimini ortak select görünümüne taşıyın. |
| 8 | O | D | settings/sections/ReportsSettings.tsx:141 | Kapsam, tür, yıl, dönem select'leri (:146/:152/:157) | Ham select'ler; selectStyle :39 `h-9 ... border-input bg-background`, focus sınıfı yok | Ayarlar → Rapor indir | Dört seçiciyi aynı border/focus sözleşmesine bağlayın. |
| 9 | O | D | settings/sections/reports/ReportReminderSettings.tsx:49 | Hatırlatma kapsamı ve türü (:65) | Ham select; selectStyle :22 `border-input bg-background`, focus sınıfı yok | Ayarlar → Kişisel e-posta hatırlatması | Ortak select görünümünü kullanın. |
| 10 | O | D | settings/sections/privacy/RetentionAssistantCard.tsx:54 | Saklama seçimi | Ham select `border border-control bg-background`; yanındaki Input :59 primitive kullanıyor | Ayarlar → Gizlilik → Saklama süresi | Border token'ını ve focus stilini ortaklaştırın. |
| 11 | O | D | admin/components/UserFormDialog.tsx:153 | Rol ve davet projesi (:264) | Ham select'ler `h-9 ... rounded-md border bg-background px-3`; ortak focus sınıfı yok | Admin/Ayarlar → Kullanıcı davet et/düzenle | İki seçiciyi ortak select görünümüne taşıyın. |
| 12 | O | D | admin/projects/ProjectEditor.tsx:117 | Proje durumu | Ham select :119 `h-9 ... border bg-background px-3`; Input ve Textarea kardeşleri | Admin → Proje düzenle | Durum seçimini ortak select görünümüne taşıyın. |
| 13 | O | D | admin/components/AdminListParts.tsx:22 | AdminSelect filtreleri | :27 `border-input bg-background ... focus-visible:outline-primary`; standart ring yerine outline kullanıyor; tüketiciler AdminUsersPanel.tsx:170/:190, AdminDevicesPanel.tsx:164/:184, projects/AdminProjectsContent.tsx:79 | Admin kullanıcı/cihaz/proje listesi filtreleri | Ortak border ve focus stilini tek AdminSelect üzerinde uygulayın. |
| 14 | O | D | admin/ProjectMembersContent.tsx:22 | Üyenin proje rolü | Ham select `h-9 rounded-md border bg-background px-3 text-sm` | Proje kullanıcıları rol seçimi | Ortak select görünümünü kullanın. |
| 15 | O | D | sync/SyncIssuesBanner.tsx:102 | Uyarı kapatma gerekçesi | Ham textarea :103 `rounded-md border bg-background p-2`; focus ring sınıfı yok | Senkron uyarısı → Gerekçeyle kapat | Textarea primitive kullanın. |
| 16 | O | D | sync/SyncIssuesBanner.tsx:165 | Proje kapsamı | Ham select `rounded border bg-background p-1`; diğer h-9 kontrollerden farklı padding/radius/focus | Senkron uyarıları üst çubuğu | Ortak select görünümünü kullanın. |
| 17 | O | E | devices/ClaimDeviceDialog.tsx:351 | Yeni bölge adı | Wrapper error :339–347 boş adda hata üretiyor; `...control` :352 sonrası `aria-invalid` :353–358 yalnız cihaz adıyla eşitliği ölçüyor; boş bölge ve dolu cihaz adında false ile eziliyor | Cihazlar → Havuzdan ata → Yeni bölge | `control` hata bilgisini ezmeyin, iki doğrulamayı birleştirin. |
| 18 | O | E | devices/form-sections/DeviceLocationSection.tsx:185 | Yeni bölge adı dialog'u | :69–81 doğrulama yalnız `notify.error`; Input :185–197 üzerinde `aria-invalid` veya hata border'ı yok | Cihaz ekle → Yeni bölge oluştur | Alan hatasını input'a ARIA ve border ile bağlayın. |
| 19 | O | E | devices/VirtualReaderDialog.tsx:91 | Sanal okuyucu adı | `aria-invalid={nameMissing}` :98 ve hata metni :101 var; Input'ta hata border sınıfı yok | Cihaz → Sanal okuyucu ekle | Geçersiz ad için hata border'ı uygulayın. |
| 20 | O | E | devices/DeviceForm.tsx:196 | Cihaz formu doğrulanan alanları | FormControl + FormMessage :194–202, açıklama :269; alt bölümler DeviceBasicSection.tsx:72/:88, DeviceNameSection.tsx:20, DeviceNetworkSection.tsx:29/:43/:56, DeviceZoneSection.tsx:89, DeviceIdeSmartSection.tsx:47/:67/:84/:103/:129/:146, DeviceHikvisionSection.tsx:68/:92/:105, DeviceHikModelField.tsx:99, DeviceHikLocalBridgeSection.tsx:42/:62/:76; alanlarda hata border'ı yok | Cihaz ekle/düzenle, Admin cihaz kimliği formu | FormControl ARIA bilgisini alan border görünümüne bağlayın; shared ayrıntısı W1. |
| 21 | O | E | admin/AdminDeviceDialog.tsx:260 | Cihaz kimliği | Wrapper error :258 ve açık aria-invalid :262 var; Input'ta hata border sınıfı yok | Admin → Cihaz ekle | Kimlik hatasında border'ı da değiştirin. |
| 22 | O | E | admin/components/UserFormDialog.tsx:137 | Davet e-postası ve zorunlu proje (:264) | Hata metni :131–135/:258–262; Input/select üzerinde hata border sınıfı yok | Admin/Ayarlar → Kullanıcı davet et | Wrapper'ın ARIA bilgisini alan border'ına yansıtın. |
| 23 | O | E | admin/projects/ProjectEditor.tsx:94 | Proje adı | Wrapper :92 `error={nameError}`; Input :94–98 hata border'ı tanımlamıyor | Admin → Proje ekle/düzenle | Ad hatasını border ile görünür kılın. |
| 24 | O | E | profile/ProfileForm.tsx:74 | Ad Soyad | Wrapper :73 `error={nameError}`; Input :74–82 hata border sınıfı yok | Profil → Hesap bilgileri | Geçersiz ad için hata border'ı ekleyin. |
| 25 | O | E | settings/sections/general/CompanyInfoForm.tsx:17 | Şirket bilgileri | Wrapper :15 `error={errors[key]}`, Input/Textarea :16–17 ve para birimi :19–20 hata border'ı almıyor | Ayarlar → Genel | Hatalı şirket alanlarını ortak hata border'ı ile gösterin. |
| 26 | O | E | settings/sections/MailSettings.tsx:93 | SMTP sunucu/kullanıcı/şifre/gönderen e-postası | Wrapper error :92/:101/:107/:115; Input :93/:102/:109/:117 hata border'ı tanımlamıyor | Ayarlar → E-posta gönderimi | Doğrulama hatalarını input border'ına yansıtın. |
| 27 | O | E | settings/sections/ReportsSettings.tsx:160 | Saatlik ücret | Wrapper :159 `error={hourlyRateError}`; Input :160 hata border'ı yok | Ayarlar → Raporlar → Departman raporu | Hatalı ücreti border ile işaretleyin. |
| 28 | O | E | settings/sections/reports/ReportReminderSettings.tsx:70 | Hatırlatma e-postası | Wrapper :69 `error={error}`; Input :70 hata border'ı yok | Ayarlar → Kişisel e-posta hatırlatması | E-posta hatasını border'a yansıtın. |
| 29 | O | E | settings/sections/privacy/RetentionAssistantCard.tsx:59 | Saklama gün sayısı | Wrapper :58 şema hatası gösteriyor; Input :59 hata border'ı yok | Ayarlar → Gizlilik → Saklama süresi | Geçersiz gün sayısını border ile işaretleyin. |
| 30 | O | E | settings/sections/privacy/VisitorNoticeCard.tsx:47 | KVKK bağlantı ve sürümü | Wrapper :46 şema hatası gösteriyor; Input :47 hata border'ı yok | Ayarlar → Gizlilik → Ziyaretçi aydınlatma metni | Hatalı alanın border'ını değiştirin. |
| 31 | O | E | settings/sections/privacy/BiometricModuleCard.tsx:64 | Biyometri gerekçesi | Wrapper :63 uzunluk hatası; Textarea :64 hata border'ı yok | Ayarlar → Gizlilik → Biyometri modülünü aç/kapat | Gerekçe hatasını textarea border'ına yansıtın. |
| 32 | O | E | settings/sections/privacy/BiometricDestructionCard.tsx:49 | İmha gerekçesi ve proje adı (:52) | Wrapper error :48/:51; Textarea/Input :49/:52 hata border'ı yok | Ayarlar → Gizlilik → Biyometrik veri imhası | İki alanda da hata border'ını uygulayın. |
| 33 | O | E | settings/sections/components/HolidayCalendarManager.tsx:118 | Tatil adı | Wrapper :118 `error={errors.name}`; Input hata border'ı yok; tarih :117 DateInput bağımlılığı W1 | Ayarlar → Raporlar → Tatil ekle | Tatil adının border'ını hata durumuna bağlayın. |
| 34 | O | E | settings/sections/components/OvertimeSettingsForm.tsx:117 | Mesai sayı/saat alanları ve seçimler | Wrapper error :94/:105/:116/:119/:131; Input :117/:132 hata border'ı yok; SelectTrigger :98/:109/:123 üzerinde control ARIA prop'ları yok (wrapper'ın doğrudan çocuğu Select kökü) | Ayarlar → Raporlar → Fazla mesai | SelectTrigger'a render-slot control prop'larını iletin ve tüm alanlarda hata border'ı uygulayın. |
| 35 | O | E | settings/sections/components/pdksRulesPunchFields.tsx:24 | Geçerlilik tarihi ve tekrar okutma aralığı (:59) | Şema pdksRulesModel.ts:29–41 alan hatası üretiyor; PdksRulesSettings.tsx:187–192 yalnız genel error'a yazıyor, :224–227 alert; DateInput/Input üzerinde aria-invalid veya hata border'ı yok | Ayarlar → Raporlar → PDKS devam kuralları | Şema hatasını ilgili tarih/sayı alanına ARIA ve border ile bağlayın. |

## Ortak kök sebepler

- **FormDialog**: `devices/AssignLocationForm.tsx` ve `admin/projects/ProjectEditor.tsx`. Tüketici bağlantısı doğrulandı; görevde belirtilen FormDialog.tsx:91 sebebine dayanır. Wrapper ayrıntılı analizi ve çözüm tasarımı W1'e bırakıldı.
- **Hata görünümü sözleşmesi**: Input primitive (`src/components/ui/input.tsx:11`) hata ARIA'sına bağlı border stili içermiyor. FormFieldWrapper kontrolün ARIA bilgisini sağlıyor, FormControl da ARIA sağlıyor; bu yüzden bunları genel olarak “aria-invalid yok” diye işaretlemedim. Etkilenenler #19–33 ve #34 sayı/saat alanları; cihaz formunun alt bölüm listesi #20'de. W1 ortak çözümü çok sayıda tüketiciyi tek seferde iyileştirebilir; #17/#18/#34 SelectTrigger/#35 için ayrıca tüketici bağlantısı düzeltmesi gerekiyor.
- **Native select tekrarları**: #5–14 ve #16. `admin/components/AdminListParts.tsx` tek noktadan üç admin listesini etkiliyor; ayar sayfalarında aynı selectStyle metni MailSettings, ReportsSettings ve ReportReminderSettings içinde ayrı ayrı kopyalanmış.
- **Yerel scroll container'ları**: #3 `src/pages/Settings.tsx:58`, #4 `live-monitoring/ReadingDetailPanel.tsx:36`. Dizin dışındaki Settings yalnız izin verilen AdminUsersPanel atasını doğrulamak için okundu; değişiklik yapılmadı.

## Taramada elenen durumlar ve sınırlar

- ClaimDeviceDialog ScrollArea :160 içindeki :161 `p-6`; AdminDeviceDialog :249 `p-6`; DeviceDetailsPanel :184/:206/:240 `px-5`; pdksRulesCheckpointFields :54 `p-3` ring için yatay pay bırakıyor. Bunlara yalnız overflow bulunduğu için A yazılmadı.
- UserFormDialog :104 ve BiometricModuleCard :57 overflow kullansa da DialogContent varsayılan `p-6` alıyor (`src/components/ui/dialog.tsx:39`); A değil.
- SyncIssuesBanner :177 scroll listesi içindeki textarea, satırın :77 `px-4` payı sayesinde yatay kenara dayanmıyor; yalnız D bulgusu.
- DeviceApiTokenCard :74 ve BridgeIntegrationCard :51 token Input + düğmeler, IdeProvisioningCard :254 arama/Input + düğme, AccountAccessActions :52 tarih+saat grubu aralarında gap bırakıyor. Kaynakta çift border/radius çakışması kanıtlanmadığından F yazılmadı; responsive piksel görünümü doğrulanmadı.
- DeviceFilters ve üç admin listesi FilterBar kullanıyor; PasswordField kullanan cihaz alt bölümleri ortak wrapper'a bağlı. Shared arama/şifre gruplarının ayrıntıları W1 kapsamı; bağımsız C/F kusuru uydurulmadı.
- MonitoringPersonPicker CommandInput :25 portal PopoverContent içinde; Command primitive'in kendi border/ring davranışı B/W1 kapsamı. Okuma ayrıntısındaki combobox tetikleyicisi ayrı olarak #4'te ele alındı.
- ProfilePhoto :78 gizli file input ve RolesSettings :39, BiometricDestructionCard :101, AssignReadingCardForm :43 checkbox'ları D kapsamından çıkarıldı.
- `src/` veya `convex/` altında değişiklik yapılmadı; kod düzeltmesi/test çalıştırma/install/deploy yapılmadı. Primitive/shared dosyaları yalnız tüketici kanıtını ayırmak için kısa okunmuştur; B kategorisi açılmadı.

## Input envanteri

Aşağıdaki envanter taramada bulunan bütün kontrol çağrı noktalarını listeler; bulgu olmayan kontroller de kapsama dahildir. Satırlar inceleme anındaki çalışma ağacına aittir.

- `src/components/devices/AssignLocationForm.tsx` — SelectTrigger:153, SelectTrigger:184
- `src/components/devices/ClaimDeviceDialog.tsx` — SelectTrigger:193, SelectTrigger:221, Input:269, Input:284, PasswordField:297, SelectTrigger:319, Input:351, Input:372
- `src/components/devices/DeviceApiTokenCard.tsx` — Input:74
- `src/components/devices/DeviceFilters.tsx` — FilterBar:28, SelectTrigger:32, SelectTrigger:41
- `src/components/devices/DeviceForm.tsx` — Input:196, Textarea:269
- `src/components/devices/VirtualReaderDialog.tsx` — Input:91
- `src/components/devices/form-sections/DeviceBasicSection.tsx` — SelectTrigger:38, Input:72, Input:88
- `src/components/devices/form-sections/DeviceHikLocalBridgeSection.tsx` — Input:42, Input:62, PasswordField:76
- `src/components/devices/form-sections/DeviceHikModelField.tsx` — SelectTrigger:66, Input:99
- `src/components/devices/form-sections/DeviceHikvisionSection.tsx` — SelectTrigger:44, Input:68, Input:92, PasswordField:105
- `src/components/devices/form-sections/DeviceIdeSmartSection.tsx` — Input:47, Input:67, PasswordField:84, Input:103, Input:129, Input:146
- `src/components/devices/form-sections/DeviceLocationSection.tsx` — SelectTrigger:137, Input:185, SelectTrigger:235
- `src/components/devices/form-sections/DeviceNameSection.tsx` — Input:20
- `src/components/devices/form-sections/DeviceNetworkSection.tsx` — Input:29, Input:43, PasswordField:56
- `src/components/devices/form-sections/DeviceStatusSection.tsx` — SelectTrigger:21
- `src/components/devices/form-sections/DeviceZoneSection.tsx` — SelectTrigger:59, Input:89
- `src/components/settings/SettingsSidebar.tsx` — select:25
- `src/components/settings/sections/MailSettings.tsx` — Input:93, select:96, Input:102, Input:109, Input:113, Input:117, Input:172
- `src/components/settings/sections/ReportsSettings.tsx` — select:141, select:146, select:152, MonthPicker:154, select:157, Input:160
- `src/components/settings/sections/RolesSettings.tsx` — input:39
- `src/components/settings/sections/components/HolidayCalendarManager.tsx` — Input:85, DateInput:117, Input:118
- `src/components/settings/sections/components/OvertimeSettingsForm.tsx` — SelectTrigger:98, SelectTrigger:109, Input:117, SelectTrigger:123, Input:132
- `src/components/settings/sections/components/pdksRulesChoice.tsx` — SelectTrigger:27
- `src/components/settings/sections/components/pdksRulesPunchFields.tsx` — DateInput:24, Input:59
- `src/components/settings/sections/general/CompanyInfoForm.tsx` — Textarea:16, Input:17, select:20
- `src/components/settings/sections/integrations/BridgeIntegrationCard.tsx` — Input:51
- `src/components/settings/sections/privacy/BiometricDestructionCard.tsx` — Textarea:49, Input:52, input:101
- `src/components/settings/sections/privacy/BiometricModuleCard.tsx` — Textarea:64
- `src/components/settings/sections/privacy/RetentionAssistantCard.tsx` — select:54, Input:59
- `src/components/settings/sections/privacy/VisitorNoticeCard.tsx` — Input:47
- `src/components/settings/sections/reports/ReportReminderSettings.tsx` — select:49, select:65, Input:70
- `src/components/admin/AdminDeviceDialog.tsx` — Input:260, Input:304, SelectTrigger:320
- `src/components/admin/AdminDevicesPanel.tsx` — FilterBar:156
- `src/components/admin/AdminUsersPanel.tsx` — FilterBar:162
- `src/components/admin/IdeProvisioningCard.tsx` — Input:255, Input:313, Input:328
- `src/components/admin/ProjectMembersContent.tsx` — select:22
- `src/components/admin/components/AccountAccessActions.tsx` — DateInput:52, Input:52
- `src/components/admin/components/AdminListParts.tsx` — select:22
- `src/components/admin/components/UserFormDialog.tsx` — Input:137, select:153, Input:194, select:264
- `src/components/admin/projects/AdminProjectsContent.tsx` — FilterBar:71
- `src/components/admin/projects/ProjectEditor.tsx` — Input:94, Textarea:104, select:117
- `src/components/sync/SyncIssuesBanner.tsx` — textarea:102, select:165
- `src/components/live-monitoring/AssignReadingCardForm.tsx` — input:43
- `src/components/live-monitoring/MonitoringPersonPicker.tsx` — CommandInput:25
- `src/components/profile/ProfileForm.tsx` — Input:61, Input:74, Input:87
- `src/components/profile/ProfilePhoto.tsx` — input:78
