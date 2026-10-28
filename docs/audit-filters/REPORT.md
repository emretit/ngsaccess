# Liste ve filtre düzeni denetimi

Tarih: 28 Ekim 2026. Kaynak: mevcut çalışma ağacı; diğer oturumların commit edilmemiş değişiklikleri dahil anlık görüntü. Yalnız bu rapor yazıldı; uygulama, test ve backend dosyaları değiştirilmedi. Satırlar bu görüntüye aittir.

## 1. Özet ve kapsam

`src/pages/**` ve `src/components/**` altında **383 üretim TSX dosyası** metinsel olarak tarandı (162 test TSX dosyası ayrıca envanterlendi). `FilterBar`, `CollapsibleFilters`, filtre metinleri, Select/NativeSelect/native select, Input/input/CommandInput, Sheet/Popover/Dialog/Drawer ve elle kurulmuş araç çubukları üzerinden adaylar incelendi. Sayım, dosyadaki her Select'i filtre saymaz: mevcut bir kayıt listesini daraltan bağımsız kullanıcı yüzeyi bir birimdir; aynı ortak rapor bileşenini kullanan route'lar tekrar sayılmaz.

**20 liste/filtre yüzeyi: 2 uyumlu, 18 sapmalı.** Sapmalıların 5'i ürün kararı gerektiren adaydır: üç sol ağaç paneli, durum sayaçları ve bilinen vardiya takvim araç çubuğu. Bunlar sapmalı sayımına dahildir, onaylanmış istisna değildir. Şirket/departman ve pozisyon panelleri aynı `DepartmentTree.tsx` sahipliği altında tek yüzey sayıldı. Referans yardımcıları (`FilterBar`, `CollapsibleFilters`) ayrıca incelendi, 20'ye dahil edilmedi.

En önemli bulgular:

- `src/components/access-control/unified/status/StatusFilters.tsx:77` ve `src/components/access-control/unified/rules-list/RulesFilters.tsx:37`: `collapseOn="all"` masaüstünde de filtreleri saklıyor (K3/K5).
- `src/components/leaves/LeaveFilters.tsx:85`: özel tarih aralığı ayrı Dialog içinde (K3/K4).
- `src/components/alarms/AlarmFilters.tsx:18`: ortak FilterBar ve temizleme eylemi yok; native select etiketleri alanların yanında (K1/K2).

Kural anahtarı: **K1** wrap FilterBar, varsa arama ilk sırada/görünür etiket/260px, temizle ghost ve sonda; **K2** küçük üst etiket, `grid w-full min-w-0 gap-1 text-xs min-[761px]:w-40`, tam genişlik tetikleyici ve “Tüm X”; **K3** bütün filtreler satırda/masaüstünde görünür; **K4** tarih satır içi veya sayfa üstü dönem gezgini; **K5** yalnız mobilde kapanma serbest.

Araması olmayan ekranlara sırf kalıbı tamamlamak için yeni arama işlevi önerilmedi. Select/DateInput'un kendi seçenek/takvim Popover'ı K3 ihlali sayılmadı: referansın `MonitoringPersonPicker` bileşeni de Popover kullanıyor. İhlal, filtre grubunun ayrı yüzeye saklanmasıdır. `SelectTrigger` zaten `src/components/ui/select.tsx:21` üzerinden `w-full` alır; yalnız açıkça `w-auto` ile ezilen veya dar kapsayıcıya alınan örnekler genişlik sapması sayıldı.

## 2. Bulgular

Test yolları repo köküne göredir. “Yeni” mevcut test olmadığı anlamına gelir; diğerleri mevcut ilgili regresyon testleridir, bu denetimde çalıştırılmadı. Risk yalnız önerilen frontend düzenlemesinin riskidir.

| Sayfa (route) | Dosya:satır | Sapma (kural no) | Önerilen düzeltme | Etkilenen test dosyaları | Risk |
| --- | --- | --- | --- | --- | --- |
| Ziyaretçiler `/visitors` | `src/components/visitors/VisitorFilters.tsx:14`, `:17` | K2: 192px (`w-48`) alan, standart küçük üst etiket ölçüsü yok; genel seçenek “Tümü”. | Alanı 160px FIELD ölçüsüne getir; “Tüm durumlar” kullan. | `src/components/visitors/visitors.test.tsx`, `src/components/visitors/visitorAudit.test.tsx` | düşük |
| Kişiler `/employees` | `src/components/employees/EmployeeFilters.tsx:16`, `:18`, `:28`; `src/pages/Employees.tsx:190` | K1: boş sonuçta temizleme CSS ile saklanıyor. K2: durum ve mobil sıralamada yalnız aria etiketi, `w-auto`. | Durum ve mobil sıralamayı görünür üst etiketli FIELD yap; temizlemeyi boş listede de göster. Sıralamanın yalnız mobil olması filtre gizleme değildir, masaüstünde tablo başlığında sıralama vardır. | `src/components/employees/EmployeeFilters.test.tsx`, `src/components/employees/EmployeesPage.test.tsx` | düşük |
| Cihazlar `/devices` | `src/components/devices/DeviceFilters.tsx:29`, `:33`, `:35`, `:42` | K1: sıfır sonuçta temizleme saklanıyor. K2: Bağlantı/Tip etiketi tetikleyicinin içinde, `w-auto`; “Tümü (sayı)”. | CSS gizlemeyi kaldır; iki FIELD kullan; “Tüm bağlantılar”, “Tüm cihaz tipleri” metinleri, sayılar korunabilir. | `src/components/devices/DeviceAudit.test.tsx`, `src/components/devices/DeviceList.test.tsx`; yeni `src/components/devices/DeviceFilters.test.tsx` | düşük |
| Admin kullanıcılar `/system-admin?tab=users` | `src/components/admin/AdminUsersPanel.tsx:197`; ortak kaynak `src/components/admin/components/AdminListParts.tsx:21` | K2: Rol/Proje etiketleri yanda; ortak AdminSelect yatay flex, select en fazla 210px. | Ortak AdminSelect'i üst etiketli FIELD + `w-full` yap; mevcut “Tüm roller/projeler” korunur. | `src/components/admin/components/settingsAudit.test.tsx`; yeni `src/components/admin/components/AdminListParts.test.tsx` | düşük |
| Admin projeler `/system-admin?tab=projects` | `src/components/admin/projects/AdminProjectsContent.tsx:104`, `:113`; `src/components/admin/components/AdminListParts.tsx:21` | K2: yatay etiket/alan; “Tümü”. | Ortak AdminSelect düzeltmesine katılır; “Tüm durumlar”. | `src/components/admin/projects/ProjectsTable.test.tsx`; yeni ortak `AdminListParts.test.tsx` | düşük |
| Admin cihaz havuzu `/system-admin?tab=devices` | `src/components/admin/AdminDevicesPanel.tsx:192`, `:204`, `:223`; `src/components/admin/components/AdminListParts.tsx:21` | K2: yatay Proje/Bağlantı; her iki genel seçenek “Tümü”. | AdminSelect ölçüsünü düzelt; “Tüm projeler”, “Tüm bağlantılar”. Havuz/atanmış seçenekleri korunur. | `src/components/admin/components/settingsAudit.test.tsx`; yeni ortak `AdminListParts.test.tsx` | düşük |
| Denetim kayıtları `/audit-log` | `src/components/audit/AuditFilters.tsx:21`, `:41`, `:46` | K2: üç alan `md:flex-1 md:grid-cols-3` ile büyüyor; 160px FIELD yok. K1/K4: zorunlu tam genişlik ayırıcı ve 420px tarih grubu tarihi ayrı sıraya zorluyor. Ayrı Dialog yok. | İç grid/ayırıcıyı kaldır; aktör/eylem/varlık ve iki DateInput'u FIELD öğeleri olarak wrap akışına kat. Mobil kapanma ve aktör seçeneklerinin tembel yüklenmesi korunsun. | `src/components/audit/auditAudit.test.tsx`, `src/components/audit/auditState.test.tsx` | orta |
| Yetki durumu `/access-control` → Yetki Durumu | `src/components/access-control/unified/status/StatusFilters.tsx:25`, `:37`, `:77` | K2: görünür üst etiket yok, “Departman: Tümü” vb.; 3 sütun grid. K3/K5: masaüstünde kapalı grup. | `collapseOn="all"` kaldır; gerekiyorsa bütün FilterBar'ı yalnız mobil CollapsibleFilters ile sar; Departman/Cihaz/Kural FIELD ve “Tüm departmanlar/cihazlar/kurallar”. | `src/components/access-control/unified/status/StatusInteractions.test.tsx`, `src/components/access-control/unified/status/StatusResults.test.tsx` | orta |
| Yetki durumu sayaç filtresi `/access-control` → Yetki Durumu | `src/components/access-control/unified/status/StatusCounters.tsx:21`, `:32`; yerleştiren `src/components/access-control/unified/status/StatusPage.tsx:83` | K1/K2/K3: `change({state})` yapan durum düğmeleri ayrı satırda; ortak filtre satırının dışında. **Ürün kararı adayı**: sayıların görünür kalması yararlı. | Tercih: sayısal özeti bırak, etkileşimli durum seçimini StatusFilters içine “Durum / Tüm durumlar” olarak al; sayaçlar salt özet olur. Alternatif: görünür hızlı filtre özeti için belgeli istisna. | `src/components/access-control/unified/status/StatusInteractions.test.tsx`, `src/components/access-control/unified/status/StatusViews.test.tsx` | orta |
| Yetki kuralları `/access-control` → Kurallar | `src/components/access-control/unified/rules-list/RulesFilters.tsx:37`, `:82` | K3/K5: tüm ekranlarda kapanma. K2: aria etiketli `w-auto` tetikleyiciler, üst etiket yok. | Arama alanı/Durum/Tür FIELD; iç flex ve tüm-ekran kapanmayı kaldır, varsayılan mobil sarmalayıcı kullan. Mevcut “Tüm durumlar/türler” korunur. | `src/components/access-control/unified/rules-list/RulesFilters.test.tsx`, `src/components/access-control/unified/UnifiedAccessControl.test.tsx` | orta |
| İzinler `/leaves` | `src/components/leaves/LeaveFilters.tsx:49`, `:54`, `:70`, `:85` | K2: kişi 230px, tür 180px, dönem farklı ölçü/etiket boyutu. K3/K4: özel aralık Dialog'da. | Kişi/tür alanlarını FIELD yap; dönem seçimi ve Başlangıç/Bitiş DateInput'larını satıra al; mevcut tarih doğrulamasını, URL güncellemesini ve aralıkla kesişme davranışını koru. Ayrı “Uygula” taslak davranışı ürün kararına bağlıdır. | `src/components/leaves/LeaveAudit.test.tsx`, `src/components/leaves/lib/leaveState.test.tsx`, `src/components/leaves/LeaveRequestsPanel.test.tsx` | orta |
| Raporlar `/reports/:group/:slug` (bütün registry raporları) | `src/components/reports/ReportScreen.tsx:79`, `:82`, `:83`, `:84`, `:87` | K2: alanlar `sm:w-44/w-48`, etiketler FormFieldWrapper varsayılanı; eşik 761px değil. K4: özel aralık FilterBar sonrasında ayrı grid'de. | Dönem/şirket/departman/mola/sonuç FIELD yap; özel aralık DateInput'larını FilterBar çocuklarına, temizle öncesine taşı. Ay seçimi ve kaynak bazlı kişi arama davranışı korunsun. | `src/components/reports/auditFixes.test.tsx`, `src/components/reports/ReportPage.test.tsx` | orta |
| Alarmlar `/alarms` (alarm/istisna kategorileri) | `src/components/alarms/AlarmFilters.tsx:18`; yerleştiren `src/pages/Alarms.tsx:118` | K1: FilterBar/temizleme yok. K2: native select'ler yanda etiketli, “Tümü”; tarihler yanda etiketli. | Mevcut filtreleri aramasız wrap FilterBar'a al; FIELD düzeni, “Tüm durumlar/önem düzeyleri/cihazlar”; başlangıç/bitiş aynı akışta, ghost temizle. Varsayılan durumun “Açık” olduğu korunmalı. | `src/components/alarms/AlarmFilters.test.tsx`, `src/pages/Alarms.test.tsx` | orta |
| Vardiya takvimi `/pdks-records?plan=1` | `src/components/shifts/calendar/ShiftCalendarPlan.tsx:160`, `:164`, `:168`, `:172` | K1/K2: elle flex, arama 128px ve yalnız aria etiketli, vardiya 144px; koşullu “Temizle”. **Bilinen istisna adayı** (`.claude/handoff-ortak-bilesen.md:22`). Dönem gezgini K4'e uygun. | Kalıba tam geçiş seçilirse arama 260px/görünür etiket, FIELD vardiya, ghost “Filtreleri temizle”; dönem gezginini üstte tut. Compact varyant seçilirse bunun referanstan sapma olduğu açıkça onaylanmalı. | `src/components/shifts/calendar/calendarControls.test.tsx`, `src/components/shifts/calendar/shiftCalendarModel.test.ts` | orta |
| Tatil takvimi `/pdks-records/settings` | `src/components/settings/sections/components/HolidayCalendarManager.tsx:82`, `:84` | K1/K2: listeyi gerçekten daraltan Yıl alanı elle flex içinde, 96px; ortak filtre/temizleme yok. Formdaki tatil ekleme tarihleri bu bulguya dahil değil. | Yıl alanını aramasız FilterBar içinde FIELD yap; temizleme cari yıla döner. “Tatil ekle/Resmi tatilleri yükle” işlemlerini filtrelerden ayır veya end alanına koy; ürünce temizle son sırada tutulmalı. | `src/components/settings/settings.test.tsx`, `src/components/settings/auditFixes.test.tsx`; yeni `src/components/settings/sections/components/HolidayCalendarManager.test.tsx` | düşük |
| Kişiler şirket/departman/pozisyon filtreleri `/employees` | `src/components/departments/DepartmentTree.tsx:107`, `:138`, `:290`; `src/pages/Employees.tsx:170` | K1/K3: filtreler ana satır yerine sol TreePanel'de. K5: TreePanel 1100px altında kapanıyor, 761–1099px masaüstü aralığında da gizli. **Ürün kararı adayı**: ağaç aynı zamanda yönetim işlemleri içerir. | Satırdaki mevcut EmployeeFilters'a şirket/departman/pozisyon Select'leri ekle; ağacı yönetim paneli olarak koruyup aynı filtre state'ine bağla veya belgeli navigasyon istisnası seç. | `src/components/employees/EmployeesPage.test.tsx`; yeni `src/components/departments/DepartmentTree.test.tsx` | orta |
| Cihaz bölge/kapı filtreleri `/devices` | `src/components/devices/LocationTree.tsx:197`, `:218`; `src/pages/Devices.tsx:48`; eşik `src/components/shared/TreePanel.tsx:87` | K1/K3/K5: sol ağaçta ayrı filtre ve 1100px'e kadar kapalı panel. **Ürün kararı adayı**: kapı/bölge yönetimi de var. | DeviceFilters satırında bölge/kapı FIELD seçenekleri; mevcut URL/state ve bölge-kapı bağı korunur. Ağaç yönetim amaçlı kalabilir; aksi halde belgeli istisna gerekir. | `src/components/devices/DeviceAudit.test.tsx`, `src/components/devices/useDeviceUrlSync.test.tsx`, `src/components/devices/useDeviceDeepLink.test.tsx` | orta |
| PDKS vardiya filtre ağacı `/pdks-records` | `src/components/shifts/ShiftTree.tsx:41`, `:44`; yerleştiren `src/pages/PDKSRecords.tsx:118` | K1/K3/K5: vardiya ana satırda değil, sol panelde; 1100px'e kadar saklı. **Ürün kararı adayı**: PDKSFilterBar referansı bu ağacı kapsamıyor; vardiya yönetimi de bu panelde. | Vardiya seçimini PDKS filtre satırına FIELD olarak eklemek için ayrı ürün kararı; tanım ekleme/düzenleme ağacını koru. Referans PDKSFilterBar bu denetimde değiştirilmedi. | `src/components/shifts/ShiftTree.test.tsx`, `src/components/pdks/dashboard/shiftPlans.test.tsx`, `src/components/pdks/dashboard/PDKSFilterBar.test.tsx` | orta |

## 3. Uyumlu olanlar

`/live-monitoring` — `src/components/access-control/CardReadingsFilters.tsx:11,35`; `/pdks-records` ana filtre satırı — `src/components/pdks/dashboard/PDKSFilterBar.tsx:35,61` ve sayfa üstü dönem gezgini `src/components/pdks/dashboard/PDKSDateNavigator.tsx:81` (vardiya ağacı ayrı bulgu).

## 4. Ek kapsam kontrolü ve dışarıda bırakma gerekçeleri

Bu liste uyumlu sayımına eklenmez; adayların gözden kaçmadığını ve form işlevlerini filtre diye yeniden tasarlamama sınırını gösterir.

| İncelenen yüzey | Kanıt / karar |
| --- | --- |
| Rapor indirme ayarları | `src/components/settings/sections/ReportsSettings.tsx:139`: kapsam/tür/yıl/ay bir indirme formunun parametreleri. Ekranda sonuç tablosu yok; yüklenen veri için kişi sayısı/özet ve indirme eylemleri var. Ücret girdisi filtre değil. Ayrı rapor oluşturma formu olarak dışarıda; bu ekran önizleme listesine dönüşürse K1/K2 uygulanmalı. |
| Kural düzenleyici kişi/departman ve bölge/kapı seçim ağaçları | `src/components/access-control/unified/components/DepartmentTree.tsx:219` ve `src/components/access-control/unified/components/ZoneDeviceTree.tsx:275`: sr-only arama, FilterBar yok. Kayıt listesinin filtresi değil, kural formu hedef seçimi. Form içi seçim listeleri de standartlaştırılacaksa görünür arama etiketi önerilir; K3 burada düzenleyici Dialog'u yasaklamaz. İlgili test: `src/components/access-control/unified/components/TreeLabels.test.tsx`. |
| Vardiya atama/toplu temizle kişi seçimi | `src/components/shifts/AssignShiftDialog.tsx:205` ve `src/components/shifts/ClearAssignmentsDialog.tsx:36`: form hedef listesinde arama. Atama Dialog'unu kapatmak veya filtre satırına taşımak önerilmez. Atama aramasında görünür üst etiket ayrıca düşünülebilir; temizle formunda zaten var. |
| Kullanıcı formu proje seçimi | `src/components/admin/components/UserFormDialog.tsx:199`: form içi proje atama listesi; ana admin listesi filtresi değil. |
| Kişi combobox'ları | `src/components/leaves/EmployeePicker.tsx:30`, `src/components/live-monitoring/MonitoringPersonPicker.tsx:26`, `src/components/visitors/VisitorCombobox.tsx:25`: filtre veya form alanının seçenek araması. Kontrol satırda görünürse normal seçenek Popover'ı K3 ihlali sayılmaz. |
| Cihaz alt sekmeleri | `src/components/devices/DeviceDetailsPanel.tsx:178` Bilgiler/İşlemler ve `src/components/devices/DeviceCommandCenter.tsx` incelendi: bağımsız liste filtresi yok; form alanları/komutlar/sonuçlar. `src/components/access-control/unified/SyncRuns.tsx:123` Sheet bir gönderim sonucu, filtre paneli değil. |
| Kapı planları / vardiya tanımları | `src/components/access-control/door-plans/DoorPlansTab.tsx` seçim/plan düzenleme tablosu; kullanıcıya açık arama/daraltma alanı yok. Vardiya tanımları ShiftTree ve takvim filtresi yukarıda ayrı bulgular; CalendarNavigation dönem gezgini K4'e uygun. |
| Ayar listeleri | RolesSettings, MailSettings, ReportsSettings, PdksSettingsPanel ve bunların alt bileşenlerindeki Select/NativeSelect'ler ayar formu değerleri; liste daraltma kontrolü bulunmadı. Tatil takvimi yıl filtresi ayrıca raporlandı. |
| Navigasyon ve tablo araçları | `src/pages/Reports.tsx:45` rapor seçimi route değiştirir; ProjectSwitcher/CommandPalette genel navigasyondur. PaginationBar sayfa boyutu, ReportPage sütun görünürlüğü ve StatusResults kişi/cihaz görünümü filtre değildir. PDKSSavedViews/PDKSSmartPresets arama formu değil görünüm/önayar seçimidir; filtre kontrollerini saklayan grup yok. |

`layout="grid"` kullanan üretim FilterBar çağrısı bulunmadı. Tüm-ekran CollapsibleFilters çağrıları yalnız RulesFilters/StatusFilters'ta bulundu; CollapsibleFilters yardımcı API'sinin bu seçeneği sunması tek başına ihlal değildir. Shared TreePanel'in 1100px eşiği ise üç ağaç için açık ürün kararı gerektirir.

## 5. Dalgalar ve tekil dosya sahipliği

Üç dalga; aşağıdaki dosya listeleri birbirini dışlar. Her dalga yaklaşık **15–20 dakika küçük frontend düzeni** hedefidir; süre, mevcut sorgu/state/doğrulama davranışını koruma ve aşağıdaki ürün adaylarını şimdilik istisna olarak tutma varsayımına dayanır. Beş adayın tümünü tam satır standardına taşımak bu süreye sığmaz; bu nedenle bu rapor uygulanabilir küçük düzenleri ve koşullu yapısal işi açıkça ayırır. Dalga listesinde yer almayan dosyaya ihtiyaç doğarsa başka dalganın sahipliği devralınmadan kapsam güncellenmelidir.

### Dalga 1 — temel alan ölçüsü ve admin ortak seçici (15–20 dk)

Yazılacak dosyalar:

- `src/components/visitors/VisitorFilters.tsx`
- `src/components/employees/EmployeeFilters.tsx`
- `src/pages/Employees.tsx` (hideClear aktarımı ve varsa şirket/departman/pozisyon filtre state bağlantısı)
- `src/components/devices/DeviceFilters.tsx`
- `src/components/devices/DevicesContent.tsx` (bölge/kapı alanı seçilirse props)
- `src/pages/Devices.tsx` (bölge/kapı alanı seçilirse state bağlantısı)
- `src/components/admin/components/AdminListParts.tsx`
- `src/components/admin/AdminUsersPanel.tsx`
- `src/components/admin/AdminDevicesPanel.tsx`
- `src/components/admin/projects/AdminProjectsContent.tsx`
- `src/components/employees/EmployeeFilters.test.tsx`
- Yeni `src/components/devices/DeviceFilters.test.tsx`
- Yeni `src/components/admin/components/AdminListParts.test.tsx`

Kontrol: üst etiket/160px, arama ilk sırada/260px, sıfır sonuçta da ghost temizle; admin genel seçenek metinleri. DepartmentTree ve LocationTree adaylarının **satır eşdeğerleri** kabul edilirse aynı dalganın EmployeeFilters/DeviceFilters dosyalarında yapılır; yönetim ağaçları yeniden yazılmaz. Bu koşullu genişleme 20 dakikayı aşarsa ek iş olarak tahminlenir; başka dalgaya aynı dosya verilmez.

### Dalga 2 — saklanan filtreler, denetim ve alarmlar (15–20 dk)

Yazılacak dosyalar:

- `src/components/access-control/unified/rules-list/RulesFilters.tsx`
- `src/components/access-control/unified/status/StatusFilters.tsx`
- `src/components/access-control/unified/status/StatusCounters.tsx` (ürün kararı kabul edilirse sayaçların filtre eylemini kaldır)
- `src/components/access-control/unified/status/StatusPage.tsx` (durum seçimi bağlantısı gerekiyorsa)
- `src/components/audit/AuditFilters.tsx`
- `src/components/alarms/AlarmFilters.tsx`
- `src/pages/Alarms.tsx` (FilterBar sahipliğinin filtre bileşeninde kalması için dış düzen uyumu)
- `src/components/access-control/unified/rules-list/RulesFilters.test.tsx`
- `src/components/access-control/unified/status/StatusInteractions.test.tsx`
- `src/components/audit/auditAudit.test.tsx`
- `src/components/alarms/AlarmFilters.test.tsx`

Kontrol: ilk yüklemede masaüstü filtreleri görünür, mobilde kapanabilir; tüm genel seçenekler “Tüm X”; alarm temizle “Açık” varsayılanına döner; aktör yüklemesi/erişim kapsamı değişmez. Durum sayacı kararı da bu dalgaya aittir.

### Dalga 3 — dönem alanları, izinler ve takvim (15–20 dk; aday kararlarına bağlı)

Yazılacak dosyalar:

- `src/components/leaves/LeaveFilters.tsx`
- `src/components/reports/ReportScreen.tsx`
- `src/components/settings/sections/components/HolidayCalendarManager.tsx`
- `src/components/shifts/calendar/ShiftCalendarPlan.tsx` (takvim istisnası kaldırılırsa)
- `src/components/leaves/LeaveAudit.test.tsx`
- `src/components/reports/auditFixes.test.tsx`
- Yeni `src/components/settings/sections/components/HolidayCalendarManager.test.tsx`
- `src/components/shifts/calendar/calendarControls.test.tsx` (takvim değişirse)

Kontrol: izin ve rapor özel aralıkları satırda, ters aralık hata mesajları doğru, dönem/URL korunuyor; tatil yılı temizle cari yıl. **ShiftTree vardiyasının satıra taşınması** kararı çıkarsa bu dalganın koşullu ek sahipliği: `src/components/pdks/dashboard/PDKSFilterBar.tsx`, `src/pages/PDKSRecords.tsx`, `src/components/pdks/dashboard/PDKSFilterBar.test.tsx`. Bu referans dosyalar denetimde yalnız okundu; uygulama kararı alınmadan değiştirilmemeli. Ağaç yönetimi ShiftTree'de kalır. Tam geçiş kararı verilirse bu dalga yeniden tahminlenmelidir.

**Paylaşılan bileşenler:** `src/components/shared/*` için değişiklik gerekmiyor; FilterBar'ın varsayılan wrap düzeni ve CollapsibleFilters'ın varsayılan mobil davranışı yeterli. AdminSelect admin klasöründe ve yalnız Dalga 1'e ait. Ortak helper'a global stil değişikliği veya compact varyant eklemek önerilmedi; böylece başka tüketiciler etkilenmez. TreePanel'in 1100px eşiğini global değiştirmek yerine ürün adaylarının satır eşdeğerleri önerildi.

Mevcut regresyon dosyaları ilgili dalgada çalıştırılır; yalnız değişen davranışı sınayan testler düzenlenir. Genel kapı: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json` ve `node_modules/.bin/eslint src convex` (no-explicit-any sıfır). Denetim yalnız dokümantasyon ürettiği için bu komutlar ve testler bu görevde çalıştırılmadı. Sonraki uygulamada 390px, 760px, 761px, 1099px, 1100px ve geniş masaüstünde görsel kontrol; filtreler aktifken sıfır sonuç ve temizle ayrıca denenmeli.

## 6. Açık ürün kararları

1. **Ağaçlar navigasyon/yönetim istisnası mı, liste filtresi mi?** DepartmentTree, LocationTree ve ShiftTree bugün sonuçları daraltıyor. Referansın katı yorumu satırda eşdeğer seçiciler gerektiriyor; aynı anda yönetim ağacını kaldırmak işlev kaybı yaratır. Varsayılan öneri: yönetim ağacı korunsun, filtre seçimi satırdan da yapılabilsin. 761–1099px görünürlüğü kararın parçasıdır.
2. **Vardiya takvim araç çubuğu:** `.claude/handoff-ortak-bilesen.md:22` açıkça bilinçli erteleme kaydıdır; onaylanmış compact tasarım değildir. Tam kalıp mı, belgeli compact istisna mı seçilmeli. Referans ölçüsünü sağlayamayan compact seçenek “uyumlu” diye sayılmamalı.
3. **Durum sayaçları:** filtre düğmeleri olarak ayrı görünür hızlı özet kalabilir mi? Katı uyum için durum seçimini satıra alıp sayaçları salt bilgi yapmak önerilir; sayıların kaybolması önerilmez.
4. **İzin özel aralığı:** mevcut Dialog'daki iki tarihi birlikte “Uygula” davranışı satırda korunacak mı, geçerli aralık anında mı uygulanacak? Mevcut doğrulama ve geçersiz aralıkta sorgu yapmama davranışı korunmalı.
5. **Yoğun satır:** rapor/denetim alanları geniş ekranda bile sarılabilir; wrap zaten buna izin veriyor. Alanları “Diğer filtreler” içine geri saklamak önerilmez. İki satır kabul edilebilir; zorunlu tarih paneli kullanılmamalı.

Bu kararlar çözülmeden 18 sapmanın tamamını 3 × 20 dakikada bitirme taahhüdü doğru olmaz. Üç dalga dosya sahipliğini eksiksiz ayırır; koşullu ağaç/sayaç/takvim işleri, ilgili dalganın süresini artıran ürün kapsamı olarak açık tutulmuştur.

## 7. Kararlar (Emre, 28 Ekim 2026)

1. Sol ağaçlar (DepartmentTree, LocationTree, ShiftTree): **olduğu gibi kalır** — yönetim/gezinme paneli istisnası; satıra eş seçici eklenmez.
2. Vardiya takvim araç çubuğu (ShiftCalendarPlan): **kompakt kalır** — belgeli istisna.
3. Yetki Durumu sayaçları (StatusCounters): **olduğu gibi kalır** — hızlı filtre istisnası.
4. İzin özel aralığı: satırda, geçerli aralık anında uygulanır (PDKS ile aynı); ters aralıkta hata, sorgu yok.
