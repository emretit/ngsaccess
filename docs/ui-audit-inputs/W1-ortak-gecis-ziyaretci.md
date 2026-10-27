# W1 — Ortak bileşenler, Geçiş Kontrol ve Ziyaretçiler input border audit

Taranan dosya: **210** (155 test dışı dosya; 55 test dosyası envantere dahil). Bulgu: **25** — **Y: 2, O: 21, D: 2**. En yaygın kök sebepler, FormDialog iç scroll gövdesinde ring boşluğunun bulunmaması ve primitive’lerin ortak hata border stiline sahip olmamasıdır.

Bu salt okunur statik kaynak taramasıdır; kullanıcı tarafından doğrulanmış VisitorZoneDialog örneği dışında tarayıcıda görsel doğrulama yapılmadı. A bulguları somut ata zincirine, diğerleri kaynakta görülen stil/ARIA farkına dayanır; kategori ve önem sayımı tablo satırı bazındadır, ortak kök sebeplerin tekrarlarını içerir. src/convex dosyaları değiştirilmedi.

| # | Önem | Kat. | file:line | Öğe | Kanıt (class / ata container file:line) | Ekran (kullanıcının gördüğü yer) | Öneri (tek satır) |
|---|---|---|---|---|---|---|---|
| 1 | Y | A | `src/components/visitors/VisitorZoneDialog.tsx:141` | Bölge adı; saat alanları ve kapı araması | fieldset :135 yatay padding yok → shared/FormDialog.tsx:91 overflow-y-auto ve padding yok → ui/input.tsx:11 dış ring-2. TimeSchedule :126 ve ZoneDeviceTree :279 aynı gövdede. | Ziyaretçiler → Erişim bölgesi oluştur | FormDialog scroll gövdesine ring için yatay/dikey boşluk ekle. |
| 2 | Y | A | `src/components/access-control/AddZoneDialog.tsx:95` | Bölge adı ve açıklama (:106) | fieldset :89 space-y-4 → shared/FormDialog.tsx:91 padding olmadan overflow-y-auto; Input ve Textarea w-full, dış ring-2. | Geçiş kontrol → Bölge ekle | Ortak FormDialog scroll gövdesini düzelt. |
| 3 | O | B | `src/components/ui/select.tsx:21` | SelectTrigger focus | Input :11 focus-visible:ring-offset-0; Select focus:ring-2 focus:ring-offset-2 ve focus:outline-none; aynı h-9/border-input/bg-surface olmasına karşın 4 px dış alan ve farklı focus seçicisi. | Tüm Select alanları; ziyaretçi durum ve okuyucu filtreleri | Focus seçicisi ve offset sözleşmesini Input ile eşitle. |
| 4 | D | B | `src/components/ui/textarea.tsx:13` | Textarea yüzeyi ve yazı boyutu | Textarea bg-background text-sm min-h-[80px]; Input :11 bg-surface text-base md:text-sm; border/radius/ring-offset-0 aynı. | Bölge açıklaması, ziyaretçi notları | Yüzey ve mobil yazı boyutunu ortak alan tokenlarına bağla. |
| 5 | O | B | `src/components/ui/command.tsx:47` | CommandInput arama odağı | outline-none; focus/focus-visible ring veya focus-within border yok; :42 yalnız sabit border-b; :16 overflow-hidden. h-11 (CommandDialog :30 h-12), bg-transparent; Input h-9/border-input. | Proje arama, sayfa arama, ziyaretçi kişi/bölge combobox araması | Arama wrapperına görünür focus-within işareti ekle; yükseklik farkını bilinçli sözleşmeye bağla. |
| 6 | D | B | `src/components/ui/date-picker.tsx:32` | DateInput/DatePicker/MonthPicker tetikleyicisi | TRIGGER_CLASS :33 h-9 text-xs; :363 ve :457 Button outline kullanır → ui/button.tsx:8 focus-visible:ring-offset-2; Input :11 offset-0/text-base md:text-sm. PopoverTrigger ui/popover.tsx:8 çıplak Radix alias, kendi stilini sağlamaz. | Tarih filtreleri; ziyaretçi geçerlilik tarihi | Alan tetikleyicilerine Input ile ortak tipografi/focus tokenları ver. |
| 7 | O | E | `src/components/shared/FormFieldWrapper.tsx:34` | Ortak hata kontrolü | Wrapper :26/:36 aria-invalid ekler, :53 yalnız hata metnini renklendirir; ui/input.tsx:11, textarea.tsx:13, select.tsx:21 ve date-picker/button sınıflarında invalid border kuralı yok; src CSS dosyalarında da aria-invalid kuralı bulunmadı. | FormFieldWrapper kullanan formlar; aşağıdaki somut örnekler | Invalid border stilini primitive düzeyinde tanımla. |
| 8 | O | E | `src/components/access-control/AddDoorDialog.tsx:44` | Kapı adı | error FormFieldWrapper’a veriliyor; Input class override yok; ortak wrapper :34 ARIA ekler fakat primitive :11 border-input olarak kalır. | Kapı ekle | Ortak invalid border stilini uygula. |
| 9 | O | E | `src/components/access-control/AddReaderDialog.tsx:45` | Okuyucu adı | error wrapper’a veriliyor; kırmızı border sınıfı veya üstte invalid selector yok; Input :11 border-input. | Okuyucu ekle | Ortak invalid border stilini uygula. |
| 10 | O | E | `src/components/access-control/EditReaderDialog.tsx:78` | Okuyucu adı | FormFieldWrapper :77 error={nameError}; Input’ta invalid border yok, form/fieldset :73/:76 renk selectorı yok. | Okuyucuyu düzenle | Ortak invalid border stilini uygula. |
| 11 | O | E | `src/components/visitors/VisitorZoneDialog.tsx:141` | Bölge adı hata durumu | Wrapper :139 error={fieldErrors.name}; fieldset :135 renk selectorı yok; VisitorFormFields.tsx:24 içinde bulunan [&_[aria-invalid=true]]:border-destructive burada yok. | Ziyaretçi erişim bölgesi oluştur | Primitive invalid stilini ortaklaştır. |
| 12 | O | E | `src/components/access-control/AddZoneDialog.tsx:95` | Bölge adı hata durumu | Wrapper :93 error={error}; fieldset :89 yalnız space-y-4, Input’ta invalid border yok. | Bölge ekle | Primitive invalid stilini ortaklaştır. |
| 13 | O | E | `src/components/access-control/unified/components/RuleBasicInfo.tsx:25` | Kural adı | Wrapper :24 error={errors.name}; Input :25 ve CreateRuleDialog.tsx:169/:184 kapsayıcılarında invalid border selectorı yok. | Yeni erişim kuralı / kural düzenleme → temel bilgiler | Primitive invalid stilini ortaklaştır. |
| 14 | O | E | `src/components/access-control/unified/components/TimeSchedule.tsx:126` | Başlangıç/bitiş saati | aria-invalid :130 ve hata metni :150-156 var; className :129 yalnız min-w-0 w-full; Input invalid stil sağlamıyor. | Kural sihirbazı → özel saat aralığı | Hata border stilini Input’a ekle. |
| 15 | O | E | `src/components/access-control/door-dialog/DoorGeneralFields.tsx:15` | Kapı adı ve fiziksel kapı no | Ad :15 aria-invalid; DoorGatewayNumberField.tsx:15 de aria-invalid; :22/:23 hata metni var; her iki Input normal border-input olarak kalıyor. | Kapı düzenle | İki kontrolü ortak invalid border stiliyle renklendir. |
| 16 | O | E | `src/components/access-control/door-dialog/DoorVerifyPlanSection.tsx:38` | Doğrulama planı saatleri/modları | aria-invalid yalnız dış div’de; DoorVerifyPlanEditor.tsx:33/:43 Input ve :53/:110 select’lere aktarılmaz; hata :42 gösterilir. | Kapı düzenle / Kapı planları → doğrulama modu planı | Hatanın ait olduğu kontrolleri aria-invalid ve hata border ile işaretle. |
| 17 | O | E | `src/components/access-control/door-plans/DoorPlanDialog.tsx:281` | Kapı durum planı saatleri/modları | aria-invalid dış role=group’ta; DoorStatusPlanEditor.tsx:33/:43/:53/:102 kontrollerinde yok; hata :355-358; grup invalid durumu input’a miras kalmaz. | Kapı planları → durum planı | Hata bilgisini ilgili kontrol veya alan grubuna görsel olarak bağla. |
| 18 | O | E | `src/components/access-control/unified/templates/TemplateEditor.tsx:71` | Şablon saat aralıkları | Input :71-86 aria-invalid içermez; check.error :233-236 yalnız role=alert; ad Input :207 de aria-invalid almıyor, genel error :247-250. | Zaman şablonu oluştur/düzenle | Doğrulama sonucunu ilgili ad/saat kontrollerine bağla. |
| 19 | O | E | `src/components/access-control/unified/components/TimeSchedule.tsx:64` | Zaman şablonu seçimi | TemplatePicker :64-72 error/aria-invalid almıyor; :73-76 errors.scheduleTemplateId gösteriyor; TemplatePicker.tsx:33 select’te invalid/describedby yok. | Kural sihirbazı → Şablon kullan | Picker’a hata props ve kontrol üzerinde hata işareti ekle. |
| 20 | O | E | `src/components/access-control/CardReadingsFilters.tsx:30` | Başlangıç/bitiş tarihleri | CardReadings.tsx:53 badDate hata mesajı; filtreler :30-31 aria-invalid almaz (bitişte yalnız aria-describedby var); DateInput normal border ile kalır. | Geçiş okumaları → ters tarih aralığı | badDate bilgisini iki tarih tetikleyicisine aktar. |
| 21 | O | D | `src/components/access-control/DoorStatusPlanEditor.tsx:53` | Mod ve plan düzeni select’leri (:102) | h-10 rounded-md border bg-background px-2; Input h-9/bg-surface ve ortak focus ring kullanır; ham select’te bunlar yok. | Kapı durum planı günlük/haftalık düzenleyicisi | Select primitive’i veya aynı alan stili sözleşmesini kullan. |
| 22 | O | D | `src/components/access-control/door-dialog/DoorVerifyPlanEditor.tsx:53` | Doğrulama modu ve plan düzeni (:110) | Ham select h-10 bg-background border; yanındaki Input :33/:43 h-9/bg-surface, focus ring sözleşmesi farklı. | Kapı doğrulama planı düzenleyicisi | Select primitive’ine geçir. |
| 23 | O | D | `src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:119` | Kaynak türü / kaynak kapı (:132) | Ham select :121/:134 w-full border bg-background rounded p-2; ortak h-9/rounded-md/focus ring yok. :150 kapı modu select’i ayrıca className almıyor (görünür sınırı doğrulanmadığından D sayımına dahil edilmedi). | Planı kopyala | Tüm seçimlere ortak Select alan stilini uygula. |
| 24 | O | D | `src/components/access-control/door-plans/DoorPlanDialog.tsx:323` | Şablon modu, tatil yılı (:398), tatil modu (:415) | Ham select :325 h-10 border rounded bg-background; yıl :400 w-24 rounded border bg-background p-2; tatil modu :417 h-10 rounded border bg-background; ortak focus ring yok. | Kapı planları → şablon/tatil bölümleri | Select ve Input primitive’lerini kullan. |
| 25 | O | D | `src/components/access-control/unified/templates/TemplatePicker.tsx:33` | Zaman şablonu seçicisi | Ham select :35 h-11 border rounded bg-background px-2; SelectTrigger h-9 rounded-md bg-surface; focus ring sözleşmesi yok. | Kural saat şablonu, kapı planları ve plan kopyalama | SelectTrigger tabanlı ortak picker kullan. |

## Ortak kök sebepler

Aşağıdaki liste `rg -n "\b<Bileşen>\b" .` ile repo genelinde çıkarıldı (Git ignore kuralları geçerli; rapor klasörü kendi kendini listelememek için hariç). Üretim kullanımları ile test/doküman referansları ayrı verilmiştir; import/simge referansı tek başına o ekranda görsel bozukluk kanıtı değildir.

### FormDialog

`src/components/shared/FormDialog.tsx:91`: overflow-y-auto, px/p yok. Dış DialogContent’in ui/dialog.tsx:39 p-6 olması iç scroll viewport’unun kırpmasını gidermez. Tek düzeltme scroll gövdesinde en az ring alanı kadar padding ve tasarıma uygun negatif margin/yerleşim düzenidir; offset-2 kullanan kontrol için 4 px alan gerekir. :50 dış overflow-hidden da bulunur, fakat p-6 içerir.

Üretim kullanım/referans dosyaları:

- `src/components/access-control/AddZoneDialog.tsx:2,70,113`
- `src/components/admin/projects/ProjectEditor.tsx:9,69,133`
- `src/components/departments/AddDepartmentDialog.tsx:1,55,98`
- `src/components/departments/CompanyDialog.tsx:2,35,63`
- `src/components/departments/MoveDepartmentDialog.tsx:2,25,46`
- `src/components/devices/AssignLocationForm.tsx:4,116,199`
- `src/components/pdks/ManualPdksEditDialog.tsx:6,84,212`
- `src/components/visitors/VisitorZoneDialog.tsx:6,117,175`

Test ve diğer referans dosyaları:

- `src/components/shared/FormDialog.test.tsx:4,52,62,66,96,106,116,126`

### DetailSheet

`src/components/shared/DetailSheet.tsx:43`: p-0 + overflow-hidden (scroll=body) veya overflow-y-auto (scroll=all). :66 body modunda scroll gövdesine padding eklemez; all modunun iç gövdesi px-6 pb-6 sağlar. Padding sözleşmesi çağırana bağlıdır; wrapper yapısı tek başına tüm çağıranlarda hata kanıtı değildir. W1 ziyaretçi formunda VisitorForm.tsx:45 p-5 vardır ve yatay ring korunur; bu yüzden yeni A bulgusu yazılmadı.

Üretim kullanım/referans dosyaları:

- `src/components/audit/AuditDetailPanel.tsx:3,10,20`
- `src/components/devices/DeviceDetailsPanel.tsx:11,127,270`
- `src/components/employees/SlideOverPanel.tsx:3,66,119`
- `src/components/leaves/LeaveDetails.tsx:5,26,85`
- `src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:14,72,91`
- `src/components/visitors/VisitorSlideOverPanel.tsx:6,31,44`

Test ve diğer referans dosyaları:

- `src/components/shared/DetailSheet.test.tsx:4,27,29,38,52,57,63,68,74,77`

### ResponsiveResults

`src/components/shared/ResponsiveResults.tsx:15`: masaüstü tablo wrapper’ı overflow-x-auto, padding yok. W1 VisitorTable ve CardReadingsTable içinde borderlı metin input yok; checkbox’lar kapsam dışıdır. Başka çağıranların input’u varsa tablo hücresi padding’i de kontrol edilmelidir; burada toplu bozukluk iddiası yok.

Üretim kullanım/referans dosyaları:

- `src/components/access-control/CardReadingsTable.tsx:1,15`
- `src/components/admin/AdminDevicesPanel.tsx:1,228`
- `src/components/admin/components/UserTable.tsx:1,91`
- `src/components/admin/projects/ProjectsTable.tsx:1,47`
- `src/components/leaves/LeaveList.tsx:1,60`
- `src/components/pdks/dashboard/PDKSTableView.tsx:3,68`
- `src/components/visitors/VisitorTable.tsx:1,15`

Test ve diğer referans dosyaları:

- `src/components/shared/ResponsiveResults.test.tsx:3,5,7,15`

### TreePanel

`src/components/shared/TreePanel.tsx:86`: dış nav overflow-hidden, yatay padding yok; :91 iç scroll alanı p-1 içerir. p-1 normal ring-2 ve offset-2 toplamını karşılar; header slot’u aynı korumayı otomatik almaz. Mevcut W1 alanında doğrudan input yerleşimi yok; somut input ring hatası doğrulanmadı.

Üretim kullanım/referans dosyaları:

- `src/components/departments/CompanyTreeItem.tsx:6`
- `src/components/departments/DepartmentTree.tsx:16,19,107,189,280,322`
- `src/components/departments/DepartmentTreeItem.tsx:6`
- `src/components/devices/LocationDoorItem.tsx:7`
- `src/components/devices/LocationTree.tsx:23,26,194,308`
- `src/components/shifts/ShiftTree.tsx:6,41,65`

Test ve diğer referans dosyaları:

- `docs/mobile-release/evidence/final-source-sha256.json:886`
- `docs/mobile-release/evidence/web-build.txt:69`
- `src/components/shifts/ShiftTree.test.tsx:11`

### FilterBar

`src/components/shared/FilterBar.tsx:29-34`: overflow sınıfı YOK; wrap/grid ve gap kullanır. Arama Input’u :31’de normal primitive’dir. Ortak overflow kök sebebi değildir; istenen ek envanter için tüm kullanımlar aşağıdadır.

Üretim kullanım/referans dosyaları:

- `src/components/access-control/CardReadingsFilters.tsx:5,35,37`
- `src/components/access-control/unified/rules-list/RulesFilters.tsx:1,22,87`
- `src/components/access-control/unified/status/StatusFilters.tsx:1,62,118`
- `src/components/admin/AdminDevicesPanel.tsx:21,156,200`
- `src/components/admin/AdminUsersPanel.tsx:14,162,210`
- `src/components/admin/projects/AdminProjectsContent.tsx:8,71,92`
- `src/components/audit/AuditFilters.tsx:8,38,49`
- `src/components/devices/DeviceFilters.tsx:2,28,46`
- `src/components/employees/EmployeeFilters.tsx:1,16,34`
- `src/components/leaves/LeaveFilters.tsx:4,47,82`
- `src/components/pdks/dashboard/PDKSFilterBar.tsx:9,56,130`
- `src/components/reports/ReportScreen.tsx:15,63,71`
- `src/components/visitors/VisitorFilters.tsx:1,14,24`

Test ve diğer referans dosyaları:

- `docs/PDKS_KAYITLARI_UX_PLANI_2026-10-16.md:29,31,32`
- `docs/mobile-release/evidence/final-source-sha256.json:873`
- `docs/mobile-release/evidence/initial-git-status.txt:157`
- `docs/mobile-release/evidence/web-build.txt:47`
- `docs/ui-audit-2/06-ziyaretciler.md:25`
- `docs/ui-audit-2/08-pdks-kayitlari.md:28`
- `docs/ui-audit-2/12-denetim-kaydi.md:26`
- `docs/ui-audit-2/fix-06-ziyaretciler-rapor.md:8`
- `docs/ui-audit-2/fix-08-pdks-rapor.md:7`
- `docs/ui-audit-2/review-wave1.md:9,23,27`
- `docs/ui-audit-gk/03-yetki-durumu.md:36,41,48,59`
- `docs/ui-audit-shifts/RAPOR.md:58`
- `docs/ui-scan/00_OZET.md:40`
- `docs/ui-scan/DESIGN_DIRECTION.md:60`
- `docs/ui-scan/PLAN.md:35`
- `docs/ui-scan/pages/01-ana-sayfa/REPORT.md:135,172`
- `docs/ui-scan/pages/02-kisiler/REPORT.md:66,154`
- `docs/ui-scan/pages/03-cihazlar/REPORT.md:43,95`
- `docs/ui-scan/pages/04-sanal-okuyucular/REPORT.md:58,110`
- `docs/ui-scan/pages/05-gecis-kontrol/REPORT.md:53,116`
- `docs/ui-scan/pages/06-ziyaretciler/REPORT.md:30,57,117`
- `docs/ui-scan/pages/07-canli-izleme/REPORT.md:29,51,107`
- `docs/ui-scan/pages/08-pdks-kayitlari/REPORT.md:49,109`
- `docs/ui-scan/pages/09-vardiyalar/REPORT.md:64,132`
- `docs/ui-scan/pages/10-izinler/REPORT.md:55,122`
- `docs/ui-scan/pages/11-denetim-kaydi/REPORT.md:28,52,124`
- `docs/ui-scan/pages/12-admin/REPORT.md:54,116`
- `docs/ui-scan/pages/13-ayarlar/REPORT.md:137`
- `docs/ux-audit/DESIGN_SYSTEM.md:137,140,146`
- `src/components/admin/components/settingsAudit.test.tsx:6,40,43`
- `src/components/pdks/dashboard/auditFixes.test.tsx:57`
- `src/components/shared/FilterBar.test.tsx:3,5,7,15,29,30,34`

## Taranan kontroller ve negatif kontroller

Aşağıda test dışı dosyalardaki input benzeri JSX konumları bulunur. Ham file/checkbox/radio kontrolleri D bulgusuna dahil edilmedi; primitive’in kendi ham DOM öğesi de D değildir. F grubunda somut çift border/radius/ring çakışması doğrulanmadı: PasswordField.tsx:13-20 içinde pr-12, h-11 butona alan bırakır; VisitorFormFields.tsx:31 tarih/saat arasında gap-2 vardır. C için genel bir override yasağı uygulanmadı: ui/sidebar.tsx:320 h-8/bg-background/ring-sidebar-ring özelleştirmesi var ancak repo içinde SidebarInput tüketicisi bulunmadığından ekran hatası sayılmadı.

Kırpılma sayılmayan diğer somut zincirler: CreateRuleDialog.tsx:169 overflow-y-auto px-4 py-4; AddDoorDialog.tsx:39, AddReaderDialog.tsx:39, EditDoorDialog.tsx:113, DoorPlanDialog.tsx:233, CopyDoorPlansDialog.tsx:105 ve TemplateEditor.tsx:192 kendi DialogContent scroll alanında ui/dialog.tsx:39 p-6 mirasını korur. CommandPalette.tsx:38 ve Command.tsx:16 overflow-hidden içerir fakat CommandInput dış ring çizmediği için A yerine B olarak kaydedildi. VisitorFormFields.tsx:24 invalid border selectorı içerdiğinden ana ziyaretçi formu hata border eksikliği olarak işaretlenmedi.

- `src/components/access-control/AddDoorDialog.tsx:44,45`
- `src/components/access-control/AddReaderDialog.tsx:45`
- `src/components/access-control/AddZoneDialog.tsx:95,106`
- `src/components/access-control/CardReadingsFilters.tsx:13,30,31`
- `src/components/access-control/DoorStatusPlanEditor.tsx:33,43,53,102`
- `src/components/access-control/EditReaderDialog.tsx:78`
- `src/components/access-control/MoveReaderDialog.tsx:106`
- `src/components/access-control/door-dialog/DoorGatewayNumberField.tsx:14`
- `src/components/access-control/door-dialog/DoorGeneralFields.tsx:14,28`
- `src/components/access-control/door-dialog/DoorVerifyPlanEditor.tsx:33,43,53,110`
- `src/components/access-control/door-plans/CopyDoorPlansDialog.tsx:119,132,150`
- `src/components/access-control/door-plans/DoorPlanDialog.tsx:289,323,370,398,415`
- `src/components/access-control/door-plans/DoorPlansTab.tsx:109,146`
- `src/components/access-control/unified/components/DepartmentTree.tsx:219`
- `src/components/access-control/unified/components/RuleBasicInfo.tsx:25,37`
- `src/components/access-control/unified/components/TimeSchedule.tsx:89,105,126`
- `src/components/access-control/unified/components/ZoneDeviceTree.tsx:279`
- `src/components/access-control/unified/rules-list/RulesFilters.tsx:72`
- `src/components/access-control/unified/status/StatusFilters.tsx:29`
- `src/components/access-control/unified/templates/TemplateEditor.tsx:71,207,215`
- `src/components/access-control/unified/templates/TemplatePicker.tsx:33`
- `src/components/access-control/unified/templates/TemplatesPage.tsx:213`
- `src/components/layout/CommandPalette.tsx:43`
- `src/components/layout/ProjectSwitcher.tsx:22`
- `src/components/shared/DateRangeFields.tsx:33,44`
- `src/components/shared/FilterBar.tsx:31`
- `src/components/shared/PaginationBar.tsx:53`
- `src/components/shared/PasswordField.tsx:14`
- `src/components/ui/date-picker.tsx:408`
- `src/components/ui/input.tsx:8`
- `src/components/ui/sidebar.tsx:316`
- `src/components/ui/textarea.tsx:11`
- `src/components/visitors/VisitorCardCapture.tsx:118`
- `src/components/visitors/VisitorCombobox.tsx:18`
- `src/components/visitors/VisitorFilters.tsx:17`
- `src/components/visitors/VisitorFormFields.tsx:31,32,36,37,38,41,43,44`
- `src/components/visitors/VisitorZoneDialog.tsx:141`

## Kapı kontrolü

Başlangıç ve bitişte `git status --porcelain src convex` çıktıları karşılaştırıldı: aynı 30 değiştirilmiş ve 4 izlenmeyen dosya kaydı korundu. Kaynak dosyalarına yazma, Git mutasyonu, kurulum, test/deploy veya Convex komutu çalıştırılmadı; yalnız bu rapor oluşturuldu.
