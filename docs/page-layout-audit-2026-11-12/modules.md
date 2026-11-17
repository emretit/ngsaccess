# NGS Access — modül sayfası tutarlılığı denetimi

Tarih: 12 Kasım 2026. Kapsam: Employees, Devices, Visitors, Alarms, AccessControl, PDKSRecords, ShiftPlan, Reports ve Settings. Amaç: modern, ortak bir sayfa şablonu için mevcut kodun karşılaştırılması; uygulama veya yeniden tasarım yapılmadı.

## Yöntem ve kanıt sınırı

Bu rapor **statik kaynak kodu incelemesidir**. Rotalar `src/App.tsx:74` ve devamından gerçek alt bileşenlere izlendi; yalnızca `src/pages` sarmalayıcıları değerlendirilmedi. Başlık, eylemler, sekmeler, filtreler, sonuç yüzeyi, sayfalama, ayrıntı paneli, yükleme/boş/hata dalları ve ekran genişliğine bağlı kod kuralları incelendi. `AGENTS.md`, frontend-design ve ux-designer becerileri ve ux-designer/AGENTS.md okundu; kaynak ve mevcut kullanıcı değişiklikleri değiştirilmedi.

Tarayıcı açılmadı; oturum, rol, gerçek veri, hesaplanmış CSS, kaydırma, kontrast, odak sırası, ekran okuyucu ve 200% yakınlaştırma canlı olarak denenmedi. Bu nedenle “taşıyor”, “kırpılıyor”, “kötü görünüyor” veya WCAG ihlali gibi görsel/deneysel sonuçlar ileri sürülmüyor. Etki ifadeleri kod yolunun öngörülen kullanıcı sonucudur; ölçülmüş kullanıcı araştırması değildir. TypeScript/lint/test çalıştırılmadı: teslimat yalnızca rapordur. Satır numaraları paylaşılan, değişiklikler içeren çalışma ağacının inceleme anına aittir; paralel düzenlemelerde kayabilir.

Ortak dış kabuk zaten var: `src/components/Layout.tsx:53` içerik alanını `p-4 / min-[761px]:p-8` ile kuruyor; `:54` rota ve proje anahtarlı hata sınırını, `:58` tembel sayfa yükleme iskeletini sağlıyor. Dolayısıyla aşağıdaki yerel hata sınırı eksikleri uygulamanın tamamının kaybolduğu anlamına gelmez; etki esas olarak modül başlığının/filtrelerinin rota içeriğiyle birlikte değişmesidir.

## Genel değerlendirme

Dokuz modülün normal içerik akışında ortak `PageHeader` kullanılıyor. Ortak h1 ölçeği, `FilterBar`, `PaginationBar`, `TableStateRow`, `DetailSheet`, `MasterDetailListLayout` ve `ResponsiveResults` mevcut; sıfırdan ayrı bir görsel sistem kurmak gerekmiyor. Asıl boşluk, bu parçaların sırasını ve durumlarını yöneten ortak **sayfa sözleşmesinin** bulunmaması. Ortak şablon; liste, takvim, rapor kataloğu ve ayar formunun aynı içeriği göstermesini zorlamadan başlık/bağlam, eylem, filtre, sonuç ve geri bildirim yerleşimini tanımlamalı.

## Öncelikli bulgular

Öncelik: **P1** görev sürdürme/yanlış yönlendirme riski; **P2** tekrarlanan etkileşim ve yerleşim tutarsızlığı; **P3** bakım ve sunum standardı. Bu kapsamda doğrulanmış P0 bulgusu yok.

### 1. P1 — Bazı veri hataları modülün tamamını değiştiriyor

**Kanıt:** `src/pages/Alarms.tsx:98` özet/cihaz sorgularını, `:101` liste sorgusunu doğrudan sayfa bileşeninde çağırıyor; `:109` sonrasındaki içerikte yerel sorgu sınırı yok. `src/components/access-control/door-plans/DoorPlansTab.tsx:77` sorgusu da `src/components/access-control/unified/UnifiedAccessControl.tsx:84` içinde yerel sınır olmadan render ediliyor. Buna karşılık Ziyaretçiler özeti ve listesi ayrı sınırlar içinde (`src/components/visitors/VisitorManagement.tsx:48`, `:50`); Kurallar filtreleri sınır dışında kalıyor (`src/components/access-control/unified/AccessRulesList.tsx:44`, `:52`). Kişiler sınırı tüm `EmployeePage` bileşenini (`src/pages/Employees.tsx:41`), Cihazlar sınırı tüm `Devices` bileşenini kapsıyor (`src/pages/Devices.tsx:216`).

**Etki:** Alarm sorgusu veya Kapı Planları sorgusu hata fırlattığında rota hata ekranına geçebilir; yerel filtreler/sekme seçimi üzerinden toparlanma yolu kaybolur. Kişiler ve Cihazlar hata ekranları yereldir ama başlık ve filtreler yine aynı sınırın içindedir. Modüller arasında aynı hata farklı miktarda içeriği değiştirir.

**Normalleştirme:** Ortak sayfa başlığı, sekme ve filtre alanını veri sınırlarının dışında tutun; sorguyu çağıran sonuç bileşenini `QuerySectionBoundary` çocuğu yapın. Özet ve liste bağımsız başarısız olabilsin. Proje/filtre anahtarıyla sıfırlama ve “Tekrar dene” eylemi ortak sözleşme olsun; Cihazlar’daki özel sınır (`src/components/devices/DeviceListErrorBoundary.tsx:4`) da bu modele uyarlansın. Rota sınırı son savunma olarak kalsın.

### 2. P1 — Proje seçilmemesi aynı modülde farklı anlamlarla sunuluyor

**Kanıt:** Kurallar proje yokken “Önce bir proje seçin” diyor (`src/components/access-control/unified/AccessRulesList.tsx:37`). Yetki Durumu bunu düz bir paragrafla veriyor (`src/components/access-control/unified/status/StatusPage.tsx:37`). Kapı Planları aynı koşulda “Plan kurulabilecek Hikvision kapısı yok” ve “Cihazlara git” eylemini gösteriyor (`src/components/access-control/door-plans/DoorPlansTab.tsx:119`). Kişiler proje yok dalında başlıktan önce dönüyor (`src/pages/Employees.tsx:167`); Visitors başlığı koruyor (`src/components/visitors/VisitorManagement.tsx:45`).

**Etki:** Seçili proje olmaması, desteklenen cihaz bulunmamasıyla karışıyor; kullanıcı proje seçmek yerine envanteri değiştirmeye yönlendirilebilir. Aynı koşulda sayfa kimliğinin korunması da değişken.

**Normalleştirme:** `yükleniyor → yetkisiz → proje gerekli → sorgu yükleniyor → sonuç/boş/hata` durumlarını açıkça ayırın. Her modülde başlık korunsun. Kapı Planları’nda “Proje seçin” durumu, yalnızca proje seçilip sorgu tamamlandıktan sonra gösterilen “uygun kapı yok” durumundan ayrı olsun. Proje seçimi üst kabuğa ait kalmalı; sayfa açıklaması aynı yeri tarif etmeli.

### 3. P2 — Toplu işlemin yeri ve boşken ayırdığı alan farklı

**Kanıt:** Kişiler toplu işlem bileşeni `fixed bottom-4 ... z-40` kullanıyor (`src/components/employees/table/EmployeeTableBulkSelection.tsx:11`). Cihazlar seçimsizken bile 88px, `sm` sonrasında 53px alan ayırıyor (`src/components/devices/DeviceList.tsx:100`). PDKS ortak `BulkBar` kullanıyor (`src/components/pdks/records/PdksRecordsResults.tsx:63`); vardiya bunu takvim yüzeyinin içinde kullanıyor (`src/components/shifts/calendar/ShiftCalendarPlan.tsx:196`). `BulkBar` seçim sıfırken hiç render edilmiyor (`src/components/shared/BulkBar.tsx:4`). Alarmlar toplu onayı filtre eylemlerine koyuyor (`src/pages/Alarms.tsx:115`).

**Etki:** Liste seçimi sonrası işlem aranan konum değişiyor; Cihazlar’da seçim yokken de dikey alan ayrılıyor. Sabit Kişiler panelinin içerik üzerini örtüp örtmediği canlı doğrulama gerektirir; burada kesin örtüşme iddiası yok.

**Normalleştirme:** Sonuç yüzeyinin üstünde ortak seçim/işlem alanı kullanın; sayı, seçim kapsamı, seçimi kaldır ve izinli işlemler aynı sırada olsun. Sabit panel gerekliyse bunu açık bir varyant yapın ve içerik/altlık için alan ayırın. Alarm onayını da bu seçim alanına taşıyın. Cihazlar’ın seçimsiz yönergesi küçük bir yardımcı metin olarak sunulabilir.

### 4. P2 — İkincil sayfa eylemleri filtre ve tablo araçlarına dağılmış

**Kanıt:** Kişiler “İçe aktar / Dışa aktar / Şablon indir” eylemlerini `EmployeeFilters.actions` içinde veriyor (`src/pages/Employees.tsx:205`); Alarmlar bildirim ayarlarını filtre satırına koyuyor (`src/pages/Alarms.tsx:115`). PDKS aynı tür eylemleri başlıktaki “İşlemler” menüsünde sunuyor (`src/pages/PDKSRecords.tsx:73`). Rapor dışa aktarma ve kolon menüsü sonuç başlığında (`src/components/reports/ReportPage.tsx:52`), yenileme ise ayrı bir satırda (`src/components/reports/ReportScreen.tsx:91`). Vardiya eylemleri portal ile dış başlık yuvasına taşınıyor (`src/components/shifts/calendar/ShiftCalendarPlan.tsx:166`; hedef `src/pages/ShiftPlan.tsx:63`).

**Etki:** Kullanıcı genel sayfa işlemini bazı modüllerde başlıkta, bazılarında filtrelerin sonunda veya sonuçtan hemen önce arıyor. Filtre satırı sonuçları değiştirme ve sayfa işlemi başlatma görevlerini birlikte taşıyor.

**Normalleştirme:** Başlıkta birincil iş ve ikincil “İşlemler”; sonuç yüzeyinde görünüm/kolon ayarı; seçim alanında seçili kayda etki eden işler; filtre alanında yalnızca arama/daraltma/temizleme tanımlayın. Rapor ihracatının yalnız yüklenen satırlarla sınırlı olması gibi veri kapsamı açıklamalarını koruyun. Başlık yuvası, menü ve bağlantıları da kabul etmeli; bütün eylemlere `Plus` ikonu dayatmamalı (`src/components/shared/PageHeader.tsx:24`).

### 5. P2 — Dar ekran filtresi, gezinme ve kontrol ölçüleri için ortak karar yok

**Kanıt:** `FilterBar` alanları 761px’den itibaren sabit genişliklere geçiyor (`src/components/shared/FilterBar.tsx:6`, `:36`). `CollapsibleFilters` görünürlüğü `md` ile değişiyor (`src/components/shared/CollapsibleFilters.tsx:20`); raporda tüm filtreler bu katlanır alanın içinde (`src/components/reports/ReportScreen.tsx:75`), Kurallar’da arama dışarıda kalıyor (`src/components/access-control/unified/rules-list/RulesFilters.tsx:25`, `:38`). Kişiler doğrudan filtre çubuğunu kullanıyor (`src/components/employees/EmployeeFilters.tsx:17`); Alarmlar da tüm alanları açık veriyor (`src/components/alarms/AlarmFilters.tsx:22`). Settings 761px’de bölüm seçiciden kenar gezinmesine (`src/components/settings/SettingsSidebar.tsx:23`), Reports ise `lg` ile seçiciden kenar gezinmesine geçiyor (`src/pages/Reports.tsx:45`). Ortak normal düğme yüksekliği `h-9` (`src/components/ui/button.tsx:23`); başlık birincil düğmesi dar ekranda `min-h-11` (`src/components/shared/PageHeader.tsx:8`), PDKS başlık düğmesi normal Button (`src/pages/PDKSRecords.tsx:104`).

**Etki:** Arama ve filtrelerin dar ekranda ilk görünürlüğü, gezinmenin ne zaman değiştiği ve eylem ölçüsü modüle göre değişiyor. Bunlar kaynakta görülen farklı kurallardır; belirli genişlikte taşma veya erişilebilirlik ihlali ölçülmedi.

**Normalleştirme:** Ürün düzeyinde içerik kırılımı ve “arama daima görünür; gelişmiş filtreler sayı/özetle katlanır” kuralı belirleyin. Aynı tür başlık, filtre ve altlık kontrollerine ortak dar ekran ölçüsü verin. Liste yan ağaçları için 1100px kırılımı (`MasterDetailListLayout.tsx:12`) ayrı, adlandırılmış bir yerleşim kararı olarak korunabilir; takvim/rapor için işlevsel istisnaları belgeleyin.

### 6. P2 — Sayfalama veri modeli farklılığından fazla görsel ve anlamsal fark taşıyor

**Kanıt:** Kişiler altlığı tablo çerçevesinin dışında ve sayfa boyutu 10/25/50/100 (`src/pages/Employees.tsx:263`); Cihazlar aynı `PaginationBar` bileşenini kendi yüzeyinin içinde kullanıyor (`src/components/devices/DeviceList.tsx:205`). Visitors imleç geçmişiyle 25/50 seçiyor (`src/components/visitors/VisitorManagement.tsx:62`, `:77`); Kurallar sabit 20 ve altlık yalnız devam/sayfa geçmişi varsa (`src/components/access-control/unified/rules-list/RulesPage.tsx:44`, `:97`). Alarmlar 50’şer ekleyip `LoadMoreFooter` gösteriyor (`src/pages/Alarms.tsx:117`); Rapor geçiş sonuçları hem 50 satırlık yerel sayfalama hem “Daha fazla yükle” kullanıyor (`src/components/reports/ReportPage.tsx:69`; `ReportResults.tsx:79`). PDKS sonuç bileşeninde sayfalama yerine personel sayısı metni var (`src/components/pdks/records/PdksRecordsResults.tsx:93`).

**Etki:** “Sonraki sayfa”, “daha fazla tara/yükle” ve “tüm sonuç” farklı kapsamları anlatıyor. Özellikle raporlarda ek yükleme ile görünen sayfa ilişkisini anlamak ek dikkat istiyor. PDKS’nin sayfalanmaması tek başına performans sorunu kanıtlamaz.

**Normalleştirme:** Ortak sonuç altlığına `bilinen toplam / imleç sayfası / biriktirerek yükle / sayfalamasız` kipleri tanımlayın. Yerleşim ve durum metni aynı olsun; bilinemeyen toplam uydurulmasın. Biriktiren listede “X kayıt yüklendi; daha eski kayıtlar var” ve dışa aktarma kapsamı açık kalsın. Sunucu imlecini yalnız görünüş için sayısal toplamlı sayfalamaya çevirmeyin.

### 7. P2 — Hata/boş/yükleme parçaları ortak olsa da tamamlanma ve toparlanma sözleşmesi eksik

**Kanıt:** Alarm tablosu yükleme/boş satırını kullanırken özet sayaçları yüklemede “—” gösteriyor (`src/pages/Alarms.tsx:112`, `:116`); Visitors özeti `StatInline` yükleme durumunu kullanıyor (`src/components/visitors/VisitorStats.tsx:13`; `src/components/shared/StatInline.tsx:6`). Yetki ayrıntı paneli hata için yalnız metin veriyor, yeniden deneme eylemi yok (`src/components/access-control/unified/status/EmployeeGrantSheet.tsx:45`); PDKS ayrıntısında yeniden dene var (`src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:59`). Kişiler ilk kayıt boş durumunda oluşturma eylemi yok (`src/pages/Employees.tsx:217`); PDKS boş durumunda “Kişilere git” eylemi var (`src/components/pdks/records/PdksRecordsResults.tsx:40`).

**Etki:** Veri henüz yüklenmedi, veri yok ve veri alınamadı durumlarının dili/eylem imkânı değişiyor. Bazı boş ekranlar nedeni açıklasa da sonraki adımı yalnız üst başlığa bırakıyor.

**Normalleştirme:** İlk yükleme, arka planda yenileme, ilk kayıt yok, filtre sonucu yok, izin yok ve hata durumlarını ayrı props/sunum varyantlarıyla tanımlayın. Yenilemede mevcut sonuçları mümkünse koruyun; hata alanında belirli neden ve uygulanabilir tekrar deneme bulunsun. Oluşturma CTA’sını yalnız yetkili kullanıcıya sunun. Alarm sayacı için yüklemeyi ve hatayı “0” veya açıklamasız tireden ayırın.

### 8. P3 — Sonuç yüzeyinin çerçeve/kaydırma sahibi standardı tam uygulanmıyor

**Kanıt:** `Table` zaten kaydırma kabı oluşturuyor ve `framed` seçeneğine sahip (`src/components/ui/table.tsx:19`, `:36`). Kişiler `Table framed` (`src/components/employees/EmployeeTable.tsx:323`), Alarmlar da `framed` kullanıyor (`src/pages/Alarms.tsx:116`). Kurallar dışta tekrar `overflow-x-auto rounded-md border` veriyor (`src/components/access-control/unified/rules-list/RulesPage.tsx:66`). Visitors ve PDKS günlük görünümünde `ResponsiveResults` çerçeveyi yönetiyor (`src/components/visitors/VisitorTable.tsx:19`; `src/components/pdks/dashboard/PDKSTableView.tsx:82`). Bu ortak bileşenin yorumu da iki kaydırma alanından kaçınmayı açıklıyor (`src/components/shared/ResponsiveResults.tsx:15`). Cihazlar kaydırma bölgesine açık ad veriyor (`src/components/devices/DeviceList.tsx:117`); Alarmlar/Raporlar tablosu aynı `scrollLabel` sözleşmesini kullanmıyor.

**Etki:** Çerçeve, kaydırma ve altlık farklı seviyelerde sahipleniliyor; yeni modül eklerken sınır/padding ve klavye kaydırma davranışı ayrışabilir. Kurallar’da iki `overflow` tanımı olması gözlenmiştir; canlı ortamda iki görünür kaydırma çubuğu oluştuğu doğrulanmadı.

**Normalleştirme:** Sonuç yüzeyi dış çerçeve/araç/altlığı; `Table` yalnız kaydırmayı yönetsin. Alternatif olarak tamamen `framed` kullanan tek sözleşme seçin. Kaydırılan sonuçlara ortak adlandırma ve odak politikası sağlayın. Ziyaretçi mobil satırı, PDKS günlük satırı ve takvim ızgarası aynı dış yüzeyi paylaşabilir; içerik türleri korunmalı.

### 9. P3 — Başlık bağlamı, dikey ritim ve ayrıntı ölçüleri yerel istisnalarla büyüyor

**Kanıt:** Kişiler/Cihazlar başlığında `scope` yok (`src/pages/Employees.tsx:180`; `src/components/devices/DevicesContent.tsx:85`); diğerleri proje/iş açıklamasını kullanıyor. Kişiler kökü `space-y-6`, Cihazlar/Visitors `space-y-5`, PDKS `space-y-4`, Settings `space-y-8` (`Employees.tsx:179`; `DevicesContent.tsx:84`; `VisitorManagement.tsx:44`; `PDKSRecords.tsx:69`; `src/pages/Settings.tsx:66`). Vardiya başlığı dışta tekrar border ve eylem satırı kuruyor (`src/pages/ShiftPlan.tsx:50`). Kişiler/Cihazlar `DetailSheet size="lg"` kullanıyor (`src/components/employees/SlideOverPanel.tsx:71`; `src/components/devices/DeviceDetailsPanel.tsx:131`), Visitors 520px’i özel sınıfla veriyor (`src/components/visitors/VisitorSlideOverPanel.tsx:35`), PDKS `sm:max-w-lg` ve tüm panel kaydırması kullanıyor (`src/components/pdks/dashboard/PDKSEmployeeDetailDrawer.tsx:75`), Yetki Durumu doğrudan `SheetContent` kullanıyor (`src/components/access-control/unified/status/EmployeeGrantSheet.tsx:32`).

**Etki:** Ortak h1 olmasına rağmen sayfa açıklaması ve ana bölümler arasındaki ritim ayrı uygulanıyor. Panel farklarının bir kısmı işlevsel; ölçü ve kaydırma istisnalarının kod içinde serbest verilmesi tasarım kararını izlemeyi zorlaştırıyor.

**Normalleştirme:** Sayfa şablonunda bağlam satırı ve bölüm aralığı token’ları; ayrıntıda adlandırılmış dar/standart/geniş varyantlar oluşturun. Okuma paneli ve uzun formun kaydırma farkını açık seçenek yapın. Mevcut kaydedilmemiş değişiklik korumalarını, bekleyen işlemde kapanmayı engellemeyi ve odak dönüşlerini aynen koruyun; bütün panelleri aynı piksel genişliğe zorlamayın.

## Modül matrisi — girişler, başlık ve içerik yerleşimi

Dosya yolları depo köküne göredir. “Yok” yalnızca incelenen ana sayfa akışında bulunmadığını belirtir; özellik eksikliği olduğu anlamına gelmez.

| Modül ve gerçek giriş | Başlık / eylem | Sekme / filtre | Sonuç yüzeyi ve sayfalama |
|---|---|---|---|
| Employees → `src/pages/Employees.tsx:50` (`EmployeePage`) | Kişiler, scope yok; ekle menüsü `:180`; aktarım filtre sonunda `:205` | Departman/şirket ağacı + EmployeeFilters `:183`; durum/arama ve mobil sıralama `src/components/employees/EmployeeFilters.tsx:17` | EmployeeTable framed `src/components/employees/EmployeeTable.tsx:323`; ayrı PaginationBar 10/25/50/100 `Employees.tsx:263` |
| Devices → `src/pages/Devices.tsx:29` → `src/components/devices/DevicesContent.tsx:83` | Cihazlar, scope yok; DeviceAddMenu `DevicesContent.tsx:85` | Konum ağacı + DeviceFilters `:90`; durum/tür/arama | DeviceList dış yüzey + sürekli ayrılmış toplu alan `src/components/devices/DeviceList.tsx:100`; içte PaginationBar `:205` |
| Visitors → `src/pages/Visitors.tsx:4` → `src/components/visitors/VisitorManagement.tsx:21` | Proje + geçici erişim bağlamı; kayıt CTA `:45` | VisitorStats ardından VisitorFilters `:48`; URL q/status | ResponsiveResults: mobil liste / masaüstü Table `src/components/visitors/VisitorTable.tsx:19`; imleç geçmişi 25/50 `VisitorManagement.tsx:77` |
| Alarms → `src/pages/Alarms.tsx:88` | Proje bağlamı `:110`; ayarlar/onay filtre sonunda `:115` | Sayaç kutusu `:112`; olay türü segmented + durum/önem/cihaz/tarih `:113` | Table framed `:116`; 50’şer LoadMoreFooter `:117`; ayrı ayrıntı paneli yok |
| AccessControl → `src/pages/AccessControl.tsx:4` → `src/components/access-control/unified/UnifiedAccessControl.tsx:18` | Proje + sekme açıklaması, kural ekle/senkronizasyon/yenile `:57` | URL sekmeleri Kurallar / Yetki Durumu / Kapı Planları `:65`; her birinin kendi filtresi | Kurallar Table + imleç 20 (`rules-list/RulesPage.tsx:66`); Yetki Durumu kişi/cihaz görünümü + load more (`status/StatusResults.tsx:78`); Kapı Planları 20 (`src/components/access-control/door-plans/DoorPlansTab.tsx:101`) |
| PDKSRecords → `src/pages/PDKSRecords.tsx:49` (`PDKSContent`) | Proje + dönem; Vardiya planı ve İşlemler `:70` | Dönem ve tarih satırı `:109`; PDKSFilterBar `:113`; uyarı ön ayarı `:118` | `src/components/pdks/records/PdksRecordsResults.tsx:62`: sayaç, BulkBar, günlük tablo veya heatmap; personel sayısı, sayfalama yok `:93` |
| ShiftPlan → `src/pages/ShiftPlan.tsx:49` → ShiftCalendarView → `src/components/shifts/calendar/ShiftCalendarPlan.tsx:164` | Geri + proje; Ayarlar ve portal eylem yuvası `ShiftPlan.tsx:50` | ShiftTree; takvim dönem/tarih/arama `ShiftCalendarPlan.tsx:174`; departman atamaları details `ShiftPlan.tsx:80` | Takvim/ajanda yüzeyi + BulkBar; 50 çalışan/sayfa `ShiftCalendarPlan.tsx:212` |
| Reports → `src/pages/Reports.tsx:25` → ReportScreen → ReportResults → ReportPage | Katalog/grup/rapor başlıkları ayrı; detay proje + saat bağlamı `src/components/reports/ReportScreen.tsx:97`; ihracat sonuçta | Katalog + grup kenar gezinmesi `Reports.tsx:43`; katlanır filtre `ReportScreen.tsx:75`; dönem yenilemesi `:91` | `src/components/reports/ReportPage.tsx:64`: kolon seçmeli Table, 50 satır/sayfa `:69`; geçiş raporunda ek yükleme `ReportResults.tsx:80` |
| Settings → `src/pages/Settings.tsx:24` | Ayarlar + proje `:67`; seçilen bölüm h2 `:71`; kaydet bölüm formunda | URL `tab`, SettingsSidebar `:69`; içerik `max-w-[800px]` `:70` | Genel ayar formu `src/components/settings/sections/GeneralSettings.tsx:27`; sekiz bölüm switch’i `Settings.tsx:55`; liste/sayfalama modüle genel olarak uygulanmaz |

## Modül matrisi — durumlar, ayrıntı ve duyarlılık

| Modül | Yükleme / boş / hata kanıtı | Ayrıntı ve dar ekran kuralı | Normalleştirme önceliği |
|---|---|---|---|
| Employees | Yetki/proje için erken dönüş `Employees.tsx:38`, `:161`; ilk kayıt ve filtre boşluğu `:217`; sonuçta TableStateRow `EmployeeTable.tsx:365`; sınır tüm EmployeePage’i kapsıyor `Employees.tsx:41` | DetailSheet 700px lg `SlideOverPanel.tsx:67`; tablo sütunları 760px kuralı `EmployeeTable.tsx:353`; ağaç/içerik 1100px ortak yerleşim | P1 başlığı durumlarda koru; P2 toplu çubuk ve aktarım yuvası |
| Devices | Proje/erişim boşluğu `Devices.tsx:143`; yükleme/boş tablo `DeviceList.tsx:151`; tüm sayfa özel sınır `Devices.tsx:216` | DetailSheet lg `DeviceDetailsPanel.tsx:127`; md/lg/xl ile sütun azaltma `DeviceList.tsx:129`; adlandırılmış kaydırma `:117` | P2 yerel hata kapsamı, seçim alanı; P3 bağlam satırı |
| Visitors | Başlık korunur; yetki/proje/yükleme `VisitorManagement.tsx:47`; ayrı özet/liste sınırı `:48`; tarama devamı ile gerçek boş ayrımı `:71` | 520px özel DetailSheet `VisitorSlideOverPanel.tsx:32`; md altında mobil satır `VisitorTable.tsx:19`, ortak `ResponsiveResults.tsx:16` | Korunacak iyi örnek: durum ayrımı ve bağımsız sınırlar; P3 panel varyantı |
| Alarms | TableStateRow `Alarms.tsx:116`; proje boşluğu `:108`; yerel veri sınırı yok, Layout rota sınırına dayanır | Ayrıntı yok; bildirim ayarları Dialog `Alarms.tsx:118`; genel flex-wrap filtre; sayaç satırında `flex gap-6`, özel wrap yok `:112` | P1 sorgu izolasyonu; P2 filtre yoğunluğu, özet yükleme ve seçim alanı |
| AccessControl | Kurallar proje ve tablo durumları `AccessRulesList.tsx:35`, `RulesPage.tsx:85`; Yetki Durumu satır hatasında tekrar dene `StatusResults.tsx:67`; Kapı Planları yükleme/projesiz `DoorPlansTab.tsx:113` | Sekme yatay kaydırma `UnifiedAccessControl.tsx:79`; kural formu Dialog `CreateRuleDialog.tsx:93`; Yetki kişi Sheet `EmployeeGrantSheet.tsx:32`; Kurallar sütun azaltır `RulesPage.tsx:71`; kapı tablosu mobil block `DoorPlansTab.tsx:145` | P1 Kapı Planları sınırı/projesiz durum; P2 sekmeler arası durum dili |
| PDKSRecords | Tüm içerik boundary `PDKSRecords.tsx:39`; proje/boş durumları `PdksRecordsResults.tsx:28`, `:53`; günlük TableStateRow/ResponsiveResults | Günlük mobil satır `PDKSTableView.tsx:82`; heatmap yatay kaydırma `PDKSHeatmapView.tsx:49`; DetailSheet ve özel odak dönüşü `PDKSEmployeeDetailDrawer.tsx:72` | P2 başlık eylem ölçüsü, ortak sonuç altlığı; mevcut boşluk CTA ve odak korunmalı |
| ShiftPlan | Başlık korunur; proje yükleme/boş/sınır `ShiftPlan.tsx:66`; tanımsız vardiya/çalışan/arama ayrı `ShiftCalendarPlan.tsx:145`; iç takvim sınırı `ShiftCalendarView.tsx:23` | 760px altında compact ve etkin dönem gün `ShiftCalendarPlan.tsx:39`, `:80`; ajanda/ızgara `:209`; atama diyalogları `:225` | P2 eylem yuvasını ortaklaştır; ajanda istisnasını koru; P3 başlık sarmalayıcısı |
| Reports | Yetki yükleme/ret `Reports.tsx:30`; geçersiz bağlantı `:14`; proje boşluğu ve filtre sınırı `ReportScreen.tsx:98`; sonuç sınırı `:92`; tablo boş/yükleme `ReportPage.tsx:66` | lg altında rapor seçici `Reports.tsx:45`; mobil filtre katlanır; aylık tabloda yatay kaydırma/sticky kişi kolonu `ReportPage.tsx:65`; bağımsız kayıt ayrıntı paneli yok | P2 tek sonuç altlığı, eylem yerleşimi; katalog/grup/detay hiyerarşisini koru |
| Settings | Yetki erken dönüş `Settings.tsx:52`; proje boş/yükleme ve bölüm sınırı `:72`; bölüm değişiminde başlığa odak `:36`; Genel ayarlar draft/hata bildirimi `GeneralSettings.tsx:35` | 761px altında native bölüm seçici `SettingsSidebar.tsx:24`; üstte bölüm gezinmesi, masaüstünde 184px yan sütun; bölüm formu kaydet alanı `SettingsSaveBar.tsx:8` | Ortak dış şablon + form varyantı; taslak koruma ve bölüm odak yönetimi korunmalı |

## Önerilen tek şablon sözleşmesi

Bu bölüm uygulama talimatı değil, denetimden türetilen somut normalleştirme hedefidir.

1. **Sayfa kimliği:** Ortak başlık, proje/iş bağlamı, isteğe bağlı geri bağlantısı; tek birincil eylem ve ikincil menü yuvası. Başlık yükleme/boş/hata boyunca korunur.
2. **Bölüm gezinmesi:** İsteğe bağlı sekme veya yan gezinme yuvası. Settings ve Reports bağlantı gezinmesi, AccessControl gerçek sekmeleri kendi anlamlarını korur; hepsi zorla Tabs’a çevrilmez.
3. **Çalışma alanı:** İsteğe bağlı ağaç yan sütunu + tek içerik sütunu. Ağaç kırılımı, form genişliği ve takvim görünümü adlandırılmış varyantlardır; her sayfa kendi boşluklarını tekrar yazmaz.
4. **Filtre/özet:** Görünür arama, gelişmiş filtre açıcı ve aktif filtre özeti; sayaçların sayfa içindeki yeri ortak kuraldır. Takvim dönem gezinmesi özel bir filtre yuvasında kalır.
5. **Sonuç yüzeyi:** Araçlar → seçim işlemleri → veri/durum → sonuç altlığı. Aynı çerçeve/kaydırma sahipliği; veri türü tablo, mobil satır, ısı haritası, ajanda veya form olabilir.
6. **Durumlar:** Proje gerekli, yetkisiz, ilk yükleme, yenileme, ilk kayıt yok, filtre sonucu yok, tarama sürüyor ve hata ayrı durumlar. Kısmi hata sadece etkilenen alanı değiştirir; yeniden deneme kapsamı bellidir.
7. **Ayrıntı:** Ortak DetailSheet ölçü/kaydırma/başlık/footer seçenekleri; uzun kural düzenleme gibi çok sütunlu işler Dialog varyantı olarak korunur. Taslak koruma ve odağın tetikleyiciye dönüşü kabul kriteridir.

Uygulama sırası: önce Alarmlar/Kapı Planları hata ve projesiz durumları; sonra ortak eylem/seçim/sonuç-altlığı sözleşmesi; ardından filtre kırılımları ve yüzey sahipliği; en son başlık bağlamı/ritim/panel varyantları. Ortaklaşma için en güçlü mevcut referanslar: Ziyaretçiler’in bağımsız sınırları, PDKS’nin günlük mobil sonuçları, Settings’in bölüm odak ve taslak yönetimi ve Vardiya’nın dar ekranda ajandaya geçişi.

## Kapsam ve kalan doğrulama

Dokuz modülün rota ve gerçek içerik girişleri; ana filtre, tablo/sonuç, sayfalama ve erişilebilir ayrıntı kabukları incelendi. AccessControl’un üç alt görünümü; Reports’un katalog/grup/detay akışları; Settings’in sekiz bölüme yönlendirmesi, Genel ayarlar ve Raporlar bölümünün girişleri ayrıca okundu. Settings’in bütün alt alanları, tüm rapor türlerinin veri doğruluğu, her formun tüm adımları, iş kuralları ve backend bu denetimin kapsamı dışındadır.

Sonraki aşamada aynı rol/proje ile 360, 760, 768, 1024, 1100 ve 1440px genişliklerde; ilk yükleme, sıfır kayıt, filtreyle sıfır, kısmi sorgu hatası, çoklu seçim, panel ve uzun Türkçe metin senaryoları canlı doğrulanmalıdır. Kaydırma/odak dönüşü ve yakınlaştırma ayrıca denenmelidir. Bu çalışma bu kontrollerin geçtiğini iddia etmez ve kaynak düzeltmesi içermez.
