# W1 — Dropdown audit: primitive, ortak, Geçiş Kontrol, Ziyaretçiler, Cihazlar

## Özet

- **289 dosya** envanter/arama taramasına alındı: 213 üretim/destek dosyası, 76 test dosyası (test mock'ları dropdown sayılmadı).
- **33 benzersiz popup/liste tanımı** incelendi: tüketicilerde 21 SelectContent, 3 DropdownMenuContent, 3 PopoverContent, 1 datalist, 1 CommandPalette listesi; date-picker içinde 2 ana PopoverContent ve 2 elle yazılmış ay/yıl listesi. Wrapper çağrıları ve `.map` tekrarları bu sayıya tekrar eklenmedi; aşağıdaki envanterde ayrıca gösterildi. Beş temel primitive'in kendi implementasyonları ayrıca karşılaştırıldı.
- **13 bulgu: Y=0, O=10, D=3.** En sık kök sebep, dinamik Select listelerinde boş/yükleniyor durumunun wrapper tarafından tanımlanmaması. Tarih seçicideki özel ay/yıl listeleri de ortak Radix davranışlarından ayrılıyor: collision, odak ve seçim semantiği eksik.
- Salt okunur **kaynak kodu auditi** yapıldı; tarayıcı açılmadı. Görsel taşma, ekran okuyucu ve katman davranışı gereken yerler **doğrulanmadı** olarak işaretlendi. Y=0, tarayıcıda bütün akışların kusursuz olduğu anlamına gelmez.
- Kapsam yalnız `src/components/{ui,shared,layout,access-control,visitors,devices,live-monitoring}/`. NativeSelect/ham select dönüşümleri yeniden bulgu yapılmadı. `src/` ve `convex/` dosyalarına yazılmadı.

## Bulgular

Satır numaraları audit anındaki kaynaklara aittir; bütün yollar depo köküne göredir. Ortak sorunlar tüketici başına çoğaltılmadı.

| # | Önem | Kat. | file:line | Öğe | Kanıt (class / ata / prop file:line) | Ekran | Öneri (tek satır) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | O | E | src/components/ui/date-picker.tsx:125 | Ay/yıl alt listeleri | Ay/yıl açıcıları yalnız `onClick` (125–138, 165–178); listeler `div` + button (141–159, 181–205); `aria-expanded`, `aria-controls`, seçim için `aria-selected`/`aria-pressed`, ok tuşu/alt liste Escape ve açılış odağı yönetimi yok; 70–74 yalnız scroll yapıyor. | DatePicker, DateInput, MonthPicker | Ortak erişilebilir Select/Popover liste modeli kullan; açılış odağı, seçim durumu ve klavye kapanışını tanımla. |
| 2 | O | K | src/components/ui/date-picker.tsx:141 | Ay/yıl alt popup konumlandırması | İki popup `absolute left-1/2 top-full -translate-x-1/2` (141, 181), portal/collision ölçümü yok; ay `min-w-[200px]` (142), yıl `min-w-[180px]`, `max-h-[240px] overflow-y-auto` (184–186). Ana popup collision hesabı bu sonradan açılan taşan çocukların sınırını yönetmiyor. | Tarih/ay seçimi; dar veya kısa ekran | İç listeleri collision destekli popup'a taşı ve kullanılabilir yüksekliğe göre sınırla; ekran dışına taşma **doğrulanmadı**. |
| 3 | D | Z | src/components/ui/date-picker.tsx:39 | Üç `z-[9999]` kullanımı | Ana popup ortak sınıfı 39; ay 141; yıl 181. Ana Popover portalı `ui/popover.tsx:14`; Dialog/Sheet içerikleri `ui/dialog.tsx:39`, `ui/sheet.tsx:32` zaten z-50. İç listeler ana popup stacking context'i içinde. | Bütün tarih/ay seçiciler | Sayısal 9999 yerine belgelenmiş overlay seviyesi kullan; üç kullanımın gerekçesi aşağıda, katman bozukluğu **doğrulanmadı**. |
| 4 | O | K | src/components/ui/popover.tsx:20 | Command içeren popover'ların yükseklik sınırı | Popover'da max-height/scroll yok; `ui/command.tsx:63` sabit `max-h-[300px]`; ProjectSwitcher başlık ve arama ekler (`layout/ProjectSwitcher.tsx:19–23`), MonitoringPersonPicker alt açıklama ekler (`live-monitoring/MonitoringPersonPicker.tsx:28`). Kullanılabilir popup yüksekliği CSS değişkeniyle sınırlanmıyor. | Proje, ziyaretçi ve kişi seçimi; kısa viewport | Wrapper'da `--radix-popover-content-available-height` ile toplam popup/list yüksekliğini sınırla; kısa ekranda erişilemeyen satır oluşması **doğrulanmadı**. |
| 5 | D | T | src/components/ui/select.tsx:21 | Select placeholder rengi | Trigger `placeholder:text-muted-foreground` kullanıyor; placeholder metni input placeholder'ı değil, SelectValue span'ı (`select.tsx:12`, tüketim örneği `MoveReaderDialog.tsx:107`); trigger'da `data-[placeholder]:text-muted-foreground` yok. DatePicker ise `!date && "text-muted-foreground"` (`date-picker.tsx:370`) uyguluyor. | Boş seçimli bütün Select alanları | Select'in `data-placeholder` durumunu input placeholder rengiyle eşleştir. |
| 6 | O | T | src/components/live-monitoring/MonitoringPersonPicker.tsx:25 | Kişi combobox tetikleyicisi | Yalnız metin + `w-full justify-start truncate`, chevron yok; outline Button varsayılanı `font-medium`, `border-line`, `focus-visible:ring-offset-2` (`ui/button.tsx:8,16`); Select/Input `border-input`, ring offset 0 (`ui/select.tsx:21`, `ui/input.tsx:11`). | Okuma filtreleri ve okuma ayrıntısında kart atama | Kişi combobox tetikleyicisini form alanı sınıfları ve chevron ile ortaklaştır. |
| 7 | O | W | src/components/live-monitoring/MonitoringPersonPicker.tsx:25 | Kişi popup genişliği | Popup `w-[min(360px,calc(100vw-48px))]`, tetikleyici `w-full`; filtre atası `CardReadingsFilters.tsx:11,28` masaüstünde `w-40`; VisitorCombobox ise trigger değişkenini kullanıyor (`visitors/VisitorCombobox.tsx:17`). | 160px filtre alanı ve geniş Sheet form alanı | Tetikleyici genişliğiyle ilişkili bir min/genişlik politikası seç; 360px bağımsız genişliği açıkça gerekçelendir. |
| 8 | O | E | src/components/live-monitoring/MonitoringPersonPicker.tsx:26 | allowClear açıkken durum mesajı | `CommandEmpty` içinde Aranıyor/Kişi bulunamadı (25), ama `allowClear` her zaman bir CommandItem ekliyor (26); `shouldFilter={false}` ve debounce eşit değilken kişi satırları çizilmiyor (27). Filtre tüketimi allowClear veriyor (`access-control/CardReadingsFilters.tsx:28`). Böylece temizleme satırı varken liste hiçbir zaman cmdk açısından boş değil. | Okuma filtrelerinde kişi arama | Yükleniyor/boş sonuç mesajını gerçek kişi sayısına göre CommandEmpty dışında da göster; cmdk görünürlüğü tarayıcıda **doğrulanmadı**. |
| 9 | O | E | src/components/devices/AssignLocationForm.tsx:156 | Bölge/kapı boş listesi | Bölgeler yalnız `.map` (157–162), kapılar yalnız `filteredDoors.map` (187–193); kapı trigger'ı boş sonuç sayısına göre değil, seçili bölge/loading/submitting'e göre disabled (182). Boş liste mesajı yok. | Cihaz Konum Ata dialog'u | Bölge/kapı bulunamadı durumunu görünür göster ve kapı listesi boşken yönlendirici disabled/açıklama ekle. |
| 10 | O | E | src/components/devices/ClaimDeviceDialog.tsx:196 | Proje listesi yükleniyor/boş durumu | Proje query'si bağımsız (`52`), genel loading yalnız `claimable === undefined` (`144`); SelectContent `(projects ?? []).map` (197–202), projeler için ayrı loading/empty/disabled yok (185–202). | Süper admin Havuzdan ata Sheet'i | Proje sorgusunun loading ve boş sonucunu cihaz havuzundan bağımsız göster. |
| 11 | O | E | src/components/devices/form-sections/DeviceZoneSection.tsx:63 | Düzenlemede boş bölge listesi | İçerik yalnız `zones.map` ve `allowCreate` seçeneği (64–74); düzenlemede `DeviceForm.tsx:220` allowCreate=false. Diğer marka bölge wrapper'ı da aynı şekle sahip (`DeviceLocationSection.tsx:149–165`, tüketim `DeviceForm.tsx:241`). | Cihaz düzenle Sheet'i; bölge listesi boşken | Bölge bulunamadı/açıklama satırı veya açık bir hata durumu ekle; iki bölge wrapper'ında aynı sözleşmeyi kullan. |
| 12 | O | T | src/components/access-control/unified/rules-list/RulesFilters.tsx:74 | Mobil filtre tetikleyicisi | SelectTrigger `max-md:min-h-11`; aynı FilterBar'ın arama input'u `shared/FilterBar.tsx:31` ortak Input kullanıyor, onun yüksekliği `ui/input.tsx:11` h-9; bu FilterBar'da input için eşdeğer büyütme yok. | Geçiş Kontrol > kurallar filtreleri | Aynı filtre satırındaki input ve Select için ortak responsive alan yüksekliği uygula. |
| 13 | D | P | src/components/visitors/VisitorCombobox.tsx:20 | Kaydedilmiş seçim göstergesi | Visitor CommandItem sadece option metni + onSelect (20), MonitoringPersonPicker da aynı (27); seçili `value` ile ilişkili check/işaret yok. CommandItem `data-selected` vurgusu navigasyon durumuna bağlı (`ui/command.tsx:118`); Select gerçek seçim check'i (`ui/select.tsx:125–128`), ProjectSwitcher gerçek seçim check'i (`layout/ProjectSwitcher.tsx:25`) gösteriyor. | Ziyaretçi bölge/ev sahibi ve okuma kişi listeleri | Kalıcı seçimi ayrı check ve erişilebilir seçim metniyle göster; klavye vurgusundan ayır. |

## Primitive'ler yan yana (P)

Sınıflar kaynakta tanımlanan değerlerdir; hesaplanmış tema renkleri ölçülmedi. Farklılıkların tamamı hata değildir: örneğin takvim ay ızgarasının liste satırından farklı olması beklenebilir.

| Özellik | Select | DropdownMenu | Popover | Command | DatePicker / MonthPicker |
| --- | --- | --- | --- | --- | --- |
| Kaynak | `ui/select.tsx:69–97,113–132` | `ui/dropdown-menu.tsx:41–71,75–135` | `ui/popover.tsx:10–25` | `ui/command.tsx:9–33,57–64,111–122` | `ui/date-picker.tsx:32–39,125–205,380–390,473–485` |
| Popup border/radius/bg/gölge | `border rounded-md bg-popover text-popover-foreground shadow-popover` | Aynı | Aynı | Kök `rounded-md bg-popover text-popover-foreground`; kendi border/gölgesi yok, dış Popover/Dialog sağlar | Ana Popover'a `border-input w-auto` ekler; iç ay/yıl `border border-input rounded-md bg-popover shadow-popover` |
| İç boşluk | Viewport `p-1` (88) | Content/SubContent `p-1` (48,66) | `p-4` (20) | Kök padding yok; Group `p-1` (90), input wrapper `px-3` (42) | Ana DatePicker `p-0` + takvim `p-3` (245,381); MonthPicker `p-2` (474); iç ay/yıl `p-2` (142,184) |
| Öğe yüksekliği/metin/padding | Sabit h yok; `text-sm py-1.5 pl-8 pr-2 rounded-sm` | Sabit h yok; normal `text-sm px-2 py-1.5 rounded-sm`; check/radio `pl-8 pr-2` | Öğe primitive'i yok | Sabit h yok; `text-sm px-2 py-1.5 rounded-sm` (118); CommandDialog ayrıca `py-3` (30) | Ay/yıl `text-xs font-medium px-2 py-2 rounded-lg`; grid 3/4 sütun (142,149,186,194) |
| Hover/focus/seçim | `focus:bg-accent focus:text-accent-foreground`, seçili check | Focus accent; checkbox check/radio Circle; SubTrigger açıkken accent | Öğe davranışı tüketiciye ait | `data-[selected=true]:bg-accent/text-accent-foreground`; kalıcı seçim göstergesi otomatik değil | `hover:bg-primary/15 hover:text-primary`; seçili `bg-primary text-primary-foreground`; iç button'larda ortak liste focus sınıfı yok |
| Disabled | `data-disabled:pointer-events-none/opacity-50` | Aynı | Tüketiciye ait | `data-[disabled=true]:pointer-events-none/opacity-50` | Dış button disabled; takvim günleri disabled fonksiyonuna bağlı; ay/yıl listesi için ayrı disabled semantiği yok |
| İkon | Trigger ChevronDown 4/opacity50; seçili Check4 solda; scroll chevron | Normal item otomatik ikon yok; checkbox Check4, radio Circle2, alt menü ChevronRight4 | Otomatik trigger/öğe ikonu yok | Input Search4; seçili check tüketiciye ait | Dış trigger Calendar4; önce/sonra ChevronLeft/Right4; ay/yıl açıcıda chevron/check yok |
| z-index | `z-50` (77) | Content/SubContent `z-50` (48,66) | `z-50` (20) | Kendi z-index'i yok; CommandDialog Dialog z-50 | Ana ve her iki iç liste `z-[9999]` (39,141,181) |
| max-h / scroll | `max-h-96 overflow-hidden`; Radix Viewport ve ScrollUp/Down (77,85–95) | `overflow-hidden`; max-h ve overflow-y-auto yok | max-h/scroll yok | List `max-h-[300px] overflow-y-auto overflow-x-hidden` (63) | Ana popup max-h yok; ayda max-h/scroll yok; yılda `max-h-[240px] overflow-y-auto` (184) |
| Genişlik | `min-w-32`; Viewport `min-w-(--radix-select-trigger-width) w-full` (90), üst max-w yok | `min-w-32`; tetikleyici genişliği bağlı değil | Varsayılan `w-72`; tüketici override eder | `w-full` | Ana `w-auto`, iç ay min200, yıl min180 |
| Portal | Content wrapper her zaman Portal (73) | Content her zaman Portal (61); **SubContent kendi portalını sarmalamıyor** (45) | Her zaman Portal (14) | Kendi portalı yok; CommandDialog Dialog portalı kullanır | Ana dış Popover portalda; iç ay/yıl portalda değil |
| Collision/konum | `position="popper"` varsayılan (72); explicit collisionPadding/avoidCollisions yok; props aktarılır | `sideOffset=4`; explicit collisionPadding/avoidCollisions yok; props aktarılır | `align=center`, `sideOffset=4`; explicit collisionPadding/avoidCollisions yok; props aktarılır | Dış container'a ait | Ana `align=start sideOffset=8` (382–383,475–476), explicit collisionPadding yok; iç absolute listelerde collision mekanizması yok |

**Önemli ayrım:** Radix primitive'inde `collisionPadding` prop'unun verilmemesi collision'ın kapalı olduğunun kanıtı değildir. ProjectSwitcher açıkça `collisionPadding={16}` kullanıyor (`layout/ProjectSwitcher.tsx:18`). Sadece propta padding yok diye diğer bütün tüketicilere ayrı K bulgusu açılmadı. DropdownMenu/SubContent'te sınırsız yükseklik ortak bir sağlamlaştırma noktasıdır; bu kapsamdaki küçük/sabit menülerde taşma doğrulanmadığından ayrı hata sayılmadı. SubContent üretim tüketimi bulunmadı.

## Üç z-[9999] kullanımının gereklilik değerlendirmesi

| Konum | Rol | Gerekli mi? | Kanıt ve sınır |
| --- | --- | --- | --- |
| `ui/date-picker.tsx:39` | DatePicker ve MonthPicker ana popup | **9999 gerekliliği kaynakta kanıtlanmıyor.** | Ortak Popover zaten portal + z-50 (`ui/popover.tsx:14,20`), Dialog/Sheet de 50. Yüksek sayı DOM sırasına bağlılığı örtebilir ama odak/modal sorununu çözmez; kaldırma öncesi iç içe Sheet/Dialog testi gerekir (**doğrulanmadı**). |
| `ui/date-picker.tsx:141` | Ay alt listesi | **9999 için gerekçe yok; yerel üstte görünme seviyesi yeterli olabilir.** | Ana popup içinde relative ay başlığına bağlı absolute çocuk (124,141). Ana stacking context'ten kaçamaz, collision/kırpılmayı çözmez. Sıfır z-index yeterli olduğu iddia edilmiyor; daha düşük yerel seviye görsel testle seçilmeli. |
| `ui/date-picker.tsx:181` | Yıl alt listesi | **9999 için gerekçe yok; ayla aynı.** | Yıl başlığı relative (164), popup absolute (181), kendi scroll alanı var (184); 9999 ana popup stacking context'i dışına geçiş sağlamaz. |

## Dialog/Sheet içinde dropdown envanteri (Z)

Bu liste katman testi kapsamıdır; **eşit z-50 tek başına altta kalma bulgusu değildir**. DOM sırası ve gerçek odak/pointer davranışı tarayıcıda doğrulanmadı. Bu kapsamda kanıtlanmış Y seviyesinde altta kalma yok.

| Ata / kanıt | İç dropdown'lar / kanıt | Portal / değerlendirme |
| --- | --- | --- |
| `access-control/MoveReaderDialog.tsx:89` DialogContent | Hedef kapı SelectContent `109` | Select portalı var; disabled dolu kapılar (111) ve boş hedef açıklaması (118–119) mevcut. |
| `devices/AssignLocationForm.tsx:116` FormDialog → `shared/FormDialog.tsx:49–50` | Bölge `156`, kapı `187` SelectContent | Ata overflow-hidden olsa da Select portalda; doğrudan ata kırpılması beklenmez. |
| `devices/ClaimDeviceDialog.tsx:150` SheetContent; ScrollArea `160` | Proje `196`, havuz cihazı `224`, bölge `322` SelectContent | Üçü de Select portalında; ScrollArea içinde inline popup yok. |
| `devices/DeviceDetailsPanel.tsx:127` DetailSheet → `shared/DetailSheet.tsx:39–43`; DeviceForm `220,254` | DeviceZoneSection `63`; DeviceLocationSection bölge `149`, kapı sayısı `247`; DeviceStatusSection `25`; DeviceBasicSection tip `42`; DeviceHikModelField `70`; DeviceHikvisionSection iletişim `48` | Bütün SelectContent'ler portalda. Form branch zinciri `DeviceForm.tsx:217–256`; DeviceBasicSection model bağlantısı `79`. Yeni bölge Dialog'u `DeviceLocationSection.tsx:180` bu Select'leri **içermiyor**, kardeş; yanlışlıkla iç içe dropdown sayılmadı. |
| `visitors/VisitorSlideOverPanel.tsx:31–41,54` DetailSheet/VisitorForm; alan bağlantısı `VisitorForm.tsx:46` | Bölge ve ev sahibi VisitorCombobox `VisitorFormFields.tsx:28,40` → popup `VisitorCombobox.tsx:17`; geçerlilik DateInput `VisitorFormFields.tsx:31`; kayıt okuyucusu `VisitorFormFields.tsx:33` → SelectContent `VisitorCardCapture.tsx:121` | Combobox ve tarih ana popup'ı portalda, tarih alt listeleri ana popup içinde. Popover modal override verilmemiş. |
| `visitors/VisitorSlideOverPanel.tsx:31,55` DetailSheet/ayrıntı | Kayıt işlemleri RowActions `97` → `shared/RowActions.tsx:6` | DropdownMenu portalda; Root'ta modal override yok. |
| `live-monitoring/ReadingDetailPanel.tsx:36`; içerik `27`; `AssignReadingCardForm.tsx:40` | MonitoringPersonPicker → `MonitoringPersonPicker.tsx:25` Popover/Command | Popup portalda; z-50 ve modal override yok. Focus trap/pointer akışı **doğrulanmadı**. |
| `access-control/unified/templates/TemplateEditor.tsx:194,223` DialogContent/WeekEditor | Bitiş saati datalist `78,110` | Native browser öneri popup'ı; Radix portal/z-index ile yönetilmez. |
| `layout/CommandPalette.tsx:38` DialogContent | CommandInput/List `43–46` | Command doğrudan dialog içinde, ikinci popup/portal değil; tek Dialog katmanı. |

`shared/DateRangeFields.tsx:33,44` tüketicilerinden gelen Dialog/Sheet ataları bu kapsamdaki dosyalarda bulunmadı; kapsam dışı çağrı zincirleri taranmadı. Bunlar Z listesine varsayımla eklenmedi. `DeviceForm`'un kapsam dışındaki diğer kullanıcıları da varsayılmadı.

## Tam dropdown envanteri

Aşağıdaki tanım adedi toplamı **33**; tekrar eden satırlar ve wrapper çağrıları çalışma zamanı sayısı değildir.

| Dosya/alan | Tanım adedi | Kanıt ve kapsam |
| --- | --- | --- |
| `ui/date-picker.tsx` | 4 | DatePicker ana popup 380, MonthPicker ana popup 473, ortak ay 141 ve yıl 181; DateInput 409 dış DatePicker'ı tekrar kullanır. |
| `shared/PaginationBar.tsx` | 1 | Sayfa boyutu SelectContent 54; trigger erişilebilir adı 53. |
| `shared/RowActions.tsx` | 1 | Menü 6; ikon-only trigger aria-label mevcut. Kapsamdaki 7 çağrı: RuleRow 125, VisitorTable 14, VisitorSlideOverPanel 97, DeviceTableRow 172, LocationTree 265, LocationDoorItem 102 ve 145. |
| `layout/ProjectSwitcher.tsx` | 1 | Popover 18 + içinde CommandList 23 aynı dropdown; loading/empty 12–13, collisionPadding16, uzun ad break-words 25. |
| `layout/AppHeader.tsx` | 1 | Hesap menüsü 41; trigger aria-label 38; loading/disabled çıkış öğesi 47. |
| `layout/CommandPalette.tsx` | 1 | Dialog içinde CommandList 44; CommandEmpty ve input aria-label 43–44. |
| `access-control/MoveReaderDialog.tsx` | 1 | Hedef kapı 109. |
| `access-control/CardReadingsFilters.tsx` | 1 | FilterSelect implementasyonu 13; 4 çağrı cihaz/kapı/sonuç/kaynak 26–30. Kişi wrapper 28, 2 DateInput 31–32 ayrıca mevcut. |
| `access-control/unified/rules-list/RulesFilters.tsx` | 1 | SelectContent 78; sabit dizide 3 filtre 35–65. |
| `access-control/unified/status/StatusFilters.tsx` | 1 | StatusFilter implementasyonu 35; 5 çağrı 63,73,81,89,99 (departman/cihaz/kural/şablon/durum); her listede Tümü var (36). |
| `access-control/unified/templates/TemplateEditor.tsx` | 1 | Bitiş saatinde list prop 78; datalist 110, tek 24:00 seçeneği 111. |
| `visitors/VisitorFilters.tsx` | 1 | Durum 17–20. |
| `visitors/VisitorCardCapture.tsx` | 1 | Kayıt okuyucusu 121; boş durumda dış açıklama **var** (155), bu nedenle E boş-mesaj bulgusu açılmadı. |
| `visitors/VisitorCombobox.tsx` | 1 | Popover 17 + CommandList 18 tek dropdown; VisitorFormFields 28,40 iki çağrı, CommandEmpty mevcut. |
| `devices/DeviceFilters.tsx` | 2 | Bağlantı 33 ve tip 42; Tümü her ikisinde var. |
| `devices/DeviceAddMenu.tsx` | 1 | Menü 33; chevron 30, 2–3 açıklamalı öğe. |
| `devices/ClaimDeviceDialog.tsx` | 3 | Proje 196, cihaz 224, bölge 322. |
| `devices/AssignLocationForm.tsx` | 2 | Bölge 156, kapı 187. |
| `devices/form-sections/DeviceBasicSection.tsx` | 1 | Tip 42. |
| `devices/form-sections/DeviceHikModelField.tsx` | 1 | Model 70; manuel seçenek 76. |
| `devices/form-sections/DeviceHikvisionSection.tsx` | 1 | İletişim yöntemi 48; legacy seçeneği 50, disabled select 42. |
| `devices/form-sections/DeviceLocationSection.tsx` | 2 | Bölge 149, kapı sayısı 247; loading placeholder 144. |
| `devices/form-sections/DeviceStatusSection.tsx` | 1 | Durum 25. |
| `devices/form-sections/DeviceZoneSection.tsx` | 1 | Bölge 63. |
| `live-monitoring/MonitoringPersonPicker.tsx` | 1 | Popover + CommandList 25 tek dropdown; CardReadingsFilters 28, AssignReadingCardForm 40 iki çağrı. |

Ek tarih wrapper çağrıları: `shared/DateRangeFields.tsx:33,44` ve `visitors/VisitorFormFields.tsx:31`. CommandList bir Popover'ın içinde olduğunda ayrı dropdown sayılmadı. `DropdownMenuSubContent`, `CommandDialog` ve çıplak Popover primitive export'ları için bu alanlarda ek üretim çağrısı bulunmadı. Elle yazılmış diğer absolute öğeler checkbox dekorasyonu, sidebar araçları, parola düğmesi ve WeekPreview çizimi; dropdown değiller.

## Ortak kök sebepler

1. **Dinamik Select durum sözleşmesi yok (#9–11).** Select primitive boş veri hakkında karar veremez; domain wrapper'ı loading/empty/disabled üretmeli. Etkilenenler: `devices/AssignLocationForm.tsx:156,187`, `devices/ClaimDeviceDialog.tsx:196`, `devices/form-sections/DeviceZoneSection.tsx:63`, `devices/form-sections/DeviceLocationSection.tsx:149`. Tek bir durum sunum yaklaşımı bu dört dosyada kullanılabilir. MoveReaderDialog ve VisitorCardCapture dış boş açıklaması sunduğu için aynı bulgulara dahil edilmedi.
2. **DatePicker özel alt listeleri ortak popup davranışını atlıyor (#1–3).** Düzeltme merkezi `ui/date-picker.tsx:45` MonthYearSelector ve `39` ortak popup sınıfı. Etkilenen doğrudan kapsam tüketicileri `shared/DateRangeFields.tsx:33,44`, `access-control/CardReadingsFilters.tsx:31,32`, `visitors/VisitorFormFields.tsx:31`; MonthPicker export'u da aynı alt selector'ı kullanıyor (`date-picker.tsx:478`). Kapsam dışı tüketiciler sayılmadı.
3. **Popover'ın viewport yüksekliği sözleşmesi eksik (#4).** `ui/popover.tsx:20` veya ortak combobox wrapper'ında çözülmeli; `ui/command.tsx:63` sabit 300px tek başına yeterli değil. Etkilenenler `layout/ProjectSwitcher.tsx`, `visitors/VisitorCombobox.tsx`, `live-monitoring/MonitoringPersonPicker.tsx`; tarih ana popup'ı da toplam kullanılabilir yükseklik kontrolünden yararlanır.
4. **Select placeholder pseudo sınıfı yanlış yüzeyi hedefliyor (#5).** Tek kök `ui/select.tsx:21`. Boş placeholder kullanan kapsam dosyaları: `access-control/MoveReaderDialog.tsx`, `visitors/VisitorCardCapture.tsx`, `devices/ClaimDeviceDialog.tsx`, `devices/AssignLocationForm.tsx`, `devices/form-sections/{DeviceBasicSection,DeviceHikModelField,DeviceHikvisionSection,DeviceLocationSection,DeviceStatusSection,DeviceZoneSection}.tsx`. StatusFilter her zaman Tümü seçtiğinden orada başlangıç placeholder görünümü iddia edilmedi.
5. **Kişi combobox wrapper'ı kendi alan stilini ve durum modelini kuruyor (#6–8).** Tek kök `live-monitoring/MonitoringPersonPicker.tsx:25–28`; iki tüketici `access-control/CardReadingsFilters.tsx:28` ve `live-monitoring/AssignReadingCardForm.tsx:40`. `allowClear` mesaj sorunu yalnız filtre tüketiminde.
6. **Command'ın navigasyon seçimi ile domain seçimi ayrı (#13).** Kalıcı seçim işaretini `CommandItem` kendi başına bilemez; `visitors/VisitorCombobox.tsx:20` ve `live-monitoring/MonitoringPersonPicker.tsx:27` wrapper'ları value ile işaret üretmeli. `layout/ProjectSwitcher.tsx:25` mevcut yerel örnek.

## Doğrulama ve kapı

- Başlangıç `git status --porcelain src convex`: yalnız ` M convex/_generated/api.d.ts` (önceden mevcut).
- **Çıkış status karşılaştırması eşleşmedi:** son kontrollerde aynı komut çok sayıda tracked değişiklik ve untracked dosya verdi (ikinci kontrolde 49 satır); başlangıçta yalnız tek satır vardı. Bu worker'ın tek yazma işlemi bu rapora yapıldı; paylaşılan kaynak ağacı audit sırasında dışarıdan değişti. Değişiklikler geri alınmadı. Örnek yeni değişen yollar: `convex/accessGrantStatus.ts`, `convex/employees.ts`, `src/components/access-control/unified/templates/TemplateEditor.tsx`, `src/components/access-control/unified/CreateRuleDialog.tsx`. Bu nedenle yukarıdaki satır referansları okuma anındaki sürüme aittir; eşzamanlı değişen kaynaklarda yeniden eşleştirme gerekebilir.
- Yazılan tek dosya bu rapordur. Kod düzeltmesi, kurulum, test/build, Convex komutu veya Git mutation çalıştırılmadı.
- Tarayıcı doğrulaması bekleyenler: kısa/dar viewport ay/yıl ve Command taşması (#2,#4), gerçek modal/portal katman akışı (#3 ve Z envanteri), cmdk boş durum görünürlüğü (#8), ekran okuyucu/klavye akışı (#1).

Koordinatör son kontrolde değişikliklerin başka oturuma ait olduğunu doğruladı ve aynı-status kapısını bu nedenle geçersiz saydı (`msg_fd319235bda7`); yalnız rapor yazıldığı için görevin `succeeded` ile kapanmasını istedi. Bu worker yalnız bu rapor dosyasına yazdı.
