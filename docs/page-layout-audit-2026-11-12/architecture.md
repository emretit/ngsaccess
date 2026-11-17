# Ortak sayfa mimarisi denetimi — 12 Kasım 2026

## Sonuç ve kapsam

Uygulamada ortak kabuk zaten var: `App.tsx:71` altındaki yönetim rotaları `Layout` üzerinden açılıyor. Eksik olan, kabuğun içindeki **ortak sayfa şablonu**. `PageHeader` başlığı, `MasterDetailListLayout` ise yalnızca iki sütun yerleşimini ortaklaştırıyor; başlık/alt gezinme/özet/filtre/sonuç/durum/altlık sıralamasının sahibi bugün sayfaların kendisi. “Tek layout” hedefi, isteğe bağlı yuvaları olan tek `PageTemplate` sözleşmesi olarak uygulanmalı. Takvim, rapor tablosu, canlı akış ve ayar formu aynı içerik türüne zorlanmamalı.

Bu belge yalnızca kaynak kod denetimidir. `frontend-design`, `ux-designer` becerileri ve proje kökündeki AGENTS.md kuralları okundu; incelenen `src` ve `docs` altında ek AGENTS.md bulunmadı. Mevcut çalışma ağacında çok sayıda kullanıcı değişikliği vardı; gözlemler diskteki güncel sürüme aittir, bunlar geri alınmadı. Uygulama ve backend dosyaları değiştirilmedi; web araştırması, çalışan tarayıcı/görsel deneme, ekran okuyucu testi veya kullanıcı araştırması yapılmadı. Kullanıcı etkileri kaynak koddan çıkarımdır; ölçülmüş kullanılabilirlik sonuçları değildir.

Önem: **Yüksek**, yön bulma/erişim/iş akışında belirgin risk; **Orta**, modüller arası öğrenme ve hizalama sorunu; **Düşük**, yerel görsel tutarsızlık. Bu kapsamda kritik hata doğrulanmadı.

## Bulgular

| Kimlik / önem | Somut kanıt | Kullanıcı etkisi | Önerilen ortak kural |
|---|---|---|---|
| A1 — Orta: sayfa ritmi modüle bağlı | Kişiler `src/pages/Employees.tsx:179` ve Canlı İzleme `src/pages/LiveMonitoring.tsx:11`: `space-y-6`; Cihazlar `src/components/devices/DevicesContent.tsx:84` ve Ziyaretçiler `src/components/visitors/VisitorManagement.tsx:44`: `space-y-5`; PDKS `src/pages/PDKSRecords.tsx:69`: `space-y-4`; Ayarlar `src/pages/Settings.tsx:66`: `space-y-8`. | Modül değişince başlığın altındaki ilk içerik 16/20/24/32 px aralıklarla yer değiştiriyor; ortak ürün yerine ayrı ekranlar hissi oluşuyor. | Dış bölümler arası tek ritim; içerik içi yoğunluğu yerel tut. `PageTemplate` bölüm aralıklarını yönetmeli. |
| A2 — Orta: içerik genişliği ve iç boşluk sahibi belirsiz | Kabuk `src/components/Layout.tsx:53`: `p-4 min-[761px]:p-8`; Profil `src/pages/Profile.tsx:22`: ayrıca `container mx-auto py-8`; Mühendislik `src/pages/EngineeringDepartment.tsx:6`: ayrıca `container ... py-6`; `tailwind.config.ts:14` container için 2rem padding tanımlıyor. Ana Sayfa `src/pages/Index.tsx:19`: ortalı 1536 px sınırı; Ayarlar `src/pages/Settings.tsx:70`: yalnız içerik sütununda 800 px sınırı. | Bazı sayfalar fazladan içeri kayıyor ve daha aşağıdan başlıyor. Büyük ekranda aynı kabuk içinde farklı eksenler oluşuyor. Form genişliğinin sınırlandırılması yararlı, fakat örtük ve tekrarlanabilir değil. | Dış yatay boşluk yalnız kabukta; `width="wide" | "form"` şablon seçimi. Form sınırı içerik sütununa uygulanmalı, global başlık ekseni korunmalı. |
| A3 — Orta: alt gezinme ve yerel yan panel üç ayrı sistem | `src/components/shared/MasterDetailListLayout.tsx:12`: 1100 px üstü yan yana, 20 px gap; `src/pages/Settings.tsx:68`: 761 px üstü yan yana, 48 px gap; `src/pages/Reports.tsx:43`: `lg` üstü 184 px yan gezinme, 32 px gap. Ayar seçicisi `src/components/settings/SettingsSidebar.tsx:23`, rapor seçicisi `src/pages/Reports.tsx:45`; Geçiş Kontrol sekmeleri `src/components/access-control/unified/UnifiedAccessControl.tsx:79` farklı yapı. | Yerel gezinme kimi modülde açılır liste, kiminde ağaç, kiminde sekme; görünürlük ve yatay yerleşim eşiği değişiyor. Farklı görevler haklı olabilir, ancak davranışın sahibi ortak değil. | `navigation` (bölümler/sekmeler) ile `aside` (departman/bölge/vardiya filtresi) ayrı yuvalar olmalı. Aynı gezinme türü ortak bileşen kullanmalı; ağaçlar taşınabilir şekilde korunmalı. |
| A4 — Orta: başlık eylem API’si uygulamayı sınırlıyor | `src/components/shared/PageHeader.tsx:16` birincil eylemi sadece label/onClick/disabled ile tanımlıyor; `:24` her eyleme `Plus` ekliyor ve sıralamayı `children → secondaryMenu → primaryAction` olarak sabitliyor. Kişiler `src/pages/Employees.tsx:180` ve Cihazlar `src/components/devices/DevicesContent.tsx:85` kendi menülerini children ile ekliyor. PDKS `src/pages/PDKSRecords.tsx:73` işlemler menüsünü, `:104` dolu Vardiya planı düğmesini ayrı geçiriyor. Vardiya `src/pages/ShiftPlan.tsx:50` başlığın çevresinde yeniden border/geri/eylem satırı kuruyor. | Eylem konumu, düğme boyutu ve birincil eylem vurgusu modül sahiplerinin tercihine kalıyor. Dışa aktarma ya da gezinme gibi birincil işlemler artı simgesine zorlanıyor veya ortak API atlanıyor. | Semantik `primaryAction`, `secondaryActions`, `backLink` yuvaları; özel menü de kabul eden birincil yuva. Varsayılan artı simgesi kaldırılmalı, simge eylem tarafından seçilmeli. |
| A5 — Orta: modül başlığı durum ekranlarında kayboluyor | Kişiler `src/pages/Employees.tsx:167` proje yokken başlıktan önce dönüyor; Cihazlar `src/pages/Devices.tsx:143` ve `:151` unavailable durumunda başlıklı içeriği değiştiriyor. Ziyaretçiler `src/components/visitors/VisitorManagement.tsx:44` başlığı koruyup durumu gövdede gösteriyor. Raporlar `src/pages/Reports.tsx:30` yüklenme/yetki durumunda doğrudan dönüyor. Ortak erişim bileşeni `src/components/shared/AccessDenied.tsx:19` 400 px minimum alan ve `:29` h3 kullanıyor. | Proje/yetki değişiminde sayfa kimliği ve üst hizalama tutarsızlaşıyor; özellikle mobilde kabuk breadcrumb’ı da gizli olduğundan bağlam azalıyor. | `PageTemplate` başlığı her durumda kalsın; yüklenme/proje seçimi/yetkisizlik/hata gövde yuvasını değiştirsin. Veri boşluğu ve filtreyle eşleşmeme, sonuç bölgesinin durumları olsun. |
| A6 — Orta: breadcrumb ve duyurulan başlık alt rotayı temsil etmiyor | `src/components/Layout.tsx:34` ilk prefix eşleşmesinin adını seçiyor; `src/lib/routeMeta.ts:13` yalnız PDKS kökünü, `:15` yalnız Raporlar kökünü tanımlıyor. `src/App.tsx:80` PDKS ayar/plan, `:89` rapor grup/slug rotaları var. `Layout.tsx:51` aynı genel adı duyuruyor; `src/components/layout/AppHeader.tsx:32` yalnız Ana Sayfa / modül adı gösteriyor. Vardiya gövdesinin adı `src/pages/ShiftPlan.tsx:55` Vardiya planı. | Ayrıntı/alt bölümde üst çubuk ve ekran okuyucu duyurusu hâlâ PDKS veya Raporlar diyor; kullanıcı bulunduğu basamağı üst gezinmeden ayırt edemiyor. | Modül menüsü metadatasını sayfa metadatasından ayır; rota eşleşmesinden gerçek sayfa başlığı ve breadcrumb zinciri üret. `PageTemplate` ile kabuk aynı çözümlenmiş sayfa tanımını kullansın. |
| A7 — Orta: breakpoint sözlüğü parçalı | Kabuk/menü 760/761: `src/components/ui/sidebar.tsx:66`, `src/components/layout/AppHeader.tsx:30`; başlık tipi 761: `src/components/shared/PageHeader.tsx:23`; aynı başlık düğmesi `md`: `:8`. Mobil sonuçlar `src/components/shared/ResponsiveResults.tsx:16` `md` kullanıyor; yerel panel 1100: `MasterDetailListLayout.tsx:12`; rapor paneli `lg`: `src/pages/Reports.tsx:43`. `tailwind.config.ts` varsayılan md/lg eşiklerini değiştirmiyor. | 761–767 px aralığında masaüstü kabuğu ile mobil sonuç/düğme davranışı karışıyor. 1024–1099 px aralığında rapor yan gezinmesi açılırken kişi/cihaz paneli hâlâ üstte. Bu farkların taşma yarattığı canlı olarak doğrulanmadı. | Adlandırılmış ortak eşikler tanımla: kabuk, veri görünümü, yerel panel. Aynı davranış aynı eşiği kullansın; görev kaynaklı istisna açıkça belgelenmeli. |
| A8 — Yüksek risk, canlı doğrulama gerekli: kaydırma sıfırlama yanlış yüzeyi hedefliyor | `src/components/Layout.tsx:49` kabuk h-screen/overflow-hidden, `:53` gerçek kaydırıcı main/overflow-auto. `src/App.tsx:50` yorum kabuğun kendi kaydırmasını yönettiğini söylüyor ama `:52` yalnız window.scrollTo çağırıyor. `Layout.tsx:28` rota değişiminde yalnız main.focus çağırıyor; main için açık scrollTo/restorasyon yok. | Uzun bir listeden başka modüle geçerken önceki main konumu korunabilir; yeni başlık görünmeden içerik ortasından başlanabilir. Focus’un tarayıcıya bağlı kaydırma etkisi bu kodu garantili restorasyon yapmıyor. | Kaydırma politikasını gerçek main sahibi yönetsin: yeni pathname için başa dönüş, POP için konum geri yükleme; query filtre değişiminde gereksiz sıfırlama olmasın. Canlı çapraz rota testiyle doğrulanmalı. |
| A9 — Düşük: başlık semantiği/typografi ortak katmanı atlıyor | `src/components/shared/PageHeader.tsx:23` semibold/özel leading ve tracking; Profil `src/pages/Profile.tsx:23`, Mühendislik `src/pages/EngineeringDepartment.tsx:7` font-bold/mb-6 ile elle h1. Denetim yetkisizlik durumu `src/pages/AuditLog.tsx:42` başka bir text-base h1. | Başlık hiyerarşisi aynı uygulamada farklı ölçekte; durum değişimlerinde sayfa kimliği bazen durum mesajına dönüşüyor. | Tek sayfa h1’i şablon üretmeli; içerik bölümleri h2, tablo/hata alt başlıkları bağlama göre devam etmeli. Durum mesajı h1’in yerini almamalı. |

## Korunacak temeller

- `Layout.tsx:47` içeriğe atlama bağlantısı, `:28` rota değişiminde odak aktarımı ve `:54` proje/rota anahtarlı hata sınırı iyi bir başlangıç. Şablon bunları ikinci kez üretmemeli.
- `AppHeader.tsx:29` üst çubuk, `AppSidebar.tsx:15` ortak menü ve `routeMeta.ts:39` ortak görünürlük kaynağı tek kabuk için mevcut altyapı. Menü yapısını baştan kurmak gerekmiyor.
- `src/index.css:19` ve `:45` yüzey/çizgi/metin/semantik renk tokenları, `:316` azaltılmış hareket ve `:326` menü odak/aktif durumları mevcut. Modernleşme, mevcut bordo marka ve nötr yüzeylerden başlayıp hizalama ve hiyerarşiyi düzeltmeli; her bölüme yeni dekoratif kart eklemek gerekmiyor.
- `FilterBar`, `ResponsiveResults`, `PaginationBar`, `SectionSkeleton`, `EmptyState`, `ErrorState`, `QuerySectionBoundary` korunacak ortak parçalar. `QuerySectionBoundary.tsx:26` içerik etrafında section üretiyor; yeni şablon bunların etrafına gereksiz landmark zinciri eklememeli.

## Önerilen birleşik sözleşme

Katman sahipliği:

1. **AppShell (mevcut Layout):** kimlik/yetki kapısı, proje seçici, global menü, global eşitleme bildirimi, tek main, dış gutter, kaydırma/odak, rota seviyesinde hata ve lazy yükleme.
2. **PageTemplate (yeni ortak sayfa):** tek h1, kapsam/açıklama, geri bağlantısı, sayfa eylemleri; aşağıdaki isteğe bağlı yuvaların sırası, genişliği ve aralığı.
3. **Modül içeriği:** filtre state’i, sorgular, yetki kararları, form koruması, takvim/tablo/kartların içi ve modüle özgü diyaloglar. Şablon backend sorgusu veya iş yetkisi çalıştırmaz.

Önerilen yuva sırası:

```text
[kabuk: menü | proje seçici + breadcrumb + hesap]
main (dış boşluk yalnız burada)
  [geri bağlantısı?]
  [başlık + kapsam/açıklama | ikincil eylemler? + birincil eylem?]
  [sayfa bildirimi?]
  [yerel gezinme?]
  [özet?]
  [yerel panel? | araç çubuğu? / filtreler? / içerik / altlık?]
  [detay paneli / diyaloglar?]
```

Yuva sırası kasıtlıdır: başlık her modülde global eksende kalır; filtreler ve altlık sonuç sütunuyla hizalanır. `navigation` gerçek bölüm/rota gezinmesi içindir; `aside` veri kapsamı filtresidir. Gezinme görünümü sekme, yan liste veya mobil seçici olabilir; hepsini sekmeye dönüştürmek gerekmez. Raporlarda bugünkü iç sütun başlığı global başlık yuvasına taşınmalı. Sayfanın birincil eylemi tek görünür odakta olmalı; satır işlemleri içerikte kalmalı.

Aşağıdaki TypeScript yalnızca önerilen API’dir; uygulanmış bileşen değildir:

```tsx
type SayfaDurumu =
  | { kind: 'ready' }
  | { kind: 'loading'; content?: ReactNode }
  | { kind: 'noProject'; content: ReactNode }
  | { kind: 'denied'; content: ReactNode }
  | { kind: 'error'; content: ReactNode };

type PageTemplateProps = {
  title: string;
  scope?: ReactNode;
  description?: ReactNode;
  backLink?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  notice?: ReactNode;
  navigation?: ReactNode;
  summary?: ReactNode;
  aside?: { label: string; content: ReactNode };
  toolbar?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  overlays?: ReactNode;
  width?: 'wide' | 'form';
  state?: SayfaDurumu;
};
```

`ReactNode` yuvaları mevcut menüleri, guarded aksiyonları ve portal hedeflerini kayıpsız taşıyabilmek içindir. Ortak `PageAction` yardımcı bileşeni link/button, simge, pending/disabled ve mobil boyutu birleştirebilir. `PageHeader` bu sözleşmenin iç parçası olur; mevcut çağrıları kısa süreli adaptörle desteklenebilir. `MasterDetailListLayout` şablonun gövde yerleşimi olarak içeride kullanılabilir; başlık ve durumların da sahibiymiş gibi genişletilmemeli.

Yerleşim kuralları için başlangıç önerisi: kabukta mevcut 16/32 px dış boşluk, şablon bölümlerinde 24 px, gövde içi gruplarda 16 px. `wide` için ortak üst genişlik sınırı, `form` için yalnız içerik sütununda yaklaşık 800 px sınırı; exact sınır gerçek yoğun rapor/takvim ekranında doğrulanmalı. Yerel panel genişliği ve açılma eşiği tek token ile yönetilmeli; mevcut 220 px panel ve 1100 px eşiği ilk adaydır. Bu sayılar tasarım önerisidir, ölçülmüş nihai karar değildir.

Tüm durumlarda başlık ve geri bağlantısı kalmalı; veri gerektiren eylemler yüklenme/proje/yetki durumuna göre modül tarafından kaldırılmalı veya uygun açıklamayla devre dışı bırakılmalı. `summary`, `filters`, `children`, `footer` gövde durumuna göre değişebilir. Overlay’ler route/proje değişiminde mevcut kapanma ve kaydedilmemiş form korumalarını korumalı; bunlar şablon tarafından sıfırlanmamalı.

## Sayfa şablonuna geçiş envanteri

“Başlık ortak” ifadesi yalnız PageHeader kullanımını gösterir; bugün hiçbir sayfa önerilen tam PageTemplate’i kullanmıyor. Satırlar uygulama rotalarını kapsar, tüm alt bileşenlerin detay denetimi değildir.

| Modül / rota | Mevcut durum ve kanıt | Ortak şablonda kullanılacak yuvalar |
|---|---|---|
| Ana Sayfa `/home` | DashboardHeader üzerinden ortak başlık; 1536 px sınırı `src/pages/Index.tsx:19`, `src/components/dashboard/DashboardHeader.tsx:15` | scope, summary, children; geniş görünüm |
| Kişiler `/employees` | Ortak başlık + MasterDetail; `Employees.tsx:179` | primaryAction, aside, filters, toolbar, children, footer, overlays |
| Cihazlar `/devices` | İç bileşende ortak başlık + MasterDetail; `DevicesContent.tsx:84` | primaryAction, aside, filters, children, overlays |
| Geçiş Kontrol `/access-control` | Ortak başlık, özel sekme/kayıt bildirimi; `UnifiedAccessControl.tsx:56` | scope, primaryAction, secondaryActions, notice, navigation, filters, children, overlays |
| Ziyaretçiler `/visitors` | İnce sayfa wrapper’ı, içerikte ortak başlık; `src/pages/Visitors.tsx:4`, `VisitorManagement.tsx:44` | scope, primaryAction, summary, filters, children, footer, overlays |
| Canlı İzleme `/live-monitoring` | Ortak başlık, header children canlı durumu; `LiveMonitoring.tsx:11` | scope, secondaryActions veya scope içinde durum, filters, children |
| PDKS `/pdks-records` | Ortak başlık, çok katmanlı dönem/filtre bloğu; `PDKSRecords.tsx:69` | scope, primaryAction, secondaryActions, toolbar, filters, children, footer, overlays |
| Vardiya `/pdks-records/plan` | Ortak başlık özel geri/eylem satırında; MasterDetail `ShiftPlan.tsx:49`, `:69` | backLink, scope, secondaryActions, aside, toolbar, children, overlays |
| PDKS ayarları `/pdks-records/settings` | Geri bağlantısı + ortak başlık; `PdksSettings.tsx:22` | backLink, scope, children, state; form genişliği |
| İzinler `/leaves` | Ortak başlık; farklı erken durum dalları; `Leaves.tsx:35`, `:128` | primaryAction, filters, children, footer, overlays, state |
| Raporlar `/reports`, `/:group`, `/:group/:slug` | Hub ortak başlık; grup/detay başlığı iç sütunda, özel sol gezinme; `Reports.tsx:23`, `:43`, `:48`, `src/components/reports/ReportScreen.tsx:97` | backLink, scope, description, navigation, filters, toolbar, children, footer |
| Alarmlar `/alarms` | Ortak başlık durumlarda da korunuyor; `Alarms.tsx:108` | scope, navigation/toolbar (mevcut modül ihtiyacına göre), filters, children, overlays |
| Denetim `/audit-log` | Ortak başlık, özel yetkisizlik h1’i; `AuditLog.tsx:27`, `:42` | scope, secondaryActions, filters, children, footer, state |
| Ayarlar `/settings` | Ortak başlık + özel 184 px gezinme/800 px form; `Settings.tsx:66` | scope, navigation, children, overlays, state; form genişliği |
| Admin `/system-admin` | Ortak başlık, modül wrapper’ı; `SystemAdmin.tsx:35` | primaryAction/secondaryActions, navigation ve children mevcut modül gereksinimine göre |
| Profil `/profile` | Eski container/elle h1; `Profile.tsx:22` | children, state; form genişliği veya içerikte korunan profil grid’i |
| Mühendislik `/engineering-department` | Eski container/elle h1; menüde gizli `routeMeta.ts:18`, rota mevcut `App.tsx:92` | children; sayfanın ürün kapsamındaki gerekliliği ayrıca değerlendirilmeli |
| Eski vardiya/sanal okuyucu yolları | Yönlendirme; `App.tsx:66`, `:82` | Ayrı şablon yok; hedef sayfa kullanılır |
| Landing/auth/kurulum/check-in/kiosk/404 | Yönetim Layout’u dışında; `App.tsx:58`, `:63`, `:68`, `:94` | Yönetim şablonuna zorlanmamalı; mevcut bağımsız görev kabukları korunur |

Tabloda kısa yazılan `Employees.tsx` vb. sayfa yolları `src/pages/` altındadır; `DevicesContent.tsx`, `VisitorManagement.tsx`, `UnifiedAccessControl.tsx` yukarıda tam yollarıyla verilmiştir. Envanterdeki olası yuvalar geçiş önerisidir; mevcut olmayan bir eylem veya alt gezinme ekleme talebi değildir.

## Geçiş sırası ve kabul ölçütleri

1. Kabuk/sayfa sahipliğini sabitle; PageTemplate + PageAction ekle; önce Kişiler ve Cihazlar üzerinde aynı başlık/aside/filtre eksenini kanıtla. Mevcut formları ve filtre state’lerini değiştirme.
2. Ziyaretçiler/İzinler/Alarmlar/Denetim/Canlı İzleme’yi geçir; başlık durum ekranlarında da korunsun. Ardından PDKS/takvim/Geçiş Kontrol için toolbar/navigation/notice yuvalarını doğrula.
3. Ayarlar/Raporlar yerel gezinmesini ortaklaştır; form genişliğini ve mobil seçiciyi aynı sözleşmeye bağla. Profil/Mühendislik eski container ve h1’lerini kaldır; Ana Sayfa sınırını ortak geniş görünümle hizala.
4. Gerçek main kaydırmasını ve rota breadcrumb’larını merkezi olarak düzelt; bu iş sayfa dekorasyonundan önce ele alınabilir.

Uygulama aşamasında doğrulanacaklar: 360/390 px mobil; 760/761/767/768 px kabuk-veri geçişi; 1024/1100 px yerel panel; 1440 px masaüstü; %200 yakınlaştırma; uzun proje ve sayfa adı; proje yok/yetki yok/yükleniyor/hata/veri yok/filtre eşleşmiyor; klavye sırası, skip-link ve geri dönüş odağı. Uzun listeden başka modüle gidiş, POP geri dönüşü ve yalnız query filtre değişimi ayrı denenmeli. Tek h1, tek main, yatay sayfa taşması olmaması, tablo içi yatay kaydırmanın korunması, birincil eylemin mobilde erişilebilir kalması kabul ölçütleri olmalı.

Bu denetimde kod çalıştırılmadığı için tsc/eslint veya test sonucu iddia edilmiyor. Sonraki uygulamada proje kurallarındaki TypeScript ve eslint kontrolleri ile ilgili etkileşim testleri çalıştırılmalı; backend şekilleri ve kullanıcı değişiklikleri korunmalı.
