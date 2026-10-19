# C2c W-13-ui — Ayarlar A2 teslimi

## Sonuç ve sınır

`src/pages/Settings.tsx:23` A2 kabuğu: tek PageHeader/h1, proje ve bölüm kapsamı, 184px masaüstü bölüm listesi, 760px altında etiketli native select, 48px sütun aralığı, max 800px içerik. `?tab=` geçersiz değeri Genel'e normalize eder; geçerli fakat yetkisiz bölüm AccessDenied olur; capabilities genişletilmedi. Her bölüm QuerySectionBoundary altında; Raporlar ve Entegrasyonlar ayrıca bağımsız alt sınırlar içerir.

Yalnız Settings ve settings bileşenleri değiştirildi. Backend, DB, commit/push/deploy/migration yapılmadı. `ActiveProjectContext` guard API'sini koordinatör ekledi; bu worker dosyayı değiştirmedi. AdminUsersPanel yalnız tüketildi.

## Bölüm → bileşen haritası

| Bölüm | Kaynak ve davranış |
|---|---|
| Genel | `sections/GeneralSettings.tsx:9` → `general/CompanyInfoForm.tsx:6`, `SystemSettingsForm.tsx:6`; alan altı hata, nullable temizleme, görünmeyen alanları atlayan `generalForm.ts:10`, tema önizlemesi ve proje varsayılanı |
| Kullanıcılar ve davetler | `src/pages/Settings.tsx:66` → mevcut AdminUsersPanel; kapsam “Yetkiniz kapsamındaki kullanıcılar”; panel değiştirilmedi |
| Mesai ve tatil | `WorkAndPayrollSettings.tsx:5` → `components/OvertimeSettingsForm.tsx:30` + `HolidayCalendarManager.tsx:32`; vardiya için yalnız bağlantı |
| Raporlar | `ReportsSettings.tsx:219` → ayrı ReportDownloadSettings ve `reports/ReportReminderSettings.tsx:23`; indirme/hatırlatma türü ve kapsamı birbirinden bağımsız |
| Entegrasyonlar | `IntegrationsSettings.tsx:4` → BridgeIntegrationCard + PaftaIntegrationCard; Pafta geliştiriliyor, aktarım iddiası yok |
| E-posta gönderimi | `MailSettings.tsx:1`; yalnız süper admin, gerçek Resend açıklaması, SMTP/test/kaydet formu yok |
| Bildirimler | `NotificationSettings.tsx:9`; dört ayrı boolean, mevcut false korunur, genel notificationsEnabled ile birleştirilmedi |

Tablodaki kısaltılmış kaynaklar `src/components/settings/sections/` altındadır.

## Taslak ve kayıt sözleşmesi

- `SettingsFormState.tsx:7` her formun dirty/pending durumunu Settings'e bildirir; unmount'ta kaydı kaldırır. Genel, Bildirimler, Mesai, Hatırlatma, tatil dialogu ve anlık işlem pending durumları kapsanır.
- `SettingsFormState.tsx:18` ilk düzenlemede başlangıç snapshot'ını tutar; uzak query değişimi taslağı ezmez. İlk değere dönüş pristine olur. Uzak değer farklıysa “Bu bölüm başka bir oturumda değişti” mesajı gösterilir; Vazgeç son uzak değeri yükler.
- `Settings.tsx:53`: bölüm hedefi yalnız useUnsavedChangesGuard.requestClose onayından sonra URL'ye yazılır; pending'de bölüm seçimi kilitlidir.
- `Settings.tsx:42`: koordinatörün useProjectChangeGuard API'si provider yazımından önce değişimi durdurur; Vazgeç eski proje/taslağı korur, Çık proceed ile yeni projeyi uygular. Pending'de proje geçişi onaysız engellenir. Layout'un mevcut proje key'i yeni kapsamı yeniden kurar.
- `SettingsSaveBar.tsx:4`: pristine'de render edilmez, dirty/valid olduğunda bölüme özgü Kaydet, Vazgeç ve pending metni. Ortak SaveBar özel etiket/valid API'si sunmadığından koordinatörün onayıyla yalnız settings altında yerel uyarlama kullanıldı; shared değiştirilmedi.
- Mevcut mutation argümanları korunur; kayıtlar useAsyncAction/notify üzerinden, yıkıcı işlemler mevcut ConfirmDestructive'ın async guard'ı üzerinden yürür. Başarısızlıkta değerler korunur ve form başında hata görünür. Hatırlatma kapatılırken e-posta zorunlu değildir ve Kaydet görünür kalır.
- Tatil dialogu tarih* → ad* → yarım gün; gerçek tarih doğrulaması, ilk hataya odak, başarıda tarihin yılına geçiş/satır odağı. Silme ConfirmDestructive; listede 42px satır, yıl filtresi ve sarılan araç çubuğu.
- Bridge üret/iptal ayrı işlemler, anahtar başlangıçta maskeli, kurulum ayrıntıları dialogda; clipboard başarısı beklenir. Son görülme çevrimiçi göstergesi olarak sunulmaz.

## Kaldırılan kontroller ve grep kanıtı

`rg -n 'systemLanguage|dateFormat|timezone|workingHoursStart|workingHoursEnd|darkMode' src convex` çıktısı `c2c-13-ui-settings-consumers.txt` dosyasında. `systemLanguage`, kayıtlı `dateFormat`, `timezone`, generalSettings çalışma saatlerinin okuma/tüketimi yok; eşleşmeler settings tip/upsert/schema ile sınırlı. `RecentReadingsTable` içindeki yerel dateFormat değişkeni ve gateway timezone argümanı generalSettings okumaz. Bu kontroller kaldırıldı, saklı alanlar `generalPayload` içinde hiç gönderilmez. Tema gerçek tüketicilere sahip: `src/hooks/useDarkMode.ts:11`, `convex/settings.ts:249`; tema taşınmadı ve yeni kişiselleştirme eklenmedi.

Silme öncesi grep çıktısı `c2c-13-ui-unused-evidence.txt` içinde: `rg -n 'SettingsTabs|OnboardingProgress|StepNavigation|CompanySettings|WorkScheduleSettings|AdminDashboard|FormSubmitButton' src`. Repo kaynak taraması da yalnız bu tanımları ve aşağıdaki mevcut tüketiciyi buldu; docs/.claude atıfları çalışır tüketici sayılmadı.

| Silinen dosya | Silme öncesi tüketici kanıtı |
|---|---|
| `settings/SettingsTabs.tsx` | yalnız kendi interface:9 ve export:14 |
| `settings/OnboardingProgress.tsx` | yalnız kendi interface:12 ve export:17 |
| `settings/StepNavigation.tsx` | yalnız kendi interface:5 ve export:12 |
| `settings/sections/CompanySettings.tsx` | yalnız kendi export:8 |
| `settings/sections/WorkScheduleSettings.tsx` | yalnız kendi export:7 |
| `settings/sections/general/FormSubmitButton.tsx` | yeni SaveBar son tüketiciyi kaldırdı; yalnız kendi tanımı ve general/index.ts barrel export'u kalmıştı; export da kaldırıldı |

`AdminDashboard` **korundu**: `src/pages/SystemAdmin.tsx:7,46` import/render tüketicisi mevcut. Aktif AddShiftDialog/schema ve diğer vardiya dosyaları değiştirilmedi. Son `rg` taramasında kaldırılan altı ismin src/convex/scripts içinde eşleşmesi yok.

## Değişen ve yeni dosyalar

- Değişen: `src/pages/Settings.tsx`; `settings/SettingsSidebar.tsx`; sections altında GeneralSettings, NotificationSettings, ReportsSettings, WorkAndPayrollSettings, IntegrationsSettings, MailSettings; components altında OvertimeSettingsForm/HolidayCalendarManager; general altında CompanyInfoForm/SystemSettingsForm/index.ts; hooks/useGeneralSettings.ts; integrations altında BridgeIntegrationCard/PaftaIntegrationCard.
- Yeni: `settings/SettingsFormState.tsx`, `SettingsSaveBar.tsx`, `settings.test.tsx`, `sections/general/generalForm.ts`, `sections/reports/ReportReminderSettings.tsx`, `reportTypes.ts`.
- Silinen altı dosya yukarıdaki tabloda. Tüm kısaltılmış settings yolları `src/components/` altında.

## Kapılar — eşzamanlı çalışma ağacı

- İlk app tsc ve Convex tsc: 0 hata; son Convex tsc: 0 hata.
- Son app tsc: **yalnız diğer worker'ın** `src/components/admin/AdminUsersPanel.tsx:41,49` users/loading TS2339 (kullanıcı hook'u/paneli eşzamanlı değişirken). Ayarlar dosyalarında hata yok. Koordinatöre düzeltme mesajıyla bildirildi.
- `eslint src/components/settings src/pages/Settings.tsx`: 0 hata, 0 uyarı. Son genel eslint: diğer worker'ın `admin/components/AdminListParts.tsx:23-24` ref erişimi + `admin/hooks/useAdminFormGuard.tsx:17` context mutasyonu nedeniyle 5 hata/1 uyarı. Daha önceki audit lint hatası son koşuda artık yok.
- `npx vitest run`: **99 dosya / 1008 test geçti**; settings.test.tsx içinde **9 yeni test**: reaktif snapshot/geri alma/false, gizli alanların payload'dan çıkarılması, takvim doğrulaması, rol görünürlüğü, kayıt etkinliği, bağımsız rapor türleri ve yetkisiz query engeli.
- `npx vite build`: başarılı; mevcut >500kB excel/pdf chunk uyarısı var. `git diff --check`: temiz.
- Son kapı çıktıları `/tmp/c2c-13-final-{app,convex,lint,tests,build}.log` dosyalarında; diğer worker değişiklikleri sürdüğünden koordinatör ortak kapıları tekrar koşmalı.

## Gerçek oturumda koordinatör kontrolü

Her **7 bölüm × 1440/390**: tek h1/kapsam, desktop 184px liste, mobil Ayar bölümü select, içerik max800, klavye odağı, Türkçe loading/null/empty/error/AccessDenied durumları; uzun proje/şirket/e-posta/tatil adıyla belge taşması kontrol edilmeli. min-w-0, w-full, sarılan eylemler ve yerel tablo taşma kabı uygulanmıştır; gerçek auth oturumunda ölçüm yapılmadı.

1. Genel, Bildirimler, Mesai ve Hatırlatma: düzenle → bölüm değiştir → Vazgeç/Çık; aynı akışı üst proje seçiciyle tekrarla. Vazgeç eski proje/değerleri, Çık yeni kapsamı korumalı; pending'de değişim olmamalı. Alanı eski haline getirince SaveBar kaybolmalı.
2. Reaktif uzak kayıt değiştirirken yerel taslak korunmalı; bildirimi gör, Vazgeç ile son uzak kaydı yükle. Mutation hatası, tekrar deneme ve hızlı çift tıklama.
3. Genel: boş şirket/yanlış e-posta, optional alan temizleme, kayıtlı false, tema önizlemesi ve Vazgeç/Çık sonrası tema geri dönüşü. Dil/tarih/saatin saklı verisine yazım yapılmamalı.
4. Raporlar: indirme türü/kapsamını değiştirirken hatırlatma sabit kalmalı; hatırlatma kapsamı değişiminde kendi dirty guard'ı çalışmalı. Aç→Kaydet→kapat→Kaydet→yeniden aç; dosya eki vaadi yok; PDF yalnız SGK'da.
5. Tatil: farklı yıl ekleme, tarih/ad hataları, dialog Escape/dış tıklama dirty koruması, yıl filtresi, silme iptali/onayı. Köprü: üretim/iptal pending, maskeleme, clipboard ret/başarı ve kurulum dialogu.
6. Üye doğrudan URL: hiçbir ayar query'si çalışmamalı. Proje yöneticisi mail URL: AccessDenied. Geçersiz tab: Genel. Kullanıcı panelinin rol/üyelik akışı 12-ui sahibinin yeni sözleşmesiyle ayrıca denetlenmeli.

## Bilerek ertelenenler / riskler

- Koordinatörün açık yanıtıyla BrowserRouter için rota/Back köprüsü yazılmadı. Bölüm ve proje geçişi korunur; refresh/sekme kapatma beforeunload ile korunur; diğer uygulama içi rotalara ve tarayıcı Back'e merkezi router blocker bu teslimde yok.
- AdminUsersPanel'in içerik yerleşimi, dialog dirty/pending sözleşmesi, davet metinleri ve 390px akışları **12-ui sahibinde**. Bu worker yalnız bölüm başlığı/kapsamı ve mevcut paneli tüketir. Eski panelde taşan başlık nedeniyle `Settings.tsx:66` bölüm içinde geçici max-w-full/overflow-x-auto koruması bulunur; 12-ui tamamlanınca yalnız tablo taşmasına indirilebilir.
- Shared SaveBar özel etiket/valid API'si ve DatePicker label/id API'si genişletilmedi; yerel SaveBar ve erişilebilir native tarih input'u kullanıldı.
- Tema kişiselleştirme, bildirim alanlarını birleştirme, sunucu version/çatışma kontrolü, SMTP/Pafta altyapısı ve kurulum sihirbazı kapsam dışı. Uzak çatışma mesajı frontend uyarısıdır; sunucu last-write-wins değişmedi.
